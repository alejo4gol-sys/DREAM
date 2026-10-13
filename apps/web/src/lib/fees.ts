/** Tipos de la calculadora de honorarios (el cálculo vive en el API: /fees/calculate). */
export type Tier = [number | null, number];
export type Formula = { smmlv?: number; cop?: number; range?: [number, number]; pct?: number; tiers?: Tier[]; above?: { over: number; pct: number; overSmmlv?: boolean }; minSmmlv?: number };
export type FeeItem = {
  key: string; ref?: string; area: string; label: string; f?: Formula; byCuantia?: Partial<Record<'MINIMA' | 'MENOR' | 'MAYOR', Formula>>;
  variants?: { key: string; label: string; f: Formula; note?: string }[]; base?: string; unit?: string; note?: string; mods?: string[]; success?: boolean; source?: string; tags?: string;
};
export type FeeTable = {
  key: string; profile: string; title: string; profession: string; kind: 'TARIFF' | 'MARKET'; areas: { key: string; label: string }[];
  items: FeeItem[]; sources: { key: string; label: string; url?: string; note?: string }[]; disclaimer: string; notes?: string[];
};
export type Catalog = {
  tables: FeeTable[]; mods: Record<string, { label: string; help: string }>; cities: Record<string, { label: string; factor: number }>;
  levels: Record<string, { label: string }>; smmlvDefault: number;
};
export type FeeSettings = { smmlv: string; smmlvDefault: string; ivaResponsable: boolean; ivaRate: number; advancePct: number; installments: number; city: string; level: string; hourlyRate: string | null; tableKey: string };
export type LineInput = { uid: string; itemKey: string; variant?: string; base?: string; quantity?: string; mods?: string[]; label?: string; amount?: string };
export type QuoteLine = {
  itemKey: string; ref?: string; table?: string; label: string; variantLabel?: string; area?: string; base?: number; baseLabel?: string;
  cuantia?: { key: string; label: string; inSmmlv: number }; quantity: number; unit?: string; unitAmount: number; amount: number; range?: [number, number];
  breakdown: string[]; note?: string; success?: boolean; source?: string; warnings: string[];
};
export type QuoteResult = {
  smmlv: number; lines: QuoteLine[]; feesSubtotal: number; adjustPct: number; adjustAmount: number; discountPct: number; discountAmount: number; feesNet: number;
  ivaRate: number; ivaAmount: number; expenses: { label: string; amount: number }[]; expensesTotal: number; total: number;
  schedule: { label: string; amount: number }[]; success?: { pct: number; base: number; amount: number }; warnings: string[];
};

const usesBase = (f?: Formula) => !!f && (f.pct != null || !!f.tiers || !!f.above);
/** ¿La tarifa necesita un valor (cuantía, valor del contrato…) para calcularse? */
export const needsBase = (i: FeeItem) => !!i.byCuantia || usesBase(i.f) || (i.variants ?? []).some((v) => usesBase(v.f));

const n = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 2 });
/** Resumen corto de la fórmula para mostrar en la lista («2 SMMLV + 10 %»). */
export function formulaShort(i: FeeItem): string {
  if (i.byCuantia) return 'Según la cuantía';
  const f = i.f ?? {};
  const parts: string[] = [];
  if (f.smmlv) parts.push(`${n(f.smmlv)} SMMLV`);
  if (f.range) parts.push(`$${n(f.range[0] / 1000)} mil – $${n(f.range[1] / 1000)} mil`);
  if (f.pct != null) parts.push(`${n(f.pct)} %`);
  if (f.tiers) parts.push(`${n(f.tiers[0][1])} % por tramos`);
  if (f.above) parts.push(`+${n(f.above.pct)} % si supera`);
  return parts.join(' + ') || '—';
}

/** Gastos típicos sugeridos por tabla. */
export const EXPENSE_HINTS: Record<string, string[]> = {
  LEGAL: ['Notificaciones y envíos', 'Copias y autenticaciones', 'Póliza judicial', 'Honorarios de perito', 'Derechos notariales', 'Certificados (tradición, Cámara de Comercio)', 'Transporte a audiencias'],
  ACCOUNTING: ['Certificados y extractos', 'Firma digital'],
  ARCHITECTURE: ['Expensas de curaduría', 'Impuesto de delineación', 'Estudio de suelos', 'Levantamiento topográfico', 'Impresión de planos'],
  TECH_REPAIR: ['Repuesto', 'Envío'],
  HOME: ['Materiales', 'Transporte', 'Alquiler de equipos'],
};

export const ADJUST_PRESETS = [
  { label: 'Sencillo', pct: -20 }, { label: 'Normal', pct: 0 }, { label: 'Complejo', pct: 30 }, { label: 'Muy complejo', pct: 60 }, { label: 'Urgente', pct: 50 },
];
