import { and, eq, inArray, sql } from 'drizzle-orm';
import { CryptoService } from '../common/crypto.service';
import { splitNit, nitDv } from '../invoicing/invoice-rules';
import { createDb } from './db';
import * as s from './schema';

/**
 * Deja listos los negocios demo para facturar (idempotente: solo actúa si el negocio aún no tiene ajustes de facturación).
 * La numeración electrónica es la de PRUEBAS que publica la DIAN para el set de habilitación, en modo simulación:
 * no se envía nada a la DIAN y los documentos salen marcados «SIMULACIÓN - SIN VALIDEZ FISCAL».
 */
export async function seedInvoicingDemo(db: ReturnType<typeof createDb>) {
  const crypto = new CryptoService();
  const owners = await db.select({ id: s.users.id }).from(s.users).where(inArray(s.users.email, ['demo@dream.co', 'servicios@dream.co']));
  if (!owners.length) return;
  const list = await db.select().from(s.businesses).where(inArray(s.businesses.ownerId, owners.map((o) => o.id)));
  let n = 0;
  for (const b of list) {
    if (b.invoiceSettings && Object.keys(b.invoiceSettings).length) continue;
    const [{ taxed }] = await db.select({ taxed: sql<number>`count(*)::int` }).from(s.saleItems)
      .innerJoin(s.sales, eq(s.sales.id, s.saleItems.saleId)).where(and(eq(s.sales.businessId, b.id), sql`${s.saleItems.taxRate} > 0`));
    const responsable = taxed > 0;
    const nit = b.taxId ? splitNit(b.taxId).number : '';
    await db.update(s.businesses).set({
      ...(nit ? { taxId: `${nit}-${nitDv(nit)}` } : {}),
      address: b.address ?? 'Calle 10 # 5-20, local 3', city: b.city ?? 'Cali', email: b.email ?? 'facturacion@dream.co',
      invoiceSettings: {
        personType: 'JURIDICA', regime: responsable ? 'RESPONSABLE_IVA' : 'NO_RESPONSABLE', responsibilities: responsable ? [] : ['R-99-PN'],
        defaultDocType: 'INTERNAL', internalPrefix: 'CV', defaultWarrantyMonths: b.businessModel === 'SERVICES' ? 3 : 12, defaultDueDays: 30,
        einvoiceMode: 'SANDBOX', template: { accentColor: b.brandColors?.primary ?? '#1F2937', showLogo: true, showSku: true, footerNote: '¡Gracias por tu compra!' },
      },
    }).where(eq(s.businesses.id, b.id));
    await db.insert(s.invoiceResolutions).values({
      businessId: b.id, kind: 'ELECTRONIC', resolutionNumber: '18760000001', resolutionDate: '2019-01-19', prefix: 'SETP', fromNumber: 990000000, toNumber: 995000000,
      nextNumber: 990000001, validFrom: '2019-01-19', validTo: '2030-01-19', technicalKeyEnc: crypto.encrypt('fc8eac422eba16e22ffd8c6f94b3f40a6e38162c'), environment: '2', active: true,
    });
    n++;
  }
  if (n) console.log(`✔ Facturación demo lista en ${n} negocio(s) (numeración de pruebas DIAN, modo simulación)`);
}
