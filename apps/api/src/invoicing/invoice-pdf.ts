import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { config } from '../config';
import type { InvoiceTemplate } from '../db/schema';
import { BuyerSnapshot, DOC_TYPES, DocType, ID_TYPES, LEGAL_WARRANTY_NOTE, PAYMENT_MEANS, REGIMES, RESPONSIBILITIES, SellerSnapshot, TITLE_VALUE_NOTE, dianQrUrl } from './invoice-rules';

export interface InvoiceItem { code?: string | null; description: string; quantity: number; unit?: string; unitPrice: number; discount: number; taxRate: number; tax: number; total: number; base: number }
export interface InvoiceForPdf {
  kind: string; docType: DocType; fullNumber: string; issuedAt: Date; dueDate?: Date | null; paymentForm: string; paymentMeans?: string | null;
  seller: SellerSnapshot; buyer: BuyerSnapshot; items: InvoiceItem[]; taxes: { rate: number; base: number; tax: number }[];
  subtotal: number; discountTotal: number; taxTotal: number; total: number; amountPaid: number; notes?: string | null;
  warrantyMonths: number; warrantyUntil?: Date | null; warrantyText?: string | null; template: InvoiceTemplate; resolutionText?: string | null;
  status: string; voidReason?: string | null; relatedNumber?: string | null; dianStatus: string; cufe?: string | null; dianEnvironment?: string | null;
  dianValidatedAt?: Date | null; dianProvider?: string | null; integrityHash: string;
}

