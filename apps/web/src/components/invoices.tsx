'use client';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, ErrorBox, Field, Loading, Modal, Spinner, cn, useToast } from './ui';

export const DOC_LABEL: Record<string, string> = { ELECTRONIC: 'Factura electrónica', CONTINGENCY: 'Factura de talonario', INTERNAL: 'Comprobante de venta' };
export const DIAN_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' | 'sand' }> = {
  NOT_APPLICABLE: { label: 'No electrónica', tone: 'muted' }, PENDING: { label: 'Pendiente DIAN', tone: 'warn' }, ACCEPTED: { label: 'Validada DIAN', tone: 'ok' },
  REJECTED: { label: 'Rechazada DIAN', tone: 'bad' }, SIMULATED: { label: 'Simulación', tone: 'sand' },
};
export const ID_TYPES: Record<string, string> = {
  '13': 'Cédula de ciudadanía', '31': 'NIT', '22': 'Cédula de extranjería', '41': 'Pasaporte', '12': 'Tarjeta de identidad', '11': 'Registro civil',
  '42': 'Documento extranjero', '47': 'PEP', '48': 'PPT', '50': 'NIT de otro país',
};
export const REGIMES: Record<string, string> = { RESPONSABLE_IVA: 'Responsable de IVA', NO_RESPONSABLE: 'No responsable de IVA', SIMPLE: 'Régimen Simple de Tributación' };
export const RESPONSIBILITIES: Record<string, string> = { 'O-13': 'Gran contribuyente', 'O-15': 'Autorretenedor', 'O-23': 'Agente de retención de IVA', 'O-47': 'Régimen simple', 'R-99-PN': 'No aplica – Otros' };
export const PAYMENT_MEANS: Record<string, string> = { CASH: 'Efectivo', BANK_TRANSFER: 'Transferencia bancaria', DEBIT_CARD: 'Tarjeta débito', CREDIT_CARD: 'Tarjeta crédito', PSE: 'PSE', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', OTHER: 'Otro' };

/** Dígito de verificación del NIT (algoritmo de la DIAN). */
export function nitDv(nit: string) {
  const d = nit.replace(/\D/g, '');
  if (!d) return '';
  const w = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const sum = d.split('').reverse().reduce((a, c, i) => a + Number(c) * (w[i] ?? 0), 0) % 11;
  return String(sum > 1 ? 11 - sum : sum);
}

export function invoiceTitle(inv: { kind: string; docType: string; template?: { title?: string } }) {
  if (inv.kind === 'CREDIT_NOTE') return inv.docType === 'ELECTRONIC' ? 'Nota crédito electrónica' : 'Nota crédito';
  if (inv.docType === 'ELECTRONIC') return 'Factura electrónica de venta';
  if (inv.docType === 'CONTINGENCY') return 'Factura de venta';
  return inv.template?.title?.trim() || 'Comprobante de venta';
}

/** Vista de la factura en pantalla (la versión oficial descargable es el PDF que genera el servidor). */
export function InvoicePreview({ inv, compact }: { inv: any; compact?: boolean }) {
  const t = inv.template ?? {};
  const s = inv.seller ?? {};
  const b = inv.buyer ?? {};
  const accent = /^#[0-9a-fA-F]{6}$/.test(t.accentColor ?? '') ? t.accentColor : '#1F2937';
  const logo = t.showLogo === false ? null : t.logoUrl || s.logoUrl;
  const balance = Math.max(0, Number(inv.total) - Number(inv.amountPaid ?? 0));
  const watermark = inv.status === 'VOIDED' ? 'ANULADA' : inv.dianStatus === 'SIMULATED' ? 'SIMULACIÓN · SIN VALIDEZ FISCAL' : inv.docType === 'ELECTRONIC' && inv.dianStatus !== 'ACCEPTED' ? 'PENDIENTE DIAN' : '';
  return <div className={cn('relative bg-white text-[#111827] overflow-hidden', compact ? 'text-[10px] p-4' : 'text-xs p-6 sm:p-8')}>
    {watermark && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="-rotate-[25deg] text-red-600/10 font-bold text-4xl sm:text-5xl whitespace-nowrap">{watermark}</span></div>}
    <div className="flex flex-col sm:flex-row gap-4 justify-between">
      <div className="flex gap-3 min-w-0">
        {logo && <img src={logo} alt="" className={cn('object-contain shrink-0', compact ? 'h-10 w-16' : 'h-14 w-24')} />}
        <div className="min-w-0 leading-snug">
          <p className={cn('font-bold', compact ? 'text-xs' : 'text-sm')}>{s.legalName || s.tradeName}</p>
          {s.legalName && s.tradeName && s.legalName !== s.tradeName && <p>{s.tradeName}</p>}
          {s.nit && <p>NIT {s.nit}{s.dv ? `-${s.dv}` : ''}</p>}
          <p className="text-[#4B5563]">{[s.address, s.city].filter(Boolean).join(' · ')}</p>
          <p className="text-[#4B5563]">{[s.phone, s.email].filter(Boolean).join(' · ')}</p>
          <p className="text-[#4B5563]">{[s.regime && REGIMES[s.regime], ...(s.responsibilities ?? []).filter((r: string) => r !== 'R-99-PN').map((r: string) => RESPONSIBILITIES[r] ?? r)].filter(Boolean).join(' · ')}</p>
          {t.headerNote && <p className="text-[#6B7280]">{t.headerNote}</p>}
        </div>
      </div>
      <div className="rounded-lg text-white text-center px-4 py-3 sm:w-56 shrink-0" style={{ background: accent }}>
        <p className="font-bold uppercase text-[10px] tracking-wide">{invoiceTitle(inv)}</p>
        <p className={cn('font-bold', compact ? 'text-sm' : 'text-lg')}>No. {inv.fullNumber}</p>
        <p className="text-[10px] opacity-90">Expedición: {date(inv.issuedAt, true)}</p>
        {inv.dueDate && <p className="text-[10px] opacity-90">Vencimiento: {date(inv.dueDate)}</p>}
      </div>
    </div>
    <div className="grid sm:grid-cols-2 gap-3 mt-4 rounded-lg border border-[#E5E7EB] p-3">
      <div><p className="text-[9px] uppercase text-[#6B7280]">Adquirente / cliente</p><p className="font-semibold">{b.finalConsumer ? 'Consumidor final' : b.name}</p>
        <p>{ID_TYPES[b.idType] ?? 'Identificación'}: {b.idNumber}{b.dv ? `-${b.dv}` : ''}</p><p className="text-[#4B5563]">{[b.address, b.city].filter(Boolean).join(' · ')}</p><p className="text-[#4B5563]">{[b.phone, b.email].filter(Boolean).join(' · ')}</p></div>
      <div><p className="text-[9px] uppercase text-[#6B7280]">Condiciones</p><p>Forma de pago: {inv.paymentForm === 'CREDITO' ? 'Crédito' : 'Contado'}</p>
        {inv.paymentMeans && <p>Medio de pago: {PAYMENT_MEANS[inv.paymentMeans] ?? inv.paymentMeans}</p>}
        {inv.kind !== 'CREDIT_NOTE' && <p>Estado de pago: {balance <= 0 ? 'Pagada' : `Saldo pendiente ${money(balance)}`}</p>}
        {inv.related && <p>{inv.kind === 'CREDIT_NOTE' ? 'Afecta la factura' : 'Anulada con'} No. {inv.related.fullNumber}</p>}</div>
    </div>
    <div className="overflow-x-auto mt-3"><table className="w-full min-w-[460px]">
      <thead><tr className="text-white text-left" style={{ background: accent }}>
        <th className="px-2 py-1.5">#</th>{t.showSku !== false && <th className="px-2">Código</th>}<th className="px-2">Descripción</th><th className="px-2 text-right">Cant.</th><th className="px-2 text-right">Vr. unit.</th><th className="px-2 text-right">Desc.</th><th className="px-2 text-right">IVA</th><th className="px-2 text-right">Total</th>
      </tr></thead>
      <tbody>{(inv.items ?? []).map((it: any, i: number) => <tr key={i} className="border-b border-[#F3F4F6]">
        <td className="px-2 py-1.5">{i + 1}</td>{t.showSku !== false && <td className="px-2">{it.code}</td>}<td className="px-2">{it.description}</td><td className="px-2 text-right">{it.quantity}</td>
        <td className="px-2 text-right tabular-nums">{money(it.unitPrice)}</td><td className="px-2 text-right tabular-nums">{it.discount ? money(it.discount) : '-'}</td><td className="px-2 text-right">{it.taxRate}%</td><td className="px-2 text-right tabular-nums">{money(it.total)}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="grid sm:grid-cols-[1fr_220px] gap-4 mt-3">
      <div className="space-y-2">
        {(inv.warrantyMonths > 0 || inv.warrantyText) && <div><p className="text-[9px] uppercase font-semibold text-[#6B7280]">Garantía</p><p>{inv.warrantyMonths > 0 && `${inv.warrantyMonths} ${inv.warrantyMonths === 1 ? 'mes' : 'meses'} (hasta el ${date(inv.warrantyUntil)}). `}{inv.warrantyText}</p></div>}
        {inv.notes && <div><p className="text-[9px] uppercase font-semibold text-[#6B7280]">Observaciones</p><p className="whitespace-pre-line">{inv.notes}</p></div>}
        {t.bankInfo && <div><p className="text-[9px] uppercase font-semibold text-[#6B7280]">Pagos</p><p className="whitespace-pre-line">{t.bankInfo}</p></div>}
        {inv.voidReason && inv.kind === 'CREDIT_NOTE' && <div><p className="text-[9px] uppercase font-semibold text-[#6B7280]">Motivo</p><p>{inv.voidReason}</p></div>}
      </div>
      <dl className="space-y-1">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{money(Number(inv.subtotal) + Number(inv.discountTotal))}</dd></div>
        {Number(inv.discountTotal) > 0 && <div className="flex justify-between"><dt>Descuentos</dt><dd className="tabular-nums">−{money(inv.discountTotal)}</dd></div>}
        {(inv.taxes ?? []).filter((x: any) => x.tax > 0).map((x: any) => <div key={x.rate} className="flex justify-between"><dt>IVA {x.rate}%</dt><dd className="tabular-nums">{money(x.tax)}</dd></div>)}
        {!(inv.taxes ?? []).some((x: any) => x.tax > 0) && <div className="flex justify-between"><dt>IVA</dt><dd>{money(0)}</dd></div>}
        <div className="flex justify-between font-bold text-sm border-t border-[#E5E7EB] pt-1"><dt>{inv.kind === 'CREDIT_NOTE' ? 'Total nota' : 'Total a pagar'}</dt><dd className="tabular-nums">{money(inv.total)}</dd></div>
      </dl>
    </div>
    <div className="mt-4 pt-2 border-t border-[#E5E7EB] text-[9px] text-[#4B5563] space-y-0.5 break-words">
      {inv.resolutionText && <p>{inv.resolutionText}</p>}
      {inv.docType === 'ELECTRONIC' && <p>Representación gráfica de la {inv.kind === 'CREDIT_NOTE' ? 'nota crédito electrónica' : 'factura electrónica de venta'}.</p>}
      {inv.cufe && <p className="font-mono">{inv.kind === 'CREDIT_NOTE' ? 'CUDE' : 'CUFE'}: {inv.cufe}</p>}
      {inv.docType === 'INTERNAL' && <p>Documento de venta. No es factura electrónica de venta.{s.regime === 'NO_RESPONSABLE' && ' Vendedor no responsable de IVA.'}</p>}
      {t.terms && <p>{t.terms}</p>}
      {t.footerNote && <p>{t.footerNote}</p>}
    </div>
  </div>;
}

/** Ventana para expedir la factura de una venta. */
export function InvoiceModal({ saleId, open, onClose }: { saleId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading } = useApi<any>(open ? `/invoices/prepare/${saleId}` : null);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (data && !f) setF({ ...data.defaults, buyer: { ...data.defaults.buyer, saveToCustomer: true }, notes: '' }); }, [data, f]);
  const set = (p: any) => setF((x: any) => ({ ...x, ...p }));
  const setB = (p: any) => setF((x: any) => ({ ...x, buyer: { ...x.buyer, ...p } }));
  const ready = data?.readiness?.find((r: any) => r.docType === f?.docType);
  const active = (data?.existing ?? []).find((e: any) => e.kind === 'INVOICE' && e.status === 'ISSUED');
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const body = { ...f, saleId, dueDate: f.paymentForm === 'CREDITO' ? f.dueDate : undefined, paymentMeans: f.paymentForm === 'CONTADO' ? f.paymentMeans : undefined,
        warrantyText: f.warrantyText || undefined, notes: f.notes || undefined,
        buyer: { ...f.buyer, dv: f.buyer.idType === '31' ? (f.buyer.dv || nitDv(f.buyer.idNumber)) : undefined, email: f.buyer.email || undefined, idNumber: f.buyer.finalConsumer ? undefined : f.buyer.idNumber } };
      const r = await api<any>('/invoices', { body });
      toast(`${invoiceTitle(r)} ${r.fullNumber} expedida`);
      router.push(`/facturas/${r.id}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open={open} onClose={onClose} title="Facturar esta venta" wide
    footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !f || !!active || data?.sale?.cancelled || (ready && !ready.ready)} onClick={submit}>{busy ? <Spinner /> : <FileText className="h-4 w-4" />} Expedir</button></>}>
    {error && <ErrorBox message={error} />}
    {(loading || !f) && !error ? <Loading /> : f && <div className="space-y-4">
      {err && <ErrorBox message={err} />}
      {data.sale.cancelled && <ErrorBox message="La venta está anulada: no se puede facturar." />}
      {active && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Esta venta ya tiene la {DOC_LABEL[active.docType]?.toLowerCase()} <b>{active.fullNumber}</b>. Para corregirla, ábrela y anúlala con una nota crédito.
        <button className="underline ml-1" onClick={() => router.push(`/facturas/${active.id}`)}>Ver</button></div>}
      <div><p className="label">Tipo de documento</p>
        <div className="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de documento">{(data.readiness ?? []).map((r: any) => <button key={r.docType} type="button" role="radio" aria-checked={f.docType === r.docType} onClick={() => set({ docType: r.docType })}
          className={cn('rounded-xl border p-2.5 text-left text-sm', f.docType === r.docType ? 'border-ink ring-1 ring-ink' : 'border-line')}>
          <span className="font-medium block">{DOC_LABEL[r.docType]}</span>
          <span className={cn('text-[11px] flex items-center gap-1', r.ready ? 'text-ok' : 'text-warn')}>{r.ready ? <><CheckCircle2 className="h-3 w-3" /> Listo</> : <><AlertTriangle className="h-3 w-3" /> Falta configurar</>}</span>
        </button>)}</div>
      </div>
      {ready && !ready.ready && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">{ready.errors.map((e: string, i: number) => <p key={i}>• {e}</p>)}<a href="/facturas/ajustes" className="underline font-medium">Ir a ajustes de facturación</a></div>}
      {f.docType === 'ELECTRONIC' && data.settings.einvoiceMode === 'SANDBOX' && <p className="text-xs rounded-xl bg-sand-100 p-2.5">Modo de pruebas: la factura sale marcada «SIMULACIÓN» y no se envía a la DIAN.</p>}

      <div className="rounded-xl border border-line p-3 space-y-3">
        <div className="flex items-center justify-between"><p className="text-sm font-medium">Comprador</p>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.buyer.finalConsumer} onChange={(e) => setB({ finalConsumer: e.target.checked })} /> Consumidor final (sin identificar)</label></div>
        {!f.buyer.finalConsumer && <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nombre o razón social" className="sm:col-span-2"><input className="input" value={f.buyer.name} onChange={(e) => setB({ name: e.target.value })} maxLength={200} /></Field>
          <Field label="Tipo de identificación"><select className="input" value={f.buyer.idType} onChange={(e) => setB({ idType: e.target.value })}>{Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Número" hint={f.buyer.idType === '31' && f.buyer.idNumber ? `Dígito de verificación: ${nitDv(f.buyer.idNumber)}` : undefined}><input className="input" value={f.buyer.idNumber} onChange={(e) => setB({ idNumber: e.target.value.replace(/[^\dA-Za-z]/g, '').slice(0, 20), dv: '' })} /></Field>
          <Field label="Correo (para enviarle la factura)"><input className="input" type="email" value={f.buyer.email} onChange={(e) => setB({ email: e.target.value })} /></Field>
          <Field label="Teléfono"><input className="input" value={f.buyer.phone} onChange={(e) => setB({ phone: e.target.value })} /></Field>
          <Field label="Dirección"><input className="input" value={f.buyer.address} onChange={(e) => setB({ address: e.target.value })} /></Field>
          <Field label="Ciudad"><input className="input" value={f.buyer.city} onChange={(e) => setB({ city: e.target.value })} /></Field>
          <label className="flex items-center gap-1.5 text-xs sm:col-span-2"><input type="checkbox" checked={f.buyer.saveToCustomer} onChange={(e) => setB({ saveToCustomer: e.target.checked })} /> Guardar estos datos en la ficha del cliente</label>
        </div>}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Forma de pago"><select className="input" value={f.paymentForm} onChange={(e) => set({ paymentForm: e.target.value })}><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option></select></Field>
        {f.paymentForm === 'CONTADO' ? <Field label="Medio de pago"><select className="input" value={f.paymentMeans ?? 'CASH'} onChange={(e) => set({ paymentMeans: e.target.value })}>{Object.entries(PAYMENT_MEANS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          : <Field label="Fecha de vencimiento"><input className="input" type="date" value={f.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value })} /></Field>}
        <Field label="Garantía (meses)" hint="0 = sin garantía indicada"><input className="input" type="number" min={0} max={120} value={f.warrantyMonths} onChange={(e) => set({ warrantyMonths: Math.max(0, Math.min(120, Math.floor(Number(e.target.value) || 0))) })} /></Field>
      </div>
      <Field label="Condiciones de la garantía (opcional)"><input className="input" value={f.warrantyText} maxLength={800} onChange={(e) => set({ warrantyText: e.target.value })} placeholder="Ej.: cubre defectos de fábrica; no cubre golpes ni humedad" /></Field>
      <Field label="Observaciones (opcional)"><textarea className="input min-h-[60px]" value={f.notes} maxLength={1500} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <div className="flex justify-between text-sm rounded-xl bg-sand-50 p-3"><span>Venta #{data.sale.number} · {data.items.length} ítem(s)</span><b>{money(data.sale.total)}</b></div>
    </div>}
  </Modal>;
}

export function DianBadge({ status }: { status: string }) {
  const s = DIAN_STATUS[status] ?? { label: status, tone: 'muted' as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
