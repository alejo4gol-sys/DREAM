'use client';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Briefcase, Check, CheckCircle2, ChevronDown, CircleHelp, Clock, Copy, HeartPulse, Home, Landmark, Lock, MapPin,
  ExternalLink, Globe, MessageCircle, Mic, Navigation, Phone, Scale, ScrollText, Search, ShieldAlert, ShoppingCart, Users, Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { HELP_BRAND } from '@/lib/help-brand';

const NAVY = '#0F3D5E';
export const TOPIC_ICONS: Record<string, typeof Scale> = {
  SALUD: HeartPulse, TRABAJO: Briefcase, FAMILIA: Users, VIVIENDA: Home, DEUDAS: Wallet, VICTIMA: ShieldAlert, PENAL_DEFENSA: Scale, ESTADO: Landmark,
  CONSUMIDOR: ShoppingCart, HERENCIA: ScrollText, OTRO: CircleHelp,
};
type Question = { key: string; text: string; help?: string; type: 'choice' | 'date'; options?: { v: string; label: string }[]; showIf?: Record<string, string[]>; optional?: boolean };
type Topic = { key: string; label: string; hint: string; questions: Question[] };
type Catalog = { topics: Topic[]; departments: string[]; places: Record<string, string[]>; consentText: string };
type OfficeT = { name: string; address: string; phone?: string; hours?: string; source: string; sourceUrl?: string; verify?: boolean; note?: string; maps: string };
type PlaceCardT = { entity: string; label: string; offices: OfficeT[]; searchMaps?: string; phones: { label: string; phone: string }[]; online: { label: string; url: string }[]; directory?: { label: string; url: string } };
type PlaceT = { department: string; city: string | null };
type RouteT = { title: string; what: string; where: string[]; places?: PlaceCardT[]; docs?: string[]; urgent?: boolean; noLawyerNeeded?: boolean; deadline: { dueDate: string; daysLeft: number; label: string } | null };
export type OrientationT = { headline: string; routes: RouteT[]; emergency?: { text: string; lines: { label: string; phone: string }[] }; notes: string[]; urgent?: boolean; place?: PlaceT | null };

const longDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const store = {
  get(): { code: string; token: string; topic: string; at: string }[] { try { return JSON.parse(localStorage.getItem('tu-derecho.consultas') ?? '[]'); } catch { return []; } },
  add(x: { code: string; token: string; topic: string; at: string }) { try { localStorage.setItem('tu-derecho.consultas', JSON.stringify([x, ...store.get()].slice(0, 10))); } catch { /* sin almacenamiento */ } },
};
const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Header({ onHome }: { onHome?: () => void }) {
  return <header className="sticky top-0 z-10 bg-[#0F3D5E] text-white">
    <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-2">
      <button type="button" onClick={onHome} className="flex items-center gap-2 font-semibold text-lg" aria-label={`Inicio de ${HELP_BRAND.name}`}>
        <img src={HELP_BRAND.icon} alt="" className="h-8 w-8 rounded-lg" /> {HELP_BRAND.name}
      </button>
      <span className="ml-auto text-[11px] text-white/70">Orientación gratuita</span>
    </div>
  </header>;
}

export function EmergencyStrip() {
  return <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
    <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> ¿Estás en peligro ahora?</p>
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
      <a className="underline font-medium" href="tel:123">Emergencias 123</a>
      <a className="underline font-medium" href="tel:155">Línea mujeres 155</a>
      <a className="underline font-medium" href="tel:141">Niños (ICBF) 141</a>
    </p>
  </div>;
}

const Big = ({ children, onClick, disabled, variant = 'primary', type = 'button' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'light'; type?: 'button' | 'submit' }) =>
  <button type={type} onClick={onClick} disabled={disabled} className={cls('w-full min-h-14 rounded-2xl px-5 text-base font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50',
    variant === 'primary' && 'bg-[#0F3D5E] text-white active:scale-[.99]', variant === 'light' && 'bg-white border-2 border-[#0F3D5E]/15 text-[#0F3D5E]', variant === 'ghost' && 'text-[#0F3D5E]/80 underline-offset-4 hover:underline')}>{children}</button>;

type Step = 'start' | 'topic' | 'q' | 'place' | 'result' | 'form' | 'done';

