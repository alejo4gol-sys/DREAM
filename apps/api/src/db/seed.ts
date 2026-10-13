/**
 * Siembra datos base (planes, roles y permisos) y, con --demo, un negocio de ejemplo
 * con 120 días de actividad para explorar la plataforma.
 *   npm run seed            → solo datos base
 *   npm run seed -- --demo  → datos base + negocio demo (demo@dream.co / Dream2026)
 */
import { hash } from '@node-rs/argon2';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { SYSTEM_ROLES } from '../common/permissions';
import { D, m2 } from '../common/money';
import { computeSale } from '../sales/sale-calculator';
import { createDb, createPool } from './db';
import * as s from './schema';
import { seedInvoicingDemo } from './seed-invoicing';
import { seedLegalTermsDemo } from './seed-legal-terms';
import { seedLegalHelpDemo } from './seed-legal-help';
import { seedProcessWatchDemo } from './seed-process-watch';
import { seedGrowthDemo } from './seed-growth';
import { seedServicesDemo } from './seed-services';

const PLANS: (typeof s.plans.$inferInsert)[] = [
  // Precios pensados para emprendedores (oct. 2026). Los límites deben coincidir con la portada (apps/web/src/app/page.tsx).
  { code: 'FREE', name: 'Gratis', priceMonthly: '0', limits: { users: 1, products: 100, salesPerMonth: 150, bankAccounts: 1, socialAccounts: 1, assistant: true, reportFormats: ['csv'], processWatches: 5, whatsappAlerts: false } },
  { code: 'BASIC', name: 'Emprendedor', priceMonthly: '19900', limits: { users: 2, products: 1000, salesPerMonth: null, bankAccounts: 1, socialAccounts: 3, assistant: true, reportFormats: ['csv', 'xlsx'], processWatches: 30, whatsappAlerts: true } },
  { code: 'PRO', name: 'Negocio', priceMonthly: '44900', limits: { users: 5, products: 5000, salesPerMonth: null, bankAccounts: 3, socialAccounts: 6, assistant: true, reportFormats: ['csv', 'xlsx', 'pdf'], processWatches: 150, whatsappAlerts: true } },
  { code: 'ENTERPRISE', name: 'Empresa', priceMonthly: '99900', limits: { users: null, products: null, salesPerMonth: null, bankAccounts: null, socialAccounts: null, assistant: true, reportFormats: ['csv', 'xlsx', 'pdf'], processWatches: null, whatsappAlerts: true } },
];

async function main() {
  const pool = createPool();
  const db = createDb(pool);
  try {
    for (const p of PLANS) {
      await db.insert(s.plans).values(p).onConflictDoUpdate({ target: s.plans.code, set: { name: p.name, priceMonthly: p.priceMonthly, limits: p.limits } });
    }
    for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
      let role = await db.query.roles.findFirst({ where: and(isNull(s.roles.businessId), eq(s.roles.key, key)) });
      if (!role) [role] = await db.insert(s.roles).values({ key, name: def.name, isSystem: true }).returning();
      await db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, role.id));
      await db.insert(s.rolePermissions).values(def.permissions.map((permission) => ({ roleId: role!.id, permission })));
    }
    console.log('✔ Planes y roles sembrados');
    if (process.argv.includes('--demo')) { await seedDemo(db); await seedServicesDemo(db); await seedInvoicingDemo(db); await seedLegalTermsDemo(db); await seedLegalHelpDemo(db); await seedProcessWatchDemo(db); await seedGrowthDemo(db); }
  } finally {
    await pool.end();
  }
}

// Generador pseudoaleatorio determinista
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const weighted = <T>(pairs: [T, number][]) => {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[0][0];
};

