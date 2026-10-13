'use client';
import { AlertTriangle, BadgeCheck, Briefcase, Clock, Copy, ExternalLink, Inbox, MapPin, MessageCircle, Phone, Send, ShieldCheck, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MoneyInput } from '@/components/fee-calculator';
import { waLink } from '@/components/services-ui';
import { TOPIC_ICONS } from '@/components/tu-derecho';
import { Badge, Card, Disclaimer, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, Tabs, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { HELP_BRAND } from '@/lib/help-brand';

const PROPOSAL_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'muted' | 'bad' }> = {
  SENT: { label: 'Enviada — esperando respuesta', tone: 'warn' }, CHOSEN: { label: '¡Te eligieron!', tone: 'ok' }, NOT_CHOSEN: { label: 'Eligieron a otro abogado', tone: 'muted' }, WITHDRAWN: { label: 'Retirada', tone: 'muted' },
};
const remaining = (d: string) => {
  const h = Math.round((new Date(d).getTime() - Date.now()) / 3600000);
  return h <= 0 ? 'Plazo vencido' : h < 24 ? `Quedan ${h} h` : `Quedan ${Math.round(h / 24)} días`;
};

export default function SolicitudesPage() {
  const { can } = useAuth();
  const { data, error, reload, setData } = useApi<any>('/help/inbox');
  const { data: cat } = useApi<any>('/help/catalog');
  const { data: adm } = useApi<{ admin: boolean }>('/help/admin/me');
  const [tab, setTab] = useState<'new' | 'mine' | 'profile' | 'admin'>('new');
  const [proposing, setProposing] = useState<any>(null);
  useEffect(() => { if (data && !data.profile) setTab('profile'); }, [data?.profile]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || !cat) return <Loading />;
  const p = data.profile;
  const verified = p?.verification === 'VERIFIED';
  const tabs: { value: typeof tab; label: string }[] = [
    { value: 'new', label: `Nuevas solicitudes (${data.open.length})` }, { value: 'mine', label: `Mis propuestas (${data.mine.length})` }, { value: 'profile', label: 'Mi perfil público' },
    ...(adm?.admin ? [{ value: 'admin' as const, label: 'Verificar abogados' }] : []),
  ];
  return <>
    <PageHeader title={`Clientes de ${HELP_BRAND.name}`} subtitle={`Personas que buscan abogado en la micro app gratuita ${HELP_BRAND.name}. Envía tu propuesta y, si te eligen, crea el caso con un toque.`} />
    {p && !verified && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      {p.verification === 'REJECTED' ? <span>No pudimos verificar tu tarjeta profesional{p.verificationNote ? `: ${p.verificationNote}` : '.'} Revisa los datos en «Mi perfil público».</span> : <span>Tu perfil está en verificación. Cuando confirmemos tu tarjeta profesional empezarás a recibir solicitudes.</span>}</div>}
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={tabs} /></div>

    {tab === 'new' && (!verified ? <Card><Empty icon={<ShieldCheck className="h-6 w-6" />} title="Completa y verifica tu perfil" description="Solo los abogados verificados reciben solicitudes." action={<button className="btn-primary" onClick={() => setTab('profile')}>Ir a mi perfil</button>} /></Card>
      : !data.open.length ? <Card><Empty icon={<Inbox className="h-6 w-6" />} title="No hay solicitudes nuevas para tus áreas y zonas" description="Te avisaremos en las notificaciones cuando llegue una." /></Card>
        : <div className="grid lg:grid-cols-2 gap-4">{data.open.map((r: any) => <RequestCard key={r.id} r={r} action={can('sales:create') && <button className="btn-primary" onClick={() => setProposing(r)}><Send className="h-4 w-4" /> Enviar propuesta</button>} />)}</div>)}

    {tab === 'mine' && (!data.mine.length ? <Card><Empty icon={<Send className="h-6 w-6" />} title="Aún no has enviado propuestas" /></Card>
      : <div className="grid lg:grid-cols-2 gap-4">{data.mine.map((r: any) => <MineCard key={r.id} r={r} onChanged={setData} />)}</div>)}

    {tab === 'profile' && <ProfileForm profile={p} cat={cat} onSaved={(np) => { setData({ ...data, profile: np }); reload(); }} />}
    {tab === 'admin' && adm?.admin && <AdminVerify />}

    {proposing && <ProposalModal r={proposing} onClose={() => setProposing(null)} onSent={(d) => { setData(d); setProposing(null); setTab('mine'); }} />}
  </>;
}

