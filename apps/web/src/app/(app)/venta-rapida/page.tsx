'use client';
import { ArrowLeft, Banknote, Check, CreditCard, Landmark, Minus, Search, Smartphone, UserRound, Wallet, Zap } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CollectModal } from '@/components/growth';
import { ErrorBox, Loading, Spinner, cn } from '@/components/ui';
import { api } from '@/lib/api';
import { CHANNELS, money } from '@/lib/format';
import { qs, useApi, useDebounced } from '@/lib/hooks';

const PAY = [
  { key: 'CASH', label: 'Efectivo', icon: Banknote }, { key: 'NEQUI', label: 'Nequi', icon: Smartphone }, { key: 'DAVIPLATA', label: 'Daviplata', icon: Smartphone },
  { key: 'BANK_TRANSFER', label: 'Transferencia / Bre-B', icon: Landmark }, { key: 'DEBIT_CARD', label: 'Tarjeta', icon: CreditCard }, { key: 'CREDIT', label: 'Fiado (paga después)', icon: Wallet },
];

/** Venta rápida para el celular: 1) toca los productos, 2) elige cómo pagó, 3) confirma. */
export default function QuickSale() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error } = useApi<any>(`/products${qs({ q: dq, pageSize: 60 })}`);
  const [cart, setCart] = useState<Record<string, { p: any; n: number }>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pay, setPay] = useState('CASH');
  const [channel, setChannel] = useState('PHYSICAL_STORE');
  const [cq, setCq] = useState('');
  const dcq = useDebounced(cq);
  const { data: custs } = useApi<any>(step === 3 && dcq.trim().length > 1 ? `/customers${qs({ q: dcq, pageSize: 5 })}` : null);
  const [customer, setCustomer] = useState<any>(null);
  const [prices, setPrices] = useState<Record<string, { price: string }>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<any>(null);
  const [collect, setCollect] = useState(false);

  const items = Object.values(cart).filter((c) => c.n > 0);
  const unit = (p: any) => Number(prices[p.id]?.price ?? p.salePrice);
  const total = items.reduce((a, c) => a + unit(c.p) * c.n * (1 + Number(c.p.taxRate ?? 0) / 100), 0);
  const count = items.reduce((a, c) => a + c.n, 0);
  const add = (p: any, d = 1) => setCart((x) => ({ ...x, [p.id]: { p, n: Math.max(0, (x[p.id]?.n ?? 0) + d) } }));
  const chooseCustomer = async (c: any) => {
    setCustomer(c); setCq('');
    try { const r = await api<any>(`/wholesale/resolve?customerId=${c.id}`); setPrices(r.prices ?? {}); } catch { setPrices({}); }
  };
  const confirm = async () => {
    setBusy(true); setErr(null);
    try {
      const credit = pay === 'CREDIT';
      const s = await api<any>('/sales', { body: { channel, paymentMethod: credit ? 'OTHER' : pay, customerId: customer?.id, items: items.map((c) => ({ productId: c.p.id, quantity: c.n })), ...(credit ? { amountPaid: '0' } : {}) } });
      setDone(s); setCart({}); setStep(1); setCustomer(null); setPrices({});
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const products = useMemo(() => data?.items ?? [], [data]);

  if (done) return <div className="max-w-md mx-auto text-center py-10">
    <span className="mx-auto h-16 w-16 rounded-full bg-ok text-white flex items-center justify-center"><Check className="h-8 w-8" /></span>
    <h1 className="text-2xl font-semibold mt-4">Venta #{done.number} registrada</h1>
    <p className="text-3xl font-semibold mt-2">{money(done.total)}</p>
    {Number(done.total) > Number(done.amountPaid) && <p className="text-sm text-ink-muted mt-1">Pendiente por cobrar: {money(Number(done.total) - Number(done.amountPaid))}</p>}
    <div className="flex flex-col gap-2 mt-6">
      <button className="btn-primary h-12 text-base" onClick={() => setDone(null)}><Zap className="h-5 w-5" /> Nueva venta</button>
      {Number(done.total) > Number(done.amountPaid) && <button className="btn-secondary h-12" onClick={() => setCollect(true)}>Enviar cobro</button>}
      <Link className="btn-ghost" href={`/ventas/${done.id}`}>Ver detalle</Link>
    </div>
    {collect && <CollectModal saleId={done.id} open onClose={() => setCollect(false)} />}
  </div>;

  return <div className="max-w-3xl mx-auto pb-28">
    <div className="flex items-center gap-2 mb-3">
      {step > 1 ? <button className="btn-ghost h-9 px-2" onClick={() => setStep((s) => (s - 1) as 1 | 2)}><ArrowLeft className="h-5 w-5" /></button> : <Zap className="h-5 w-5 text-sand-600" />}
      <h1 className="text-xl font-semibold flex-1">Venta rápida</h1>
      <span className="text-xs text-ink-muted">Paso {step} de 3</span>
    </div>
    {err && <ErrorBox message={err} />}
    {step === 1 && <>
      <label className="flex items-center gap-2 input mb-3"><Search className="h-4 w-4 text-ink-muted" /><input className="flex-1 bg-transparent outline-none" placeholder="Buscar o escanear código" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></label>
      {error ? <ErrorBox message={error} /> : !data ? <Loading /> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {products.map((p: any) => {
          const n = cart[p.id]?.n ?? 0;
          const out = !p.isService && p.stock != null && p.stock <= n;
          return <div key={p.id} className={cn('relative rounded-2xl border bg-white text-left overflow-hidden transition', n ? 'border-ink ring-1 ring-ink' : 'border-line')}>
            <button className="w-full text-left" onClick={() => !out && add(p)} disabled={out}>
              <div className="aspect-[4/3] bg-sand-50 flex items-center justify-center text-3xl font-semibold text-sand-400">{p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : p.name[0]}</div>
              <div className="p-2.5"><p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p><p className="text-sm font-semibold mt-1">{money(p.salePrice)}</p>
                {!p.isService && <p className={cn('text-[11px]', out ? 'text-bad' : 'text-ink-muted')}>{out ? 'Sin existencias' : `${p.stock} disponibles`}</p>}</div>
            </button>
            {n > 0 && <div className="absolute top-2 right-2 flex items-center gap-1 bg-ink text-white rounded-full pl-1 pr-2 h-8">
              <button className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center" onClick={() => add(p, -1)} aria-label="Quitar uno"><Minus className="h-3.5 w-3.5" /></button>
              <span className="text-sm font-semibold min-w-[1.25rem] text-center">{n}</span>
            </div>}
          </div>;
        })}
      </div>}
    </>}
    {step === 2 && <div className="grid grid-cols-2 gap-2">
      {PAY.map((m) => <button key={m.key} onClick={() => { setPay(m.key); setStep(3); }} className={cn('h-24 rounded-2xl border text-left p-4 flex flex-col justify-between', pay === m.key ? 'border-ink bg-ink text-white' : 'border-line bg-white')}>
        <m.icon className="h-6 w-6" /><span className="font-medium">{m.label}</span>
      </button>)}
    </div>}
    {step === 3 && <div className="space-y-4">
      <div className="card p-4">
        <ul className="divide-y divide-line text-sm">{items.map((c) => <li key={c.p.id} className="py-2 flex items-center gap-2">
          <span className="flex-1">{c.n} × {c.p.name}</span>
          {prices[c.p.id] && <span className="text-[11px] rounded-full bg-sand-100 px-2">precio mayorista</span>}
          <span className="tabular-nums">{money(unit(c.p) * c.n)}</span></li>)}</ul>
        <div className="flex justify-between border-t border-line pt-3 mt-1 text-lg font-semibold"><span>Total</span><span>{money(total)}</span></div>
        <p className="text-sm text-ink-muted mt-1">Pago: {PAY.find((m) => m.key === pay)?.label}</p>
      </div>
      <div className="card p-4">
        <p className="text-sm font-medium flex items-center gap-2"><UserRound className="h-4 w-4" /> Cliente {pay === 'CREDIT' ? '(obligatorio para fiar)' : '(opcional)'}</p>
        {customer ? <p className="mt-2 text-sm flex items-center justify-between">{customer.name}<button className="text-xs underline" onClick={() => { setCustomer(null); setPrices({}); }}>Cambiar</button></p> : <>
          <input className="input mt-2" placeholder="Busca por nombre o teléfono" value={cq} onChange={(e) => setCq(e.target.value)} />
          {(custs?.items ?? []).length > 0 && <ul className="mt-1 border border-line rounded-xl divide-y divide-line">{custs.items.map((c: any) => <li key={c.id}><button className="w-full text-left px-3 py-2 text-sm hover:bg-sand-50" onClick={() => chooseCustomer(c)}>{c.name} <span className="text-ink-muted">{c.phone}</span></button></li>)}</ul>}
        </>}
        <label className="block text-sm mt-3">Canal
          <select className="input mt-1" value={channel} onChange={(e) => setChannel(e.target.value)}>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
    </div>}

    {count > 0 && <div className="fixed bottom-0 inset-x-0 lg:left-64 bg-white/95 backdrop-blur border-t border-line p-3 z-30">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <div className="flex-1"><p className="text-xs text-ink-muted">{count} artículo{count > 1 ? 's' : ''}</p><p className="text-lg font-semibold">{money(total)}</p></div>
        {step === 1 && <button className="btn-primary h-12 px-6 text-base" onClick={() => setStep(2)}>Cobrar</button>}
        {step === 2 && <span className="text-sm text-ink-muted">Elige cómo pagó</span>}
        {step === 3 && <button className="btn-primary h-12 px-6 text-base" disabled={busy || (pay === 'CREDIT' && !customer)} onClick={confirm}>{busy ? <Spinner /> : <Check className="h-5 w-5" />} Confirmar</button>}
      </div>
    </div>}
  </div>;
}
