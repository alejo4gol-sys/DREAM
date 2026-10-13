'use client';
import {
  AlertTriangle, BellRing, CheckCircle2, ExternalLink, FileText, Gavel, Info, Landmark, MessageCircle, Pause, Play, Plus, Radar, RefreshCw, Archive, Trash2, Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Badge, Card, Disclaimer, ErrorBox, Field, Loading, Modal, Spinner, cn, useToast } from './ui';

export type Source = {
  key: string; label: string; group: string; mode: 'AUTO' | 'MANUAL'; refLabel: string; refPlaceholder: string; refHelp?: string; digitsOnly?: boolean;
  extra?: { key: string; label: string; placeholder?: string; required?: boolean }[]; kinds: string[]; consultUrl?: string; consultLabel?: string; how: string; note?: string;
};
export type PwCatalog = { sources: Source[]; kinds: Record<string, string> };

export const usePwCatalog = () => useApi<PwCatalog>('/process-watch/catalog');
const shortDate = (s?: string | null) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const when = (d?: string | null) => (d ? new Date(d).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export function ModeBadge({ mode, remindDays }: { mode: string; remindDays?: number }) {
  return mode === 'AUTO'
    ? <Badge tone="ok"><Zap className="h-3 w-3" /> Automático</Badge>
    : <Badge tone="sand"><BellRing className="h-3 w-3" /> Recordatorio{remindDays ? ` cada ${remindDays} d` : ''}</Badge>;
}

/** Lista compacta de procesos vigilados. */
export function ProcessList({ rows, onOpen }: { rows: any[]; onOpen: (w: any) => void }) {
  if (!rows.length) return null;
  return <ul className="divide-y divide-line">
    {rows.map((w) => <li key={w.id}>
      <button className="w-full text-left py-3 flex items-start gap-3 hover:bg-sand-50 rounded-lg px-2 -mx-2" onClick={() => onOpen(w)}>
        <span className={cn('mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0', w.mode === 'AUTO' ? 'bg-emerald-50 text-ok' : 'bg-sand-100 text-sand-600')}>
          {w.source === 'RAMA_JUDICIAL' || w.source === 'SAMAI' || w.source === 'CORTE_CONSTITUCIONAL' ? <Gavel className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{w.title}</span>
            {w.unread > 0 && <span className="rounded-full bg-primary text-on-primary text-[11px] font-semibold px-2 h-5 inline-flex items-center">{w.unread} nueva{w.unread > 1 ? 's' : ''}</span>}
            {w.status === 'PAUSED' && <Badge>Pausado</Badge>}
            {w.status === 'ARCHIVED' && <Badge>Archivado</Badge>}
          </span>
          <span className="block text-xs text-ink-muted mt-0.5 truncate">{w.sourceLabel} · {w.referenceLabel}{w.job ? ` · Caso #${w.job.number}` : ''}</span>
          <span className="flex items-center gap-2 mt-1 flex-wrap text-xs">
            <ModeBadge mode={w.mode} remindDays={w.remindDays} />
            <span className="text-ink-muted">Última actuación: {shortDate(w.lastActivity)}</span>
            {w.lastError && w.status === 'ACTIVE' && <span className="text-warn inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Revisar</span>}
          </span>
        </span>
      </button>
    </li>)}
  </ul>;
}

/** Formulario para empezar a vigilar un proceso. */
export function AddProcessModal({ catalog, onClose, onSaved, lockJob, initialRef }: { catalog: PwCatalog; onClose: () => void; onSaved: (w: any) => void; lockJob?: { id: string; label: string }; initialRef?: string }) {
  const toast = useToast();
  const [src, setSrc] = useState<Source | null>(null);
  const [f, setF] = useState({ reference: initialRef ?? '', title: lockJob?.label.replace(/^#\d+\s*/, '') ?? '', kind: '', jobId: lockJob?.id ?? '', remindDays: 7, extra: {} as Record<string, string> });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { data: jobs } = useApi<any>(lockJob ? null : '/jobs?status=ALL');
  const groups = useMemo(() => [...new Set(catalog.sources.map((s) => s.group))], [catalog]);
  const pick = (s: Source) => {
    setSrc(s); setErr('');
    setF((x) => ({ ...x, kind: s.kinds[0], reference: s.digitsOnly || !initialRef ? x.reference : x.reference }));
  };
  const digits = src?.digitsOnly ? f.reference.replace(/\D/g, '') : '';
  const save = async () => {
    if (!src) return;
    setBusy(true); setErr('');
    try {
      const w = await api<any>('/process-watch', { body: { source: src.key, reference: f.reference, title: f.title, kind: f.kind, jobId: f.jobId || null, remindDays: Number(f.remindDays) || 7, extra: f.extra } });
      toast(src.mode === 'AUTO' ? (w.lastError ? 'Proceso guardado. Revisa el aviso de la consulta.' : 'Listo: ya estamos vigilando el proceso en la Rama Judicial') : 'Listo: te recordaremos revisar este proceso');
      onSaved(w);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title={src ? 'Vigilar proceso' : '¿Dónde está el proceso?'} wide
    footer={src && <><button className="btn-ghost" onClick={() => setSrc(null)}>Cambiar entidad</button><button className="btn-primary" disabled={busy || f.title.trim().length < 2 || f.reference.trim().length < 2} onClick={save}>{busy && <Spinner />}<Radar className="h-4 w-4" /> {src.mode === 'AUTO' ? 'Vigilar y consultar ahora' : 'Guardar seguimiento'}</button></>}>
    {!src ? <div className="space-y-5">
      {groups.map((g) => <div key={g}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{g}</p>
        <div className="grid sm:grid-cols-2 gap-2">{catalog.sources.filter((s) => s.group === g).map((s) => <button key={s.key} type="button" onClick={() => pick(s)}
          className="text-left rounded-xl border border-line p-3 hover:border-primary transition">
          <span className="flex items-start justify-between gap-2"><span className="font-medium text-sm leading-snug">{s.label}</span>{s.mode === 'AUTO' && <Badge tone="ok"><Zap className="h-3 w-3" /> Auto</Badge>}</span>
          <span className="block text-xs text-ink-muted mt-1">{s.how}</span>
        </button>)}</div>
      </div>)}
      <Disclaimer>Solo la Rama Judicial (Consulta de Procesos Nacional Unificada) permite consulta automática sin captcha. En las demás entidades DREAMS guarda el número, te lleva a la consulta oficial con un toque y te recuerda revisarla; cuando registras la novedad, se avisa a tu equipo.</Disclaimer>
    </div> : <div className="space-y-4">
      <div className={cn('rounded-xl p-3 text-sm flex gap-2', src.mode === 'AUTO' ? 'bg-emerald-50 text-emerald-900' : 'bg-sand-100')}>
        {src.mode === 'AUTO' ? <Zap className="h-4 w-4 mt-0.5 shrink-0" /> : <BellRing className="h-4 w-4 mt-0.5 shrink-0" />}
        <div><p className="font-medium">{src.label}</p><p>{src.how}</p>{src.note && <p className="text-xs mt-1 opacity-80">{src.note}</p>}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={src.refLabel} hint={src.digitsOnly ? `${digits.length} de ${src.refPlaceholder.replace(/\D/g, '').length} dígitos${src.refHelp ? ` · ${src.refHelp}` : ''}` : src.refHelp} className="sm:col-span-2">
          <input className="input font-mono" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder={src.refPlaceholder} inputMode={src.digitsOnly ? 'numeric' : undefined} autoFocus />
        </Field>
        {(src.extra ?? []).map((x) => <Field key={x.key} label={`${x.label}${x.required ? '' : ' (opcional)'}`}>
          <input className="input" value={f.extra[x.key] ?? ''} placeholder={x.placeholder} onChange={(e) => setF({ ...f, extra: { ...f.extra, [x.key]: e.target.value } })} />
        </Field>)}
        <Field label="Nombre para identificarlo"><input className="input" value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej. Tutela de doña Rosa contra la EPS" /></Field>
        <Field label="Tipo"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{src.kinds.map((k) => <option key={k} value={k}>{catalog.kinds[k]}</option>)}</select></Field>
        {lockJob ? <Field label="Caso"><input className="input" value={lockJob.label} disabled /></Field>
          : <Field label="Caso en DREAMS (opcional)"><select className="input" value={f.jobId} onChange={(e) => setF({ ...f, jobId: e.target.value })}><option value="">Sin caso</option>{(jobs?.items ?? []).map((j: any) => <option key={j.id} value={j.id}>#{j.number} · {j.title}</option>)}</select></Field>}
        {src.mode === 'MANUAL' && <Field label="Recordarme revisarlo cada"><select className="input" value={f.remindDays} onChange={(e) => setF({ ...f, remindDays: Number(e.target.value) })}>{[1, 2, 3, 5, 7, 10, 15, 30].map((d) => <option key={d} value={d}>{d} día{d > 1 ? 's' : ''}</option>)}</select></Field>}
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}
    </div>}
  </Modal>;
}

/** Ficha del proceso: datos, actuaciones y acciones. */
export function ProcessModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { data: w, error, reload, setData } = useApi<any>(`/process-watch/${id}`);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState<{ date: string; title: string; body: string } | null>(null);
  useEffect(() => { if (w?.unread) api(`/process-watch/${id}/read`, { method: 'POST' }).then(onChanged).catch(() => {}); }, [w?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try { const r = await fn(); if (r?.id) setData(r); else reload(); onChanged(); if (ok) toast(r?.info ?? ok); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  if (error) return <Modal open onClose={onClose} title="Proceso"><ErrorBox message={error} /></Modal>;
  if (!w) return <Modal open onClose={onClose} title="Proceso"><Loading /></Modal>;
  const procs: any[] = w.summary?.processes ?? [];
  const det = w.summary?.detail;
  const updates: any[] = w.updates ?? [];
  return <Modal open onClose={onClose} title={w.title} wide
    footer={<div className="flex flex-wrap gap-2 w-full">
      {w.status !== 'ARCHIVED' && <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => act('st', () => api(`/process-watch/${id}/status`, { method: 'PATCH', body: { status: w.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } }), w.status === 'ACTIVE' ? 'Seguimiento pausado' : 'Seguimiento reanudado')}>{w.status === 'ACTIVE' ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Reanudar</>}</button>}
      {w.status !== 'ARCHIVED' ? <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => act('ar', () => api(`/process-watch/${id}/status`, { method: 'PATCH', body: { status: 'ARCHIVED' } }), 'Proceso archivado')}><Archive className="h-4 w-4" /> Archivar (terminado)</button>
        : <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => act('ar', () => api(`/process-watch/${id}/status`, { method: 'PATCH', body: { status: 'ACTIVE' } }), 'Proceso reactivado')}><Play className="h-4 w-4" /> Reactivar</button>}
      <button className="btn-ghost btn-sm text-bad ml-auto" disabled={!!busy} onClick={() => { if (confirm('¿Eliminar este seguimiento y su historial de actuaciones?')) act('rm', async () => { await api(`/process-watch/${id}`, { method: 'DELETE' }); onClose(); }, 'Seguimiento eliminado'); }}><Trash2 className="h-4 w-4" /> Eliminar</button>
    </div>}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ModeBadge mode={w.mode} remindDays={w.remindDays} />
        <Badge tone="muted">{w.kindLabel}</Badge>
        {w.job && <Link className="chip bg-sand-100 text-ink hover:underline" href={`/trabajos/${w.jobId}`}>Caso #{w.job.number} · {w.job.title}</Link>}
      </div>
      <div className="rounded-xl border border-line p-3 text-sm grid sm:grid-cols-2 gap-x-4 gap-y-1">
        <p><span className="text-ink-muted">Entidad:</span> {w.sourceLabel}</p>
        <p><span className="text-ink-muted">Número:</span> <span className="font-mono">{w.referenceLabel}</span></p>
        {Object.entries(w.extra ?? {}).map(([k, v]) => <p key={k}><span className="text-ink-muted">{k === 'circulo' ? 'Círculo registral' : k === 'notaria' ? 'Notaría' : k === 'contacto' ? 'Contacto' : k === 'nit' ? 'NIT' : k === 'entidad' ? 'Entidad' : 'Enlace'}:</span> {String(v)}</p>)}
        {procs[0]?.despacho && <p className="sm:col-span-2"><span className="text-ink-muted">Despacho:</span> {procs[0].despacho}{procs.length > 1 ? ` (+${procs.length - 1} más)` : ''}</p>}
        {procs[0]?.sujetos && <p className="sm:col-span-2"><span className="text-ink-muted">Sujetos:</span> {procs[0].sujetos}</p>}
        {det?.claseProceso && <p><span className="text-ink-muted">Clase:</span> {det.tipoProceso ? `${det.tipoProceso} · ` : ''}{det.claseProceso}</p>}
        {det?.ponente && <p><span className="text-ink-muted">Ponente / juez:</span> {det.ponente}</p>}
        {w.mode === 'AUTO' && <p className="sm:col-span-2 text-xs text-ink-muted">Última consulta: {when(w.lastCheckedAt)} · Próxima: {w.status === 'ACTIVE' ? when(w.nextCheckAt) : 'pausado'}</p>}
        {w.mode === 'MANUAL' && w.status === 'ACTIVE' && <p className="sm:col-span-2 text-xs text-ink-muted">Próximo recordatorio: {when(w.nextCheckAt)}</p>}
      </div>
      {w.summary?.demo && <p className="rounded-xl bg-sand-100 p-3 text-xs">Proceso de ejemplo: no se consulta en la Rama Judicial. Registra un radicado real para verlo funcionar.</p>}
      {w.lastError && <p className="rounded-xl bg-amber-50 text-amber-900 p-3 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{w.lastError}</p>}
      <div className="flex flex-wrap gap-2">
        {w.mode === 'AUTO' && <button className="btn-primary btn-sm" disabled={!!busy || w.summary?.demo} onClick={() => act('chk', () => api(`/process-watch/${id}/check`, { method: 'POST' }), 'Consulta realizada')}>{busy === 'chk' ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Consultar ahora</button>}
        {w.consultUrl && <a className="btn-secondary btn-sm" href={w.consultUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> {w.mode === 'AUTO' ? 'Ver en la Rama Judicial' : `Consultar en la entidad`}</a>}
        {w.consultUrl && w.mode === 'MANUAL' && <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(w.reference).then(() => toast('Número copiado')).catch(() => {}); }}>Copiar número</button>}
        <button className="btn-secondary btn-sm" onClick={() => setNote({ date: todayIso(), title: '', body: '' })}><Plus className="h-4 w-4" /> Registrar novedad</button>
      </div>
      {w.mode === 'MANUAL' && w.how && <p className="text-xs text-ink-muted flex gap-1.5"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w.how}{w.note ? ` ${w.note}` : ''}</p>}
      {note && <div className="rounded-xl border border-line p-3 space-y-2">
        <div className="grid sm:grid-cols-[150px_1fr] gap-2">
          <input type="date" className="input" value={note.date} max={todayIso()} onChange={(e) => setNote({ ...note, date: e.target.value })} />
          <input className="input" placeholder="¿Qué pasó? Ej. Auto admite demanda / Fijan fecha de audiencia" value={note.title} maxLength={300} onChange={(e) => setNote({ ...note, title: e.target.value })} autoFocus />
        </div>
        <textarea className="input min-h-16" placeholder="Detalle (opcional)" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} />
        <div className="flex justify-end gap-2"><button className="btn-ghost btn-sm" onClick={() => setNote(null)}>Cancelar</button>
          <button className="btn-primary btn-sm" disabled={note.title.trim().length < 2 || !!busy} onClick={() => act('note', async () => { const r = await api(`/process-watch/${id}/updates`, { body: { date: note.date, title: note.title, body: note.body || undefined, notify: true } }); setNote(null); return r; }, 'Novedad registrada y equipo avisado')}>{busy === 'note' && <Spinner />}Guardar y avisar</button></div>
      </div>}
      <div>
        <p className="text-sm font-semibold mb-2">Actuaciones y novedades ({updates.filter((u) => u.origin !== 'SYSTEM').length})</p>
        <ol className="relative border-l border-line ml-2 space-y-3">
          {updates.map((u) => <li key={u.id} className="ml-4">
            <span className={cn('absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full', u.origin === 'SYSTEM' ? 'bg-sand-300' : !u.baseline ? 'bg-primary' : 'bg-ink-muted/40')} />
            <p className="text-xs text-ink-muted">{shortDate(u.date)}{u.origin === 'MANUAL' ? ' · registrada en DREAMS' : u.origin === 'SYSTEM' ? '' : ''}{!u.baseline && u.origin === 'AUTO' ? ' · nueva' : ''}</p>
            <p className={cn('text-sm', u.origin === 'SYSTEM' ? 'text-ink-muted italic' : 'font-medium')}>{u.title}{u.hasDocs && <FileText className="inline h-3.5 w-3.5 ml-1 text-ink-muted" aria-label="Con documentos" />}</p>
            {u.body && <p className="text-sm text-ink-muted whitespace-pre-line">{u.body}</p>}
            {(u.termStart || u.termEnd) && <p className="text-xs mt-0.5 text-warn">Término: {shortDate(u.termStart)} a {shortDate(u.termEnd)}</p>}
          </li>)}
        </ol>
      </div>
    </div>
  </Modal>;
}

/** Avisos por WhatsApp: autorización del usuario, plan y estado. */
export function WhatsappSettings() {
  const toast = useToast();
  const { data, error, setData } = useApi<any>('/whatsapp/me');
  const [f, setF] = useState<{ phone: string; consent: boolean; alerts: string[] } | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (data && !f) setF({ phone: data.contact?.phone ? `+${data.contact.phone}` : data.suggestedPhone ?? '', consent: !!data.contact, alerts: data.contact?.alerts ?? ['PROCESS_UPDATE', 'TERM_DUE'] });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorBox message={error} />;
  if (!data || !f) return <Loading />;
  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { const r = await fn(); if (r?.plan) setData(r); toast(ok); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  return <div className="grid lg:grid-cols-[1fr_340px] gap-5">
    <Card title={<span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Avisos a tu WhatsApp</span>}>
      <div className="space-y-4">
        {!data.plan.allowed && <div className="rounded-xl bg-amber-50 text-amber-900 p-3 text-sm">Tu plan {data.plan.plan} no incluye avisos por WhatsApp{data.plan.status !== 'ACTIVE' && data.plan.status !== 'TRIALING' ? ' o la suscripción no está activa' : ''}. Están incluidos desde el plan Emprendedor ($19.900 al mes). <Link className="underline font-medium" href="/configuracion">Ver planes</Link></div>}
        {!data.configured && <div className="rounded-xl bg-sand-100 p-3 text-sm flex gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5" /><span>El envío por WhatsApp se activa cuando DREAMS conecte su cuenta oficial de WhatsApp Business. Ya puedes dejar tu autorización lista; mientras tanto los avisos te llegan dentro de DREAMS.</span></div>}
        <Field label="Celular con WhatsApp"><input className="input" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="300 123 4567" /></Field>
        <div className="space-y-2">
          <p className="text-sm font-medium">¿Qué avisos quieres recibir?</p>
          {Object.entries(data.alerts as Record<string, string>).map(([k, label]) => <label key={k} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={f.alerts.includes(k)} onChange={(e) => setF({ ...f, alerts: e.target.checked ? [...f.alerts, k] : f.alerts.filter((x) => x !== k) })} /> {label}
          </label>)}
        </div>
        <label className="flex items-start gap-2 text-sm rounded-xl border border-line p-3"><input type="checkbox" className="mt-0.5" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} /><span>{data.consentText}</span></label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={!!busy || !f.consent || !f.alerts.length} onClick={() => run('save', () => api('/whatsapp/me', { method: 'PUT', body: f }), 'Autorización guardada')}>{busy === 'save' && <Spinner />}<CheckCircle2 className="h-4 w-4" /> {data.contact ? 'Actualizar' : 'Activar avisos'}</button>
          {data.contact && <button className="btn-secondary" disabled={!!busy || !data.plan.allowed} onClick={() => run('test', () => api('/whatsapp/me/test', { body: { alert: 'PROCESS_UPDATE' } }).then(() => api('/whatsapp/me')), data.configured ? 'Mensaje de prueba enviado' : 'Prueba registrada (WhatsApp aún no está conectado)')}>{busy === 'test' && <Spinner />}Enviar prueba</button>}
          {data.contact && <button className="btn-ghost text-bad" disabled={!!busy} onClick={() => { if (confirm('¿Dejar de recibir avisos por WhatsApp?')) run('rev', async () => { const r = await api('/whatsapp/me', { method: 'DELETE' }); setF({ ...f, consent: false }); return r; }, 'Ya no recibirás avisos por WhatsApp'); }}>Dejar de recibir</button>}
        </div>
        {data.contact && <p className="text-xs text-ink-muted">Autorizado el {new Date(data.contact.consentedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} para +{data.contact.phone}. También puedes responder STOP a cualquier aviso.</p>}
      </div>
    </Card>
    <Card title="Últimos avisos">
      {!data.recent.length ? <p className="text-sm text-ink-muted">Aún no se han enviado avisos.</p> : <ul className="space-y-2 text-sm">{data.recent.map((m: any) => <li key={m.id} className="border-b border-line pb-2">
        <p className="flex items-center justify-between gap-2"><span className="text-xs text-ink-muted">{when(m.createdAt)}</span><Badge tone={m.status === 'READ' || m.status === 'DELIVERED' || m.status === 'SENT' ? 'ok' : m.status === 'FAILED' ? 'bad' : 'muted'}>{({ SENT: 'Enviado', DELIVERED: 'Entregado', READ: 'Leído', FAILED: 'Falló', NOT_CONFIGURED: 'Sin conectar', SENDING: 'Enviando' } as Record<string, string>)[m.status] ?? m.status}</Badge></p>
        <p className="text-xs mt-0.5">{Object.values(m.params ?? {}).slice(1).join(' · ')}</p>
        {m.error && m.status === 'FAILED' && <p className="text-xs text-bad mt-0.5">{m.error}</p>}
      </li>)}</ul>}
    </Card>
  </div>;
}

/** Procesos vigilados de un caso (ficha del caso). */
export function JobProcesses({ jobId, jobLabel, radicado }: { jobId: string; jobLabel: string; radicado?: string }) {
  const { data: catalog } = usePwCatalog();
  const { data: rows, reload } = useApi<any[]>(`/process-watch?status=ALL&jobId=${jobId}`);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  return <Card title={<span className="flex items-center gap-2"><Radar className="h-4 w-4" /> Seguimiento del proceso</span>}
    actions={<button className="btn-ghost btn-sm no-print" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Vigilar</button>}>
    {!rows ? <Loading /> : !rows.length ? <p className="text-sm text-ink-muted">Sin seguimiento. {radicado ? 'Vigila el radicado de este caso para recibir cada actuación nueva.' : 'Agrega el radicado de la Rama Judicial o el número de la entidad para recibir avisos.'}</p>
      : <ProcessList rows={rows} onOpen={(w) => setOpen(w.id)} />}
    {open && <ProcessModal id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    {adding && catalog && <AddProcessModal catalog={catalog} lockJob={{ id: jobId, label: jobLabel }} initialRef={radicado} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
  </Card>;
}
