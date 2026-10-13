'use client';
import {
  AlertTriangle, Briefcase, Calculator, ChevronDown, ExternalLink, FileText, Info, MessageCircle, Plus, Printer, Save, Search, Trash2, X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ADJUST_PRESETS, Catalog, EXPENSE_HINTS, FeeItem, FeeSettings, FeeTable, LineInput, QuoteResult, formulaShort, needsBase } from '@/lib/fees';
import { date, money } from '@/lib/format';
import { useApi, useDebounced } from '@/lib/hooks';
import { CustomerSelect, PickedCustomer, waLink } from './services-ui';
import { Badge, Card, Disclaimer, Empty, ErrorBox, Field, Loading, Spinner, cn, useToast } from './ui';

const uid = () => Math.random().toString(36).slice(2, 10);
const digits = (v: string) => v.replace(/\D/g, '').slice(0, 13);
const fmt = (v?: string) => (v ? Number(v).toLocaleString('es-CO') : '');

export function MoneyInput({ value, onChange, placeholder, className }: { value?: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <div className={cn('relative', className)}>
    <span className="absolute left-3 top-2.5 text-sm text-ink-faint">$</span>
    <input className="input pl-7" inputMode="numeric" value={fmt(value)} placeholder={placeholder ?? '0'} onChange={(e) => onChange(digits(e.target.value))} />
  </div>;
}

type Draft = {
  id?: string; title: string; customer: PickedCustomer; description: string; area?: string; tableKey: string;
  lines: LineInput[]; expenses: { uid: string; label: string; amount: string }[];
  level: string; city: string; adjustPct: number; discountPct: number; iva: boolean; advancePct: number; installments: number; successPct: number; successBase: string;
};
const emptyDraft = (s: FeeSettings): Draft => ({
  title: '', customer: null, description: '', tableKey: s.tableKey, lines: [], expenses: [], level: s.level, city: s.city,
  adjustPct: 0, discountPct: 0, iva: s.ivaResponsable, advancePct: s.advancePct, installments: s.installments, successPct: 0, successBase: '',
});
const payload = (d: Draft) => ({
  tableKey: d.tableKey, level: d.level, city: d.city, adjustPct: d.adjustPct, discountPct: d.discountPct, iva: d.iva,
  advancePct: d.advancePct, installments: d.installments, successPct: d.successPct || undefined, successBase: d.successBase || undefined,
  lines: d.lines.map(({ uid: _u, ...l }) => ({ ...l, base: l.base || undefined, amount: l.amount || undefined, quantity: l.quantity || undefined, label: l.label || undefined, variant: l.variant || undefined })),
  expenses: d.expenses.filter((e) => e.label.trim() && Number(e.amount) > 0).map((e) => ({ label: e.label.trim(), amount: e.amount })),
});

export function FeeCalculator() {
  const { data: catalog, error: e1, reload: r1 } = useApi<Catalog>('/fees/catalog');
  const { data: settings, error: e2, reload: r2, setData: setSettings } = useApi<FeeSettings>('/fees/settings');
  const { current, can } = useAuth();
  const isLegal = current?.serviceProfile === 'LEGAL';
  const [tab, setTab] = useState<'calc' | 'saved' | 'hour' | 'settings'>('calc');
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => { if (settings && !draft) setDraft(emptyDraft(settings)); }, [settings, draft]);

  if (e1 || e2) return <ErrorBox message={(e1 || e2)!} onRetry={() => { r1(); r2(); }} />;
  if (!catalog || !settings || !draft) return <Loading />;
  type Tab = 'calc' | 'saved' | 'hour' | 'settings';
  const tabs: { v: Tab; l: string }[] = [
    { v: 'calc', l: isLegal ? 'Calcular honorarios' : 'Cotizar' }, { v: 'saved', l: 'Propuestas guardadas' },
    { v: 'hour', l: 'Mi tarifa por hora' }, ...(can('business:manage') ? [{ v: 'settings' as Tab, l: 'Ajustes' }] : []),
  ];
  return <>
    <div className="no-print inline-flex rounded-xl bg-sand-100 p-1 gap-1 overflow-x-auto max-w-full mb-5">
      {tabs.map((t) => <button key={t.v} onClick={() => setTab(t.v)} className={cn('px-3 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition', tab === t.v ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>{t.l}</button>)}
    </div>
    {tab === 'calc' && <Editor catalog={catalog} settings={settings} draft={draft} setDraft={setDraft} isLegal={isLegal} onNew={() => setDraft(emptyDraft(settings))} />}
    {tab === 'saved' && <Saved onOpen={(d) => { setDraft(d); setTab('calc'); }} settings={settings} catalog={catalog} />}
    {tab === 'hour' && <HourlyRate settings={settings} onSaved={setSettings} canSave={can('business:manage')} />}
    {tab === 'settings' && <SettingsPanel catalog={catalog} settings={settings} onSaved={(s) => { setSettings(s); setDraft((d) => d && !d.lines.length ? { ...d, tableKey: s.tableKey, iva: s.ivaResponsable, advancePct: s.advancePct, installments: s.installments, city: s.city, level: s.level } : d); }} />}
  </>;
}

/* ───────────────────────── Editor ───────────────────────── */

function Editor({ catalog, settings, draft, setDraft, isLegal, onNew }: { catalog: Catalog; settings: FeeSettings; draft: Draft; setDraft: (f: (d: Draft | null) => Draft | null) => void; isLegal: boolean; onNew: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const { current } = useAuth();
  const set = (p: Partial<Draft>) => setDraft((d) => d && { ...d, ...p });
  const table = catalog.tables.find((t) => t.key === draft.tableKey) ?? catalog.tables[0];
  const itemOf = (key: string) => { for (const t of catalog.tables) { const i = t.items.find((x) => x.key === key); if (i) return { t, i }; } return null; };

  // Cálculo en vivo (el API es la única fuente de verdad del cálculo)
  const body = useMemo(() => JSON.stringify(payload(draft)), [draft]);
  const debounced = useDebounced(body, 350);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [calcErr, setCalcErr] = useState('');
  const [calculating, setCalculating] = useState(false);
  useEffect(() => {
    let alive = true;
    setCalculating(true);
    api<QuoteResult>('/fees/calculate', { body: JSON.parse(debounced) })
      .then((r) => { if (alive) { setResult(r); setCalcErr(''); } })
      .catch((e) => { if (alive) setCalcErr((e as Error).message); })
      .finally(() => alive && setCalculating(false));
    return () => { alive = false; };
  }, [debounced]);

  const addItem = (i: FeeItem) => {
    set({ lines: [...draft.lines, { uid: uid(), itemKey: i.key, quantity: i.unit ? '1' : undefined, mods: [] }], area: draft.area ?? i.area });
    toast('Agregado a la propuesta');
  };
  const addCustom = (label = '', amount = '', quantity = '1') => set({ lines: [...draft.lines, { uid: uid(), itemKey: 'CUSTOM', label, amount, quantity }] });
  const updLine = (u: string, p: Partial<LineInput>) => set({ lines: draft.lines.map((l) => (l.uid === u ? { ...l, ...p } : l)) });
  const delLine = (u: string) => set({ lines: draft.lines.filter((l) => l.uid !== u) });
  const hasMarket = draft.lines.some((l) => itemOf(l.itemKey)?.t.kind === 'MARKET');

  const [saving, setSaving] = useState<'' | 'save' | 'job'>('');
  const save = async (thenJob = false) => {
    if (draft.title.trim().length < 2) { toast(isLegal ? 'Escribe el asunto del caso' : 'Escribe el asunto o nombre de la cotización', 'bad'); return; }
    if (!draft.lines.length) { toast('Agrega al menos un concepto', 'bad'); return; }
    setSaving(thenJob ? 'job' : 'save');
    try {
      const b = { ...payload(draft), title: draft.title.trim(), customerId: draft.customer?.id ?? null, area: draft.area, description: draft.description.trim() || undefined };
      const q = await api<any>(draft.id ? `/fee-quotes/${draft.id}` : '/fee-quotes', { method: draft.id ? 'PUT' : 'POST', body: b });
      set({ id: q.id });
      if (thenJob) {
        const r = await api<{ jobId: string; existing: boolean }>(`/fee-quotes/${q.id}/job`, { body: {} });
        toast(r.existing ? 'Esta propuesta ya tenía un registro' : 'Registro creado con la propuesta');
        router.push(`/trabajos/${r.jobId}`);
      } else toast(`Propuesta #${q.number} guardada`);
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setSaving(''); }
  };

  const waText = () => {
    if (!result) return '';
    const lines = result.lines.filter((l) => l.amount > 0).map((l) => `• ${l.label}${l.variantLabel ? ` (${l.variantLabel})` : ''}: ${money(l.amount)}`);
    const plan = result.schedule.map((s) => `• ${s.label}: ${money(s.amount)}`);
    return [`Hola${draft.customer?.name ? ` ${draft.customer.name.split(' ')[0]}` : ''}, te comparto la propuesta de honorarios de ${current?.tradeName ?? ''}${draft.title ? ` para «${draft.title.trim()}»` : ''}:`, '', ...lines,
      ...(result.adjustAmount ? [`• Ajuste por complejidad: ${money(result.adjustAmount)}`] : []), ...(result.discountAmount ? [`• Descuento: −${money(result.discountAmount)}`] : []),
      ...(result.ivaAmount ? [`• IVA (${result.ivaRate} %): ${money(result.ivaAmount)}`] : []), ...(result.expensesTotal ? [`• Gastos estimados del trámite: ${money(result.expensesTotal)}`] : []),
      '', `Total: ${money(result.total)}`, ...(result.success ? [`Además, honorario de resultado del ${result.success.pct} % sobre lo que se obtenga.`] : []),
      ...(plan.length ? ['', 'Forma de pago:', ...plan] : []), '', '¿Te parece bien? Quedo atento(a) a tus dudas.'].join('\n');
  };

  return <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
    <div className="space-y-5 min-w-0 no-print">
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">{isLegal ? '1. El caso' : '1. La cotización'}</h2>
          {(draft.id || draft.lines.length > 0) && <button className="btn-ghost text-xs" onClick={onNew}><Plus className="h-3.5 w-3.5" /> Nueva</button>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={isLegal ? 'Asunto del caso' : 'Asunto'} className="sm:col-span-2">
            <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={200}
              placeholder={isLegal ? 'Ej.: Cobro de pagaré contra Inversiones XYZ' : 'Ej.: Cambio de pantalla y batería'} />
          </Field>
          <CustomerSelect value={draft.customer} onChange={(c) => set({ customer: c })} />
          <Field label="Tabla de referencia" hint={table.kind === 'TARIFF' ? 'Tabla gremial o normativa' : 'Precios promedio del mercado'}>
            <select className="input" value={draft.tableKey} onChange={(e) => set({ tableKey: e.target.value })}>
              {catalog.tables.map((t) => <option key={t.key} value={t.key}>{t.profession} — {t.kind === 'TARIFF' ? 'tabla de tarifas' : 'precios de mercado'}</option>)}
            </select>
          </Field>
          <Field label={isLegal ? 'Hechos o detalles del caso (opcional)' : 'Detalles (opcional)'} className="sm:col-span-2">
            <textarea className="input min-h-[70px]" value={draft.description} onChange={(e) => set({ description: e.target.value })} maxLength={4000}
              placeholder={isLegal ? 'Resumen de lo que pasó, qué busca el cliente, pruebas con las que cuenta…' : 'Lo que necesita el cliente'} />
          </Field>
        </div>
      </Card>

      <Picker table={table} onPick={addItem} isLegal={isLegal} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">3. Conceptos de la propuesta</h2>
          <div className="flex gap-2">
            {settings.hourlyRate && <button className="btn-secondary text-xs" onClick={() => addCustom('Horas de trabajo profesional', settings.hourlyRate!, '1')}>+ Horas ({money(settings.hourlyRate)}/h)</button>}
            <button className="btn-secondary text-xs" onClick={() => addCustom()}><Plus className="h-3.5 w-3.5" /> Concepto propio</button>
          </div>
        </div>
        {!draft.lines.length ? <p className="text-sm text-ink-muted py-6 text-center">Elige arriba {isLegal ? 'la especialidad y el tipo de proceso o trámite' : 'el servicio'}. Puedes sumar varios (por ejemplo, el proceso + medidas cautelares + segunda instancia).</p> :
          <div className="space-y-3">{draft.lines.map((l, idx) => <LineEditor key={l.uid} line={l} found={itemOf(l.itemKey)} res={result?.lines[idx]} mods={catalog.mods}
            onChange={(p) => updLine(l.uid, p)} onRemove={() => delLine(l.uid)} smmlv={Number(settings.smmlv)} />)}</div>}
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">4. Ajustes, gastos y forma de pago</h2>
        {hasMarket && <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <Field label="Nivel de precio" hint="Dentro del rango de mercado"><select className="input" value={draft.level} onChange={(e) => set({ level: e.target.value })}>{Object.entries(catalog.levels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Ciudad" hint="Los rangos de mercado son de Bogotá"><select className="input" value={draft.city} onChange={(e) => set({ city: e.target.value })}>{Object.entries(catalog.cities).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        </div>}
        <Field label={`Ajuste por complejidad, experiencia o urgencia: ${draft.adjustPct > 0 ? '+' : ''}${draft.adjustPct} %`}>
          <input type="range" min={-50} max={100} step={5} value={draft.adjustPct} onChange={(e) => set({ adjustPct: Number(e.target.value) })} className="w-full accent-[rgb(var(--primary))]" />
          <div className="flex flex-wrap gap-1.5 mt-1">{ADJUST_PRESETS.map((p) => <button key={p.label} type="button" onClick={() => set({ adjustPct: p.pct })}
            className={cn('chip text-xs px-2.5 h-7 rounded-full border', draft.adjustPct === p.pct ? 'bg-ink text-white border-ink' : 'border-line bg-white')}>{p.label} {p.pct > 0 ? `+${p.pct}` : p.pct} %</button>)}</div>
        </Field>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <Field label="Descuento (%)"><input className="input" type="number" min={0} max={100} value={draft.discountPct || ''} placeholder="0" onChange={(e) => set({ discountPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></Field>
          <Field label="Anticipo (%)"><input className="input" type="number" min={0} max={100} value={draft.advancePct} onChange={(e) => set({ advancePct: Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))) })} /></Field>
          <Field label="Cuotas para el saldo"><select className="input" value={draft.installments} onChange={(e) => set({ installments: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Un solo pago' : `${n} cuotas`}</option>)}</select></Field>
        </div>
        <label className="flex items-start gap-2 mt-4 text-sm"><input type="checkbox" className="mt-1" checked={draft.iva} onChange={(e) => set({ iva: e.target.checked })} />
          <span>Cobrar IVA ({settings.ivaRate} %) sobre los honorarios <span className="block text-xs text-ink-muted">Solo si eres responsable de IVA. Los gastos del trámite no llevan IVA.</span></span></label>

        {isLegal && <div className="mt-4 rounded-xl border border-line p-3">
          <p className="text-sm font-medium">Honorario de resultado (cuota litis) <span className="text-ink-muted font-normal">— opcional</span></p>
          <p className="text-xs text-ink-muted mb-2">Un porcentaje adicional sobre lo que el cliente obtenga si se gana. Se muestra aparte y no se suma al total.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Porcentaje (%)"><input className="input" type="number" min={0} max={50} value={draft.successPct || ''} placeholder="Ej.: 20" onChange={(e) => set({ successPct: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} /></Field>
            <Field label="Valor que se espera obtener"><MoneyInput value={draft.successBase} onChange={(v) => set({ successBase: v })} /></Field>
          </div>
        </div>}

        <div className="mt-4">
          <p className="label">{isLegal ? 'Gastos del proceso (los paga el cliente aparte)' : 'Gastos o materiales aparte'}</p>
          <div className="space-y-2">{draft.expenses.map((x) => <div key={x.uid} className="flex gap-2">
            <input className="input" value={x.label} maxLength={120} placeholder="Concepto" onChange={(e) => set({ expenses: draft.expenses.map((y) => y.uid === x.uid ? { ...y, label: e.target.value } : y) })} />
            <MoneyInput className="w-40 shrink-0" value={x.amount} onChange={(v) => set({ expenses: draft.expenses.map((y) => y.uid === x.uid ? { ...y, amount: v } : y) })} />
            <button className="btn-ghost !px-2" aria-label="Quitar gasto" onClick={() => set({ expenses: draft.expenses.filter((y) => y.uid !== x.uid) })}><X className="h-4 w-4" /></button>
          </div>)}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(EXPENSE_HINTS[draft.tableKey] ?? []).filter((h) => !draft.expenses.some((x) => x.label === h)).map((h) => <button key={h} type="button" className="text-xs px-2.5 h-7 rounded-full border border-dashed border-line hover:bg-sand-50" onClick={() => set({ expenses: [...draft.expenses, { uid: uid(), label: h, amount: '' }] })}>+ {h}</button>)}
            <button type="button" className="text-xs px-2.5 h-7 rounded-full border border-dashed border-line hover:bg-sand-50" onClick={() => set({ expenses: [...draft.expenses, { uid: uid(), label: '', amount: '' }] })}>+ Otro gasto</button>
          </div>
        </div>
      </Card>

      <Sources table={table} catalog={catalog} lines={draft.lines} itemOf={itemOf} smmlv={settings.smmlv} />
    </div>

    <div className="lg:sticky lg:top-4 space-y-3 no-print">
      <Card>
        <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-ink-muted">{isLegal ? 'Honorarios propuestos' : 'Total cotizado'}</p>{calculating && <Spinner />}</div>
        <p className="text-3xl font-semibold mt-1">{money(result?.total ?? 0)}</p>
        {calcErr && <p className="text-xs text-bad mt-1">{calcErr}</p>}
        {result && result.lines.length > 0 && <dl className="mt-3 text-sm space-y-1.5">
          <Row k="Honorarios" v={money(result.feesSubtotal)} />
          {result.adjustAmount !== 0 && <Row k={`Ajuste (${result.adjustPct > 0 ? '+' : ''}${result.adjustPct} %)`} v={money(result.adjustAmount)} />}
          {result.discountAmount > 0 && <Row k={`Descuento (${result.discountPct} %)`} v={`−${money(result.discountAmount)}`} />}
          {result.ivaAmount > 0 && <Row k={`IVA (${result.ivaRate} %)`} v={money(result.ivaAmount)} />}
          {result.expensesTotal > 0 && <Row k="Gastos aparte" v={money(result.expensesTotal)} />}
          {result.success && <Row k={`+ Resultado (${result.success.pct} %)`} v={`≈ ${money(result.success.amount)}`} muted />}
        </dl>}
        {result && result.schedule.length > 0 && <div className="mt-3 pt-3 border-t border-line">
          <p className="text-xs font-medium text-ink-muted mb-1.5">Forma de pago</p>
          <dl className="text-sm space-y-1">{result.schedule.map((s, i) => <Row key={i} k={s.label} v={money(s.amount)} />)}</dl>
        </div>}
        {result && result.warnings.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-1">
          {result.warnings.slice(0, 4).map((w, i) => <p key={i} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}</p>)}
        </div>}
        <div className="grid gap-2 mt-4">
          <button className="btn-primary" disabled={!!saving} onClick={() => save(true)}>{saving === 'job' ? <Spinner /> : <Briefcase className="h-4 w-4" />} {isLegal ? 'Crear caso con esta propuesta' : 'Crear orden con esta cotización'}</button>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-secondary !px-2" disabled={!!saving} onClick={() => save(false)} title="Guardar">{saving === 'save' ? <Spinner /> : <Save className="h-4 w-4" />} Guardar</button>
            <a className={cn('btn-secondary !px-2', !result?.lines.length && 'pointer-events-none opacity-50')} href={waLink(draft.customer?.phone, waText())} target="_blank" rel="noreferrer" title="Enviar por WhatsApp"><MessageCircle className="h-4 w-4" /> Enviar</a>
            <button className="btn-secondary !px-2" disabled={!result?.lines.length} onClick={() => window.print()} title="Imprimir o guardar en PDF"><Printer className="h-4 w-4" /> PDF</button>
          </div>
        </div>
        {draft.id && <p className="text-[11px] text-ink-muted mt-2">Editando una propuesta guardada. «Guardar» actualiza esa misma propuesta.</p>}
      </Card>
      <Disclaimer>{table.disclaimer} {isLegal && 'Recuerda pactar los honorarios por escrito (contrato de prestación de servicios o poder con cláusula de honorarios).'}</Disclaimer>
    </div>

    {result && <PrintDoc draft={draft} result={result} tradeName={current?.tradeName ?? ''} isLegal={isLegal} table={table} />}
  </div>;
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return <div className={cn('flex justify-between gap-3', muted && 'text-ink-muted')}><dt className="min-w-0">{k}</dt><dd className="font-medium whitespace-nowrap">{v}</dd></div>;
}

/* ───────────────────────── Selector de trámites ───────────────────────── */

function Picker({ table, onPick, isLegal }: { table: FeeTable; onPick: (i: FeeItem) => void; isLegal: boolean }) {
  const [area, setArea] = useState(table.areas[0]?.key ?? '');
  const [q, setQ] = useState('');
  useEffect(() => { setArea(table.areas[0]?.key ?? ''); setQ(''); }, [table.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = q.trim().length >= 2
    ? table.items.filter((i) => norm(`${i.label} ${i.tags ?? ''} ${i.ref ?? ''} ${i.variants?.map((v) => v.label).join(' ') ?? ''}`).includes(norm(q.trim()))).slice(0, 30)
    : table.items.filter((i) => i.area === area);
  const areaLabel = (k: string) => table.areas.find((a) => a.key === k)?.label ?? k;
  return <Card>
    <h2 className="font-semibold mb-3">2. {isLegal ? 'Especialidad y tipo de proceso o trámite' : 'Servicio'}</h2>
    <div className="grid sm:grid-cols-2 gap-3 mb-3">
      <Field label={isLegal ? 'Especialidad del caso' : 'Categoría'}>
        <select className="input" value={area} onChange={(e) => { setArea(e.target.value); setQ(''); }}>{table.areas.map((a) => <option key={a.key} value={a.key}>{a.label} ({table.items.filter((i) => i.area === a.key).length})</option>)}</select>
      </Field>
      <Field label="O busca">
        <div className="relative"><Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" /><input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isLegal ? 'divorcio, pagaré, sucesión, tutela…' : 'Busca un servicio'} /></div>
      </Field>
    </div>
    {!list.length ? <p className="text-sm text-ink-muted py-4 text-center">No encontramos «{q}» en esta tabla. Agrégalo como «Concepto propio».</p> :
      <ul className="divide-y divide-line rounded-xl border border-line max-h-[360px] overflow-y-auto">
        {list.map((i) => <li key={i.key}>
          <button type="button" onClick={() => onPick(i)} className="w-full text-left px-3 py-2.5 hover:bg-sand-50 flex items-start gap-3 group">
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">{i.ref && <span className="text-ink-faint mr-1">{i.ref}</span>}{i.label}</p>
              <p className="text-[11px] text-ink-muted mt-0.5">{q.trim().length >= 2 && `${areaLabel(i.area)} · `}{formulaShort(i)}{i.base && needsBase(i) ? ` · sobre ${i.base.toLowerCase()}` : ''}{i.unit ? ` · por ${i.unit}` : ''}{i.variants?.length ? ` · ${i.variants.length + 1} opciones` : ''}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-ink-muted group-hover:text-ink flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Agregar</span>
          </button>
        </li>)}
      </ul>}
  </Card>;
}

/* ───────────────────────── Línea ───────────────────────── */

function LineEditor({ line, found, res, mods, onChange, onRemove, smmlv }: {
  line: LineInput; found: { t: FeeTable; i: FeeItem } | null; res?: QuoteResult['lines'][number]; mods: Catalog['mods'];
  onChange: (p: Partial<LineInput>) => void; onRemove: () => void; smmlv: number;
}) {
  const [open, setOpen] = useState(false);
  if (line.itemKey === 'CUSTOM') return <div className="rounded-xl border border-line p-3">
    <div className="flex gap-2 items-start">
      <div className="flex-1 grid sm:grid-cols-[1fr_150px_90px] gap-2">
        <input className="input" placeholder="Concepto (ej.: segunda instancia, audiencia adicional)" value={line.label ?? ''} maxLength={200} onChange={(e) => onChange({ label: e.target.value })} />
        <MoneyInput value={line.amount} onChange={(v) => onChange({ amount: v })} />
        <input className="input" type="number" min={0.25} step={0.25} title="Cantidad" value={line.quantity ?? '1'} onChange={(e) => onChange({ quantity: e.target.value })} />
      </div>
      <button className="btn-ghost !px-2" aria-label="Quitar" onClick={onRemove}><Trash2 className="h-4 w-4" /></button>
    </div>
    {res && <p className="text-right text-sm font-semibold mt-1">{money(res.amount)}</p>}
  </div>;
  if (!found) return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm flex justify-between">Esta tarifa ya no existe. <button className="underline" onClick={onRemove}>Quitar</button></div>;
  const { i, t } = found;
  const variantNeedsBase = (() => { const v = i.variants?.find((x) => x.key === line.variant); const f = v ? v.f : i.f; return (!!i.byCuantia && !v) || (!!f && (f.pct != null || !!f.tiers || !!f.above)); })();
  return <div className="rounded-xl border border-line p-3">
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{i.ref && <span className="text-ink-faint font-normal mr-1">{i.ref}</span>}{i.label}</p>
        <p className="text-[11px] text-ink-muted">{t.areas.find((a) => a.key === i.area)?.label}{i.success && ' · depende del resultado'}</p>
      </div>
      <p className="text-sm font-semibold whitespace-nowrap">{money(res?.amount ?? 0)}</p>
      <button className="btn-ghost !px-2 -mr-1" aria-label="Quitar" onClick={onRemove}><Trash2 className="h-4 w-4" /></button>
    </div>
    {(!!i.variants?.length || variantNeedsBase || !!i.unit) && <div className="grid sm:grid-cols-2 gap-2 mt-2">
      {!!i.variants?.length && <Field label="Modalidad"><select className="input" value={line.variant ?? ''} onChange={(e) => onChange({ variant: e.target.value || undefined })}>
        <option value="">{i.label} (general)</option>{i.variants.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}</select></Field>}
      {variantNeedsBase && <Field label={i.base ?? 'Valor base'} hint={res?.cuantia ? <span className="font-medium text-ink">{res.cuantia.label} · {res.cuantia.inSmmlv.toLocaleString('es-CO')} SMMLV</span> : i.byCuantia ? `Mínima hasta ${money(40 * smmlv)} · menor hasta ${money(150 * smmlv)}` : undefined}>
        <MoneyInput value={line.base} onChange={(v) => onChange({ base: v })} placeholder={i.byCuantia ? 'Cuantía del caso' : '0'} />
      </Field>}
      {i.unit && <Field label={`Cantidad (${i.unit === 'mes' ? 'meses' : i.unit + 's'})`}><input className="input" type="number" min={0.5} step={0.5} value={line.quantity ?? '1'} onChange={(e) => onChange({ quantity: e.target.value })} /></Field>}
    </div>}
    {!!i.mods?.length && <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">{i.mods.map((m) => <label key={m} className="flex items-center gap-1.5 text-xs" title={mods[m]?.help}>
      <input type="checkbox" checked={line.mods?.includes(m) ?? false} onChange={(e) => onChange({ mods: e.target.checked ? [...(line.mods ?? []), m] : (line.mods ?? []).filter((x) => x !== m) })} />{mods[m]?.label}</label>)}</div>}
    {res && res.warnings.length > 0 && <p className="text-[11px] text-amber-700 mt-2">{res.warnings[0]}</p>}
    {res && res.breakdown.length > 0 && <button type="button" className="text-[11px] text-ink-muted mt-2 flex items-center gap-1 hover:text-ink" onClick={() => setOpen(!open)}>
      <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} /> Cómo se calculó</button>}
    {open && res && <ul className="mt-1 text-[11px] text-ink-muted space-y-0.5 pl-4 list-disc">{res.breakdown.map((b, k) => <li key={k}>{b}</li>)}{res.range && <li>Rango ajustado a la ciudad: {money(res.range[0])} – {money(res.range[1])}</li>}{res.note && <li className="text-ink">{res.note}</li>}</ul>}
  </div>;
}

/* ───────────────────────── Fuentes ───────────────────────── */

function Sources({ table, lines, itemOf, smmlv }: { table: FeeTable; catalog: Catalog; lines: LineInput[]; itemOf: (k: string) => { t: FeeTable; i: FeeItem } | null; smmlv: string }) {
  const used = new Map<string, FeeTable>();
  used.set(table.key, table);
  for (const l of lines) { const f = itemOf(l.itemKey); if (f) used.set(f.t.key, f.t); }
  return <Card>
    <h2 className="font-semibold mb-2 flex items-center gap-2"><Info className="h-4 w-4" /> De dónde salen estos valores</h2>
    <p className="text-xs text-ink-muted mb-3">Salario mínimo usado: <b className="text-ink">{money(smmlv)}</b> (SMMLV 2026). Lo puedes cambiar en «Ajustes».</p>
    <div className="space-y-3">{[...used.values()].map((t) => <div key={t.key} className="text-xs">
      <p className="font-medium text-sm">{t.title}</p>
      <ul className="mt-1 space-y-1">{t.sources.map((s) => <li key={s.key} className="text-ink-muted">
        {s.url ? <a className="underline inline-flex items-center gap-1 text-ink" href={s.url} target="_blank" rel="noreferrer">{s.label} <ExternalLink className="h-3 w-3" /></a> : <span className="text-ink">{s.label}</span>}{s.note ? ` — ${s.note}` : ''}</li>)}</ul>
      {t.notes?.map((n, k) => <p key={k} className="text-ink-muted mt-1">• {n}</p>)}
    </div>)}</div>
  </Card>;
}

/* ───────────────────────── Documento imprimible ───────────────────────── */

function PrintDoc({ draft, result, tradeName, isLegal, table }: { draft: Draft; result: QuoteResult; tradeName: string; isLegal: boolean; table: FeeTable }) {
  return <div className="hidden print:block col-span-full text-[12px] leading-relaxed text-black">
    <div className="flex justify-between items-start border-b pb-3 mb-4">
      <div><p className="text-lg font-semibold">{tradeName}</p><p>{isLegal ? 'Propuesta de honorarios profesionales' : 'Cotización de servicios'}</p></div>
      <p>{date(new Date())}</p>
    </div>
    {draft.customer && <p><b>Cliente:</b> {draft.customer.name}{draft.customer.phone ? ` · ${draft.customer.phone}` : ''}</p>}
    <p><b>{isLegal ? 'Asunto' : 'Asunto'}:</b> {draft.title || '—'}</p>
    {draft.description && <p className="mt-2 whitespace-pre-line">{draft.description}</p>}
    <table className="w-full mt-4 border-collapse">
      <thead><tr className="border-b"><th className="text-left py-1">Concepto</th><th className="text-right py-1">Cant.</th><th className="text-right py-1">Valor</th></tr></thead>
      <tbody>{result.lines.map((l, i) => <tr key={i} className="border-b align-top"><td className="py-1.5 pr-3">{l.label}{l.variantLabel ? ` — ${l.variantLabel}` : ''}{l.cuantia ? <span className="block text-[10px]">{l.cuantia.label}</span> : null}</td><td className="text-right">{l.quantity}</td><td className="text-right whitespace-nowrap">{money(l.amount)}</td></tr>)}</tbody>
    </table>
    <div className="ml-auto w-72 mt-3 space-y-1">
      <Row k="Honorarios" v={money(result.feesSubtotal)} />
      {result.adjustAmount !== 0 && <Row k="Ajuste por complejidad" v={money(result.adjustAmount)} />}
      {result.discountAmount > 0 && <Row k="Descuento" v={`−${money(result.discountAmount)}`} />}
      {result.ivaAmount > 0 && <Row k={`IVA (${result.ivaRate} %)`} v={money(result.ivaAmount)} />}
      {result.expensesTotal > 0 && <Row k="Gastos estimados (aparte)" v={money(result.expensesTotal)} />}
      <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{money(result.total)}</span></div>
    </div>
    {result.expenses.length > 0 && <><p className="font-semibold mt-4">{isLegal ? 'Gastos del proceso' : 'Gastos y materiales'}</p><ul className="list-disc pl-5">{result.expenses.map((e, i) => <li key={i}>{e.label}: {money(e.amount)}</li>)}</ul></>}
    {result.success && <p className="mt-3">Adicionalmente, honorario de resultado equivalente al {result.success.pct} % de lo que se obtenga a favor del cliente.</p>}
    {result.schedule.length > 0 && <><p className="font-semibold mt-4">Forma de pago</p><ul className="list-disc pl-5">{result.schedule.map((s, i) => <li key={i}>{s.label}: {money(s.amount)}</li>)}</ul></>}
    <p className="mt-6 text-[10px] text-neutral-600">Valores calculados con referencia en: {table.sources.map((s) => s.label).join('; ')}. {isLegal ? 'Los honorarios definitivos se pactan por escrito entre las partes.' : 'Precios sujetos a revisión del equipo o servicio.'}</p>
    {isLegal && <div className="grid grid-cols-2 gap-10 mt-16"><div className="border-t pt-1">Firma del profesional</div><div className="border-t pt-1">Acepto — firma del cliente</div></div>}
  </div>;
}

/* ───────────────────────── Propuestas guardadas ───────────────────────── */

function Saved({ onOpen, settings, catalog }: { onOpen: (d: Draft) => void; settings: FeeSettings; catalog: Catalog }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const { data, error, loading, reload } = useApi<any[]>(`/fee-quotes${dq.trim() ? `?q=${encodeURIComponent(dq.trim())}` : ''}`);
  const open = async (id: string) => {
    try {
      const x = await api<any>(`/fee-quotes/${id}`);
      const inp = x.input ?? {};
      onOpen({
        ...emptyDraft(settings), id: x.id, title: x.title, description: x.description ?? '', area: x.area ?? undefined, tableKey: inp.tableKey ?? x.tableKey,
        customer: x.customerId ? { id: x.customerId, name: x.customerName ?? 'Cliente', phone: x.customerPhone } : null,
        lines: (inp.lines ?? []).map((l: any) => ({ ...l, uid: uid() })), expenses: (inp.expenses ?? []).map((e: any) => ({ ...e, uid: uid() })),
        level: inp.level ?? settings.level, city: inp.city ?? settings.city, adjustPct: inp.adjustPct ?? 0, discountPct: inp.discountPct ?? 0, iva: !!inp.iva,
        advancePct: inp.advancePct ?? settings.advancePct, installments: inp.installments ?? 1, successPct: inp.successPct ?? 0, successBase: inp.successBase ?? '',
      });
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta propuesta? El caso que hayas creado con ella no se borra.')) return;
    try { await api(`/fee-quotes/${id}`, { method: 'DELETE' }); reload(); toast('Propuesta eliminada'); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const tableName = (k: string) => catalog.tables.find((t) => t.key === k)?.profession ?? k;
  return <Card>
    <div className="relative mb-3 max-w-sm"><Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" /><input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por asunto o cliente" /></div>
    {error && <ErrorBox message={error} onRetry={reload} />}
    {loading && !data ? <Loading /> : !data?.length ? <Empty icon={<Calculator className="h-6 w-6" />} title="Aún no tienes propuestas guardadas" description="Calcula una propuesta y toca «Guardar» o «Crear caso»." /> :
      <ul className="divide-y divide-line">{data.map((x) => <li key={x.id} className="py-3 flex items-center gap-3">
        <FileText className="h-5 w-5 text-ink-faint shrink-0" />
        <button className="flex-1 min-w-0 text-left" onClick={() => open(x.id)}>
          <p className="text-sm font-medium truncate">#{x.number} · {x.title}</p>
          <p className="text-xs text-ink-muted">{x.customerName ?? 'Sin cliente'} · {tableName(x.tableKey)} · {date(x.createdAt)}</p>
        </button>
        <p className="text-sm font-semibold whitespace-nowrap">{money(x.total)}</p>
        {x.jobId ? <Link href={`/trabajos/${x.jobId}`} className="hidden sm:inline-flex"><Badge tone="ok">Ver registro</Badge></Link> : <Badge tone="muted">Borrador</Badge>}
        <button className="btn-ghost !px-2" aria-label="Eliminar" onClick={() => del(x.id)}><Trash2 className="h-4 w-4" /></button>
      </li>)}</ul>}
  </Card>;
}

/* ───────────────────────── Tarifa por hora ───────────────────────── */

function HourlyRate({ settings, onSaved, canSave }: { settings: FeeSettings; onSaved: (s: FeeSettings) => void; canSave: boolean }) {
  const toast = useToast();
  const [income, setIncome] = useState('6000000');
  const [costs, setCosts] = useState('1500000');
  const [hours, setHours] = useState(80);
  const [margin, setMargin] = useState(15);
  const smmlv = Number(settings.smmlv);
  const rate = hours > 0 ? Math.round(((Number(income) + Number(costs)) / hours) * (1 + margin / 100) / 1000) * 1000 : 0;
  const save = async () => {
    try { onSaved(await api<FeeSettings>('/fees/settings', { method: 'PUT', body: { hourlyRate: String(rate) } })); toast('Tarifa por hora guardada'); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  return <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
    <Card>
      <h2 className="font-semibold">¿Cuánto debo cobrar por hora?</h2>
      <p className="text-sm text-ink-muted mb-4">Sirve para cualquier profesión: parte de lo que quieres ganar y de tus gastos, no de lo que cobran otros.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Lo que quieres ganar al mes" hint="Tu «sueldo» limpio"><MoneyInput value={income} onChange={setIncome} /></Field>
        <Field label="Gastos fijos del mes" hint="Arriendo, internet, software, seguridad social, transporte…"><MoneyInput value={costs} onChange={setCosts} /></Field>
        <Field label={`Horas que de verdad cobras al mes: ${hours}`} hint="Descuenta trámites, desplazamientos y tiempo sin clientes. 60–100 es lo usual.">
          <input type="range" min={20} max={180} step={5} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full" />
        </Field>
        <Field label={`Colchón para imprevistos: ${margin} %`}><input type="range" min={0} max={50} step={5} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full" /></Field>
      </div>
    </Card>
    <Card>
      <p className="text-xs uppercase tracking-wide text-ink-muted">Tu tarifa por hora</p>
      <p className="text-3xl font-semibold mt-1">{money(rate)}</p>
      <dl className="text-sm mt-3 space-y-1.5">
        <Row k="Media jornada (4 h)" v={money(rate * 4)} />
        <Row k="Jornada (8 h)" v={money(rate * 8)} />
        <Row k="En salarios mínimos" v={`${(rate / smmlv).toLocaleString('es-CO', { maximumFractionDigits: 2 })} SMMLV`} />
      </dl>
      <p className="text-xs text-ink-muted mt-3">Referencia CONALBOS para abogados: hora de asesoría comercial 0,5 SMMLV ({money(smmlv * 0.5)}).</p>
      {settings.hourlyRate && <p className="text-xs mt-2">Tarifa guardada actualmente: <b>{money(settings.hourlyRate)}</b></p>}
      {canSave && <button className="btn-primary w-full mt-4" onClick={save} disabled={rate <= 0}>Usar esta tarifa en mis propuestas</button>}
    </Card>
  </div>;
}

/* ───────────────────────── Ajustes ───────────────────────── */

function SettingsPanel({ catalog, settings, onSaved }: { catalog: Catalog; settings: FeeSettings; onSaved: (s: FeeSettings) => void }) {
  const toast = useToast();
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<FeeSettings>('/fees/settings', { method: 'PUT', body: { smmlv: s.smmlv, ivaResponsable: s.ivaResponsable, ivaRate: s.ivaRate, advancePct: s.advancePct, installments: s.installments, city: s.city, level: s.level, tableKey: s.tableKey } });
      onSaved(r); setS(r); toast('Ajustes guardados');
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  return <Card className="max-w-2xl">
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Salario mínimo (SMMLV) que se usa" hint={<>2026: {money(settings.smmlvDefault)}. Cámbialo cuando el Gobierno fije el nuevo salario. {s.smmlv !== settings.smmlvDefault && <button type="button" className="underline" onClick={() => setS({ ...s, smmlv: settings.smmlvDefault })}>Restablecer</button>}</>}>
        <MoneyInput value={s.smmlv} onChange={(v) => setS({ ...s, smmlv: v })} />
      </Field>
      <Field label="Tabla que se abre primero"><select className="input" value={s.tableKey} onChange={(e) => setS({ ...s, tableKey: e.target.value })}>{catalog.tables.map((t) => <option key={t.key} value={t.key}>{t.profession}</option>)}</select></Field>
      <Field label="Anticipo por defecto (%)"><input className="input" type="number" min={0} max={100} value={s.advancePct} onChange={(e) => setS({ ...s, advancePct: Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))) })} /></Field>
      <Field label="Cuotas por defecto"><select className="input" value={s.installments} onChange={(e) => setS({ ...s, installments: Number(e.target.value) })}>{[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Un solo pago' : `${n} cuotas`}</option>)}</select></Field>
      <Field label="Ciudad (para precios de mercado)"><select className="input" value={s.city} onChange={(e) => setS({ ...s, city: e.target.value })}>{Object.entries(catalog.cities).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      <Field label="Nivel de precio por defecto"><select className="input" value={s.level} onChange={(e) => setS({ ...s, level: e.target.value })}>{Object.entries(catalog.levels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1" checked={s.ivaResponsable} onChange={(e) => setS({ ...s, ivaResponsable: e.target.checked })} />
        <span>Soy responsable de IVA <span className="block text-xs text-ink-muted">Las propuestas nuevas incluirán IVA del {s.ivaRate} % sobre los honorarios. Consulta con tu contador si tienes dudas.</span></span></label>
    </div>
    <button className="btn-primary mt-4" onClick={save} disabled={busy}>{busy && <Spinner />} Guardar ajustes</button>
  </Card>;
}
