'use client';
import { Check, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { onColor } from '@/lib/store-site';

type Lookup = {
  order: { code: string; date: string; deliveredAt: string | null; status: string };
  items: { productId: string; variantId: string | null; name: string; unitPrice: string; bought: number; available: number }[];
  deadline: string | null; windowDays: number; policy: string; blocked: string; reasons: Record<string, string>;
  existing: { number: number; status: string; requestedAt: string }[];
};
const STATUS: Record<string, string> = {
  REQUESTED: 'Recibida: la tienda la está revisando', APPROVED: 'Aprobada: sigue las indicaciones de la tienda', RECEIVED: 'La tienda recibió el producto',
  REFUNDED: 'Reembolso realizado', EXCHANGED: 'Cambio realizado', REJECTED: 'No fue aprobada',
};
const k = (i: { productId: string; variantId: string | null }) => `${i.productId}:${i.variantId ?? ''}`;

/** Solicitud y consulta de devoluciones para los clientes, desde la página web del negocio. */
export function StoreReturns({ slug, primary, radius, businessName, onClose, preview }: { slug: string; primary: string; radius: number; businessName: string; onClose: () => void; preview?: boolean }) {
  const [tab, setTab] = useState<'request' | 'status'>('request');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [info, setInfo] = useState<Lookup | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState<'REFUND' | 'EXCHANGE'>('REFUND');
  const [details, setDetails] = useState('');
  const [accept, setAccept] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const base = `/store/${encodeURIComponent(slug)}/returns`;
  const btn = { background: primary, color: onColor(primary), borderRadius: radius };
  const run = async (fn: () => Promise<void>) => {
    if (preview) { setErr('Desactivado en la vista previa.'); return; }
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const lookup = () => run(async () => { const r = await api<Lookup>(`${base}/lookup`, { body: { orderCode: code.trim(), phone } }); setInfo(r); setReason(Object.keys(r.reasons)[0]); setQty({}); });
  const send = () => run(async () => {
    const items = (info?.items ?? []).filter((i) => (qty[k(i)] ?? 0) > 0).map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined, quantity: qty[k(i)] }));
    const r = await api<{ number: number }>(base, { body: { orderCode: code.trim(), phone, items, reason, resolution, details: details.trim() || undefined, acceptedDataUse: accept } });
    setDone(r.number);
  });
  const check = () => run(async () => setStatus(await api(`${base}/status?number=${encodeURIComponent(number.replace('#', ''))}&phone=${encodeURIComponent(phone)}`)));
  const chosen = (info?.items ?? []).filter((i) => (qty[k(i)] ?? 0) > 0);
  const input = 'w-full rounded-xl border p-3 text-sm';

  return <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Devoluciones">
    <div className="bg-white text-[#171717] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Cambios y devoluciones</h2><button onClick={onClose} aria-label="Cerrar" className="h-8 w-8 rounded-full hover:bg-black/5 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 mb-4 text-sm">{([['request', 'Solicitar'], ['status', 'Consultar estado']] as const).map(([t, l]) =>
        <button key={t} type="button" onClick={() => { setTab(t); setErr(''); }} className={`rounded-lg py-2 ${tab === t ? 'bg-white shadow-sm font-medium' : 'opacity-70'}`}>{l}</button>)}</div>
      {err && <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-xl p-3 mb-3">{err}</p>}

      {tab === 'status' ? <div className="space-y-3">
        <input className={input} placeholder="Número de devolución (ej. 12)" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className={input} placeholder="Celular con el que compraste" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="w-full py-3 text-sm font-medium disabled:opacity-40" style={btn} disabled={busy || !number || phone.replace(/\D/g, '').length < 7} onClick={check}>{busy ? 'Buscando…' : 'Consultar'}</button>
        {status && <div className="rounded-xl bg-black/5 p-4 text-sm space-y-1"><p className="font-medium">Devolución #{status.number}</p><p>{STATUS[status.status] ?? status.status}</p>
          {status.refundAmount && <p>Valor reembolsado: {money(status.refundAmount)}</p>}{status.responseNote && <p className="opacity-75">Mensaje de la tienda: {status.responseNote}</p>}
          <p className="text-xs opacity-60">{status.items.map((i: any) => `${i.quantity} × ${i.name}`).join(' · ')}</p></div>}
      </div>

        : done ? <div className="text-center space-y-3 py-4"><span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></span>
          <p className="font-semibold">Recibimos tu solicitud #{done}</p><p className="text-sm opacity-70">{businessName} la revisará y te contactará. Guarda el número para consultar el estado.</p>
          <button className="px-5 py-2.5 text-sm font-medium" style={btn} onClick={onClose}>Listo</button></div>

          : !info ? <div className="space-y-3">
            <p className="text-sm opacity-75">Escribe el número de tu pedido (lo encuentras en la confirmación o en el mensaje de WhatsApp) y el celular con el que compraste.</p>
            <input className={`${input} font-mono`} placeholder="Número de pedido (ej. 2e8b604e)" value={code} onChange={(e) => setCode(e.target.value.trim())} maxLength={9} />
            <input className={input} placeholder="Celular" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="w-full py-3 text-sm font-medium disabled:opacity-40" style={btn} disabled={busy || code.replace('#', '').length !== 8 || phone.replace(/\D/g, '').length < 7} onClick={lookup}>{busy ? 'Buscando…' : 'Buscar mi pedido'}</button>
          </div>

            : <div className="space-y-3">
              <p className="text-sm">Pedido <b>#{info.order.code}</b>{info.deadline && !info.blocked ? <span className="opacity-60"> · puedes solicitarla hasta el {new Date(info.deadline).toLocaleDateString('es-CO')}</span> : null}</p>
              {info.existing.length > 0 && <p className="text-xs rounded-xl bg-black/5 p-3">Ya tienes {info.existing.length === 1 ? 'una solicitud' : 'solicitudes'}: {info.existing.map((e) => `#${e.number} (${STATUS[e.status]?.split(':')[0] ?? e.status})`).join(', ')}.</p>}
              {info.blocked ? <p className="text-sm rounded-xl bg-amber-50 text-amber-900 p-3">{info.blocked}</p> : <>
                <p className="text-xs opacity-70">¿Qué quieres devolver?</p>
                {info.items.map((i) => <div key={k(i)} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><span className="flex-1">{i.name}<span className="block text-xs opacity-60">{money(i.unitPrice)} c/u{i.available < i.bought ? ` · ${i.bought - i.available} ya en devolución` : ''}</span></span>
                  <div className="flex items-center gap-2"><button type="button" className="h-8 w-8 rounded-full border disabled:opacity-30" disabled={!(qty[k(i)] ?? 0)} onClick={() => setQty({ ...qty, [k(i)]: (qty[k(i)] ?? 0) - 1 })} aria-label="Menos">−</button><span className="w-5 text-center">{qty[k(i)] ?? 0}</span><button type="button" className="h-8 w-8 rounded-full border disabled:opacity-30" disabled={(qty[k(i)] ?? 0) >= i.available} onClick={() => setQty({ ...qty, [k(i)]: (qty[k(i)] ?? 0) + 1 })} aria-label="Más">+</button></div></div>)}
                <label className="block text-xs opacity-70">Motivo<select className={`${input} mt-1 bg-white`} value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(info.reasons).map(([key, l]) => <option key={key} value={key}>{l}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-2">{([['REFUND', 'Devolución del dinero'], ['EXCHANGE', 'Cambio por otro producto']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setResolution(v)} className="rounded-xl border p-3 text-xs font-medium" style={resolution === v ? { borderColor: primary, boxShadow: `0 0 0 1px ${primary}` } : undefined}>{l}</button>)}</div>
                <textarea className={input} rows={3} maxLength={1000} placeholder="Cuéntanos qué pasó (opcional)" value={details} onChange={(e) => setDetails(e.target.value)} />
                {info.policy && <details className="text-xs opacity-75"><summary className="cursor-pointer">Ver política de cambios y devoluciones</summary><p className="mt-2 whitespace-pre-line">{info.policy}</p></details>}
                <label className="flex items-start gap-2 text-xs opacity-80"><input type="checkbox" className="mt-0.5" checked={accept} onChange={(e) => setAccept(e.target.checked)} /><span>Autorizo a {businessName} a usar estos datos para gestionar mi devolución.</span></label>
                <button className="w-full py-3 text-sm font-semibold disabled:opacity-40" style={btn} disabled={busy || !chosen.length || !accept} onClick={send}>{busy ? 'Enviando…' : `Solicitar devolución${chosen.length ? ` · ${money(chosen.reduce((a, i) => a + Number(i.unitPrice) * qty[k(i)], 0))}` : ''}`}</button>
              </>}
              <button type="button" className="text-xs underline opacity-60" onClick={() => setInfo(null)}>Buscar otro pedido</button>
            </div>}
    </div>
  </div>;
}
