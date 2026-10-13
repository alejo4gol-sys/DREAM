import Decimal from 'decimal.js';
import { CITY_FACTORS, Cuantia, FeeItem, FeeTable, Formula, LEVELS, MODS, ModKey } from './fee-types';
import { LEGAL_TABLE } from './table-legal';
import { ACCOUNTING_TABLE, ARCHITECTURE_TABLE, BEAUTY_TABLE, EDUCATION_TABLE, HEALTH_TABLE, HOME_TABLE, TECH_TABLE } from './table-market';

export const SMMLV_2026 = 1_750_905;
export const FEE_TABLES: FeeTable[] = [LEGAL_TABLE, ACCOUNTING_TABLE, ARCHITECTURE_TABLE, HEALTH_TABLE, BEAUTY_TABLE, TECH_TABLE, HOME_TABLE, EDUCATION_TABLE];
const ITEMS = new Map<string, { table: FeeTable; item: FeeItem }>();
for (const table of FEE_TABLES) for (const item of table.items) {
  if (ITEMS.has(item.key)) throw new Error(`Clave de tarifa repetida: ${item.key}`);
  ITEMS.set(item.key, { table, item });
}
export const findItem = (key: string) => ITEMS.get(key);

/** Tabla sugerida según el perfil de servicio del negocio. */
export const defaultTableFor = (profile?: string | null) =>
  ({ LEGAL: 'LEGAL', CONSULTING: 'ACCOUNTING', HEALTH: 'HEALTH', BEAUTY: 'BEAUTY', TECH_REPAIR: 'TECH_REPAIR', HOME: 'HOME', EDUCATION: 'EDUCATION' } as Record<string, string>)[profile ?? ''] ?? 'LEGAL';

