'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, Field, Modal, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { METHODS, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';

export function SupplierForm({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>({ name: '', company: '', taxId: '', phone: '', email: '', notes: '', ...Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, v ?? ''])) });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const body = Object.fromEntries(['name', 'company', 'taxId', 'phone', 'email', 'notes'].map((k) => [k, f[k] || undefined]));
    try {
      await api(initial?.id ? `/suppliers/${initial.id}` : '/suppliers', { method: initial?.id ? 'PATCH' : 'POST', body });
      toast('Proveedor guardado'); onSaved();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal open onClose={onClose} title={initial?.id ? 'Editar proveedor' : 'Nuevo proveedor'} footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={f.name.length < 2}>Guardar</button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        {error && <div className="sm:col-span-2"><ErrorBox message={error} /></div>}
        <Field label="Nombre *"><input className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Empresa"><input className="input" value={f.company} onChange={set('company')} /></Field>
        <Field label="NIT"><input className="input" value={f.taxId} onChange={set('taxId')} /></Field>
        <Field label="Teléfono"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Correo" className="sm:col-span-2"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Observaciones" className="sm:col-span-2"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

export function PurchaseForm({ supplierId, onClose, onSaved }: { supplierId?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: sups } = useApi<any>('/suppliers?pageSize=200');
  const { data: prods } = useApi<any>('/products?pageSize=200');
  const [sid, setSid] = useState(supplierId ?? '');
  const [items, setItems] = useState<{ productId: string; quantity: string; unitCost: string }[]>([{ productId: '', quantity: '1', unitCost: '' }]);
  const [paid, setPaid] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [updateCost, setUpdateCost] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.unitCost || 0), 0);
  const upd = (idx: number, patch: any) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api('/purchases', { body: {
        supplierId: sid, items: items.filter((i) => i.productId).map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: String(i.unitCost || 0) })),
        amountPaid: String(paid || 0), paymentMethod: method, updateCostPrice: updateCost,
      } });
      toast('Compra registrada: inventario actualizado'); onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Registrar compra de mercancía" wide
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={busy || !sid || !items.some((i) => i.productId)}>{busy && <Spinner />} Guardar compra</button></>}>
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}
        <Field label="Proveedor"><select className="input" value={sid} onChange={(e) => setSid(e.target.value)}><option value="">Selecciona…</option>{sups?.items.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_120px_32px] gap-2 items-end">
              <Field label={idx === 0 ? 'Producto' : ''}><select className="input" value={it.productId} onChange={(e) => { const p = prods?.items.find((x: any) => x.id === e.target.value); upd(idx, { productId: e.target.value, unitCost: p ? String(Number(p.costPrice)) : '' }); }}><option value="">Selecciona…</option>{prods?.items.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label={idx === 0 ? 'Cant.' : ''}><input className="input" inputMode="numeric" value={it.quantity} onChange={(e) => upd(idx, { quantity: e.target.value.replace(/\D/g, '') })} /></Field>
              <Field label={idx === 0 ? 'Costo unit.' : ''}><input className="input" inputMode="decimal" value={it.unitCost} onChange={(e) => upd(idx, { unitCost: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
              <button className="btn-ghost btn-sm !px-2 h-10 text-bad" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} disabled={items.length === 1} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button className="btn-ghost btn-sm" onClick={() => setItems((xs) => [...xs, { productId: '', quantity: '1', unitCost: '' }])}><Plus className="h-3.5 w-3.5" /> Agregar producto</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 items-end border-t border-line pt-4">
          <div><p className="label">Total de la compra</p><p className="text-xl font-semibold">{money(total)}</p></div>
          <Field label="Valor pagado ahora" hint="El resto queda como cuenta por pagar"><input className="input" inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" /></Field>
          <Field label="Método de pago"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} /> Actualizar el precio de compra de los productos con este costo</label>
      </div>
    </Modal>
  );
}
