import { computeSale, paymentStatus } from './sale-calculator';

describe('computeSale', () => {
  it('calcula una venta simple sin impuestos', () => {
    const r = computeSale([{ quantity: 2, unitPrice: '50000', unitCost: '30000' }]);
    expect(r.subtotal).toBe('100000.00');
    expect(r.total).toBe('100000.00');
    expect(r.costTotal).toBe('60000.00');
  });

  it('aplica descuento de línea e IVA sobre la base neta', () => {
    const r = computeSale([{ quantity: 1, unitPrice: '100000', unitCost: '60000', discount: '10000', taxRate: '19' }]);
    expect(r.discountTotal).toBe('10000.00');
    expect(r.taxTotal).toBe('17100.00');
    expect(r.total).toBe('107100.00');
  });

  it('reparte el descuento global sin perder centavos', () => {
    const r = computeSale([
      { quantity: 1, unitPrice: '33333.33', unitCost: '1' },
      { quantity: 1, unitPrice: '33333.33', unitCost: '1' },
      { quantity: 1, unitPrice: '33333.34', unitCost: '1' },
    ], '10000');
    expect(r.discountTotal).toBe('10000.00');
    expect(r.total).toBe('90000.00');
  });

  it('rechaza descuentos mayores al valor', () => {
    expect(() => computeSale([{ quantity: 1, unitPrice: '1000', unitCost: '0' }], '2000')).toThrow();
    expect(() => computeSale([{ quantity: 1, unitPrice: '1000', unitCost: '0', discount: '1001' }])).toThrow();
  });

  it('rechaza cantidades inválidas', () => {
    expect(() => computeSale([{ quantity: 0, unitPrice: '1', unitCost: '0' }])).toThrow();
    expect(() => computeSale([{ quantity: 1.5, unitPrice: '1', unitCost: '0' }])).toThrow();
  });
});

describe('paymentStatus', () => {
  it('determina el estado según lo pagado', () => {
    expect(paymentStatus('100', '0')).toBe('PENDING');
    expect(paymentStatus('100', '40')).toBe('PARTIALLY_PAID');
    expect(paymentStatus('100', '100')).toBe('PAID');
  });
});
