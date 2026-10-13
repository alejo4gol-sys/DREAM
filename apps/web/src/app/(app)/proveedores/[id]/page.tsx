'use client';
import { ArrowLeft, PackagePlus, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PurchaseForm, SupplierForm } from '@/components/supplier-forms';
import { Badge, Card, ErrorBox, Field, Loading, Modal, PageHeader, Stat, TableWrap, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { METHODS, date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const PST: Record<string, { l: string; t: 'ok' | 'warn' }> = { PAID: { l: 'Pagada', t: 'ok' }, PARTIALLY_PAID: { l: 'Abono parcial', t: 'warn' }, PENDING: { l: 'Pendiente', t: 'warn' } };

export default function SupplierDetail({ params }: { params: { id: string } }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: s, error, reload } = useApi<any>(`/suppliers/${params.id}`);
  const [edit, setEdit] = useState(false);
  const [purchase, setPurchase] = useState(false);
  const [pay, setPay] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!s) return <Loading />;
  const total = s.purchases.reduce((a: number, p: any) => a + Number(p.total), 0);

  const savePay = async () => {
    try { await api(`/purchases/${pay.id}/payments`, { body: { amount: String(amount), method } }); toast('Pago registrado'); setPay(null); reload(); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };

  return (
    <>
      <Link href="/proveedores" className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Proveedores</Link>
      <PageHeader title={s.name} subtitle={[s.company, s.taxId && `NIT ${s.taxId}`, s.phone, s.email].filter(Boolean).join(' · ')}
        actions={can('suppliers:write') && <>
          <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Editar</button>
          <button className="btn-primary" onClick={() => setPurchase(true)}><PackagePlus className="h-4 w-4" /> Registrar compra</button>
        </>} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <Stat dark label="Deuda pendiente" value={money(s.debt)} />
        <Stat label="Total comprado" value={money(total)} hint={`${s.purchases.length} compra(s)`} />
        <Stat label="Productos que suministra" value={s.products.length} />
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
        <Card title="Compras" padded={false}>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Fecha</th><th>Detalle</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Saldo</th><th /></tr></thead>
              <tbody>
                {s.purchases.length === 0 && <tr><td colSpan={6} className="text-center text-ink-muted py-8">Sin compras registradas</td></tr>}
                {s.purchases.map((p: any) => {
                  const bal = Number(p.total) - Number(p.amountPaid);
                  return (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-ink-muted">{date(p.date)}</td>
                      <td className="text-xs max-w-xs">{p.items.map((i: any) => `${i.quantity}× ${i.product.name}`).join(', ')}</td>
                      <td><Badge tone={PST[p.status].t}>{PST[p.status].l}</Badge></td>
                      <td className="text-right tabular-nums">{money(p.total)}</td>
                      <td className="text-right tabular-nums">{bal > 0 ? money(bal) : '—'}</td>
                      <td className="text-right">{bal > 0 && can('finance:write') && <button className="btn-secondary btn-sm" onClick={() => { setPay(p); setAmount(String(bal)); }}>Pagar</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card title="Productos">
          <ul className="space-y-2 text-sm">
            {s.products.length === 0 && <li className="text-ink-muted">Ningún producto asociado.</li>}
            {s.products.map((p: any) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className="text-ink-muted tabular-nums">{money(p.costPrice)}</span></li>)}
          </ul>
        </Card>
      </div>
      {edit && <SupplierForm initial={s} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
      {purchase && <PurchaseForm supplierId={s.id} onClose={() => setPurchase(false)} onSaved={() => { setPurchase(false); reload(); }} />}
      <Modal open={!!pay} onClose={() => setPay(null)} title="Pago a proveedor" footer={<><button className="btn-ghost" onClick={() => setPay(null)}>Cancelar</button><button className="btn-primary" onClick={savePay}>Registrar pago</button></>}>
        <div className="space-y-3">
          <Field label="Valor"><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
          <Field label="Método"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
      </Modal>
    </>
  );
}