export function TuDerechoApp() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState<Step>('start');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [qi, setQi] = useState(0);
  const [place, setPlace] = useState<PlaceT | null>(null);
  const [result, setResult] = useState<OrientationT | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ code: string; token: string; deadlineAt: string } | null>(null);
  const [mine, setMine] = useState<ReturnType<typeof store.get>>([]);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { api<Catalog>('/help/catalog', { noBusiness: true }).then(setCat).catch((e) => setErr((e as Error).message)); setMine(store.get()); }, []);
  useEffect(() => { top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [step, qi]);

  const visibleQs = (t: Topic | null, a: Record<string, string>) => (t?.questions ?? []).filter((q) => !q.showIf || Object.entries(q.showIf).every(([k, vs]) => vs.includes(a[k])));
  const qs = visibleQs(topic, answers);
  const home = () => { setStep('start'); setTopic(null); setAnswers({}); setQi(0); setResult(null); setDone(null); };
  const runOrient = async (a: Record<string, string>, t: Topic, p: PlaceT | null) => {
    setLoading(true);
    try { setResult(await api<OrientationT>('/help/orient', { body: { topic: t.key, answers: a, placeDept: p?.department, placeCity: p?.city ?? undefined }, noBusiness: true })); setStep('result'); }
    catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  };
  const answer = (key: string, value: string) => {
    const a = { ...answers, [key]: value };
    if (!value) delete a[key];
    setAnswers(a);
    const next = visibleQs(topic, a);
    const idx = next.findIndex((q) => q.key === key);
    if (idx + 1 < next.length) setQi(idx + 1); else setStep('place');
  };
  const back = () => {
    if (step === 'topic') return setStep('start');
    if (step === 'q') return qi > 0 ? setQi(qi - 1) : setStep('topic');
    if (step === 'place') { if (qs.length) { setStep('q'); setQi(qs.length - 1); } else setStep('topic'); return; }
    if (step === 'result') return setStep('place');
    if (step === 'form') return setStep('result');
  };

  const progress = { start: 0, topic: 15, q: 15 + (qs.length ? ((qi + 1) / qs.length) * 40 : 40), place: 62, result: 75, form: 90, done: 100 }[step];
  return <>
    <Header onHome={home} />
    <div ref={top} className="scroll-mt-20" />
    {step !== 'start' && step !== 'done' && <div className="h-1.5 bg-[#0F3D5E]/10"><div className="h-full bg-[#F2B705] transition-all" style={{ width: `${progress}%` }} /></div>}
    <main className="max-w-xl mx-auto px-4 py-6 pb-16">
      {err && <p className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</p>}
      {step !== 'start' && step !== 'done' && <button type="button" onClick={back} className="mb-4 inline-flex items-center gap-1 text-sm text-[#0F3D5E]/80"><ArrowLeft className="h-4 w-4" /> Atrás</button>}

      {step === 'start' && <div className="space-y-6">
        <div className="pt-4">
          <h1 className="text-3xl font-bold leading-tight text-[#0F3D5E]">¿Tienes un problema legal?</h1>
          <p className="text-lg mt-2">Te orientamos gratis, en palabras sencillas, sobre qué puedes hacer y si tienes un plazo corriendo.</p>
        </div>
        <ul className="space-y-3 text-base">
          {['Es gratis y no tienes que registrarte', 'Solo respondes unas preguntas cortas', 'Al final, si quieres, abogados verificados te envían propuestas'].map((t) =>
            <li key={t} className="flex gap-3 items-start"><span className="h-7 w-7 rounded-full bg-[#F2B705]/30 flex items-center justify-center shrink-0"><Check className="h-4 w-4 text-[#0F3D5E]" /></span>{t}</li>)}
        </ul>
        <Big onClick={() => setStep('topic')} disabled={!cat}>Empezar <ArrowRight className="h-5 w-5" /></Big>
        {mine.length > 0 && <div className="rounded-2xl bg-white p-4">
          <p className="text-sm font-semibold mb-2">Tus consultas en este celular</p>
          <ul className="space-y-1">{mine.map((m) => <li key={m.code}><Link className="text-sm underline text-[#0F3D5E]" href={`/ayuda/seguimiento/${m.code}?t=${encodeURIComponent(m.token)}`}>Consulta {m.code} · ver propuestas</Link></li>)}</ul>
        </div>}
        <EmergencyStrip />
        <p className="text-xs text-[#13202B]/60">{HELP_BRAND.name} da orientación general y no reemplaza la asesoría de un abogado. No guardamos lo que respondas a menos que decidas pedir propuestas.</p>
      </div>}

      {step === 'topic' && cat && <div>
        <h2 className="text-2xl font-bold text-[#0F3D5E]">¿Sobre qué es tu problema?</h2>
        <p className="text-sm mt-1 mb-4 text-[#13202B]/70">Toca la opción que más se parezca.</p>
        <div className="grid grid-cols-2 gap-3">{cat.topics.map((t) => { const Icon = TOPIC_ICONS[t.key] ?? CircleHelp; return <button key={t.key} type="button"
          onClick={() => { setTopic(t); setAnswers({}); setQi(0); setStep(t.questions.length ? 'q' : 'place'); }}
          className="rounded-2xl bg-white p-4 text-left min-h-28 border-2 border-transparent active:border-[#0F3D5E] hover:border-[#0F3D5E]/30 transition">
          <Icon className="h-7 w-7 text-[#0F3D5E]" /><span className="block font-semibold mt-2 leading-tight">{t.label}</span><span className="block text-xs text-[#13202B]/60 mt-1 leading-snug">{t.hint}</span>
        </button>; })}</div>
      </div>}

      {step === 'q' && topic && qs[qi] && <Q q={qs[qi]} value={answers[qs[qi].key]} onAnswer={(v) => answer(qs[qi].key, v)} loading={loading} n={qi + 1} total={qs.length} />}

      {step === 'place' && cat && topic && <PlaceStep places={cat.places} value={place} loading={loading} onPick={(p) => { setPlace(p); runOrient(answers, topic, p); }} />}

      {step === 'result' && result && topic && <Result r={result} topic={topic} onWant={() => setStep('form')} onRestart={home} onChangePlace={() => setStep('place')} />}

      {step === 'form' && cat && topic && <RequestForm cat={cat} topic={topic} answers={answers} place={place} onDone={(d) => { setDone(d); store.add({ code: d.code, token: d.token, topic: topic.label, at: new Date().toISOString() }); setMine(store.get()); setStep('done'); }} />}

      {step === 'done' && done && <Done d={done} onHome={home} />}
    </main>
  </>;
}

