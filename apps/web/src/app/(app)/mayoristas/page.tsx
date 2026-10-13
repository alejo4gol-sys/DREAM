'use client';
import { Building2, FileDown, Pencil, Plus, Save, Search, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, Stat, TableWrap, Tabs, cn, useToast } from '@/components/ui';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { useApi, useDebounced } from '@/lib/hooks';

function ListForm({ initial, onClose, onSaved }: { initial: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>(initial);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const body = { name: f.name, description: f.description || undefined, discountPercent: String(f.discountPercent || 0), minOrderTotal: String(f.minOrderTotal || 0).replace(/\D/g, '') || '0', active: f.active };
    try { f.id ? await api(`/wholesale/price-lists/${f.id}`, { method: 'PUT', body }) : await api('/wholesale/price-lists', { body }); onSaved(); onClose(); } catch (e) { setErr((e as Error).message); }
  };
  return <Modal open onClose={onClose} title={f.id ? 'Editar lista' : 'Nueva lista de precios'} footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={f.name.length < 2}>Guardar</button></>}>
    {err && <ErrorBox message={err} />}
    <div className="space-y-3">
      <Field label="Nombre"><input className="input" placeholder="Ej. Mayoristas, Distribuidores, Tiendas aliadas" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Descripción (opcional)"><input className="input" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Descuento general (%)" hint="Se aplica a los productos sin precio especial."><input className="input" type="number" min={0} max={90} value={f.discountPercent} onChange={(e) => setF({ ...f, discountPercent: e.target.value })} /></Field>
        <Field label="Pedido mínimo"><input className="input" inputMode="numeric" value={f.minOrderTotal} onChange={(e) => setF({ ...f, minOrderTotal: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Activa</label>
    </div>
  </Modal>;
}

function ListItems({ list, onBack }: { list: any; onBack: () => void }) {
  const toast = useToast();
  const { data, error, reload } = useApi<any>(`/wholesale/price-lists/${list.id}/items`);
  const [rows, setRows] = useState<Record<string, { price: string; minQty: string }>>({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setRows(Object.fromEntries(data.products.map((p: any) => [p.id, { price: p.listPrice ? String(Math.round(Number(p.listPrice))) : '', minQty: String(p.minQty ?? 1) }]))); }, [data]);
  const filtered = useMemo(() => (data?.products ?? []).filter((p: any) => !q || `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const save = async () => {
    setBusy(true);
    try {
      const items = data.products.map((p: any) => ({ productId: p.id, price: rows[p.id]?.price ? rows[p.id].price : null, minQty: Math.max(1, Number(rows[p.id]?.minQty || 1)) }))
        .filter((i: any) => i.price !== null || data.products.find((p: any) => p.id === i.productId)?.custom);
      await api(`/wholesale/price-lists/${list.id}/items`, { method: 'PUT', body: { items } }); toast('Precios guardados'); reload();
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  if (error) return <ErrorBox message={error} />;
  return <Card title={`Precios de «${list.name}»`} actions={<><button className="btn-ghost" onClick={onBack}>Volver</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}<Save className="h-4 w-4" /> Guardar precios</button></>}>
    <p className="text-sm text-ink-muted mb-3">Deja el precio vacío para usar el descuento general ({Number(list.discountPercent)} %). La cantidad mínima aparece en el catálogo mayorista.</p>
    <label className="flex items-center gap-2 input max-w-sm mb-3"><Search className="h-4 w-4 text-ink-muted" /><input className="flex-1 bg-transparent outline-none" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} /></label>
    {!data ? <Loading /> : <TableWrap><table className="table">
      <thead><tr><th>Producto</th><th className="text-right">Precio al público</th><th className="text-right">Costo</th><th className="text-right">Precio en esta lista</th><th className="text-right">Mín. und.</th></tr></thead>
      <tbody>{filtered.map((p: any) => {
        const r = rows[p.id] ?? { price: '', minQty: '1' };
        const eff = r.price ? Number(r.price) : Number(p.salePrice) * (100 - Number(list.discountPercent)) / 100;
        const low = eff < Number(p.costPrice);
        return <tr key={p.id}>
          <td><span className="font-medium">{p.name}</span><span className="block text-xs text-ink-muted">{p.sku}</span></td>
          <td className="text-right tabular-nums">{money(p.salePrice)}</td>
          <td className="text-right tabular-nums text-ink-muted">{money(p.costPrice)}</td>
          <td className="text-right"><input className={cn('input h-9 w-32 text-right', low && 'border-bad')} inputMode="numeric" placeholder={String(Math.round(eff))} value={r.price} onChange={(e) => setRows({ ...rows, [p.id]: { ...r, price: e.target.value.replace(/\D/g, '') } })} />
            {low && <span className="block text-[11px] text-bad">Por debajo del costo</span>}</td>
          <td className="text-right"><input className="input h-9 w-20 text-right" type="number" min={1} value={r.minQty} onChange={(e) => setRows({ ...rows, [p.id]: { ...r, minQty: e.target.value } })} /></td>
        </tr>;
      })}</tbody></table></TableWrap>}
  </Card>;
}

function Terms({ customer, lists, onClose, onSaved }: { customer: any; lists: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ customerId: customer?.id ?? '', priceListId: customer?.priceListId ?? '', creditLimit: customer?.creditLimit ? String(Math.round(Number(customer.creditLimit))) : '', paymentTermsDays: String(customer?.terms ?? 30) });
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data: found } = useApi<any>(!customer && dq.trim().length > 1 ? `/customers?q=${encodeURIComponent(dq.trim())}&pageSize=8` : null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try { await api(`/wholesale/customers/${f.customerId}`, { method: 'PUT', body: { priceListId: f.priceListId || null, creditLimit: f.creditLimit || null, paymentTermsDays: f.paymentTermsDays ? Number(f.paymentTermsDays) : null } }); onSaved(); onClose(); }
    catch (e) { setErr((e as Error).message); }
  };
  const results = found?.items ?? found?.data ?? [];
  return <Modal open onClose={onClose} title={customer ? `Condiciones de ${customer.name}` : 'Agregar cliente mayorista'}
    footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!f.customerId} onClick={save}>Guardar</button></>}>
    {err && <ErrorBox message={err} />}
    <div className="space-y-3">
      {!customer && <Field label="Cliente"><input className="input" placeholder="Busca por nombre o teléfono" value={q} onChange={(e) => { setQ(e.target.value); setF({ ...f, customerId: '' }); }} />
        {results.length > 0 && !f.customerId && <ul className="mt-1 border border-line rounded-xl divide-y divide-line">{results.map((c: any) => <li key={c.id}><button className="w-full text-left px-3 py-2 text-sm hover:bg-sand-50" onClick={() => { setF({ ...f, customerId: c.id }); setQ(c.name); }}>{c.name} <span className="text-ink-muted">{c.phone}</span></button></li>)}</ul>}</Field>}
      <Field label="Lista de precios"><select className="input" value={f.priceListId} onChange={(e) => setF({ ...f, priceListId: e.target.value })}><option value="">Precio al público</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cupo de crédito" hint="Vacío = sin crédito"><input className="input" inputMode="numeric" value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Plazo para pagar (días)"><input className="input" type="number" min={0} max={365} value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: e.target.value })} /></Field>
      </div>
      <p className="text-xs text-ink-muted">Al registrar una venta a este cliente, DREAMS usa automáticamente los precios de su lista.</p>
    </div>
  </Modal>;
}

export default function WholesalePage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'cartera' | 'listas'>('cartera');
  const { data: lists, error, reload } = useApi<any[]>('/wholesale/price-lists');
  const { data: rec, reload: reloadRec } = useApi<any>('/wholesale/receivables');
  const [form, setForm] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [terms, setTerms] = useState<any>(undefined);
  if (error) return <ErrorBox message={error} />;
  if (editing) return <><PageHeader title="Ventas al por mayor" /><ListItems list={editing} onBack={() => { setEditing(null); reload(); }} /></>;
  return <>
    <PageHeader title="Ventas al por mayor" subtitle="Listas de precios para mayoristas y distribuidores, pedido mínimo, cupo de crédito y cartera."
      actions={<>
        <Link className="btn-secondary" href="/catalogo"><FileDown className="h-4 w-4" /> Catálogo mayorista</Link>
        {can('customers:write') && <button className="btn-primary" onClick={() => setTerms(null)}><UserPlus className="h-4 w-4" /> Agregar cliente</button>}
      </>} />
    {rec && <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
      <Stat label="Cartera por cobrar" value={money(rec.totals.balance)} />
      <Stat label="Vencida" value={<span className={cn(Number(rec.totals.overdue) > 0 && 'text-bad')}>{money(rec.totals.overdue)}</span>} hint="Según el plazo de cada cliente" />
      <Stat label="Clientes mayoristas" value={rec.customers.length} />
    </div>}
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'cartera', label: 'Clientes y cartera' }, { value: 'listas', label: 'Listas de precios' }]} /></div>
    {tab === 'cartera' && <Card>
      {!rec ? <Loading /> : !rec.customers.length ? <Empty icon={<Building2 className="h-6 w-6" />} title="Aún no tienes clientes mayoristas" description="Asigna una lista de precios o un cupo de crédito a tus clientes que compran al por mayor." /> :
        <TableWrap><table className="table"><thead><tr><th>Cliente</th><th>Lista</th><th className="text-right">Saldo</th><th className="text-right">Vencido</th><th className="text-right">Cupo disponible</th><th /></tr></thead>
          <tbody>{rec.customers.map((c: any) => <tr key={c.id}>
            <td><Link href={`/clientes/${c.id}`} className="font-medium hover:underline">{c.name}</Link><span className="block text-xs text-ink-muted">Plazo {c.terms ?? 30} días</span></td>
            <td>{c.listName ? <Badge tone="sand">{c.listName}</Badge> : <span className="text-ink-muted text-xs">Público</span>}</td>
            <td className="text-right tabular-nums">{money(c.balance)}</td>
            <td className={cn('text-right tabular-nums', Number(c.overdue) > 0 && 'text-bad font-medium')}>{money(c.overdue)}</td>
            <td className={cn('text-right tabular-nums', c.available != null && Number(c.available) < 0 && 'text-bad')}>{c.available != null ? money(c.available) : '—'}</td>
            <td className="text-right">{can('customers:write') && <button className="btn-ghost btn-sm" onClick={() => setTerms(c)}><Pencil className="h-3.5 w-3.5" /></button>}</td>
          </tr>)}</tbody></table></TableWrap>}
    </Card>}
    {tab === 'listas' && <Card actions={can('products:write') && <button className="btn-secondary btn-sm" onClick={() => setForm({ name: '', description: '', discountPercent: '10', minOrderTotal: '', active: true })}><Plus className="h-4 w-4" /> Nueva lista</button>}>
      {!lists ? <Loading /> : !lists.length ? <Empty title="Sin listas de precios" description="Crea una lista para tus mayoristas con un descuento general o precios especiales por producto." /> :
        <ul className="grid sm:grid-cols-2 gap-3">{lists.map((l) => <li key={l.id} className={cn('rounded-xl border border-line p-4', !l.active && 'opacity-60')}>
          <div className="flex justify-between gap-2"><p className="font-medium">{l.name}</p>{!l.active && <Badge tone="muted">Inactiva</Badge>}</div>
          {l.description && <p className="text-sm text-ink-muted">{l.description}</p>}
          <p className="text-xs text-ink-muted mt-1">{Number(l.discountPercent)} % de descuento general · pedido mínimo {money(l.minOrderTotal)} · {l.items} precios especiales · {l.customers} clientes</p>
          <div className="flex flex-wrap gap-1 mt-3">
            {can('products:write') && <button className="btn-primary btn-sm" onClick={() => setEditing(l)}>Precios por producto</button>}
            {can('products:write') && <button className="btn-ghost btn-sm" onClick={() => setForm({ ...l, discountPercent: String(Number(l.discountPercent)), minOrderTotal: String(Math.round(Number(l.minOrderTotal))) })}><Pencil className="h-3.5 w-3.5" /> Editar</button>}
            <button className="btn-ghost btn-sm" onClick={() => download(`/brochure/pdf?priceListId=${l.id}`, `catalogo-${l.name.toLowerCase().replace(/\s+/g, '-')}.pdf`)}><FileDown className="h-3.5 w-3.5" /> PDF</button>
            {can('products:write') && <button className="btn-ghost btn-sm text-bad" onClick={async () => { if (confirm('¿Eliminar esta lista? Los clientes volverán al precio al público.')) { await api(`/wholesale/price-lists/${l.id}`, { method: 'DELETE' }); reload(); reloadRec(); } }}><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        </li>)}</ul>}
    </Card>}
    {form && <ListForm initial={form} onClose={() => setForm(null)} onSaved={reload} />}
    {terms !== undefined && <Terms customer={terms} lists={lists ?? []} onClose={() => setTerms(undefined)} onSaved={() => { reloadRec(); reload(); }} />}
  </>;
}