const cop = (v: number) => '$ ' + Math.round(v).toLocaleString('es-CO');
const day = (d?: Date | null) => (d ? new Date(d).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const dayTime = (d: Date) => new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Busca el logo en el almacenamiento local. PDFKit solo admite PNG y JPG. */
function loadLogo(url?: string | null): Buffer | null {
  if (!url || !url.startsWith('/uploads/')) return null;
  const rel = url.slice('/uploads/'.length);
  if (rel.includes('..')) return null;
  const file = path.resolve(config.uploadDir, rel);
  if (!file.startsWith(path.resolve(config.uploadDir)) || !existsSync(file)) return null;
  const buf = readFileSync(file);
  const png = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  return png || jpg ? buf : null;
}

export function invoiceTitle(inv: Pick<InvoiceForPdf, 'kind' | 'docType' | 'template'>) {
  if (inv.kind === 'CREDIT_NOTE') return inv.docType === 'ELECTRONIC' ? 'Nota crédito electrónica' : 'Nota crédito';
  if (inv.docType === 'ELECTRONIC') return 'Factura electrónica de venta';
  if (inv.docType === 'CONTINGENCY') return 'Factura de venta';
  return inv.template.title?.trim() || DOC_TYPES.INTERNAL.label;
}

export async function renderInvoicePdf(inv: InvoiceForPdf): Promise<Buffer> {
  const t = inv.template ?? {};
  const accent = t.accentColor && HEX.test(t.accentColor) ? t.accentColor : '#1F2937';
  const doc = new PDFDocument({ size: 'LETTER', margin: 40, bufferPages: true, info: { Title: `${invoiceTitle(inv)} ${inv.fullNumber}`, Author: inv.seller.legalName || inv.seller.tradeName, Creator: 'DREAMS' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));
  const W = doc.page.width - 80;
  const L = 40;
  const s = inv.seller;
  const b = inv.buyer;

  // ── Encabezado ──
  let y = 40;
  const logo = t.showLogo === false ? null : loadLogo(t.logoUrl || s.logoUrl);
  let textX = L;
  const bwReserve = 225;
  if (logo) {
    try { doc.image(logo, L, y, { fit: [110, 60] }); textX = L + 122; } catch { /* imagen dañada: se omite */ }
  }
  const lw = W - bwReserve - (textX - L);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text(s.legalName || s.tradeName, textX, y, { width: lw });
  doc.font('Helvetica').fontSize(8.5).fillColor('#374151');
  if (s.legalName && s.tradeName && s.legalName !== s.tradeName) doc.text(s.tradeName, { width: lw });
  if (s.nit) doc.text(`NIT ${s.nit}${s.dv ? `-${s.dv}` : ''}`, { width: lw });
  doc.text([s.address, s.city].filter(Boolean).join(' · '), { width: lw });
  doc.text([s.phone, s.email].filter(Boolean).join(' · '), { width: lw });
  const regimeLine = [s.regime ? REGIMES[s.regime] : '', ...(s.responsibilities ?? []).filter((r) => r !== 'R-99-PN').map((r) => RESPONSIBILITIES[r] ?? r)].filter(Boolean).join(' · ');
  if (regimeLine) doc.text(regimeLine, { width: lw });
  if (s.ciiu) doc.text(`Actividad económica CIIU ${s.ciiu}`, { width: lw });
  if (t.headerNote) doc.fillColor('#6B7280').text(t.headerNote, { width: lw });
  const leftBottom = doc.y;

  // Recuadro del documento
  const bw = 215;
  const bx = L + W - bw;
  doc.roundedRect(bx, y, bw, 80, 6).fill(accent);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(invoiceTitle(inv).toUpperCase(), bx + 8, y + 10, { width: bw - 16, align: 'center' });
  doc.fontSize(inv.fullNumber.length > 12 ? 13 : 16).text(`No. ${inv.fullNumber}`, bx + 8, y + 26, { width: bw - 16, align: 'center' });
  doc.font('Helvetica').fontSize(8).text(`Expedición: ${dayTime(inv.issuedAt)}`, bx + 8, y + 52, { width: bw - 16, align: 'center' });
  if (inv.dueDate) doc.text(`Vencimiento: ${day(inv.dueDate)}`, bx + 8, y + 63, { width: bw - 16, align: 'center' });
  y = Math.max(leftBottom, y + 80) + 12;

  // ── Comprador y condiciones ──
  doc.roundedRect(L, y, W, 58, 5).lineWidth(0.6).strokeColor('#D1D5DB').stroke();
  doc.fillColor('#6B7280').fontSize(7.5).text(inv.kind === 'CREDIT_NOTE' ? 'CLIENTE' : 'ADQUIRENTE / CLIENTE', L + 10, y + 8);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9.5).text(b.finalConsumer ? 'Consumidor final' : b.name, L + 10, y + 18, { width: W / 2 - 20 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#374151');
  doc.text(`${ID_TYPES[b.idType] ?? 'Identificación'}: ${b.idNumber}${b.dv ? `-${b.dv}` : ''}`, { width: W / 2 - 20 });
  doc.text([b.address, b.city].filter(Boolean).join(' · ') || ' ', { width: W / 2 - 20 });
  doc.text([b.phone, b.email].filter(Boolean).join(' · ') || ' ', { width: W / 2 - 20 });
  const cx = L + W / 2 + 10;
  doc.fillColor('#6B7280').fontSize(7.5).text('CONDICIONES', cx, y + 8);
  doc.fillColor('#374151').fontSize(8.5).text(`Forma de pago: ${inv.paymentForm === 'CREDITO' ? 'Crédito' : 'Contado'}`, cx, y + 18, { width: W / 2 - 20 });
  if (inv.paymentMeans) doc.text(`Medio de pago: ${PAYMENT_MEANS[inv.paymentMeans]?.label ?? inv.paymentMeans}`, { width: W / 2 - 20 });
  const balance = Math.max(0, inv.total - inv.amountPaid);
  if (inv.kind !== 'CREDIT_NOTE') doc.text(`Estado de pago: ${balance <= 0 ? 'Pagada' : `Saldo pendiente ${cop(balance)}`}`, { width: W / 2 - 20 });
  if (inv.relatedNumber) doc.text(`Afecta la factura No. ${inv.relatedNumber}`, { width: W / 2 - 20 });
  y += 70;

  // ── Ítems ──
  const showSku = t.showSku !== false;
  const cols = [
    { k: '#', w: 22, a: 'left' as const }, ...(showSku ? [{ k: 'Código', w: 58, a: 'left' as const }] : []),
    { k: 'Descripción', w: 0, a: 'left' as const }, { k: 'Cant.', w: 36, a: 'right' as const }, { k: 'Vr. unitario', w: 70, a: 'right' as const },
    { k: 'Desc.', w: 52, a: 'right' as const }, { k: 'IVA', w: 34, a: 'right' as const }, { k: 'Total', w: 74, a: 'right' as const },
  ];
  const fixed = cols.reduce((a, c) => a + c.w, 0);
  cols.find((c) => c.k === 'Descripción')!.w = W - fixed;
  const header = (yy: number) => {
    doc.rect(L, yy, W, 18).fill(accent);
    let x = L;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
    for (const c of cols) { doc.text(c.k, x + 4, yy + 5, { width: c.w - 8, align: c.a }); x += c.w; }
    return yy + 18;
  };
  y = header(y);
  doc.font('Helvetica').fontSize(8).fillColor('#111827');
  inv.items.forEach((it, i) => {
    const cells = [String(i + 1), ...(showSku ? [it.code ?? ''] : []), it.description, String(it.quantity), cop(it.unitPrice), it.discount ? cop(it.discount) : '-', `${it.taxRate}%`, cop(it.total)];
    const descW = cols.find((c) => c.k === 'Descripción')!.w - 8;
    const h = Math.max(16, doc.heightOfString(it.description, { width: descW }) + 8);
    if (y + h > doc.page.height - 200) { doc.addPage(); y = header(40); doc.font('Helvetica').fontSize(8).fillColor('#111827'); }
    if (i % 2 === 1) doc.rect(L, y, W, h).fill('#F9FAFB').fillColor('#111827');
    let x = L;
    cols.forEach((c, k) => { doc.text(cells[k], x + 4, y + 4, { width: c.w - 8, align: c.a }); x += c.w; });
    y += h;
  });
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.6).strokeColor('#D1D5DB').stroke();
  doc.fillColor('#6B7280').fontSize(7.5).text(`Total de ítems: ${inv.items.length}`, L, y + 4);
  y += 16;

  // ── Totales e impuestos ──
  if (y > doc.page.height - 230) { doc.addPage(); y = 40; }
  const tx = L + W - 210;
  const row = (k: string, v: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8.5).fillColor('#111827');
    doc.text(k, tx, y, { width: 120 }); doc.text(v, tx + 120, y, { width: 90, align: 'right' }); y += bold ? 16 : 13;
  };
  const yTotals = y;
  row('Subtotal', cop(inv.subtotal + inv.discountTotal));
  if (inv.discountTotal) row('Descuentos', `- ${cop(inv.discountTotal)}`);
  row('Base gravable', cop(inv.taxes.reduce((a, x) => a + x.base, 0)));
  for (const x of inv.taxes) if (x.tax > 0) row(`IVA ${x.rate}%`, cop(x.tax));
  if (!inv.taxes.some((x) => x.tax > 0)) row('IVA', cop(0));
  doc.moveTo(tx, y).lineTo(tx + 210, y).strokeColor('#D1D5DB').stroke(); y += 4;
  row(inv.kind === 'CREDIT_NOTE' ? 'Total nota crédito' : 'Total a pagar', cop(inv.total), true);
  let ly = yTotals;
  doc.font('Helvetica').fontSize(8).fillColor('#374151');
  const leftW = W - 230;
  const para = (title: string, body?: string | null) => {
    if (!body) return;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#6B7280').text(title.toUpperCase(), L, ly, { width: leftW });
    doc.font('Helvetica').fontSize(8).fillColor('#374151').text(body, L, doc.y + 1, { width: leftW });
    ly = doc.y + 6;
  };
  if (inv.warrantyMonths > 0 || inv.warrantyText) para('Garantía', `${inv.warrantyMonths > 0 ? `${inv.warrantyMonths} ${inv.warrantyMonths === 1 ? 'mes' : 'meses'} (hasta el ${day(inv.warrantyUntil)}). ` : ''}${inv.warrantyText ?? ''}`.trim());
  para('Observaciones', inv.notes);
  para('Pagos', t.bankInfo);
  if (inv.kind === 'CREDIT_NOTE' && inv.voidReason) para('Motivo', inv.voidReason);
  y = Math.max(y, ly) + 6;

  // ── Recibido (título valor) ──
  if (inv.kind !== 'CREDIT_NOTE' && inv.docType !== 'INTERNAL' && (inv.paymentForm === 'CREDITO' || t.showReceivedBlock)) {
    if (y > doc.page.height - 150) { doc.addPage(); y = 40; }
    doc.roundedRect(L, y, W, 44, 4).strokeColor('#D1D5DB').stroke();
    doc.fontSize(7.5).fillColor('#6B7280').text('RECIBIDO — nombre, identificación y firma de quien recibe la factura', L + 8, y + 6);
    doc.text('Fecha de recibo:', L + W - 160, y + 6);
    y += 52;
  }

  // ── Pie legal: numeración, CUFE, QR, conservación ──
  if (y > doc.page.height - 150) { doc.addPage(); y = 40; }
  const legal: string[] = [];
  if (inv.resolutionText) legal.push(inv.resolutionText);
  if (inv.docType === 'ELECTRONIC') {
    legal.push(inv.kind === 'CREDIT_NOTE' ? 'Representación gráfica de la nota crédito electrónica.' : 'Representación gráfica de la factura electrónica de venta.');
    if (inv.cufe) legal.push(`${inv.kind === 'CREDIT_NOTE' ? 'CUDE' : 'CUFE'}: ${inv.cufe}`);
    if (inv.dianValidatedAt) legal.push(`Validada por la DIAN el ${dayTime(inv.dianValidatedAt)}.`);
    if (inv.dianProvider) legal.push(`Proveedor / software de facturación: ${inv.dianProvider}.`);
  }
  if (inv.docType === 'CONTINGENCY') legal.push('Factura de talonario expedida por inconvenientes tecnológicos que impiden facturar electrónicamente (Res. DIAN 000165 de 2023).');
  if (inv.docType === 'INTERNAL') legal.push('Documento de venta. No es factura electrónica de venta.' + (inv.seller.regime === 'NO_RESPONSABLE' ? ' Vendedor no responsable de IVA.' : ''));
  if (inv.kind !== 'CREDIT_NOTE' && inv.docType !== 'INTERNAL' && inv.paymentForm === 'CREDITO') legal.push(TITLE_VALUE_NOTE);
  if (inv.kind !== 'CREDIT_NOTE' && (inv.warrantyMonths > 0 || inv.warrantyText)) legal.push(LEGAL_WARRANTY_NOTE);
  if (t.terms) legal.push(t.terms);
  if (t.footerNote) legal.push(t.footerNote);
  legal.push(`Código de integridad DREAMS: ${inv.integrityHash.slice(0, 16)}`);

  let qr: Buffer | null = null;
  if (inv.docType === 'ELECTRONIC' && inv.cufe) qr = await QRCode.toBuffer(dianQrUrl(inv.cufe, inv.dianEnvironment === '2' ? '2' : '1'), { margin: 1, width: 180 });
  const legalW = qr ? W - 100 : W;
  doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#E5E7EB').stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#4B5563').text(legal.join('\n'), L, y + 6, { width: legalW, lineGap: 1.5 });
  if (qr) doc.image(qr, L + W - 88, y + 6, { width: 88 });

  // ── Marcas de agua ──
  const watermark = inv.status === 'VOIDED' ? 'ANULADA' : inv.dianStatus === 'SIMULATED' ? 'SIMULACIÓN - SIN VALIDEZ FISCAL' : inv.docType === 'ELECTRONIC' && inv.dianStatus !== 'ACCEPTED' ? 'PENDIENTE DE VALIDACIÓN DIAN' : '';
  if (watermark) {
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      doc.save().rotate(-30, { origin: [306, 420] }).fillColor('#DC2626').opacity(0.12).font('Helvetica-Bold').fontSize(watermark.length > 12 ? 34 : 70)
        .text(watermark, 0, 400, { width: 612, align: 'center', lineBreak: false }).restore();
    }
  }
  doc.end();
  return done;
}
