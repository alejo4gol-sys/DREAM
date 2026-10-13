'use client';
import { ArrowUp, BookOpen, Bot, Check, Copy, MessageCircle, Pencil, Plus, Sparkles, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Card, Disclaimer, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Tabs, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relative } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const BUSINESS_SUGGESTIONS = [
  '¿Cuánto vendí este mes?', '¿Cuál fue mi producto más vendido?', '¿Cuál es mi margen de utilidad?', '¿Qué productos están próximos a agotarse?',
  '¿Qué clientes compran más?', '¿Qué canal genera más ventas?', '¿Cuánto necesito vender para alcanzar 15 millones?', '¿Cuánto cuesta el envío?',
];
const CUSTOMER_SUGGESTIONS = [
  'Un cliente pregunta cómo se usa el servicio', '¿Qué cuidados hay que tener después?', '¿Cómo puedo pagar?', '¿Hacen envíos a otra ciudad?',
  '¿Puedo devolver un producto?', '¿Cuál es el horario de atención?',
];
const CATEGORIES: Record<string, string> = {
  SERVICE_USE: 'Uso de un servicio', PRODUCT_CARE: 'Cuidados y uso de un producto', FAQ: 'Pregunta frecuente', WARRANTY: 'Garantía',
  SHIPPING: 'Envíos y entregas', PAYMENTS: 'Pagos', RETURNS: 'Cambios y devoluciones', SCHEDULE: 'Horarios y citas', GENERAL: 'General',
};
const TEMPLATES = [
  { category: 'SERVICE_USE', title: 'Cómo funciona [nombre del servicio]', content: 'Qué incluye:\n- \n\nCómo prepararse antes:\n- \n\nCuánto dura:\n\nCuidados después:\n- \n\nPara quién NO se recomienda:\n- ' },
  { category: 'PRODUCT_CARE', title: 'Cómo usar y cuidar [producto]', content: 'Modo de uso paso a paso:\n1. \n2. \n\nCuidados:\n- \n\nQué no hacer:\n- ' },
  { category: 'WARRANTY', title: 'Garantía', content: 'Duración de la garantía:\nQué cubre:\nQué no cubre:\nCómo solicitarla:' },
  { category: 'FAQ', title: '', content: '' },
];

type Msg = { role: 'user' | 'assistant'; text: string; suggestions?: string[]; engine?: string; sources?: string[]; mode?: 'business' | 'customer' };
type Entry = { id: string; title: string; content: string; category: string; productId: string | null; updatedAt: string };

