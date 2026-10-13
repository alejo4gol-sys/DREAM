import { parseAmount, parseCsv, parseDate, scoreMatch } from './reconciliation';

describe('scoreMatch', () => {
  it('puntúa alto un monto exacto el mismo día por transferencia', () => {
    expect(scoreMatch({ amountMatches: 'total', daysApart: 0, method: 'BANK_TRANSFER' })).toBe(95);
  });
  it('no sugiere si el monto no coincide o pasan más de 5 días', () => {
    expect(scoreMatch({ amountMatches: 'none', daysApart: 0 })).toBe(0);
    expect(scoreMatch({ amountMatches: 'total', daysApart: 6 })).toBe(0);
  });
  it('baja el puntaje con la distancia en días', () => {
    expect(scoreMatch({ amountMatches: 'total', daysApart: 3 })).toBeLessThan(scoreMatch({ amountMatches: 'total', daysApart: 1 }));
  });
});

describe('parsers CSV', () => {
  it('lee CSV con ; y comillas', () => {
    expect(parseCsv('fecha;descripcion;valor\n2026-10-01;"Pago, Nequi";100000\n')).toEqual([
      ['fecha', 'descripcion', 'valor'], ['2026-10-01', 'Pago, Nequi', '100000'],
    ]);
  });
  it('interpreta montos en formato colombiano', () => {
    expect(parseAmount('1.234.567,89')).toBe('1234567.89');
    expect(parseAmount('$ 100.000')).toBe('100000');
    expect(parseAmount('-150000')).toBe('-150000');
    expect(parseAmount('2500.50')).toBe('2500.50');
    expect(parseAmount('abc')).toBeNull();
  });
  it('interpreta fechas', () => {
    expect(parseDate('05/10/2026')?.toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(parseDate('2026-10-05')?.toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(parseDate('ayer')).toBeNull();
  });
});