async function seedDemo(db: ReturnType<typeof createDb>) {
  const email = 'demo@dream.co';
  const existing = await db.query.users.findFirst({ where: eq(s.users.email, email) });
  if (existing) { console.log('ℹ El usuario demo ya existe; no se repite la siembra.'); return; }

  const [user] = await db.insert(s.users).values({
    email, fullName: 'Valentina Ríos', phone: '+57 300 000 0000',
    socialLinks: { instagram: '@valen.rios', linkedin: 'valentina-rios' },
    passwordHash: await hash('Dream2026', { memoryCost: 19456, timeCost: 2, parallelism: 1 }), acceptedPolicyAt: new Date(),
  }).returning();
  const [biz] = await db.insert(s.businesses).values({
    ownerId: user.id, tradeName: 'Luna Accesorios', legalName: 'Luna Accesorios S.A.S.', taxId: '901.234.567-8',
    phone: '+57 300 000 0000', email: 'hola@lunaaccesorios.co', address: 'Cra. 100 # 11-60', city: 'Cali', country: 'CO',
    businessType: 'Tienda minorista', category: 'Moda y accesorios', monthlyGoal: '12000000',
    socialLinks: { instagram: '@luna.accesorios', whatsapp: '+57 300 000 0000' },
  }).returning();
  const owner = await db.query.roles.findFirst({ where: and(isNull(s.roles.businessId), eq(s.roles.key, 'OWNER')) });
  await db.insert(s.memberships).values({ userId: user.id, businessId: biz.id, roleId: owner!.id });
  await db.insert(s.subscriptions).values({ businessId: biz.id, planCode: 'PRO' });
  const [wh] = await db.insert(s.warehouses).values({ businessId: biz.id, name: 'Principal', isDefault: true }).returning();

  const cats = await db.insert(s.categories).values(['Aretes', 'Collares', 'Bolsos', 'Relojes', 'Gafas'].map((name) => ({ businessId: biz.id, name }))).returning();
  const [sup1, sup2] = await db.insert(s.suppliers).values([
    { businessId: biz.id, name: 'Distribuidora Pacífico', company: 'Pacífico Mayoristas S.A.S.', taxId: '900.111.222-3', phone: '+57 602 555 0101', email: 'ventas@pacifico.co' },
    { businessId: biz.id, name: 'Importadora Andina', company: 'Andina Import Ltda.', taxId: '800.333.444-5', phone: '+57 601 555 0202', email: 'pedidos@andina.co' },
  ]).returning();

  const catalog: [string, string, number, number, number, number][] = [
    // nombre, categoría, costo, precio, stock inicial, mínimo
    ['Aretes argolla dorada', 'Aretes', 12000, 35000, 60, 10], ['Aretes perla clásica', 'Aretes', 9000, 28000, 45, 8],
    ['Collar cadena fina', 'Collares', 15000, 42000, 40, 8], ['Collar dije luna', 'Collares', 18000, 52000, 35, 6],
    ['Bolso tote beige', 'Bolsos', 48000, 129000, 20, 4], ['Bolso bandolera negro', 'Bolsos', 55000, 149000, 18, 4],
    ['Reloj minimal cuero', 'Relojes', 70000, 189000, 15, 3], ['Reloj acero plateado', 'Relojes', 85000, 229000, 12, 3],
    ['Gafas de sol carey', 'Gafas', 25000, 79000, 30, 6], ['Gafas cat-eye negras', 'Gafas', 27000, 85000, 25, 5],
    ['Pulsera tejida', 'Collares', 6000, 19000, 80, 15], ['Monedero cuero', 'Bolsos', 14000, 39000, 30, 6],
  ];
  const prods: (typeof s.products.$inferSelect & { stock: number })[] = [];
  for (const [i, [name, cat, cost, price, stock, min]] of catalog.entries()) {
    const [p] = await db.insert(s.products).values({
      businessId: biz.id, sku: `LUN-${String(i + 1).padStart(3, '0')}`, barcode: `77${String(1000000000 + i * 7919).slice(0, 11)}`,
      name, categoryId: cats.find((c) => c.name === cat)!.id, supplierId: i % 2 ? sup2.id : sup1.id,
      costPrice: String(cost), salePrice: String(price), minStock: min,
    }).returning();
    prods.push({ ...p, stock: stock + 220 });
    await db.insert(s.inventoryLevels).values({ productId: p.id, warehouseId: wh.id, quantity: stock + 220 });
    await db.insert(s.inventoryMovements).values({ businessId: biz.id, productId: p.id, warehouseId: wh.id, type: 'INITIAL', quantity: stock + 220, unitCost: String(cost), note: 'Inventario inicial', createdAt: new Date(Date.now() - 125 * 86_400_000) });
  }

  const names = ['Camila Torres', 'Andrés Gómez', 'Laura Martínez', 'Juan Pablo Ruiz', 'Daniela Herrera', 'Sofía Castro', 'Mateo Vargas',
    'Valeria Ortiz', 'Santiago López', 'Isabella Moreno', 'Natalia Rojas', 'Felipe Cárdenas', 'Mariana Silva', 'Sebastián Peña',
    'Gabriela Mejía', 'Tomás Restrepo', 'Paula Jiménez', 'Nicolás Salazar', 'Carolina Duque', 'Alejandro Pardo'];
  const channels: [typeof s.salesChannel.enumValues[number], number][] = [['INSTAGRAM', 34], ['WHATSAPP', 28], ['PHYSICAL_STORE', 18], ['FACEBOOK', 8], ['WEBSITE', 7], ['MARKETPLACE', 5]];
  const custs = [];
  for (const [i, name] of names.entries()) {
    const [c] = await db.insert(s.customers).values({
      businessId: biz.id, name, phone: `+57 31${i % 10} ${String(1000000 + i * 3571).slice(0, 7)}`,
      email: `${name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}${i}@correo.co`,
      city: pick(['Cali', 'Cali', 'Cali', 'Palmira', 'Jamundí', 'Buga', 'Bogotá']), channel: weighted(channels),
      socialLinks: i % 3 === 2 ? {} : { instagram: '@' + name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' ', '.').split(' ')[0], ...(i % 4 === 0 ? { tiktok: '@' + name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + i } : {}) },
      createdAt: new Date(Date.now() - (i < 16 ? 125 - i * 6 : 28 - (i - 16) * 6) * 86_400_000),
    }).returning();
    custs.push(c);
  }

  const methodsFor: Record<string, [typeof s.paymentMethod.enumValues[number], number][]> = {
    PHYSICAL_STORE: [['CASH', 50], ['DEBIT_CARD', 30], ['CREDIT_CARD', 20]],
    default: [['NEQUI', 35], ['BANK_TRANSFER', 30], ['DAVIPLATA', 15], ['PSE', 10], ['CASH', 10]],
  };
  let number = 1;
  const now = Date.now();
  for (let day = 120; day >= 0; day--) {
    const date = new Date(now - day * 86_400_000);
    const dow = date.getDay();
    const trend = 1 + (120 - day) / 160;
    const count = Math.round((dow === 5 || dow === 6 ? 5 : 3) * trend * (0.5 + rnd()));
    for (let k = 0; k < count; k++) {
      const channel = weighted(channels);
      const items = Array.from({ length: 1 + Math.floor(rnd() * 2.2) }, () => ({ p: pick(prods), q: 1 + Math.floor(rnd() * 1.6) }))
        .filter((it, idx, arr) => arr.findIndex((x) => x.p.id === it.p.id) === idx)
        .filter((it) => it.p.stock - it.q >= 2);
      if (!items.length) continue;
      const saleDate = new Date(date); saleDate.setHours(9 + Math.floor(rnd() * 11), Math.floor(rnd() * 60));
      if (saleDate.getTime() > now) saleDate.setTime(now - 60_000 * (k + 1));
      const totals = computeSale(items.map((it) => ({ quantity: it.q, unitPrice: it.p.salePrice, unitCost: it.p.costPrice })), rnd() < 0.15 ? '5000' : '0');
      const eligible = custs.filter((c) => c.createdAt.getTime() <= saleDate.getTime());
      const customer = rnd() < 0.8 && eligible.length ? eligible[Math.floor(rnd() ** 2 * eligible.length)] : null;
      const method = weighted(methodsFor[channel] ?? methodsFor.default);
      const unpaid = day < 25 && rnd() < 0.08;
      const paid = unpaid ? (rnd() < 0.5 ? '0' : m2(D(totals.total).div(2))) : totals.total;
      const [sale] = await db.insert(s.sales).values({
        businessId: biz.id, number: number++, customerId: customer?.id, date: saleDate, channel, paymentMethod: method,
        status: D(paid).gte(totals.total) ? 'PAID' : D(paid).gt(0) ? 'PARTIALLY_PAID' : 'PENDING',
        subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxTotal: totals.taxTotal, total: totals.total,
        amountPaid: paid, costTotal: totals.costTotal, createdById: user.id,
      }).returning();
      for (const [idx, it] of items.entries()) {
        const r = totals.lines[idx];
        await db.insert(s.saleItems).values({ saleId: sale.id, productId: it.p.id, description: it.p.name, quantity: it.q, unitPrice: it.p.salePrice, unitCost: it.p.costPrice, discount: r.discount, lineTax: r.tax, lineTotal: r.total });
        await db.insert(s.inventoryMovements).values({ businessId: biz.id, productId: it.p.id, warehouseId: wh.id, type: 'SALE', quantity: -it.q, unitCost: it.p.costPrice, referenceType: 'SALE', referenceId: sale.id, note: `Venta #${sale.number}`, createdAt: saleDate });
        it.p.stock -= it.q;
      }
      if (D(paid).gt(0)) await db.insert(s.salePayments).values({ saleId: sale.id, amount: paid, method, paidAt: saleDate });
      if (customer) {
        await db.update(s.customers).set({
          totalSpent: sql`${s.customers.totalSpent} + ${totals.total}`, purchaseCount: sql`${s.customers.purchaseCount} + 1`,
          firstPurchaseAt: sql`coalesce(${s.customers.firstPurchaseAt}, ${saleDate.toISOString()}::timestamptz)`, lastPurchaseAt: saleDate,
        }).where(eq(s.customers.id, customer.id));
      }
    }
  }
  // Algunos productos quedan con inventario bajo para ver alertas
  prods[6].stock = 2; prods[4].stock = 3;
  for (const p of prods) await db.update(s.inventoryLevels).set({ quantity: p.stock }).where(eq(s.inventoryLevels.productId, p.id));
  await db.update(s.businesses).set({ nextSaleNumber: number }).where(eq(s.businesses.id, biz.id));

  // Gastos mensuales
  for (let m = 3; m >= 0; m--) {
    const base = new Date(); base.setMonth(base.getMonth() - m, 1); base.setHours(12, 0, 0, 0);
    const at = (d: number) => { const x = new Date(base); x.setDate(d); return x; };
    const rows: Omit<typeof s.expenses.$inferInsert, 'businessId'>[] = [
      { category: 'RENT', description: 'Arriendo local', amount: '1800000', date: at(2), paymentMethod: 'BANK_TRANSFER' },
      { category: 'UTILITIES', description: 'Energía, agua e internet', amount: String(310000 + Math.round(rnd() * 60000)), date: at(10), paymentMethod: 'PSE' },
      { category: 'PAYROLL', description: 'Nómina asesora de ventas', amount: '1750000', date: at(28), paymentMethod: 'BANK_TRANSFER' },
      { category: 'ADVERTISING', description: 'Pauta Instagram y Facebook', amount: String(400000 + Math.round(rnd() * 250000)), date: at(5), paymentMethod: 'CREDIT_CARD' },
      { category: 'TRANSPORT', description: 'Domicilios y envíos', amount: String(180000 + Math.round(rnd() * 90000)), date: at(15), paymentMethod: 'NEQUI' },
      { category: 'BANK_FEES', description: 'Comisiones datáfono y cuenta', amount: String(45000 + Math.round(rnd() * 20000)), date: at(30), paymentMethod: 'BANK_TRANSFER' },
    ];
    await db.insert(s.expenses).values(rows.filter((r) => (r.date as Date).getTime() <= now).map((r) => ({ ...r, businessId: biz.id })));
  }
  await db.insert(s.expenses).values({ businessId: biz.id, category: 'OTHER', description: 'Mantenimiento vitrina', amount: '350000', date: new Date(now - 2 * 86_400_000), status: 'PENDING', dueDate: new Date(now + 10 * 86_400_000), supplierId: sup1.id });
  await db.insert(s.incomes).values({ businessId: biz.id, category: 'Otros ingresos', description: 'Venta de exhibidor usado', amount: '250000', date: new Date(now - 20 * 86_400_000), paymentMethod: 'CASH' });

  // Compra a proveedor con saldo pendiente
  const [pur] = await db.insert(s.purchases).values({ businessId: biz.id, supplierId: sup2.id, date: new Date(now - 12 * 86_400_000), total: '1260000', amountPaid: '600000', status: 'PARTIALLY_PAID', notes: 'Reposición relojes y gafas' }).returning();
  await db.insert(s.purchaseItems).values([
    { purchaseId: pur.id, productId: prods[7].id, quantity: 8, unitCost: '85000', lineTotal: '680000' },
    { purchaseId: pur.id, productId: prods[9].id, quantity: 20, unitCost: '29000', lineTotal: '580000' },
  ]);
  await db.insert(s.purchasePayments).values({ purchaseId: pur.id, amount: '600000', method: 'BANK_TRANSFER', paidAt: new Date(now - 12 * 86_400_000) });

  await db.insert(s.bankAccounts).values({ businessId: biz.id, bankName: 'Banco de pruebas', accountType: 'AHORROS', last4: '0000', provider: 'SANDBOX', balance: '8450000' });
  await db.insert(s.notifications).values({ businessId: biz.id, type: 'LOW_STOCK', title: 'Producto con inventario bajo', body: `${prods[6].name} tiene 2 unidades; mínimo ${prods[6].minStock}.`, data: { productId: prods[6].id } });

  console.log(`✔ Negocio demo creado: ${number - 1} ventas · usuario ${email} / contraseña Dream2026`);
}

main().catch((e) => { console.error(e); process.exit(1); });
