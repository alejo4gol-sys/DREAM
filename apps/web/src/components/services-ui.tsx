'use client';
import { Search, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { JobStatus, STATUS_TONE, profileFor } from '@/lib/service-profiles';
import { Badge, Field, Spinner } from './ui';

export const useProfile = () => {
  const { current } = useAuth();
  return profileFor(current?.serviceProfile);
};

export function JobStatusBadge({ status }: { status: string }) {
  const p = useProfile();
  return <Badge tone={STATUS_TONE[status as JobStatus] ?? 'muted'}>{p.statuses[status as JobStatus] ?? status}</Badge>;
}

export type PickedCustomer = { id: string; name: string; phone?: string | null } | null;

/** Busca un cliente existente o lo crea en el momento (nombre y celular). */
export function CustomerSelect({ value, onChange, label = 'Cliente' }: { value: PickedCustomer; onChange: (c: PickedCustomer) => void; label?: string }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const { data } = useApi<any>(!value && dq.trim().length >= 1 ? `/customers?q=${encodeURIComponent(dq.trim())}&pageSize=6` : null);
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (value) return <Field label={label}><div className="flex items-center gap-2 rounded-xl border border-line px-3 h-10 bg-sand-50"><span className="text-sm flex-1 truncate">{value.name}{value.phone ? <span className="text-ink-muted"> · {value.phone}</span> : null}</span><button type="button" className="btn-ghost !px-1.5 !h-7" onClick={() => onChange(null)} aria-label="Cambiar cliente"><X className="h-4 w-4" /></button></div></Field>;
  const create = async () => {
    setBusy(true); setErr('');
    try { const c = await api<any>('/customers', { body: { name: q.trim(), phone: phone.trim() || undefined } }); onChange({ id: c.id, name: c.name, phone: c.phone }); setCreating(false); setQ(''); setPhone(''); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Field label={label} hint={err ? <span className="text-bad">{err}</span> : undefined}>
    <div className="relative">
      <Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" />
      <input className="input pl-9" value={q} onChange={(e) => { setQ(e.target.value); setCreating(false); }} placeholder="Busca por nombre o celular" />
      {q.trim().length >= 1 && !creating && <div className="absolute z-20 mt-1 w-full card shadow-pop overflow-hidden">
        {(data?.items ?? []).map((c: any) => <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-sand-50" onClick={() => { onChange({ id: c.id, name: c.name, phone: c.phone }); setQ(''); }}>{c.name}<span className="text-xs text-ink-muted"> {c.phone ?? ''}</span></button>)}
        <button type="button" className="w-full text-left px-3 py-2 text-sm text-ink border-t border-line hover:bg-sand-50 flex items-center gap-2" onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" /> Crear «{q.trim()}» como cliente nuevo</button>
      </div>}
    </div>
    {creating && <div className="mt-2 flex gap-2"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular (opcional)" inputMode="tel" /><button type="button" className="btn-secondary shrink-0" disabled={busy || q.trim().length < 2} onClick={create}>{busy && <Spinner />} Crear</button></div>}
  </Field>;
}

export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const fromLocalInput = (v: string) => new Date(v).toISOString();
export const timeOf = (d: string | Date) => new Date(d).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
export const waLink = (phone: string | null | undefined, text: string) => {
  const d = String(phone ?? '').replace(/\D/g, '');
  return d.length >= 7 ? `https://wa.me/${d.length === 10 && d.startsWith('3') ? '57' + d : d}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
};
