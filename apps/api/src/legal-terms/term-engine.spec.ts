import { computeTerm, holidays } from './term-engine';
import { TERM_RULES } from './term-rules';

describe('cómputo de términos', () => {
  it('festivos de Colombia 2026', () => {
    expect([...holidays(2026).keys()].sort()).toEqual([
      '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
      '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25',
    ]);
  });

  it('nulidad y restablecimiento: 4 meses desde el día siguiente (mismo número)', () => {
    const r = computeTerm({ ruleKey: 'CA_NRD', eventDate: '2026-01-10' });
    expect(r.firstDay).toBe('2026-01-11');
    expect(r.dueDate).toBe('2026-05-11');
  });

  it('reparación directa con suspensión por conciliación', () => {
    expect(computeTerm({ ruleKey: 'CA_REPARACION', eventDate: '2024-03-05' }).dueDate).toBe('2026-03-06');
    const r = computeTerm({ ruleKey: 'CA_REPARACION', eventDate: '2024-03-05', suspensions: [{ from: '2025-01-10', to: '2025-02-20' }] });
    expect(r.dueDate).toBe('2026-04-17');
  });

  it('si vence en vacancia judicial se corre al primer día hábil', () => {
    const r = computeTerm({ ruleKey: 'CA_NRD', eventDate: '2026-08-24' });
    expect(r.dueDate).toBe('2027-01-12');
    const sinVacancia = computeTerm({ ruleKey: 'CA_NRD', eventDate: '2026-08-24', vacation: false });
    expect(sinVacancia.dueDate).toBe('2026-12-28');
  });

  it('días hábiles: renuencia de 10 días', () => {
    // Radicada el viernes 2026-03-20; el lunes 23 es festivo y el 2 y 3 de abril son Jueves y Viernes Santo. No es término judicial.
    expect(computeTerm({ ruleKey: 'CUMPLIMIENTO_RENUENCIA', eventDate: '2026-03-20' }).dueDate).toBe('2026-04-08');
    expect(computeTerm({ ruleKey: 'CA_ELECTORAL', eventDate: '2026-03-20' }).dueDate).toBe('2026-05-12');
  });

  it('prescripción penal: máximo de la pena, servidor público e imputación', () => {
    expect(computeTerm({ ruleKey: 'PENAL_ACCION', eventDate: '2020-06-01', penal: { maxPenaltyYears: 8 } }).dueDate).toBe('2028-06-01');
    expect(computeTerm({ ruleKey: 'PENAL_ACCION', eventDate: '2020-06-01', penal: { maxPenaltyYears: 3 } }).dueDate).toBe('2025-06-01');
    expect(computeTerm({ ruleKey: 'PENAL_ACCION', eventDate: '2020-06-01', penal: { maxPenaltyYears: 8, publicServant: true } }).dueDate).toBe('2031-02-01');
    expect(computeTerm({ ruleKey: 'PENAL_ACCION', eventDate: '2020-06-01', interruptionDate: '2022-03-15', penal: { maxPenaltyYears: 8 } }).dueDate).toBe('2026-03-15');
    expect(computeTerm({ ruleKey: 'PENAL_ACCION', eventDate: '2020-06-01', penal: { imprescriptible: true } }).status).toBe('IMPRESCRIPTIBLE');
  });

  it('laboral: el reclamo escrito interrumpe y vuelve a correr completo', () => {
    expect(computeTerm({ ruleKey: 'LAB_GENERAL', eventDate: '2023-02-01', interruptionDate: '2025-01-20' }).dueDate).toBe('2028-01-21');
  });

  it('contrato no liquidado: 6 meses de liquidación + 2 años', () => {
    expect(computeTerm({ ruleKey: 'CA_CONTRACTUAL_SIN_LIQ', eventDate: '2024-01-31' }).dueDate).toBe('2026-08-03');
  });

  it('todos los términos calculan', () => {
    for (const r of TERM_RULES) {
      const x = computeTerm({ ruleKey: r.key, eventDate: '2025-05-15', penal: { maxPenaltyYears: 10 } });
      expect(['DATE', 'NO_TERM', 'IMPRESCRIPTIBLE']).toContain(x.status);
    }
  });
});
