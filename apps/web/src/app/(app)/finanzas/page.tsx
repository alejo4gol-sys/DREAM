'use client';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Pagination, Stat, TableWrap, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { METHODS, date, money, todayISO } from '@/lib/format';
import { qs, useApi } from '@/lib/hooks';

type Tab = 'expenses' | 'incomes' | 'receivables' | 'payables';

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('expenses');
  const { data: rec } = useApi<any>('/accounting/receivables');
  const { data: pay } = useApi<any>('/accounting/payables');
  return (
    <>
      <PageHeader title="Finanzas" subtitle="Gastos, otros ingresos y cuentas pendientes."
        actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'expenses', label: 'Gastos' }, { value: 'incomes', label: 'Otros ingresos' }, { value: 'receivables', label: 'Por cobrar' }, { value: 'payables', label: 'Por pagar' }]} />} />
      <div className="grid grid-cols-2 gap-3 mb-5 lg:max-w-xl">
        <Stat label="Cuentas por cobrar" value={money(rec?.total)} hint={`${rec?.items.length ?? 0} venta(s)`} />
        <Stat label="Cuentas por pagar" value={money(pay?.total)} hint={`${(pay?.purchases.length ?? 0) + (pay?.expenses.length ?? 0)} pendiente(s)`} />
      </div>
      {tab === 'expenses' && <Expenses />}
      {tab === 'incomes' && <Incomes />}
      {tab === 'receivables' && <Receivables data={rec} />}
      {tab === 'payables' && <Payables data={pay} />}
    </>
  );
}

