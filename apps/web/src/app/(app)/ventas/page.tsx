'use client';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Pagination, TableWrap, Tabs } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CHANNELS, METHODS, SALE_STATUS, date, money } from '@/lib/format';
import { qs, useApi, useDebounced } from '@/lib/hooks';

export default function SalesPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any>(`/sales${qs({ page, pageSize: 25, q: dq, status, channel, from: from && to ? from : '', to: from && to ? to : '' })}`);

  return (
    <>
      <PageHeader title="Ventas" subtitle="Registra y consulta todas tus ventas."
        actions={can('sales:create') && <Link href="/ventas/nueva" className="btn-primary"><Plus className="h-4 w-4" /> Nueva venta</Link>} />
      <Card padded={false}>
        <div className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center border-b border-line">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" />
            <input className="input pl-9" placeholder="Buscar por número o cliente" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: '', label: 'Todas' }, { value: 'PAID', label: 'Pagadas' }, { value: 'PENDING', label: 'Pendientes' }, { value: 'PARTIALLY_PAID', label: 'Abono parcial' }, { value: 'CANCELLED', label: 'Anuladas' }]} />
          <select className="input lg:w-44" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} aria-label="Canal">
            <option value="">Todos los canales</option>
            {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-2 items-center">
            <input type="date" className="input w-36" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
            <span className="text-ink-faint">–</span>
            <input type="date" className="input w-36" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
          </div>
        </div>
        {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
        {loading && !data && <Loading />}
        {data && data.items.length === 0 && <Empty title="No hay ventas" description="Cuando registres ventas aparecerán aquí." action={can('sales:create') && <Link href="/ventas/nueva" className="btn-primary">Registrar venta</Link>} />}
        {data && data.items.length > 0 && (
          <TableWrap>
            <table className="table">
              <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Saldo</th></tr></thead>
              <tbody>
                {data.items.map((s: any) => {
                  const st = SALE_STATUS[s.status];
                  const balance = Number(s.total) - Number(s.amountPaid);
                  return (
                    <tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/ventas/${s.id}`)}>
                      <td className="font-medium"><Link href={`/ventas/${s.id}`}>#{s.number}</Link></td>
                      <td className="text-ink-muted whitespace-nowrap">{date(s.date, true)}</td>
                      <td>{s.customerName ?? <span className="text-ink-faint">Consumidor final</span>}</td>
                      <td>{CHANNELS[s.channel]}</td>
                      <td className="text-ink-muted">{METHODS[s.paymentMethod]}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="text-right tabular-nums font-medium">{money(s.total)}</td>
                      <td className="text-right tabular-nums">{s.status !== 'CANCELLED' && balance > 0 ? <span className="text-warn">{money(balance)}</span> : <span className="text-ink-faint">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        {data && <Pagination page={page} pageSize={25} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
