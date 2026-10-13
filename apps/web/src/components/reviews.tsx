'use client';
import { ExternalLink, Flag, MessageSquareReply, Star } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, Spinner, cn, useToast } from './ui';

export function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return <span className="inline-flex" aria-label={`${value} de 5 estrellas`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn(size, n <= Math.round(value) ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#D8D2C6]')} />)}</span>;
}

/** Panel del negocio: ver reseñas, responder y reportar. */
export function ReviewsPanel() {
  const toast = useToast();
  const { data, error, reload } = useApi<any>('/reviews');
  const [reply, setReply] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const send = async () => {
    setBusy(true);
    try {
      if (reply) await api(`/reviews/${reply.id}/reply`, { body: { reply: text } });
      else await api(`/reviews/${report.id}/report`, { body: { reason: text } });
      toast(reply ? 'Respuesta publicada' : 'Reporte enviado a DREAMS'); setReply(null); setReport(null); reload();
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  return <Card title={<span className="flex items-center gap-2"><Star className="h-4 w-4" /> Reseñas de tus clientes</span>}
    actions={data.profileUrl && <a className="btn-ghost btn-sm" href={data.profileUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver mi ficha</a>}>
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <div><p className="text-3xl font-semibold">{data.avg ? data.avg.toFixed(1) : '—'}</p><Stars value={data.avg} /></div>
      <p className="text-sm text-ink-muted">{data.total} reseña{data.total === 1 ? '' : 's'} · {data.pendingReply} sin responder</p>
    </div>
    <p className="text-xs text-ink-muted mb-3">Cualquier persona puede calificarte desde tu ficha en el directorio. Responde con amabilidad: tus respuestas son públicas. Si una reseña es falsa u ofensiva, repórtala y la administración de DREAMS la revisará.</p>
    {!data.items.length ? <Empty icon={<Star className="h-6 w-6" />} title="Aún no tienes reseñas" description="Comparte tu ficha con tus clientes y pídeles que te califiquen." /> :
      <ul className="divide-y divide-line">{data.items.map((r: any) => <li key={r.id} className="py-3">
        <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} /><b className="text-sm">{r.authorName}</b><span className="text-xs text-ink-muted">{new Date(r.createdAt).toLocaleDateString('es-CO')}</span>
          {r.status === 'REPORTED' && <Badge tone="warn">Reportada</Badge>}{r.status === 'HIDDEN' && <Badge tone="muted">Oculta por DREAMS</Badge>}</div>
        {r.body && <p className="text-sm mt-1">{r.body}</p>}
        {r.reply && <p className="text-sm mt-2 border-l-2 border-sand-300 pl-3 text-ink-muted"><b className="text-ink">Tu respuesta:</b> {r.reply}</p>}
        <div className="flex gap-1 mt-2">
          <button className="btn-ghost btn-sm" onClick={() => { setText(r.reply ?? ''); setReply(r); }}><MessageSquareReply className="h-3.5 w-3.5" /> {r.reply ? 'Editar respuesta' : 'Responder'}</button>
          {r.status === 'PUBLISHED' && <button className="btn-ghost btn-sm" onClick={() => { setText(''); setReport(r); }}><Flag className="h-3.5 w-3.5" /> Reportar</button>}
        </div>
      </li>)}</ul>}
    {(reply || report) && <Modal open onClose={() => { setReply(null); setReport(null); }} title={reply ? `Responder a ${reply.authorName}` : 'Reportar reseña'}
      footer={<button className="btn-primary" disabled={busy || (!!report && text.trim().length < 5)} onClick={send}>{busy && <Spinner />} {reply ? 'Publicar respuesta' : 'Enviar reporte'}</button>}>
      <Field label={reply ? 'Tu respuesta (pública)' : '¿Por qué la reportas?'} hint={report ? 'Ej. no es cliente, lenguaje ofensivo, datos personales, spam.' : undefined}>
        <textarea className="input min-h-[100px]" maxLength={reply ? 1000 : 300} value={text} onChange={(e) => setText(e.target.value)} /></Field>
    </Modal>}
  </Card>;
}
