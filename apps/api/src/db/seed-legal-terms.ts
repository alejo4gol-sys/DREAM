import { and, eq } from 'drizzle-orm';
import { computeTerm, iso, TermInput } from '../legal-terms/term-engine';
import { createDb } from './db';
import * as s from './schema';

/** Términos de ejemplo para el demo de abogados (idempotente: solo si el negocio aún no tiene términos). */
export async function seedLegalTermsDemo(db: ReturnType<typeof createDb>) {
  const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.tradeName, 'Ríos & Asociados Abogados')).limit(1);
  if (!biz) return;
  const [has] = await db.select({ id: s.legalTerms.id }).from(s.legalTerms).where(eq(s.legalTerms.businessId, biz.id)).limit(1);
  if (has) return;
  const jobs = await db.select().from(s.jobs).where(and(eq(s.jobs.businessId, biz.id))).limit(6);
  const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400000));
  const samples: { title: string; input: TermInput; job?: number }[] = [
    { title: 'Demanda de nulidad y restablecimiento contra la resolución de retiro', input: { ruleKey: 'CA_NRD', eventDate: daysAgo(100) }, job: 0 },
    { title: 'Reparación directa por accidente en vía pública', input: { ruleKey: 'CA_REPARACION', eventDate: daysAgo(725), suspensions: [{ from: daysAgo(400), to: daysAgo(380), label: 'Conciliación Procuraduría' }] }, job: 1 },
    { title: 'Querella por injuria', input: { ruleKey: 'PENAL_QUERELLA', eventDate: daysAgo(178) }, job: 2 },
    { title: 'Cobro de prestaciones sociales (cesantías 2023)', input: { ruleKey: 'LAB_GENERAL', eventDate: '2024-02-15' }, job: 3 },
    { title: 'Ejecutivo — pagaré vencido', input: { ruleKey: 'COM_CAMBIARIA_DIRECTA', eventDate: daysAgo(900) } },
  ];
  for (const x of samples) {
    const r = computeTerm(x.input);
    const job = x.job != null ? jobs[x.job] : undefined;
    await db.insert(s.legalTerms).values({
      businessId: biz.id, jobId: job?.id ?? null, customerId: job?.customerId ?? null, ruleKey: x.input.ruleKey, title: x.title, eventDate: x.input.eventDate,
      input: x.input, result: r, dueDate: r.dueDate,
    });
  }
  console.log('✔ Términos de ejemplo creados para Ríos & Asociados Abogados');
}
