'use client';
import { Check, EyeOff, Eye, FileSignature, Star, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default function AdminPage() {
  const toast = useToast();
  const { data: me } = useApi<any>('/growth/admin/me');
  const [tab, setTab] = useState<'testimonios' | 'resenas' | 'plantillas'>('testimonios');
  const { data: ts, error: e1, reload: r1 } = useApi<any[]>(me?.admin ? '/growth/admin/testimonials' : null);
  const { data: rv, error: e2, reload: r2 } = useApi<any[]>(me?.admin ? '/reviews/admin/reported' : null);
  if (!me) return <Loading />;
  if (!me.admin) return <Empty title="Solo para la administración de DREAMS" description="Tu correo no está en la lista de administradores (PLATFORM_ADMIN_EMAILS)." />;
  const setT = async (id: string, status: string) => { await api(`/growth/admin/testimonials/${id}`, { method: 'PUT', body: { status } }); toast(status === 'APPROVED' ? 'Publicado en la portada' : 'Actualizado'); r1(); };
  const setR = async (id: string, status: string) => { await api(`/reviews/admin/${id}`, { method: 'PATCH', body: { status } }); toast('Actualizado'); r2(); };
  return <>
    <PageHeader title="Administración DREAMS" subtitle="Opiniones para la portada, reseñas reportadas y biblioteca de plantillas." />
    <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'testimonios', label: 'Testimonios' }, { value: 'resenas', label: 'Reseñas reportadas' }, { value: 'plantillas', label: 'Plantillas jurídicas' }]} /></div>
    {tab === 'testimonios' && <Card>
      {e1 ? <ErrorBox message={e1} /> : !ts ? <Loading /> : !ts.length ? <p className="text-sm text-ink-muted">Aún no llegan opiniones. Los negocios pueden dejarla desde su tablero cuando completan la guía de arranque.</p> :
        <ul className="divide-y divide-line">{ts.map((t) => <li key={t.id} className="py-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[#D9A441]">{stars(t.rating)}</span><b className="text-sm">{t.authorName}</b><span className="text-xs text-ink-muted">{t.businessName}{t.city ? ` · ${t.city}` : ''}</span>
            <Badge tone={t.status === 'APPROVED' ? 'ok' : t.status === 'REJECTED' ? 'bad' : 'warn'}>{t.status === 'APPROVED' ? 'Publicado' : t.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}</Badge></div>
          <p className="text-sm mt-1">{t.body}</p>
          <div className="flex gap-1 mt-2">
            {t.status !== 'APPROVED' && <button className="btn-primary btn-sm" onClick={() => setT(t.id, 'APPROVED')}><Check className="h-3.5 w-3.5" /> Publicar</button>}
            {t.status !== 'REJECTED' && <button className="btn-ghost btn-sm" onClick={() => setT(t.id, 'REJECTED')}><X className="h-3.5 w-3.5" /> {t.status === 'APPROVED' ? 'Retirar' : 'Rechazar'}</button>}
          </div>
        </li>)}</ul>}
      <p className="text-xs text-ink-muted mt-3">Solo se publican opiniones reales con autorización expresa del autor. Si alguien pide retirarla, usa «Retirar».</p>
    </Card>}
    {tab === 'resenas' && <Card>
      {e2 ? <ErrorBox message={e2} /> : !rv ? <Loading /> : !rv.length ? <p className="text-sm text-ink-muted">No hay reseñas reportadas.</p> :
        <ul className="divide-y divide-line">{rv.map((r) => <li key={r.id} className="py-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[#D9A441]">{stars(r.rating)}</span><b className="text-sm">{r.authorName}</b>
            <Link className="text-xs underline" href={`/negocios/${r.slug}`} target="_blank">{r.business}</Link><Badge tone={r.status === 'HIDDEN' ? 'muted' : 'warn'}>{r.status === 'HIDDEN' ? 'Oculta' : 'Reportada'}</Badge></div>
          {r.body && <p className="text-sm mt-1">{r.body}</p>}
          {r.reportReason && <p className="text-xs text-ink-muted mt-1">Motivo del negocio: {r.reportReason}</p>}
          <div className="flex gap-1 mt-2">
            {r.status !== 'HIDDEN' ? <button className="btn-secondary btn-sm" onClick={() => setR(r.id, 'HIDDEN')}><EyeOff className="h-3.5 w-3.5" /> Ocultar</button>
              : <button className="btn-ghost btn-sm" onClick={() => setR(r.id, 'PUBLISHED')}><Eye className="h-3.5 w-3.5" /> Volver a mostrar</button>}
            {r.status === 'REPORTED' && <button className="btn-ghost btn-sm" onClick={() => setR(r.id, 'PUBLISHED')}><Star className="h-3.5 w-3.5" /> Mantener publicada</button>}
          </div>
        </li>)}</ul>}
    </Card>}
    {tab === 'plantillas' && <Card>
      <p className="text-sm">Para cargar la biblioteca de plantillas para <b>todos</b> los abogados: entra a <Link className="underline" href="/plantillas">Plantillas y documentos</Link> con un negocio de abogados, pulsa <b>Importar</b>, pega el JSON y marca «Cargarlas para todos los abogados de DREAMS».</p>
      <Link className="btn-primary mt-3" href="/plantillas"><FileSignature className="h-4 w-4" /> Ir a plantillas</Link>
    </Card>}
  </>;
}