const D = (v: Decimal.Value | null | undefined) => new Decimal(v ?? 0);
const peso = (v: Decimal) => v.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
const cop = (v: Decimal.Value) => '$' + Number(D(v).toDecimalPlaces(0)).toLocaleString('es-CO');
const pctTxt = (p: number) => `${p.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;

/** Cuantía según el art. 25 del Código General del Proceso. */
export function classifyCuantia(amount: Decimal.Value, smmlv: number): { key: Cuantia; label: string; inSmmlv: number } {
  const a = D(amount);
  const inSmmlv = Number(a.div(smmlv).toDecimalPlaces(2));
  if (a.lte(D(smmlv).mul(40))) return { key: 'MINIMA', label: 'Mínima cuantía (hasta 40 SMMLV)', inSmmlv };
  if (a.lte(D(smmlv).mul(150))) return { key: 'MENOR', label: 'Menor cuantía (más de 40 y hasta 150 SMMLV)', inSmmlv };
  return { key: 'MAYOR', label: 'Mayor cuantía (más de 150 SMMLV)', inSmmlv };
}

const usesBase = (f: Formula) => f.pct != null || !!f.tiers || !!f.above;

export interface FormulaResult { amount: Decimal; parts: string[]; range?: [number, number]; needsBase: boolean }

/** Aplica una fórmula: fijo en SMMLV o pesos + porcentajes sobre la base. */
export function applyFormula(f: Formula, base: Decimal | null, ctx: { smmlv: number; level?: string; city?: string }): FormulaResult {
  const parts: string[] = [];
  let total = D(0);
  let range: [number, number] | undefined;
  if (f.smmlv) {
    const v = D(f.smmlv).mul(ctx.smmlv);
    total = total.add(v);
    parts.push(`${f.smmlv.toLocaleString('es-CO')} SMMLV × ${cop(ctx.smmlv)} = ${cop(v)}`);
  }
  if (f.cop) { total = total.add(f.cop); parts.push(`Valor fijo ${cop(f.cop)}`); }
  if (f.range) {
    const city = CITY_FACTORS[ctx.city ?? 'BOGOTA'] ?? CITY_FACTORS.BOGOTA;
    const at = (LEVELS[ctx.level ?? 'MID'] ?? LEVELS.MID).at;
    const [lo, hi] = f.range;
    const v = peso(D(lo).add(D(hi - lo).mul(at)).mul(city.factor));
    range = [Number(peso(D(lo).mul(city.factor))), Number(peso(D(hi).mul(city.factor)))];
    total = total.add(v);
    parts.push(`Rango de mercado ${cop(lo)} – ${cop(hi)}${city.factor !== 1 ? ` × ${city.factor} (${city.label})` : ''} → ${cop(v)}`);
  }
  const needsBase = usesBase(f) && (base == null || base.lte(0));
  if (base && base.gt(0)) {
    if (f.pct != null) {
      const v = base.mul(f.pct).div(100);
      total = total.add(v);
      parts.push(`${pctTxt(f.pct)} de ${cop(base)} = ${cop(v)}`);
    }
    if (f.tiers) {
      let prev = D(0);
      for (const [upTo, p] of f.tiers) {
        if (base.lte(prev)) break;
        const top = upTo == null ? base : Decimal.min(base, upTo);
        const slice = top.sub(prev);
        if (slice.gt(0)) {
          const v = slice.mul(p).div(100);
          total = total.add(v);
          parts.push(`${pctTxt(p)} de ${cop(slice)} (${upTo == null ? `más de ${cop(prev)}` : `hasta ${cop(upTo)}`}) = ${cop(v)}`);
        }
        if (upTo == null) break;
        prev = D(upTo);
      }
      const last = f.tiers[f.tiers.length - 1];
      if (last[0] != null && base.gt(last[0])) parts.push(`La tabla no fija porcentaje sobre lo que exceda ${cop(last[0])}.`);
    }
    if (f.above) {
      const over = f.above.overSmmlv ? D(f.above.over).mul(ctx.smmlv) : D(f.above.over);
      if (base.gt(over)) {
        const on = f.above.excessOnly ? base.sub(over) : base;
        const v = on.mul(f.above.pct).div(100);
        total = total.add(v);
        parts.push(`${pctTxt(f.above.pct)} adicional porque supera ${cop(over)} = ${cop(v)}`);
      } else parts.push(`Sin adicional: no supera ${cop(over)}.`);
    }
  }
  if (f.minSmmlv) {
    const min = D(f.minSmmlv).mul(ctx.smmlv);
    if (total.lt(min)) { parts.push(`Se aplica el mínimo de ${f.minSmmlv} SMMLV = ${cop(min)}`); total = min; }
  }
  return { amount: peso(total), parts, range, needsBase };
}

export interface LineInput { itemKey: string; variant?: string; base?: string; quantity?: string; mods?: string[]; label?: string; amount?: string }
export interface QuoteInput {
  lines: LineInput[];
  expenses?: { label: string; amount: string }[];
  level?: string; city?: string;
  adjustPct?: number; discountPct?: number;
  iva?: boolean; ivaRate?: number;
  advancePct?: number; installments?: number;
  successPct?: number; successBase?: string;
}
export interface QuoteLine {
  itemKey: string; ref?: string; table?: string; label: string; variantLabel?: string; area?: string;
  base?: number; baseLabel?: string; cuantia?: { key: Cuantia; label: string; inSmmlv: number };
  quantity: number; unit?: string; unitAmount: number; amount: number; range?: [number, number];
  breakdown: string[]; note?: string; success?: boolean; source?: string; warnings: string[];
}
export interface QuoteResult {
  smmlv: number; lines: QuoteLine[];
  feesSubtotal: number; adjustPct: number; adjustAmount: number; discountPct: number; discountAmount: number; feesNet: number;
  ivaRate: number; ivaAmount: number; expenses: { label: string; amount: number }[]; expensesTotal: number; total: number;
  schedule: { label: string; amount: number }[]; success?: { pct: number; base: number; amount: number };
  warnings: string[];
}

const MONEY_RE = /^\d{1,13}(\.\d{1,2})?$/;
const money = (v?: string | null) => (v && MONEY_RE.test(v) ? D(v) : null);

export function calculateLine(l: LineInput, ctx: { smmlv: number; level?: string; city?: string }): QuoteLine {
  const qty = Math.max(0.01, Math.min(9999, Number(l.quantity ?? 1) || 1));
  if (l.itemKey === 'CUSTOM') {
    const unit = peso(money(l.amount) ?? D(0));
    const label = (l.label ?? '').trim().slice(0, 200) || 'Concepto propio';
    return { itemKey: 'CUSTOM', label, quantity: qty, unitAmount: Number(unit), amount: Number(peso(unit.mul(qty))), breakdown: ['Valor definido por ti'], warnings: unit.lte(0) ? ['Escribe el valor de este concepto.'] : [] };
  }
  const found = findItem(l.itemKey);
  if (!found) return { itemKey: l.itemKey, label: 'Tarifa no encontrada', quantity: qty, unitAmount: 0, amount: 0, breakdown: [], warnings: ['Esta tarifa ya no existe en la tabla. Quítala y vuelve a elegirla.'] };
  const { item, table } = found;
  const warnings: string[] = [];
  const base = money(l.base);
  const variant = item.variants?.find((v) => v.key === l.variant);
  let f: Formula = variant?.f ?? item.f ?? {};
  let cuantia: QuoteLine['cuantia'];
  if (item.byCuantia && !variant) {
    if (base && base.gt(0)) {
      cuantia = classifyCuantia(base, ctx.smmlv);
      f = item.byCuantia[cuantia.key] ?? {};
    } else { warnings.push(`Escribe ${(item.base ?? 'la cuantía').toLowerCase()} para clasificar la cuantía y calcular.`); f = {}; }
  }
  const r = applyFormula(f, base, ctx);
  if (r.needsBase && !item.byCuantia) warnings.push(`Escribe ${(item.base ?? 'el valor base').toLowerCase()} para calcular la parte porcentual.`);
  let amount = r.amount;
  const breakdown = [...(cuantia ? [`${cuantia.label}: ${cuantia.inSmmlv.toLocaleString('es-CO')} SMMLV`] : []), ...r.parts];
  for (const m of (l.mods ?? []) as ModKey[]) {
    if (!item.mods?.includes(m)) continue;
    const mod = MODS[m];
    if (mod.factor != null) { amount = peso(amount.mul(mod.factor)); breakdown.push(`${mod.label}: × ${mod.factor.toLocaleString('es-CO')} = ${cop(amount)}`); }
    if (mod.addPct) { const add = peso(amount.mul(mod.addPct).div(100)); amount = amount.add(add); breakdown.push(`${mod.label}: + ${cop(add)}`); }
  }
  if (item.success) warnings.push('Este honorario depende del resultado: el valor es un estimado sobre lo que escribiste.');
  return {
    itemKey: item.key, ref: item.ref, table: table.key, label: item.label, variantLabel: variant?.label, area: item.area,
    base: base ? Number(base) : undefined, baseLabel: item.base, cuantia,
    quantity: qty, unit: item.unit, unitAmount: Number(amount), amount: Number(peso(amount.mul(qty))), range: r.range,
    breakdown, note: variant?.note ?? item.note, success: item.success, source: item.source ?? table.sources[0]?.key, warnings,
  };
}

export function calculateQuote(input: QuoteInput, smmlv: number): QuoteResult {
  const ctx = { smmlv, level: input.level, city: input.city };
  const lines = (input.lines ?? []).slice(0, 40).map((l) => calculateLine(l, ctx));
  const sub = lines.reduce((a, l) => a.add(l.amount), D(0));
  const adjustPct = Math.max(-50, Math.min(200, Number(input.adjustPct ?? 0) || 0));
  const discountPct = Math.max(0, Math.min(100, Number(input.discountPct ?? 0) || 0));
  const adjust = peso(sub.mul(adjustPct).div(100));
  const discount = peso(sub.add(adjust).mul(discountPct).div(100));
  const net = sub.add(adjust).sub(discount);
  const ivaRate = input.iva ? Math.max(0, Math.min(30, Number(input.ivaRate ?? 19))) : 0;
  const iva = peso(net.mul(ivaRate).div(100));
  const expenses = (input.expenses ?? []).slice(0, 20).map((e) => ({ label: (e.label ?? '').trim().slice(0, 120) || 'Gasto', amount: Number(peso(money(e.amount) ?? D(0))) })).filter((e) => e.amount > 0);
  const expTotal = expenses.reduce((a, e) => a.add(e.amount), D(0));
  const total = net.add(iva).add(expTotal);

  const schedule: QuoteResult['schedule'] = [];
  const feesWithIva = net.add(iva);
  const advancePct = Math.max(0, Math.min(100, Number(input.advancePct ?? 0) || 0));
  const n = Math.max(1, Math.min(24, Math.floor(Number(input.installments ?? 1) || 1)));
  if (feesWithIva.gt(0)) {
    const advance = peso(feesWithIva.mul(advancePct).div(100));
    if (advance.gt(0)) schedule.push({ label: `Anticipo (${advancePct} %) al firmar el contrato`, amount: Number(advance) });
    const rest = feesWithIva.sub(advance);
    if (rest.gt(0)) {
      const each = peso(rest.div(n));
      for (let i = 1; i <= n; i++) {
        const amt = i === n ? rest.sub(each.mul(n - 1)) : each;
        schedule.push({ label: n === 1 ? (advance.gt(0) ? 'Saldo al terminar' : 'Pago único') : `Cuota ${i} de ${n}`, amount: Number(amt) });
      }
    }
    if (expTotal.gt(0)) schedule.push({ label: 'Gastos del trámite (se pagan aparte, contra soporte)', amount: Number(expTotal) });
  }
  let success: QuoteResult['success'];
  const sPct = Math.max(0, Math.min(50, Number(input.successPct ?? 0) || 0));
  const sBase = money(input.successBase);
  if (sPct > 0 && sBase && sBase.gt(0)) success = { pct: sPct, base: Number(sBase), amount: Number(peso(sBase.mul(sPct).div(100))) };

  const warnings = lines.flatMap((l) => l.warnings.map((w) => `${l.label}: ${w}`));
  return {
    smmlv, lines, feesSubtotal: Number(sub), adjustPct, adjustAmount: Number(adjust), discountPct, discountAmount: Number(discount), feesNet: Number(net),
    ivaRate, ivaAmount: Number(iva), expenses, expensesTotal: Number(expTotal), total: Number(total), schedule, success, warnings,
  };
}
