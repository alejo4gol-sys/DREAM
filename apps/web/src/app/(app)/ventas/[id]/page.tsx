'use client';
import { ArrowLeft, Ban, FileText, Printer, RotateCcw, Send, Wallet } from 'lucide-react';
import { CollectModal } from '@/components/growth';
import { DOC_LABEL, DianBadge, InvoiceModal } from '@/components/invoices';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, ErrorBox, Field, Loading, Logo, Modal, PageHeader, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CHANNELS, METHODS, SALE_STATUS, date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';

export default function SaleDetail({ params }: { params: { id: string } }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: s, error, reload, setData } = useApi<any>(`/sales/${params.id}`);
  const { data: biz } = useApi<any>('/businesses/current');
  const [pay, setPay] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('NEQUI');
  const [err, setErr] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [collect, setCollect] = useState(false);
  const { data: invs } = useApi<any[]>(`/invoices/by-sale/${params.id}`);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!s) return <Loading />;
  const st = SALE_STATUS[s.status];

  const addPayment = async () => {
    try { setData(await api(`/sales/${s.id}/payments`, { body: { amount: String(amount), method } })); setPay(false); setAmount(''); toast('Abono registrado'); }
    catch (e) { setErr((e as Error).message); }
  };
  const cancel = async () => {
    if (!confirm(`¿Anular la venta #${s.number}? El inventario se devolverá.`)) return;
    try { setData(await api(`/sales/${s.id}/cancel`, { method: 'POST' })); toast('Venta anulada'); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };

  return (
    <>
      <div className="no-print">
        <Link href="/ventas" className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Ventas</Link>
        <PageHeader title={`Venta #${s.number}`} subtitle={<span className="flex items-center gap-2">{date(s.date, true)} · <Badge tone={st.tone}>{st.label}</Badge></span>}
          actions={<>
            {s.status !== 'CANCELLED' && can('sales:create') && !(invs ?? []).some((i: any) => i.kind === 'INVOICE' && i.status === 'ISSUED') && <button className="btn-primary" onClick={() => setInvoiceOpen(true)}><FileText className="h-4 w-4" /> Facturar</button>}
            <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Comprobante</button>
            {s.status !== 'CANCELLED' && Number(s.balance) > 0 && <button className="btn-secondary" onClick={() => setCollect(true)}><Send className="h-4 w-4" /> Cobrar</button>}
            {s.status !== 'CANCELLED' && Number(s.balance) > 0 && can('sales:create') && <button className="btn-primary" onClick={() => { setAmount(String(Number(s.balance))); setPay(true); }}><Wallet className="h-4 w-4" /> Registrar abono</button>}
            {s.status !== 'CANCELLED' && can('sales:create') && <Link className="btn-secondary" href={`/devoluciones?venta=${s.id}`}><RotateCcw className="h-4 w-4" /> Devolución</Link>}
            {s.status !== 'CANCELLED' && can('sales:cancel') && <button className="btn-danger" onClick={cancel}><Ban className="h-4 w-4" /> Anular</button>}
          </>} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        <Card className="print-area">
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-line">
            <div>
              <Logo />
              <p className="text-sm font-medium mt-3">{biz?.legalName ?? biz?.tradeName}</p>
              <p className="text-xs text-ink-muted">{biz?.taxId && `NIT ${biz.taxId} · `}{biz?.address} {biz?.city}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">Comprobante de venta</p>
              <p className="text-2xl font-semibold">#{String(s.number).padStart(5, '0')}</p>
              <p className="text-xs text-ink-muted">{date(s.date, true)}</p>
            </div>
          </div>
          <div className="py-4 text-sm grid sm:grid-cols-3 gap-3 border-b border-line">
            <div><p className="text-xs text-ink-muted">Cliente</p><p>{s.customer?.name ?? 'Consumidor final'}</p>{s.customer?.taxId && <p className="text-xs text-ink-muted">{s.customer.taxId}</p>}</div>
            <div><p className="text-xs text-ink-muted">Canal</p><p>{CHANNELS[s.channel]}</p></div>
            <div><p className="text-xs text-ink-muted">Método de pago</p><p>{METHODS[s.paymentMethod]}</p></div>
          </div>
          <div className="overflow-x-auto -mx-1 px-1"><table className="table mt-2 min-w-[480px]">
            <thead><tr><th className="!px-0 !bg-transparent">Producto</th><th className="text-right !bg-transparent">Cant.</th><th className="text-right !bg-transparent">Precio</th><th className="text-right !bg-transparent">Desc.</th><th className="text-right !px-0 !bg-transparent">Total</th></tr></thead>
            <tbody>
              {s.items.map((i: any) => (
                <tr key={i.id}><td className="!px-0">{i.description}</td><td className="text-right">{i.quantity}</td><td className="text-right tabular-nums">{money(i.unitPrice)}</td><td className="text-right tabular-nums">{Number(i.discount) ? money(i.discount) : '—'}</td><td className="text-right tabular-nums !px-0">{money(i.lineTotal)}</td></tr>
              ))}
            </tbody>
          </table></div>
          <dl className="mt-4 ml-auto max-w-xs text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums">{money(s.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Descuentos</dt><dd className="tabular-nums">−{money(s.discountTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Impuestos</dt><dd className="tabular-nums">{money(s.taxTotal)}</dd></div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-line"><dt>Total</dt><dd className="tabular-nums">{money(s.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Pagado</dt><dd className="tabular-nums">{money(s.amountPaid)}</dd></div>
            {Number(s.balance) > 0 && s.status !== 'CANCELLED' && <div className="flex justify-between text-warn font-medium"><dt>Saldo pendiente</dt><dd className="tabular-nums">{money(s.balance)}</dd></div>}
          </dl>
          {s.notes && <p className="mt-4 text-xs text-ink-muted">Observaciones: {s.notes}</p>}
          <p className="mt-6 text-[10px] text-ink-faint">Documento interno de venta. No es factura: para expedir la factura usa «Facturar».</p>
        </Card>

        <div className="space-y-4 no-print">
        {(invs ?? []).length > 0 && <Card title="Facturación" padded={false}>
          <ul className="divide-y divide-line">{invs!.map((i: any) => <li key={i.id} className="px-5 py-3 text-sm flex items-center justify-between gap-2">
            <Link href={`/facturas/${i.id}`} className="underline">{i.kind === 'CREDIT_NOTE' ? 'Nota crédito' : DOC_LABEL[i.docType]} {i.fullNumber}</Link>
            <span className="flex gap-1">{i.status === 'VOIDED' ? <Badge tone="bad">Anulada</Badge> : i.docType === 'ELECTRONIC' ? <DianBadge status={i.dianStatus} /> : <Badge tone="ok">Vigente</Badge>}</span>
          </li>)}</ul>
        </Card>}
        <Card title="Pagos" padded={false}>
          <ul className="divide-y divide-line">
            {s.payments.length === 0 && <li className="px-5 py-4 text-sm text-ink-muted">Sin pagos registrados.</li>}
            {s.payments.map((p: any) => (
              <li key={p.id} className="px-5 py-3 flex justify-between text-sm">
                <span><span className="block">{METHODS[p.method]}</span><span className="text-[11px] text-ink-muted">{date(p.paidAt, true)}{p.reference && ` · ${p.reference}`}</span></span>
                <span className="tabular-nums font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
          {s.customer && <div className="px-5 py-4 border-t border-line"><Link href={`/clientes/${s.customer.id}`} className="btn-secondary w-full">Ver cliente</Link></div>}
        </Card>
        </div>
      </div>

      {invoiceOpen && <InvoiceModal saleId={s.id} open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />}
      <Modal open={pay} onClose={() => setPay(false)} title="Registrar abono" footer={<><button className="btn-ghost" onClick={() => setPay(false)}>Cancelar</button><button className="btn-primary" onClick={addPayment}>Guardar abono</button></>}>
        <div className="space-y-3">
          {err && <ErrorBox message={err} />}
          <Field label={`Valor (saldo ${money(s.balance)})`}><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
          <Field label="Método"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
      </Modal>
      {collect && <CollectModal saleId={s.id} open={collect} onClose={() => { setCollect(false); reload?.(); }} />}
    </>
  );
}