export default function AssistantPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'chat' | 'knowledge'>('chat');
  const [mode, setMode] = useState<'business' | 'customer'>('business');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const { data: status, reload: reloadStatus } = useApi<{ aiEnabled: boolean; model: string | null; knowledgeCount: number }>('/assistant/status');
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = msgs.filter((m) => m.mode === mode).slice(-8).map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
    setMsgs((m) => [...m, { role: 'user', text: question, mode }]);
    setQ(''); setBusy(true);
    try {
      const r = await api<{ answer: string; intent: string; data?: any; engine?: string; sources?: string[] }>('/assistant/ask', { body: { question, mode, history: status?.aiEnabled ? history : undefined }, timeoutMs: 60000 });
      setMsgs((m) => [...m, { role: 'assistant', text: r.answer, mode, engine: r.engine, sources: r.sources, suggestions: r.intent === 'unknown' && Array.isArray(r.data) ? r.data : undefined }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: (e as Error).message, mode }]);
    } finally { setBusy(false); }
  };
  const copy = (i: number, text: string) => navigator.clipboard?.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1500); });
  const suggestions = mode === 'business' ? BUSINESS_SUGGESTIONS : CUSTOMER_SUGGESTIONS;

  return (
    <>
      <PageHeader title="Asistente de Negocio" subtitle="Pregúntale lo que necesites: cifras de tu negocio, cómo funcionan tus servicios o qué responderle a un cliente."
        actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'chat', label: 'Preguntar' }, { value: 'knowledge', label: `Lo que sabe tu asistente${status ? ` (${status.knowledgeCount})` : ''}` }]} />} />
      {status && <div className={cn('mb-4 rounded-xl border px-4 py-3 text-xs flex items-start gap-2', status.aiEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-line bg-sand-50 text-ink-muted')}>
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
        {status.aiEnabled ? <span><b>IA completa activa.</b> Entiende preguntas abiertas y conversación, usando solo la información de tu negocio.</span>
          : <span><b>Modo sin conexión a IA:</b> responde con cálculos exactos de tus datos y con lo que le enseñes en «Lo que sabe tu asistente». Para respuestas abiertas en lenguaje natural se conecta una clave de Anthropic (tiene costo por uso); pídele a tu asistente técnico que la agregue en el archivo .env como ANTHROPIC_API_KEY.</span>}
      </div>}

      {tab === 'chat' ? <>
        <div className="mb-3 inline-flex rounded-xl bg-sand-100 p-1 gap-1">{([['business', 'Sobre mi negocio', Bot], ['customer', 'Respuesta para un cliente', UserRound]] as const).map(([k, l, Icon]) =>
          <button key={k} type="button" onClick={() => setMode(k)} className={cn('px-3 h-8 rounded-lg text-xs font-medium inline-flex items-center gap-1.5', mode === k ? 'bg-white shadow-card text-ink' : 'text-ink-muted')}><Icon className="h-3.5 w-3.5" />{l}</button>)}</div>
        <div className="card flex flex-col h-[calc(100vh-320px)] min-h-[460px]">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {msgs.filter((m) => m.mode === mode).length === 0 && (
              <div className="max-w-2xl mx-auto text-center pt-6">
                <div className="h-12 w-12 rounded-2xl bg-primary text-on-primary/70 mx-auto flex items-center justify-center">{mode === 'business' ? <Sparkles className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}</div>
                <p className="font-display text-2xl font-semibold mt-4">{mode === 'business' ? '¿Qué quieres saber hoy?' : '¿Qué te preguntó tu cliente?'}</p>
                <p className="text-sm text-ink-muted mt-2">{mode === 'business' ? 'Ventas, gastos, inventario, clientes, tus servicios y políticas.' : 'Escribe la pregunta del cliente y te preparo una respuesta lista para copiar o enviar por WhatsApp.'}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => <button key={s} className="chip bg-sand-100 hover:bg-sand-200 text-ink text-xs px-3 py-1.5" onClick={() => ask(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => m.mode !== mode ? null : (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && <span className="h-8 w-8 rounded-lg bg-primary text-on-primary/70 flex items-center justify-center shrink-0"><Bot className="h-4 w-4" /></span>}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-on-primary rounded-br-md' : 'bg-sand-100 text-ink rounded-bl-md'}`}>
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.suggestions && <div className="mt-3 flex flex-wrap gap-1.5">{m.suggestions.map((s) => <button key={s} className="chip bg-white hover:bg-sand-50 text-ink" onClick={() => ask(s)}>{s}</button>)}</div>}
                  {m.role === 'assistant' && (m.engine || m.sources?.length) && <div className="mt-3 pt-2 border-t border-line/70 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                    {m.engine && <Badge tone={m.engine === 'ia' ? 'ok' : 'muted'}>{m.engine === 'ia' ? 'IA' : m.engine === 'datos' ? 'Cálculo con tus datos' : 'Tu base de conocimiento'}</Badge>}
                    {m.sources?.length ? <span>Fuentes: {m.sources.join(' · ')}</span> : null}
                  </div>}
                  {m.role === 'assistant' && <div className="mt-2 flex gap-2">
                    <button className="btn-ghost btn-sm !h-7" onClick={() => copy(i, m.text)}>{copied === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar</button>
                    {m.mode === 'customer' && <a className="btn-ghost btn-sm !h-7" href={`https://wa.me/?text=${encodeURIComponent(m.text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp</a>}
                  </div>}
                </div>
              </div>
            ))}
            {busy && <div className="flex gap-3"><span className="h-8 w-8 rounded-lg bg-primary text-on-primary/70 flex items-center justify-center"><Spinner /></span></div>}
            <div ref={end} />
          </div>
          <form className="border-t border-line p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <textarea rows={1} className="input min-h-11 py-2.5 resize-none" placeholder={mode === 'business' ? 'Ej. ¿Cómo le explico a un cliente los cuidados después del tratamiento?' : 'Pega aquí la pregunta del cliente…'} value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q); } }} maxLength={1500} />
            <button className="btn-primary h-11 w-11 !px-0 shrink-0" disabled={!q.trim() || busy} aria-label="Preguntar"><ArrowUp className="h-4 w-4" /></button>
          </form>
        </div>
        <div className="mt-4"><Disclaimer>El asistente solo usa los datos del negocio activo y respeta los permisos de tu rol. Revisa las respuestas antes de enviarlas a un cliente. Las cifras financieras son estimaciones gerenciales y no reemplazan a un contador.</Disclaimer></div>
      </> : <Knowledge canEdit={can('products:write')} onChange={reloadStatus} toast={toast} />}
    </>
  );
}

function Knowledge({ canEdit, onChange, toast }: { canEdit: boolean; onChange: () => void; toast: (m: string, t?: any) => void }) {
  const { data, error, reload } = useApi<Entry[]>('/assistant/knowledge');
  const { data: prod } = useApi<any>('/products?pageSize=200');
  const [form, setForm] = useState<{ id?: string; title: string; content: string; category: string; productId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!form) return;
    setBusy(true); setErr('');
    try {
      const body = { title: form.title, content: form.content, category: form.category, productId: form.productId || null };
      await api(form.id ? `/assistant/knowledge/${form.id}` : '/assistant/knowledge', { method: form.id ? 'PATCH' : 'POST', body });
      setForm(null); await reload(); onChange(); toast('Guardado: tu asistente ya lo sabe');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (e: Entry) => { try { await api(`/assistant/knowledge/${e.id}`, { method: 'DELETE' }); await reload(); onChange(); } catch (x) { toast((x as Error).message, 'bad'); } };
  return <>
    <Card title={<span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Enséñale a tu asistente</span>}
      actions={canEdit && <button className="btn-primary btn-sm" onClick={() => { setErr(''); setForm({ title: '', content: '', category: 'SERVICE_USE', productId: '' }); }}><Plus className="h-4 w-4" /> Nueva guía</button>}>
      <p className="text-sm text-ink-muted">Escribe cómo funcionan tus servicios, cómo se usan y cuidan tus productos, garantías y las preguntas que más te hacen. El asistente también usa automáticamente tus productos y servicios (descripción, precio, opciones y agenda), las preguntas frecuentes y políticas de tu página web, envíos, medios de pago y horario.</p>
      {canEdit && <div className="flex flex-wrap gap-2 mt-3">{TEMPLATES.map((t) => <button key={t.category} className="btn-secondary btn-sm" onClick={() => { setErr(''); setForm({ ...t, productId: '' }); }}><Plus className="h-3.5 w-3.5" /> {CATEGORIES[t.category]}</button>)}</div>}
    </Card>
    {error && <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div>}
    <div className="mt-4 space-y-3">{data && !data.length ? <Card><Empty title="Aún no hay guías" description="Empieza por tu servicio o producto más consultado." /></Card>
      : data?.map((e) => <Card key={e.id}><div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0"><p className="font-medium text-sm">{e.title} <Badge tone="sand">{CATEGORIES[e.category] ?? e.category}</Badge></p><p className="text-sm text-ink-muted mt-1 whitespace-pre-line line-clamp-4">{e.content}</p><p className="text-[11px] text-ink-faint mt-1">Actualizada {relative(e.updatedAt)}</p></div>
        {canEdit && <><button className="btn-ghost !px-2" onClick={() => { setErr(''); setForm({ id: e.id, title: e.title, content: e.content, category: e.category, productId: e.productId ?? '' }); }} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
          <button className="btn-ghost !px-2 text-bad" onClick={() => remove(e)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button></>}
      </div></Card>)}</div>
    <Modal open={Boolean(form)} onClose={() => setForm(null)} wide title={form?.id ? 'Editar guía' : 'Nueva guía'}
      footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={busy || !form?.title.trim() || !form?.content.trim()} onClick={save}>{busy && <Spinner />} Guardar</button></>}>
      {form && <div className="grid sm:grid-cols-2 gap-3">
        {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
        <Field label="Título" className="sm:col-span-2"><input className="input" maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Cómo prepararse para la limpieza facial" /></Field>
        <Field label="Tipo"><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Producto o servicio relacionado (opcional)"><select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">Ninguno</option>{(prod?.items ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Contenido" className="sm:col-span-2" hint={`${form.content.length}/8000 · Escribe como se lo explicarías a un cliente. Incluye pasos, tiempos, cuidados y advertencias.`}><textarea className="input min-h-56" maxLength={8000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
      </div>}
    </Modal>
  </>;
}
