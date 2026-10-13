'use client';
import { Download, FileSignature, FileText, Lightbulb, Pencil, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Card, Disclaimer, ErrorBox, Field, Loading, Modal, Spinner, cn, useToast } from './ui';

export const AREA_LABEL = (areas: Record<string, string> | undefined, a: string) => areas?.[a] ?? a;
const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'documento';

/** Vista previa sencilla del formato (# título, ## subtítulo, **negrita**). */
export function DocPreview({ body }: { body: string }) {
  return <div className="bg-white rounded-xl border border-line p-6 text-[13px] leading-relaxed max-h-[55vh] overflow-auto font-serif">
    {body.split(/\n{2,}/).map((p, i) => {
      const parts = (txt: string) => txt.split(/(\*\*.+?\*\*)/g).map((x, k) => /^\*\*.+\*\*$/.test(x) ? <b key={k}>{x.slice(2, -2)}</b> : <span key={k}>{x}</span>);
      if (p.startsWith('# ')) return <p key={i} className="text-center font-bold mb-3">{parts(p.slice(2))}</p>;
      if (p.startsWith('## ')) return <p key={i} className="font-bold mb-3">{parts(p.slice(3))}</p>;
      return <p key={i} className="mb-3 text-justify whitespace-pre-line">{parts(p)}</p>;
    })}
  </div>;
}