function Expenses() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const { data: cats } = useApi<any[]>('/expenses/categories');
  const { data, error, loading, reload } = useApi<any>(`/expenses${qs({ page, pageSize: 25, category })}`);
  const { data: sups } = useApi<any>(can('suppliers:read') ? '/suppliers?pageSize=200' : null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ category: 'RENT', description: '', amount: '', date: todayISO(), paymentMethod: 'BANK_TRANSFER', status: 'PAID', dueDate: '', supplierId: '' });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x: any) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    try {
      await api('/expenses', { body: { ...f, date: new Date(f.date + 'T12:00:00').toISOString(), dueDate: f.dueDate ? new Date(f.dueDate + 'T12:00:00').toISOString() : undefined, supplierId: f.supplierId || undefined, amount: String(f.amount) } });
      toast('Gasto registrado'); setOpen(false); reload();
      setF((x: any) => ({ ...x, description: '', amount: '' }));
    } catch (e) { setErr((e as Error).message); }
  };
  const markPaid = async (e: any) => { await api(`/expenses/${e.id}`, { method: 'PATCH', body: { status: 'PAID' } }); toast('Marcado como pagado'); reload(); };
  const del = async (e: any) => { if (!confirm('¿Eliminar este gasto?')) return; await api(`/expenses/${e.id}`, { method: 'DELETE' }); reload(); };

  return (
    <Card padded={false}>
      <div className="p-4 flex flex-col sm:flex-row gap-3 justify-between border-b border-line">
        <select className="input sm:w-56" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Categoría"><option value="">Todas las categorías</option>{cats?.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        {can('finance:write') && <button className="btn-primary" onClick={() => { setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> Registrar gasto</button>}
      </div>
      {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
      {loading && !data && <Loading />}
      {data?.items.length === 0 && <Empty title="Sin gastos registrados" />}
      {data?.items.length > 0 && (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Método</th><th>Estado</th><th className="text-right">Valor</th>{can('finance:write') && <th />}</tr></thead>
            <tbody>
              {data.items.map((e: any) => (
                <tr key={e.id}>
                  <td className="text-ink-muted whitespace-nowrap">{date(e.date)}</td>
                  <td><Badge tone="sand">{e.label}</Badge></td>
                  <td>{e.description}{e.supplierName && <span className="text-[11px] text-ink-muted block">{e.supplierName}</span>}</td>
                  <td className="text-ink-muted">{e.paymentMethod ? METHODS[e.paymentMethod] : '—'}</td>
                  <td>{e.status === 'PAID' ? <Badge tone="ok">Pagado</Badge> : <Badge tone="warn">Pendiente{e.dueDate && ` · vence ${date(e.dueDate)}`}</Badge>}</td>
                  <td className="text-right tabular-nums font-medium">{money(e.amount)}</td>
                  {can('finance:write') && <td className="text-right whitespace-nowrap">
                    {e.status === 'PENDING' && <button className="btn-secondary btn-sm mr-1" onClick={() => markPaid(e)}>Pagar</button>}
                    <button className="btn-ghost btn-sm !px-2 text-bad" onClick={() => del(e)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {data && <Pagination page={page} pageSize={25} total={data.total} onPage={setPage} />}
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar gasto" footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={!f.description || !f.amount}>Guardar</button></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
          <Field label="Categoría"><select className="input" value={f.category} onChange={set('category')}>{cats?.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <Field label="Valor"><input className="input" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
          <Field label="Descripción" className="sm:col-span-2"><input className="input" value={f.description} onChange={set('description')} /></Field>
          <Field label="Fecha"><input className="input" type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="Método de pago"><select className="input" value={f.paymentMethod} onChange={set('paymentMethod')}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Estado"><select className="input" value={f.status} onChange={set('status')}><option value="PAID">Pagado</option><option value="PENDING">Pendiente (cuenta por pagar)</option></select></Field>
          {f.status === 'PENDING' ? <Field label="Vence"><input className="input" type="date" value={f.dueDate} onChange={set('dueDate')} /></Field> : <span />}
          {sups && <Field label="Proveedor (opcional)" className="sm:col-span-2"><select className="input" value={f.supplierId} onChange={set('supplierId')}><option value="">—</option>{sups.items.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
          {f.category === 'MERCHANDISE' && <p className="sm:col-span-2 text-[11px] text-warn">Si la mercancía entra a tu inventario, regístrala en Proveedores → Registrar compra para que el stock y el costo se actualicen.</p>}
        </div>
      </Modal>
    </Card>
  );
}

function Incomes() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi<any>('/incomes?pageSize=100');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: 'Otros ingresos', description: '', amount: '', date: todayISO(), paymentMethod: 'CASH' });
  const save = async () => {
    try { await api('/incomes', { body: { ...f, amount: String(f.amount), date: new Date(f.date + 'T12:00:00').toISOString() } }); toast('Ingreso registrado'); setOpen(false); reload(); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  return (
    <Card padded={false}>
      <div className="p-4 flex justify-between items-center border-b border-line">
        <p className="text-sm text-ink-muted">Ingresos que no vienen de ventas: rendimientos, venta de activos, aportes, etc.</p>
        {can('finance:write') && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Registrar ingreso</button>}
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title="Sin otros ingresos" /> : (
        <TableWrap><table className="table"><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th className="text-right">Valor</th></tr></thead>
          <tbody>{data.items.map((i: any) => <tr key={i.id}><td className="text-ink-muted">{date(i.date)}</td><td>{i.category}</td><td>{i.description}</td><td className="text-right tabular-nums">{money(i.amount)}</td></tr>)}</tbody></table></TableWrap>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar otro ingreso" footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={!f.description || !f.amount}>Guardar</button></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Categoría"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Otros ingresos', 'Rendimientos financieros', 'Venta de activos', 'Aporte de socios', 'Reembolsos'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Valor"><input className="input" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
          <Field label="Descripción" className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Fecha"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Método"><select className="input" value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
      </Modal>
    </Card>
  );
}

function Receivables({ data }: { data: any }) {
  if (!data) return <Loading />;
  return (
    <Card padded={false}>
      {data.items.length === 0 ? <Empty title="No tienes cuentas por cobrar" /> : (
        <TableWrap><table className="table"><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th className="text-right">Total</th><th className="text-right">Pagado</th><th className="text-right">Saldo</th></tr></thead>
          <tbody>{data.items.map((r: any) => (
            <tr key={r.id}><td><Link className="font-medium" href={`/ventas/${r.id}`}>#{r.number}</Link></td><td className="text-ink-muted">{date(r.date)}</td><td>{r.customerName ?? 'Consumidor final'}<span className="block text-[11px] text-ink-muted">{r.customerPhone}</span></td>
              <td className="text-right tabular-nums">{money(r.total)}</td><td className="text-right tabular-nums">{money(r.amountPaid)}</td><td className="text-right tabular-nums font-medium text-warn">{money(r.balance)}</td></tr>
          ))}</tbody></table></TableWrap>
      )}
    </Card>
  );
}

function Payables({ data }: { data: any }) {
  if (!data) return <Loading />;
  return (
    <div className="space-y-5">
      <Card title="Compras a proveedores" padded={false}>
        {data.purchases.length === 0 ? <p className="px-5 pb-5 text-sm text-ink-muted">Sin saldos con proveedores.</p> : (
          <TableWrap><table className="table"><thead><tr><th>Fecha</th><th>Proveedor</th><th className="text-right">Total</th><th className="text-right">Saldo</th></tr></thead>
            <tbody>{data.purchases.map((p: any) => <tr key={p.id}><td className="text-ink-muted">{date(p.date)}</td><td>{p.supplierName}</td><td className="text-right tabular-nums">{money(p.total)}</td><td className="text-right tabular-nums font-medium text-warn">{money(p.balance)}</td></tr>)}</tbody></table></TableWrap>
        )}
      </Card>
      <Card title="Gastos pendientes" padded={false}>
        {data.expenses.length === 0 ? <p className="px-5 pb-5 text-sm text-ink-muted">Sin gastos pendientes.</p> : (
          <TableWrap><table className="table"><thead><tr><th>Vence</th><th>Descripción</th><th>Categoría</th><th className="text-right">Valor</th></tr></thead>
            <tbody>{data.expenses.map((e: any) => <tr key={e.id}><td className="text-ink-muted">{date(e.dueDate ?? e.date)}</td><td>{e.description}</td><td><Badge tone="sand">{e.label}</Badge></td><td className="text-right tabular-nums font-medium">{money(e.amount)}</td></tr>)}</tbody></table></TableWrap>
        )}
      </Card>
    </div>
  );
}