function Q({ q, value, onAnswer, loading, n, total }: { q: Question; value?: string; onAnswer: (v: string) => void; loading: boolean; n: number; total: number }) {
  const [date, setDate] = useState(value ?? '');
  useEffect(() => setDate(value ?? ''), [q.key, value]);
  return <div>
    <p className="text-xs font-semibold text-[#0F3D5E]/60 uppercase tracking-wide">Pregunta {n} de {total}</p>
    <h2 className="text-2xl font-bold text-[#0F3D5E] mt-1">{q.text}</h2>
    {q.help && <p className="text-sm mt-1 text-[#13202B]/70">{q.help}</p>}
    {q.type === 'choice' ? <div className="space-y-3 mt-5">{q.options!.map((o) => <button key={o.v} type="button" disabled={loading} onClick={() => onAnswer(o.v)}
      className={cls('w-full text-left rounded-2xl bg-white px-5 py-4 text-base border-2 transition flex items-center gap-3', value === o.v ? 'border-[#0F3D5E]' : 'border-transparent hover:border-[#0F3D5E]/30')}>
      <span className="flex-1">{o.label}</span><ArrowRight className="h-5 w-5 text-[#0F3D5E]/50" /></button>)}</div>
      : <div className="mt-5 space-y-3">
        <input type="date" className="w-full h-14 rounded-2xl bg-white px-4 text-lg border-2 border-[#0F3D5E]/15 focus:border-[#0F3D5E] outline-none" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        <Big onClick={() => onAnswer(date)} disabled={!date || loading}>Continuar <ArrowRight className="h-5 w-5" /></Big>
        {q.optional && <Big variant="ghost" onClick={() => onAnswer('')} disabled={loading}>No sé la fecha, continuar</Big>}
      </div>}
  </div>;
}

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const QUICK = [['Bogotá D.C.', 'Bogotá D.C.'], ['Antioquia', 'Medellín'], ['Valle del Cauca', 'Cali'], ['Atlántico', 'Barranquilla'], ['Bolívar', 'Cartagena'], ['Santander', 'Bucaramanga']];

