'use client';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Globe, MessageCircle, Plus, UserX, Video } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Appt, AppointmentModal } from '@/components/appointment-modal';
import { timeOf, useProfile, waLink } from '@/components/services-ui';
import { Badge, Card, ErrorBox, Loading, PageHeader, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { APPT_STATUS, MODALITY } from '@/lib/service-profiles';

const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const DOT: Record<string, string> = { SCHEDULED: 'border-l-sand-400', CONFIRMED: 'border-l-primary', DONE: 'border-l-emerald-500', CANCELLED: 'border-l-ink-faint opacity-60', NO_SHOW: 'border-l-red-500 opacity-80' };

export default function AgendaPage() {
  const p = useProfile();
  const toast = useToast();
  const { can, current } = useAuth();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [day, setDay] = useState(() => new Date());
  const [editing, setEditing] = useState<Appt | null>(null);
  const [creatingAt, setCreatingAt] = useState<Date | null>(null);
  const range = `/appointments?from=${encodeURIComponent(week.toISOString())}&to=${encodeURIComponent(addDays(week, 7).toISOString())}`;
  const { data, error, loading, reload } = useApi<Appt[]>(range);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const byDay = (d: Date) => (data ?? []).filter((a) => sameDay(new Date(a.startsAt), d));
  const write = can('sales:create');
  const setStatus = async (a: Appt, status: string) => {
    try { await api(`/appointments/${a.id}/status`, { method: 'PATCH', body: { status } }); await reload(); toast(APPT_STATUS[status].label); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const reminder = (a: Appt) => `Hola ${a.customerName ?? ''}, te recordamos tu ${p.appointment.toLowerCase()} «${a.title}» con ${current?.tradeName} el ${new Date(a.startsAt).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${timeOf(a.startsAt)} (${MODALITY[a.modality].toLowerCase()}${a.location ? `: ${a.location}` : ''}). ¿Nos confirmas tu asistencia?`;
  const goWeek = (n: number) => { const w = addDays(week, n * 7); setWeek(w); setDay(w); };
  const today = () => { setWeek(startOfWeek(new Date())); setDay(new Date()); };

  const card = (a: Appt, compact = false) => <div key={a.id} className={cn('rounded-xl border border-line border-l-4 bg-white p-2.5 text-left', DOT[a.status])}>
    <button type="button" className="w-full text-left" onClick={() => write && setEditing(a)}>
      <p className="text-[11px] text-ink-muted flex items-center gap-1">{timeOf(a.startsAt)} – {timeOf(a.endsAt)}{a.modality === 'VIRTUAL' && <Video className="h-3 w-3" />}{a.source === 'WEB' && <Globe className="h-3 w-3" aria-label="Reservada en la página web" />}</p>
      <p className={cn('font-medium leading-snug', compact ? 'text-xs' : 'text-sm')}>{a.title}</p>
      {a.customerName && <p className="text-[11px] text-ink-muted truncate">{a.customerName}</p>}
    </button>
    {!compact && <>
      {a.location && <p className="text-[11px] text-ink-faint mt-0.5 line-clamp-1">{MODALITY[a.modality]} · {a.location}</p>}
      {a.jobId && <Link href={`/trabajos/${a.jobId}`} className="text-[11px] underline text-ink-muted">{p.job.singular} #{a.jobNumber}</Link>}
      <div className="flex flex-wrap items-center gap-1 mt-2">
        <Badge tone={APPT_STATUS[a.status]?.tone ?? 'muted'}>{APPT_STATUS[a.status]?.label}</Badge>
        {write && ['SCHEDULED', 'CONFIRMED'].includes(a.status) && <span className="inline-flex items-center gap-0.5 ml-auto">
          {a.status === 'SCHEDULED' && <button className="btn-ghost !h-7 !px-1.5" title="Confirmar" aria-label="Confirmar" onClick={() => setStatus(a, 'CONFIRMED')}><Check className="h-3.5 w-3.5" /></button>}
          <button className="btn-ghost !h-7 !px-1.5 text-ok" title="Atendida" aria-label="Atendida" onClick={() => setStatus(a, 'DONE')}><CheckCheck className="h-3.5 w-3.5" /></button>
          <button className="btn-ghost !h-7 !px-1.5 text-bad" title="No asistió" aria-label="No asistió" onClick={() => setStatus(a, 'NO_SHOW')}><UserX className="h-3.5 w-3.5" /></button>
          {a.customerPhone && <a className="btn-ghost !h-7 !px-1.5" title="Enviar recordatorio por WhatsApp" aria-label="Recordar por WhatsApp" href={waLink(a.customerPhone, reminder(a))} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /></a>}
        </span>}
      </div>
    </>}
  </div>;

  return <>
    <PageHeader title="Agenda" subtitle={`Tus ${p.appointments.toLowerCase()} de la semana. Las reservas hechas en tu página web llegan aquí solas.`}
      actions={write && <button className="btn-primary" onClick={() => setCreatingAt(new Date(Math.max(Date.now(), day.getTime())))}><Plus className="h-4 w-4" /> Agendar {p.appointment.toLowerCase()}</button>} />
    <div className="flex items-center gap-2 mb-4">
      <button className="btn-secondary !px-2" onClick={() => goWeek(-1)} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></button>
      <button className="btn-secondary" onClick={today}>Hoy</button>
      <button className="btn-secondary !px-2" onClick={() => goWeek(1)} aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></button>
      <p className="text-sm font-medium ml-2 capitalize">{week.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })} · {week.getDate()} al {addDays(week, 6).getDate()}</p>
      <span className="ml-auto text-xs text-ink-muted">{(data ?? []).filter((a) => !['CANCELLED'].includes(a.status)).length} en la semana</span>
    </div>
    {error && <ErrorBox message={error} onRetry={reload} />}
    {loading && !data ? <Loading /> : <>
      {/* Computador: semana completa */}
      <div className="hidden lg:grid grid-cols-7 gap-2">{days.map((d) => {
        const list = byDay(d); const isToday = sameDay(d, new Date());
        return <div key={d.toISOString()} className={cn('rounded-2xl p-2 min-h-[420px]', isToday ? 'bg-sand-100 ring-1 ring-ink/10' : 'bg-sand-50')}>
          <button type="button" className="w-full flex items-baseline justify-between px-1 pb-2" onClick={() => write && setCreatingAt(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))} title="Agendar este día">
            <span className="text-xs uppercase tracking-wide text-ink-muted">{d.toLocaleDateString('es-CO', { weekday: 'short' })}</span>
            <span className={cn('text-lg font-semibold', isToday && 'text-primary')}>{d.getDate()}</span>
          </button>
          <div className="space-y-1.5">{list.map((a) => card(a, false))}</div>
          {!list.length && <p className="text-[11px] text-ink-faint px-1">Libre</p>}
        </div>;
      })}</div>
      {/* Celular y tableta: un día */}
      <div className="lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-2 mb-3">{days.map((d) => <button key={d.toISOString()} type="button" onClick={() => setDay(d)}
          className={cn('flex flex-col items-center rounded-xl px-3 py-2 min-w-12', sameDay(d, day) ? 'bg-primary text-on-primary' : 'bg-sand-100')}>
          <span className="text-[10px] uppercase">{d.toLocaleDateString('es-CO', { weekday: 'short' })}</span><span className="font-semibold">{d.getDate()}</span>
          {byDay(d).length > 0 && <span className={cn('h-1 w-1 rounded-full mt-0.5', sameDay(d, day) ? 'bg-on-primary' : 'bg-primary')} />}</button>)}</div>
        {byDay(day).length ? <div className="space-y-2">{byDay(day).map((a) => card(a))}</div> : <Card><p className="text-sm text-ink-muted text-center py-6">Sin {p.appointments.toLowerCase()} este día.</p></Card>}
      </div>
    </>}
    {(editing || creatingAt) && <AppointmentModal appt={editing} initialStart={creatingAt ?? undefined} onClose={() => { setEditing(null); setCreatingAt(null); }} onSaved={() => { setEditing(null); setCreatingAt(null); reload(); toast('Agenda actualizada'); }} />}
  </>;
}
