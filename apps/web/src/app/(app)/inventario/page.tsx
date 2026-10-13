'use client';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, ErrorBox, Field, Loading, Modal, PageHeader, Stat, TableWrap, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money, number } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const MOV: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' | 'sand' }> = {
  INITIAL: { label: 'Inicial', tone: 'sand' }, PURCHASE: { label: 'Compra', tone: 'ok' }, SALE: { label: 'Venta', tone: 'muted' },
  SALE_CANCEL: { label: 'Anulación', tone: 'warn' }, ADJUSTMENT: { label: 'Ajuste', tone: 'sand' },
  ORDER_RESERVE: { label: 'Pedido confirmado', tone: 'muted' }, ORDER_RELEASE: { label: 'Pedido cancelado', tone: 'warn' },
};

export default function InventoryPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'stock' | 'low' | 'moves'>('stock');
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useApi<any>('/inventory');
  const { data: moves, reload: reloadMoves } = useApi<any[]>(tab === 'moves' ? '/inventory/movements' : null);
  const [adj, setAdj] = useState<any | null>(null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    try {
      await api('/inventory/adjustments', { body: { productId: adj.id, quantity: Number(qty), note: note || undefined } });
      toast('Inventario ajustado'); setAdj(null); reload(); reloadMoves();
    } catch (e) { setErr((e as Error).message); }
  };

  const query = search.trim().toLocaleLowerCase('es');
  const items = data?.items.filter((i: any) => (tab !== 'low' || i.stock <= i.minStock)
    && (!query || [i.name, i.sku, i.barcode ?? ''].some((value) => String(value).toLocaleLowerCase('es').includes(query)))) ?? [];
  return (
    <>
      <PageHeader title="Inventario" subtitle="Existencias, alertas y kárdex de movimientos." actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'stock', label: 'Existencias' }, { value: 'low', label: `Inventario bajo${data ? ` (${data.totals.lowStock})` : ''}` }, { value: 'moves', label: 'Movimientos' }]} />} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <Stat dark label="Unidades en inventario" value={number(data.totals.units)} />
          <Stat label="Valor al costo" value={money(data.totals.costValue)} />
          <Stat label="Valor a precio de venta" value={money(data.totals.saleValue)} />
          <Stat label="Alertas" value={`${data.totals.lowStock} bajos`} hint={`${data.totals.outOfStock} agotados`} />
        </div>
      )}
      {tab !== 'moves' && data && (
        <Card padded={false}>
          <div className="p-4 border-b border-line"><input className="input" placeholder="Escanea o busca por nombre, SKU o código de barras" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" inputMode="none" /><p className="text-[11px] text-ink-faint mt-1.5">Usa el lector para encontrar rápidamente un producto en tu inventario.</p></div>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="text-right">Stock</th><th className="text-right">Mínimo</th><th className="text-right">Valor al costo</th><th>Estado</th>{can('inventory:adjust') && <th />}</tr></thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i.id}>
                    <td><p className="font-medium">{i.name}</p><p className="text-[11px] text-ink-muted">{i.sku}{i.barcode ? ` · ${i.barcode}` : ''}</p></td>
                    <td className="text-ink-muted">{i.categoryName ?? '—'}</td>
                    <td className="text-right tabular-nums font-medium">{i.stock}</td>
                    <td className="text-right tabular-nums text-ink-muted">{i.minStock}</td>
                    <td className="text-right tabular-nums">{money(i.stock * Number(i.costPrice))}</td>
                    <td>{i.stock <= 0 ? <Badge tone="bad">Agotado</Badge> : i.stock <= i.minStock ? <Badge tone="warn">Inventario bajo</Badge> : <Badge tone="ok">OK</Badge>}</td>
                    {can('inventory:adjust') && <td className="text-right"><button className="btn-ghost btn-sm" onClick={() => { setAdj(i); setQty(String(i.stock)); setNote(''); setErr(null); }}><SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar</button></td>}
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={7} className="text-center text-ink-muted py-10">No hay productos en esta vista.</td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
      {tab === 'moves' && (
        <Card padded={false}>
          {!moves ? <Loading /> : (
            <TableWrap>
              <table className="table">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="text-right">Cantidad</th><th>Detalle</th></tr></thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id}>
                      <td className="text-ink-muted whitespace-nowrap">{date(m.createdAt, true)}</td>
                      <td>{m.productName}</td>
                      <td><Badge tone={MOV[m.type].tone}>{MOV[m.type].label}</Badge></td>
                      <td className={`text-right tabular-nums font-medium ${m.quantity < 0 ? 'text-bad' : 'text-ok'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                      <td className="text-ink-muted text-xs">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}
      <Modal open={!!adj} onClose={() => setAdj(null)} title={`Ajustar inventario · ${adj?.name ?? ''}`} footer={<><button className="btn-ghost" onClick={() => setAdj(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Guardar ajuste</button></>}>
        <div className="space-y-3">
          {err && <ErrorBox message={err} />}
          <p className="text-sm text-ink-muted">Stock actual: <b className="text-ink">{adj?.stock}</b>. Escribe la cantidad real contada.</p>
          <Field label="Cantidad real"><input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Motivo"><input className="input" placeholder="Conteo físico, daño, pérdida…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
