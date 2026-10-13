'use client';
import { CalendarClock, Columns3, List, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NewJob } from '@/components/new-job';
import { JobStatusBadge, useProfile } from '@/components/services-ui';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Tabs, cn } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { useApi, useDebounced } from '@/lib/hooks';
import { JobStatus, PRIORITY, STATUS_ORDER } from '@/lib/service-profiles';

type Row = { id: string; number: number; title: string; category: string | null; status: JobStatus; priority: string; dueAt: string | null; quoteStatus: string; saleId: string | null;
  customerName: string | null; customerPhone: string | null; assignedName: string | null; total: string; trackingCode: string; details: Record<string, string>; updatedAt: string };

const dueTone = (d: string | null, status: string) => {
  if (!d || ['DELIVERED', 'CANCELLED'].includes(status)) return '';
  const diff = new Date(d).getTime() - Date.now();
  return diff < 0 ? 'text-bad font-medium' : diff < 2 * 86_400_000 ? 'text-warn font-medium' : 'text-ink-muted';
};

export default function JobsPage() {
  const p = useProfile();
  const { can } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<string>('ACTIVE');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const { data, loading, error, reload } = useApi<{ items: Row[]; counts: Record<string, number> }>(`/jobs?status=${view === 'board' && filter === 'ACTIVE' ? 'ACTIVE' : filter}${dq ? `&q=${encodeURIComponent(dq)}` : ''}`);
  const [creating, setCreating] = useState(false);
  const active = STATUS_ORDER.slice(0, 5);
  const counts = data?.counts ?? {};

  const card = (j: Row) => <Link key={j.id} href={`/trabajos/${j.id}`} className="block rounded-xl border border-line bg-white p-3 hover:shadow-card transition">
    <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium leading-snug">{j.title}</p>{['HIGH', 'URGENT'].includes(j.priority) && <Badge tone={j.priority === 'URGENT' ? 'bad' : 'warn'}>{PRIORITY[j.priority]}</Badge>}</div>
    <p className="text-xs text-ink-muted mt-1">#{j.number} · {j.customerName ?? 'Sin cliente'}</p>
    {(j.details?.filing || j.details?.model) && <p className="text-[11px] text-ink-faint mt-0.5 truncate">{j.details.filing ?? `${j.details.brand ?? ''} ${j.details.model ?? ''}`}</p>}
    <div className="flex items-center justify-between mt-2 text-[11px]"><span className={cn('inline-flex items-center gap-1', dueTone(j.dueAt, j.status))}>{j.dueAt && <><CalendarClock className="h-3 w-3" />{date(j.dueAt)}</>}</span><span className="tabular-nums text-ink-muted">{Number(j.total) ? money(j.total) : ''}</span></div>
    {j.quoteStatus === 'SENT' && <p className="text-[11px] text-warn mt-1">{p.quote} enviada · esperando respuesta</p>}
  </Link>;

  return <>
    <PageHeader title={p.job.plural} subtitle={`Todo lo que atiendes para tus clientes: estado, ${p.quote.toLowerCase()}, ${p.hours ? 'horas, ' : ''}cobro y seguimiento.`}
      actions={can('sales:create') && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {p.job.newLabel}</button>} />
    <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between mb-4">
      <Tabs value={filter} onChange={setFilter} items={[{ value: 'ACTIVE', label: `Activos (${active.reduce((a, s) => a + (counts[s] ?? 0), 0)})` }, { value: 'READY', label: `${p.statuses.READY} (${counts.READY ?? 0})` }, { value: 'DELIVERED', label: p.statuses.DELIVERED }, { value: 'CANCELLED', label: p.statuses.CANCELLED }, { value: 'ALL', label: 'Todos' }]} />
      <div className="flex gap-2">
        <div className="relative flex-1 lg:w-72"><Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" /><input className="input pl-9" placeholder={`Buscar por cliente, número${p.key === 'LEGAL' ? ', radicado' : p.key === 'TECH_REPAIR' ? ', IMEI' : ''}…`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="hidden md:inline-flex rounded-xl bg-sand-100 p-1">{([['board', Columns3, 'Tablero'], ['list', List, 'Lista']] as const).map(([k, Icon, l]) => <button key={k} type="button" onClick={() => setView(k)} className={cn('h-8 px-2.5 rounded-lg text-xs inline-flex items-center gap-1', view === k ? 'bg-white shadow-card' : 'text-ink-muted')} aria-pressed={view === k}><Icon className="h-3.5 w-3.5" />{l}</button>)}</div>
      </div>
    </div>
    {error && <ErrorBox message={error} onRetry={reload} />}
    {loading && !data ? <Loading /> : !data?.items.length ? <Card><Empty title={`No hay ${p.job.plural.toLowerCase()} aquí`} description={`Registra el primero con «${p.job.newLabel}».`} /></Card>
      : view === 'board' && filter === 'ACTIVE' ? <div className="hidden md:grid grid-cols-5 gap-3 items-start">{active.map((s) => {
        const col = data.items.filter((j) => j.status === s);
        return <div key={s} className="rounded-2xl bg-sand-100/70 p-2 min-h-40"><p className="text-xs font-semibold px-1.5 py-1.5 flex justify-between">{p.statuses[s]}<span className="text-ink-faint">{col.length}</span></p><div className="space-y-2">{col.map(card)}</div></div>;
      })}</div> : null}
    {data?.items.length ? <div className={cn(view === 'board' && filter === 'ACTIVE' ? 'md:hidden' : '')}><Card padded={false}><div className="divide-y divide-line">{data.items.map((j) =>
      <Link key={j.id} href={`/trabajos/${j.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 hover:bg-sand-50">
        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">#{j.number} · {j.title}</p><p className="text-xs text-ink-muted truncate">{j.customerName ?? 'Sin cliente'}{j.category ? ` · ${j.category}` : ''}{j.assignedName ? ` · ${j.assignedName}` : ''}</p></div>
        <div className="flex items-center gap-3 text-xs"><span className={dueTone(j.dueAt, j.status)}>{j.dueAt ? date(j.dueAt) : ''}</span><span className="tabular-nums w-24 text-right">{Number(j.total) ? money(j.total) : ''}</span><JobStatusBadge status={j.status} /></div>
      </Link>)}</div></Card></div> : null}
    {creating && <NewJob onClose={() => setCreating(false)} onCreated={(id) => router.push(`/trabajos/${id}`)} />}
  </>;
}
