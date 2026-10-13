import { D, Decimal, m2 } from '../common/money';

export interface LineInput {
  quantity: number;
  unitPrice: Decimal.Value;
  unitCost: Decimal.Value;
  discount?: Decimal.Value; // descuento en valor de la línea
  taxRate?: Decimal.Value; // % (ej. 19)
}

export interface LineResult {
  gross: string; discount: string; net: string; tax: string; total: string; cost: string;
}

export interface SaleTotals {
  lines: LineResult[];
  subtotal: string; discountTotal: string; taxTotal: string; total: string; costTotal: string;
}

/**
 * Calcula totales de una venta. Precios antes de impuestos.
 * El descuento global se reparte proporcionalmente entre las líneas (afecta la base del impuesto).
 */
export function computeSale(lines: LineInput[], globalDiscount: Decimal.Value = 0): SaleTotals {
  if (!lines.length) throw new Error('La venta debe tener al menos un producto');
  const pre = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new Error('Cantidad inválida');
    const gross = D(l.unitPrice).times(l.quantity);
    const lineDiscount = D(l.discount ?? 0);
    if (lineDiscount.lt(0) || lineDiscount.gt(gross)) throw new Error('Descuento de línea inválido');
    return { gross, lineDiscount, net: gross.minus(lineDiscount), l };
  });

  const netSum = pre.reduce((a, p) => a.plus(p.net), D(0));
  const global = D(globalDiscount);
  if (global.lt(0) || global.gt(netSum)) throw new Error('El descuento no puede superar el valor de la venta');

  // Reparto proporcional con redondeo a centavos; el residuo va a la última línea con valor
  let allocated = D(0);
  const lastIdx = pre.map((p) => p.net.gt(0)).lastIndexOf(true);
  const shares = pre.map((p, i) => {
    if (global.isZero() || netSum.isZero()) return D(0);
    if (i === lastIdx) return global.minus(allocated);
    const s = global.times(p.net).div(netSum).toDecimalPlaces(2);
    allocated = allocated.plus(s);
    return s;
  });

  const results: LineResult[] = pre.map((p, i) => {
    const discount = p.lineDiscount.plus(shares[i]);
    const net = p.gross.minus(discount);
    const tax = net.times(D(p.l.taxRate ?? 0)).div(100).toDecimalPlaces(2);
    return {
      gross: m2(p.gross), discount: m2(discount), net: m2(net), tax: m2(tax),
      total: m2(net.plus(tax)), cost: m2(D(p.l.unitCost).times(p.l.quantity)),
    };
  });

  const sum = (k: keyof LineResult) => m2(results.reduce((a, r) => a.plus(r[k]), D(0)));
  return {
    lines: results,
    subtotal: sum('gross'), discountTotal: sum('discount'), taxTotal: sum('tax'), total: sum('total'), costTotal: sum('cost'),
  };
}

export function paymentStatus(total: Decimal.Value, paid: Decimal.Value): 'PENDING' | 'PARTIALLY_PAID' | 'PAID' {
  if (D(paid).gte(total)) return 'PAID';
  if (D(paid).gt(0)) return 'PARTIALLY_PAID';
  return 'PENDING';
}
