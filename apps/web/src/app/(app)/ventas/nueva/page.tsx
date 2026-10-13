'use client';
import { Minus, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, ErrorBox, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { CHANNELS, METHODS, money } from '@/lib/format';
import { qs, useApi, useDebounced } from '@/lib/hooks';

type Line = { productId: string; name: string; sku: string; stock: number; unitPrice: string; taxRate: string; quantity: number; discount: string };

export default function NewSalePage() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const scanInput = useRef<HTMLInputElement>(null);
  const ds = useDebounced(search, 200);
  const { data: results } = useApi<any>(`/products${qs({ q: ds, pageSize: 8 })}`);
  const [lines, setLines] = useState<Line[]>([]);
  const [customerQ, setCustomerQ] = useState('');
  const dcq = useDebounced(customerQ, 200);
  const { data: customers, reload: reloadCustomers } = useApi<any>(`/customers${qs({ q: dcq, pageSize: 6 })}`);
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [channel, setChannel] = useState('WHATSAPP');
  const [method, setMethod] = useState('CASH');
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState<'full' | 'partial' | 'none'>('full');
  const [paid, setPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);

  const add = (p: any) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === p.id);
      if (ex) return ls.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(l.quantity + 1, p.stock) } : l));
      return [...ls, { productId: p.id, name: p.name, sku: p.sku, stock: p.stock, unitPrice: String(Number(p.salePrice)), taxRate: p.taxRate, quantity: 1, discount: '' }];
    });
    setSearch('');
  };
  const scanBarcode = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = e.currentTarget.value.trim();
    if (!code) return;
    e.preventDefault();
    try {
      const product = await api<any>(`/products/barcode/${encodeURIComponent(code)}`);
      if (product.stock <= 0) { toast(`${product.name} está agotado`, 'bad'); return; }
      add(product);
      toast(`${product.name} agregado · ${product.stock} disponibles`);
      requestAnimationFrame(() => scanInput.current?.focus());
    } catch (e) { toast((e as Error).message || 'No encontramos ese código de barras', 'bad'); }
  };
  const update = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  // Vista previa (el cálculo definitivo lo hace el servidor)
  const totals = useMemo(() => {
    const rows = lines.map((l) => {
      const gross = Number(l.unitPrice || 0) * l.quantity;
      const net = gross - Number(l.discount || 0);
      return { gross, net, rate: Number(l.taxRate || 0) };
    });
    const net = rows.reduce((a, r) => a + r.net, 0);
    const g = Math.min(Number(discount || 0), net);
    const tax = rows.reduce((a, r) => a + (net ? (r.net - (g * r.net) / net) * r.rate / 100 : 0), 0);
    const subtotal = rows.reduce((a, r) => a + r.gross, 0);
    return { subtotal, discount: subtotal - net + g, tax, total: net - g + tax };
  }, [lines, discount]);

  useEffect(() => { if (channel === 'PHYSICAL_STORE' && method === 'NEQUI') setMethod('CASH'); }, [channel, method]);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const sale = await api<any>('/sales', {
        body: {
          customerId: customer?.id, channel, paymentMethod: method, notes: notes || undefined,
          discount: discount ? String(discount) : undefined,
          amountPaid: payment === 'full' ? undefined : payment === 'none' ? '0' : String(paid || 0),
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: String(l.unitPrice), discount: l.discount ? String(l.discount) : undefined })),
        },
      });
      toast(`Venta #${sale.number} registrada`);
      router.push(`/ventas/${sale.id}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Nueva venta" subtitle="El inventario, el cliente y tus reportes se actualizan automáticamente." />
      <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="space-y-5">
          <Card title="Productos">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" />
              <input ref={scanInput} className="input pl-9" placeholder="Busca un producto o escanea su código de barras" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={scanBarcode} autoFocus autoComplete="off" inputMode="none" />
              {search && results?.items?.length > 0 && (
                <div className="absolute z-20 mt-1 w-full card shadow-pop overflow-hidden">
                  {results.items.map((p: any) => (
                    <button key={p.id} disabled={p.stock <= 0} onClick={() => add(p)} className="w-full text-left px-4 py-2.5 hover:bg-sand-50 flex items-center gap-3 disabled:opacity-40">
                      <span className="flex-1 min-w-0"><span className="block text-sm truncate">{p.name}</span><span className="text-[11px] text-ink-muted">{p.sku} · {p.stock} disponibles</span></span>
                      <span className="text-sm tabular-nums">{money(p.salePrice)}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-ink-faint mt-1.5">Con el lector conectado, enfoca este campo y escanea. DREAMS agrega el producto al instante.</p>
            </div>
            {lines.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-10">Busca y agrega productos a la venta.</p>
            ) : (
              <div className="mt-4 divide-y divide-line">
                {lines.map((l) => (
                  <div key={l.productId} className="py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_110px_110px_32px] gap-3 items-center">
                    <div className="min-w-0"><p className="text-sm font-medium truncate">{l.name}</p><p className="text-[11px] text-ink-muted">{l.sku} · stock {l.stock}{Number(l.taxRate) > 0 && ` · IVA ${Number(l.taxRate)}%`}</p></div>
                    <div className="flex items-center gap-1 justify-end sm:justify-start">
                      <button className="btn-secondary btn-sm !px-2" onClick={() => update(l.productId, { quantity: Math.max(1, l.quantity - 1) })} aria-label="Menos"><Minus className="h-3 w-3" /></button>
                      <input className="input h-8 w-12 text-center px-1" value={l.quantity} onChange={(e) => update(l.productId, { quantity: Math.max(1, Math.min(l.stock, Number(e.target.value.replace(/\D/g, '')) || 1)) })} aria-label="Cantidad" />
                      <button className="btn-secondary btn-sm !px-2" onClick={() => update(l.productId, { quantity: Math.min(l.stock, l.quantity + 1) })} aria-label="Más"><Plus className="h-3 w-3" /></button>
                    </div>
                    <input className="input h-8" inputMode="numeric" value={l.unitPrice} onChange={(e) => update(l.productId, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Precio" title="Precio unitario" />
                    <input className="input h-8" inputMode="numeric" placeholder="Desc." value={l.discount} onChange={(e) => update(l.productId, { discount: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Descuento" title="Descuento de la línea" />
                    <button className="btn-ghost btn-sm !px-2 text-bad" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Cliente">
            {customer ? (
              <div className="flex items-center justify-between rounded-xl bg-sand-50 border border-line px-4 py-3">
                <span className="text-sm font-medium">{customer.name}</span>
                <button className="text-xs text-ink-muted hover:text-ink" onClick={() => setCustomer(null)}>Cambiar</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input className="input" placeholder="Buscar cliente (opcional)" value={customerQ} onChange={(e) => setCustomerQ(e.target.value)} />
                  <button className="btn-secondary !px-3" onClick={() => setNewCustomer(true)} title="Nuevo cliente"><UserPlus className="h-4 w-4" /></button>
                </div>
                {customerQ && customers?.items?.map((c: any) => (
                  <button key={c.id} className="w-full text-left px-3 py-2 rounded-lg hover:bg-sand-50 text-sm" onClick={() => { setCustomer(c); setCustomerQ(''); if (c.channel) setChannel(c.channel); }}>
                    {c.name} <span className="text-ink-faint text-xs">{c.phone}</span>
                  </button>
                ))}
                <p className="text-[11px] text-ink-faint">Sin cliente se registra como consumidor final.</p>
              </div>
            )}
          </Card>
        </div>

        <Card title="Resumen" className="lg:sticky lg:top-20">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Canal de venta"><select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Método de pago"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            </div>
            <Field label="Descuento general"><input className="input" inputMode="numeric" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
            <dl className="text-sm space-y-1.5 border-t border-line pt-4">
              <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Descuentos</dt><dd className="tabular-nums">−{money(totals.discount)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Impuestos</dt><dd className="tabular-nums">{money(totals.tax)}</dd></div>
              <div className="flex justify-between text-lg font-semibold pt-2"><dt>Total</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
            </dl>
            <div>
              <span className="label">Estado del pago</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-sand-100 p-1">
                {([['full', 'Pagada'], ['partial', 'Abono'], ['none', 'A crédito']] as const).map(([k, v]) => (
                  <button key={k} onClick={() => setPayment(k)} className={`h-8 rounded-lg text-xs font-medium ${payment === k ? 'bg-white shadow-card' : 'text-ink-muted'}`}>{v}</button>
                ))}
              </div>
              {payment === 'partial' && <input className="input mt-2" inputMode="numeric" placeholder="Valor recibido" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ''))} />}
            </div>
            <Field label="Observaciones"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {error && <ErrorBox message={error} />}
            <button className="btn-primary w-full h-11" disabled={busy || lines.length === 0} onClick={submit}>{busy && <Spinner />} Registrar venta</button>
          </div>
        </Card>
      </div>
      <QuickCustomer open={newCustomer} onClose={() => setNewCustomer(false)} channel={channel} onCreated={(c) => { setCustomer(c); reloadCustomers(); }} />
    </>
  );
}

function QuickCustomer({ open, onClose, onCreated, channel }: { open: boolean; onClose: () => void; onCreated: (c: any) => void; channel: string }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', city: '' });
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      const c = await api('/customers', { body: { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), channel } });
      onCreated(c); onClose(); setF({ name: '', phone: '', email: '', city: '' });
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nuevo cliente" footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={f.name.length < 2}>Guardar</button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        {error && <div className="sm:col-span-2"><ErrorBox message={error} /></div>}
        <Field label="Nombre" className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="Teléfono"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Ciudad"><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Correo" className="sm:col-span-2"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
