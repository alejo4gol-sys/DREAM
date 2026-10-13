'use client';
import { Check, CheckCircle2, ChevronDown, ExternalLink, Facebook, Instagram, MessageCircle, Music2, Twitter, Youtube, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HBars } from '@/components/charts';
import { PeriodPicker, usePeriod } from '@/components/period';
import { Badge, Card, Disclaimer, Loading, PageHeader, Spinner, TableWrap, useToast } from '@/components/ui';
import { CHANNELS, money } from '@/lib/format';
import { qs, useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { socialHref } from '@/components/social';

const ICONS: Record<string, any> = { INSTAGRAM: Instagram, FACEBOOK: Facebook, WHATSAPP: MessageCircle, TIKTOK: Music2, YOUTUBE: Youtube, X: Twitter };

export default function SocialPage() {
  const period = usePeriod('month');
  const { data: stats } = useApi<any>(`/social/channel-stats${qs({ from: period.from, to: period.to })}`);
  const { data: platforms } = useApi<any[]>('/social/platforms');
  const { data: accounts } = useApi<any[]>('/social/accounts');
  const { data: links, setData: setLinks } = useApi<Record<string, string>>('/social/links');
  const { can } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const totalSales = stats?.sales.reduce((a: number, s: any) => a + s.total, 0) ?? 0;

  return (
    <>
      <PageHeader title="Centro de Redes Sociales" subtitle="Qué canal te trae ventas y clientes, y el estado de cada integración." actions={<PeriodPicker {...period} />} />
      <div className="grid lg:grid-cols-[1fr_1fr] gap-5 mb-5">
        <Card title="Ventas por canal">
          {!stats ? <Loading /> : <HBars data={stats.sales.map((s: any) => ({ name: `${CHANNELS[s.channel]} · ${s.orders} pedidos`, value: s.total }))} />}
        </Card>
        <Card title="Rendimiento por canal" padded={false}>
          {!stats ? <Loading /> : (
            <TableWrap>
              <table className="table">
                <thead><tr><th>Canal</th><th className="text-right">Participación</th><th className="text-right">Ticket prom.</th><th className="text-right">Clientes</th></tr></thead>
                <tbody>
                  {stats.sales.map((s: any) => (
                    <tr key={s.channel}>
                      <td className="font-medium">{CHANNELS[s.channel]}</td>
                      <td className="text-right tabular-nums">{totalSales ? Math.round((s.total / totalSales) * 100) : 0}%</td>
                      <td className="text-right tabular-nums">{money(s.avgTicket)}</td>
                      <td className="text-right tabular-nums">{stats.customers.find((c: any) => c.channel === s.channel)?.customers ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card title="Tus redes sociales" padded={false}>
        <p className="px-5 -mt-1 pb-4 text-sm text-ink-muted">Escribe el usuario o el enlace de cada cuenta de tu negocio. Quedan guardadas al instante y aparecen en tu perfil de negocio; no necesitas aprobación de ninguna plataforma para registrarlas.</p>
        <ul className="divide-y divide-line border-t border-line">
          {platforms?.map((p) => (
            <PlatformRow key={p.platform} p={p} value={links?.[p.platform.toLowerCase()] ?? ''} canEdit={can('social:manage')}
              connected={(accounts?.filter((a) => a.platform === p.platform).length ?? 0) > 0}
              open={open === p.platform} onToggle={() => setOpen(open === p.platform ? null : p.platform)}
              onSaved={(v) => setLinks(v)} />
          ))}
        </ul>
      </Card>
      <div className="mt-4"><Disclaimer>DREAMS usa únicamente las APIs oficiales de cada plataforma y respeta sus políticas. Nunca pide tu contraseña de redes sociales: la conexión se hace con el inicio de sesión oficial (OAuth) y los tokens se guardan cifrados.</Disclaimer></div>
    </>
  );
}

const PLACEHOLDER: Record<string, string> = {
  INSTAGRAM: '@tunegocio', FACEBOOK: 'facebook.com/tunegocio', WHATSAPP: '+57 300 000 0000',
  TIKTOK: '@tunegocio', YOUTUBE: '@tucanal', X: '@tunegocio',
};

function PlatformRow({ p, value, canEdit, connected, open, onToggle, onSaved }: {
  p: any; value: string; canEdit: boolean; connected: boolean; open: boolean; onToggle: () => void; onSaved: (v: Record<string, string>) => void;
}) {
  const toast = useToast();
  const Icon = ICONS[p.platform];
  const key = p.platform.toLowerCase();
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setV(value), [value]);
  const dirty = v.trim() !== value;
  const href = value ? socialHref(key, value) : null;

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<Record<string, string>>('/social/links', { method: 'PUT', body: { links: { [key]: v.trim() } } });
      onSaved(r);
      toast(v.trim() ? `${p.name.split(' ')[0]} guardado` : `${p.name.split(' ')[0]} eliminado`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-4 lg:w-72 shrink-0">
          <span className="h-10 w-10 rounded-xl bg-sand-100 flex items-center justify-center"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block font-medium text-sm">{p.name}</span>
            {value ? <span className="flex items-center gap-1 text-xs text-ok"><Check className="h-3.5 w-3.5" /> Cuenta registrada</span>
              : <span className="block text-xs text-ink-muted">Sin registrar</span>}
          </span>
        </div>
        <form className="flex-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }}>
          <input className="input" maxLength={200} placeholder={PLACEHOLDER[p.platform]} value={v} disabled={!canEdit}
            onChange={(e) => setV(e.target.value)} aria-label={`Cuenta de ${p.name}`} />
          {canEdit && <button className="btn-primary shrink-0" disabled={!dirty || busy}>{busy ? <Spinner /> : 'Guardar'}</button>}
          {href && <a className="btn-secondary !px-3 shrink-0" href={href} target="_blank" rel="noopener noreferrer" title="Abrir perfil"><ExternalLink className="h-4 w-4" /></a>}
        </form>
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink shrink-0 lg:w-48 lg:justify-end">
          {connected ? <Badge tone="ok">Sincronizada</Badge> : <span>Sincronización automática</span>}
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {err && <p className="text-xs text-bad mt-2">{err}</p>}
      {open && (
        <div className="mt-4 rounded-xl bg-sand-50 border border-line p-4 grid md:grid-cols-3 gap-4 text-sm">
          <div className="md:col-span-3 text-xs text-ink-muted">
            Registrar tu cuenta ya funciona. Para que DREAMS <b>lea automáticamente</b> mensajes, comentarios y estadísticas se necesita la API oficial ({p.api}), que exige aprobación de la plataforma:
          </div>
          <div>
            <p className="label">Requisitos</p>
            <ul className="space-y-1">{p.requirements.map((r: string) => <li key={r} className="text-ink-soft">• {r}</li>)}</ul>
          </div>
          <div>
            <p className="label">Qué se podrá hacer</p>
            <ul className="space-y-1">{p.can.map((r: string) => <li key={r} className="flex gap-1.5"><CheckCircle2 className="h-4 w-4 text-ok shrink-0 mt-0.5" />{r}</li>)}</ul>
          </div>
          <div>
            <p className="label">Limitaciones de la API</p>
            <ul className="space-y-1">{p.cannot.map((r: string) => <li key={r} className="flex gap-1.5"><XCircle className="h-4 w-4 text-ink-faint shrink-0 mt-0.5" />{r}</li>)}</ul>
          </div>
        </div>
      )}
    </li>
  );
}
