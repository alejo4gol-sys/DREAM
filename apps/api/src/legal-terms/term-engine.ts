import { TERM_RULES, TermRule } from './term-rules';

/**
 * Cómputo de términos legales en Colombia.
 * - Meses y años: calendario común; el primer y el último día del plazo tienen el mismo número (art. 59 Ley 4 de 1913).
 * - Días: hábiles; se excluyen sábados, domingos y festivos (art. 62 Ley 4 de 1913).
 * - Si el término vence en día inhábil se extiende hasta el primer día hábil siguiente (art. 62 Ley 4 de 1913).
 * - Opcionalmente se excluye la vacancia judicial colectiva (20 dic–10 ene y Semana Santa, art. 146 Ley 270 de 1996).
 */

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const parseIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
export const fmt = (s: string) => parseIso(s).toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
/** Traslada al lunes siguiente (Ley 51 de 1983), salvo que ya sea lunes. */
const toMonday = (d: Date) => { const w = d.getUTCDay(); return w === 1 ? d : addDays(d, (8 - w) % 7); };

const holidayCache = new Map<number, Map<string, string>>();
/** Festivos de Colombia (Ley 51 de 1983 y fiestas religiosas móviles). */
export function holidays(y: number): Map<string, string> {
  const hit = holidayCache.get(y);
  if (hit) return hit;
  const m = new Map<string, string>();
  const put = (d: Date, n: string) => m.set(iso(d), n);
  const D = (mo: number, da: number) => new Date(Date.UTC(y, mo - 1, da));
  put(D(1, 1), 'Año Nuevo'); put(D(5, 1), 'Día del Trabajo'); put(D(7, 20), 'Independencia'); put(D(8, 7), 'Batalla de Boyacá');
  put(D(12, 8), 'Inmaculada Concepción'); put(D(12, 25), 'Navidad');
  put(toMonday(D(1, 6)), 'Reyes Magos'); put(toMonday(D(3, 19)), 'San José'); put(toMonday(D(6, 29)), 'San Pedro y San Pablo');
  put(toMonday(D(8, 15)), 'Asunción de la Virgen'); put(toMonday(D(10, 12)), 'Día de la Raza'); put(toMonday(D(11, 1)), 'Todos los Santos');
  put(toMonday(D(11, 11)), 'Independencia de Cartagena');
  const e = easter(y);
  put(addDays(e, -3), 'Jueves Santo'); put(addDays(e, -2), 'Viernes Santo');
  put(addDays(e, 43), 'Ascensión del Señor'); put(addDays(e, 64), 'Corpus Christi'); put(addDays(e, 71), 'Sagrado Corazón');
  holidayCache.set(y, m);
  return m;
}

export function judicialVacation(d: Date) {
  const mo = d.getUTCMonth() + 1, da = d.getUTCDate();
  if ((mo === 12 && da >= 20) || (mo === 1 && da <= 10)) return 'Vacancia judicial de fin de año';
  const e = easter(d.getUTCFullYear());
  const t = d.getTime();
  if (t >= addDays(e, -6).getTime() && t <= addDays(e, -4).getTime()) return 'Vacancia judicial de Semana Santa';
  return null;
}

export function nonBusinessReason(d: Date, vacation: boolean): string | null {
  const w = d.getUTCDay();
  if (w === 0) return 'domingo';
  if (w === 6) return 'sábado';
  const h = holidays(d.getUTCFullYear()).get(iso(d));
  if (h) return `festivo (${h})`;
  if (vacation) return judicialVacation(d);
  return null;
}

function addMonthsSameNumber(d: Date, months: number) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + months, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

export interface TermInput {
  ruleKey: string;
  eventDate: string;
  suspensions?: { from: string; to: string; label?: string }[];
  interruptionDate?: string | null;
  vacation?: boolean;
  offsetMonths?: number;
  penal?: { maxPenaltyYears?: number; publicServant?: boolean; special30?: boolean; imprescriptible?: boolean };
}
export interface TermResult {
  status: 'DATE' | 'NO_TERM' | 'IMPRESCRIPTIBLE';
  dueDate: string | null;
  firstDay: string | null;
  steps: string[];
  warnings: string[];
  termLabel: string | null;
}

