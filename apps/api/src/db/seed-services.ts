/**
 * Demo de negocios de SERVICIOS: un usuario con dos negocios para comparar perfiles.
 *   servicios@dream.co / Dream2026
 *   - TecnoCell Reparaciones (técnico en reparación de celulares)
 *   - Ríos & Asociados Abogados (firma de abogados)
 * Todos los datos son ficticios.
 */
import { hash } from '@node-rs/argon2';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { D, m2 } from '../common/money';
import { createDb } from './db';
import * as s from './schema';

type DB = ReturnType<typeof createDb>;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const DAY = 86_400_000;
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from({ length: 6 }, () => CODE[Math.floor(rnd() * CODE.length)]).join('');
/** Fecha a una hora de Bogotá, a `days` días de hoy (negativo = pasado). */
const at = (days: number, h: number, m = 0) => {
  const d = new Date(Date.now() + days * DAY);
  const ymd = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-05:00`);
};
const BOOKING_OPTIONS = [{ name: 'Fecha', type: 'date' as const, required: true }, { name: 'Hora', type: 'time' as const, required: true }];

type Svc = { name: string; price: number; cost?: number; unit?: string; service?: boolean; stock?: number; min?: number; desc?: string; schedule?: { weekdays: number[]; startTime: string; endTime: string; intervalMinutes: number; durationMinutes: number } };

async function base(db: DB, userId: string, data: typeof s.businesses.$inferInsert) {
  const [biz] = await db.insert(s.businesses).values(data).returning();
  const owner = await db.query.roles.findFirst({ where: and(isNull(s.roles.businessId), eq(s.roles.key, 'OWNER')) });
  await db.insert(s.memberships).values({ userId, businessId: biz.id, roleId: owner!.id });
  await db.insert(s.subscriptions).values({ businessId: biz.id, planCode: 'PRO' });
  const [wh] = await db.insert(s.warehouses).values({ businessId: biz.id, name: 'Principal', isDefault: true }).returning();
  return { biz, wh };
}

async function catalog(db: DB, bizId: string, whId: string, prefix: string, items: Svc[]) {
  const out: (typeof s.products.$inferSelect)[] = [];
  for (const [i, it] of items.entries()) {
    const service = it.service !== false;
    const [p] = await db.insert(s.products).values({ businessId: bizId, sku: `${prefix}-${String(i + 1).padStart(3, '0')}`, name: it.name, description: it.desc,
      costPrice: String(it.cost ?? 0), salePrice: String(it.price), isService: service, pricingUnit: it.unit ?? 'FIXED', minStock: it.min ?? 0,
      storeOptions: it.schedule ? BOOKING_OPTIONS : [], appointmentSchedule: it.schedule ?? null }).returning();
    if (!service) {
      await db.insert(s.inventoryLevels).values({ productId: p.id, warehouseId: whId, quantity: it.stock ?? 0 });
      await db.insert(s.inventoryMovements).values({ businessId: bizId, productId: p.id, warehouseId: whId, type: 'INITIAL', quantity: it.stock ?? 0, unitCost: String(it.cost ?? 0), note: 'Inventario inicial', createdAt: new Date(Date.now() - 95 * DAY) });
    }
    out.push(p);
  }
  return out;
}

async function customersFor(db: DB, bizId: string, list: [string, string, string][]) {
  const out = [];
  for (const [i, [name, city, channel]] of list.entries()) {
    const [c] = await db.insert(s.customers).values({ businessId: bizId, name, city, channel: channel as any, phone: `+57 31${i % 9} ${String(2000000 + i * 4217).slice(0, 7)}`,
      email: `${name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${i}@correo.co`, createdAt: new Date(Date.now() - (100 - i * 3) * DAY) }).returning();
    out.push(c);
  }
  return out;
}

/** Venta (cobro) con líneas; los repuestos descuentan inventario. */
async function sale(db: DB, bizId: string, whId: string, userId: string, number: number, date: Date, customerId: string | null, lines: { p: typeof s.products.$inferSelect; q: number; price?: number }[], method: typeof s.paymentMethod.enumValues[number], paidRatio = 1, notes?: string) {
  const subtotal = lines.reduce((a, l) => a.plus(D(l.price ?? l.p.salePrice).mul(l.q)), D(0));
  const cost = lines.reduce((a, l) => a.plus(D(l.p.costPrice).mul(l.q)), D(0));
  const paid = subtotal.mul(paidRatio).toDecimalPlaces(0);
  const [sl] = await db.insert(s.sales).values({ businessId: bizId, number, customerId, date, channel: pick(['PHYSICAL_STORE', 'WHATSAPP', 'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'FACEBOOK'] as const),
    paymentMethod: method, status: paid.gte(subtotal) ? 'PAID' : paid.gt(0) ? 'PARTIALLY_PAID' : 'PENDING', subtotal: m2(subtotal), discountTotal: '0', taxTotal: '0',
    total: m2(subtotal), amountPaid: m2(paid), costTotal: m2(cost), createdById: userId, notes }).returning();
  for (const l of lines) {
    const price = D(l.price ?? l.p.salePrice);
    await db.insert(s.saleItems).values({ saleId: sl.id, productId: l.p.id, description: l.p.name, quantity: l.q, unitPrice: m2(price), unitCost: l.p.costPrice, discount: '0', lineTax: '0', lineTotal: m2(price.mul(l.q)) });
    if (!l.p.isService) {
      await db.insert(s.inventoryMovements).values({ businessId: bizId, productId: l.p.id, warehouseId: whId, type: 'SALE', quantity: -l.q, unitCost: l.p.costPrice, referenceType: 'SALE', referenceId: sl.id, note: `Venta #${number}`, createdAt: date });
      await db.update(s.inventoryLevels).set({ quantity: sql`${s.inventoryLevels.quantity} - ${l.q}` }).where(eq(s.inventoryLevels.productId, l.p.id));
    }
  }
  if (paid.gt(0)) await db.insert(s.salePayments).values({ saleId: sl.id, amount: m2(paid), method, paidAt: date });
  if (customerId) await db.update(s.customers).set({ totalSpent: sql`${s.customers.totalSpent} + ${m2(subtotal)}`, purchaseCount: sql`${s.customers.purchaseCount} + 1`,
    firstPurchaseAt: sql`coalesce(${s.customers.firstPurchaseAt}, ${date.toISOString()}::timestamptz)`, lastPurchaseAt: date }).where(eq(s.customers.id, customerId));
  return sl;
}

