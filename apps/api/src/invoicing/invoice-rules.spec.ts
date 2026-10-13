import { checkRequirements, computeCufe, nitDv, splitNit, warrantyUntil } from './invoice-rules';

describe('reglas de facturación', () => {
  it('calcula el dígito de verificación del NIT', () => {
    expect(nitDv('800197268')).toBe('4'); // DIAN
    expect(nitDv('890903938')).toBe('8');
    expect(splitNit('900.123.456')).toEqual({ number: '900123456', dv: nitDv('900123456') });
    expect(splitNit('800197268-4')).toEqual({ number: '800197268', dv: '4' });
  });

  it('calcula el CUFE con el ejemplo del anexo técnico de la DIAN', () => {
    const cufe = computeCufe({
      number: '323200000129', date: '2019-01-16', time: '10:53:10-05:00', subtotal: 1500000, iva: 285000, inc: 0, ica: 0, total: 1785000,
      sellerNit: '700085371', buyerId: '800199436', technicalKey: '693ff6f2a553c3646a063436fd4dd9ded0311471', environment: '1',
    });
    expect(cufe).toHaveLength(96);
    expect(cufe).toBe('8bb918b19ba22a694f1da11c643b5e9de39adf60311cf179179e9b33381030bcd4c3c3f156c506ed5908f9276f5bd9b4');
  });

  it('exige los datos del art. 617 E.T. para la factura', () => {
    const seller = { tradeName: 'Tienda', responsibilities: [] };
    const buyer = { name: '', idType: '13', idNumber: '', finalConsumer: false };
    const r = checkRequirements('ELECTRONIC', seller, buyer, { itemCount: 1, paymentForm: 'CREDITO', ivaTotal: 0, now: new Date(), resolution: null });
    expect(r.errors.join(' ')).toMatch(/NIT del vendedor/);
    expect(r.errors.join(' ')).toMatch(/resolución de numeración/);
    expect(r.errors.join(' ')).toMatch(/comprador/);
    expect(r.errors.join(' ')).toMatch(/vencimiento/);
    const ok = checkRequirements('INTERNAL', seller, buyer, { itemCount: 1, paymentForm: 'CONTADO', ivaTotal: 0, now: new Date() });
    expect(ok.errors).toHaveLength(0);
  });

  it('bloquea numeración vencida o agotada', () => {
    const seller = { tradeName: 'T', legalName: 'T SAS', nit: '900123456', dv: '8', regime: 'RESPONSABLE_IVA', responsibilities: [], address: 'Cra 1', city: 'Cali' };
    const buyer = { name: 'C', idType: '13', idNumber: '1', finalConsumer: false };
    const base = { itemCount: 1, paymentForm: 'CONTADO', ivaTotal: 0, now: new Date('2026-10-10T12:00:00Z') };
    expect(checkRequirements('CONTINGENCY', seller, buyer, { ...base, resolution: { validTo: '2026-01-01', toNumber: 100, nextNumber: 5 } }).errors[0]).toMatch(/vencida/);
    expect(checkRequirements('CONTINGENCY', seller, buyer, { ...base, resolution: { validTo: '2027-01-01', toNumber: 100, nextNumber: 101 } }).errors[0]).toMatch(/rango/);
    expect(checkRequirements('CONTINGENCY', seller, buyer, { ...base, resolution: { validTo: '2027-01-01', toNumber: 1000, nextNumber: 5 } }).errors).toHaveLength(0);
  });

  it('calcula el fin de la garantía', () => {
    expect(warrantyUntil(new Date('2026-01-15T12:00:00Z'), 12)?.toISOString().slice(0, 10)).toBe('2027-01-15');
    expect(warrantyUntil(new Date(), 0)).toBeNull();
  });
});
