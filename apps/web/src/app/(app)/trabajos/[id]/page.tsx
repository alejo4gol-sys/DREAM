'use client';
import {
  ArrowLeft, CalendarPlus, Check, Clock, Copy, FileText, MessageCircle, Pencil, Plus, Printer, Receipt, Save, StickyNote, Trash2, Wallet, X,
} from 'lucide-react';
import Link from 'next/link';
import { JobTerms } from '@/components/legal-terms';
import { JobProcesses } from '@/components/process-watch';
import { JobDocuments } from '@/components/legal-docs';
import { CollectModal } from '@/components/growth';
import { useEffect, useState } from 'react';
import { AppointmentModal } from '@/components/appointment-modal';
import { JobStatusBadge, useProfile, waLink } from '@/components/services-ui';
import { Badge, Card, ErrorBox, Field, Loading, Modal, Spinner, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { METHODS, date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { APPT_STATUS, ITEM_KINDS, JobStatus, MODALITY, PRIORITY, STATUS_ORDER } from '@/lib/service-profiles';

type Item = { id?: string; productId: string | null; kind: string; description: string; quantity: string; unitPrice: string };
const hoursOf = (m: number) => `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim();

export default function JobDetail({ params }: { params: { id: string } }) {
  const p = useProfile();
  const toast = useToast();
  const { can, current } = useAuth();
  const { data: job, error, reload } = useApi<any>(`/jobs/${params.id}`);
  const { data: catalog } = useApi<any>('/products?pageSize=200');
  const { data: team } = useApi<{ userId: string; fullName: string }[]>('/services/team');
  const { data: store } = useApi<any>(can('business:manage') ? '/store/current' : null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsDirty, setItemsDirty] = useState(false);
  const [note, setNote] = useState({ type: 'NOTE' as 'NOTE' | 'TIME', body: '', minutes: '60', billable: true, visible: false });
  const [charging, setCharging] = useState(false);
  const [charge, setCharge] = useState({ paymentMethod: 'NEQUI', amountPaid: '', discount: '' });
  const [scheduling, setScheduling] = useState(false);
  const [collect, setCollect] = useState(false);
  const [busy, setBusy] = useState('');
  const write = can('sales:create');

  useEffect(() => {
    if (!job) return;
    setItems(job.items.map((i: any) => ({ id: i.id, productId: i.productId, kind: i.kind, description: i.description, quantity: String(Number(i.quantity)), unitPrice: String(Number(i.unitPrice)) })));
    setItemsDirty(false);
  }, [job]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!job) return <Loading />;
  const total = items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
  const closed = ['DELIVERED', 'CANCELLED'].includes(job.status);
  const phone = job.customer?.phone;
  const trackUrl = store?.enabled && store?.slug && typeof window !== 'undefined' ? `${window.location.origin}/tienda/${store.slug}?seguimiento=${job.trackingCode}` : '';

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); await reload(); if (ok) toast(ok); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const setStatus = (status: JobStatus) => run('status', () => api(`/jobs/${job.id}/status`, { method: 'PATCH', body: { status, label: p.statuses[status], visibleToCustomer: true } }), `Estado: ${p.statuses[status]}`);
  const saveItems = () => run('items', () => api(`/jobs/${job.id}/items`, { method: 'PUT', body: { items: items.filter((i) => i.description.trim()).map(({ id: _id, ...i }) => ({ ...i, quantity: i.quantity || '1', unitPrice: i.unitPrice || '0' })) } }), 'Valores guardados');
  const quote = (quoteStatus: 'SENT' | 'APPROVED' | 'REJECTED') => run('quote', () => api(`/jobs/${job.id}/quote`, { method: 'PATCH', body: { quoteStatus } }));
  const quoteText = () => [`Hola ${job.customer?.name ?? ''}, esta es la ${p.quote.toLowerCase()} de «${job.title}» (${current?.tradeName}):`, '',
    ...items.map((i) => `• ${i.description}${Number(i.quantity) !== 1 ? ` × ${i.quantity}` : ''}: ${money(Number(i.quantity) * Number(i.unitPrice))}`), '', `Total: ${money(total)}`,
    job.warrantyDays ? `Garantía: ${job.warrantyDays} días.` : '', '', '¿Nos confirmas si deseas continuar?'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  const statusText = () => `Hola ${job.customer?.name ?? ''}, te contamos de «${job.title}» (${current?.tradeName}): ${p.statuses[job.status as JobStatus]}.${trackUrl ? `\n\nPuedes ver el avance aquí: ${trackUrl}\nCódigo: ${job.trackingCode}` : `\nTu código de seguimiento es ${job.trackingCode}.`}`;
  const saveData = () => run('data', async () => {
    await api(`/jobs/${job.id}`, { method: 'PATCH', body: { title: form.title, category: form.category || '', priority: form.priority, assignedUserId: form.assignedUserId || null,
      dueAt: form.dueAt ? new Date(`${form.dueAt}T17:00:00`).toISOString() : null, warrantyDays: Number(form.warrantyDays) || 0, description: form.description, details: form.details } });
    setEditing(false);
  }, 'Datos guardados');
  const addEvent = () => run('event', async () => {
    await api(`/jobs/${job.id}/events`, { body: { type: note.type, body: note.body, minutes: note.type === 'TIME' ? Number(note.minutes) : undefined, billable: note.billable, visibleToCustomer: note.visible } });
    setNote({ ...note, body: '' });
  });
  const hourService = (catalog?.items ?? []).find((x: any) => x.isService && x.pricingUnit === 'HOUR' && /trabajo|hora/i.test(x.name)) ?? (catalog?.items ?? []).find((x: any) => x.isService && x.pricingUnit === 'HOUR');
  const billHours = () => {
    const h = Math.round((job.billableMinutes / 60) * 100) / 100;
    setItems((x) => [...x, { productId: hourService?.id ?? null, kind: p.key === 'LEGAL' ? 'FEE' : 'SERVICE', description: `${hourService?.name ?? 'Horas de trabajo'} (${hoursOf(job.billableMinutes)})`, quantity: String(h), unitPrice: String(Number(hourService?.salePrice ?? 0)) }]);
    setItemsDirty(true);
  };
  const doCharge = () => run('charge', async () => {
    await api(`/jobs/${job.id}/charge`, { body: { paymentMethod: charge.paymentMethod, amountPaid: String(Math.max(0, Math.min(Number(charge.amountPaid || 0), total - Number(charge.discount || 0)))), discount: charge.discount || undefined } });
    setCharging(false);
  }, 'Cobro registrado. Desde el cobro puedes expedir la factura.');

  return <>
    <Link href="/trabajos" className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1 mb-3 no-print"><ArrowLeft className="h-4 w-4" /> {p.job.plural}</Link>
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-5">
      <div>
        <p className="text-xs text-ink-muted">{p.job.singular} #{job.number} · creado {date(job.createdAt)}</p>
        <h1 className="font-display text-3xl font-semibold mt-1">{job.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2"><JobStatusBadge status={job.status} />{job.priority !== 'NORMAL' && <Badge tone={job.priority === 'URGENT' ? 'bad' : job.priority === 'HIGH' ? 'warn' : 'muted'}>Prioridad {PRIORITY[job.priority].toLowerCase()}</Badge>}{job.category && <Badge tone="sand">{job.category}</Badge>}</div>
      </div>
      <div className="flex flex-wrap gap-2 no-print">
        <a className="btn-secondary" href={waLink(phone, statusText())} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Avisar al cliente</a>
        <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</button>
      </div>
    </div>

    {write && !closed && <div className="mb-5 overflow-x-auto no-print"><div className="inline-flex rounded-2xl border border-line bg-white p-1 gap-1 min-w-max">{STATUS_ORDER.filter((s) => s !== 'CANCELLED').map((s, i) => {
      const reached = STATUS_ORDER.indexOf(job.status) >= i;
      return <button key={s} disabled={busy === 'status'} onClick={() => setStatus(s)} className={cn('px-3 h-9 rounded-xl text-xs font-medium transition', job.status === s ? 'bg-primary text-on-primary' : reached ? 'bg-sand-100 text-ink' : 'text-ink-muted hover:bg-sand-50')}>{p.statuses[s]}</button>;
    })}<button onClick={() => setStatus('CANCELLED')} className="px-3 h-9 rounded-xl text-xs text-bad hover:bg-red-50">{p.statuses.CANCELLED}</button></div></div>}
    {write && closed && <div className="mb-5 no-print"><button className="btn-ghost btn-sm" onClick={() => setStatus('IN_PROGRESS')}>Reabrir</button></div>}

    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <Card title="Datos" actions={write && !editing && <button className="btn-ghost btn-sm no-print" onClick={() => { setForm({ title: job.title, category: job.category ?? '', priority: job.priority, assignedUserId: job.assignedUserId ?? '', dueAt: job.dueAt ? new Date(job.dueAt).toLocaleDateString('en-CA') : '', warrantyDays: String(job.warrantyDays), description: job.description ?? '', details: { ...job.details } }); setEditing(true); }}><Pencil className="h-3.5 w-3.5" /> Editar</button>}>
          {!editing ? <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-xs text-ink-muted">{p.customer}</dt><dd>{job.customer ? <Link className="underline" href={`/clientes/${job.customer.id}`}>{job.customer.name}</Link> : '—'}{phone ? <span className="text-ink-muted"> · {phone}</span> : null}</dd></div>
            <div><dt className="text-xs text-ink-muted">Responsable</dt><dd>{job.assignedName ?? 'Sin asignar'}</dd></div>
            <div><dt className="text-xs text-ink-muted">{p.dueLabel}</dt><dd className={job.dueAt && new Date(job.dueAt) < new Date() && !closed ? 'text-bad font-medium' : ''}>{job.dueAt ? date(job.dueAt) : '—'}</dd></div>
            {p.showWarranty && <div><dt className="text-xs text-ink-muted">Garantía</dt><dd>{job.warrantyDays ? `${job.warrantyDays} días` : 'Sin garantía'}</dd></div>}
            {p.fields.map((f) => <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}><dt className="text-xs text-ink-muted">{f.label}</dt><dd className="whitespace-pre-line">{job.details?.[f.key] || '—'}</dd></div>)}
            {job.description && <div className="sm:col-span-2"><dt className="text-xs text-ink-muted">Descripción</dt><dd className="whitespace-pre-line">{job.description}</dd></div>}
          </dl> : <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Título" className="sm:col-span-2"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Categoría"><input className="input" list="cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /><datalist id="cats">{p.categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label="Prioridad"><select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label={p.dueLabel}><input type="date" className="input" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></Field>
            <Field label="Responsable"><select className="input" value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}><option value="">Sin asignar</option>{(team ?? []).map((t) => <option key={t.userId} value={t.userId}>{t.fullName}</option>)}</select></Field>
            {p.showWarranty && <Field label="Garantía (días)"><input className="input" inputMode="numeric" value={form.warrantyDays} onChange={(e) => setForm({ ...form, warrantyDays: e.target.value.replace(/\D/g, '') })} /></Field>}
            {p.fields.map((f) => <Field key={f.key} label={f.label} className={f.wide ? 'sm:col-span-2' : ''}>
              {f.type === 'select' ? <select className="input" value={form.details[f.key] ?? ''} onChange={(e) => setForm({ ...form, details: { ...form.details, [f.key]: e.target.value } })}><option value="">Elige…</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                : f.type === 'area' ? <textarea className="input min-h-16" value={form.details[f.key] ?? ''} onChange={(e) => setForm({ ...form, details: { ...form.details, [f.key]: e.target.value } })} />
                  : <input className="input" value={form.details[f.key] ?? ''} onChange={(e) => setForm({ ...form, details: { ...form.details, [f.key]: e.target.value } })} placeholder={f.placeholder} />}
            </Field>)}
            <Field label="Descripción" className="sm:col-span-2"><textarea className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button><button className="btn-primary" disabled={busy === 'data'} onClick={saveData}>{busy === 'data' && <Spinner />}<Save className="h-4 w-4" /> Guardar</button></div>
          </div>}
        </Card>

        {p.key === 'LEGAL' && <JobTerms jobId={job.id} jobLabel={`#${job.number} ${job.title}`} />}
        {p.key === 'LEGAL' && <JobProcesses jobId={job.id} jobLabel={`#${job.number} ${job.title}`} radicado={job.details?.filing ?? ''} />}
        {p.key === 'LEGAL' && <JobDocuments jobId={job.id} />}

        <Card title={<span className="flex items-center gap-2"><FileText className="h-4 w-4" /> {p.quote} y cobro</span>}
          actions={<span className="flex items-center gap-2">{job.quoteStatus !== 'NONE' && <Badge tone={job.quoteStatus === 'APPROVED' ? 'ok' : job.quoteStatus === 'REJECTED' ? 'bad' : 'warn'}>{job.quoteStatus === 'SENT' ? 'Enviada' : job.quoteStatus === 'APPROVED' ? 'Aprobada' : 'No aprobada'}</Badge>}{job.sale && <Badge tone={job.sale.status === 'PAID' ? 'ok' : 'warn'}>{job.sale.status === 'PAID' ? 'Pagado' : 'Saldo pendiente'}</Badge>}</span>}>
          <div className="space-y-2">
            {items.map((it, idx) => <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <select className="input col-span-12 sm:col-span-3 text-xs" disabled={!write || !!job.saleId} value={it.kind} onChange={(e) => { setItems(items.map((x, i) => i === idx ? { ...x, kind: e.target.value } : x)); setItemsDirty(true); }}>{Object.entries(ITEM_KINDS).filter(([k]) => p.partsLabel || k !== 'PART').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input className="input col-span-12 sm:col-span-4" disabled={!write || !!job.saleId} value={it.description} onChange={(e) => { setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x)); setItemsDirty(true); }} placeholder="Concepto" />
              <input className="input col-span-3 sm:col-span-1 text-center px-1" disabled={!write || !!job.saleId} inputMode="decimal" value={it.quantity} onChange={(e) => { setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value.replace(/[^0-9.]/g, '') } : x)); setItemsDirty(true); }} aria-label="Cantidad" />
              <input className="input col-span-5 sm:col-span-2" disabled={!write || !!job.saleId} inputMode="decimal" value={it.unitPrice} onChange={(e) => { setItems(items.map((x, i) => i === idx ? { ...x, unitPrice: e.target.value.replace(/[^0-9.]/g, '') } : x)); setItemsDirty(true); }} aria-label="Valor unitario" />
              <span className="col-span-3 sm:col-span-1 text-right text-sm tabular-nums">{money(Number(it.quantity) * Number(it.unitPrice))}</span>
              {write && !job.saleId && <button className="col-span-1 btn-ghost !px-1.5 text-bad justify-self-end" onClick={() => { setItems(items.filter((_, i) => i !== idx)); setItemsDirty(true); }} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>}
            </div>)}
            {!items.length && <p className="text-sm text-ink-muted">Agrega los {p.key === 'LEGAL' ? 'honorarios y gastos' : 'servicios y repuestos'} para enviar la {p.quote.toLowerCase()} y luego cobrar.</p>}
            {write && !job.saleId && <div className="flex flex-wrap gap-2 pt-1 no-print">
              <select className="input w-auto max-w-xs text-xs" value="" onChange={(e) => { const x = (catalog?.items ?? []).find((c: any) => c.id === e.target.value); if (!x) return; setItems([...items, { productId: x.id, kind: x.isService ? (p.key === 'LEGAL' ? 'FEE' : 'SERVICE') : 'PART', description: x.name, quantity: '1', unitPrice: String(Number(x.salePrice)) }]); setItemsDirty(true); }}>
                <option value="">+ Agregar del catálogo…</option>{(catalog?.items ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} · {money(c.salePrice)}{!c.isService ? ` (stock ${c.stock})` : ''}</option>)}</select>
              <button className="btn-secondary btn-sm" onClick={() => { setItems([...items, { productId: null, kind: p.key === 'LEGAL' ? 'FEE' : 'SERVICE', description: '', quantity: '1', unitPrice: '' }]); setItemsDirty(true); }}><Plus className="h-3.5 w-3.5" /> Concepto libre</button>
              {p.hours && job.billableMinutes > 0 && <button className="btn-secondary btn-sm" onClick={billHours}><Clock className="h-3.5 w-3.5" /> Agregar horas facturables ({hoursOf(job.billableMinutes)})</button>}
            </div>}
            <div className="flex justify-between items-center border-t border-line pt-3 mt-2"><span className="text-sm text-ink-muted">Total</span><span className="text-lg font-semibold tabular-nums">{money(total)}</span></div>
            {write && itemsDirty && <div className="flex justify-end"><button className="btn-primary" disabled={busy === 'items'} onClick={saveItems}>{busy === 'items' && <Spinner />}<Save className="h-4 w-4" /> Guardar valores</button></div>}
            {write && !itemsDirty && items.length > 0 && <div className="flex flex-wrap gap-2 justify-end pt-1 no-print">
              {!job.saleId && job.quoteStatus !== 'APPROVED' && <a className="btn-secondary" href={waLink(phone, quoteText())} target="_blank" rel="noreferrer" onClick={() => job.quoteStatus === 'NONE' && quote('SENT')}><MessageCircle className="h-4 w-4" /> Enviar {p.quote.toLowerCase()} por WhatsApp</a>}
              {!job.saleId && job.quoteStatus === 'SENT' && <><button className="btn-secondary" onClick={() => quote('APPROVED')}><Check className="h-4 w-4" /> Aprobada</button><button className="btn-ghost text-bad" onClick={() => quote('REJECTED')}><X className="h-4 w-4" /> No aprobada</button></>}
              {!job.saleId ? <button className="btn-primary" onClick={() => { setCharge({ paymentMethod: 'NEQUI', amountPaid: String(total), discount: '' }); setCharging(true); }}><Wallet className="h-4 w-4" /> Cobrar</button>
                : <><Link className="btn-secondary" href={`/ventas/${job.sale.id}`}><Receipt className="h-4 w-4" /> Ver cobro #{job.sale.number}{Number(job.sale.amountPaid) < Number(job.sale.total) ? ` · saldo ${money(Number(job.sale.total) - Number(job.sale.amountPaid))}` : ''}</Link>
                  {Number(job.sale.amountPaid) < Number(job.sale.total) && <button className="btn-primary" onClick={() => setCollect(true)}><Wallet className="h-4 w-4" /> Cobrar saldo</button>}</>}
            </div>}
          </div>
        </Card>
      </div>

      <div className="space-y-5 min-w-0">
        <Card title="Seguimiento del cliente">
          <p className="text-xs text-ink-muted">Con este código y su celular, tu cliente ve el estado y las novedades que marques como visibles, desde tu página web.</p>
          <div className="flex items-center gap-2 mt-2"><span className="font-mono text-xl font-semibold tracking-widest">{job.trackingCode}</span><button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(trackUrl || job.trackingCode).then(() => toast('Copiado'))}><Copy className="h-3.5 w-3.5" /> Copiar{trackUrl ? ' enlace' : ''}</button></div>
          {!trackUrl && can('business:manage') && <p className="text-[11px] text-ink-faint mt-1">Publica tu página web para que el cliente pueda consultarlo en línea.</p>}
        </Card>

        <Card title={`${p.appointments}`} actions={write && <button className="btn-ghost btn-sm no-print" onClick={() => setScheduling(true)}><CalendarPlus className="h-3.5 w-3.5" /> Agendar</button>}>
          {!job.appointments.length ? <p className="text-sm text-ink-muted">Sin {p.appointments.toLowerCase()} agendadas.</p> : <div className="space-y-2">{job.appointments.map((a: any) =>
            <div key={a.id} className="text-sm flex items-start gap-2"><span className="text-xs text-ink-muted w-24 shrink-0">{new Date(a.startsAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span><span className="flex-1">{a.title}<span className="block text-[11px] text-ink-muted">{MODALITY[a.modality]}{a.location ? ` · ${a.location}` : ''}</span></span><Badge tone={APPT_STATUS[a.status]?.tone ?? 'muted'}>{APPT_STATUS[a.status]?.label ?? a.status}</Badge></div>)}</div>}
        </Card>

        <Card title={p.key === 'LEGAL' ? 'Actuaciones y notas' : 'Bitácora'}>
          {write && <div className="space-y-2 mb-4 no-print">
            <div className="inline-flex rounded-lg bg-sand-100 p-0.5 text-xs">{([['NOTE', 'Nota', StickyNote], ['TIME', 'Horas', Clock]] as const).map(([k, l, Icon]) => <button key={k} type="button" onClick={() => setNote({ ...note, type: k })} className={cn('h-7 px-2.5 rounded-md inline-flex items-center gap-1', note.type === k ? 'bg-white shadow-card' : 'text-ink-muted')}><Icon className="h-3.5 w-3.5" />{l}</button>)}</div>
            <textarea className="input min-h-16" maxLength={4000} value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} placeholder={note.type === 'TIME' ? '¿En qué trabajaste?' : p.key === 'LEGAL' ? 'Ej. Se radicó memorial de impulso procesal' : 'Ej. Se cambió el flex del táctil'} />
            {note.type === 'TIME' && <div className="flex items-center gap-2"><select className="input w-32" value={note.minutes} onChange={(e) => setNote({ ...note, minutes: e.target.value })}>{[15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480].map((m) => <option key={m} value={m}>{hoursOf(m)}</option>)}</select><label className="text-xs flex items-center gap-1.5"><input type="checkbox" className="accent-ink" checked={note.billable} onChange={(e) => setNote({ ...note, billable: e.target.checked })} /> Facturable</label></div>}
            <div className="flex items-center justify-between"><label className="text-xs flex items-center gap-1.5"><input type="checkbox" className="accent-ink" checked={note.visible} onChange={(e) => setNote({ ...note, visible: e.target.checked })} /> Visible para el cliente</label><button className="btn-primary btn-sm" disabled={!note.body.trim() || busy === 'event'} onClick={addEvent}>{busy === 'event' && <Spinner />} Agregar</button></div>
          </div>}
          {p.hours && job.minutes > 0 && <p className="text-xs text-ink-muted mb-3">Tiempo registrado: <b>{hoursOf(job.minutes)}</b> · facturable {hoursOf(job.billableMinutes)}</p>}
          <ol className="space-y-3">{job.events.map((e: any) => <li key={e.id} className="flex gap-3 text-sm">
            <span className={cn('mt-1 h-2 w-2 rounded-full shrink-0', e.type === 'STATUS' ? 'bg-primary' : e.type === 'TIME' ? 'bg-sand-500' : e.type === 'PAYMENT' ? 'bg-emerald-500' : 'bg-line')} />
            <div className="flex-1 min-w-0"><p className="whitespace-pre-line">{e.body}</p><p className="text-[11px] text-ink-faint">{new Date(e.occurredAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}{e.userName ? ` · ${e.userName}` : ''}{e.minutes ? ` · ${hoursOf(e.minutes)}${e.billable ? ' facturable' : ''}` : ''}{e.visibleToCustomer ? ' · visible al cliente' : ''}</p></div>
            {write && ['NOTE', 'TIME'].includes(e.type) && <button className="btn-ghost !px-1 !h-6 text-ink-faint hover:text-bad no-print" onClick={() => run('del', () => api(`/jobs/${job.id}/events/${e.id}`, { method: 'DELETE' }))} aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>}
          </li>)}</ol>
        </Card>
      </div>
    </div>

    <Modal open={charging} onClose={() => setCharging(false)} title="Registrar cobro"
      footer={<><button className="btn-secondary" onClick={() => setCharging(false)}>Cancelar</button><button className="btn-primary" disabled={busy === 'charge'} onClick={doCharge}>{busy === 'charge' && <Spinner />} Registrar</button></>}>
      <div className="space-y-3">
        <p className="text-sm">Total: <b>{money(total - Number(charge.discount || 0))}</b>. Se crea en Cobros{p.partsLabel ? `; los ${p.partsLabel.toLowerCase()} se descuentan del inventario` : ''}.</p>
        <Field label="Medio de pago"><select className="input" value={charge.paymentMethod} onChange={(e) => setCharge({ ...charge, paymentMethod: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Descuento (opcional)"><input className="input" inputMode="decimal" value={charge.discount} onChange={(e) => setCharge({ ...charge, discount: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
        <Field label="Valor que paga ahora" hint="Si es un anticipo o abono, el resto queda como cuenta por cobrar."><input className="input" inputMode="decimal" value={charge.amountPaid} onChange={(e) => setCharge({ ...charge, amountPaid: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
      </div>
    </Modal>
    {scheduling && <AppointmentModal job={{ id: job.id, title: job.title, customer: job.customer ? { id: job.customer.id, name: job.customer.name, phone: job.customer.phone } : null }} onClose={() => setScheduling(false)} onSaved={() => { setScheduling(false); reload(); toast('Agendado'); }} />}
    {collect && job.sale && <CollectModal saleId={job.sale.id} open onClose={() => { setCollect(false); reload(); }} />}
  </>;
}
