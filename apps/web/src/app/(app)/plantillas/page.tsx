'use client';
import { FileSignature, FileUp, Pencil, Plus, Search, Trash2, Wand2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { DocPreview, DocumentModal, GenerateModal } from '@/components/legal-docs';
import { Badge, Card, Disclaimer, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { qs, useApi, useDebounced } from '@/lib/hooks';

const EMPTY = { area: 'general', category: '', title: '', description: '', body: '', legalBasis: '', keywords: '' };

function Editor({ initial, areas, onClose, onSaved }: { initial: any; areas: Record<string, string>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    const body = { area: f.area, category: f.category, title: f.title, description: f.description || undefined, body: f.body, legalBasis: f.legalBasis || undefined,
      keywords: String(f.keywords ?? '').split(',').map((k: string) => k.trim()).filter(Boolean) };
    try { f.id ? await api(`/legal/templates/${f.id}`, { method: 'PUT', body }) : await api('/legal/templates', { body }); onSaved(); onClose(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} wide title={f.id ? (f.mine ? 'Editar plantilla' : 'Crear mi versión de esta plantilla') : 'Nueva plantilla'}
    footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />} Guardar</button></>}>
    {err && <ErrorBox message={err} />}
    <div className="grid sm:grid-cols-3 gap-3">
      <Field label="Área"><select className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>{Object.entries(areas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Categoría"><input className="input" placeholder="Ej. Tutela, Poder, Contrato" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
      <Field label="Título"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Descripción" className="sm:col-span-3"><input className="input" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Texto de la plantilla" className="sm:col-span-3" hint="Usa {{cliente_nombre}}, {{radicado}}, {{despacho}}… para los datos que se llenan solos, o inventa los tuyos: {{valor}}, {{hechos}}. # Título · ## Subtítulo · **negrita**">
        <textarea className="input min-h-[280px] font-mono text-xs" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      <Field label="Fundamento legal" className="sm:col-span-2"><input className="input" value={f.legalBasis ?? ''} onChange={(e) => setF({ ...f, legalBasis: e.target.value })} /></Field>
      <Field label="Palabras clave (separadas por coma)"><input className="input" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></Field>
    </div>
  </Modal>;
}

function ImportModal({ onClose, onDone, admin }: { onClose: () => void; onDone: () => void; admin: boolean }) {
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'MINE' | 'GLOBAL'>('MINE');
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); };
  const run = async () => {
    setErr(null); setRes(null);
    let parsed: any;
    try { parsed = JSON.parse(text.trim().replace(/^```(json)?/, '').replace(/```$/, '')); } catch { setErr('El texto no es un JSON válido. Copia solo el bloque JSON que entregó la IA.'); return; }
    const templates = Array.isArray(parsed) ? parsed : parsed.templates ?? parsed.plantillas;
    if (!Array.isArray(templates)) { setErr('No encontré la lista «templates».'); return; }
    setBusy(true);
    try {
      let created = 0, updated = 0; const errors: string[] = [];
      for (let i = 0; i < templates.length; i += 40) {
        const r = await api<any>('/legal/templates/import', { body: { templates: templates.slice(i, i + 40), scope } });
        created += r.created; updated += r.updated; errors.push(...r.errors);
      }
      setRes({ created, updated, errors }); onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} wide title="Importar plantillas (JSON)"
    footer={<><button className="btn-ghost" onClick={onClose}>Cerrar</button><button className="btn-primary" disabled={busy || !text.trim()} onClick={run}>{busy && <Spinner />}<FileUp className="h-4 w-4" /> Importar</button></>}>
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Pega el JSON con las plantillas (por ejemplo, el que te entregue tu asistente jurídico) o súbelo como archivo. Si una plantilla trae el mismo «code» de una existente, se actualiza.</p>
      {err && <ErrorBox message={err} />}
      {res && <p className="text-sm rounded-xl bg-emerald-50 text-emerald-900 px-3 py-2">{res.created} nuevas · {res.updated} actualizadas{res.errors.length ? ` · ${res.errors.length} con error: ${res.errors.slice(0, 3).join(' | ')}` : ''}</p>}
      <input type="file" accept="application/json,.json,.txt" onChange={file} className="text-sm" />
      <textarea className="input min-h-[220px] font-mono text-xs" placeholder='{"templates":[{"code":"...","area":"civil","category":"...","title":"...","body":"..."}]}' value={text} onChange={(e) => setText(e.target.value)} />
      {admin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={scope === 'GLOBAL'} onChange={(e) => setScope(e.target.checked ? 'GLOBAL' : 'MINE')} /> Cargarlas para <b>todos los abogados</b> de DREAMS (administración)</label>}
    </div>
  </Modal>;
}

function Library() {
  const toast = useToast();
  const params = useSearchParams();
  const jobId = params.get('caso') ?? undefined;
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any>(`/legal/templates${qs({ area, q: dq.trim() })}`);
  const { data: admin } = useApi<any>('/growth/admin/me');
  const [view, setView] = useState<any>(null);
  const [edit, setEdit] = useState<any>(null);
  const [gen, setGen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const openView = async (id: string) => setView(await api(`/legal/templates/${id}`));
  const remove = async (t: any) => { if (!confirm(`¿Eliminar «${t.title}»?`)) return; try { await api(`/legal/templates/${t.id}`, { method: 'DELETE' }); reload(); } catch (e) { toast((e as Error).message, 'bad'); } };
  if (error) return <ErrorBox message={error} />;
  const groups = new Map<string, any[]>();
  for (const t of data?.items ?? []) { const k = t.area; groups.set(k, [...(groups.get(k) ?? []), t]); }
  return <>
    <PageHeader title="Plantillas y documentos" subtitle="Borradores de poderes, tutelas, peticiones, contratos y memoriales que se llenan con los datos de tus casos."
      actions={<><button className="btn-secondary" onClick={() => setImporting(true)}><FileUp className="h-4 w-4" /> Importar</button><button className="btn-primary" onClick={() => setEdit({ ...EMPTY })}><Plus className="h-4 w-4" /> Nueva plantilla</button></>} />
    {jobId && <p className="text-sm mb-3 rounded-xl bg-sand-50 border border-sand-200 px-3 py-2">Los documentos que generes se guardarán en el caso que venías viendo.</p>}
    <Card>
      <div className="flex flex-wrap gap-2 mb-3">
        <label className="flex items-center gap-2 input max-w-sm flex-1"><Search className="h-4 w-4 text-ink-muted" /><input className="flex-1 bg-transparent outline-none" placeholder="Buscar: poder, tutela, desistimiento…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="input w-auto" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Todas las áreas</option>
          {data && Object.entries(data.areas as Record<string, string>).filter(([k]) => data.counts[k]).map(([k, v]) => <option key={k} value={k}>{v} ({data.counts[k]})</option>)}
        </select>
      </div>
      {loading && !data ? <Loading /> : !data.items.length ? <Empty icon={<FileSignature className="h-6 w-6" />} title="Sin plantillas" description="Crea la tuya o importa una biblioteca en formato JSON." /> :
        [...groups.entries()].map(([k, list]) => <div key={k} className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">{data.areas[k] ?? k}</h3>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{list.map((t) => <li key={t.id} className="rounded-xl border border-line p-3 flex flex-col">
            <button className="text-left flex-1" onClick={() => openView(t.id)}>
              <span className="block font-medium text-sm">{t.title}</span>
              <span className="block text-xs text-ink-muted">{t.category}{t.mine ? ' · propia' : t.source === 'SYSTEM' ? ' · DREAMS (borrador)' : ''}</span>
              {t.description && <span className="block text-xs text-ink-muted mt-1 line-clamp-2">{t.description}</span>}
            </button>
            <div className="flex gap-1 mt-2">
              <button className="btn-primary btn-sm" onClick={() => setGen(t.id)}><Wand2 className="h-3.5 w-3.5" /> Usar</button>
              <button className="btn-ghost btn-sm" onClick={async () => { const full = await api<any>(`/legal/templates/${t.id}`); setEdit({ ...full, keywords: full.keywords.join(', ') }); }}><Pencil className="h-3.5 w-3.5" /> {t.mine ? 'Editar' : 'Personalizar'}</button>
              {(t.mine || admin?.admin) && <button className="btn-ghost btn-sm text-bad" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          </li>)}</ul>
        </div>)}
      <Disclaimer>Las plantillas son borradores de apoyo y no reemplazan el criterio profesional. Verifica la norma vigente y adapta cada documento al caso antes de usarlo.</Disclaimer>
    </Card>
    {view && <Modal open onClose={() => setView(null)} wide title={view.title} footer={<button className="btn-primary" onClick={() => { setGen(view.id); setView(null); }}><Wand2 className="h-4 w-4" /> Usar esta plantilla</button>}>
      <div className="flex flex-wrap gap-2 mb-2"><Badge tone="sand">{data.areas[view.area] ?? view.area}</Badge><Badge tone="muted">{view.category}</Badge></div>
      {view.legalBasis && <p className="text-xs bg-sand-50 rounded-lg px-3 py-2 mb-2"><b>Fundamento:</b> {view.legalBasis}</p>}
      <DocPreview body={view.body} />
    </Modal>}
    {edit && <Editor initial={edit} areas={data?.areas ?? {}} onClose={() => setEdit(null)} onSaved={reload} />}
    {gen && <GenerateModal templateId={gen} jobId={jobId} onClose={() => setGen(null)} onSaved={(id) => setDoc(id)} />}
    {doc && <DocumentModal id={doc} onClose={() => setDoc(null)} />}
    {importing && <ImportModal admin={!!admin?.admin} onClose={() => setImporting(false)} onDone={reload} />}
  </>;
}

export default function TemplatesPage() { return <Suspense fallback={<Loading />}><Library /></Suspense>; }
