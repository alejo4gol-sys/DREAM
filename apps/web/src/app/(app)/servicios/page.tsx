'use client';
import { CalendarCheck, Package, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useProfile } from '@/components/services-ui';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, Tabs, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { PRICING_UNITS } from '@/lib/service-profiles';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const UNIT_SUFFIX: Record<string, string> = { FIXED: '', HOUR: ' / hora', SESSION: ' / sesión', MONTH: ' / mes' };
type Form = { id?: string; isService: boolean; name: string; description: string; salePrice: string; costPrice: string; pricingUnit: string; isActive: boolean;
  initialStock: string; minStock: string; bookable: boolean; weekdays: number[]; startTime: string; endTime: string; duration: string; depositPercent: string };
const blank = (isService: boolean): Form => ({ isService, name: '', description: '', salePrice: '', costPrice: '0', pricingUnit: 'FIXED', isActive: true, initialStock: '0', minStock: '0',
  bookable: false, weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00', duration: '60', depositPercent: '0' });

export default function ServicesCatalogPage() {
  const p = useProfile();
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState<'services' | 'parts'>('services');
  const { data, loading, error, reload } = useApi<any>(`/products?isService=${tab === 'services'}&includeInactive=true&pageSize=200`);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const write = can('products:write');

  const open = (x?: any) => {
    setErr('');
    if (!x) return setForm(blank(tab === 'services'));
    const sch = x.appointmentSchedule;
    setForm({ id: x.id, isService: x.isService, name: x.name, description: x.description ?? '', salePrice: String(Number(x.salePrice)), costPrice: String(Number(x.costPrice)),
      pricingUnit: x.pricingUnit ?? 'FIXED', isActive: x.isActive, initialStock: String(x.stock ?? 0), minStock: String(x.minStock ?? 0), bookable: Boolean(sch),
      weekdays: sch?.weekdays ?? [1, 2, 3, 4, 5], startTime: sch?.startTime ?? '09:00', endTime: sch?.endTime ?? '18:00', duration: String(sch?.durationMinutes ?? 60), depositPercent: String(x.depositPercent ?? 0) });
  };
  const save = async () => {
    if (!form) return;
    setBusy(true); setErr('');
    const schedule = form.isService && form.bookable ? { weekdays: form.weekdays, startTime: form.startTime, endTime: form.endTime, intervalMinutes: Number(form.duration), durationMinutes: Number(form.duration) } : null;
    const body: any = { name: form.name.trim(), description: form.description.trim() || undefined, salePrice: form.salePrice || '0', costPrice: form.costPrice || '0', isService: form.isService,
      pricingUnit: form.isService ? form.pricingUnit : 'FIXED', isActive: form.isActive, minStock: form.isService ? 0 : Number(form.minStock) || 0,
      depositPercent: Number(form.depositPercent) || 0, appointmentSchedule: schedule,
      storeOptions: schedule ? [{ name: 'Fecha', type: 'date', required: true }, { name: 'Hora', type: 'time', required: true }] : [] };
    try {
      if (form.id) await api(`/products/${form.id}`, { method: 'PATCH', body });
      else await api('/products', { body: { ...body, sku: `${form.isService ? 'SRV' : 'REP'}-${Date.now().toString(36).toUpperCase()}`, initialStock: form.isService ? 0 : Number(form.initialStock) || 0 } });
      setForm(null); await reload(); toast('Guardado');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return <>
    <PageHeader title={p.partsLabel ? `Servicios y ${p.partsLabel.toLowerCase()}` : 'Servicios'} subtitle="Lo que ofreces, cuánto cuesta y si tus clientes pueden reservarlo en tu página web."
      actions={write && <button className="btn-primary" onClick={() => open()}><Plus className="h-4 w-4" /> {tab === 'services' ? 'Nuevo servicio' : `Nuevo ${p.partsLabel?.toLowerCase().replace(/s$/, '') ?? 'artículo'}`}</button>} />
    {p.partsLabel && <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'services', label: 'Servicios' }, { value: 'parts', label: `${p.partsLabel} (con inventario)` }]} /></div>}
    {error && <ErrorBox message={error} onRetry={reload} />}
    {loading && !data ? <Loading /> : !data?.items?.length ? <Card><Empty title={tab === 'services' ? 'Aún no tienes servicios' : `Aún no tienes ${p.partsLabel?.toLowerCase()}`} description={tab === 'services' ? 'Crea tus servicios con precio y, si quieres, horario para que te reserven en línea.' : 'Los repuestos y materiales sí manejan inventario: se descuentan al cobrar.'} /></Card>
      : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{data.items.map((x: any) => <Card key={x.id} className={cn(!x.isActive && 'opacity-60')}>
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 rounded-xl bg-sand-100 flex items-center justify-center shrink-0">{x.isService ? <CalendarCheck className="h-5 w-5 text-sand-500" /> : <Package className="h-5 w-5 text-sand-500" />}</span>
          <div className="flex-1 min-w-0"><p className="font-medium">{x.name}</p><p className="text-sm">{money(x.salePrice)}<span className="text-ink-muted">{UNIT_SUFFIX[x.pricingUnit] ?? ''}</span></p></div>
          {write && <button className="btn-ghost !px-2" onClick={() => open(x)} aria-label={`Editar ${x.name}`}><Pencil className="h-4 w-4" /></button>}
        </div>
        {x.description && <p className="text-xs text-ink-muted mt-2 line-clamp-3">{x.description}</p>}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {!x.isActive && <Badge>Inactivo</Badge>}
          {x.appointmentSchedule && <Badge tone="sand">Reservable en la web · {x.appointmentSchedule.durationMinutes} min</Badge>}
          {!x.isService && <Badge tone={x.stock <= x.minStock ? 'warn' : 'muted'}>Stock {x.stock}{x.stock <= x.minStock ? ' · bajo' : ''}</Badge>}
        </div>
      </Card>)}</div>}

    <Modal open={Boolean(form)} onClose={() => setForm(null)} wide title={form?.id ? 'Editar' : form?.isService ? 'Nuevo servicio' : `Nuevo ${p.partsLabel?.toLowerCase() ?? 'artículo'}`}
      footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={busy || !form?.name.trim()} onClick={save}>{busy && <Spinner />} Guardar</button></>}>
      {form && <div className="grid sm:grid-cols-2 gap-3">
        {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
        <Field label="Nombre" className="sm:col-span-2"><input className="input" maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.isService ? (p.key === 'LEGAL' ? 'Ej. Consulta jurídica' : 'Ej. Cambio de pantalla') : 'Ej. Pantalla iPhone 11'} /></Field>
        <Field label="Precio (COP)"><input className="input" inputMode="decimal" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
        {form.isService ? <Field label="Se cobra"><select className="input" value={form.pricingUnit} onChange={(e) => setForm({ ...form, pricingUnit: e.target.value })}>{Object.entries(PRICING_UNITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          : <Field label="Costo (COP)"><input className="input" inputMode="decimal" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>}
        {!form.isService && <>{!form.id && <Field label="Unidades en inventario"><input className="input" inputMode="numeric" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: e.target.value.replace(/\D/g, '') })} /></Field>}
          <Field label="Avisarme cuando queden" hint="Stock mínimo"><input className="input" inputMode="numeric" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value.replace(/\D/g, '') })} /></Field></>}
        <Field label="Descripción" className="sm:col-span-2" hint="Tus clientes la ven en tu página y el Asistente IA la usa para responder."><textarea className="input min-h-20" maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        {form.isService && <div className="sm:col-span-2 rounded-xl border border-line p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="accent-ink" checked={form.bookable} onChange={(e) => setForm({ ...form, bookable: e.target.checked })} /> Se puede reservar en mi página web</label>
          {form.bookable && <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Días" className="sm:col-span-4"><div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => <button key={d} type="button" onClick={() => setForm({ ...form, weekdays: form.weekdays.includes(i) ? form.weekdays.filter((x) => x !== i) : [...form.weekdays, i].sort() })} className={cn('chip px-3 py-1.5 text-xs border', form.weekdays.includes(i) ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink-muted')}>{d}</button>)}</div></Field>
            <Field label="Desde"><input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
            <Field label="Hasta"><input type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
            <Field label="Duración"><select className="input" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>{[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Field>
            <Field label="Anticipo (%)"><input className="input" inputMode="numeric" value={form.depositPercent} onChange={(e) => setForm({ ...form, depositPercent: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></Field>
            <p className="sm:col-span-4 text-[11px] text-ink-muted">Las reservas llegan a tu Agenda y a «Reservas web», donde confirmas el pago. No se cruzan dos reservas en el mismo horario.</p>
          </div>}
        </div>}
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-ink" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Activo (visible para vender y en tu página)</label>
      </div>}
    </Modal>
  </>;
}
