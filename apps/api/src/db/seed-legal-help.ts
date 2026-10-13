import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { CONSENT_TEXT, orient, scrub } from '../legal-help/help-catalog';
import { createDb } from './db';
import * as s from './schema';

/** Perfil verificado del abogado demo y dos consultas de ejemplo (idempotente). */
export async function seedLegalHelpDemo(db: ReturnType<typeof createDb>) {
  const [biz] = await db.select().from(s.businesses).where(eq(s.businesses.tradeName, 'Ríos & Asociados Abogados')).limit(1);
  if (!biz) return;
  const [has] = await db.select({ id: s.lawyerProfiles.id }).from(s.lawyerProfiles).where(eq(s.lawyerProfiles.businessId, biz.id)).limit(1);
  if (has) return;
  await db.insert(s.lawyerProfiles).values({
    businessId: biz.id, userId: biz.ownerId, displayName: 'Dra. Carolina Ríos', professionalCard: '245.871', verification: 'VERIFIED', verificationNote: 'Cuenta demo',
    topics: ['SALUD', 'TRABAJO', 'FAMILIA', 'ESTADO', 'VICTIMA', 'PENAL_DEFENSA', 'DEUDAS', 'HERENCIA'], departments: ['Valle del Cauca', 'Cauca'], remote: true, yearsExperience: 12,
    bio: 'Abogada litigante con experiencia en derecho constitucional, laboral y de familia. Atención presencial en Cali y virtual en todo el país.', accepting: true,
  });
  const samples: { topic: string; answers: Record<string, string>; urgent: boolean; department: string; city: string; name: string; phone: string; description: string }[] = [
    { topic: 'SALUD', answers: { que: 'NIEGA', riesgo: 'SI' }, urgent: true, department: 'Valle del Cauca', city: 'Palmira', name: 'Rosa Elena Quintero', phone: '3105550101',
      description: 'Mi mamá tiene 72 años y la EPS lleva dos meses sin entregarle el medicamento para la presión que le formuló el especialista. Ya pusimos un reclamo y no responden.' },
    { topic: 'TRABAJO', answers: { que: 'DESPIDO', publico: 'NO', fecha: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10) }, urgent: false, department: 'Valle del Cauca', city: 'Buga', name: 'Jhon Fredy Mosquera', phone: '3125550202',
      description: 'Trabajé tres años en un restaurante sin contrato escrito. Me despidieron sin pagarme liquidación ni vacaciones. Tengo los mensajes de WhatsApp del dueño.' },
  ];
  for (const x of samples) {
    const token = randomBytes(24).toString('base64url');
    await db.insert(s.helpRequests).values({
      code: `DEMO${Math.floor(1000 + Math.random() * 8999)}`, tokenHash: createHash('sha256').update(token).digest('hex'), topic: x.topic, answers: x.answers, description: x.description,
      publicDescription: scrub(x.description), department: x.department, city: x.city, urgent: x.urgent, orientation: orient(x.topic, x.answers), contactName: x.name, contactPhone: x.phone,
      consentText: CONSENT_TEXT, consentAt: new Date(), status: 'OPEN', deadlineAt: new Date(Date.now() + (x.urgent ? 24 : 48) * 3600_000),
    });
  }
  console.log('✔ Tu Derecho: perfil verificado de Ríos & Asociados y 2 consultas de ejemplo');
}
