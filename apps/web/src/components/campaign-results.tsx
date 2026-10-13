'use client';
import { BarChart3, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, Card, ErrorBox, Field, Modal, Spinner, TableWrap, useToast } from './ui';

type Campaign = { id: string; name: string; source: string; campaignKey: string; spend: string; couponCode: string | null; startsOn: string | null; endsOn: string | null; orders: number; revenue: string; roas: number | null; costPerOrder: string | null };
type Results = { campaigns: Campaign[]; unregistered: { campaignKey: string; source: string | null; orders: number; revenue: string }[] };
const SOURCES = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['google', 'Google'], ['whatsapp', 'WhatsApp'], ['mercadolibre', 'Mercado Libre'], ['otro', 'Otro']] as const;
const empty = { name: '', source: 'instagram', campaignKey: '', spend: '0', couponCode: '', startsOn: '', endsOn: '' };

/**
 * Inversión vs. ventas atribuidas: une el dinero invertido en cada campaña con los pedidos de la página web
 * que llegaron por su enlace rastreable (utm_campaign) o usaron su cupón. No se conecta a las cuentas
 * publicitarias: la inversión la registra el negocio (o se importará con OAuth cuando haya apps aprobadas).
 */
export function CampaignResults() {
  const toast = useToast();
  const { data, error, reload } = useApi<Results>('/store/campaigns');
  const [form, setForm] = useState<typeof empty & { id?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!form) return;
    setBusy(true); setErr('');
    const { id, ...f } = form;
    try {
      await api(id ? `/store/campaigns/${id}` : '/store/campaigns', { method: id ? 'PATCH' : 'POST', body: { ...f, couponCode: f.couponCode.trim().toUpperCase() || null, startsOn: f.startsOn || null, endsOn: f.endsOn || null } });
      setForm(null); await reload(); toast('Campaña guardada');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (c: Campaign) => {
    try { await api(`/store/campaigns/${c.id}`, { method: 'DELETE' }); await reload(); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const totals = (data?.campaigns ?? []).reduce((a, c) => ({ spend: a.spend + Number(c.spend), revenue: a.revenue + Number(c.revenue), orders: a.orders + c.orders }), { spend: 0, revenue: 0, orders: 0 });
  return <Card title={<span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Resultados de campañas</span>}
    actions={<button className="btn-primary btn-sm" onClick={() => { setErr(''); setForm({ ...empty }); }}><Plus className="h-4 w-4" /> Registrar campaña</button>}>
    <p className="text-xs text-ink-muted mb-3">Registra cuánto invertiste. DREAMS cuenta los pedidos de tu página web que llegaron con el enlace rastreable de la campaña (el identificador es el <b>utm_campaign</b> que genera el creador de anuncios) o con su cupón.</p>
    {error && <ErrorBox message={error} onRetry={reload} />}
    {data && (data.campaigns.length ? <>
      <div className="grid grid-cols-3 gap-3 mb-3 text-center">
        <div className="rounded-xl bg-sand-50 p-3"><p className="text-[11px] text-ink-muted">Invertido</p><p className="font-semibold">{money(totals.spend)}</p></div>
        <div className="rounded-xl bg-sand-50 p-3"><p className="text-[11px] text-ink-muted">Ventas atribuidas</p><p className="font-semibold">{money(totals.revenue)}</p></div>
        <div className="rounded-xl bg-sand-50 p-3"><p className="text-[11px] text-ink-muted">Retorno</p><p className="font-semibold">{totals.spend ? `${(totals.revenue / totals.spend).toFixed(1)}×` : '—'}</p></div>
      </div>
      <TableWrap><table className="w-full text-sm"><thead><tr className="text-left text-xs text-ink-muted"><th className="py-2 pr-3">Campaña</th><th className="pr-3 text-right">Inversión</th><th className="pr-3 text-right">Pedidos</th><th className="pr-3 text-right">Ventas</th><th className="pr-3 text-right">Retorno</th><th /></tr></thead>
        <tbody className="divide-y divide-line">{data.campaigns.map((c) => <tr key={c.id}>
          <td className="py-2 pr-3"><button className="text-left hover:underline" onClick={() => { setErr(''); setForm({ id: c.id, name: c.name, source: c.source, campaignKey: c.campaignKey, spend: String(Number(c.spend)), couponCode: c.couponCode ?? '', startsOn: c.startsOn ?? '', endsOn: c.endsOn ?? '' }); }}><span className="font-medium">{c.name}</span><span className="block text-[11px] text-ink-muted">{c.source} · {c.campaignKey}{c.couponCode ? ` · cupón ${c.couponCode}` : ''}</span></button></td>
          <td className="pr-3 text-right tabular-nums">{money(c.spend)}</td><td className="pr-3 text-right tabular-nums">{c.orders}</td><td className="pr-3 text-right tabular-nums">{money(c.revenue)}</td>
          <td className="pr-3 text-right">{c.roas === null ? '—' : <Badge tone={c.roas >= 1 ? 'ok' : 'warn'}>{c.roas.toFixed(1)}×</Badge>}</td>
          <td className="text-right"><button className="btn-ghost !px-1.5 !h-7 text-bad" onClick={() => remove(c)} aria-label={`Eliminar ${c.name}`}><Trash2 className="h-3.5 w-3.5" /></button></td>
        </tr>)}</tbody></table></TableWrap>
      <p className="text-[11px] text-ink-faint mt-2">Retorno = ventas atribuidas ÷ inversión. Por encima de 1× la campaña vendió más de lo que costó (sin descontar el costo de los productos).</p>
    </> : <p className="text-sm text-ink-muted">Aún no registras campañas.</p>)}
    {!!data?.unregistered.length && <div className="mt-4 rounded-xl border border-dashed border-line p-3"><p className="text-xs font-medium mb-2">Campañas con ventas pero sin inversión registrada</p>{data.unregistered.map((u) =>
      <div key={u.campaignKey} className="flex items-center justify-between gap-2 text-xs py-1"><span>{u.campaignKey}{u.source ? ` · ${u.source}` : ''} — {u.orders} pedidos · {money(u.revenue)}</span><button className="btn-ghost btn-sm" onClick={() => { setErr(''); setForm({ ...empty, name: u.campaignKey, campaignKey: u.campaignKey, source: u.source ?? 'otro' }); }}>Registrar</button></div>)}</div>}
    <Modal open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? 'Editar campaña' : 'Registrar campaña'}
      footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={busy || !form?.name || !form?.campaignKey} onClick={save}>{busy && <Spinner />} Guardar</button></>}>
      {form && <div className="grid sm:grid-cols-2 gap-3">
        {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
        <Field label="Nombre"><input className="input" maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lanzamiento colección" /></Field>
        <Field label="Plataforma"><select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Identificador (utm_campaign)" hint="El mismo «nombre de campaña» del enlace rastreable."><input className="input" maxLength={160} value={form.campaignKey} onChange={(e) => setForm({ ...form, campaignKey: e.target.value })} /></Field>
        <Field label="Inversión total (COP)"><input className="input" inputMode="decimal" value={form.spend} onChange={(e) => setForm({ ...form, spend: e.target.value.replace(/[^0-9.]/g, '') || '0' })} /></Field>
        <Field label="Cupón de la campaña (opcional)"><input className="input font-mono uppercase" maxLength={40} value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} /></Field>
        <span />
        <Field label="Desde (opcional)"><input type="date" className="input" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
        <Field label="Hasta (opcional)"><input type="date" className="input" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></Field>
      </div>}
    </Modal>
  </Card>;
}
