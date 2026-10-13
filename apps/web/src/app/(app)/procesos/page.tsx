'use client';
import { MessageCircle, Plus, Radar, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AddProcessModal, ProcessList, ProcessModal, WhatsappSettings, usePwCatalog } from '@/components/process-watch';
import { Card, Disclaimer, Empty, ErrorBox, Loading, PageHeader, Stat, Tabs, cn } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { qs, useApi, useDebounced } from '@/lib/hooks';

const shortDate = (s?: string | null) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function ProcessesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const [tab, setTab] = useState<'list' | 'feed' | 'whatsapp'>(params.get('tab') === 'whatsapp' ? 'whatsapp' : 'list');
  const [status, setStatus] = useState('ACTIVE');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data: catalog, error: e1 } = usePwCatalog();
  const { data: rows, error, loading, reload } = useApi<any[]>(`/process-watch${qs({ status, q: dq.trim() })}`);
  const { data: sum, reload: reloadSum } = useApi<any>('/process-watch/summary');
  const [open, setOpen] = useState<string | null>(params.get('abrir'));
  const [adding, setAdding] = useState(false);
  useEffect(() => { const a = params.get('abrir'); if (a) setOpen(a); }, [params]);
  if (e1) return <ErrorBox message={e1} />;
  const refresh = () => { reload(); reloadSum(); };
  const close = () => { setOpen(null); if (params.get('abrir')) router.replace('/procesos'); };
  return <>
    <PageHeader title="Seguimiento de procesos" subtitle="Tutelas, demandas, denuncias, trámites notariales y procesos ante superintendencias en un solo lugar, con avisos de cada novedad."
      actions={can('sales:create') && <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Vigilar un proceso</button>} />
    {sum && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <Stat label="Procesos vigilados" value={sum.total} hint={sum.limit != null ? `Tu plan ${sum.planName}: hasta ${sum.limit}` : `Plan ${sum.planName}: sin límite`} />
      <Stat label="Con novedades sin leer" value={<span className={cn(sum.withUnread && 'text-primary')}>{sum.withUnread}</span>} hint={`${sum.unread} actuación(es) nueva(s)`} />
      <Stat label="Consulta automática" value={sum.auto} hint="Rama Judicial, varias veces al día" />
      <Stat label="Con recordatorio" value={sum.manual} hint={sum.errors ? `${sum.errors} con aviso por revisar` : 'Fiscalía, notarías, superintendencias…'} />
    </div>}
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'list', label: 'Procesos' }, { value: 'feed', label: 'Últimas novedades' }, { value: 'whatsapp', label: <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> Avisos por WhatsApp</span> }]} /></div>

    {tab === 'list' && <Card>
      <div className="flex flex-wrap gap-2 mb-3">
        <label className="flex items-center gap-2 input max-w-sm flex-1"><Search className="h-4 w-4 text-ink-muted" /><input className="flex-1 bg-transparent outline-none" placeholder="Buscar por nombre o número" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ACTIVE">Activos y pausados</option><option value="ARCHIVED">Archivados</option><option value="ALL">Todos</option></select>
      </div>
      {error ? <ErrorBox message={error} /> : loading && !rows ? <Loading /> : !rows?.length
        ? <Empty icon={<Radar className="h-6 w-6" />} title="Aún no vigilas procesos" description="Agrega el radicado de un proceso judicial para recibir cada actuación nueva, o el número de una denuncia, un trámite notarial o un proceso ante una superintendencia para que te recordemos revisarlo."
          action={can('sales:create') && <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Vigilar un proceso</button>} />
        : <ProcessList rows={rows} onOpen={(w) => setOpen(w.id)} />}
    </Card>}

    {tab === 'feed' && <Card>
      {!sum ? <Loading /> : !sum.recent.length ? <p className="text-sm text-ink-muted">Cuando haya actuaciones nuevas o registres novedades aparecerán aquí.</p>
        : <ul className="divide-y divide-line">{sum.recent.map((u: any) => <li key={u.id}><button className="w-full text-left py-3 hover:bg-sand-50 rounded-lg px-2 -mx-2" onClick={() => setOpen(u.watchId)}>
          <p className="text-xs text-ink-muted">{shortDate(u.date)} · {u.watchTitle} · <span className="font-mono">{u.referenceLabel}</span></p>
          <p className="font-medium text-sm">{u.title}</p>
          {u.body && <p className="text-sm text-ink-muted line-clamp-2">{u.body}</p>}
        </button></li>)}</ul>}
    </Card>}

    {tab === 'whatsapp' && <WhatsappSettings />}

    <div className="mt-5"><Disclaimer>La consulta automática usa la Consulta de Procesos Nacional Unificada de la Rama Judicial y depende de lo que cada despacho registre allí; los procesos con reserva no muestran actuaciones. Para Fiscalía, notarías, Superintendencia de Notariado y Registro, superintendencias, Colpensiones y Procuraduría no existe una consulta pública automatizable (piden captcha o usuario): DREAMS te lleva a la consulta oficial, te recuerda revisarla y avisa a tu equipo cuando registras la novedad. Verifica siempre el expediente antes de contar términos.</Disclaimer></div>

    {open && <ProcessModal id={open} onClose={close} onChanged={refresh} />}
    {adding && catalog && <AddProcessModal catalog={catalog} onClose={() => setAdding(false)} onSaved={(w) => { setAdding(false); refresh(); setOpen(w.id); }} />}
  </>;
}

export default function Page() { return <Suspense fallback={<Loading />}><ProcessesPage /></Suspense>; }
