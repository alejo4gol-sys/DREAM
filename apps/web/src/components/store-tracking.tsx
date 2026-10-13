'use client';
import { CalendarDays, Search, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { JobStatus, MODALITY, STATUS_ORDER, profileFor } from '@/lib/service-profiles';
import { onColor } from '@/lib/store-site';

/** Seguimiento para clientes de negocios de servicios: estado del caso u orden con código + celular. */
export function StoreTracking({ slug, profile, primary, radius, businessName, initialCode, onClose, preview }: {
  slug: string; profile?: string | null; primary: string; radius: number; businessName: string; initialCode?: string; onClose: () => void; preview?: boolean;
}) {
  const p = profileFor(profile);
  const [code, setCode] = useState(initialCode ?? '');
  const [phone, setPhone] = useState('');
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const btn = { background: primary, color: onColor(primary), borderRadius: radius };
  const search = async () => {
    if (preview) { setErr('Desactivado en la vista previa.'); return; }
    setBusy(true); setErr('');
    try { setData(await api(`/store/${encodeURIComponent(slug)}/track?code=${encodeURIComponent(code.trim())}&phone=${encodeURIComponent(phone)}`)); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const steps = STATUS_ORDER.filter((s) => s !== 'CANCELLED');
  const idx = data ? steps.indexOf(data.status) : -1;
  return <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={p.trackingLabel}>
    <div className="bg-white text-[#171717] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold flex items-center gap-2"><Search className="h-5 w-5" /> {p.trackingLabel}</h2><button onClick={onClose} aria-label="Cerrar" className="h-8 w-8 rounded-full hover:bg-black/5 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
      {err && <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-xl p-3 mb-3">{err}</p>}
      {!data ? <div className="space-y-3">
        <p className="text-sm opacity-75">Escribe el código que te dio {businessName} y el celular con el que te registraste.</p>
        <input className="w-full rounded-xl border p-3 text-sm font-mono uppercase tracking-widest" placeholder="Código (ej. K7M2QX)" maxLength={12} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        <input className="w-full rounded-xl border p-3 text-sm" placeholder="Celular" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="w-full py-3 text-sm font-medium disabled:opacity-40" style={btn} disabled={busy || code.length < 6 || phone.replace(/\D/g, '').length < 7} onClick={search}>{busy ? 'Buscando…' : 'Consultar'}</button>
      </div> : <div className="space-y-4">
        <div><p className="text-xs opacity-60">{p.job.singular} #{data.number}</p><p className="font-semibold text-lg">{data.title}</p>
          <p className="text-sm mt-1"><span className="inline-flex rounded-full px-3 py-1 text-xs font-medium" style={{ background: `${primary}1a` }}>{data.status === 'CANCELLED' ? p.statuses.CANCELLED : p.statuses[data.status as JobStatus]}</span></p></div>
        {data.status !== 'CANCELLED' && <ol className="flex gap-1" aria-label="Avance">{steps.map((s, i) => <li key={s} className="flex-1"><span className="block h-1.5 rounded-full" style={{ background: i <= idx ? primary : '#e5e5e5' }} /><span className="block text-[9px] mt-1 opacity-60 leading-tight">{p.statuses[s]}</span></li>)}</ol>}
        {data.dueAt && !['DELIVERED', 'CANCELLED'].includes(data.status) && <p className="text-sm">{p.key === 'LEGAL' ? 'Próxima fecha importante' : 'Fecha estimada'}: <b>{new Date(data.dueAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</b></p>}
        {data.nextAppointment && <p className="text-sm flex gap-2 rounded-xl bg-black/5 p-3"><CalendarDays className="h-4 w-4 shrink-0 mt-0.5" /><span>{data.nextAppointment.title}: {new Date(data.nextAppointment.startsAt).toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} · {MODALITY[data.nextAppointment.modality]}{data.nextAppointment.location ? ` · ${data.nextAppointment.location}` : ''}</span></p>}
        {data.quote && <div className="rounded-xl border p-3 text-sm"><p className="font-medium mb-1">{p.quote}{data.quoteStatus === 'APPROVED' ? ' (aprobada)' : ''}</p>{data.quote.items.map((i: any, k: number) => <p key={k} className="flex justify-between text-xs"><span>{i.description}{Number(i.quantity) !== 1 ? ` × ${Number(i.quantity)}` : ''}</span><span>{money(Number(i.unitPrice) * Number(i.quantity))}</span></p>)}<p className="flex justify-between font-semibold mt-1 pt-1 border-t"><span>Total</span><span>{money(data.quote.total)}</span></p></div>}
        {data.warrantyDays > 0 && data.closedAt && data.status === 'DELIVERED' && <p className="text-xs opacity-75">Garantía de {data.warrantyDays} días, hasta el {new Date(new Date(data.closedAt).getTime() + data.warrantyDays * 86400000).toLocaleDateString('es-CO')}.</p>}
        {data.events.length > 0 && <div><p className="text-xs opacity-60 mb-2">Novedades</p><ol className="space-y-2">{data.events.map((e: any, k: number) => <li key={k} className="text-sm"><p>{e.body}</p><p className="text-[11px] opacity-50">{new Date(e.occurredAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</p></li>)}</ol></div>}
        <button type="button" className="text-xs underline opacity-60" onClick={() => setData(null)}>Consultar otro</button>
      </div>}
    </div>
  </div>;
}
