/**
 * Motor de conciliación: puntúa qué tan probable es que un movimiento bancario
 * corresponda a una venta (créditos) o a un gasto (débitos).
 */
export const ELECTRONIC_METHODS = ['BANK_TRANSFER', 'PSE', 'NEQUI', 'DAVIPLATA', 'DEBIT_CARD', 'CREDIT_CARD'] as const;

export interface Candidate {
  amountMatches: 'total' | 'balance' | 'payment' | 'none';
  daysApart: number;
  method?: string | null;
  referenceInDescription?: boolean;
}

export function scoreMatch(c: Candidate): number {
  if (c.amountMatches === 'none') return 0;
  if (c.daysApart > 5) return 0;
  let score = c.amountMatches === 'total' ? 60 : 55;
  score += Math.max(0, 30 - c.daysApart * 6);
  if (c.method && (ELECTRONIC_METHODS as readonly string[]).includes(c.method)) score += 5;
  if (c.referenceInDescription) score += 5;
  return Math.min(100, Math.round(score));
}

export const daysBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 86_400_000;

/** Parser CSV mínimo (separador , o ;) con soporte de comillas. */
export function parseCsv(text: string): string[][] {
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

/** Convierte "1.234.567,89", "-150000", "$ 100.000" a número decimal en texto. */
export function parseAmount(raw: string): string | null {
  let s = raw.replace(/[$\sCOP]/gi, '');
  if (!s) return null;
  const neg = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'));
  s = s.replace(/[()\-+]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && s.split('.').length > 2) s = s.replace(/\./g, '');
  else if (lastDot > lastComma && /\.\d{3}$/.test(s) && lastComma === -1) s = s.replace(/\./g, '');
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return (neg ? '-' : '') + s;
}

/** Acepta YYYY-MM-DD o DD/MM/YYYY. */
export function parseDate(raw: string): Date | null {
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-05:00`);
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T12:00:00-05:00`);
  return null;
}
