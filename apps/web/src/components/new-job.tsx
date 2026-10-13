'use client';
import { useState } from 'react';
import { CustomerSelect, PickedCustomer, useProfile } from './services-ui';
import { ErrorBox, Field, Modal, Spinner } from './ui';
import { api } from '@/lib/api';
import { JobStatus, PRIORITY } from '@/lib/service-profiles';

export function NewJob({ onClose, onCreated, presetCustomer }: { onClose: () => void; onCreated: (id: string) => void; presetCustomer?: PickedCustomer }) {
  const p = useProfile();
  const [customer, setCustomer] = useState<PickedCustomer>(presetCustomer ?? null);
  const [f, setF] = useState({ title: '', category: '', status: (p.key === 'LEGAL' ? 'QUOTE' : 'OPEN') as JobStatus, priority: 'NORMAL', dueAt: '', description: '' });
  const [details, setDetails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const j = await api<{ id: string }>('/jobs', { body: { customerId: customer?.id, title: f.title, category: f.category || undefined, status: f.status, priority: f.priority,
        dueAt: f.dueAt ? new Date(`${f.dueAt}T17:00:00`).toISOString() : undefined, description: f.description || undefined, details, warrantyDays: p.showWarranty ? p.warrantyDays : 0 } });
      onCreated(j.id);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return <Modal open onClose={onClose} wide title={p.job.newLabel}
    footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || f.title.trim().length < 2} onClick={save}>{busy && <Spinner />} Crear</button></>}>
    <div className="grid sm:grid-cols-2 gap-3">
      {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
      <div className="sm:col-span-2"><CustomerSelect value={customer} onChange={setCustomer} label={p.customer} /></div>
      <Field label="Título" className="sm:col-span-2"><input className="input" maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={p.job.titlePlaceholder} /></Field>
      <Field label="Categoría"><input className="input" list="job-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="job-cats">{p.categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
      <Field label="Estado inicial"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as JobStatus })}>{(['QUOTE', 'OPEN', 'IN_PROGRESS'] as JobStatus[]).map((s) => <option key={s} value={s}>{p.statuses[s]}</option>)}</select></Field>
      <Field label={p.dueLabel}><input type="date" className="input" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></Field>
      <Field label="Prioridad"><select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      {p.fields.map((fd) => <Field key={fd.key} label={fd.label} className={fd.wide ? 'sm:col-span-2' : ''}>
        {fd.type === 'select' ? <select className="input" value={details[fd.key] ?? ''} onChange={(e) => setDetails({ ...details, [fd.key]: e.target.value })}><option value="">Elige…</option>{fd.options!.map((o) => <option key={o}>{o}</option>)}</select>
          : fd.type === 'area' ? <textarea className="input min-h-16" maxLength={1000} value={details[fd.key] ?? ''} onChange={(e) => setDetails({ ...details, [fd.key]: e.target.value })} placeholder={fd.placeholder} />
            : <input className="input" maxLength={200} value={details[fd.key] ?? ''} onChange={(e) => setDetails({ ...details, [fd.key]: e.target.value })} placeholder={fd.placeholder} />}
      </Field>)}
      <Field label="Descripción o notas internas" className="sm:col-span-2"><textarea className="input min-h-20" maxLength={8000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
    </div>
  </Modal>;
}