/** Llenar una plantilla con los datos del caso y guardar el documento. */
export function GenerateModal({ templateId, jobId, onClose, onSaved }: { templateId: string; jobId?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'fill' | 'review'>('fill');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const render = async (v = values) => {
    try { const x = await api<any>(`/legal/templates/${templateId}/render`, { body: { jobId, values: v } }); setR(x); setTitle((t) => t || x.title); return x; }
    catch (e) { setErr((e as Error).message); return null; }
  };
  useEffect(() => { render({}); }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps
  const toReview = async () => { const x = await render(); if (x) { setBody(x.body); setStep('review'); } };
  const save = async () => {
    setBusy(true);
    try { const d = await api<{ id: string }>('/legal/documents', { body: { jobId, templateId, title: title.trim() || r.title, body } }); toast('Documento guardado en el caso'); onSaved?.(d.id); onClose(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} wide title={r ? r.title : 'Plantilla'}
    footer={step === 'fill'
      ? <><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={toReview} disabled={!r}><Wand2 className="h-4 w-4" /> Generar borrador</button></>
      : <><button className="btn-ghost" onClick={() => setStep('fill')}>Volver a los datos</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}<Save className="h-4 w-4" /> Guardar documento</button></>}>
    {err && <ErrorBox message={err} />}
    {!r ? <Loading /> : step === 'fill' ? <div className="space-y-3">
      <p className="text-sm text-ink-muted">Los datos en gris ya los tomamos del caso, del cliente y de tu perfil. Completa o corrige lo que falte; lo que dejes vacío quedará como «________» para llenarlo después.</p>
      {r.legalBasis && <p className="text-xs bg-sand-50 rounded-lg px-3 py-2"><b>Fundamento:</b> {r.legalBasis}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {r.fields.map((f: any) => {
          const long = /hechos|pretensiones|peticiones|pruebas|anexos|solicitud|objeto|fundamentos|argumentos|descripcion/.test(f.key);
          const v = values[f.key] ?? f.value ?? '';
          return <Field key={f.key} label={f.label} hint={f.help ?? (f.auto && f.value ? 'Llenado automáticamente' : undefined)} className={long ? 'sm:col-span-2' : ''}>
            {long ? <textarea className="input min-h-[90px]" value={v} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              : <input className={cn('input', f.auto && !values[f.key] && f.value && 'text-ink-muted')} value={v} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
          </Field>;
        })}
      </div>
    </div> : <div className="space-y-3">
      <Field label="Nombre del documento"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Texto (puedes editarlo)" hint="# Título · ## Subtítulo · **negrita** · deja una línea en blanco entre párrafos"><textarea className="input min-h-[260px] font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <details><summary className="text-sm cursor-pointer text-ink-muted">Ver cómo queda</summary><div className="mt-2"><DocPreview body={body} /></div></details>
      <Disclaimer>Este es un borrador de apoyo. Revísalo y ajústalo a tu caso antes de firmarlo o radicarlo: el abogado responde por su contenido.</Disclaimer>
    </div>}
  </Modal>;
}

/** Ver o editar un documento guardado y descargarlo en Word o PDF. */
export function DocumentModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const toast = useToast();
  const { data, error } = useApi<any>(`/legal/documents/${id}`);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<{ title: string; body: string } | null>(null);
  useEffect(() => { if (data) setF({ title: data.title, body: data.body }); }, [data]);
  const save = async () => { await api(`/legal/documents/${id}`, { method: 'PUT', body: { ...f, jobId: data.jobId ?? undefined } }); toast('Guardado'); setEdit(false); onChanged?.(); };
  const remove = async () => { if (!confirm('¿Eliminar este documento?')) return; await api(`/legal/documents/${id}`, { method: 'DELETE' }); onChanged?.(); onClose(); };
  return <Modal open onClose={onClose} wide title={data?.title ?? 'Documento'}
    footer={<>
      <button className="btn-ghost text-bad mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /> Eliminar</button>
      {edit ? <button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> Guardar</button> : <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Editar</button>}
      <button className="btn-secondary" onClick={() => download(`/legal/documents/${id}/word`, `${slug(data?.title ?? '')}.doc`)}><Download className="h-4 w-4" /> Word</button>
      <button className="btn-primary" onClick={() => download(`/legal/documents/${id}/pdf`, `${slug(data?.title ?? '')}.pdf`)}><Download className="h-4 w-4" /> PDF</button>
    </>}>
    {error ? <ErrorBox message={error} /> : !f ? <Loading /> : edit ? <div className="space-y-3">
      <Field label="Nombre"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <textarea className="input min-h-[320px] font-mono text-xs" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
    </div> : <DocPreview body={f.body} />}
  </Modal>;
}

/** Tarjeta del caso: plantillas sugeridas y documentos generados. */
export function JobDocuments({ jobId }: { jobId: string }) {
  const { data: sug } = useApi<any>(`/legal/templates/suggest/${jobId}`);
  const { data: docs, reload } = useApi<any[]>(`/legal/documents?jobId=${jobId}`);
  const [gen, setGen] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  return <Card title={<span className="flex items-center gap-2"><FileSignature className="h-4 w-4" /> Documentos y plantillas</span>}
    actions={<Link href={`/plantillas?caso=${jobId}`} className="btn-ghost btn-sm no-print"><Plus className="h-4 w-4" /> Ver biblioteca</Link>}>
    {docs && docs.length > 0 && <ul className="divide-y divide-line mb-3">{docs.map((d) => <li key={d.id}>
      <button className="w-full text-left py-2 flex items-center gap-2 hover:bg-sand-50 rounded-lg px-2 -mx-2" onClick={() => setOpen(d.id)}>
        <FileText className="h-4 w-4 text-ink-muted" /><span className="flex-1 truncate text-sm font-medium">{d.title}</span>
        <span className="text-xs text-ink-muted">{new Date(d.updatedAt).toLocaleDateString('es-CO')}</span>
      </button></li>)}</ul>}
    <p className="text-xs font-medium text-ink-muted flex items-center gap-1 mb-2"><Lightbulb className="h-3.5 w-3.5" /> Sugeridas para este caso</p>
    {!sug ? <Loading /> : !sug.items.length ? <p className="text-sm text-ink-muted">No encontramos plantillas para este caso. Revisa la <Link href="/plantillas" className="underline">biblioteca</Link>.</p>
      : <div className="flex flex-wrap gap-2">{sug.items.slice(0, 6).map((t: any) => <button key={t.id} className="text-left rounded-xl border border-line px-3 py-2 hover:border-ink/40 max-w-xs" onClick={() => setGen(t.id)} title={t.reasons.join(' · ')}>
        <span className="block text-sm font-medium">{t.title}</span><span className="block text-[11px] text-ink-muted">{t.category}</span>
      </button>)}</div>}
    {gen && <GenerateModal templateId={gen} jobId={jobId} onClose={() => setGen(null)} onSaved={(id) => { reload(); setOpen(id); }} />}
    {open && <DocumentModal id={open} onClose={() => setOpen(null)} onChanged={reload} />}
  </Card>;
}