/** Pregunta por el municipio para mostrar direcciones cercanas. */
function PlaceStep({ places, value, loading, onPick }: { places: Record<string, string[]>; value: PlaceT | null; loading: boolean; onPick: (p: PlaceT | null) => void }) {
  const [q, setQ] = useState('');
  const [dep, setDep] = useState(value?.department ?? '');
  const all = Object.entries(places).flatMap(([d, cs]) => cs.map((c) => ({ department: d, city: c, f: fold(c) })));
  const t = fold(q);
  const hits = t.length < 2 ? [] : all.filter((x) => x.f.includes(t)).sort((a, b) => Number(!a.f.startsWith(t)) - Number(!b.f.startsWith(t)) || a.f.length - b.f.length).slice(0, 8);
  const quick = QUICK.map(([d, c]) => ({ department: d, city: places[d]?.find((x) => fold(x).startsWith(fold(c))) ?? '' })).filter((x) => x.city);
  const label = (p: PlaceT) => (p.city === p.department ? p.city : `${p.city}, ${p.department}`);
  const pick = (p: PlaceT | null) => !loading && onPick(p);
  return <div>
    <p className="text-xs font-semibold text-[#0F3D5E]/60 uppercase tracking-wide">Último paso</p>
    <h2 className="text-2xl font-bold text-[#0F3D5E] mt-1">¿En qué municipio ocurrieron los hechos o dónde estás tú?</h2>
    <p className="text-sm mt-1 text-[#13202B]/70">Así te mostramos las direcciones de las entidades más cercanas. Las denuncias y quejas por lo general se ponen donde ocurrieron los hechos; la tutela, donde vives o donde te afectaron.</p>
    {value?.city && <button type="button" disabled={loading} onClick={() => pick(value)} className="mt-4 w-full rounded-2xl bg-white px-5 py-4 text-left border-2 border-[#0F3D5E] flex items-center gap-3"><MapPin className="h-5 w-5 text-[#0F3D5E]" /><span className="flex-1 font-semibold">{label(value)}</span><ArrowRight className="h-5 w-5 text-[#0F3D5E]/50" /></button>}
    <label className="mt-4 flex items-center gap-2 h-14 rounded-2xl bg-white px-4 border-2 border-[#0F3D5E]/15 focus-within:border-[#0F3D5E]">
      <Search className="h-5 w-5 text-[#0F3D5E]/60 shrink-0" />
      <input className="flex-1 bg-transparent text-lg outline-none" placeholder="Escribe tu municipio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Municipio" autoComplete="address-level2" />
    </label>
    {hits.length > 0 && <div className="mt-2 rounded-2xl bg-white divide-y divide-[#0F3D5E]/10 overflow-hidden">{hits.map((h) => <button key={`${h.department}-${h.city}`} type="button" disabled={loading} onClick={() => pick({ department: h.department, city: h.city })}
      className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-[#F7F5F0]"><MapPin className="h-4 w-4 text-[#0F3D5E]/60" /><span className="flex-1"><b>{h.city}</b>{h.city !== h.department && <span className="text-[#13202B]/60"> · {h.department}</span>}</span></button>)}</div>}
    {t.length >= 2 && !hits.length && <p className="mt-2 text-sm text-[#13202B]/70">No encontramos ese municipio. Revisa cómo está escrito o búscalo por departamento.</p>}
    {!q && <div className="mt-4 flex flex-wrap gap-2">{quick.map((x) => <button key={x.city} type="button" disabled={loading} onClick={() => pick(x)} className="rounded-full bg-white px-4 h-10 text-sm font-medium text-[#0F3D5E] border border-[#0F3D5E]/15">{x.city}</button>)}</div>}
    <details className="mt-4 rounded-2xl bg-white/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#0F3D5E]">Buscar por departamento</summary>
      <div className="mt-3 grid gap-3">
        <select className="h-12 rounded-xl bg-white px-3 border-2 border-[#0F3D5E]/15" value={dep} onChange={(e) => setDep(e.target.value)} aria-label="Departamento"><option value="">Departamento…</option>{Object.keys(places).map((d) => <option key={d}>{d}</option>)}</select>
        {dep && <select className="h-12 rounded-xl bg-white px-3 border-2 border-[#0F3D5E]/15" value="" onChange={(e) => e.target.value && pick({ department: dep, city: e.target.value })} aria-label="Municipio"><option value="">Municipio…</option>{places[dep].map((c) => <option key={c}>{c}</option>)}</select>}
      </div>
    </details>
    <div className="mt-4"><Big variant="ghost" onClick={() => pick(null)} disabled={loading}>{loading ? 'Preparando tu orientación…' : 'Prefiero no decirlo, continuar'}</Big></div>
  </div>;
}

const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`;
const prettyPhone = (p: string) => p.replace(/^(01)(8000)(\d{3})(\d{3})$/, '$1 $2 $3 $4').replace(/^(60\d)(\d{3})(\d{4})$/, '($1) $2 $3').replace(/^(3\d{2})(\d{3})(\d{4})$/, '$1 $2 $3');

/** Tarjeta de una entidad: sedes con dirección, cómo llegar, llamar y canales en línea. */
function PlaceCard({ p, city }: { p: PlaceCardT; city: string }) {
  return <div className="rounded-xl bg-[#F7F5F0] p-3 text-sm">
    <p className="font-semibold text-[#0F3D5E]">{p.label}</p>
    {p.offices.map((o) => <div key={o.name + o.address} className="mt-2 rounded-lg bg-white p-3">
      <p className="font-medium leading-snug">{o.name}{o.verify && <span className="ml-1.5 align-middle text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5">Por confirmar</span>}</p>
      <p className="mt-1 flex gap-1.5"><MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#0F3D5E]/60" />{o.address}</p>
      {o.hours && <p className="mt-0.5 flex gap-1.5 text-[#13202B]/70"><Clock className="h-4 w-4 shrink-0 mt-0.5" />{o.hours}</p>}
      {o.note && <p className="mt-1 text-xs text-amber-800">{o.note}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={o.maps} target="_blank" rel="noreferrer" className="h-10 rounded-lg bg-[#0F3D5E] text-white font-semibold flex items-center justify-center gap-1.5"><Navigation className="h-4 w-4" /> Cómo llegar</a>
        {o.phone ? <a href={telHref(o.phone)} className="h-10 rounded-lg bg-[#0F3D5E]/10 text-[#0F3D5E] font-semibold flex items-center justify-center gap-1.5"><Phone className="h-4 w-4" /> {prettyPhone(o.phone)}</a> : <span />}
      </div>
      <p className="mt-1.5 text-[11px] text-[#13202B]/50">Fuente: {o.sourceUrl ? <a className="underline" href={o.sourceUrl} target="_blank" rel="noreferrer">{o.source}</a> : o.source}. Verifica horarios antes de ir.</p>
    </div>)}
    {!p.offices.length && p.searchMaps && <a href={p.searchMaps} target="_blank" rel="noreferrer" className="mt-2 h-10 rounded-lg bg-white text-[#0F3D5E] font-semibold flex items-center justify-center gap-1.5 border border-[#0F3D5E]/15"><Search className="h-4 w-4" /> Ver en el mapa{city ? ` en ${city}` : ''}</a>}
    {p.offices.length > 0 && p.searchMaps && <a href={p.searchMaps} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs underline text-[#0F3D5E]">Ver otras sedes en el mapa</a>}
    {(p.phones.length > 0 || p.online.length > 0 || p.directory) && <div className="mt-2 flex flex-wrap gap-1.5">
      {p.phones.map((x) => <a key={x.phone} href={telHref(x.phone)} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 h-8 text-xs font-medium"><Phone className="h-3 w-3" /> {x.label}: {prettyPhone(x.phone)}</a>)}
      {p.online.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 h-8 text-xs font-medium text-[#0F3D5E]"><Globe className="h-3 w-3" /> {x.label}</a>)}
      {p.directory && <a href={p.directory.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 h-8 text-xs font-medium text-[#0F3D5E]"><ExternalLink className="h-3 w-3" /> {p.directory.label}</a>}
    </div>}
  </div>;
}

function Deadline({ d }: { d: NonNullable<RouteT['deadline']> }) {
  const late = d.daysLeft < 0;
  const soon = !late && d.daysLeft <= 30;
  return <div className={cls('mt-3 rounded-xl px-3 py-2.5 text-sm flex gap-2', late ? 'bg-red-50 text-red-900' : soon ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}>
    <Clock className="h-4 w-4 shrink-0 mt-0.5" />
    {late ? <span>Según la fecha que diste, el plazo {d.label} <b>pudo vencer el {longDate(d.dueDate)}</b>. Consulta pronto con un abogado: puede haber excepciones.</span>
      : <span>Tienes hasta el <b>{longDate(d.dueDate)}</b> {d.label}{d.daysLeft === 0 ? ' — ¡vence hoy!' : ` (faltan ${d.daysLeft} días)`}. Es un cálculo aproximado.</span>}
  </div>;
}

function Result({ r, topic, onWant, onRestart, onChangePlace }: { r: OrientationT; topic: Topic; onWant: () => void; onRestart: () => void; onChangePlace: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  const firstOffice = (x: RouteT) => x.places?.flatMap((p) => p.offices)[0];
  const share = `Orientación de ${HELP_BRAND.name} (${topic.label}):\n${r.routes.map((x) => { const o = firstOffice(x); return `• ${x.title}${x.deadline && x.deadline.daysLeft >= 0 ? ` — hasta el ${longDate(x.deadline.dueDate)}` : ''}${o ? `\n   ${o.name}: ${o.address}` : ''}`; }).join('\n')}`;
  const placeName = r.place ? (r.place.city && r.place.city !== r.place.department ? `${r.place.city}, ${r.place.department}` : r.place.city ?? r.place.department) : '';
  return <div className="space-y-4">
    {r.emergency && <div className="rounded-2xl bg-red-600 text-white p-4">
      <p className="font-semibold">{r.emergency.text}</p>
      <div className="grid gap-2 mt-3">{r.emergency.lines.map((l) => <a key={l.phone} href={`tel:${l.phone}`} className="rounded-xl bg-white text-red-700 font-semibold px-4 h-12 flex items-center gap-2"><Phone className="h-4 w-4" /> {l.label}: {l.phone}</a>)}</div>
    </div>}
    <h2 className="text-2xl font-bold text-[#0F3D5E]">{r.headline}</h2>
    <p className="text-sm flex items-center gap-1.5 flex-wrap"><MapPin className="h-4 w-4 text-[#0F3D5E]" />{placeName ? <>Direcciones para <b>{placeName}</b></> : 'Sin ubicación: te mostramos los canales nacionales'}
      <button type="button" onClick={onChangePlace} className="underline text-[#0F3D5E]">{placeName ? 'Cambiar' : 'Elegir mi municipio'}</button></p>
    <div className="space-y-3">{r.routes.map((x, i) => <div key={i} className={cls('rounded-2xl bg-white p-4 border-2', x.urgent ? 'border-[#F2B705]' : 'border-transparent')}>
      <button type="button" className="w-full text-left flex items-start gap-3" onClick={() => setOpen(open === i ? null : i)}>
        <span className="h-7 w-7 rounded-full bg-[#0F3D5E] text-white text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
        <span className="flex-1"><span className="font-semibold text-lg leading-snug block">{x.title}</span>
          <span className="flex flex-wrap gap-1.5 mt-1">{x.urgent && <span className="text-[11px] font-semibold rounded-full bg-[#F2B705]/30 px-2 py-0.5">Urgente</span>}
            {x.noLawyerNeeded && <span className="text-[11px] rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">Puedes hacerlo sin abogado</span>}</span></span>
        <ChevronDown className={cls('h-5 w-5 mt-1 transition', open === i && 'rotate-180')} />
      </button>
      {x.deadline && <Deadline d={x.deadline} />}
      {open === i && <div className="mt-3 pl-10 space-y-3 text-[15px]">
        <p>{x.what}</p>
        {x.where.length > 0 && <div><p className="text-xs font-semibold uppercase text-[#13202B]/60 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Dónde acudir</p><ul className="list-disc pl-5 mt-1">{x.where.map((w) => <li key={w}>{w}</li>)}</ul>
          {!!x.places?.length && <div className="mt-3 space-y-2 -ml-10">{x.places.map((p) => <PlaceCard key={p.entity} p={p} city={r.place?.city ?? ''} />)}</div>}</div>}
        {x.docs && x.docs.length > 0 && <div><p className="text-xs font-semibold uppercase text-[#13202B]/60">Qué llevar</p><ul className="list-disc pl-5 mt-1">{x.docs.map((w) => <li key={w}>{w}</li>)}</ul></div>}
      </div>}
    </div>)}</div>
    {r.notes.map((n) => <p key={n} className="rounded-xl bg-amber-50 text-amber-900 p-3 text-sm">{n}</p>)}
    <div className="rounded-2xl bg-[#0F3D5E] text-white p-5 space-y-3">
      <p className="text-lg font-semibold">¿Quieres que abogados te envíen propuestas?</p>
      <p className="text-sm text-white/80">Es gratis y sin compromiso. Abogados verificados que atienden casos como el tuyo te mandan su propuesta, y tú eliges si aceptas alguna. Tus datos de contacto solo los ve el abogado que elijas.</p>
      <button type="button" onClick={onWant} className="w-full min-h-14 rounded-2xl bg-[#F2B705] text-[#0F3D5E] font-bold text-base">Sí, quiero recibir propuestas</button>
    </div>
    <a className="w-full min-h-12 rounded-2xl bg-white flex items-center justify-center gap-2 font-semibold text-[#0F3D5E]" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-5 w-5" /> Guardar en mi WhatsApp</a>
    <Big variant="ghost" onClick={onRestart}>No, gracias. Volver al inicio</Big>
    <p className="text-xs text-[#13202B]/60">Esta es una orientación general con base en lo que respondiste. No reemplaza la asesoría de un abogado; cada caso puede tener excepciones.</p>
  </div>;
}

function RequestForm({ cat, topic, answers, place, onDone }: { cat: Catalog; topic: Topic; answers: Record<string, string>; place: PlaceT | null; onDone: (d: { code: string; token: string; deadlineAt: string }) => void }) {
  const [f, setF] = useState({ description: '', department: place?.department ?? '', city: place?.city ?? '', name: '', phone: '', email: '', consent: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [listening, setListening] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const dictate = () => {
    if (!SR) return;
    const rec = new SR(); rec.lang = 'es-CO'; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (e: any) => set({ description: `${f.description} ${Array.from(e.results).map((r: any) => r[0].transcript).join(' ')}`.trim().slice(0, 3000) });
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    setListening(true); rec.start();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.description.trim().length < 20) return setErr('Cuéntanos un poco más sobre lo que pasó (al menos una o dos frases).');
    if (!f.department) return setErr('Elige tu departamento.');
    if (!f.consent) return setErr('Para enviar tu consulta necesitamos tu autorización.');
    setBusy(true);
    try { onDone(await api('/help/requests', { body: { topic: topic.key, answers, description: f.description.trim(), department: f.department, city: f.city || undefined, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || undefined, consent: true }, noBusiness: true })); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const input = 'w-full h-14 rounded-2xl bg-white px-4 text-base border-2 border-[#0F3D5E]/15 focus:border-[#0F3D5E] outline-none';
  return <form onSubmit={submit} className="space-y-5">
    <div><h2 className="text-2xl font-bold text-[#0F3D5E]">Cuéntales tu caso a los abogados</h2><p className="text-sm mt-1 text-[#13202B]/70">Solo toma un minuto.</p></div>
    <label className="block"><span className="font-semibold">¿Qué pasó?</span>
      <span className="block text-xs text-[#13202B]/60 mb-1.5 flex items-center gap-1"><Lock className="h-3 w-3" /> No escribas nombres, cédulas, teléfonos ni direcciones aquí: los abogados lo leerán sin tus datos.</span>
      <textarea className="w-full min-h-36 rounded-2xl bg-white p-4 text-base border-2 border-[#0F3D5E]/15 focus:border-[#0F3D5E] outline-none" maxLength={3000} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ej.: Trabajé dos años en una panadería y me despidieron sin pagarme la liquidación…" />
      {SR && <button type="button" onClick={dictate} disabled={listening} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 h-11 text-sm font-semibold text-[#0F3D5E]"><Mic className={cls('h-4 w-4', listening && 'text-red-600 animate-pulse')} /> {listening ? 'Escuchando… habla ahora' : 'Dictar con mi voz'}</button>}
    </label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="block"><span className="font-semibold">Departamento</span><select className={cls(input, 'mt-1.5')} value={f.department} onChange={(e) => set({ department: e.target.value })}><option value="">Elige…</option>{cat.departments.map((d) => <option key={d}>{d}</option>)}</select></label>
      <label className="block"><span className="font-semibold">Ciudad o municipio</span><input className={cls(input, 'mt-1.5')} value={f.city} maxLength={120} onChange={(e) => set({ city: e.target.value })} /></label>
    </div>
    <div className="rounded-2xl bg-white/60 p-4 space-y-3">
      <p className="font-semibold flex items-center gap-2"><Lock className="h-4 w-4" /> Tus datos (solo los verá el abogado que elijas)</p>
      <input className={input} placeholder="Tu nombre" autoComplete="name" required minLength={2} maxLength={160} value={f.name} onChange={(e) => set({ name: e.target.value })} />
      <input className={input} placeholder="Celular (WhatsApp)" type="tel" inputMode="tel" autoComplete="tel" required value={f.phone} onChange={(e) => set({ phone: e.target.value.replace(/[^\d+\s()-]/g, '') })} />
      <input className={input} placeholder="Correo (opcional)" type="email" autoComplete="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
    </div>
    <label className="flex gap-3 items-start text-sm rounded-2xl bg-white p-4"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} /><span>{cat.consentText}</span></label>
    {err && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</p>}
    <Big type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar y recibir propuestas'}</Big>
  </form>;
}

function Done({ d, onHome }: { d: { code: string; token: string; deadlineAt: string }; onHome: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/ayuda/seguimiento/${d.code}?t=${encodeURIComponent(d.token)}` : '';
  const until = new Date(d.deadlineAt).toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  return <div className="space-y-5 pt-4 text-center">
    <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto" />
    <h2 className="text-2xl font-bold text-[#0F3D5E]">¡Listo! Tu consulta fue enviada</h2>
    <p>Los abogados que atienden casos como el tuyo tienen hasta el <b>{until}</b> para enviarte su propuesta.</p>
    <div className="rounded-2xl bg-white p-4 text-left space-y-3">
      <p className="text-sm">Tu código de consulta: <b className="text-lg tracking-wider">{d.code}</b></p>
      <p className="text-sm font-semibold">Guarda este enlace: con él ves las propuestas y eliges.</p>
      <div className="grid grid-cols-2 gap-2">
        <a className="rounded-xl bg-emerald-600 text-white h-12 flex items-center justify-center gap-2 font-semibold" href={`https://wa.me/?text=${encodeURIComponent(`Mi consulta en ${HELP_BRAND.name} (${d.code}): ${link}`)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Enviármelo</a>
        <button type="button" className="rounded-xl bg-[#0F3D5E]/10 h-12 flex items-center justify-center gap-2 font-semibold text-[#0F3D5E]" onClick={() => { navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {}); }}><Copy className="h-4 w-4" /> {copied ? 'Copiado' : 'Copiar enlace'}</button>
      </div>
    </div>
    <Link href={`/ayuda/seguimiento/${d.code}?t=${encodeURIComponent(d.token)}`} className="block w-full min-h-14 rounded-2xl bg-[#0F3D5E] text-white font-semibold leading-[3.5rem]">Ver mis propuestas</Link>
    <Big variant="ghost" onClick={onHome}>Volver al inicio</Big>
  </div>;
}

/** Página de seguimiento: propuestas recibidas y elección del abogado. */
export function Tracking({ code, token }: { code: string; token: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const load = () => api<any>(`/help/requests/${code}?token=${encodeURIComponent(token)}`, { noBusiness: true }).then((x) => { setD(x); setErr(''); }).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [code, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (p: any) => {
    if (!confirm(`¿Elegir la propuesta de ${p.lawyer.name}? Le compartiremos tu nombre y celular para que te contacte. Las demás propuestas se cerrarán.`)) return;
    setBusy(p.id);
    try { setD(await api(`/help/requests/${code}/choose`, { body: { token, proposalId: p.id }, noBusiness: true })); } catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  };
  const close = async () => {
    if (!confirm('¿Cerrar tu consulta? Ya no recibirás más propuestas.')) return;
    try { await api(`/help/requests/${code}/close`, { body: { token }, noBusiness: true }); load(); } catch (e) { setErr((e as Error).message); }
  };
  const chosen = d?.proposals?.find((p: any) => p.status === 'CHOSEN');
  const open = d?.status === 'OPEN';
  const waiting = open && new Date(d.deadlineAt) > new Date();
  return <>
    <Header onHome={() => { window.location.href = '/ayuda'; }} />
    <main className="max-w-xl mx-auto px-4 py-6 pb-16 space-y-4">
      {err && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</p>}
      {!d && !err && <p className="text-center py-10 text-[#13202B]/60">Cargando…</p>}
      {d && <>
        <div>
          <p className="text-xs uppercase font-semibold text-[#0F3D5E]/60">Consulta {d.code} · {d.topicLabel}</p>
          <h1 className="text-2xl font-bold text-[#0F3D5E] mt-1">{chosen ? `Elegiste a ${chosen.lawyer.name}` : d.status === 'CLOSED' ? 'Cerraste esta consulta' : `Hola ${d.name}, estas son tus propuestas`}</h1>
          {open && <p className="text-sm mt-1">{waiting ? <>Los abogados pueden enviar propuestas hasta el <b>{new Date(d.deadlineAt).toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</b>. Esta página se actualiza sola.</> : 'Ya terminó el plazo para recibir propuestas. Puedes elegir entre las que llegaron.'}</p>}
        </div>
        {chosen && <div className="rounded-2xl bg-emerald-600 text-white p-5 space-y-3">
          <p className="font-semibold">{chosen.lawyer.name} ya tiene tus datos y te contactará. También puedes escribirle:</p>
          <div className="grid gap-2">
            {chosen.lawyer.phone && <a className="rounded-xl bg-white text-emerald-700 font-semibold h-12 flex items-center justify-center gap-2" href={`https://wa.me/${String(chosen.lawyer.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, elegí su propuesta en ${HELP_BRAND.name} (consulta ${d.code}).`)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
            {chosen.lawyer.phone && <a className="rounded-xl bg-white/15 font-semibold h-12 flex items-center justify-center gap-2" href={`tel:${String(chosen.lawyer.phone).replace(/[^\d+]/g, '')}`}><Phone className="h-4 w-4" /> Llamar</a>}
          </div>
          <p className="text-xs text-white/80">Antes de pagar, pide que el acuerdo de honorarios quede por escrito.</p>
        </div>}
        {!d.proposals.length && open && <div className="rounded-2xl bg-white p-6 text-center"><Clock className="h-10 w-10 mx-auto text-[#0F3D5E]/40" /><p className="mt-2 font-semibold">Aún no llegan propuestas</p><p className="text-sm text-[#13202B]/60 mt-1">Te recomendamos volver a mirar en unas horas. Mientras tanto, revisa la orientación abajo.</p></div>}
        <div className="space-y-3">{d.proposals.map((p: any) => <div key={p.id} className={cls('rounded-2xl bg-white p-4 border-2', p.status === 'CHOSEN' ? 'border-emerald-500' : 'border-transparent', p.status === 'NOT_CHOSEN' && 'opacity-60')}>
          <div className="flex items-start gap-3">
            {p.lawyer.logoUrl ? <img src={p.lawyer.logoUrl} alt="" className="h-12 w-12 rounded-xl object-contain bg-[#F7F5F0]" /> : <span className="h-12 w-12 rounded-xl bg-[#0F3D5E] text-white flex items-center justify-center font-bold">{p.lawyer.name.slice(0, 1)}</span>}
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight flex items-center gap-1">{p.lawyer.name}{p.lawyer.verified && <BadgeCheck className="h-4 w-4 text-[#0F3D5E]" aria-label="Abogado verificado" />}</p>
              <p className="text-xs text-[#13202B]/60">{p.lawyer.firm}{p.lawyer.city ? ` · ${p.lawyer.city}` : ''}{p.lawyer.years ? ` · ${p.lawyer.years} años de experiencia` : ''}</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-[#F7F5F0] p-3"><p className="text-xs text-[#13202B]/60">Honorarios</p><p className="text-xl font-bold text-[#0F3D5E]">{money(p.feeAmount)}</p><p className="text-sm">{p.feeTerms}</p></div>
          <p className="text-sm mt-3"><b>Qué haría:</b> {p.plan}</p>
          <p className="text-sm mt-1"><b>Tiempo estimado:</b> {p.estimatedTime}</p>
          {p.experience && <p className="text-sm mt-1"><b>Experiencia:</b> {p.experience}</p>}
          {p.lawyer.bio && <p className="text-xs text-[#13202B]/60 mt-2">{p.lawyer.bio}</p>}
          {open && p.status === 'SENT' && <button type="button" disabled={!!busy} onClick={() => choose(p)} className="mt-4 w-full min-h-12 rounded-2xl bg-[#0F3D5E] text-white font-semibold">{busy === p.id ? 'Guardando…' : 'Elegir esta propuesta'}</button>}
        </div>)}</div>
        <p className="text-xs text-[#13202B]/60">Los abogados no pueden garantizar resultados. Compara la experiencia, lo que harían y los honorarios. No estás obligado a aceptar ninguna propuesta.</p>
        {d.orientation && <details className="rounded-2xl bg-white p-4"><summary className="font-semibold cursor-pointer">Ver de nuevo la orientación</summary><ul className="mt-3 space-y-2 text-sm">{d.orientation.routes.map((r: any, i: number) => <li key={i}><b>{r.title}:</b> {r.what}</li>)}</ul></details>}
        {open && <button type="button" onClick={close} className="w-full text-sm underline text-[#13202B]/60">Ya no necesito propuestas, cerrar mi consulta</button>}
      </>}
    </main>
  </>;
}
