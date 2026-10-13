import { and, eq } from 'drizzle-orm';
import { createDb } from './db';
import * as s from './schema';

const ago = (d: number) => new Date(Date.now() - d * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

/** Procesos de ejemplo para Ríos & Asociados (idempotente). Marcados como demo: nunca se consultan en la Rama Judicial. */
export async function seedProcessWatchDemo(db: ReturnType<typeof createDb>) {
  const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.tradeName, 'Ríos & Asociados Abogados')).limit(1);
  if (!biz) return;
  const [has] = await db.select({ id: s.processWatches.id }).from(s.processWatches).where(and(eq(s.processWatches.businessId, biz.id), eq(s.processWatches.reference, '76111408800120260012300'))).limit(1);
  if (has) return;
  const jobs = await db.select({ id: s.jobs.id, title: s.jobs.title }).from(s.jobs).where(eq(s.jobs.businessId, biz.id));
  const job = (needle: string) => jobs.find((j) => j.title.toLowerCase().includes(needle))?.id ?? null;
  type U = { date: string; title: string; body?: string; origin?: string; unread?: boolean; termStart?: string; termEnd?: string };
  const items: { source: string; kind: string; reference: string; title: string; mode: string; extra?: Record<string, string>; jobId: string | null; remindDays?: number; summary?: Record<string, any>; updates: U[] }[] = [
    {
      source: 'RAMA_JUDICIAL', kind: 'TUTELA', reference: '76111408800120260012300', title: 'Tutela salud — medicamento oncológico', mode: 'AUTO', jobId: job('tutela'),
      summary: { demo: true, processes: [{ id: 0, despacho: 'JUZGADO 001 PENAL MUNICIPAL CON FUNCIÓN DE CONTROL DE GARANTÍAS DE BUGA', departamento: 'VALLE DEL CAUCA', sujetos: 'Accionante: MARÍA (EJEMPLO) | Accionado: EPS DE EJEMPLO', fechaUltimaActuacion: ago(1), privado: false }], detail: { claseProceso: 'Acción de tutela', ponente: '', tipoProceso: 'Constitucional' } },
      updates: [
        { date: ago(12), title: 'Radicación de proceso', body: 'Reparto por acta. Acción de tutela con medida provisional.' },
        { date: ago(11), title: 'Auto admite tutela', body: 'Se admite, se decreta medida provisional y se ordena notificar a la EPS. Término para responder: 2 días.', termStart: ago(10), termEnd: ago(9) },
        { date: ago(8), title: 'Recepción memorial', body: 'Respuesta de la EPS accionada.' },
        { date: ago(1), title: 'Fallo de tutela', body: 'Concede el amparo del derecho a la salud. Ordena entregar el medicamento en 48 horas.', unread: true },
      ],
    },
    {
      source: 'RAMA_JUDICIAL', kind: 'DEMANDA', reference: '76001400301220250045600', title: 'Ejecutivo singular — facturas impagas', mode: 'AUTO', jobId: job('ejecutivo'),
      summary: { demo: true, processes: [{ id: 0, despacho: 'JUZGADO 012 CIVIL MUNICIPAL DE CALI', departamento: 'VALLE DEL CAUCA', sujetos: 'Demandante: COMERCIALIZADORA DE EJEMPLO S.A.S. | Demandado: CLIENTE DE EJEMPLO', fechaUltimaActuacion: ago(20), privado: false }], detail: { claseProceso: 'Ejecutivo singular', tipoProceso: 'Ejecutivo' } },
      updates: [
        { date: ago(120), title: 'Auto libra mandamiento de pago', body: 'Se decretan medidas cautelares de embargo y secuestro.' },
        { date: ago(60), title: 'Notificación personal al demandado' },
        { date: ago(20), title: 'Auto ordena seguir adelante la ejecución', body: 'Se ordena practicar la liquidación del crédito y condena en costas.' },
      ],
    },
    {
      source: 'FISCALIA', kind: 'DENUNCIA', reference: '761116000165202600321', title: 'Denuncia por estafa — cliente comerciante', mode: 'MANUAL', jobId: null, remindDays: 15,
      updates: [{ date: ago(30), title: 'Denuncia radicada; asignada a Fiscalía Seccional de Buga', origin: 'MANUAL' }],
    },
    {
      source: 'SIC', kind: 'JURISDICCIONAL', reference: '26-145872', title: 'Protección al consumidor — garantía vehículo', mode: 'MANUAL', jobId: null, remindDays: 7,
      updates: [{ date: ago(14), title: 'Demanda admitida; traslado a la sociedad demandada por 10 días', origin: 'MANUAL' }],
    },
    {
      source: 'COLPENSIONES', kind: 'PENSION', reference: '2026_9387432', title: 'Derecho de petición — historia laboral', mode: 'MANUAL', jobId: job('colpensiones'), remindDays: 5,
      updates: [{ date: ago(9), title: 'Petición radicada en Colpensiones; vence plazo de respuesta en 15 días hábiles', origin: 'MANUAL' }],
    },
    {
      source: 'NOTARIA', kind: 'NOTARIAL', reference: 'Radicado 2026-0456', title: 'Sucesión notarial — familia Ospina', mode: 'MANUAL', jobId: null, remindDays: 10,
      extra: { notaria: 'Notaría Segunda de Buga', contacto: '(602) 237 0000' },
      updates: [{ date: ago(5), title: 'Edicto emplazatorio publicado; esperar 10 días hábiles', origin: 'MANUAL' }],
    },
  ];
  for (const it of items) {
    const unread = it.updates.filter((u) => u.unread).length;
    const last = it.updates.map((u) => u.date).sort().pop() ?? null;
    const [w] = await db.insert(s.processWatches).values({
      businessId: biz.id, jobId: it.jobId, source: it.source, kind: it.kind, reference: it.reference, title: it.title, mode: it.mode, extra: it.extra ?? {},
      remindDays: it.remindDays ?? 7, summary: it.summary ?? { demo: true }, lastActivity: last, unread, lastCheckedAt: it.mode === 'AUTO' ? new Date() : null,
      nextCheckAt: new Date(Date.now() + (it.remindDays ?? 1) * 86400000), lastChangeAt: unread ? new Date() : null, createdById: biz.ownerId,
    }).returning();
    await db.insert(s.processUpdates).values(it.updates.map((u, i) => ({
      watchId: w.id, businessId: biz.id, externalId: `DEMO-${i}`, date: u.date, title: u.title, body: u.body ?? null, termStart: u.termStart ?? null, termEnd: u.termEnd ?? null,
      origin: u.origin ?? 'AUTO', baseline: (u.origin ?? 'AUTO') === 'AUTO' && !u.unread,
    })));
  }
  console.log('✔ Seguimiento de procesos: 6 procesos de ejemplo para Ríos & Asociados');
}