type JobSeed = { customer: number; title: string; category: string; status: string; priority?: string; daysAgo: number; dueIn?: number; details: Record<string, string>; description?: string;
  items: { p?: number; desc?: string; kind?: string; q?: number; price?: number }[]; quote?: string; warranty?: number; events: { daysAgo: number; body: string; visible?: boolean; minutes?: number; type?: string }[]; charge?: number };

async function jobsFor(db: DB, bizId: string, whId: string, userId: string, prods: (typeof s.products.$inferSelect)[], custs: (typeof s.customers.$inferSelect)[], list: JobSeed[], saleNo: { n: number }, labels: Record<string, string>) {
  const out = [];
  for (const [i, j] of list.entries()) {
    const created = new Date(Date.now() - j.daysAgo * DAY);
    const closed = ['DELIVERED', 'CANCELLED'].includes(j.status);
    const [job] = await db.insert(s.jobs).values({ businessId: bizId, number: i + 1, trackingCode: code(), customerId: custs[j.customer].id, title: j.title, category: j.category,
      status: j.status, priority: j.priority ?? 'NORMAL', assignedUserId: userId, description: j.description, details: j.details,
      dueAt: j.dueIn !== undefined ? at(j.dueIn, 17) : null, quoteStatus: j.quote ?? 'NONE', quoteSentAt: j.quote ? new Date(created.getTime() + DAY / 4) : null,
      quoteDecidedAt: j.quote === 'APPROVED' || j.quote === 'REJECTED' ? new Date(created.getTime() + DAY / 2) : null, warrantyDays: j.warranty ?? 0,
      createdById: userId, createdAt: created, updatedAt: new Date(Date.now() - Math.max(0, j.daysAgo - 1) * DAY), closedAt: closed ? new Date(Date.now() - Math.max(0, j.daysAgo - 3) * DAY) : null }).returning();
    for (const it of j.items) {
      const p = it.p !== undefined ? prods[it.p] : null;
      await db.insert(s.jobItems).values({ jobId: job.id, productId: p?.id ?? null, kind: it.kind ?? (p && !p.isService ? 'PART' : 'SERVICE'), description: it.desc ?? p!.name,
        quantity: String(it.q ?? 1), unitPrice: String(it.price ?? p!.salePrice) });
    }
    await db.insert(s.jobEvents).values({ jobId: job.id, businessId: bizId, type: 'STATUS', body: 'Registro creado', visibleToCustomer: true, userId, occurredAt: created });
    for (const e of j.events) await db.insert(s.jobEvents).values({ jobId: job.id, businessId: bizId, type: e.type ?? (e.minutes ? 'TIME' : 'NOTE'), body: e.body, minutes: e.minutes ?? null,
      billable: Boolean(e.minutes), visibleToCustomer: e.visible ?? false, userId, occurredAt: new Date(Date.now() - e.daysAgo * DAY) });
    if (j.status !== 'OPEN') await db.insert(s.jobEvents).values({ jobId: job.id, businessId: bizId, type: 'STATUS', body: `Estado: ${labels[j.status]}`, visibleToCustomer: true, userId, occurredAt: new Date(Date.now() - Math.max(0, j.daysAgo - 2) * DAY) });
    if (j.charge !== undefined) {
      const lines = j.items.filter((it) => it.p !== undefined).map((it) => ({ p: prods[it.p!], q: it.q ?? 1, price: it.price }));
      if (lines.length) {
        const sl = await sale(db, bizId, whId, userId, saleNo.n++, new Date(Date.now() - Math.max(0, j.daysAgo - 3) * DAY), custs[j.customer].id, lines, pick(['NEQUI', 'CASH', 'BANK_TRANSFER'] as const), j.charge, `${j.title} · registro #${i + 1}`);
        await db.update(s.jobs).set({ saleId: sl.id }).where(eq(s.jobs.id, job.id));
        await db.insert(s.jobEvents).values({ jobId: job.id, businessId: bizId, type: 'PAYMENT', body: `Cobro registrado (venta #${sl.number})`, visibleToCustomer: true, userId, occurredAt: sl.date });
      }
    }
    out.push(job);
  }
  return out;
}

async function expensesFor(db: DB, bizId: string, rows: [typeof s.expenseCategory.enumValues[number], string, number, number][]) {
  for (let m = 3; m >= 0; m--) {
    const b = new Date(); b.setMonth(b.getMonth() - m, 1); b.setHours(12, 0, 0, 0);
    const vals = rows.map(([category, description, amount, day]) => { const d = new Date(b); d.setDate(day); return { businessId: bizId, category, description, amount: String(Math.round(amount * (0.9 + rnd() * 0.2))), date: d, paymentMethod: 'BANK_TRANSFER' as const }; })
      .filter((r) => r.date.getTime() <= Date.now());
    if (vals.length) await db.insert(s.expenses).values(vals);
  }
}

const STORE_BASE = { deliveryEnabled: false, pickupEnabled: true, shippingFee: '0', freeShippingMinimum: '', allowOrderNotes: true, showSearch: true, showFloatingWhatsapp: true,
  showSocialLinks: true, showProductDescription: true, textAlign: 'left', imageRatio: 'wide', headerStyle: 'classic', sortDefault: 'name', returnsEnabled: false, returnWindowDays: 30 };

