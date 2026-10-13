'use client';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock, MessageCircle, Plus, Receipt, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { HBars, MonthlyBars } from './charts';
import { TermsDashboardCard } from './legal-terms';
import { NewJob } from './new-job';
import { timeOf, useProfile, waLink } from './services-ui';
import { Badge, Card, ErrorBox, Loading, PageHeader, Stat } from './ui';
import { useAuth } from '@/lib/auth';
import { compactMoney, date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { APPT_STATUS, JobStatus, MODALITY, STATUS_ORDER } from '@/lib/service-profiles';
import { useRouter } from 'next/navigation';

const hours = (m: number) => (m / 60).toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** Inicio para negocios de servicios: agenda de hoy, casos/órdenes y lo que hay que cobrar. */
export function ServicesDashboard() {
  const p = useProfile();
  const router = useRouter();
  const { user, can, current } = useAuth();
  const { data: d, error, reload } = useApi<any>('/services/dashboard');
  const [creating, setCreating] = useState(false);
  const change = d && d.revenuePrevMonth ? Math.round(((d.revenueMonth - d.revenuePrevMonth) / d.revenuePrevMonth) * 100) : null;
  return <>
    <PageHeader title={`Hola, ${user?.fullName.split(' ')[0]}`} subtitle={`Así va ${current?.tradeName} hoy.`}
      actions={can('sales:create') && <><Link href="/agenda" className="btn-secondary"><CalendarDays className="h-4 w-4" /> Agenda</Link><button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {p.job.newLabel}</button></>} />
    {error && <ErrorBox message={error} onRetry={reload} />}
    {!d ? <Loading /> : <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat dark label="Ingresos del mes" value={money(d.revenueMonth)} change={change} hint={`${d.salesMonth} cobros · mismos días del mes anterior ${compactMoney(d.revenuePrevMonth)}`} icon={<Receipt className="h-4 w-4" />} />
        <Stat label={`${p.job.plural} activos`} value={d.active} icon={<ClipboardList className="h-4 w-4" />} hint={`${d.byStatus.READY ?? 0} ${p.statuses.READY.toLowerCase()}`} />
        <Stat label={`${p.appointments} de hoy`} value={d.today.filter((a: any) => a.status !== 'CANCELLED').length} icon={<CalendarDays className="h-4 w-4" />} />
        {p.hours ? <Stat label="Horas trabajadas en el mes" value={hours(d.minutesMonth)} hint={`${hours(d.billableMinutesMonth)} h facturables`} icon={<Clock className="h-4 w-4" />} />
          : <Stat label="Por cobrar" value={money(d.receivables)} hint={`${d.receivablesCount} cobros con saldo`} icon={<Wallet className="h-4 w-4" />} />}
      </div>

      {p.key === 'LEGAL' && <TermsDashboardCard />}
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5 items-start">
        <Card title={`${p.appointments} de hoy`} actions={<Link href="/agenda" className="text-xs text-ink-muted hover:text-ink">Ver agenda</Link>}>
          {!d.today.length ? <p className="text-sm text-ink-muted">Hoy no tienes {p.appointments.toLowerCase()} agendadas.</p> : <div className="divide-y divide-line">{d.today.map((a: any) =>
            <div key={a.id} className="py-2.5 flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums w-16">{timeOf(a.startsAt)}</span>
              <div className="flex-1 min-w-0"><p className="text-sm truncate">{a.title}</p><p className="text-xs text-ink-muted truncate">{a.customerName ?? 'Sin cliente'} · {MODALITY[a.modality]}{a.location ? ` · ${a.location}` : ''}</p></div>
              <Badge tone={APPT_STATUS[a.status]?.tone ?? 'muted'}>{APPT_STATUS[a.status]?.label}</Badge>
            </div>)}</div>}
        </Card>
        <Card title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warn" /> {p.dueLabel}: próximos 7 días</span>}>
          {!d.dueSoon.length ? <p className="text-sm text-ink-muted">Nada por vencer esta semana.</p> : <div className="divide-y divide-line">{d.dueSoon.map((j: any) => {
            const late = new Date(j.dueAt) < new Date();
            return <Link key={j.id} href={`/trabajos/${j.id}`} className="py-2.5 flex items-center gap-3 hover:bg-sand-50 -mx-2 px-2 rounded-lg">
              <span className={`text-xs w-20 ${late ? 'text-bad font-semibold' : 'text-warn font-medium'}`}>{late ? 'Vencido' : date(j.dueAt)}</span>
              <div className="flex-1 min-w-0"><p className="text-sm truncate">#{j.number} · {j.title}</p><p className="text-xs text-ink-muted truncate">{j.customerName ?? ''}</p></div>
            </Link>;
          })}</div>}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <Card title={`${p.job.plural} por estado`}>
          <div className="space-y-2">{STATUS_ORDER.filter((s) => !['DELIVERED', 'CANCELLED'].includes(s)).map((s) => {
            const n = d.byStatus[s] ?? 0; const max = Math.max(1, ...Object.values(d.byStatus as Record<string, number>));
            return <Link key={s} href="/trabajos" className="block"><div className="flex justify-between text-xs mb-1"><span>{p.statuses[s as JobStatus]}</span><span className="tabular-nums text-ink-muted">{n}</span></div><div className="h-2 rounded-full bg-sand-100"><div className="h-2 rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} /></div></Link>;
          })}</div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok" /> {p.statuses.READY}</span>}>
          {!d.ready.length ? <p className="text-sm text-ink-muted">Nada pendiente por entregar.</p> : <div className="space-y-2">{d.ready.map((j: any) =>
            <div key={j.id} className="flex items-center gap-2"><Link href={`/trabajos/${j.id}`} className="flex-1 min-w-0 text-sm truncate hover:underline">#{j.number} · {j.title}<span className="block text-xs text-ink-muted">{j.customerName}</span></Link>
              <a className="btn-ghost btn-sm !px-2" href={waLink(j.customerPhone, `Hola ${j.customerName ?? ''}, «${j.title}» ya está listo en ${current?.tradeName}. Código: ${j.trackingCode}.`)} target="_blank" rel="noreferrer" aria-label="Avisar por WhatsApp"><MessageCircle className="h-4 w-4" /></a></div>)}</div>}
        </Card>
        <Card title="Lo que más facturas (90 días)">
          {d.topServices.length ? <HBars data={d.topServices.map((t: any) => ({ name: t.name, value: t.revenue }))} /> : <p className="text-sm text-ink-muted">Aún sin cobros.</p>}
        </Card>
      </div>

      <Card title="Ingresos por mes">
        <MonthlyBars data={d.monthly} />
        {can('finance:read') && d.receivables > 0 && <p className="text-xs text-ink-muted mt-2">Tienes {money(d.receivables)} por cobrar en {d.receivablesCount} cobro(s). <Link href="/finanzas" className="underline">Ver cuentas por cobrar</Link></p>}
      </Card>
    </div>}
    {creating && <NewJob onClose={() => setCreating(false)} onCreated={(id) => router.push(`/trabajos/${id}`)} />}
  </>;
}
