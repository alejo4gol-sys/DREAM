'use client';
import { FileText, Search, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DOC_LABEL, DianBadge } from '@/components/invoices';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Stat, TableWrap, Tabs } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { qs, useApi, useDebounced } from '@/lib/hooks';

export default function InvoicesPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'all' | 'warranty'>('all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any>(`/invoices${qs({ q: dq.trim(), status, kind, warranty: tab === 'warranty' ? 'ACTIVE' : '' })}`);
  return <>
    <PageHeader title="Facturas" subtitle="Todas las facturas y comprobantes que has expedido, guardados para consultas y reclamaciones de garantía."
      actions={can('business:manage') && <Link href="/facturas/ajustes" className="btn-secondary"><Settings className="h-4 w-4" /> Ajustes de facturación</Link>} />
    {data?.summary && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <Stat label="Documentos expedidos" value={data.summary.count} icon={<FileText className="h-4 w-4" />} />
      <Stat label="Total facturado vigente" value={money(data.summary.total)} />
      <Stat label="Con garantía vigente" value={data.summary.activeWarranty} icon={<ShieldCheck className="h-4 w-4" />} />
      <Stat label="Pendientes de validar en la DIAN" value={data.summary.pendingDian} />
    </div>}
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'Todas' }, { value: 'warranty', label: 'Garantías vigentes' }]} /></div>
    <Card padded={false}>
      <div className="p-4 flex flex-col lg:flex-row gap-3 border-b border-line">
        <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'warranty' ? 'Busca por cliente, cédula, celular, número o producto para atender una garantía' : 'Busca por número, cliente, cédula, celular o producto'} /></div>
        <select className="input lg:w-44" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Facturas y notas</option><option value="INVOICE">Solo facturas</option><option value="CREDIT_NOTE">Solo notas crédito</option></select>
        <select className="input lg:w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos los estados</option><option value="ISSUED">Vigentes</option><option value="VOIDED">Anuladas</option></select>
      </div>
      {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
      {loading && !data ? <Loading /> : !data?.items.length ? <Empty icon={<FileText className="h-6 w-6" />} title={tab === 'warranty' ? 'No hay garantías vigentes con esa búsqueda' : 'Aún no has expedido facturas'}
        description="Para facturar, abre una venta o un cobro y toca «Facturar»." action={<Link href="/ventas" className="btn-secondary">Ir a ventas</Link>} /> :
        <TableWrap><table className="table min-w-[760px]">
          <thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Cliente</th><th className="text-right">Total</th><th>Estado</th><th>Garantía</th></tr></thead>
          <tbody>{data.items.map((x: any) => <tr key={x.id} className="hover:bg-sand-50">
            <td><Link href={`/facturas/${x.id}`} className="font-medium underline-offset-2 hover:underline">{x.fullNumber}</Link>{x.saleNumber && <span className="block text-[11px] text-ink-muted">Venta #{x.saleNumber}</span>}</td>
            <td className="text-xs">{x.kind === 'CREDIT_NOTE' ? 'Nota crédito' : DOC_LABEL[x.docType]}{x.docType === 'ELECTRONIC' && <span className="block mt-0.5"><DianBadge status={x.dianStatus} /></span>}</td>
            <td className="text-xs whitespace-nowrap">{date(x.issuedAt)}</td>
            <td><span className="block">{x.buyerName}</span><span className="text-[11px] text-ink-muted">{x.buyerId}</span></td>
            <td className="text-right tabular-nums">{x.kind === 'CREDIT_NOTE' ? '−' : ''}{money(x.total)}</td>
            <td>{x.status === 'VOIDED' ? <Badge tone="bad">Anulada</Badge> : <Badge tone="ok">Vigente</Badge>}</td>
            <td className="text-xs whitespace-nowrap">{x.warrantyUntil ? (new Date(x.warrantyUntil) >= new Date() && x.status === 'ISSUED' ? <Badge tone="ok">Hasta {date(x.warrantyUntil)}</Badge> : <span className="text-ink-muted">Venció {date(x.warrantyUntil)}</span>) : '—'}</td>
          </tr>)}</tbody>
        </table></TableWrap>}
    </Card>
  </>;
}