const num = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
const unitText = (n: number, u: string) => u === 'YEARS' ? `${num(n)} ${n === 1 ? 'año' : 'años'}` : u === 'MONTHS' ? `${num(n)} ${n === 1 ? 'mes' : 'meses'}` : `${num(n)} días hábiles`;

export function findRule(key: string): TermRule | undefined { return TERM_RULES.find((r) => r.key === key); }

/** Calcula el vencimiento de un término. Todas las fechas en formato AAAA-MM-DD. */
export function computeTerm(input: TermInput): TermResult {
  const rule = findRule(input.ruleKey);
  if (!rule) throw new Error('Término desconocido');
  const steps: string[] = [];
  const warnings: string[] = [];
  const NON_JUDICIAL = ['CUMPLIMIENTO_RENUENCIA', 'PENAL_QUERELLA'];
  const vacation = input.vacation ?? (rule.judicial ?? !NON_JUDICIAL.includes(rule.key));
  const event = parseIso(input.eventDate);
  steps.push(`${rule.startLabel}: ${fmt(input.eventDate)}.`);

  // ── Duración ──
  let term = rule.term ? { ...rule.term } : null;
  if (rule.penal) {
    const p = input.penal ?? {};
    if (p.imprescriptible) {
      steps.push('Conducta imprescriptible (genocidio, lesa humanidad, crímenes de guerra o delitos sexuales contra menores según la ley vigente).');
      return { status: 'IMPRESCRIPTIBLE', dueDate: null, firstDay: null, steps, warnings, termLabel: 'Imprescriptible' };
    }
    if (!p.maxPenaltyYears && !p.special30) {
      warnings.push('Escribe el máximo de la pena de prisión del delito para calcular.');
      return { status: 'NO_TERM', dueDate: null, firstDay: null, steps, warnings, termLabel: null };
    }
    let years = p.special30 ? 30 : Math.min(20, Math.max(5, p.maxPenaltyYears!));
    steps.push(p.special30 ? 'Delito con término especial de 30 años (art. 83 C.P.).' : `Máximo de la pena: ${p.maxPenaltyYears} años → término de ${years} años (mínimo 5, máximo 20).`);
    if (p.publicServant) { years = years + years / 3; steps.push(`Servidor público en ejercicio de funciones: se aumenta en una tercera parte → ${years.toLocaleString('es-CO', { maximumFractionDigits: 2 })} años.`); }
    term = { n: years, unit: 'YEARS' };
  }
  if (!term) {
    const elapsed = Math.floor((Date.now() - event.getTime()) / 86400000);
    if (rule.phenomenon === 'INMEDIATEZ') steps.push(`Han pasado ${elapsed.toLocaleString('es-CO')} días desde la vulneración. Valora si el plazo sigue siendo razonable (inmediatez).`);
    else steps.push('Este medio no tiene un término general de caducidad o prescripción.');
    return { status: 'NO_TERM', dueDate: null, firstDay: null, steps, warnings, termLabel: null };
  }

  // ── Inicio del cómputo ──
  let start = event;
  let interruptedHalf = false;
  if (input.interruptionDate && rule.interruption) {
    const it = parseIso(input.interruptionDate);
    if (it.getTime() < event.getTime()) warnings.push('La fecha de interrupción es anterior al inicio del término.');
    else {
      start = it;
      if (rule.interruption.mode === 'PENAL_HALF') {
        const half = Math.max(3, term.n / 2);
        steps.push(`${rule.interruption.label} el ${fmt(input.interruptionDate)}: vuelve a correr la mitad del término (${(term.n / 2).toLocaleString('es-CO', { maximumFractionDigits: 2 })} años), sin ser inferior a 3 años → ${half.toLocaleString('es-CO', { maximumFractionDigits: 2 })} años.`);
        term = { n: half, unit: 'YEARS' };
        interruptedHalf = true;
      } else steps.push(`${rule.interruption.label} el ${fmt(input.interruptionDate)}: el término vuelve a correr completo desde esa fecha.`);
    }
  }
  const offset = rule.offsetMonths ? (input.offsetMonths ?? rule.offsetMonths.n) : 0;
  if (offset) { start = addMonthsSameNumber(start, offset); steps.push(`Se suman ${offset} meses previos (${rule.offsetMonths!.label}) → ${fmt(iso(start))}.`); }
  const first = rule.nextDay ? addDays(start, 1) : start;
  if (rule.nextDay) steps.push(`El término corre desde el día siguiente: ${fmt(iso(first))}.`);

  // ── Vencimiento ──
  let end: Date;
  if (term.unit === 'BUSINESS_DAYS') {
    let d = first; let count = 0;
    for (;;) { if (!nonBusinessReason(d, vacation)) { count++; if (count === term.n) break; } d = addDays(d, 1); }
    end = d;
    steps.push(`Se cuentan ${term.n} días hábiles (sin sábados, domingos, festivos${vacation ? ' ni vacancia judicial' : ''}) → ${fmt(iso(end))}.`);
  } else {
    const months = term.unit === 'YEARS' ? Math.round(term.n * 12) : term.n;
    const whole = term.unit === 'YEARS' && !Number.isInteger(term.n * 12);
    end = addMonthsSameNumber(first, months);
    if (whole) { const extraDays = Math.round((term.n * 12 - Math.floor(term.n * 12)) * 30); end = addDays(addMonthsSameNumber(first, Math.floor(term.n * 12)), extraDays); }
    // Art. 59 Ley 4 de 1913: el primero y el último día del plazo tienen el mismo número en los respectivos meses.
    steps.push(`${unitText(term.n, term.unit)} contados desde el ${fmt(iso(first))} → último día: ${fmt(iso(end))}.`);
  }

  // ── Suspensiones ──
  let suspended = 0;
  for (const s of input.suspensions ?? []) {
    const a = parseIso(s.from), b = parseIso(s.to);
    if (b.getTime() < a.getTime()) { warnings.push(`La suspensión «${s.label ?? ''}» termina antes de empezar.`); continue; }
    const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    if (rule.suspension?.maxMonths && b.getTime() > addMonthsSameNumber(a, rule.suspension.maxMonths).getTime()) {
      warnings.push(`La suspensión supera ${rule.suspension.maxMonths} meses: verifica el término legal máximo del trámite de conciliación.`);
    }
    if (a.getTime() > end.getTime()) { warnings.push(`La suspensión del ${fmt(s.from)} empezó cuando el término ya había vencido: no lo revive.`); continue; }
    suspended += days;
    steps.push(`Suspensión${s.label ? ` (${s.label})` : ''} del ${fmt(s.from)} al ${fmt(s.to)}: ${days} días que se suman.`);
  }
  if (suspended) { end = addDays(end, suspended); steps.push(`Nuevo último día por suspensiones: ${fmt(iso(end))}.`); }

  // ── Día inhábil ──
  if (rule.extendToBusinessDay && term.unit !== 'BUSINESS_DAYS') {
    let reason = nonBusinessReason(end, vacation);
    if (reason) {
      const orig = end;
      while (reason) { end = addDays(end, 1); reason = nonBusinessReason(end, vacation); }
      steps.push(`El ${fmt(iso(orig))} es inhábil: el término se extiende al primer día hábil siguiente, ${fmt(iso(end))} (art. 62 Ley 4 de 1913).`);
    }
  }
  if (interruptedHalf) warnings.push('Revisa si la ley aplicable al proceso (Ley 600 de 2000 o Ley 906 de 2004) fija un tope distinto tras la interrupción.');
  return { status: 'DATE', dueDate: iso(end), firstDay: iso(first), steps, warnings, termLabel: unitText(term.n, term.unit) };
}

/** Días calendario desde hoy (Bogotá) hasta el vencimiento. */
export function daysUntil(due: string, today = new Date()) {
  const t = new Date(today.getTime() - 5 * 3600000);
  const todayUtc = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  return Math.round((parseIso(due).getTime() - todayUtc) / 86400000);
}