export async function seedServicesDemo(db: DB) {
  const email = 'servicios@dream.co';
  if (await db.query.users.findFirst({ where: eq(s.users.email, email) })) { console.log('ℹ El demo de servicios ya existe; no se repite la siembra.'); return; }
  const [user] = await db.insert(s.users).values({ email, fullName: 'Andrés Mejía', phone: '+57 301 000 0000', acceptedPolicyAt: new Date(),
    passwordHash: await hash('Dream2026', { memoryCost: 19456, timeCost: 2, parallelism: 1 }) }).returning();

  // ───────── 1. Técnico en reparación de celulares ─────────
  {
    const { biz, wh } = await base(db, user.id, { ownerId: user.id, tradeName: 'TecnoCell Reparaciones', legalName: 'TecnoCell S.A.S.', taxId: '901.555.210-4', phone: '+57 301 000 0000',
      email: 'hola@tecnocell.co', address: 'C.C. Unicentro, local 214', city: 'Cali', businessType: 'Servicio técnico', category: 'Reparación de celulares',
      businessModel: 'SERVICES', serviceProfile: 'TECH_REPAIR', monthlyGoal: '9000000', brandColors: { primary: '#0F172A', accent: '#2563EB', paletteId: 'custom' },
      socialLinks: { instagram: '@tecnocell.cali', whatsapp: '+57 301 000 0000' } });
    const p = await catalog(db, biz.id, wh.id, 'TEC', [
      { name: 'Diagnóstico de equipo', price: 30000, desc: 'Revisión completa del equipo para identificar la falla. Si apruebas la reparación, el diagnóstico se descuenta del valor final. Tarda entre 1 y 24 horas.', schedule: { weekdays: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '18:00', intervalMinutes: 30, durationMinutes: 30 } },
      { name: 'Cambio de pantalla (mano de obra)', price: 60000, desc: 'Instalación de pantalla nueva con pruebas de táctil, brillo y sensor de proximidad. Garantía de 90 días en la mano de obra.' },
      { name: 'Cambio de batería (mano de obra)', price: 40000, desc: 'Reemplazo de batería con calibración. Duración aproximada: 1 hora.' },
      { name: 'Reparación de pin de carga', price: 70000, desc: 'Cambio o limpieza del puerto de carga. Incluye prueba de carga rápida.' },
      { name: 'Limpieza por humedad', price: 90000, desc: 'Desarme, limpieza ultrasónica y secado. Si el equipo cayó al agua, apágalo y no lo cargues: tráelo lo antes posible.' },
      { name: 'Software, respaldo y actualización', price: 50000, desc: 'Actualización del sistema, respaldo de fotos y contactos, y optimización.' },
      { name: 'Pantalla iPhone 11', price: 280000, cost: 165000, service: false, stock: 28, min: 3 },
      { name: 'Batería Samsung A52', price: 120000, cost: 62000, service: false, stock: 30, min: 3 },
      { name: 'Pin de carga USB-C', price: 25000, cost: 8000, service: false, stock: 45, min: 5 },
      { name: 'Pantalla Xiaomi Redmi Note 12', price: 210000, cost: 118000, service: false, stock: 14, min: 2 },
      { name: 'Vidrio templado', price: 20000, cost: 4000, service: false, stock: 90, min: 10 },
    ]);
    const c = await customersFor(db, biz.id, [['Julián Ospina', 'Cali', 'WHATSAPP'], ['Marcela Quintero', 'Cali', 'INSTAGRAM'], ['Diego Valencia', 'Jamundí', 'PHYSICAL_STORE'], ['Luisa Fernanda Gil', 'Cali', 'WHATSAPP'],
      ['Óscar Bedoya', 'Palmira', 'FACEBOOK'], ['Catalina Arango', 'Cali', 'WEBSITE'], ['Hernán Zapata', 'Cali', 'PHYSICAL_STORE'], ['Paola Rengifo', 'Yumbo', 'WHATSAPP'],
      ['Ricardo Muñoz', 'Cali', 'INSTAGRAM'], ['Daniela Cuéllar', 'Cali', 'WHATSAPP'], ['Esteban Lozano', 'Candelaria', 'PHYSICAL_STORE'], ['Ana María Patiño', 'Cali', 'WEBSITE']]);
    const saleNo = { n: 1 };
    // Historial de cobros (90 días)
    for (let d = 90; d >= 1; d--) {
      const n = Math.round((new Date(Date.now() - d * DAY).getDay() === 6 ? 3 : 1.6) * (0.4 + rnd()));
      for (let k = 0; k < n; k++) {
        const combo = pick([[[1, 1], [6, 1]], [[2, 1], [7, 1]], [[3, 1], [8, 1]], [[0, 1]], [[4, 1]], [[5, 1]], [[1, 1], [9, 1]], [[10, 2]]] as [number, number][][]);
        let ok = true;
        for (const [i, q] of combo) if (!p[i].isService) {
          const [lvl] = await db.select({ q: s.inventoryLevels.quantity }).from(s.inventoryLevels).where(eq(s.inventoryLevels.productId, p[i].id));
          if (!lvl || lvl.q - q < (i === 9 ? 1 : 4)) ok = false;
        }
        if (!ok) continue;
        await sale(db, biz.id, wh.id, user.id, saleNo.n++, at(-d, 9 + Math.floor(rnd() * 9), Math.floor(rnd() * 60)), rnd() < 0.85 ? pick(c).id : null,
          combo.map(([i, q]) => ({ p: p[i], q })), pick(['NEQUI', 'CASH', 'CASH', 'DAVIPLATA', 'BANK_TRANSFER', 'DEBIT_CARD'] as const), rnd() < 0.05 ? 0.5 : 1);
      }
    }
    const L = { QUOTE: 'Diagnóstico y cotización', OPEN: 'Recibido', IN_PROGRESS: 'En reparación', WAITING: 'Esperando repuesto o aprobación', READY: 'Listo para entregar', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
    const dev = (device: string, brand: string, model: string, serial: string, issue: string, accessories = 'Sin accesorios', condition = 'Rayones leves en la carcasa') => ({ device, brand, model, serial, issue, accessories, condition });
    const jobs = await jobsFor(db, biz.id, wh.id, user.id, p, c, [
      { customer: 0, title: 'iPhone 11 · pantalla rota', category: 'Pantalla', status: 'IN_PROGRESS', priority: 'HIGH', daysAgo: 1, dueIn: 0, details: dev('Celular', 'Apple', 'iPhone 11', 'IMEI 35 391811 482910 7', 'Pantalla estrellada, táctil funciona a medias', 'Estuche transparente'),
        items: [{ p: 1 }, { p: 6 }, { p: 10 }], quote: 'APPROVED', warranty: 90, events: [{ daysAgo: 1, body: 'Diagnóstico: pantalla y digitalizador dañados. Resto del equipo OK.', visible: true }, { daysAgo: 0.5, body: 'Cliente aprobó por WhatsApp. Se inicia cambio.', visible: false }] },
      { customer: 1, title: 'Samsung A52 · se descarga rápido', category: 'Batería', status: 'READY', daysAgo: 2, dueIn: 0, details: dev('Celular', 'Samsung', 'Galaxy A52', 'IMEI 35 220715 993301 2', 'Batería dura 3 horas y se calienta', 'Cargador original'),
        items: [{ p: 2 }, { p: 7 }], quote: 'APPROVED', warranty: 90, events: [{ daysAgo: 1, body: 'Batería cambiada y calibrada. Prueba de 4 horas OK.', visible: true }] },
      { customer: 2, title: 'Redmi Note 12 · no carga', category: 'Pin de carga', status: 'WAITING', daysAgo: 3, dueIn: 2, details: dev('Celular', 'Xiaomi', 'Redmi Note 12', 'IMEI 86 412305 551209 9', 'No carga, solo con el cable en cierta posición'),
        items: [{ p: 3 }, { p: 8 }], quote: 'SENT', events: [{ daysAgo: 2, body: 'Se envió cotización por WhatsApp. Esperando respuesta del cliente.', visible: true }] },
      { customer: 3, title: 'iPhone 12 · cayó al agua', category: 'Humedad', status: 'QUOTE', priority: 'URGENT', daysAgo: 0, dueIn: 1, details: dev('Celular', 'Apple', 'iPhone 12', 'IMEI 35 672910 118845 0', 'Cayó a la piscina, no enciende', 'Ninguno', 'Sin daños visibles'),
        items: [{ p: 0 }, { p: 4 }], events: [{ daysAgo: 0, body: 'Se recibió apagado. Cliente informa que no lo cargó.', visible: false }] },
      { customer: 4, title: 'Huawei P30 · respaldo y actualización', category: 'Software', status: 'OPEN', daysAgo: 0, dueIn: 1, details: dev('Celular', 'Huawei', 'P30 Lite', 'IMEI 86 771204 304911 3', 'Muy lento, quiere respaldar fotos'), items: [{ p: 5 }], events: [] },
      { customer: 5, title: 'Tablet Lenovo · pantalla', category: 'Pantalla', status: 'WAITING', daysAgo: 5, dueIn: 4, details: dev('Tablet', 'Lenovo', 'Tab M10', 'S/N HA1K2Y7Q', 'Pantalla con líneas verdes', 'Funda'),
        items: [{ p: 1 }, { desc: 'Pantalla Lenovo Tab M10 (pedida al proveedor)', kind: 'PART', price: 240000 }], quote: 'APPROVED', events: [{ daysAgo: 4, body: 'Repuesto pedido a Bogotá. Llega en 3 días hábiles.', visible: true }] },
      { customer: 6, title: 'iPhone XR · cambio de batería', category: 'Batería', status: 'DELIVERED', daysAgo: 9, details: dev('Celular', 'Apple', 'iPhone XR', 'IMEI 35 728811 006732 1', 'Salud de batería 71%'),
        items: [{ p: 2 }, { desc: 'Batería iPhone XR', kind: 'PART', price: 130000 }], quote: 'APPROVED', warranty: 90, charge: 1, events: [{ daysAgo: 8, body: 'Entregado. Salud de batería 100%.', visible: true }] },
      { customer: 7, title: 'Moto G52 · pin de carga', category: 'Pin de carga', status: 'DELIVERED', daysAgo: 14, details: dev('Celular', 'Motorola', 'Moto G52', 'IMEI 35 902211 774520 6', 'Carga intermitente'),
        items: [{ p: 3 }, { p: 8 }], quote: 'APPROVED', warranty: 60, charge: 1, events: [] },
      { customer: 8, title: 'Samsung S21 · pantalla verde', category: 'Pantalla', status: 'CANCELLED', daysAgo: 12, details: dev('Celular', 'Samsung', 'Galaxy S21', 'IMEI 35 118020 662391 8', 'Línea verde en pantalla'),
        items: [{ p: 0 }], quote: 'REJECTED', events: [{ daysAgo: 11, body: 'Cliente no aprobó: el repuesto original cuesta más de lo que esperaba.', visible: true }] },
      { customer: 9, title: 'iPhone 11 · cámara trasera borrosa', category: 'Cámara', status: 'READY', daysAgo: 3, dueIn: -1, details: dev('Celular', 'Apple', 'iPhone 11', 'IMEI 35 391822 100293 4', 'Cámara no enfoca'),
        items: [{ desc: 'Cambio de cámara trasera (repuesto + mano de obra)', kind: 'SERVICE', price: 180000 }], quote: 'APPROVED', warranty: 60, events: [{ daysAgo: 1, body: 'Listo. Fotos de prueba enviadas al cliente.', visible: true }] },
    ], saleNo, L);
    await db.update(s.businesses).set({ nextSaleNumber: saleNo.n }).where(eq(s.businesses.id, biz.id));
    // Agenda de la semana
    const appts: [number, number, number, string, number | null, number | null, string][] = [
      [0, 9, 30, 'Diagnóstico de equipo', 0, 10, 'SCHEDULED'], [0, 11, 0, 'Entrega: Samsung A52', null, 1, 'CONFIRMED'], [0, 15, 0, 'Entrega: iPhone 11 cámara', null, 9, 'SCHEDULED'],
      [1, 10, 0, 'Diagnóstico de equipo', 0, 11, 'SCHEDULED'], [1, 16, 30, 'Respaldo y actualización', 5, 4, 'CONFIRMED'], [2, 9, 0, 'Diagnóstico de equipo', 0, 3, 'SCHEDULED'],
      [3, 14, 0, 'Instalación de pantalla tablet', 1, 5, 'SCHEDULED'], [-1, 10, 0, 'Diagnóstico de equipo', 0, 0, 'DONE'], [-2, 17, 0, 'Diagnóstico de equipo', 0, 8, 'NO_SHOW'],
    ];
    for (const [d, h, m, title, prod, cust, status] of appts) {
      const job = jobs.find((j) => j.customerId === (cust !== null ? c[cust].id : '')) ?? null;
      await db.insert(s.appointments).values({ businessId: biz.id, title, startsAt: at(d, h, m), endsAt: new Date(at(d, h, m).getTime() + 30 * 60_000), status, assignedUserId: user.id,
        customerId: cust !== null ? c[cust].id : null, productId: prod !== null ? p[prod].id : null, jobId: title.startsWith('Entrega') || title.startsWith('Instalación') || title.startsWith('Respaldo') ? job?.id ?? null : null,
        modality: 'IN_PERSON', location: 'C.C. Unicentro, local 214', source: d === 1 && h === 10 ? 'WEB' : 'PANEL' });
    }
    await expensesFor(db, biz.id, [['RENT', 'Arriendo local C.C.', 2200000, 2], ['UTILITIES', 'Energía e internet', 260000, 10], ['PAYROLL', 'Técnico auxiliar', 1600000, 28], ['ADVERTISING', 'Pauta Instagram', 300000, 6], ['MERCHANDISE', 'Repuestos varios', 900000, 12]]);
    await db.insert(s.knowledgeEntries).values([
      { businessId: biz.id, category: 'WARRANTY', title: 'Garantía de reparaciones', content: 'Mano de obra: 90 días para pantallas y baterías, 60 días para pin de carga y cámaras. La garantía no cubre golpes, humedad ni equipos abiertos por terceros después de la reparación. Para hacerla válida trae el equipo con el número de orden.' },
      { businessId: biz.id, category: 'SERVICE_USE', title: 'Qué hacer si el celular se mojó', content: '1. Apágalo de inmediato y no intentes cargarlo.\n2. No lo metas en arroz: no saca la humedad interna y deja residuos.\n3. Sécalo por fuera con un paño y tráelo lo antes posible.\n4. Hacemos limpieza ultrasónica y secado; el diagnóstico tarda 24 horas.' },
      { businessId: biz.id, category: 'PRODUCT_CARE', title: 'Cuidados después de cambiar la batería', content: 'Las primeras 3 cargas déjalo cargar hasta 100% sin usarlo. Evita cargadores genéricos. Si notas que se calienta, tráelo para revisión dentro de la garantía.' },
      { businessId: biz.id, category: 'FAQ', title: '¿Cuánto tarda una reparación?', content: 'Pantallas y baterías con repuesto en stock: el mismo día (2 a 4 horas). Si hay que pedir el repuesto: 3 a 5 días hábiles. Te avisamos por WhatsApp y puedes ver el estado con tu código de seguimiento en nuestra página.' },
    ]);
    await db.update(s.businesses).set({ storeSlug: 'tecnocell', storeEnabled: true, storeConfig: { ...STORE_BASE, template: 'tecnologia', headline: 'Tu celular como nuevo, hoy mismo',
      description: 'Reparación de celulares y tablets en Cali con garantía. Diagnóstico en minutos y seguimiento de tu equipo en línea.', heroLayout: 'banner', layout: 'list', fontStyle: 'modern',
      cardStyle: 'outline', buttonStyle: 'round', primaryColor: '#0F172A', backgroundColor: '#F8FAFC', accentColor: '#2563EB', productButtonText: 'Agendar', catalogTitle: 'Servicios y repuestos',
      whatsapp: '573010000000', pickupAddress: 'C.C. Unicentro, local 214, Cali', contactHours: 'Lunes a sábado 9:00 a.m. – 7:00 p.m.', announcement: 'Consulta el estado de tu reparación con tu código',
      returnsPolicy: 'Garantía de 60 a 90 días según el servicio. No cubre golpes ni humedad.',
      sections: [{ id: 'hero-1', type: 'hero', enabled: true }, { id: 'benefits-1', type: 'benefits', enabled: true, title: '¿Por qué TecnoCell?', items: [{ icon: 'clock', title: 'El mismo día', text: 'Pantallas y baterías en 2 a 4 horas.' }, { icon: 'shield', title: 'Garantía escrita', text: 'Hasta 90 días en mano de obra.' }, { icon: 'check', title: 'Seguimiento en línea', text: 'Consulta el estado con tu código.' }] },
        { id: 'catalog-1', type: 'catalog', enabled: true }, { id: 'faq-1', type: 'faq', enabled: true, title: 'Preguntas frecuentes', items: [{ title: '¿Cuánto tarda una reparación?', text: 'Con repuesto en stock, el mismo día. Si hay que pedirlo, 3 a 5 días hábiles.' }, { title: '¿Cobran el diagnóstico?', text: 'Sí, $30.000, y se descuenta si apruebas la reparación.' }] },
        { id: 'contact-1', type: 'contact', enabled: true, title: 'Visítanos' }, { id: 'policies-1', type: 'policies', enabled: true, title: 'Garantías y datos' }],
      paymentMethods: [{ name: 'Nequi', kind: 'NEQUI', accountNumber: '3010000000', accountHolder: 'TecnoCell S.A.S.', instructions: '', enabled: true }, { name: 'Pago al recoger en el local', kind: 'CASH_PICKUP', instructions: 'Efectivo o tarjeta en el local.', enabled: true }] } })
      .where(eq(s.businesses.id, biz.id));
  }

  // ───────── 2. Firma de abogados ─────────
  {
    const { biz, wh } = await base(db, user.id, { ownerId: user.id, tradeName: 'Ríos & Asociados Abogados', legalName: 'Ríos & Asociados Abogados S.A.S.', taxId: '901.777.430-2', phone: '+57 302 000 0000',
      email: 'contacto@riosasociados.co', address: 'Cra. 4 # 12-41, oficina 802', city: 'Cali', businessType: 'Firma de abogados', category: 'Servicios jurídicos',
      businessModel: 'SERVICES', serviceProfile: 'LEGAL', monthlyGoal: '25000000', brandColors: { primary: '#1F2A44', accent: '#B08D57', paletteId: 'custom' },
      socialLinks: { linkedin: 'rios-asociados', whatsapp: '+57 302 000 0000' } });
    const p = await catalog(db, biz.id, wh.id, 'JUR', [
      { name: 'Consulta jurídica', price: 150000, unit: 'HOUR', desc: 'Asesoría de una hora, presencial o virtual, para revisar tu caso y explicarte opciones, riesgos y costos. Trae documentos relacionados.', schedule: { weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '17:00', intervalMinutes: 60, durationMinutes: 60 } },
      { name: 'Hora de trabajo profesional', price: 180000, unit: 'HOUR', desc: 'Horas de estudio, redacción y gestión del caso.' },
      { name: 'Acción de tutela', price: 600000, desc: 'Redacción y radicación de la tutela, seguimiento al fallo e impugnación si es necesaria.' },
      { name: 'Derecho de petición', price: 250000, desc: 'Redacción y radicación del derecho de petición, y seguimiento al plazo de respuesta.' },
      { name: 'Contrato de arrendamiento', price: 350000, desc: 'Elaboración o revisión del contrato de arrendamiento de vivienda o local.' },
      { name: 'Proceso de divorcio de mutuo acuerdo', price: 2800000, desc: 'Trámite notarial o judicial de divorcio de mutuo acuerdo, incluye acuerdo sobre bienes y alimentos.' },
      { name: 'Proceso ejecutivo (honorarios)', price: 3500000, desc: 'Cobro judicial de títulos valores. Honorarios iniciales; se pacta además porcentaje de éxito.' },
      { name: 'Defensa en proceso penal (etapa)', price: 6000000, desc: 'Representación por etapa procesal: indagación, investigación o juicio.' },
    ]);
    const c = await customersFor(db, biz.id, [['María Eugenia Salcedo', 'Cali', 'WHATSAPP'], ['Constructora Valle Alto S.A.S.', 'Cali', 'WEBSITE'], ['Jorge Iván Cardona', 'Palmira', 'PHYSICAL_STORE'],
      ['Liliana Restrepo', 'Cali', 'WHATSAPP'], ['Comercializadora El Sol Ltda.', 'Yumbo', 'OTHER'], ['Fabio Ernesto Mina', 'Jamundí', 'FACEBOOK'], ['Gloria Patricia Vélez', 'Cali', 'WHATSAPP'],
      ['Sandra Milena Ortiz', 'Buga', 'WEBSITE'], ['Héctor Fabio Lasso', 'Cali', 'PHYSICAL_STORE'], ['Carolina Mosquera', 'Cali', 'INSTAGRAM']]);
    const saleNo = { n: 1 };
    for (let d = 90; d >= 1; d--) {
      if (rnd() < 0.45) continue;
      const opt = pick([[[0, 1]], [[0, 1]], [[3, 1]], [[2, 1]], [[4, 1]], [[1, 3]], [[1, 5]]] as [number, number][][]);
      await sale(db, biz.id, wh.id, user.id, saleNo.n++, at(-d, 8 + Math.floor(rnd() * 9)), pick(c).id, opt.map(([i, q]) => ({ p: p[i], q })), pick(['BANK_TRANSFER', 'BANK_TRANSFER', 'NEQUI', 'PSE'] as const), rnd() < 0.1 ? 0.5 : 1);
    }
    const L = { QUOTE: 'Consulta / propuesta', OPEN: 'Abierto', IN_PROGRESS: 'En trámite', WAITING: 'En espera del despacho o del cliente', READY: 'Decisión / resultado', DELIVERED: 'Cerrado', CANCELLED: 'Archivado' };
    const caso = (area: string, process: string, filing: string, court: string, counterpart: string, role: string, stage: string) => ({ area, process, filing, court, counterpart, role, stage });
    await jobsFor(db, biz.id, wh.id, user.id, p, c, [
      { customer: 0, title: 'Tutela por salud contra EPS', category: 'Tutela', status: 'IN_PROGRESS', priority: 'URGENT', daysAgo: 4, dueIn: 3, description: 'La EPS niega la entrega de un medicamento formulado por el médico tratante. Se solicita medida provisional.',
        details: caso('Constitucional', 'Acción de tutela', '76001-40-03-012-2026-00418-00', 'Juzgado 12 Civil Municipal de Cali', 'EPS Salud Total', 'Accionante', 'Admisión'),
        items: [{ p: 2 }], quote: 'APPROVED', events: [{ daysAgo: 3, body: 'Se radicó la tutela con solicitud de medida provisional.', visible: true, minutes: 150 }, { daysAgo: 1, body: 'El juzgado admitió la tutela y concedió la medida provisional. Fallo dentro de 10 días hábiles.', visible: true, minutes: 30 }] },
      { customer: 1, title: 'Ejecutivo singular por facturas impagas', category: 'Proceso ejecutivo', status: 'WAITING', daysAgo: 40, dueIn: 6, description: 'Cobro de 3 facturas electrónicas aceptadas por $48.500.000 más intereses moratorios.',
        details: caso('Civil', 'Proceso ejecutivo singular', '76001-31-03-005-2026-00123-00', 'Juzgado 5 Civil del Circuito de Cali', 'Ferretería La Esperanza S.A.S.', 'Demandante', 'Notificación del mandamiento de pago'),
        items: [{ p: 6 }, { p: 1, q: 6 }], quote: 'APPROVED', charge: 0.5, events: [{ daysAgo: 38, body: 'Radicada la demanda con medidas cautelares (embargo de cuentas).', visible: true, minutes: 240 }, { daysAgo: 20, body: 'Mandamiento de pago librado. Se decretó el embargo.', visible: true, minutes: 45 }, { daysAgo: 6, body: 'Se envió notificación personal al demandado. Pendiente vencimiento del término para contestar.', visible: true, minutes: 60 }] },
      { customer: 2, title: 'Defensa: lesiones personales culposas', category: 'Penal', status: 'IN_PROGRESS', priority: 'HIGH', daysAgo: 25, dueIn: 9, description: 'Accidente de tránsito. El cliente es indiciado. Se explora conciliación con la víctima.',
        details: caso('Penal', 'Lesiones personales culposas', '761116000165202600311', 'Fiscalía 43 Local de Palmira', 'Víctima: Ramiro Caicedo', 'Indiciado', 'Indagación'),
        items: [{ p: 7 }], quote: 'APPROVED', charge: 0.5, events: [{ daysAgo: 20, body: 'Entrevista con el cliente y revisión del informe de tránsito.', minutes: 120 }, { daysAgo: 9, body: 'Audiencia de conciliación preprocesal programada.', visible: true, minutes: 40 }] },
      { customer: 3, title: 'Divorcio de mutuo acuerdo', category: 'Familia', status: 'IN_PROGRESS', daysAgo: 18, dueIn: 12, details: caso('Familia', 'Divorcio de mutuo acuerdo (notarial)', 'N/A', 'Notaría 4 de Cali', 'N/A (mutuo acuerdo)', 'Solicitante', 'Elaboración del acuerdo'),
        items: [{ p: 5 }], quote: 'APPROVED', charge: 0.5, events: [{ daysAgo: 15, body: 'Reunión con ambos cónyuges para definir el acuerdo de bienes.', visible: true, minutes: 90 }] },
      { customer: 4, title: 'Contrato de arrendamiento bodega', category: 'Contratos', status: 'READY', daysAgo: 6, dueIn: 1, details: caso('Comercial', 'Elaboración de contrato', 'N/A', 'N/A', 'Inmobiliaria Pacífico', 'Arrendatario', 'Revisión final del cliente'),
        items: [{ p: 4 }], quote: 'APPROVED', events: [{ daysAgo: 2, body: 'Se envió el borrador final para firma.', visible: true, minutes: 75 }] },
      { customer: 5, title: 'Derecho de petición a Colpensiones', category: 'Derecho de petición', status: 'WAITING', daysAgo: 10, dueIn: 5, details: caso('Seguridad social', 'Derecho de petición', 'Radicado 2026_1234567', 'Colpensiones', 'Colpensiones', 'Peticionario', 'Esperando respuesta (15 días hábiles)'),
        items: [{ p: 3 }], quote: 'APPROVED', charge: 1, events: [{ daysAgo: 9, body: 'Petición radicada por la sede electrónica.', visible: true, minutes: 60 }] },
      { customer: 6, title: 'Consulta: herencia sin testamento', category: 'Sucesiones', status: 'QUOTE', daysAgo: 1, dueIn: 4, details: caso('Familia', 'Sucesión intestada', 'N/A', 'Por definir (notaría o juzgado)', 'N/A', 'Heredera', 'Propuesta de honorarios'),
        items: [{ desc: 'Sucesión notarial (honorarios)', kind: 'FEE', price: 4500000 }, { desc: 'Gastos notariales estimados', kind: 'EXPENSE', price: 1200000 }], quote: 'SENT', events: [{ daysAgo: 1, body: 'Se envió propuesta de honorarios.', visible: true }] },
      { customer: 7, title: 'Tutela por debido proceso laboral', category: 'Tutela', status: 'DELIVERED', daysAgo: 35, details: caso('Constitucional', 'Acción de tutela', '76111-40-03-002-2026-00099-00', 'Juzgado 2 Civil Municipal de Buga', 'Empresa de Servicios del Valle', 'Accionante', 'Fallo favorable'),
        items: [{ p: 2 }], quote: 'APPROVED', charge: 1, events: [{ daysAgo: 30, body: 'Fallo de primera instancia: se ampara el derecho.', visible: true, minutes: 30 }] },
    ], saleNo, L);
    await db.update(s.businesses).set({ nextSaleNumber: saleNo.n }).where(eq(s.businesses.id, biz.id));
    const firm = await db.select().from(s.jobs).where(eq(s.jobs.businessId, biz.id));
    const byNum = (n: number) => firm.find((j) => j.number === n)!;
    const appts: [number, number, number, number, string, string, string, number | null][] = [
      [0, 8, 0, 60, 'Consulta jurídica: despido sin justa causa', 'VIRTUAL', 'Enlace de videollamada enviado por WhatsApp', null],
      [0, 10, 0, 60, 'Reunión: acuerdo de divorcio', 'IN_PERSON', 'Oficina 802', 4], [0, 14, 30, 30, 'Llamada: estado del ejecutivo', 'VIRTUAL', 'Telefónica', 2],
      [1, 9, 0, 60, 'Audiencia de conciliación preprocesal', 'IN_PERSON', 'Fiscalía 43 Local de Palmira', 3], [2, 11, 0, 60, 'Consulta jurídica: herencia', 'IN_PERSON', 'Oficina 802', 7],
      [3, 15, 0, 60, 'Firma del contrato de arrendamiento', 'IN_PERSON', 'Oficina 802', 5], [-1, 16, 0, 60, 'Consulta jurídica: tutela EPS', 'VIRTUAL', 'Videollamada', 1],
    ];
    for (const [d, h, m, dur, title, modality, location, jobNo] of appts) {
      const job = jobNo ? byNum(jobNo) : null;
      await db.insert(s.appointments).values({ businessId: biz.id, title, startsAt: at(d, h, m), endsAt: new Date(at(d, h, m).getTime() + dur * 60_000), status: d < 0 ? 'DONE' : d === 0 ? 'CONFIRMED' : 'SCHEDULED',
        assignedUserId: user.id, customerId: job?.customerId ?? c[9].id, jobId: job?.id ?? null, productId: title.startsWith('Consulta') ? p[0].id : null, modality, location });
    }
    await expensesFor(db, biz.id, [['RENT', 'Arriendo oficina', 3200000, 2], ['UTILITIES', 'Servicios e internet', 380000, 10], ['PAYROLL', 'Abogada asociada y asistente', 6500000, 28], ['OTHER', 'Copias, envíos y notificaciones', 250000, 15], ['ADVERTISING', 'Pauta LinkedIn y Google', 450000, 5]]);
    await db.insert(s.knowledgeEntries).values([
      { businessId: biz.id, category: 'SERVICE_USE', title: 'Cómo prepararse para la consulta jurídica', content: 'Trae (o envía antes por correo) los documentos del caso: contratos, cartas, notificaciones, facturas, historia clínica o cualquier prueba. Anota las fechas importantes. La consulta dura una hora; al final recibes una propuesta de honorarios por escrito si decides continuar.' },
      { businessId: biz.id, category: 'FAQ', title: '¿Cuánto tarda una tutela?', content: 'El juez tiene 10 días hábiles desde la admisión para fallar. Si se pide medida provisional, puede decidirla de inmediato. El fallo se puede impugnar dentro de los 3 días siguientes a su notificación.' },
      { businessId: biz.id, category: 'PAYMENTS', title: 'Honorarios y formas de pago', content: 'Los honorarios se pactan por escrito antes de iniciar. Normalmente 50% al firmar el contrato de prestación de servicios y 50% al terminar la etapa. Aceptamos transferencia, Nequi y PSE. Los gastos procesales (notificaciones, pólizas, copias) se cobran aparte.' },
      { businessId: biz.id, category: 'GENERAL', title: 'Consultar el estado de mi caso', content: 'En nuestra página web, en «Consulta tu caso», escribe tu código de seguimiento y tu celular para ver las actuaciones recientes y la próxima cita. El código te lo enviamos al abrir el caso.' },
    ]);
    await db.update(s.businesses).set({ storeSlug: 'rios-abogados', storeEnabled: true, storeConfig: { ...STORE_BASE, template: 'servicios', headline: 'Asesoría jurídica clara y cercana',
      description: 'Abogados en Cali: derecho civil, familia, penal, laboral y constitucional. Agenda tu consulta en línea y sigue tu caso desde aquí.', heroLayout: 'split', layout: 'list',
      fontStyle: 'serif', cardStyle: 'outline', buttonStyle: 'square', primaryColor: '#1F2A44', backgroundColor: '#F7F5F0', accentColor: '#B08D57', productButtonText: 'Agendar',
      catalogTitle: 'Servicios', whatsapp: '573020000000', pickupAddress: 'Cra. 4 # 12-41, oficina 802, Cali', contactHours: 'Lunes a viernes 8:00 a.m. – 6:00 p.m.',
      privacyPolicy: 'Tratamos tus datos con reserva profesional y solo para atender tu consulta, conforme a la Ley 1581 de 2012.',
      sections: [{ id: 'hero-1', type: 'hero', enabled: true }, { id: 'catalog-1', type: 'catalog', enabled: true },
        { id: 'about-1', type: 'about', enabled: true, title: 'Quiénes somos', text: 'Somos un equipo de abogados con experiencia en litigio y asesoría. Te explicamos cada paso en lenguaje claro y te mantenemos informado del avance de tu caso.' },
        { id: 'faq-1', type: 'faq', enabled: true, title: 'Preguntas frecuentes', items: [{ title: '¿La primera consulta tiene costo?', text: 'Sí, $150.000 por una hora. Si decides contratarnos, se descuenta de los honorarios.' }, { title: '¿Atienden virtualmente?', text: 'Sí, por videollamada en todo el país.' }] },
        { id: 'contact-1', type: 'contact', enabled: true, title: 'Oficina' }, { id: 'policies-1', type: 'policies', enabled: true, title: 'Políticas' }],
      paymentMethods: [{ name: 'Transferencia bancaria', kind: 'BANK_TRANSFER', bank: 'Banco de pruebas', accountType: 'Ahorros', accountNumber: '000-000000-00', accountHolder: 'Ríos & Asociados Abogados S.A.S.', instructions: '', enabled: true },
        { name: 'Nequi', kind: 'NEQUI', accountNumber: '3020000000', accountHolder: 'Ríos & Asociados', instructions: '', enabled: true }] } })
      .where(eq(s.businesses.id, biz.id));
  }
  console.log('✔ Demo de servicios creado: servicios@dream.co / Dream2026 (TecnoCell Reparaciones y Ríos & Asociados Abogados)');
}
