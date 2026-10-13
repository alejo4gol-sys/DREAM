import { calculateQuote, classifyCuantia, FEE_TABLES, SMMLV_2026 } from './fee-engine';

const S = SMMLV_2026;
const one = (itemKey: string, extra: Record<string, unknown> = {}) => calculateQuote({ lines: [{ itemKey, ...extra }] }, S).lines[0];

describe('calculadora de honorarios', () => {
  it('clasifica la cuantía según el CGP art. 25', () => {
    expect(classifyCuantia(40 * S, S).key).toBe('MINIMA');
    expect(classifyCuantia(40 * S + 1, S).key).toBe('MENOR');
    expect(classifyCuantia(150 * S, S).key).toBe('MENOR');
    expect(classifyCuantia(150 * S + 1, S).key).toBe('MAYOR');
  });

  it('consulta verbal = 0,5 SMMLV ($875.453)', () => {
    expect(one('L1').amount).toBe(875453);
  });

  it('divorcio: 5 SMMLV; mutuo acuerdo 3; ante notaría 50 %', () => {
    expect(one('L12.4').amount).toBe(8754525);
    expect(one('L12.4', { variant: 'MUTUO' }).amount).toBe(5252715);
    expect(one('L12.4', { variant: 'MUTUO', mods: ['NOTARIA'] }).amount).toBe(2626358);
  });

  it('ejecutivo singular según la cuantía', () => {
    // $20.000.000 ≈ 11,4 SMMLV → mínima: 1 SMMLV + 15 %
    expect(one('L9.1', { base: '20000000' }).amount).toBe(1750905 + 3000000);
    // $100.000.000 ≈ 57 SMMLV → menor: 2 SMMLV + 10 %
    expect(one('L9.1', { base: '100000000' }).amount).toBe(3501810 + 10000000);
    // $400.000.000 → mayor: 4 SMMLV + 8 %
    expect(one('L9.1', { base: '400000000' }).amount).toBe(7003620 + 32000000);
    expect(one('L9.1').warnings.length).toBeGreaterThan(0);
  });

  it('sucesión por tramos marginales y medidas +10 %', () => {
    // 15 % de 1M + 10 % de 4M + 5 % de 45M + 4 % de 50M + 3 % de 100M
    const base = 150_000 + 400_000 + 2_250_000 + 2_000_000 + 3_000_000;
    expect(one('L10.1.1', { base: '200000000' }).amount).toBe(base);
    expect(one('L10.1.1', { base: '200000000', mods: ['MEDIDAS'] }).amount).toBe(Math.round(base * 1.1));
    expect(one('L10.1.1', { base: '200000000', mods: ['NOTARIA'] }).amount).toBe(base / 2);
  });

  it('adicional cuando supera el umbral', () => {
    expect(one('L1.2', { base: '50000000' }).amount).toBe(3501810);
    expect(one('L1.2', { base: '100000000' }).amount).toBe(3501810 + 2000000);
  });

  it('ignora modificadores que no aplican al trámite', () => {
    expect(one('L1', { mods: ['NOTARIA'] }).amount).toBe(875453);
  });

  it('rangos de mercado por nivel y ciudad', () => {
    expect(calculateQuote({ lines: [{ itemKey: 'T-BAT' }], level: 'MID', city: 'BOGOTA' }, S).lines[0].amount).toBe(130000);
    expect(calculateQuote({ lines: [{ itemKey: 'T-BAT' }], level: 'HIGH', city: 'CALI' }, S).lines[0].amount).toBe(166000);
  });

  it('totales: ajuste, descuento, IVA, gastos y plan de pagos', () => {
    const r = calculateQuote({
      lines: [{ itemKey: 'L1.1' }, { itemKey: 'CUSTOM', label: 'Audiencia adicional', amount: '249095' }],
      adjustPct: 20, discountPct: 10, iva: true, ivaRate: 19, expenses: [{ label: 'Notificaciones', amount: '50000' }],
      advancePct: 50, installments: 2, successPct: 10, successBase: '30000000',
    }, S);
    expect(r.feesSubtotal).toBe(2000000);
    expect(r.adjustAmount).toBe(400000);
    expect(r.discountAmount).toBe(240000);
    expect(r.feesNet).toBe(2160000);
    expect(r.ivaAmount).toBe(410400);
    expect(r.total).toBe(2160000 + 410400 + 50000);
    const fees = r.schedule.filter((s) => !s.label.startsWith('Gastos')).reduce((a, s) => a + s.amount, 0);
    expect(fees).toBe(2160000 + 410400);
    expect(r.schedule).toHaveLength(4);
    expect(r.success?.amount).toBe(3000000);
  });

  it('todas las tarifas calculan sin errores', () => {
    for (const t of FEE_TABLES) for (const i of t.items) {
      const l = one(i.key, { base: '100000000' });
      expect(Number.isFinite(l.amount)).toBe(true);
      expect(l.amount).toBeGreaterThanOrEqual(0);
      for (const v of i.variants ?? []) expect(Number.isFinite(one(i.key, { base: '100000000', variant: v.key }).amount)).toBe(true);
    }
  });
});
