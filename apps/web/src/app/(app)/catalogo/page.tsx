'use client';
import { Copy, Download, ExternalLink, FileSpreadsheet, FileText, Info, MessageCircle, RefreshCw, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Disclaimer, Field, PageHeader, Spinner, cn, useToast } from '@/components/ui';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { qs, useApi } from '@/lib/hooks';

const SOCIAL_URL: Record<string, (v: string) => string> = {
  instagram: (v) => `https://instagram.com/${v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}`,
  facebook: (v) => (v.startsWith('http') ? v : `https://facebook.com/${v.replace(/^@/, '')}`),
  tiktok: (v) => `https://www.tiktok.com/@${v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '')}`,
};

export default function CatalogPage() {
  const toast = useToast();
  const { current } = useAuth();
  const { data: lists } = useApi<any[]>('/wholesale/price-lists');
  const { data: cats } = useApi<any[]>('/categories');
  const { data: feed } = useApi<any>('/brochure/feed-info');
  const { data: store } = useApi<any>('/store-share/current');
  const { data: links } = useApi<Record<string, string>>('/social/links');
  const [o, setO] = useState({ priceListId: '', categoryId: '', hidePrices: false, layout: 'grid', title: '' });
  const [busy, setBusy] = useState('');
  const params = qs({ priceListId: o.priceListId, categoryId: o.categoryId, hidePrices: o.hidePrices ? 'true' : '', layout: o.layout, title: o.title.trim() });
  const name = `catalogo-${(current?.tradeName ?? 'negocio').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
  const run = async (k: string, fn: () => Promise<unknown>) => { setBusy(k); try { await fn(); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); } };
  const pdfBlob = async () => (await api<Response>(`/brochure/pdf${params}`, { raw: true })).blob();
  const sharePdf = () => run('share', async () => {
    const file = new File([await pdfBlob()], `${name}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Catálogo ${current?.tradeName}`, text: store?.url ? `Mira nuestro catálogo y pide aquí: ${store.url}` : undefined }).catch(() => null);
    else { download(`/brochure/pdf${params}`, `${name}.pdf`); toast('Tu navegador no permite compartir archivos: lo descargamos para que lo adjuntes.'); }
  });
  const waText = `¡Hola! Te comparto nuestro catálogo de ${current?.tradeName}.${store?.url ? ` También puedes ver los productos y pedir aquí: ${store.url}` : ''}`;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Copiado'); } catch { /* */ } };
  const linked = Object.entries(links ?? {}).filter(([k, v]) => v && SOCIAL_URL[k]);

  return <>
    <PageHeader title="Catálogo para compartir" subtitle="Crea en segundos tu catálogo en PDF, llévalo a Canva o sincronízalo con WhatsApp, Instagram y Facebook." />
    <div className="grid lg:grid-cols-3 gap-5">
      <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Catálogo en PDF</span>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Precios"><select className="input" value={o.priceListId} onChange={(e) => setO({ ...o, priceListId: e.target.value })}>
            <option value="">Precio al público</option>{(lists ?? []).filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>Lista «{l.name}»</option>)}</select></Field>
          <Field label="Categoría"><select className="input" value={o.categoryId} onChange={(e) => setO({ ...o, categoryId: e.target.value })}>
            <option value="">Todas</option>{(cats ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Título de la portada (opcional)"><input className="input" placeholder={o.priceListId ? 'Catálogo mayorista' : 'Catálogo'} value={o.title} maxLength={80} onChange={(e) => setO({ ...o, title: e.target.value })} /></Field>
          <Field label="Diseño"><div className="flex gap-2">{[['grid', 'Cuadrícula'], ['list', 'Lista']].map(([v, l]) => <button key={v} type="button" onClick={() => setO({ ...o, layout: v })} className={cn('flex-1 h-10 rounded-xl border text-sm', o.layout === v ? 'border-ink bg-ink text-white' : 'border-line')}>{l}</button>)}</div></Field>
        </div>
        <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" className="accent-ink" checked={o.hidePrices} onChange={(e) => setO({ ...o, hidePrices: e.target.checked })} /> Ocultar precios (solo fotos y nombres)</label>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-primary" disabled={!!busy} onClick={() => run('pdf', () => download(`/brochure/pdf${params}`, `${name}.pdf`))}>{busy === 'pdf' ? <Spinner /> : <Download className="h-4 w-4" />} Descargar PDF</button>
          <button className="btn-secondary" disabled={!!busy} onClick={sharePdf}>{busy === 'share' ? <Spinner /> : <Share2 className="h-4 w-4" />} Compartir PDF</button>
          <a className="btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Mensaje por WhatsApp</a>
        </div>
        <p className="text-xs text-ink-muted mt-2">Desde el celular, «Compartir PDF» abre WhatsApp, Instagram, correo y tus otras apps con el archivo listo. Los productos sin foto salen con la inicial de su nombre.</p>
      </Card>

      <Card title={<span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Diseñarlo en Canva</span>}>
        <ol className="text-sm space-y-1.5 list-decimal pl-4">
          <li>Descarga el Excel con tus productos (nombre, precio, descripción y foto).</li>
          <li>En Canva, abre una plantilla de catálogo y entra a <b>Apps → Crear en lote (Bulk Create)</b>.</li>
          <li>Sube el Excel, conecta cada campo con el texto o la imagen del diseño y pulsa «Generar».</li>
        </ol>
        <button className="btn-secondary mt-3 w-full" disabled={!!busy} onClick={() => run('canva', () => download(`/brochure/canva${params}`, `${name}-canva.xlsx`))}>{busy === 'canva' ? <Spinner /> : <Download className="h-4 w-4" />} Excel para Canva</button>
        <p className="text-xs text-ink-muted mt-2">«Crear en lote» puede requerir Canva Pro o Canva para Equipos, según tu cuenta.</p>
      </Card>

      <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Catálogo sincronizado con WhatsApp, Instagram y Facebook</span>}>
        {!feed ? <Spinner /> : !feed.url ? <p className="text-sm text-ink-muted">Primero publica tu página web en <Link className="underline" href="/mi-tienda">Mi página web</Link>: el catálogo sincronizado sale de ahí.</p> : <>
          <p className="text-sm text-ink-muted">Este enlace siempre tiene tus productos y precios actualizados. Meta lo revisa automáticamente (por ejemplo cada día) y actualiza el catálogo de tu WhatsApp Business, tu tienda de Instagram y Facebook.</p>
          <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-2"><div className="input font-mono text-xs flex items-center truncate">{feed.url}</div><button className="btn-secondary" onClick={() => copy(feed.url)}><Copy className="h-4 w-4" /> Copiar</button></div>
          {feed.local && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-2"><Info className="inline h-3.5 w-3.5" /> Estás usando DREAMS en tu computador: Meta solo puede leer este enlace cuando DREAMS esté publicado en internet con tu dominio.</p>}
          <ol className="text-sm space-y-1.5 list-decimal pl-4 mt-3">
            <li>Entra a <b>business.facebook.com</b> → <b>Administrador de ventas (Commerce Manager)</b> y crea un catálogo de «Comercio electrónico».</li>
            <li>Ve a <b>Catálogo → Fuentes de datos → Agregar artículos → Fuente de datos → Programada</b> y pega el enlace.</li>
            <li>Elige actualizar cada día y la moneda COP.</li>
            <li>Conecta ese catálogo a tu cuenta de WhatsApp Business y a tu tienda de Instagram/Facebook.</li>
          </ol>
          <p className="text-xs text-ink-muted mt-2">Meta exige que cada producto tenga foto: los que no tengan imagen no se envían.</p>
        </>}
      </Card>

      <Card title={<span className="flex items-center gap-2"><Share2 className="h-4 w-4" /> Tus redes</span>}>
        {!linked.length ? <p className="text-sm text-ink-muted">Agrega tus redes en <Link className="underline" href="/redes">Redes sociales</Link> para abrirlas desde aquí.</p> :
          <ul className="space-y-2">{linked.map(([k, v]) => <li key={k}><a className="btn-secondary w-full justify-between" href={SOCIAL_URL[k](v)} target="_blank" rel="noreferrer"><span className="capitalize">{k}</span><ExternalLink className="h-4 w-4" /></a></li>)}</ul>}
        <p className="text-xs text-ink-muted mt-3">Descarga el PDF o la imagen del catálogo y publícalo en tus historias o en tu perfil. Publicar automáticamente en Instagram o Facebook requiere que la app de DREAMS sea aprobada por Meta; mientras tanto se comparte desde tu celular.</p>
      </Card>
    </div>
    <div className="mt-5"><Disclaimer>Revisa precios y existencias antes de enviar el catálogo: los valores salen de tus productos en DREAMS en el momento de descargarlo.</Disclaimer></div>
  </>;
}
