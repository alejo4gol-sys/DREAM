'use client';
import { Check, MessageCircle, PackageCheck, Plus, RefreshCcw, RotateCcw, Search, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, Stat, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { useApi, useDebounced } from '@/lib/hooks';

type Item = { productId: string; variantId?: string | null; name: string; quantity: number; unitPrice: string; restock?: boolean };
type Ret = { id: string; number: number; source: 'SALE' | 'STORE_ORDER'; storeOrderId: string | null; saleId: string | null; saleNumber: number | null; customerName: string; customerPhone: string | null;
  reason: string; reasonLabel: string; details: string | null; resolution: 'REFUND' | 'EXCHANGE'; status: string; items: Item[]; refundAmount: string; refundMethod: string | null;
  refundReference: string | null; responseNote: string | null; requestedAt: string; resolvedAt: string | null };
type ListResp = { items: Ret[]; summary: { requested: number; open: number; refundedMonth: string }; reasons: Record<string, string> };

const STATUS: Record<string, { label: string; tone: 'warn' | 'ink' | 'muted' | 'ok' | 'bad' | 'sand' }> = {
  REQUESTED: { label: 'Solicitada', tone: 'warn' }, APPROVED: { label: 'Aprobada', tone: 'ink' }, RECEIVED: { label: 'Producto recibido', tone: 'sand' },
  REFUNDED: { label: 'Reembolsada', tone: 'ok' }, EXCHANGED: { label: 'Cambio realizado', tone: 'ok' }, REJECTED: { label: 'Rechazada', tone: 'bad' },
};
const REFUND_METHODS: Record<string, string> = { CASH: 'Efectivo', BANK_TRANSFER: 'Transferencia', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', CARD_REVERSAL: 'Reversión a tarjeta', PAYMENT_GATEWAY: 'Reversión en la pasarela (Wompi u otra)', STORE_CREDIT: 'Saldo a favor en la tienda', OTHER: 'Otro' };
const key = (i: { productId: string; variantId?: string | null }) => i.variantId ? `${i.productId}:${i.variantId}` : i.productId;
const lineTotal = (items: Item[]) => items.reduce((a, i) => a + Number(i.unitPrice) * i.quantity, 0);
const wa = (phone: string | null, text: string) => phone ? `https://wa.me/${phone.replace(/\D/g, '').replace(/^3/, '573')}?text=${encodeURIComponent(text)}` : '';

function ReturnsPage() {
  const toast = useToast();
  const { can, current } = useAuth();
  const params = useSearchParams();
  const [filter, setFilter] = useState<'OPEN' | 'ALL' | 'REFUNDED' | 'EXCHANGED' | 'REJECTED'>('OPEN');
  const { data, loading, error, reload } = useApi<ListResp>(`/returns?status=${filter}`);
  const [creating, setCreating] = useState(false);
  const [preset, setPreset] = useState<{ source: 'SALE' | 'STORE_ORDER'; id: string } | null>(null);
  const [noteFor, setNoteFor] = useState<{ ret: Ret; action: 'reject' | 'approve' | 'exchange' } | null>(null);
  const [note, setNote] = useState('');
  const [receiving, setReceiving] = useState<Ret | null>(null);
  const [restock, setRestock] = useState<string[]>([]);
  const [refunding, setRefunding] = useState<Ret | null>(null);
  const [refund, setRefund] = useState({ amount: '', method: 'NEQUI', reference: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const venta = params.get('venta'); const pedido = params.get('pedido');
    if (venta || pedido) { setPreset({ source: venta ? 'SALE' : 'STORE_ORDER', id: (venta ?? pedido)! }); setCreating(true); }
  }, [params]);

  const act = async (path: string, body: object, ok: string) => {
    setBusy(true); setErr('');
    try { await api(path, { method: 'PATCH', body }); await reload(); toast(ok); return true; }
    catch (e) { setErr((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  const statusText = (r: Ret) => {
    const n = `#${r.number}`;
    const m: Record<string, string> = {
      APPROVED: `Hola ${r.customerName}, aprobamos tu solicitud de devolución ${n}.${r.responseNote ? ` ${r.responseNote}` : ''}`,
      REJECTED: `Hola ${r.customerName}, revisamos tu solicitud de devolución ${n} y no pudimos aprobarla: ${r.responseNote ?? ''}`,
      RECEIVED: `Hola ${r.customerName}, recibimos el producto de tu devolución ${n}. Pronto te confirmamos el ${r.resolution === 'REFUND' ? 'reembolso' : 'cambio'}.`,
      REFUNDED: `Hola ${r.customerName}, ya realizamos el reembolso de tu devolución ${n} por ${money(r.refundAmount)}${r.refundMethod ? ` (${REFUND_METHODS[r.refundMethod]})` : ''}.`,
      EXCHANGED: `Hola ${r.customerName}, tu cambio ${n} quedó listo. ¡Gracias por tu paciencia!`,
      REQUESTED: `Hola ${r.customerName}, recibimos tu solicitud de devolución ${n}. Te contamos pronto.`,
    };
    return m[r.status] ?? '';
  };

  return <>
    <PageHeader title="Devoluciones y cambios" subtitle="Solicitudes desde tu página web y devoluciones de ventas en el local: apruébalas, recibe el producto, devuelve el dinero o haz el cambio."
      actions={can('sales:create') && <button className="btn-primary" onClick={() => { setPreset(null); setCreating(true); }}><Plus className="h-4 w-4" /> Registrar devolución</button>} />
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
      <Stat dark label="Por revisar" value={data?.summary.requested ?? '—'} hint="Solicitudes nuevas de clientes" />
      <Stat label="En curso" value={data?.summary.open ?? '—'} />
      <Stat label="Reembolsado este mes" value={data ? money(data.summary.refundedMonth) : '—'} hint="Se resta de las ventas en Contabilidad" />
    </div>
    <div className="mb-4"><Tabs value={filter} onChange={setFilter} items={[{ value: 'OPEN', label: 'En curso' }, { value: 'REFUNDED', label: 'Reembolsadas' }, { value: 'EXCHANGED', label: 'Cambios' }, { value: 'REJECTED', label: 'Rechazadas' }, { value: 'ALL', label: 'Todas' }]} /></div>
    {(error || err) && <div className="mb-4"><ErrorBox message={err || error!} onRetry={err ? undefined : reload} /></div>}
    {loading && !data ? <Loading /> : !data?.items.length ? <Card><Empty icon={<RotateCcw className="h-5 w-5" />} title={filter === 'OPEN' ? 'No hay devoluciones en curso' : 'Sin devoluciones aquí'} description="Tus clientes pueden solicitarlas desde tu página web con su número de pedido y celular." /></Card>
      : <div className="space-y-3">{data.items.map((r) => <Card key={r.id}>
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Devolución #{r.number}</h2><Badge tone={STATUS[r.status]?.tone ?? 'muted'}>{STATUS[r.status]?.label ?? r.status}</Badge><Badge tone="sand">{r.resolution === 'REFUND' ? 'Quiere reembolso' : 'Quiere cambio'}</Badge><span className="text-xs text-ink-faint">{date(r.requestedAt, true)}</span></div>
            <p className="text-sm mt-2"><span className="text-ink-muted">Cliente: </span>{r.customerName}{r.customerPhone ? ` · ${r.customerPhone}` : ''}</p>
            <p className="text-sm"><span className="text-ink-muted">Compra: </span>{r.saleId ? <Link className="underline" href={`/ventas/${r.saleId}`}>Venta #{r.saleNumber}</Link> : null}{r.storeOrderId ? `${r.saleId ? ' · ' : ''}Pedido web #${r.storeOrderId.slice(0, 8)}` : ''}</p>
            <p className="text-sm"><span className="text-ink-muted">Motivo: </span>{r.reasonLabel}{r.details ? ` — «${r.details}»` : ''}</p>
            <div className="mt-3 rounded-xl bg-sand-50 divide-y divide-line/70">{r.items.map((i) => <div key={key(i)} className="flex justify-between px-3 py-2 text-sm"><span>{i.quantity} × {i.name}{i.restock !== undefined && <span className="block text-xs text-ink-muted">{i.restock ? 'Volvió al inventario' : 'No se repuso (dañado o no apto)'}</span>}</span><span className="tabular-nums">{money(Number(i.unitPrice) * i.quantity)}</span></div>)}</div>
            {r.status === 'REFUNDED' && <p className="text-sm mt-2 text-ok">Reembolsado {money(r.refundAmount)} · {REFUND_METHODS[r.refundMethod ?? ''] ?? ''}{r.refundReference ? ` · Ref. ${r.refundReference}` : ''}</p>}
            {r.responseNote && <p className="text-xs text-ink-muted mt-2">Nota para el cliente: {r.responseNote}</p>}
          </div>
          {can('sales:create') && <div className="flex flex-wrap lg:flex-col gap-2 lg:w-56 shrink-0">
            {r.status === 'REQUESTED' && <button className="btn-secondary justify-center" onClick={() => { setNote(''); setNoteFor({ ret: r, action: 'approve' }); }}><Check className="h-4 w-4" />Aprobar</button>}
            {r.status === 'APPROVED' && <button className="btn-secondary justify-center" onClick={() => { setRestock(r.items.map(key)); setReceiving(r); }}><PackageCheck className="h-4 w-4" />Recibí el producto</button>}
            {['APPROVED', 'RECEIVED'].includes(r.status) && r.resolution === 'REFUND' && can('finance:write') && <button className="btn-secondary justify-center" onClick={() => { setRefund({ amount: String(lineTotal(r.items)), method: 'NEQUI', reference: '' }); setRefunding(r); }}><Wallet className="h-4 w-4" />Registrar reembolso</button>}
            {['APPROVED', 'RECEIVED'].includes(r.status) && <button className={r.resolution === 'EXCHANGE' ? 'btn-secondary justify-center' : 'btn-ghost justify-center'} onClick={() => { setNote(''); setNoteFor({ ret: r, action: 'exchange' }); }}><RefreshCcw className="h-4 w-4" />Cambio realizado</button>}
            {['REQUESTED', 'APPROVED'].includes(r.status) && <button className="btn-ghost text-bad justify-center" onClick={() => { setNote(''); setNoteFor({ ret: r, action: 'reject' }); }}><X className="h-4 w-4" />Rechazar</button>}
            {r.customerPhone && <a className="btn-ghost justify-center" href={wa(r.customerPhone, statusText(r))} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />Avisar por WhatsApp</a>}
          </div>}
        </div>
      </Card>)}</div>}

    <Modal open={Boolean(noteFor)} onClose={() => setNoteFor(null)} title={noteFor?.action === 'reject' ? 'Rechazar devolución' : noteFor?.action === 'approve' ? 'Aprobar devolución' : 'Cerrar como cambio'}
      footer={<><button className="btn-secondary" onClick={() => setNoteFor(null)}>Cancelar</button><button className={noteFor?.action === 'reject' ? 'btn-danger' : 'btn-primary'} disabled={busy || (noteFor?.action === 'reject' && !note.trim())}
        onClick={async () => { if (!noteFor) return; if (await act(`/returns/${noteFor.ret.id}/${noteFor.action}`, { note }, noteFor.action === 'reject' ? 'Devolución rechazada' : noteFor.action === 'approve' ? 'Devolución aprobada' : 'Cambio registrado')) setNoteFor(null); }}>{busy && <Spinner />} Confirmar</button></>}>
      <Field label={noteFor?.action === 'reject' ? 'Motivo del rechazo (el cliente lo verá)' : 'Nota para el cliente (opcional)'} hint={noteFor?.action === 'approve' ? 'Ej. «Envíalo a Cra 10 # 20-30» o «Tráelo a la tienda con la factura».' : noteFor?.action === 'exchange' ? 'Si entregaste otro producto, regístralo como venta o ajuste de inventario.' : undefined}>
        <textarea className="input min-h-24" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>

    <Modal open={Boolean(receiving)} onClose={() => setReceiving(null)} title={`Recibir devolución #${receiving?.number ?? ''}`}
      footer={<><button className="btn-secondary" onClick={() => setReceiving(null)}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={async () => { if (receiving && await act(`/returns/${receiving.id}/receive`, { restock }, 'Producto recibido')) setReceiving(null); }}>{busy && <Spinner />} Confirmar recepción</button></>}>
      <p className="text-sm text-ink-muted mb-3">Marca lo que está en buen estado para volver a venderlo: se suma al inventario. Lo dañado no se repone.</p>
      <div className="space-y-2">{receiving?.items.map((i) => <label key={key(i)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm"><input type="checkbox" className="accent-ink" checked={restock.includes(key(i))} onChange={(e) => setRestock((r) => e.target.checked ? [...r, key(i)] : r.filter((x) => x !== key(i)))} />{i.quantity} × {i.name}<span className="ml-auto text-xs text-ink-muted">{restock.includes(key(i)) ? 'Vuelve al inventario' : 'No se repone'}</span></label>)}</div>
    </Modal>

    <Modal open={Boolean(refunding)} onClose={() => setRefunding(null)} title={`Reembolso de la devolución #${refunding?.number ?? ''}`}
      footer={<><button className="btn-secondary" onClick={() => setRefunding(null)}>Cancelar</button><button className="btn-primary" disabled={busy || !Number(refund.amount)} onClick={async () => { if (refunding && await act(`/returns/${refunding.id}/refund`, refund, 'Reembolso registrado')) setRefunding(null); }}>{busy && <Spinner />} Registrar reembolso</button></>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">Primero haz la devolución del dinero por tu banco, billetera o pasarela; aquí solo queda registrada. Máximo: {refunding ? money(lineTotal(refunding.items)) : ''}.</p>
        <Field label="Valor devuelto (COP)"><input className="input" inputMode="decimal" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
        <Field label="Cómo se devolvió"><select className="input" value={refund.method} onChange={(e) => setRefund({ ...refund, method: e.target.value })}>{Object.entries(REFUND_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Referencia o comprobante (opcional)"><input className="input" maxLength={120} value={refund.reference} onChange={(e) => setRefund({ ...refund, reference: e.target.value })} /></Field>
      </div>
    </Modal>

    {creating && <NewReturn preset={preset} reasons={data?.reasons ?? {}} businessName={current?.tradeName ?? ''} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); toast('Devolución registrada'); }} />}
  </>;
}

function NewReturn({ preset, reasons, onClose, onSaved }: { preset: { source: 'SALE' | 'STORE_ORDER'; id: string } | null; reasons: Record<string, string>; businessName: string; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const { data: results } = useApi<any[]>(!preset && dq.trim().length >= 1 ? `/returns/purchases?q=${encodeURIComponent(dq.trim())}` : null);
  const [picked, setPicked] = useState(preset);
  const { data: el, error } = useApi<any>(picked ? `/returns/eligible?source=${picked.source}&id=${picked.id}` : null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('DEFECTIVE');
  const [resolution, setResolution] = useState<'REFUND' | 'EXCHANGE'>('REFUND');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lines = (el?.items ?? []).filter((i: any) => (qty[key(i)] ?? 0) > 0);
  const save = async () => {
    if (!picked) return;
    setBusy(true); setErr('');
    try {
      await api('/returns', { body: { source: picked.source, ...(picked.source === 'SALE' ? { saleId: picked.id } : { storeOrderId: picked.id }), reason, resolution, details: details || undefined,
        items: lines.map((i: any) => ({ productId: i.productId, variantId: i.variantId ?? undefined, quantity: qty[key(i)] })) } });
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} wide title="Registrar devolución"
    footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !lines.length} onClick={save}>{busy && <Spinner />} Registrar</button></>}>
    <div className="space-y-4">
      {err && <ErrorBox message={err} />}
      {!picked ? <>
        <Field label="Busca la compra" hint="Número de venta (ej. 125), número de pedido web o nombre del cliente."><div className="relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" /><input autoFocus className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div></Field>
        <div className="divide-y divide-line">{(results ?? []).map((r) => <button key={r.id} type="button" className="w-full text-left py-2.5 flex justify-between gap-3 hover:bg-sand-50 px-2 rounded-lg" onClick={() => setPicked({ source: r.source, id: r.id })}><span><span className="font-medium text-sm">{r.label}</span><span className="block text-xs text-ink-muted">{r.customer ?? 'Sin cliente'} · {date(r.date)}</span></span><span className="text-sm tabular-nums">{money(r.total)}</span></button>)}</div>
      </> : error ? <ErrorBox message={error} /> : !el ? <Loading /> : <>
        <div className="flex items-center justify-between"><p className="text-sm"><b>{el.label}</b> · {el.customerName} · {date(el.date)}</p>{!preset && <button className="btn-ghost btn-sm" onClick={() => { setPicked(null); setQty({}); }}>Cambiar compra</button>}</div>
        <div className="space-y-2">{el.items.map((i: any) => <div key={key(i)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm"><span className="flex-1">{i.name}<span className="block text-xs text-ink-muted">{money(i.unitPrice)} c/u · compró {i.bought}{i.available < i.bought ? ` · ya en devolución ${i.bought - i.available}` : ''}</span></span>
          <input type="number" min={0} max={i.available} disabled={!i.available} className="input w-20" value={qty[key(i)] ?? 0} onChange={(e) => setQty({ ...qty, [key(i)]: Math.max(0, Math.min(i.available, Number(e.target.value) || 0)) })} aria-label={`Cantidad a devolver de ${i.name}`} /></div>)}</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Motivo"><select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="El cliente quiere"><select className="input" value={resolution} onChange={(e) => setResolution(e.target.value as 'REFUND' | 'EXCHANGE')}><option value="REFUND">Que le devuelvan el dinero</option><option value="EXCHANGE">Cambiarlo por otro producto</option></select></Field>
          <Field label="Detalles (opcional)" className="sm:col-span-2"><textarea className="input min-h-16" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-ink-muted">Total a devolver: <b>{money(lineTotal(lines.map((i: any) => ({ ...i, quantity: qty[key(i)] }))))}</b>. Queda aprobada; luego registras la recepción y el reembolso o cambio.</p>
      </>}
    </div>
  </Modal>;
}

export default function Page() {
  return <Suspense fallback={<Loading />}><ReturnsPage /></Suspense>;
}