function RequestCard({ r, action, children }: { r: any; action?: React.ReactNode; children?: React.ReactNode }) {
  const Icon = TOPIC_ICONS[r.topic] ?? Briefcase;
  return <Card>
    <div className="flex items-start gap-3">
      <span className="h-10 w-10 rounded-xl bg-sand-100 flex items-center justify-center shrink-0"><Icon className="h-5 w-5" /></span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold flex flex-wrap items-center gap-2">{r.topicLabel} {r.urgent && <Badge tone="bad">Urgente</Badge>}</p>
        <p className="text-xs text-ink-muted flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.city ? `${r.city}, ` : ''}{r.department} · {date(r.createdAt, true)}</p>
      </div>
      {r.status === 'OPEN' && <span className="text-xs text-warn font-medium flex items-center gap-1 whitespace-nowrap"><Clock className="h-3.5 w-3.5" /> {remaining(r.deadlineAt)}</span>}
    </div>
    <p className="text-sm mt-3 whitespace-pre-line">{r.description}</p>
    {r.orientation?.routes?.length > 0 && <details className="mt-3 text-xs text-ink-muted"><summary className="cursor-pointer">Orientación que recibió la persona</summary>
      <ul className="list-disc pl-5 mt-1 space-y-0.5">{r.orientation.routes.map((x: any, i: number) => <li key={i}>{x.title}{x.deadline ? ` — plazo estimado ${x.deadline.dueDate}` : ''}</li>)}</ul></details>}
    {typeof r.proposals === 'number' && <p className="text-[11px] text-ink-muted mt-2">{r.proposals} de 5 propuestas recibidas</p>}
    {children}
    {action && <div className="mt-4 flex justify-end">{action}</div>}
  </Card>;
}

