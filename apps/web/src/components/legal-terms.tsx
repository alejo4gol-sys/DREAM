'use client';
import { AlertTriangle, BookOpen, CalendarClock, CheckCircle2, ChevronDown, Info, Plus, Scale, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/hooks';
import { CustomerSelect, PickedCustomer } from './services-ui';
import { Badge, Card, Disclaimer, ErrorBox, Field, Loading, Modal, Spinner, cn, useToast } from './ui';

export type Rule = {
  key: string; area: string; name: string; norm: string; phenomenon: string; term: { n: number; unit: string } | null; startLabel: string; nextDay: boolean; extendToBusinessDay: boolean; judicial?: boolean;
  offsetMonths?: { n: number; label: string }; suspension?: { label: string; help: string }; interruption?: { mode: string; label: string; help: string };
  penal?: boolean; summary: string; authority: string; prerequisites: string[]; notes: string[];
};
export type Catalog = { rules: Rule[]; areas: Record<string, string>; phenomena: Record<string, { label: string; help: string }>; guide: any; holidays: { date: string; name: string }[] };
export type TermResult = { status: string; dueDate: string | null; firstDay: string | null; steps: string[]; warnings: string[]; termLabel: string | null };

export const LEVEL: Record<string, { label: string; cls: string; tone: 'bad' | 'warn' | 'ok' | 'muted' }> = {
  EXPIRED: { label: 'Vencido', cls: 'bg-red-600 text-white', tone: 'bad' },
  RED: { label: '7 días o menos', cls: 'bg-red-100 text-red-800', tone: 'bad' },
  YELLOW: { label: '30 días o menos', cls: 'bg-amber-100 text-amber-900', tone: 'warn' },
  GREEN: { label: 'A tiempo', cls: 'bg-emerald-100 text-emerald-800', tone: 'ok' },
  NONE: { label: 'Sin término fijo', cls: 'bg-sand-100 text-ink-muted', tone: 'muted' },
  CLOSED: { label: 'Cerrado', cls: 'bg-sand-100 text-ink-muted', tone: 'muted' },
};
export const TERM_STATUS: Record<string, string> = { ACTIVE: 'Vigilando', FILED: 'Presentado a tiempo', LAPSED: 'Venció sin presentar', ARCHIVED: 'Archivado' };
const PHEN_TONE: Record<string, 'bad' | 'warn' | 'muted' | 'ok' | 'sand'> = { CADUCIDAD: 'bad', PRESCRIPCION: 'warn', INMEDIATEZ: 'sand', SIN_TERMINO: 'muted', MIENTRAS_SUBSISTA: 'muted', PROCEDIBILIDAD: 'ok' };

const longDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const shortDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export function DaysPill({ days, level }: { days: number | null; level: string }) {
  const l = LEVEL[level] ?? LEVEL.NONE;
  const txt = level === 'CLOSED' ? 'Cerrado' : days == null ? 'Sin término' : days < 0 ? `Venció hace ${-days} d` : days === 0 ? 'Vence HOY' : `${days} d`;
  return <span className={cn('inline-flex items-center justify-center rounded-full px-2.5 h-6 text-xs font-semibold whitespace-nowrap', l.cls)}>{txt}</span>;
}

export const useTermCatalog = () => useApi<Catalog>('/legal-terms/catalog');

type Draft = {
  id?: string; ruleKey: string; eventDate: string; suspensions: { from: string; to: string; label: string }[]; interruptionDate: string; vacation: boolean | null;
  offsetMonths: number | null; penal: { maxPenaltyYears: string; publicServant: boolean; special30: boolean; imprescriptible: boolean };
  title: string; jobId: string | null; customer: PickedCustomer; notes: string; syncJobDue: boolean; checklist: number[];
};
export const newDraft = (p: Partial<Draft> = {}): Draft => ({
  ruleKey: 'CA_NRD', eventDate: '', suspensions: [], interruptionDate: '', vacation: null, offsetMonths: null,
  penal: { maxPenaltyYears: '', publicServant: false, special30: false, imprescriptible: false }, title: '', jobId: null, customer: null, notes: '', syncJobDue: true, checklist: [], ...p,
});
export const draftFromTerm = (t: any): Draft => newDraft({
  id: t.id, ruleKey: t.ruleKey, eventDate: t.eventDate, suspensions: (t.input?.suspensions ?? []).map((s: any) => ({ label: '', ...s })), interruptionDate: t.input?.interruptionDate ?? '',
  vacation: t.input?.vacation ?? null, offsetMonths: t.input?.offsetMonths ?? null,
  penal: { maxPenaltyYears: t.input?.penal?.maxPenaltyYears ? String(t.input.penal.maxPenaltyYears) : '', publicServant: !!t.input?.penal?.publicServant, special30: !!t.input?.penal?.special30, imprescriptible: !!t.input?.penal?.imprescriptible },
  title: t.title, jobId: t.jobId, customer: t.customerId ? { id: t.customerId, name: t.customerName ?? 'Cliente' } : null, notes: t.notes ?? '', checklist: t.checklist ?? [],
});
const calcBody = (d: Draft, rule?: Rule) => ({
  ruleKey: d.ruleKey, eventDate: d.eventDate, suspensions: rule?.suspension ? d.suspensions.filter((s) => s.from && s.to).map((s) => ({ from: s.from, to: s.to, label: s.label || undefined })) : undefined,
  interruptionDate: rule?.interruption && d.interruptionDate ? d.interruptionDate : undefined, vacation: d.vacation ?? undefined,
  offsetMonths: rule?.offsetMonths && d.offsetMonths != null ? d.offsetMonths : undefined,
  penal: rule?.penal ? { maxPenaltyYears: d.penal.maxPenaltyYears ? Number(d.penal.maxPenaltyYears) : undefined, publicServant: d.penal.publicServant, special30: d.penal.special30, imprescriptible: d.penal.imprescriptible } : undefined,
});

/** Calculadora de un término + guardado para vigilarlo. */
export function TermCalculator({ catalog, initial, onSaved, lockJob }: { catalog: Catalog; initial?: Draft; onSaved?: (t: any) => void; lockJob?: { id: string; label: string } }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial ?? newDraft(lockJob ? { jobId: lockJob.id } : {}));
  const [area, setArea] = useState(() => catalog.rules.find((r) => r.key === (initial?.ruleKey ?? 'CA_NRD'))?.area ?? 'CONTENCIOSO');
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const rule = catalog.rules.find((r) => r.key === d.ruleKey);
  const { data: jobs } = useApi<any>(lockJob ? null : '/jobs?status=ALL');
  const body = useMemo(() => JSON.stringify(calcBody(d, rule)), [d, rule]);
  const debounced = useDebounced(body, 300);
  const [res, setRes] = useState<TermResult | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const b = JSON.parse(debounced);
    if (!b.eventDate) { setRes(null); return; }
    let alive = true;
    api<TermResult>('/legal-terms/calculate', { body: b }).then((r) => { if (alive) { setRes(r); setErr(''); } }).catch((e) => alive && setErr((e as Error).message));
    return () => { alive = false; };
  }, [debounced]);
  const save = async () => {
    if (d.title.trim().length < 2) { toast('Escribe un nombre para este término (ej.: demanda contra la resolución 123)', 'bad'); return; }
    if (!d.eventDate) { toast('Escribe la fecha desde la que corre el término', 'bad'); return; }
    setSaving(true);
    try {
      const t = await api<any>(d.id ? `/legal-terms/${d.id}` : '/legal-terms', { method: d.id ? 'PUT' : 'POST', body: {
        ...calcBody(d, rule), title: d.title.trim(), jobId: d.jobId, customerId: d.customer?.id ?? null, notes: d.notes || undefined, checklist: d.checklist, syncJobDue: !!d.jobId && d.syncJobDue,
      } });
      toast(d.id ? 'Término actualizado' : 'Término guardado: te avisaremos antes de que venza');
      onSaved?.(t);
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setSaving(false); }
  };
  const areaRules = catalog.rules.filter((r) => r.area === area);

  return <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
    <div className="space-y-4 min-w-0">
      <div>
        <p className="label">Área</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(catalog.areas).map(([k, v]) => <button key={k} type="button" onClick={() => { setArea(k); const first = catalog.rules.find((r) => r.area === k); if (first) set({ ruleKey: first.key }); }}
          className={cn('px-3 h-8 rounded-full text-xs border', area === k ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:bg-sand-50')}>{v}</button>)}</div>
      </div>
      <div>
        <p className="label">Acción, medio de control o trámite</p>
        <div className="grid sm:grid-cols-2 gap-2">{areaRules.map((r) => <button key={r.key} type="button" onClick={() => set({ ruleKey: r.key })}
          className={cn('text-left rounded-xl border p-3 transition', d.ruleKey === r.key ? 'border-ink ring-1 ring-ink bg-white' : 'border-line bg-white hover:bg-sand-50')}>
          <span className="flex items-start justify-between gap-2"><span className="text-sm font-medium leading-snug">{r.name}</span><Badge tone={PHEN_TONE[r.phenomenon] ?? 'muted'}>{catalog.phenomena[r.phenomenon]?.label}</Badge></span>
          <span className="block text-[11px] text-ink-muted mt-1">{r.term ? `${r.term.n} ${r.term.unit === 'YEARS' ? (r.term.n === 1 ? 'año' : 'años') : r.term.unit === 'MONTHS' ? 'meses' : 'días hábiles'}` : r.penal ? 'Según la pena' : 'Sin término fijo'} · {r.norm}</span>
        </button>)}</div>
      </div>
      {rule && <Card>
        <p className="text-sm">{rule.summary}</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <Field label={rule.startLabel} className="sm:col-span-2"><input className="input sm:max-w-xs" type="date" value={d.eventDate} max="2100-12-31" onChange={(e) => set({ eventDate: e.target.value })} /></Field>
          {rule.offsetMonths && <Field label="Meses previos de liquidación" hint={rule.offsetMonths.label}><input className="input" type="number" min={0} max={36} value={d.offsetMonths ?? rule.offsetMonths.n} onChange={(e) => set({ offsetMonths: Math.max(0, Math.min(36, Number(e.target.value) || 0)) })} /></Field>}
          {rule.penal && <>
            <Field label="Máximo de la pena de prisión (años)" hint="Del tipo penal, con sus agravantes"><input className="input" inputMode="decimal" value={d.penal.maxPenaltyYears} disabled={d.penal.special30 || d.penal.imprescriptible} onChange={(e) => set({ penal: { ...d.penal, maxPenaltyYears: e.target.value.replace(/[^\d.]/g, '') } })} /></Field>
            <div className="space-y-1.5 text-sm pt-5">
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.penal.publicServant} onChange={(e) => set({ penal: { ...d.penal, publicServant: e.target.checked } })} /> Servidor público en ejercicio de funciones (+1/3)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.penal.special30} onChange={(e) => set({ penal: { ...d.penal, special30: e.target.checked } })} /> Delito con término de 30 años</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.penal.imprescriptible} onChange={(e) => set({ penal: { ...d.penal, imprescriptible: e.target.checked } })} /> Imprescriptible</label>
            </div>
          </>}
          {rule.interruption && <Field label={rule.interruption.label} hint={rule.interruption.help} className="sm:col-span-2"><div className="flex gap-2 sm:max-w-sm"><input className="input" type="date" value={d.interruptionDate} onChange={(e) => set({ interruptionDate: e.target.value })} />{d.interruptionDate && <button type="button" className="btn-ghost !px-2" aria-label="Quitar" onClick={() => set({ interruptionDate: '' })}><X className="h-4 w-4" /></button>}</div></Field>}
        </div>
        {rule.suspension && <div className="mt-3">
          <p className="label">{rule.suspension.label} <span className="font-normal text-ink-muted">— suspende el término</span></p>
          <p className="text-[11px] text-ink-muted mb-2">{rule.suspension.help}</p>
          {d.suspensions.map((s, i) => <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
            <input className="input w-40" type="date" value={s.from} onChange={(e) => set({ suspensions: d.suspensions.map((x, k) => k === i ? { ...x, from: e.target.value } : x) })} aria-label="Desde" />
            <span className="text-xs text-ink-muted">hasta</span>
            <input className="input w-40" type="date" value={s.to} onChange={(e) => set({ suspensions: d.suspensions.map((x, k) => k === i ? { ...x, to: e.target.value } : x) })} aria-label="Hasta" />
            <button type="button" className="btn-ghost !px-2" aria-label="Quitar" onClick={() => set({ suspensions: d.suspensions.filter((_, k) => k !== i) })}><X className="h-4 w-4" /></button>
          </div>)}
          <button type="button" className="btn-secondary text-xs" onClick={() => set({ suspensions: [...d.suspensions, { from: '', to: '', label: 'Conciliación' }] })}><Plus className="h-3.5 w-3.5" /> Agregar suspensión</button>
        </div>}
        {(rule.extendToBusinessDay || rule.term?.unit === 'BUSINESS_DAYS') && <label className="flex items-start gap-2 text-xs mt-4"><input type="checkbox" className="mt-0.5" checked={d.vacation ?? (rule.judicial ?? !['CUMPLIMIENTO_RENUENCIA', 'PENAL_QUERELLA'].includes(rule.key))} onChange={(e) => set({ vacation: e.target.checked })} />
          <span>Tratar la vacancia judicial (20 dic–10 ene y Semana Santa) como días inhábiles <span className="block text-ink-muted">Desactívalo si el término no es ante jueces.</span></span></label>}
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium flex items-center gap-1"><Info className="h-4 w-4" /> Autoridad competente y requisitos</summary>
          <div className="mt-2 space-y-2 text-xs text-ink-muted">
            <p><b className="text-ink">Autoridad:</b> {rule.authority}</p>
            {rule.prerequisites.length > 0 && <div><b className="text-ink">Requisitos previos:</b><ul className="list-disc pl-5 mt-1 space-y-0.5">{rule.prerequisites.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {rule.notes.length > 0 && <ul className="list-disc pl-5 space-y-0.5">{rule.notes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <p>Norma: {rule.norm}</p>
          </div>
        </details>
      </Card>}
    </div>

    <div className="space-y-3 lg:sticky lg:top-4">
      <Card>
        <p className="text-xs uppercase tracking-wide text-ink-muted">Último día para actuar</p>
        {!d.eventDate ? <p className="text-sm text-ink-muted mt-2">Escribe la fecha de inicio para calcular.</p>
          : err ? <ErrorBox message={err} />
          : !res ? <div className="py-3"><Spinner /></div>
          : res.status === 'DATE' ? <><p className="text-2xl font-semibold mt-1 first-letter:uppercase">{longDate(res.dueDate!)}</p><p className="text-xs text-ink-muted">{res.termLabel} · {rule && catalog.phenomena[rule.phenomenon]?.label}</p></>
          : <p className="text-lg font-semibold mt-1">{res.status === 'IMPRESCRIPTIBLE' ? 'Imprescriptible' : rule ? catalog.phenomena[rule.phenomenon]?.label : ''}</p>}
        {res && <ol className="mt-3 space-y-1.5 text-xs text-ink-muted list-decimal pl-4">{res.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
        {res && res.warnings.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-1">{res.warnings.map((w, i) => <p key={i} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}</p>)}</div>}
      </Card>
      <Card>
        <p className="text-sm font-medium mb-2">Guardar y vigilar</p>
        <div className="space-y-3">
          <Field label="Nombre del término"><input className="input" value={d.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder="Ej.: Demanda contra la Resolución 123" /></Field>
          {lockJob ? <p className="text-xs text-ink-muted">Caso: <b className="text-ink">{lockJob.label}</b></p>
            : <Field label="Caso (opcional)"><select className="input" value={d.jobId ?? ''} onChange={(e) => set({ jobId: e.target.value || null })}><option value="">Sin caso</option>{(jobs?.items ?? []).map((j: any) => <option key={j.id} value={j.id}>#{j.number} · {j.title}</option>)}</select></Field>}
          {!d.jobId && <CustomerSelect value={d.customer} onChange={(c) => set({ customer: c })} label="Cliente (opcional)" />}
          {d.jobId && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={d.syncJobDue} onChange={(e) => set({ syncJobDue: e.target.checked })} /> Poner esta fecha como vencimiento del caso</label>}
          <Field label="Notas (opcional)"><textarea className="input min-h-[56px]" value={d.notes} maxLength={4000} onChange={(e) => set({ notes: e.target.value })} placeholder="Ej.: pendiente constancia de no conciliación" /></Field>
          <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? <Spinner /> : <CalendarClock className="h-4 w-4" />} {d.id ? 'Guardar cambios' : 'Guardar y avisarme'}</button>
          <p className="text-[11px] text-ink-muted">Te avisamos en las notificaciones a los 30, 15, 7, 3 y 1 día, y el día del vencimiento.</p>
        </div>
      </Card>
    </div>
  </div>;
}

/** Lista con semáforo. */
export function TermsList({ rows, onOpen, compact }: { rows: any[]; onOpen?: (t: any) => void; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-ink-muted py-4 text-center">No hay términos en esta vista.</p>;
  return <ul className="divide-y divide-line">{rows.map((t) => <li key={t.id}>
    <button type="button" className="w-full text-left py-3 flex items-center gap-3 hover:bg-sand-50 -mx-2 px-2 rounded-lg" onClick={() => onOpen?.(t)}>
      <span className={cn('w-1.5 self-stretch rounded-full', t.level === 'EXPIRED' || t.level === 'RED' ? 'bg-red-500' : t.level === 'YELLOW' ? 'bg-amber-400' : t.level === 'GREEN' ? 'bg-emerald-500' : 'bg-sand-300')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{t.title}</p>
        <p className="text-xs text-ink-muted truncate">{t.ruleName}{t.jobNumber ? ` · Caso #${t.jobNumber}` : ''}{t.customerName ? ` · ${t.customerName}` : ''}</p>
      </div>
      {!compact && t.status !== 'ACTIVE' && <Badge tone="muted">{TERM_STATUS[t.status]}</Badge>}
      <div className="text-right shrink-0"><DaysPill days={t.daysLeft} level={t.level} />{t.dueDate && <p className="text-[11px] text-ink-muted mt-0.5">{shortDate(t.dueDate)}</p>}</div>
    </button>
  </li>)}</ul>;
}

/** Ventana para ver un término guardado: marcar presentado, lista de verificación, editar. */
export function TermModal({ term, catalog, onClose, onChanged }: { term: any; catalog: Catalog; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [checklist, setChecklist] = useState<number[]>(term.checklist ?? []);
  const rule = catalog.rules.find((r) => r.key === term.ruleKey);
  const status = async (s: string, note?: string) => {
    setBusy(s);
    try { await api(`/legal-terms/${term.id}/status`, { method: 'PATCH', body: { status: s, note } }); toast(TERM_STATUS[s]); onChanged(); onClose(); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const saveChecklist = async (next: number[]) => {
    setChecklist(next);
    try { const d = draftFromTerm(term); await api(`/legal-terms/${term.id}`, { method: 'PUT', body: { ...calcBody(d, rule), title: d.title, jobId: d.jobId, customerId: d.customer?.id ?? null, notes: d.notes || undefined, checklist: next } }); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  const del = async () => {
    if (!confirm('¿Eliminar este término? Dejarás de recibir avisos.')) return;
    try { await api(`/legal-terms/${term.id}`, { method: 'DELETE' }); onChanged(); onClose(); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  return <Modal open onClose={onClose} title={term.title} wide footer={!editing && <div className="flex flex-wrap gap-2 w-full justify-between">
    <button className="btn-ghost text-bad" onClick={del}>Eliminar</button>
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" onClick={() => setEditing(true)}>Editar fechas</button>
      {term.status === 'ACTIVE' ? <>
        <button className="btn-secondary" disabled={!!busy} onClick={() => status('ARCHIVED')}>Archivar</button>
        <button className="btn-primary" disabled={!!busy} onClick={() => status('FILED', prompt('Nota (opcional): ej. radicado No. …') ?? undefined)}>{busy === 'FILED' ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />} Marcar presentado</button>
      </> : <button className="btn-secondary" disabled={!!busy} onClick={() => status('ACTIVE')}>Volver a vigilar</button>}
    </div>
  </div>}>
    {editing ? <TermCalculator catalog={catalog} initial={draftFromTerm(term)} lockJob={term.jobId ? { id: term.jobId, label: `#${term.jobNumber ?? ''} ${term.jobTitle ?? ''}` } : undefined} onSaved={() => { onChanged(); onClose(); }} /> : <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DaysPill days={term.daysLeft} level={term.level} />
        {term.dueDate && <p className="text-lg font-semibold first-letter:uppercase">{longDate(term.dueDate)}</p>}
        <Badge tone="muted">{TERM_STATUS[term.status]}</Badge>
      </div>
      <p className="text-sm">{term.ruleName} · <span className="text-ink-muted">{rule?.norm}</span></p>
      {term.jobId && <Link href={`/trabajos/${term.jobId}`} className="text-sm underline">Ver caso #{term.jobNumber} {term.jobTitle}</Link>}
      <div className="rounded-xl bg-sand-50 p-3"><p className="text-xs font-medium mb-1">Cómo se calculó</p><ol className="list-decimal pl-4 text-xs text-ink-muted space-y-1">{(term.result?.steps ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>
      {term.notes && <p className="text-sm whitespace-pre-line"><b>Notas:</b> {term.notes}</p>}
      <div>
        <p className="text-sm font-medium mb-2">Lista de verificación antes de presentar</p>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">{(catalog.guide.checklist as string[]).map((c, i) => <label key={i} className="flex items-start gap-2 text-xs">
          <input type="checkbox" className="mt-0.5" checked={checklist.includes(i)} onChange={(e) => saveChecklist(e.target.checked ? [...checklist, i] : checklist.filter((x) => x !== i))} />{c}</label>)}</div>
        <p className="text-[11px] text-ink-muted mt-2">{checklist.length} de {catalog.guide.checklist.length} verificados.</p>
      </div>
    </div>}
  </Modal>;
}

/** Guía de consulta: fenómenos, términos por área, conciliación y lista de verificación. */
export function TermsGuide({ catalog }: { catalog: Catalog }) {
  const g = catalog.guide;
  const [open, setOpen] = useState<string | null>(null);
  return <div className="space-y-5">
    <Card>
      <h2 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> {g.title}</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">{g.fundamentals.map((f: any) => <div key={f.name} className="rounded-xl border border-line p-3"><p className="text-sm font-semibold">{f.name}</p><p className="text-xs text-ink-muted mt-1">{f.text}</p></div>)}</div>
      <p className="mt-3 text-xs rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900"><b>Advertencia:</b> {g.warning}</p>
    </Card>
    {Object.entries(catalog.areas).map(([k, label]) => <Card key={k}>
      <h3 className="font-semibold flex items-center gap-2"><Scale className="h-4 w-4" /> {label}</h3>
      <div className="divide-y divide-line mt-2">{catalog.rules.filter((r) => r.area === k).map((r) => <div key={r.key}>
        <button type="button" className="w-full text-left py-2.5 flex items-center gap-3" onClick={() => setOpen(open === r.key ? null : r.key)}>
          <span className="flex-1 text-sm">{r.name}</span>
          <span className="text-xs text-ink-muted hidden sm:inline">{r.term ? `${r.term.n} ${r.term.unit === 'YEARS' ? (r.term.n === 1 ? 'año' : 'años') : r.term.unit === 'MONTHS' ? 'meses' : 'días hábiles'}` : r.penal ? 'Según la pena' : '—'}</span>
          <Badge tone={PHEN_TONE[r.phenomenon] ?? 'muted'}>{catalog.phenomena[r.phenomenon]?.label}</Badge>
          <ChevronDown className={cn('h-4 w-4 transition', open === r.key && 'rotate-180')} />
        </button>
        {open === r.key && <div className="pb-3 text-xs text-ink-muted space-y-1.5">
          <p className="text-ink text-sm">{r.summary}</p><p><b className="text-ink">Desde:</b> {r.startLabel}{r.nextDay ? ' (corre desde el día siguiente)' : ''}.</p>
          <p><b className="text-ink">Autoridad:</b> {r.authority}</p>
          {r.prerequisites.length > 0 && <ul className="list-disc pl-5">{r.prerequisites.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {r.notes.length > 0 && <ul className="list-disc pl-5">{r.notes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          <p>Norma: {r.norm}</p>
        </div>}
      </div>)}</div>
      {k === 'CONTENCIOSO' && <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-sand-50 p-3"><p className="font-semibold text-sm mb-1">Regla práctica para escoger el medio de control</p><ul className="list-disc pl-4 space-y-1">{g.practicalRule.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
        <div className="rounded-xl bg-sand-50 p-3"><p className="font-semibold text-sm mb-1">Conciliación prejudicial</p><p>{g.conciliationCA}</p></div>
      </div>}
      {k === 'CIVIL' && <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-sand-50 p-3"><p className="font-semibold text-sm mb-1">Competencia por cuantía</p><p>{g.cuantias}</p></div><div className="rounded-xl bg-sand-50 p-3"><p className="font-semibold text-sm mb-1">Conciliación extrajudicial civil</p><p>{g.conciliationCivil}</p></div></div>}
      {k === 'COMERCIAL' && <div className="mt-3 rounded-xl bg-sand-50 p-3 text-xs"><p className="font-semibold text-sm mb-1">Autoridades</p><ul className="list-disc pl-4">{g.commercialAuthorities.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
      {k === 'LABORAL' && <div className="mt-3 rounded-xl bg-sand-50 p-3 text-xs"><p className="font-semibold text-sm mb-1">Autoridades</p><ul className="list-disc pl-4">{g.laborAuthorities.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
    </Card>)}
    <Card>
      <h3 className="font-semibold">Lista de verificación antes de iniciar una acción</h3>
      <ol className="list-decimal pl-5 mt-2 text-sm space-y-1">{g.checklist.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol>
      <p className="text-sm mt-4"><b>Conclusión.</b> {g.conclusion}</p>
    </Card>
    <Disclaimer>{g.credit} Es una guía general de apoyo: el cómputo concreto del vencimiento debe revisarse con el expediente, la fecha de notificación, las suspensiones, las interrupciones y la norma vigente. DREAMS calcula con el calendario de festivos de Colombia y las reglas del art. 59 y 62 de la Ley 4 de 1913.</Disclaimer>
  </div>;
}

/** Términos de un caso (ficha del caso). */
export function JobTerms({ jobId, jobLabel }: { jobId: string; jobLabel: string }) {
  const { data: catalog } = useTermCatalog();
  const { data: rows, reload } = useApi<any[]>(`/legal-terms?status=ALL&jobId=${jobId}`);
  const [open, setOpen] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  return <Card title={<span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Términos de este caso</span>}
    actions={<button className="btn-ghost btn-sm no-print" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Agregar término</button>}>
    {!rows ? <Loading /> : !rows.length ? <p className="text-sm text-ink-muted">Sin términos vigilados. Agrega la caducidad o prescripción de este caso para recibir avisos.</p> : <TermsList rows={rows} onOpen={setOpen} compact />}
    {open && catalog && <TermModal term={open} catalog={catalog} onClose={() => setOpen(null)} onChanged={reload} />}
    {adding && catalog && <Modal open onClose={() => setAdding(false)} title="Agregar término al caso" wide>
      <TermCalculator catalog={catalog} initial={newDraft({ jobId, title: jobLabel })} lockJob={{ id: jobId, label: jobLabel }} onSaved={() => { setAdding(false); reload(); }} />
    </Modal>}
  </Card>;
}

/** Tarjeta del inicio para abogados. */
export function TermsDashboardCard() {
  const { data } = useApi<any>('/legal-terms/summary');
  if (!data) return null;
  return <Card title={<span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Términos por vencer</span>} actions={<Link href="/terminos" className="text-xs text-ink-muted hover:text-ink">Ver todos</Link>}>
    <div className="flex flex-wrap gap-2 mb-2 text-xs">
      {data.expired > 0 && <span className="rounded-full bg-red-600 text-white px-2.5 h-6 inline-flex items-center">{data.expired} vencidos</span>}
      <span className="rounded-full bg-red-100 text-red-800 px-2.5 h-6 inline-flex items-center">{data.red} en 7 días</span>
      <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 h-6 inline-flex items-center">{data.yellow} en 30 días</span>
      <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 h-6 inline-flex items-center">{data.green} a tiempo</span>
    </div>
    {data.upcoming.length ? <TermsList rows={data.upcoming.slice(0, 5)} onOpen={() => { window.location.href = '/terminos'; }} compact /> : <p className="text-sm text-ink-muted">No tienes términos vigilados. <Link className="underline" href="/terminos?calcular=1">Calcula el primero</Link>.</p>}
  </Card>;
}
