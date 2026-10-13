import { createHash } from 'node:crypto';

/**
 * Reglas de facturación en Colombia que usa DREAMS.
 *
 * Fuentes:
 *  - Estatuto Tributario art. 617 (requisitos de la factura de venta) y art. 616-1 (sistemas de facturación).
 *  - Resolución DIAN 000165 de 2023, art. 11 (requisitos de la factura electrónica de venta) y anexo técnico.
 *  - Código de Comercio arts. 772 a 774 (factura como título valor; Leyes 1231 de 2008 y 1676 de 2013).
 *  - Ley 1480 de 2011, art. 8 (término de la garantía legal).
 */

/** Tipos de documento que DREAMS puede expedir. */
export const DOC_TYPES = {
  ELECTRONIC: { label: 'Factura electrónica de venta', short: 'Factura electrónica' },
  CONTINGENCY: { label: 'Factura de venta (talonario por contingencia)', short: 'Factura de talonario' },
  INTERNAL: { label: 'Comprobante de venta', short: 'Comprobante' },
} as const;
export type DocType = keyof typeof DOC_TYPES;

/** Tipos de identificación (códigos de la tabla 13.2.1 del anexo técnico de la DIAN). */
export const ID_TYPES: Record<string, string> = {
  '13': 'Cédula de ciudadanía', '31': 'NIT', '22': 'Cédula de extranjería', '41': 'Pasaporte', '12': 'Tarjeta de identidad',
  '11': 'Registro civil', '42': 'Documento de identificación extranjero', '47': 'PEP', '48': 'PPT', '50': 'NIT de otro país',
};

/** Medios de pago (códigos de la tabla 13.3.4.2 del anexo técnico). */
export const PAYMENT_MEANS: Record<string, { label: string; code: string }> = {
  CASH: { label: 'Efectivo', code: '10' },
  BANK_TRANSFER: { label: 'Transferencia bancaria', code: '47' },
  DEBIT_CARD: { label: 'Tarjeta débito', code: '49' },
  CREDIT_CARD: { label: 'Tarjeta crédito', code: '48' },
  PSE: { label: 'PSE (transferencia)', code: '47' },
  NEQUI: { label: 'Nequi (transferencia)', code: '47' },
  DAVIPLATA: { label: 'Daviplata (transferencia)', code: '47' },
  OTHER: { label: 'Otro', code: 'ZZZ' },
};

/** Régimen frente al IVA del vendedor. */
export const REGIMES: Record<string, string> = {
  RESPONSABLE_IVA: 'Responsable de IVA',
  NO_RESPONSABLE: 'No responsable de IVA',
  SIMPLE: 'Régimen Simple de Tributación',
};

/** Responsabilidades fiscales que deben indicarse en la factura (art. 11 num. 12, Res. 165 de 2023). */
export const RESPONSIBILITIES: Record<string, string> = {
  'O-13': 'Gran contribuyente',
  'O-15': 'Autorretenedor',
  'O-23': 'Agente de retención en el impuesto sobre las ventas',
  'O-47': 'Régimen simple de tributación',
  'R-99-PN': 'No aplica – Otros',
};

/** Consumidor final cuando el comprador no se identifica (art. 11 num. 3.3, Res. 165 de 2023). */
export const FINAL_CONSUMER_ID = '222222222222';

/** Dígito de verificación del NIT (algoritmo de la DIAN, módulo 11). */
export function nitDv(nit: string): string {
  const digits = nit.replace(/\D/g, '');
  if (!digits) return '';
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length && i < weights.length; i++) sum += Number(rev[i]) * weights[i];
  const r = sum % 11;
  return String(r > 1 ? 11 - r : r);
}

/** Separa «900123456-7» en número y DV. Si no trae DV, lo calcula. */
export function splitNit(raw?: string | null): { number: string; dv: string } {
  const s = String(raw ?? '').trim();
  const m = s.match(/^([\d.\s]+)(?:-(\d))?$/);
  if (!m) return { number: s.replace(/\D/g, ''), dv: '' };
  const number = m[1].replace(/\D/g, '');
  return { number, dv: m[2] ?? nitDv(number) };
}

const f2 = (v: number | string) => Number(v).toFixed(2);

/**
 * CUFE (Código Único de Factura Electrónica) según el anexo técnico de la DIAN:
 * SHA-384 de NumFac + FecFac + HorFac + ValFac + 01 + ValImp1 + 04 + ValImp2 + 03 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmbiente.
 */
export function computeCufe(p: {
  number: string; date: string; time: string; subtotal: number | string; iva: number | string; inc?: number | string; ica?: number | string;
  total: number | string; sellerNit: string; buyerId: string; technicalKey: string; environment: '1' | '2';
}): string {
  const s = `${p.number}${p.date}${p.time}${f2(p.subtotal)}01${f2(p.iva)}04${f2(p.inc ?? 0)}03${f2(p.ica ?? 0)}${f2(p.total)}${p.sellerNit}${p.buyerId}${p.technicalKey}${p.environment}`;
  return createHash('sha384').update(s, 'utf8').digest('hex');
}

/** Dirección de consulta de la factura en la DIAN (va en el código QR). */
export const dianQrUrl = (cufe: string, environment: '1' | '2' = '1') =>
  environment === '1' ? `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}` : `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${cufe}`;

/** Fecha y hora en Colombia (UTC−5) en el formato del anexo técnico. */
export function bogotaParts(d: Date) {
  const t = new Date(d.getTime() - 5 * 3600_000);
  const iso = t.toISOString();
  return { date: iso.slice(0, 10), time: `${iso.slice(11, 19)}-05:00` };
}