function MineCard({ r, onChanged }: { r: any; onChanged: (d: any) => void }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const st = PROPOSAL_STATUS[r.proposal.status] ?? PROPOSAL_STATUS.SENT;
  const toCase = async () => {
    setBusy('case');
    try { const x = await api<{ jobId: string }>(`/help/inbox/${r.id}/case`, { body: {} }); toast('Caso creado'); router.push(`/trabajos/${x.jobId}`); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const withdraw = async () => {
    if (!confirm('¿Retirar tu propuesta?')) return;
    try { onChanged(await api(`/help/inbox/${r.id}/withdraw`, { body: {} })); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  return <RequestCard r={r}>
    <div className="mt-3 rounded-xl bg-sand-50 p-3 text-sm space-y-1">
      <div className="flex items-center justify-between gap-2"><Badge tone={st.tone}>{st.label}</Badge><b>{money(r.proposal.feeAmount)}</b></div>
      <p className="text-xs text-ink-muted">{r.proposal.feeTerms} · {r.proposal.estimatedTime}</p>
    </div>
    {r.contact && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="font-semibold flex items-center gap-1.5"><UserCheck className="h-4 w-4" /> {r.contact.name}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <a className="btn-secondary !h-9 text-xs" href={waLink(r.contact.phone, `Hola ${r.contact.name.split(' ')[0]}, te escribo de parte de tu consulta ${r.code} en ${HELP_BRAND.name}. Gracias por elegir mi propuesta.`)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
        <a className="btn-secondary !h-9 text-xs" href={`tel:${r.contact.phone}`}><Phone className="h-3.5 w-3.5" /> {r.contact.phone}</a>
        {r.contact.email && <a className="btn-secondary !h-9 text-xs" href={`mailto:${r.contact.email}`}>{r.contact.email}</a>}
      </div>
      {r.proposal.jobId ? <Link className="btn-primary w-full mt-3" href={`/trabajos/${r.proposal.jobId}`}>Ver el caso</Link>
        : <button className="btn-primary w-full mt-3" disabled={busy === 'case'} onClick={toCase}>{busy === 'case' ? <Spinner /> : <Briefcase className="h-4 w-4" />} Crear el caso y el cliente</button>}
    </div>}
    {r.proposal.status === 'SENT' && <div className="mt-3 flex justify-end"><button className="btn-ghost text-xs" onClick={withdraw}>Retirar propuesta</button></div>}
  </RequestCard>;
}

function ProposalModal({ r, onClose, onSent }: { r: any; onClose: () => void; onSent: (d: any) => void }) {
  const [f, setF] = useState({ feeAmount: '', feeTerms: '50 % al firmar el contrato y 50 % al terminar', plan: '', estimatedTime: '', experience: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const send = async () => {
    setBusy(true); setErr('');
    try { onSent(await api(`/help/inbox/${r.id}/proposals`, { body: { ...f, experience: f.experience || undefined } })); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title={`Propuesta para: ${r.topicLabel}`} wide
    footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !f.feeAmount || f.plan.length < 20 || !f.estimatedTime} onClick={send}>{busy ? <Spinner /> : <Send className="h-4 w-4" />} Enviar propuesta</button></>}>
    <div className="space-y-3">
      {err && <ErrorBox message={err} />}
      <p className="text-sm rounded-xl bg-sand-50 p-3 whitespace-pre-line">{r.description}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Honorarios (COP)" hint={<Link href="/honorarios" target="_blank" className="underline inline-flex items-center gap-1">Calcular con la tabla de tarifas <ExternalLink className="h-3 w-3" /></Link>}><MoneyInput value={f.feeAmount} onChange={(v) => set({ feeAmount: v })} /></Field>
        <Field label="Tiempo estimado"><input className="input" value={f.estimatedTime} maxLength={120} onChange={(e) => set({ estimatedTime: e.target.value })} placeholder="Ej.: 2 a 4 meses" /></Field>
        <Field label="Forma de pago" className="sm:col-span-2"><input className="input" value={f.feeTerms} maxLength={1000} onChange={(e) => set({ feeTerms: e.target.value })} /></Field>
        <Field label="Qué harías (en palabras sencillas)" className="sm:col-span-2"><textarea className="input min-h-[90px]" value={f.plan} maxLength={3000} onChange={(e) => set({ plan: e.target.value })} placeholder="Ej.: Revisar sus pruebas, presentar la reclamación al empleador, citar a conciliación ante el inspector y, si no hay acuerdo, demandar." /></Field>
        <Field label="Tu experiencia en casos parecidos (opcional)" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={f.experience} maxLength={1500} onChange={(e) => set({ experience: e.target.value })} /></Field>
      </div>
      <Disclaimer>La propuesta no puede prometer ni garantizar resultados (Ley 1123 de 2007). La persona verá tu nombre, tu experiencia y esta propuesta; sus datos de contacto solo se te mostrarán si te elige. Enviar propuestas está incluido en tu plan: DREAMS no cobra comisión por caso.</Disclaimer>
    </div>
  </Modal>;
}

function ProfileForm({ profile, cat, onSaved }: { profile: any; cat: any; onSaved: (p: any) => void }) {
  const toast = useToast();
  const { current, can } = useAuth();
  const [f, setF] = useState(() => ({
    displayName: profile?.displayName ?? '', professionalCard: profile?.professionalCard ?? '', topics: profile?.topics ?? [] as string[], departments: profile?.departments ?? [] as string[],
    remote: profile?.remote ?? false, yearsExperience: profile?.yearsExperience ?? 0, bio: profile?.bio ?? '', accepting: profile?.accepting ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const toggle = (k: 'topics' | 'departments', v: string) => set({ [k]: f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v] } as any);
  const save = async () => {
    setBusy(true);
    try { onSaved(await api('/help/profile', { method: 'PUT', body: { ...f, bio: f.bio || undefined } })); toast('Perfil guardado'); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  const link = typeof window !== 'undefined' ? `${window.location.origin}/ayuda` : '/ayuda';
  return <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
    <Card>
      <fieldset disabled={!can('business:manage')} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nombre como te verán las personas"><input className="input" value={f.displayName} maxLength={160} onChange={(e) => set({ displayName: e.target.value })} placeholder={`Ej.: Dra. ${current?.tradeName ?? ''}`} /></Field>
          <Field label="Número de tarjeta profesional" hint="Lo verificamos en el Registro Nacional de Abogados (SIRNA) de la Rama Judicial."><input className="input" value={f.professionalCard} maxLength={30} onChange={(e) => set({ professionalCard: e.target.value })} /></Field>
          <Field label="Años de experiencia"><input className="input" type="number" min={0} max={70} value={f.yearsExperience} onChange={(e) => set({ yearsExperience: Math.max(0, Math.min(70, Number(e.target.value) || 0)) })} /></Field>
          <label className="flex items-center gap-2 text-sm pt-6"><input type="checkbox" checked={f.accepting} onChange={(e) => set({ accepting: e.target.checked })} /> Estoy recibiendo casos nuevos</label>
        </div>
        <Field label="Presentación breve"><textarea className="input min-h-[80px]" maxLength={1500} value={f.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Ej.: Abogada litigante con 10 años en derecho laboral y de familia. Atiendo en Cali y de forma virtual." /></Field>
        <div><p className="label">Temas que atiendes</p><div className="flex flex-wrap gap-2">{cat.topics.map((t: any) => <button key={t.key} type="button" onClick={() => toggle('topics', t.key)}
          className={cn('px-3 h-9 rounded-full text-sm border', f.topics.includes(t.key) ? 'bg-ink text-white border-ink' : 'bg-white border-line')}>{t.label}</button>)}</div></div>
        <div><p className="label">Dónde atiendes</p>
          <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={f.remote} onChange={(e) => set({ remote: e.target.checked })} /> Atiendo de forma virtual en todo el país</label>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">{cat.departments.map((d: string) => <button key={d} type="button" onClick={() => toggle('departments', d)}
            className={cn('px-2.5 h-8 rounded-full text-xs border', f.departments.includes(d) ? 'bg-ink text-white border-ink' : 'bg-white border-line')}>{d}</button>)}</div></div>
        <button className="btn-primary" disabled={busy || f.displayName.length < 3 || f.professionalCard.length < 3 || !f.topics.length || (!f.remote && !f.departments.length)} onClick={save}>{busy && <Spinner />} Guardar perfil</button>
      </fieldset>
    </Card>
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-medium">Estado</p>
        <div className="mt-2">{!profile ? <Badge tone="muted">Sin perfil</Badge> : profile.verification === 'VERIFIED' ? <Badge tone="ok"><BadgeCheck className="h-3.5 w-3.5 inline mr-1" />Verificado</Badge> : profile.verification === 'REJECTED' ? <Badge tone="bad">No verificado</Badge> : <Badge tone="warn">En verificación</Badge>}</div>
        <p className="text-xs text-ink-muted mt-2">Si cambias la tarjeta profesional, el perfil vuelve a verificación.</p>
      </Card>
      <Card>
        <p className="text-sm font-medium">Comparte {HELP_BRAND.name}</p>
        <p className="text-xs text-ink-muted mt-1">Pon este enlace en tus redes o imprime un código QR para tu oficina: las personas reciben orientación gratis y pueden pedir tu propuesta.</p>
        <div className="flex gap-2 mt-2"><input className="input text-xs" readOnly value={link} /><button className="btn-secondary !px-2" aria-label="Copiar" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Enlace copiado'))}><Copy className="h-4 w-4" /></button></div>
        <a className="btn-secondary w-full mt-2" href="/ayuda" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir {HELP_BRAND.name}</a>
      </Card>
    </div>
  </div>;
}

function AdminVerify() {
  const toast = useToast();
  const { data, reload, setData } = useApi<any[]>('/help/admin/lawyers');
  const act = async (id: string, verification: string) => {
    const note = verification === 'REJECTED' ? prompt('Motivo (lo verá el abogado):') ?? '' : '';
    try { setData(await api(`/help/admin/lawyers/${id}`, { method: 'PUT', body: { verification, note: note || undefined } })); toast('Actualizado'); } catch (e) { toast((e as Error).message, 'bad'); reload(); }
  };
  if (!data) return <Loading />;
  return <Card padded={false}>
    <div className="p-4 text-sm text-ink-muted border-b border-line">Verifica cada tarjeta profesional en el Registro Nacional de Abogados (SIRNA) de la Rama Judicial y que no tenga sanciones vigentes antes de aprobar.</div>
    <ul className="divide-y divide-line">{data.map((x) => <li key={x.p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0"><p className="font-medium">{x.p.displayName} <span className="text-ink-muted font-normal">· {x.tradeName}</span></p>
        <p className="text-xs text-ink-muted">Tarjeta profesional {x.p.professionalCard} · {x.email ?? ''} {x.phone ?? ''} · registrado el {date(x.p.createdAt)}</p></div>
      <Badge tone={x.p.verification === 'VERIFIED' ? 'ok' : x.p.verification === 'REJECTED' ? 'bad' : 'warn'}>{x.p.verification === 'VERIFIED' ? 'Verificado' : x.p.verification === 'REJECTED' ? 'Rechazado' : 'Pendiente'}</Badge>
      <div className="flex gap-2"><button className="btn-secondary !h-9 text-xs" onClick={() => act(x.p.id, 'VERIFIED')}>Verificar</button><button className="btn-ghost !h-9 text-xs text-bad" onClick={() => act(x.p.id, 'REJECTED')}>Rechazar</button></div>
    </li>)}</ul>
  </Card>;
}
