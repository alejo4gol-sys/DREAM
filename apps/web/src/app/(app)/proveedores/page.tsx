'use client';
import { PackagePlus, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PurchaseForm, SupplierForm } from '@/components/supplier-forms';
import { Card, Empty, ErrorBox, Loading, PageHeader, Pagination, TableWrap } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { qs, useApi, useDebounced } from '@/lib/hooks';

export default function SuppliersPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any>(`/suppliers${qs({ page, pageSize: 25, q: dq })}`);
  const [form, setForm] = useState(false);
  const [purchase, setPurchase] = useState(false);

  return (
    <>
      <PageHeader title="Proveedores" subtitle="Compras de mercancía, deudas pendientes e historial."
        actions={can('suppliers:write') && <>
          <button className="btn-secondary" onClick={() => setPurchase(true)}><PackagePlus className="h-4 w-4" /> Registrar compra</button>
          <button className="btn-primary" onClick={() => setForm(true)}><Plus className="h-4 w-4" /> Nuevo proveedor</button>
        </>} />
      <Card padded={false}>
        <div className="p-4 border-b border-line"><div className="relative"><Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" /><input className="input pl-9" placeholder="Buscar por nombre, empresa o NIT" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div></div>
        {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
        {loading && !data && <Loading />}
        {data?.items.length === 0 && <Empty title="Sin proveedores" description="Registra a quién le compras tu mercancía." />}
        {data?.items.length > 0 && (
          <TableWrap>
            <table className="table">
              <thead><tr><th>Proveedor</th><th>NIT</th><th>Contacto</th><th className="text-right">Productos</th><th className="text-right">Compras</th><th className="text-right">Deuda pendiente</th></tr></thead>
              <tbody>
                {data.items.map((s: any) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/proveedores/${s.id}`)}>
                    <td><Link href={`/proveedores/${s.id}`} className="font-medium">{s.name}</Link><p className="text-[11px] text-ink-muted">{s.company}</p></td>
                    <td className="text-ink-muted">{s.taxId ?? '—'}</td>
                    <td className="text-xs text-ink-muted">{s.phone}<br />{s.email}</td>
                    <td className="text-right tabular-nums">{s.productsCount}</td>
                    <td className="text-right tabular-nums">{money(s.purchasesTotal)}</td>
                    <td className="text-right tabular-nums font-medium">{Number(s.debt) > 0 ? <span className="text-warn">{money(s.debt)}</span> : <span className="text-ink-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        {data && <Pagination page={page} pageSize={25} total={data.total} onPage={setPage} />}
      </Card>
      {form && <SupplierForm onClose={() => setForm(false)} onSaved={() => { setForm(false); reload(); }} />}
      {purchase && <PurchaseForm onClose={() => setPurchase(false)} onSaved={() => { setPurchase(false); reload(); }} />}
    </>
  );
}
