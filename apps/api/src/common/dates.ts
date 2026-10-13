/**
 * Utilidades de fechas con zona horaria del negocio (por defecto America/Bogota).
 * Los límites de "hoy", "esta semana", etc. se calculan en la hora local del negocio.
 */
export type RangeKey = 'today' | 'week' | 'month' | 'quarter' | 'year';

/** Desfase (minutos) de la zona horaria respecto a UTC en una fecha dada. */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Componentes de fecha local (año, mes 0-11, día, día de semana) en la zona del negocio. */
export function localParts(tz: string, at: Date) {
  const local = new Date(at.getTime() + tzOffsetMinutes(tz, at) * 60000);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate(), dow: local.getUTCDay() };
}

/** Instante UTC correspondiente a la medianoche local de (y, m, d). */
export function localMidnight(tz: string, y: number, m: number, d: number): Date {
  const guess = new Date(Date.UTC(y, m, d));
  return new Date(guess.getTime() - tzOffsetMinutes(tz, guess) * 60000);
}

export function rangeFor(key: RangeKey, tz: string, now = new Date()): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const { y, m, d, dow } = localParts(tz, now);
  let from: Date;
  let prevFrom: Date;
  switch (key) {
    case 'today':
      from = localMidnight(tz, y, m, d);
      prevFrom = localMidnight(tz, y, m, d - 1);
      break;
    case 'week': {
      const mondayOffset = (dow + 6) % 7; // semana inicia el lunes
      from = localMidnight(tz, y, m, d - mondayOffset);
      prevFrom = localMidnight(tz, y, m, d - mondayOffset - 7);
      break;
    }
    case 'month':
      from = localMidnight(tz, y, m, 1);
      prevFrom = localMidnight(tz, y, m - 1, 1);
      break;
    case 'quarter': // últimos 3 meses (incluye el actual)
      from = localMidnight(tz, y, m - 2, 1);
      prevFrom = localMidnight(tz, y, m - 5, 1);
      break;
    case 'year':
      from = localMidnight(tz, y, 0, 1);
      prevFrom = localMidnight(tz, y - 1, 0, 1);
      break;
  }
  // Período anterior comparable: misma duración transcurrida
  const elapsed = now.getTime() - from.getTime();
  return { from, to: now, prevFrom, prevTo: new Date(prevFrom.getTime() + elapsed) };
}

/** Parsea ?from=YYYY-MM-DD&to=YYYY-MM-DD a instantes en la zona del negocio (to inclusivo). */
export function parsePeriod(tz: string, from?: string, to?: string, fallback: RangeKey = 'month') {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (from && to && re.test(from) && re.test(to)) {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    return { from: localMidnight(tz, fy, fm - 1, fd), to: localMidnight(tz, ty, tm - 1, td + 1) };
  }
  const r = rangeFor(fallback, tz);
  return { from: r.from, to: r.to };
}
