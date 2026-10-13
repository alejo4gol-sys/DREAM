import { and, asc, eq, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { createDb } from './db';
import * as s from './schema';

const code = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5) + '26';

/** Datos de ejemplo para crecimiento: códigos de referido, lista mayorista, paquetes y reseñas demo (idempotente). */
export async function seedGrowthDemo(db: ReturnType<typeof createDb>) {
  const bizs = await db.select().from(s.businesses).where(inArray(s.businesses.tradeName, ['Luna Accesorios', 'TecnoCell Reparaciones', 'Ríos & Asociados Abogados']));
  const by = (n: string) => bizs.find((b) => b.tradeName === n);
  for (const b of bizs) if (!b.referralCode) await db.update(s.businesses).set({ referralCode: code(b.tradeName) }).where(eq(s.businesses.id, b.id)).catch(() => null);

  // Lista mayorista para Luna Accesorios
  const luna = by('Luna Accesorios');
  if (luna) {
    const [has] = await db.select({ id: s.priceLists.id }).from(s.priceLists).where(eq(s.priceLists.businessId, luna.id)).limit(1);
    if (!has) {
      const [pl] = await db.insert(s.priceLists).values({ businessId: luna.id, name: 'Mayoristas', description: 'Tiendas y revendedores: 20 % menos, pedido mínimo $300.000', discountPercent: '20', minOrderTotal: '300000' }).returning();
      const prods = await db.select().from(s.products).where(and(eq(s.products.businessId, luna.id), eq(s.products.isActive, true))).orderBy(asc(s.products.name)).limit(4);
      for (const p of prods) await db.insert(s.priceListItems).values({ priceListId: pl.id, productId: p.id, price: String(Math.round(Number(p.salePrice) * 0.75 / 100) * 100), minQty: 6 });
      const custs = await db.select().from(s.customers).where(eq(s.customers.businessId, luna.id)).orderBy(asc(s.customers.createdAt)).limit(2);
      for (const c of custs) await db.update(s.customers).set({ priceListId: pl.id, creditLimit: '1500000', paymentTermsDays: 30 }).where(eq(s.customers.id, c.id));
    }
  }

  // Paquetes para TecnoCell
  const tc = by('TecnoCell Reparaciones');
  if (tc) {
    const [has] = await db.select({ id: s.servicePackages.id }).from(s.servicePackages).where(eq(s.servicePackages.businessId, tc.id)).limit(1);
    if (!has) {
      const pk = [
        { name: 'Plan mantenimiento · 3 revisiones', kind: 'PACKAGE', sessions: 3, validityDays: 365, price: '90000', description: 'Limpieza interna, revisión de batería y actualización de software. 3 visitas en un año.' },
        { name: 'Membresía empresas · soporte mensual', kind: 'MEMBERSHIP', sessions: null, validityDays: 30, price: '150000', description: 'Soporte ilimitado para hasta 10 celulares de tu empresa durante el mes.' },
      ] as const;
      for (const p of pk) {
        const [prod] = await db.insert(s.products).values({ businessId: tc.id, sku: `PAQ-DEMO${p.kind === 'PACKAGE' ? '1' : '2'}`, name: p.name, description: p.description, salePrice: p.price, costPrice: '0', minStock: 0, isService: true, pricingUnit: p.kind === 'MEMBERSHIP' ? 'MONTH' : 'SESSION' } as any).returning({ id: s.products.id });
        await db.insert(s.servicePackages).values({ businessId: tc.id, productId: prod.id, name: p.name, kind: p.kind, sessions: p.sessions, validityDays: p.validityDays, price: p.price, description: p.description });
      }
    }
  }

  // Reseñas de ejemplo (negocios demo, ficticios)
  const reviews: Record<string, [string, number, string, string?][]> = {
    'TecnoCell Reparaciones': [
      ['Laura (demo)', 5, 'Me cambiaron la pantalla el mismo día y me explicaron todo. Muy recomendados.', '¡Gracias, Laura! Fue un gusto atenderte.'],
      ['Jorge (demo)', 4, 'Buen servicio, se demoraron un poco más de lo prometido pero quedó perfecto.'],
      ['Camila (demo)', 5, 'Precios claros y garantía por escrito.'],
    ],
    'Ríos & Asociados Abogados': [
      ['Patricia (demo)', 5, 'Me ayudaron con una tutela de salud y siempre me tuvieron al tanto del proceso.', 'Gracias por su confianza, doña Patricia.'],
      ['Hernán (demo)', 5, 'Atención cercana y explicaciones sin tanto tecnicismo.'],
    ],
  };
  for (const [name, list] of Object.entries(reviews)) {
    const b = by(name); if (!b) continue;
    const [has] = await db.select({ id: s.businessReviews.id }).from(s.businessReviews).where(eq(s.businessReviews.businessId, b.id)).limit(1);
    if (has) continue;
    for (const [i, [author, rating, body, reply]] of list.entries()) {
      await db.insert(s.businessReviews).values({ businessId: b.id, authorName: author, rating, body, reply: reply ?? null, repliedAt: reply ? new Date() : null,
        fingerprint: createHash('sha256').update(`demo-${b.id}-${i}`).digest('hex'), createdAt: new Date(Date.now() - (i + 1) * 4 * 86400000) });
    }
  }
  console.log('✔ Demo de crecimiento: referidos, lista mayorista, paquetes y reseñas');
}
