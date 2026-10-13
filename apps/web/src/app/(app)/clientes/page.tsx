'use client';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Pagination, TableWrap } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CHANNELS, SEGMENTS, date, money } from '@/lib/format';
import { CustomerForm } from '@/components/customer-form';
import { SocialIcons } from '@/components/social';
import { qs, useApi, useDebounced } from '@/lib/hooks';

const SEG_TONE: Record<string, 'ok' | 'sand' | 'muted' | 'ink'> = { NEW: 'ok', FREQUENT: 'sand', INACTIVE: 'muted', HIGH_VALUE: 'ink' };

export default function CustomersPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('');
  const [channel, setChannel] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any>(`/customers${qs({ page, pageSize: 25, q: dq, segment, channel })}`);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader title="Clientes" subtitle="Tu CRM: historial, canal de llegada y segmentos."
        actions={can('customers:write') && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo cliente</button>} />
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {Object.entries(SEGMENTS).map(([k, v]) => (
            <button key={k} onClick={() => { setSegment(segment === k ? '' : k); setPage(1); }}
              className={`text-left rounded-2xl border p-4 transition ${segment === k ? 'bg-primary text-on-primary border-primary' : 'bg-white border-line hover:border-sand-400'}`}>
              <p className={`text-xs ${segment === k ? 'text-on-primary/70' : 'text-ink-muted'}`}>{v}</p>
              <p className="text-2xl font-semibold mt-1">{data.segmentCounts?.[k] ?? 0}</p>
            </button>
          ))}
        </div>
      )}
      <Card padded={false}>
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-line">
          <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" /><input className="input pl-9" placeholder="Buscar por nombre, teléfono, correo o @usuario" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select className="input sm:w-48" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} aria-label="Canal"><option value="">Todos los canales</option>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
        {loading && !data && <Loading />}
        {data?.items.length === 0 && <Empty title="Sin clientes en esta vista" />}
        {data?.items.length > 0 && (
          <TableWrap>
            <table className="table">
              <thead><tr><th>Cliente</th><th>Ciudad</th><th>Canal</th><th>Segmentos</th><th className="text-right">Compras</th><th className="text-right">Total gastado</th><th>Última compra</th></tr></thead>
              <tbody>
                {data.items.map((c: any) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => router.push(`/clientes/${c.id}`)}>
                    <td><Link href={`/clientes/${c.id}`} className="font-medium">{c.name}</Link><p className="text-[11px] text-ink-muted">{c.phone ?? c.email}</p><div className="mt-1.5"><SocialIcons links={c.socialLinks} size="sm" /></div></td>
                    <td className="text-ink-muted">{c.city ?? '—'}</td>
                    <td>{c.channel ? CHANNELS[c.channel] : '—'}</td>
                    <td><div className="flex flex-wrap gap-1">{c.segments.map((s: string) => <Badge key={s} tone={SEG_TONE[s]}>{SEGMENTS[s]}</Badge>)}</div></td>
                    <td className="text-right tabular-nums">{c.purchaseCount}</td>
                    <td className="text-right tabular-nums font-medium">{money(c.totalSpent)}</td>
                    <td className="text-ink-muted whitespace-nowrap">{date(c.lastPurchaseAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        {data && <Pagination page={page} pageSize={25} total={data.total} onPage={setPage} />}
      </Card>
      {open && <CustomerForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </>
  );
}