export interface SellerSnapshot {
  tradeName: string; legalName?: string | null; nit?: string | null; dv?: string | null; personType?: string; regime?: string;
  responsibilities: string[]; address?: string | null; city?: string | null; phone?: string | null; email?: string | null;
  ciiu?: string | null; logoUrl?: string | null;
}
export interface BuyerSnapshot {
  name: string; idType: string; idNumber: string; dv?: string | null; address?: string | null; city?: string | null;
  email?: string | null; phone?: string | null; finalConsumer: boolean;
}

/** Revisa los datos obligatorios antes de expedir. Devuelve errores (bloquean) y avisos. */
export function checkRequirements(type: DocType, seller: SellerSnapshot, buyer: BuyerSnapshot, ctx: {
  itemCount: number; paymentForm: string; dueDate?: Date | null; resolution?: { validTo?: string | null; validFrom?: string | null; toNumber: number; nextNumber: number } | null;
  ivaTotal: number; now: Date;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!ctx.itemCount) errors.push('La venta no tiene productos o servicios.');
  if (type === 'INTERNAL') {
    if (!seller.nit) warnings.push('Agrega tu NIT o cédula en Configuración para que aparezca en el comprobante.');
    if (ctx.ivaTotal > 0 && seller.regime === 'NO_RESPONSABLE') warnings.push('La venta tiene IVA pero tu negocio está como «no responsable de IVA». Revisa tus productos o tu régimen.');
    return { errors, warnings };
  }
  // Art. 617 E.T. y art. 11 Res. 165 de 2023
  if (!(seller.legalName || seller.tradeName)) errors.push('Falta el nombre o razón social del vendedor.');
  if (!seller.nit) errors.push('Falta el NIT del vendedor (Configuración → Facturación).');
  if (!seller.address || !seller.city) errors.push('Falta la dirección y ciudad del vendedor.');
  if (!seller.regime) errors.push('Indica tu régimen frente al IVA en Configuración → Facturación.');
  if (!ctx.resolution) errors.push(type === 'ELECTRONIC' ? 'Registra la resolución de numeración de facturación electrónica que te autorizó la DIAN.' : 'Registra la numeración autorizada para facturas de talonario.');
  else {
    if (ctx.resolution.nextNumber > ctx.resolution.toNumber) errors.push('Se acabó el rango de numeración autorizado. Solicita una nueva numeración a la DIAN y regístrala.');
    const today = ctx.now.toISOString().slice(0, 10);
    if (ctx.resolution.validTo && today > ctx.resolution.validTo) errors.push('La autorización de numeración está vencida. Regístrala de nuevo con la nueva vigencia.');
    if (ctx.resolution.validFrom && today < ctx.resolution.validFrom) errors.push('La autorización de numeración aún no está vigente.');
    else if (ctx.resolution.toNumber - ctx.resolution.nextNumber < 20) warnings.push(`Quedan ${Math.max(0, ctx.resolution.toNumber - ctx.resolution.nextNumber + 1)} números en tu rango autorizado.`);
  }
  if (!buyer.finalConsumer && (!buyer.idNumber || !buyer.name)) errors.push('Escribe el nombre y el número de identificación del comprador, o marca «consumidor final».');
  if (buyer.idType === '31' && buyer.idNumber && !buyer.dv) warnings.push('El NIT del comprador no tiene dígito de verificación.');
  if (ctx.paymentForm === 'CREDITO' && !ctx.dueDate) errors.push('Para una venta a crédito indica la fecha de vencimiento.');
  if (type === 'ELECTRONIC' && !buyer.email && !buyer.finalConsumer) warnings.push('Sin correo del comprador: tendrás que entregarle la factura electrónica por otro medio.');
  if (ctx.ivaTotal > 0 && seller.regime === 'NO_RESPONSABLE') errors.push('La venta tiene IVA pero tu negocio está como «no responsable de IVA».');
  return { errors, warnings };
}

/** Texto de la autorización de numeración que debe aparecer en la factura. */
export function resolutionText(r: { resolutionNumber: string; resolutionDate: string; prefix?: string | null; fromNumber: number; toNumber: number; validTo?: string | null }, electronic: boolean) {
  return `${electronic ? 'Autorización de numeración de facturación electrónica' : 'Autorización de numeración de facturación'} DIAN No. ${r.resolutionNumber} del ${r.resolutionDate}` +
    `${r.prefix ? `, prefijo ${r.prefix}` : ''}, del ${r.fromNumber} al ${r.toNumber}${r.validTo ? `, vigente hasta ${r.validTo}` : ''}.`;
}

/** Garantía hasta: fecha de expedición + meses. */
export function warrantyUntil(issue: Date, months: number): Date | null {
  if (!months || months <= 0) return null;
  const d = new Date(issue);
  d.setMonth(d.getMonth() + months);
  return d;
}

export const LEGAL_WARRANTY_NOTE = 'Garantía legal (Ley 1480 de 2011, art. 8): corre desde la entrega. Si no se indica término, es de un año para productos nuevos, tres meses para productos usados y tres meses para servicios de reparación. Conserve este documento para hacer efectiva la garantía.';
export const TITLE_VALUE_NOTE = 'Esta factura de venta es un título valor (arts. 772 a 774 del Código de Comercio, modificados por las Leyes 1231 de 2008 y 1676 de 2013). La aceptación se entiende producida si no se reclama dentro de los tres días hábiles siguientes a su recepción.';
