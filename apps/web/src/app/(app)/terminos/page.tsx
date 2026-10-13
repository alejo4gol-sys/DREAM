'use client';
import { CalendarClock, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { TermCalculator, TermModal, TermsGuide, TermsList, newDraft, useTermCatalog } from '@/components/legal-terms';
import { Card, ErrorBox, Loading, PageHeader, Stat, Tabs, cn } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { qs, useApi, useDebounced } from '@/lib/hooks';

function TermsPage() {
  const params = useSearchParams();
  const { can } = useAuth();
  const [tab, setTab] = useState<'list' | 'calc' | 'guide'>(params.get('calcular') ? 'calc' : 'list');
  const [status, setStatus] = useState('ACTIVE');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data: catalog, error: e1 } = useTermCatalog();
  const { data: rows, error, loading, reload } = useApi<any[]>(`/legal-terms${qs({ status, q: dq.trim() })}`);
  const { data: sum, reload: reloadSum } = useApi<any>('/legal-terms/summary');
  const [open, setOpen] = useState<any>(null);
  const [calcKey, setCalcKey] = useState(0);
  if (e1) return <ErrorBox message={e1} />;
  const refresh = () => { reload(); reloadSum(); };
  return <>
    <PageHeader title="Términos y vencimientos" subtitle="Controla caducidad, prescripción y demás términos de tus casos, con avisos antes de que venzan."
      actions={can('sales:create') && <button className="btn-primary" onClick={() => { setTab('calc'); setCalcKey((k) => k + 1); }}><CalendarClock className="h-4 w-4" /> Calcular un término</button>} />
    {sum && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <Stat label="Vencidos" value={<span className={cn(sum.expired && 'text-bad')}>{sum.expired}</span>} hint="Sigue vigilando o márcalos" />
      <Stat label="7 días o menos" value={<span className={cn(sum.red && 'text-bad')}>{sum.red}</span>} hint="Prioridad máxima" />
      <Stat label="30 días o menos" value={<span className={cn(sum.yellow && 'text-warn')}>{sum.yellow}</span>} />
      <Stat label="A tiempo" value={sum.green} hint={sum.none ? `${sum.none} sin término fijo` : undefined} />
    </div>}
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'list', label: 'Mis términos' }, { value: 'calc', label: 'Calcular' }, { value: 'guide', label: 'Guía de términos' }]} /></div>
    {!catalog ? <Loading /> : <>
      {tab === 'list' && <Card padded={false}>
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-line">
          <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" /><input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre del término" /></div>
          <select className="input sm:w-56" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Vigilando</option><option value="FILED">Presentados a tiempo</option><option value="LAPSED">Vencidos sin presentar</option><option value="ARCHIVED">Archivados</option><option value="ALL">Todos</option>
          </select>
        </div>
        <div className="px-4">{error ? <ErrorBox message={error} onRetry={reload} /> : loading && !rows ? <Loading /> : <TermsList rows={rows ?? []} onOpen={setOpen} />}</div>
      </Card>}
      {tab === 'calc' && <TermCalculator key={calcKey} catalog={catalog} initial={newDraft({ jobId: params.get('caso') })} onSaved={() => { refresh(); setTab('list'); }} />}
      {tab === 'guide' && <TermsGuide catalog={catalog} />}
      {open && <TermModal term={open} catalog={catalog} onClose={() => setOpen(null)} onChanged={refresh} />}
    </>}
  </>;
}

export default function Page() { return <Suspense fallback={<Loading />}><TermsPage /></Suspense>; }
