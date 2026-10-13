'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { MODALITY } from '@/lib/service-profiles';
import { CustomerSelect, PickedCustomer, fromLocalInput, toLocalInput, useProfile } from './services-ui';
import { ErrorBox, Field, Modal, Spinner } from './ui';

export type Appt = {
  id: string; title: string; startsAt: string; endsAt: string; status: string; modality: string; location: string | null; notes: string | null; source: string;
  customerId: string | null; customerName: string | null; customerPhone: string | null; productId: string | null; productName?: string | null;
  jobId: string | null; jobNumber?: number | null; jobTitle?: string | null; assignedUserId: string | null; assignedName?: string | null;
};

/** Crear o editar una cita (o audiencia, visita, sesión… según el perfil del negocio). */
export function AppointmentModal({ appt, initialStart, job, onClose, onSaved }: {
  appt?: Appt | null; initialStart?: Date; job?: { id: string; title: string; customer?: PickedCustomer } | null; onClose: () => void; onSaved: () => void;
}) {
  const p = useProfile();
  const { data: services } = useApi<any>('/products?isService=true&pageSize=100');
  const { data: team } = useApi<{ userId: string; fullName: string }[]>('/services/team');
  const { data: jobs } = useApi<any>(job ? null : '/jobs?status=ACTIVE');
  const start = appt ? new Date(appt.startsAt) : initialStart ?? (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; })();
  const [customer, setCustomer] = useState<PickedCustomer>(appt?.customerId ? { id: appt.customerId, name: appt.customerName ?? '', phone: appt.customerPhone } : job?.customer ?? null);
  const [f, setF] = useState({
    title: appt?.title ?? (job ? job.title : ''), productId: appt?.productId ?? '', jobId: appt?.jobId ?? job?.id ?? '', assignedUserId: appt?.assignedUserId ?? '',
    start: toLocalInput(start), duration: String(appt ? Math.round((new Date(appt.endsAt).getTime() - new Date(appt.startsAt).getTime()) / 60000) : 60),
    modality: appt?.modality ?? 'IN_PERSON', location: appt?.location ?? '', notes: appt?.notes ?? '', status: appt?.status ?? 'SCHEDULED',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [overlap, setOverlap] = useState(false);
  const pickService = (id: string) => {
    const s = services?.items?.find((x: any) => x.id === id);
    setF((x) => ({ ...x, productId: id, title: x.title || s?.name || '', duration: s?.appointmentSchedule?.durationMinutes ? String(s.appointmentSchedule.durationMinutes) : x.duration }));
  };
  const save = async (allowOverlap = false) => {
    setBusy(true); setErr('');
    const startsAt = fromLocalInput(f.start);
    const endsAt = new Date(new Date(startsAt).getTime() + Math.max(5, Number(f.duration) || 60) * 60000).toISOString();
    const body = { title: f.title, startsAt, endsAt, customerId: customer?.id ?? null, productId: f.productId || null, jobId: f.jobId || null, assignedUserId: f.assignedUserId || null,
      modality: f.modality, location: f.location || undefined, notes: f.notes || undefined, status: f.status, allowOverlap };
    try { await api(appt ? `/appointments/${appt.id}` : '/appointments', { method: appt ? 'PUT' : 'POST', body }); onSaved(); }
    catch (e) { const m = (e as Error).message; setErr(m); setOverlap(/Se cruza/.test(m)); }
    finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title={appt ? `Editar ${p.appointment.toLowerCase()}` : `Agendar ${p.appointment.toLowerCase()}`}
    footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button>{overlap && <button className="btn-secondary" disabled={busy} onClick={() => save(true)}>Agendar igual</button>}<button className="btn-primary" disabled={busy || f.title.trim().length < 2} onClick={() => save()}>{busy && <Spinner />} Guardar</button></>}>
    <div className="grid sm:grid-cols-2 gap-3">
      {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
      <div className="sm:col-span-2"><CustomerSelect value={customer} onChange={setCustomer} label={p.customer} /></div>
      <Field label="Servicio (opcional)"><select className="input" value={f.productId} onChange={(e) => pickService(e.target.value)}><option value="">Sin servicio</option>{(services?.items ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="Título"><input className="input" maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={p.key === 'LEGAL' ? 'Ej. Audiencia inicial' : 'Ej. Diagnóstico'} /></Field>
      <Field label="Fecha y hora"><input type="datetime-local" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
      <Field label="Duración (minutos)"><select className="input" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>{[15, 30, 45, 60, 90, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}{!['15', '30', '45', '60', '90', '120', '180', '240', '480'].includes(f.duration) && <option value={f.duration}>{f.duration} min</option>}</select></Field>
      <Field label="Modalidad"><select className="input" value={f.modality} onChange={(e) => setF({ ...f, modality: e.target.value })}>{Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label={f.modality === 'VIRTUAL' ? 'Enlace o medio' : 'Lugar'}><input className="input" maxLength={255} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder={f.modality === 'VIRTUAL' ? 'Meet, Zoom, WhatsApp…' : 'Dirección o sala'} /></Field>
      <Field label="Responsable"><select className="input" value={f.assignedUserId} onChange={(e) => setF({ ...f, assignedUserId: e.target.value })}><option value="">Sin asignar</option>{(team ?? []).map((t) => <option key={t.userId} value={t.userId}>{t.fullName}</option>)}</select></Field>
      {!job && <Field label={`${p.job.singular} relacionado (opcional)`}><select className="input" value={f.jobId} onChange={(e) => setF({ ...f, jobId: e.target.value })}><option value="">Ninguno</option>{(jobs?.items ?? []).map((j: any) => <option key={j.id} value={j.id}>#{j.number} · {j.title}</option>)}</select></Field>}
      <Field label="Notas" className="sm:col-span-2"><textarea className="input min-h-16" maxLength={1000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </div>
  </Modal>;
}
