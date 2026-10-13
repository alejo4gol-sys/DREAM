'use client';
import { Check, ExternalLink, MessageCircle, PackageCheck, ShoppingCart, Store, Truck, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Tabs, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { money, date } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const LABEL: Record<string, string> = { RECEIVED: 'Recibido', CONFIRMED: 'Confirmado', SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
const TONE: Record<string, 'warn' | 'ok' | 'muted' | 'bad' | 'ink'> = { RECEIVED: 'warn', CONFIRMED: 'ink', SHIPPED: 'muted', DELIVERED: 'ok', CANCELLED: 'bad' };
const NEXT: Record<string, { status: string; label: string; icon: typeof Check }[]> = {
  RECEIVED: [{ status: 'CONFIRMED', label: 'Confirmar y reservar stock', icon: Check }, { status: 'CANCELLED', label: 'Cancelar pedido', icon: X }],
  CONFIRMED: [{ status: 'SHIPPED', label: 'Marcar como enviado', icon: Truck }, { status: 'CANCELLED', label: 'Cancelar y liberar stock', icon: X }],
  SHIPPED: [{ status: 'DELIVERED', label: 'Marcar como entregado', icon: PackageCheck }],
};
const CARRIERS = [
  { id: 'COORDINADORA', name: 'Coordinadora', url: 'https://coordinadora.com/envios/solicitar-recogida/' },
  { id: 'SERVIENTREGA', name: 'Servientrega', url: 'https://www.servientrega.com/' },
  { id: 'INTER_RAPIDISIMO', name: 'Inter Rapidísimo', url: 'https://www3.interrapidisimo.com/enviosenlinea/' },
  { id: 'ENVIA', name: 'envía', url: 'https://envia.co/' },
  { id: 'TCC', name: 'TCC', url: 'https://tcc.com.co/' },
  { id: 'OTRA', name: 'Otra transportadora', url: '' },
];
const waText = (order: any, business: string) => {
  const pickup = order.deliveryMethod === 'PICKUP';
  const msg: Record<string, string> = {
    RECEIVED: `Hola ${order.customerName}, recibimos tu pedido #${order.id.slice(0, 8)} en ${business}. En un momento te lo confirmamos.`,
    CONFIRMED: `Hola ${order.customerName}, tu pedido #${order.id.slice(0, 8)} está confirmado. ${pickup ? 'Te avisamos cuando esté listo para recoger.' : 'Te avisamos cuando salga el envío.'}`,
    SHIPPED: pickup ? `Hola ${order.customerName}, tu pedido #${order.id.slice(0, 8)} ya está listo para recoger en ${order.address}.` : `Hola ${order.customerName}, tu pedido #${order.id.slice(0, 8)} va en camino${order.trackingNumber ? `. Guía: ${order.trackingNumber}` : ''}${order.trackingUrl ? ` · ${order.trackingUrl}` : ''}.`,
    DELIVERED: `Hola ${order.customerName}, ¡gracias por tu compra en ${business}! Esperamos que la disfrutes.`,
    CANCELLED: `Hola ${order.customerName}, tu pedido #${order.id.slice(0, 8)} fue cancelado. Escríbenos si tienes dudas.`,
  };
  return `https://wa.me/${String(order.customerPhone).replace(/\D/g, '').replace(/^3/, '573')}?text=${encodeURIComponent(msg[order.status] ?? '')}`;
};
const WINDOW_OPTIONS = ['8:00 a. m. – 12:00 m.', '12:00 m. – 5:00 p. m.', '8:00 a. m. – 5:00 p. m.'];

export default function StoreOrdersPage() {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [savingShipping, setSavingShipping] = useState<string | null>(null);
  const { current } = useAuth();
  const [tab, setTab] = useState<'orders' | 'carts'>('orders');
  const { data, loading, error, reload } = useApi<any[]>('/store/orders');
  const { data: carts, reload: reloadCarts } = useApi<any[]>('/store/carts');
  const change = async (id: string, status: string, label: string, paid?: boolean) => {
    try {
      await api(`/store/orders/${id}/status`, { method: 'PATCH', body: { status, ...(paid === undefined ? {} : { paid }) } }); await reload();
      toast(status === 'CONFIRMED' ? 'Pedido confirmado e inventario reservado' : status === 'DELIVERED' ? (paid === false ? 'Entregado: la venta quedó como cuenta por cobrar' : 'Entregado: la venta quedó registrada') : `Pedido ${label.toLowerCase()}`);
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const markPaid = async (id: string) => {
    try { await api(`/store/orders/${id}/payment`, { method: 'PATCH', body: { paymentStatus: 'PAID' } }); await reload(); toast('Pago registrado'); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  const cartMessage = (c: any) => {
    const lines = c.items.map((i: any) => `• ${i.name} × ${i.quantity}`).join('\n');
    const text = `Hola ${c.customerName}, vimos que dejaste estos productos en tu carrito de ${current?.tradeName ?? 'nuestra tienda'}:\n${lines}\n\n¿Te ayudamos a terminar tu pedido? Si prefieres que no te escribamos más, solo dinos.`;
    return `https://wa.me/${String(c.customerPhone).replace(/\D/g, '').replace(/^3/, '573')}?text=${encodeURIComponent(text)}`;
  };
  const cartAction = async (id: string, action: 'REMINDED' | 'DISMISSED') => {
    try { await api(`/store/carts/${id}`, { method: 'PATCH', body: { action } }); await reloadCarts(); if (action === 'DISMISSED') toast('Carrito descartado'); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  const shippingValue = (order: any, key: string) => drafts[order.id]?.[key] ?? (key === 'carrier' ? order.shippingCarrier : key === 'pickupDate' ? order.pickupDate : key === 'pickupWindow' ? order.pickupWindow : key === 'pickupConfirmation' ? order.pickupConfirmation : key === 'trackingNumber' ? order.trackingNumber : key === 'trackingUrl' ? order.trackingUrl : '');
  const updateDraft = (order: any, key: string, value: string) => setDrafts((current) => ({ ...current, [order.id]: { ...(current[order.id] ?? {}), [key]: value } }));
  const saveShipping = async (order: any) => {
    const draft = drafts[order.id] ?? {};
    const body = { carrier: draft.carrier ?? order.shippingCarrier, pickupDate: draft.pickupDate ?? order.pickupDate,
      pickupWindow: draft.pickupWindow ?? order.pickupWindow, pickupConfirmation: draft.pickupConfirmation ?? order.pickupConfirmation ?? '',
      trackingNumber: draft.trackingNumber ?? order.trackingNumber ?? '', trackingUrl: draft.trackingUrl ?? order.trackingUrl ?? '' };
    if (!body.carrier || !body.pickupDate || !body.pickupWindow) { toast('Elige transportadora, fecha y horario de recogida', 'bad'); return; }
    setSavingShipping(order.id);
    try { await api(`/store/orders/${order.id}/shipping`, { method: 'PATCH', body }); await reload(); toast('Datos de envío guardados'); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setSavingShipping(null); }
  };
  return <>
    <PageHeader title="Pedidos y envíos" subtitle="Confirma pedidos de tu página web, registra pagos, agenda envíos y recupera carritos sin terminar." />
    <Card className="mb-4 border-primary/20 bg-sand-50">
      <div className="flex items-start gap-3"><Truck className="h-5 w-5 text-primary mt-0.5" /><div><p className="text-sm font-semibold">¿Dónde se agenda una recogida?</p><p className="text-xs text-ink-muted mt-1">Confirma primero el pedido. En su tarjeta aparecerá la sección «Envío y recogida»: elige una transportadora, abre su portal para solicitar la recogida y guarda aquí la fecha, confirmación y guía.</p><p className="text-xs text-ink-muted mt-2">Transportadoras disponibles: Coordinadora, Servientrega, Inter Rapidísimo, envía y TCC.</p></div></div>
    </Card>
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'orders', label: `Pedidos${data ? ` (${data.length})` : ''}` }, { value: 'carts', label: `Carritos sin terminar${carts?.length ? ` (${carts.length})` : ''}` }]} /></div>
    {tab === 'carts' && <Card title={<span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Carritos sin terminar</span>}>
      <p className="text-xs text-ink-muted mb-3">Solo aparecen compradores que autorizaron que les escribieras si no terminaban. Revisa el mensaje antes de enviarlo: se abre en tu WhatsApp y tú decides si lo mandas.</p>
      {!carts?.length ? <Empty title="No hay carritos pendientes" description="Cuando alguien deje productos sin confirmar (y lo autorice), aparecerá aquí después de 30 minutos." /> : <div className="divide-y divide-line">{carts.map((c) => <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0"><p className="text-sm font-medium">{c.customerName} · <span className="text-ink-muted font-normal">{c.customerPhone}</span></p><p className="text-xs text-ink-muted truncate">{c.items.map((i: any) => `${i.quantity} × ${i.name}`).join(' · ')}</p><p className="text-xs text-ink-faint">{money(c.subtotal)} · {date(c.updatedAt, true)}{c.remindedAt ? ` · recordado ${date(c.remindedAt, true)}` : ''}</p></div>
        <div className="flex gap-2"><a className="btn-secondary btn-sm" href={cartMessage(c)} target="_blank" rel="noreferrer" onClick={() => cartAction(c.id, 'REMINDED')}><MessageCircle className="h-4 w-4" /> Preparar mensaje</a><button className="btn-ghost btn-sm" onClick={() => cartAction(c.id, 'DISMISSED')}>Descartar</button></div>
      </div>)}</div>}
    </Card>}
    {tab === 'orders' && error && <div className="mb-4"><ErrorBox message={error} onRetry={reload} /></div>}
    {tab !== 'orders' ? null : loading && !data ? <Loading /> : data?.length === 0 ? <Card><Empty title="Aún no hay pedidos web" description="Cuando un cliente complete una compra desde tu tienda, aparecerá aquí." /></Card> : <div className="space-y-4">
      {data?.map((order) => <Card key={order.id} className="overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5 justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap"><h2 className="font-semibold">Pedido #{order.id.slice(0, 8)}</h2><Badge tone={TONE[order.status] ?? 'muted'}>{LABEL[order.status] ?? order.status}</Badge>{order.status !== 'CANCELLED' && <Badge tone={order.paymentStatus === 'PAID' ? 'ok' : order.paymentStatus === 'FAILED' ? 'bad' : 'warn'}>{order.paymentStatus === 'PAID' ? 'Pagado' : order.paymentStatus === 'FAILED' ? 'Pago rechazado' : 'Pago pendiente'}</Badge>}{order.deliveryMethod === 'PICKUP' && <Badge tone="sand">Recoge en el local</Badge>}{order.couponCode && <Badge tone="sand">Cupón {order.couponCode}</Badge>}{order.marketingOptIn && <Badge>Acepta promociones</Badge>}<span className="text-xs text-ink-faint">{date(order.createdAt, true)}</span></div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm"><p><span className="text-ink-muted">Cliente: </span>{order.customerName}</p><p><span className="text-ink-muted">Teléfono: </span><a className="hover:underline" href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></p><p><span className="text-ink-muted">{order.deliveryMethod === 'PICKUP' ? 'Recoge en: ' : 'Entrega: '}</span>{order.address}{order.deliveryMethod === 'PICKUP' ? '' : `, ${order.city}`}</p><p><span className="text-ink-muted">Pago: </span>{order.paymentMethod}</p></div>
            {(order.attributionSource || order.attributionCampaign) && <p className="mt-2 text-xs text-ink-muted">Llegó desde: <span className="font-medium text-ink">{order.attributionSource ?? 'anuncio'}{order.attributionCampaign ? ` · ${order.attributionCampaign}` : ''}</span>{order.attributionMedium ? ` · ${order.attributionMedium}` : ''}</p>}
            <div className="mt-4 rounded-xl bg-sand-50 divide-y divide-line/70">{order.items.map((item: any) => <div key={item.id} className="flex justify-between gap-3 px-3 py-2 text-sm"><span>{item.quantity} × {item.productName}{item.preparationMinutes ? <span className="block text-xs text-ink-muted">Preparación: {item.preparationMinutes} min</span> : null}{item.selectedOptions && Object.entries(item.selectedOptions).map(([key, value]) => <span key={key} className="block text-xs text-ink-muted">{key}: {Array.isArray(value) ? value.join(', ') : String(value)}</span>)}</span><span className="tabular-nums">{money(Number(item.unitPrice) * item.quantity)}</span></div>)}</div>
            {order.notes && <p className="mt-3 text-sm rounded-xl border border-line px-3 py-2"><span className="text-ink-muted">Notas del cliente: </span>{order.notes}</p>}
            <p className="text-right font-semibold mt-3">{Number(order.discount) > 0 && <span className="font-normal text-ok">Descuento {order.couponCode}: −{money(order.discount)} · </span>}Envío: {money(order.shippingFee ?? 0)} · Total: {money(order.total)}{Number(order.paymentDue) < Number(order.total) && <span className="block text-xs font-normal text-ink-muted">Anticipo a cobrar: {money(order.paymentDue)} · saldo pendiente: {money(Number(order.total) - Number(order.paymentDue))}</span>}</p>
            {order.saleId && <p className="mt-2 text-xs text-ink-muted text-right">Registrado como venta · <Link className="underline text-ink" href={`/ventas/${order.saleId}`}>ver venta</Link>{order.status === 'DELIVERED' && <> · <Link className="underline text-ink" href={`/devoluciones?pedido=${order.id}`}>registrar devolución</Link></>}</p>}
            {order.deliveryMethod !== 'PICKUP' && ['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(order.status) && <div className="mt-4 rounded-xl border border-line p-4 space-y-3">
              <div><p className="text-sm font-medium">Envío y recogida</p><p className="text-xs text-ink-muted mt-1">Agenda la recogida en la transportadora y registra aquí la confirmación y la guía para seguir el despacho.</p></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-ink-muted">Transportadora<select className="input mt-1" value={shippingValue(order, 'carrier') || ''} onChange={(e) => updateDraft(order, 'carrier', e.target.value)}><option value="">Selecciona…</option>{CARRIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="text-xs text-ink-muted">Fecha de recogida<input className="input mt-1" type="date" min={new Date().toLocaleDateString('en-CA')} value={shippingValue(order, 'pickupDate') || ''} onChange={(e) => updateDraft(order, 'pickupDate', e.target.value)} /></label>
                <label className="text-xs text-ink-muted">Franja horaria<select className="input mt-1" value={shippingValue(order, 'pickupWindow') || ''} onChange={(e) => updateDraft(order, 'pickupWindow', e.target.value)}><option value="">Selecciona…</option>{WINDOW_OPTIONS.map((w) => <option key={w}>{w}</option>)}</select></label>
                <label className="text-xs text-ink-muted">Número de guía<input className="input mt-1" value={shippingValue(order, 'trackingNumber') || ''} onChange={(e) => updateDraft(order, 'trackingNumber', e.target.value)} maxLength={80} placeholder="Lo entrega la transportadora" /></label>
                <label className="text-xs text-ink-muted sm:col-span-2">Enlace de seguimiento<input className="input mt-1" type="url" value={shippingValue(order, 'trackingUrl') || ''} onChange={(e) => updateDraft(order, 'trackingUrl', e.target.value)} placeholder="https://…" /></label>
                <label className="text-xs text-ink-muted sm:col-span-2">Confirmación de recogida<input className="input mt-1" value={shippingValue(order, 'pickupConfirmation') || ''} onChange={(e) => updateDraft(order, 'pickupConfirmation', e.target.value)} maxLength={100} placeholder="Código o referencia de la transportadora" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                {shippingValue(order, 'carrier') && CARRIERS.find((c) => c.id === shippingValue(order, 'carrier'))?.url && <a className="btn-secondary btn-sm" href={CARRIERS.find((c) => c.id === shippingValue(order, 'carrier'))!.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir portal de recogida</a>}
                <button className="btn-primary btn-sm" disabled={savingShipping === order.id} onClick={() => saveShipping(order)}>{savingShipping === order.id ? 'Guardando…' : 'Guardar envío'}</button>
              </div>
              {order.pickupDate && <p className="text-xs text-emerald-700">Recogida registrada: {order.pickupDate} · {order.pickupWindow}{order.pickupConfirmation ? ` · Confirmación ${order.pickupConfirmation}` : ''}{order.trackingNumber ? ` · Guía ${order.trackingNumber}` : ''}</p>}
            </div>}
          </div>
          <div className="flex flex-wrap lg:flex-col gap-2 lg:w-56 shrink-0">
            {(NEXT[order.status] ?? []).flatMap((action) => {
              const pickup = order.deliveryMethod === 'PICKUP';
              if (action.status === 'DELIVERED' && order.paymentStatus !== 'PAID') return [
                <button key="dp" className="btn-secondary justify-center" onClick={() => change(order.id, 'DELIVERED', 'entregado', true)}><PackageCheck className="h-4 w-4" />Entregado y pagado</button>,
                <button key="dn" className="btn-ghost justify-center" onClick={() => change(order.id, 'DELIVERED', 'entregado', false)}><PackageCheck className="h-4 w-4" />Entregado, pago pendiente</button>];
              const label = pickup && action.status === 'SHIPPED' ? 'Listo para recoger' : action.label;
              const Icon = pickup && action.status === 'SHIPPED' ? Store : action.icon;
              return [<button key={action.status} className={action.status === 'CANCELLED' ? 'btn-ghost text-bad justify-center' : 'btn-secondary justify-center'} onClick={() => change(order.id, action.status, label)}><Icon className="h-4 w-4" />{label}</button>];
            })}
            {order.status !== 'CANCELLED' && order.paymentStatus !== 'PAID' && order.paymentProvider !== 'WOMPI' && <button className="btn-ghost justify-center" onClick={() => markPaid(order.id)}><Wallet className="h-4 w-4" />Registrar pago recibido</button>}
            <a className="btn-ghost justify-center" href={waText(order, current?.tradeName ?? 'nuestra tienda')} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />Avisar por WhatsApp</a>
          </div>
        </div>
      </Card>)}
    </div>}
  </>;
}
