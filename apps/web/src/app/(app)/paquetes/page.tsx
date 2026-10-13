'use client';
import { CalendarCheck, Pencil, Plus, Ticket, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, Stat, Tabs, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { qs, useApi } from '@/lib/hooks';

const STATUS: Record<string, { label: string; tone: any }> = {
  ACTIVE: { label: 'Activo', tone: 'ok' }, USED: { label: 'Agotado', tone: 'muted' }, EXPIRED: { label: 'Vencido', tone: 'warn' }, CANCELLED: { label: 'Cancelado', tone: 'bad' },
};
const d = (s?: string | null) => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function PackageForm({ initial, onClose, onSaved }: { initial: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    const body = { name: f.name, kind: f.kind, description: f.description || undefined, sessions: f.kind === 'PACKAGE' ? Number(f.sessions) : undefined, validityDays: Number(f.validityDays), price: String(f.price).replace(/\D/g, '') || '0', active: f.active };
    try { f.id ? await api(`/packages/${f.id}`, { method: 'PUT', body }) : await api('/packages', { body }); onSaved(); onClose(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title={f.id ? 'Editar' : 'Nuevo paquete o membresía'}
    footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={busy || f.name.length < 2}>{busy && <Spinner />} Guardar</button></>}>
    {err && <ErrorBox message={err} />}
    <div className="space-y-3">
      <Tabs value={f.kind} onChange={(kind) => setF({ ...f, kind, validityDays: kind === 'MEMBERSHIP' ? 30 : f.validityDays })} items={[{ value: 'PACKAGE', label: 'Paquete de sesiones' }, { value: 'MEMBERSHIP', label: 'Membresía por tiempo' }]} />
      <p className="text-xs text-ink-muted">{f.kind === 'PACKAGE' ? 'Ej. «10 clases de yoga», «5 lavados», «4 sesiones de fisioterapia». Cada visita descuenta una sesión.' : 'Ej. «Mensualidad del gimnasio», «Plan mensual de asesoría». El cliente puede venir las veces que quiera mientras esté vigente.'}</p>
      <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        {f.kind === 'PACKAGE' && <Field label="Sesiones"><input className="input" type="number" min={1} value={f.sessions} onChange={(e) => setF({ ...f, sessions: e.target.value })} /></Field>}
        <Field label="Vence a los (días)"><input className="input" type="number" min={1} value={f.validityDays} onChange={(e) => setF({ ...f, validityDays: e.target.value })} /></Field>
        <Field label="Precio"><input className="input" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      <Field label="Descripción (opcional)"><textarea className="input" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Disponible para la venta</label>
    </div>
  </Modal>;
}

export default function PackagesPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState<'clientes' | 'planes'>('clientes');
  const [status, setStatus] = useState('ACTIVE');
  const { data: pkgs, error, reload } = useApi<any[]>('/packages');
  const { data: rows, reload: reloadRows } = useApi<any[]>(`/packages/customers${qs({ status })}`);
  const { data: sum, reload: reloadSum } = useApi<any>('/packages/summary');
  const [form, setForm] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState('');
  if (error) return <ErrorBox message={error} />;
  const use = async (cp: any) => {
    setBusy(cp.id);
    try { const r = await api<any>(`/packages/customers/${cp.id}/use`, { body: {} }); toast(r.remaining == null ? 'Visita registrada' : `Visita registrada · quedan ${r.remaining}`); reloadRows(); reloadSum(); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const open = async (cp: any) => setDetail(await api(`/packages/customers/${cp.id}`));
  return <>
    <PageHeader title="Paquetes y membresías" subtitle="Vende sesiones por adelantado o mensualidades, y lleva el control de cada visita."
      actions={can('products:write') && <button className="btn-primary" onClick={() => setForm({ name: '', kind: 'PACKAGE', sessions: 5, validityDays: 90, price: '', description: '', active: true })}><Plus className="h-4 w-4" /> Nuevo</button>} />
    {sum && <div className="grid grid-cols-3 gap-3 mb-5">
      <Stat label="Clientes con plan activo" value={sum.active} />
      <Stat label="Vencen en 7 días" value={sum.expiring} />
      <Stat label="Con 1 sesión o menos" value={sum.lowSessions} />
    </div>}
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'clientes', label: 'Clientes' }, { value: 'planes', label: 'Mis paquetes y membresías' }]} /></div>
    {tab === 'planes' && <Card>
      {!pkgs ? <Loading /> : !pkgs.length ? <Empty icon={<Ticket className="h-6 w-6" />} title="Aún no tienes paquetes" description="Crea un paquete de sesiones o una membresía mensual. Se vende como cualquier servicio." /> :
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{pkgs.map((p) => <li key={p.id} className={cn('rounded-xl border border-line p-4', !p.active && 'opacity-60')}>
          <div className="flex items-start justify-between gap-2"><p className="font-medium">{p.name}</p><Badge tone={p.kind === 'PACKAGE' ? 'sand' : 'ink'}>{p.kind === 'PACKAGE' ? `${p.sessions} sesiones` : 'Membresía'}</Badge></div>
          <p className="text-xl font-semibold mt-1">{money(p.price)}</p>
          <p className="text-xs text-ink-muted">Vigencia {p.validityDays} días · {p.sold ?? 0} vendidos · {p.activeNow ?? 0} activos</p>
          {p.description && <p className="text-sm text-ink-muted mt-2 line-clamp-2">{p.description}</p>}
          {can('products:write') && <div className="flex gap-1 mt-3">
            <button className="btn-ghost btn-sm" onClick={() => setForm({ ...p, price: String(Math.round(Number(p.price))) })}><Pencil className="h-3.5 w-3.5" /> Editar</button>
            <button className="btn-ghost btn-sm text-bad" onClick={async () => { if (confirm('¿Desactivar este paquete?')) { await api(`/packages/${p.id}`, { method: 'DELETE' }); reload(); } }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>}
        </li>)}</ul>}
      <p className="text-xs text-ink-muted mt-4">Para venderlo, registra un cobro con el paquete y el cliente: queda activo en su cuenta al instante. <Link href="/ventas/nueva" className="underline">Registrar cobro</Link></p>
    </Card>}
    {tab === 'clientes' && <Card>
      <select className="input w-auto mb-3" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="ACTIVE">Activos</option><option value="USED">Agotados</option><option value="EXPIRED">Vencidos</option><option value="ALL">Todos</option>
      </select>
      {!rows ? <Loading /> : !rows.length ? <Empty icon={<CalendarCheck className="h-6 w-6" />} title="Sin clientes en este estado" description="Cuando vendas un paquete o membresía a un cliente aparecerá aquí." /> :
        <ul className="divide-y divide-line">{rows.map((cp) => <li key={cp.id} className="py-3 flex flex-wrap items-center gap-3">
          <button className="flex-1 min-w-[200px] text-left" onClick={() => open(cp)}>
            <span className="block font-medium">{cp.customerName}</span>
            <span className="block text-xs text-ink-muted">{cp.name} · vence {d(cp.endsAt)}</span>
          </button>
          {cp.sessionsTotal != null && <div className="w-32"><div className="flex justify-between text-xs"><span>{cp.sessionsUsed}/{cp.sessionsTotal}</span><span className="text-ink-muted">quedan {cp.remaining}</span></div>
            <div className="h-1.5 bg-sand-100 rounded-full mt-1"><div className="h-full bg-ink rounded-full" style={{ width: `${(cp.sessionsUsed / cp.sessionsTotal) * 100}%` }} /></div></div>}
          <Badge tone={STATUS[cp.status]?.tone}>{STATUS[cp.status]?.label ?? cp.status}</Badge>
          {cp.status === 'ACTIVE' && can('sales:create') && <button className="btn-primary btn-sm" disabled={busy === cp.id} onClick={() => use(cp)}>{busy === cp.id && <Spinner />}<CalendarCheck className="h-3.5 w-3.5" /> Registrar visita</button>}
        </li>)}</ul>}
    </Card>}
    {form && <PackageForm initial={form} onClose={() => setForm(null)} onSaved={reload} />}
    {detail && <Modal open onClose={() => setDetail(null)} title={detail.name}
      footer={detail.status === 'ACTIVE' && can('sales:create') ? <button className="btn-ghost text-bad" onClick={async () => { if (confirm('¿Cancelar el plan de este cliente?')) { await api(`/packages/customers/${detail.id}/cancel`, { body: {} }); setDetail(null); reloadRows(); } }}>Cancelar plan</button> : undefined}>
      <p className="text-sm">Del {d(detail.startsAt)} al {d(detail.endsAt)}{detail.sessionsTotal != null ? ` · ${detail.sessionsUsed} de ${detail.sessionsTotal} sesiones usadas` : ''}</p>
      <h4 className="font-medium text-sm mt-4 mb-2">Visitas</h4>
      {!detail.usages.length ? <p className="text-sm text-ink-muted">Aún no hay visitas registradas.</p> :
        <ul className="text-sm divide-y divide-line">{detail.usages.map((u: any) => <li key={u.id} className="py-2">{new Date(u.usedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}{u.note ? ` · ${u.note}` : ''}</li>)}</ul>}
    </Modal>}
  </>;
}
