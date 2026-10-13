'use client';
import { ArrowLeft, Mail, MapPin, Pencil, Phone, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, ErrorBox, Loading, PageHeader, Stat, TableWrap } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CHANNELS, SALE_STATUS, SEGMENTS, date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api';
import { CustomerForm } from '@/components/customer-form';
import { SocialList } from '@/components/social';
import { CustomerJobs } from '@/components/customer-jobs';

export default function CustomerDetail({ params }: { params: { id: string } }) {
  const { can, current } = useAuth();
  const services = current?.businessModel === 'SERVICES';
  const { data: jobs } = useApi<any>(services ? `/jobs?customerId=${params.id}&status=ALL` : null);
  const { data: c, error, reload } = useApi<any>(`/customers/${params.id}`);
  const [edit, setEdit] = useState(false);
  const [promotion, setPromotion] = useState('Tenemos novedades para ti. Mira nuestra tienda:');
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!c) return <Loading />;
  const avg = c.purchaseCount ? Number(c.totalSpent) / c.purchaseCount : 0;
  const digits = String(c.phone ?? '').replace(/\D/g, '');
  const shopUrl = c.storeSlug && typeof window !== 'undefined' ? `${window.location.origin}/tienda/${c.storeSlug}` : '';
  const latestProduct = c.history?.[0]?.items?.[0]?.description;
  const whatsapp = (message: string) => digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '';
  return (
    <>
      <Link href="/clientes" className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Clientes</Link>
      <PageHeader title={c.name}
        subtitle={<span className="flex flex-wrap gap-1.5 mt-1">{c.segments.map((s: string) => <Badge key={s} tone="sand">{SEGMENTS[s]}</Badge>)}{c.channel && <Badge>Llegó por {CHANNELS[c.channel]}</Badge>}</span>}
        actions={can('customers:write') && <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Editar</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat dark label="Total gastado" value={money(c.totalSpent)} />
        <Stat label="Compras" value={c.purchaseCount} />
        <Stat label="Ticket promedio" value={money(avg)} />
        <Stat label="Última compra" value={<span className="text-lg">{date(c.lastPurchaseAt)}</span>} hint={c.firstPurchaseAt && `Cliente desde ${date(c.firstPurchaseAt)}`} />
      </div>
      <div className="grid lg:grid-cols-[300px_1fr] gap-5 items-start">
        <Card title="Contacto">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><Phone className="h-4 w-4 text-sand-500" /> {c.phone ?? '—'}</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 text-sand-500" /> <span className="break-all">{c.email ?? '—'}</span></li>
            <li className="flex gap-2"><MapPin className="h-4 w-4 text-sand-500" /> {c.city ?? '—'}</li>
          </ul>
          {c.phone && <a className="btn-secondary w-full mt-4" href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>}
          {digits && latestProduct && <a className="btn-secondary w-full mt-2" href={whatsapp(`Hola ${c.name}, ¿quieres volver a pedir ${latestProduct}? Escríbeme y te ayudo.`)} target="_blank" rel="noopener noreferrer">Recordar recompra</a>}
          <div className="mt-4 border-t border-line pt-4"><p className="label">Promociones</p>
            <p className="text-xs text-ink-muted mt-1">{c.marketingOptIn ? `Autorizó recibir promociones${c.marketingOptInAt ? ` el ${date(c.marketingOptInAt)}` : ''}.` : c.marketingOptOutAt ? `Pidió no recibir promociones (${date(c.marketingOptOutAt)}).` : 'No ha autorizado recibir promociones. Envíale solo mensajes sobre sus pedidos.'}</p>
            {can('customers:write') && <button className="btn-ghost btn-sm mt-2" onClick={async () => { await api(`/customers/${c.id}`, { method: 'PATCH', body: { marketingOptIn: !c.marketingOptIn } }); reload(); }}>{c.marketingOptIn ? 'Pidió no recibir más promociones' : 'El cliente me autorizó'}</button>}
          </div>
          {digits && shopUrl && c.marketingOptIn && <div className="mt-4 border-t border-line pt-4"><label className="label" htmlFor="promo-message">Compartir promoción por WhatsApp</label><textarea id="promo-message" className="input min-h-20 mt-2" value={promotion} onChange={(e) => setPromotion(e.target.value)} /><a className="btn-secondary w-full mt-2" href={whatsapp(`${promotion.trim()} ${shopUrl}`)} target="_blank" rel="noopener noreferrer"><Share2 className="h-4 w-4" /> Compartir tienda</a></div>}
          <div className="mt-4 border-t border-line pt-4"><p className="label">Redes sociales</p><SocialList links={c.socialLinks} /></div>
          {c.notes && <p className="mt-4 text-xs text-ink-muted border-t border-line pt-3">{c.notes}</p>}
        </Card>
        <div className="space-y-5 min-w-0">
        {services && <CustomerJobs jobs={jobs?.items ?? []} />}
        <Card title="Historial de compras" padded={false}>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Venta</th><th>Fecha</th><th>Productos</th><th>Estado</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {c.history.length === 0 && <tr><td colSpan={5} className="text-center text-ink-muted py-8">Sin compras todavía</td></tr>}
                {c.history.map((s: any) => (
                  <tr key={s.id}>
                    <td><Link href={`/ventas/${s.id}`} className="font-medium">#{s.number}</Link></td>
                    <td className="text-ink-muted whitespace-nowrap">{date(s.date)}</td>
                    <td className="text-xs text-ink-muted max-w-xs truncate">{s.items.map((i: any) => `${i.quantity}× ${i.description}`).join(', ')}</td>
                    <td><Badge tone={SALE_STATUS[s.status].tone}>{SALE_STATUS[s.status].label}</Badge></td>
                    <td className="text-right tabular-nums">{money(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        </div>
      </div>
      {c.storeOrders?.length > 0 && <Card title="Pedidos de la tienda web" padded={false} className="mt-5"><TableWrap><table className="table"><thead><tr><th>Pedido</th><th>Fecha</th><th>Productos y opciones</th><th>Pago</th><th>Estado</th><th className="text-right">Total</th></tr></thead><tbody>{c.storeOrders.map((o: any) => <tr key={o.id}><td>#{o.id.slice(0, 8)}</td><td>{date(o.createdAt)}</td><td>{o.items.map((i: any) => <div key={i.id}>{i.quantity}× {i.productName}{Object.entries(i.selectedOptions ?? {}).map(([k, v]) => <span key={k} className="block text-xs text-ink-muted">{k}: {Array.isArray(v) ? v.join(', ') : String(v)}</span>)}</div>)}</td><td>{o.paymentStatus === 'PAID' ? Number(o.paymentDue) < Number(o.total) ? 'Anticipo pagado' : 'Pagado' : o.paymentStatus === 'FAILED' ? 'Fallido' : 'Pendiente'}</td><td>{o.status}</td><td className="text-right">{money(o.total)}{Number(o.paymentDue) < Number(o.total) && <span className="block text-xs text-ink-muted">Anticipo: {money(o.paymentDue)}</span>}</td></tr>)}</tbody></table></TableWrap></Card>}
      {edit && <CustomerForm initial={c} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    </>
  );
}
