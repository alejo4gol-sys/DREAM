'use client';
import {
  ArrowUpRight, Clipboard, Download, ExternalLink, FileVideo2, ImagePlus, Megaphone,
  Package, Play, Save, Sparkles, Upload, WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, Disclaimer, Empty, ErrorBox, Field, Loading, PageHeader, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { CampaignResults } from '@/components/campaign-results';

type Platform = { id: string; name: string; label: string; description: string; url: string; color: string; icon: string };
type Draft = { id: string; title: string; productName: string; platforms: string[]; format: string; goal: string; cta: string; headline: string; body: string; assetUrl: string; createdAt: string; campaignName?: string; trackingUrl?: string };
const PLATFORMS: Platform[] = [
  { id: 'meta', name: 'Meta Ads', label: 'Facebook · Instagram · WhatsApp', description: 'Promociona en Facebook e Instagram y dirige las conversaciones a WhatsApp.', url: 'https://adsmanager.facebook.com/', color: '#1877F2', icon: 'f' },
  { id: 'google', name: 'Google Ads', label: 'Google · YouTube', description: 'Anuncios en búsquedas, sitios asociados y YouTube.', url: 'https://ads.google.com/intl/es_co/home/', color: '#4285F4', icon: 'G' },
  { id: 'tiktok', name: 'TikTok Ads', label: 'TikTok', description: 'Ideal para piezas verticales de video y descubrimiento.', url: 'https://ads.tiktok.com/', color: '#111111', icon: '♪' },
  { id: 'linkedin', name: 'LinkedIn Ads', label: 'LinkedIn', description: 'Para servicios y productos dirigidos a profesionales o empresas.', url: 'https://www.linkedin.com/campaignmanager/', color: '#0A66C2', icon: 'in' },
  { id: 'pinterest', name: 'Pinterest Ads', label: 'Pinterest', description: 'Promociona ideas y productos visuales.', url: 'https://ads.pinterest.com/', color: '#BD081C', icon: 'P' },
  { id: 'snapchat', name: 'Snapchat Ads', label: 'Snapchat', description: 'Anuncios visuales en formato vertical.', url: 'https://ads.snapchat.com/', color: '#111111', icon: '👻' },
  { id: 'x', name: 'X Ads', label: 'X', description: 'Promociona contenido y ofertas en X.', url: 'https://ads.x.com/', color: '#111111', icon: '𝕏' },
  { id: 'mercadolibre', name: 'Mercado Ads', label: 'Mercado Libre', description: 'Publicidad para productos publicados en el marketplace.', url: 'https://ads.mercadolibre.com.co/', color: '#FFE600', icon: 'M' },
  { id: 'reddit', name: 'Reddit Ads', label: 'Reddit', description: 'Campañas por intereses y comunidades.', url: 'https://ads.reddit.com/', color: '#FF4500', icon: 'r' },
];
const FORMATS = [
  { id: 'square', label: 'Cuadrado', size: '1080 × 1080', width: 1080, height: 1080 },
  { id: 'story', label: 'Historia / Reel', size: '1080 × 1920', width: 1080, height: 1920 },
  { id: 'landscape', label: 'Horizontal', size: '1200 × 628', width: 1200, height: 628 },
];
const KEY = (businessId: string) => `dream.ads.${businessId}`;
const ACCOUNT_KEY = (businessId: string) => `dream.ads.accounts.${businessId}`;

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/); let line = ''; let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight); lines++; line = word;
      if (lines >= maxLines) break;
    } else line = test;
  }
  if (lines < maxLines && line) ctx.fillText(line, x, y + lines * lineHeight);
}

export default function AdvertisingPage() {
  const { current, can } = useAuth();
  const toast = useToast();
  const { data: productData, loading: productsLoading, error: productsError, reload } = useApi<any>('/products?pageSize=200');
  const { data: storeData } = useApi<any>('/store/current');
  const products = productData?.items ?? [];
  const canUpload = can('social:manage');
  const [platforms, setPlatforms] = useState<string[]>(['meta']);
  const [productId, setProductId] = useState('');
  const [format, setFormat] = useState('square');
  const [goal, setGoal] = useState('sales');
  const [cta, setCta] = useState('Comprar');
  const [headline, setHeadline] = useState('');
  const [copy, setCopy] = useState('');
  const [destination, setDestination] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [trackingPlatform, setTrackingPlatform] = useState('meta');
  const [asset, setAsset] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Draft[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const product = products.find((p: any) => p.id === productId);
  const selectedPlatforms = PLATFORMS.filter((p) => platforms.includes(p.id));
  const chosenFormat = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const trackedUrl = useMemo(() => {
    if (!destination.trim()) return '';
    try {
      const url = new URL(destination.trim());
      const source = trackingPlatform === 'meta' ? 'meta' : trackingPlatform;
      url.searchParams.set('utm_source', source);
      url.searchParams.set('utm_medium', ['google', 'mercadolibre'].includes(source) ? 'paid_search' : 'paid_social');
      url.searchParams.set('utm_campaign', campaignName.trim() || headline.trim() || 'campana-dreams');
      url.searchParams.set('utm_content', product?.id || 'pieza-general');
      return url.toString();
    } catch { return destination.trim(); }
  }, [destination, trackingPlatform, campaignName, headline, product?.id]);

  useEffect(() => {
    if (!current?.businessId) return;
    try {
      const drafts = localStorage.getItem(KEY(current.businessId));
      const accounts = localStorage.getItem(ACCOUNT_KEY(current.businessId));
      setSaved(drafts ? JSON.parse(drafts) : []);
      setAccountNames(accounts ? JSON.parse(accounts) : {});
    } catch { setSaved([]); setAccountNames({}); }
  }, [current?.businessId]);

  const selectProduct = (id: string) => {
    setProductId(id);
    const p = products.find((item: any) => item.id === id);
    if (p) {
      setHeadline(p.name);
      setCampaignName(`${p.name} · ${new Date().toLocaleDateString('es-CO')}`);
      setCopy(`${p.name}${p.salePrice ? ` por ${money(p.salePrice)}` : ''}. Escríbenos y te ayudamos a elegir el tuyo.`);
      setDestination(typeof window !== 'undefined' && storeData?.slug ? `${window.location.origin}/tienda/${storeData.slug}` : '');
      setAsset(p.imageUrl ? { url: p.imageUrl, type: 'image', name: p.name } : null);
    } else { setAsset(null); setHeadline(''); setCopy(''); }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) { toast('El archivo debe pesar máximo 80 MB', 'bad'); return; }
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      const result = await api<{ url: string; type: string }>('/uploads/creative', { form });
      setAsset({ url: result.url, type: result.type.startsWith('video/') ? 'video' : 'image', name: file.name });
      toast('Pieza cargada');
    } catch (e) { toast((e as Error).message, 'bad'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const adText = useMemo(() => [copy.trim(), headline.trim() ? `Conoce ${headline.trim()} en ${trackedUrl || 'nuestra tienda'}.` : '', '#NegocioLocal #CompraLocal'].filter(Boolean).join('\n\n'), [copy, headline, trackedUrl]);
  const saveDraft = () => {
    if (!headline.trim() || !copy.trim()) { toast('Agrega un título y un texto para el anuncio', 'bad'); return; }
    const draft: Draft = {
      id: crypto.randomUUID(), title: headline.trim(), productName: product?.name ?? 'Anuncio personalizado', campaignName: campaignName.trim(), trackingUrl: trackedUrl,
      platforms, format, goal, cta, headline: headline.trim(), body: copy.trim(), assetUrl: asset?.url ?? '', createdAt: new Date().toISOString(),
    };
    setSaved((items) => {
      const next = [draft, ...items].slice(0, 30);
      if (current?.businessId) localStorage.setItem(KEY(current.businessId), JSON.stringify(next));
      return next;
    });
    toast('Borrador guardado en este dispositivo');
  };
  const copyText = async () => {
    try { await navigator.clipboard.writeText(adText); toast('Texto publicitario copiado'); }
    catch { toast('No se pudo copiar. Selecciona el texto y cópialo manualmente.', 'bad'); }
  };
  const copyTrackingLink = async () => {
    if (!trackedUrl) { toast('Agrega primero un enlace web válido', 'bad'); return; }
    try { await navigator.clipboard.writeText(trackedUrl); toast('Enlace con seguimiento copiado'); }
    catch { toast('No se pudo copiar el enlace', 'bad'); }
  };
  const downloadAsset = async () => {
    if (!asset) { toast('Carga una imagen o video primero', 'bad'); return; }
    if (asset.type === 'video') {
      const a = document.createElement('a'); a.href = asset.url; a.download = asset.name; a.target = '_blank'; a.rel = 'noopener'; a.click(); return;
    }
    setBusy(true);
    try {
      const canvas = document.createElement('canvas'); canvas.width = chosenFormat.width; canvas.height = chosenFormat.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo crear la imagen');
      const { width, height } = canvas;
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#f8f3eb'); gradient.addColorStop(1, '#dfd0b8');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      const image = new Image(); image.crossOrigin = 'anonymous';
      const src = asset.url.startsWith('http') ? asset.url : `${window.location.origin}${asset.url}`;
      try {
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('No se pudo cargar la foto')); image.src = src; });
        const imageHeight = format === 'story' ? height * .58 : format === 'landscape' ? height : height * .58;
        const imageWidth = format === 'landscape' ? width * .52 : width;
        const scale = Math.max(imageWidth / image.width, imageHeight / image.height);
        const drawWidth = image.width * scale; const drawHeight = image.height * scale;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, imageWidth, imageHeight); ctx.clip();
        ctx.drawImage(image, (imageWidth - drawWidth) / 2, (imageHeight - drawHeight) / 2, drawWidth, drawHeight); ctx.restore();
      } catch { /* El diseño de texto también sirve si la foto ya no está disponible. */ }
      ctx.fillStyle = 'rgba(23,23,23,.88)';
      if (format === 'landscape') ctx.fillRect(width * .52, 0, width * .48, height);
      else ctx.fillRect(0, height * .58, width, height * .42);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
      const left = format === 'landscape' ? width * .57 : width * .08;
      const textWidth = format === 'landscape' ? width * .36 : width * .84;
      const top = format === 'landscape' ? height * .13 : height * .64;
      ctx.font = '600 30px Arial'; ctx.fillText((current?.tradeName ?? 'DREAMS').slice(0, 34).toUpperCase(), left, top);
      ctx.font = `700 ${format === 'story' ? 64 : 52}px Arial`;
      wrapText(ctx, headline || product?.name || 'Descubre algo especial', left, top + 54, textWidth, format === 'story' ? 74 : 62, 3);
      ctx.font = '400 28px Arial'; wrapText(ctx, copy || 'Encuentra tu favorito.', left, top + 250, textWidth, 38, 3);
      if (product?.salePrice) { ctx.font = '700 40px Arial'; ctx.fillText(money(product.salePrice), left, height - 170); }
      ctx.fillStyle = '#e9cfa7'; ctx.fillRect(left, height - 112, Math.min(textWidth, 340), 50);
      ctx.fillStyle = '#171717'; ctx.font = '700 24px Arial'; ctx.fillText(cta.toUpperCase(), left + 18, height - 99);
      await new Promise<void>((resolve, reject) => canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('No se pudo exportar la imagen')); return; }
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `dream-anuncio-${format}.png`; a.click(); URL.revokeObjectURL(url); resolve();
      }, 'image/png'));
      toast('Imagen publicitaria descargada');
    } catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };

  if (productsLoading && !productData) return <Loading />;

  return (
    <>
      <PageHeader title="Publicidad" subtitle="Crea piezas para tus productos y llévalas al administrador de anuncios de cada plataforma." />
      {productsError && <div className="mb-5"><ErrorBox message={productsError} onRetry={reload} /></div>}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="space-y-5">
          <Card title={<span className="flex items-center gap-2"><WandSparkles className="h-4 w-4" /> Creador de anuncios</span>} actions={<Badge tone="sand">Borrador gratis</Badge>}>
            <p className="text-xs text-ink-muted mb-4">Elige un producto, ajusta el mensaje y prepara una imagen o video para subir en tu cuenta publicitaria.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Producto del catálogo">
                <select className="input" value={productId} onChange={(e) => selectProduct(e.target.value)}>
                  <option value="">Anuncio sin producto</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {money(p.salePrice)}</option>)}
                </select>
              </Field>
              <Field label="Formato de la pieza">
                <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
                  {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.size}</option>)}
                </select>
              </Field>
              <Field label="Objetivo de la campaña"><select className="input" value={goal} onChange={(e) => setGoal(e.target.value)}><option value="sales">Conseguir ventas</option><option value="messages">Recibir mensajes</option><option value="traffic">Llevar visitas a mi tienda</option><option value="awareness">Dar a conocer mi negocio</option></select></Field>
              <Field label="Botón del anuncio"><select className="input" value={cta} onChange={(e) => setCta(e.target.value)}><option>Comprar</option><option>Más información</option><option>Enviar mensaje</option><option>Ver productos</option><option>Reservar</option></select></Field>
              <Field label="Título del anuncio"><input className="input" maxLength={80} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Ej. Tu próximo favorito" /></Field>
              <Field label="Nombre de campaña"><input className="input" maxLength={160} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ej. Día de la madre · mayo" /></Field>
              <Field label="Enlace de destino"><input className="input" type="url" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="https://tu-tienda.com/producto" /></Field>
              <Field label="Red que llevará este enlace"><select className="input" value={trackingPlatform} onChange={(e) => setTrackingPlatform(e.target.value)}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <div className="sm:col-span-2 rounded-xl bg-sand-50 border border-line p-3"><p className="text-xs font-medium">Enlace medible para pegar en el anuncio</p><p className="mt-1 text-[11px] text-ink-muted break-all">{trackedUrl || 'Agrega un enlace de destino para generarlo.'}</p><button type="button" className="btn-secondary btn-sm mt-2" disabled={!trackedUrl} onClick={() => void copyTrackingLink()}><Clipboard className="h-3.5 w-3.5" /> Copiar enlace medible</button><p className="mt-2 text-[11px] text-ink-faint">Cuando se complete un pedido usando este enlace, DREAMS guardará la red y campaña junto al pedido.</p></div>
              <Field label="Texto para publicar" className="sm:col-span-2"><textarea className="input min-h-24" maxLength={500} value={copy} onChange={(e) => setCopy(e.target.value)} placeholder="Cuenta en pocas palabras por qué elegir este producto…" /></Field>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-line p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-sand-100 flex items-center justify-center overflow-hidden shrink-0">
                {asset?.type === 'video' ? <FileVideo2 className="h-6 w-6 text-sand-600" /> : asset?.url ? <img src={asset.url} alt="Pieza seleccionada" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-sand-500" />}
              </div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{asset?.name ?? 'Imagen o video de la campaña'}</p><p className="text-xs text-ink-muted">PNG, JPG, WEBP, MP4, MOV o WEBM · máximo 80 MB</p></div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
              <button className="btn-secondary btn-sm" disabled={!canUpload || uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Spinner /> : <Upload className="h-4 w-4" />} {uploading ? 'Cargando…' : 'Subir imagen o video'}</button>
              {product?.imageUrl && <button className="btn-ghost btn-sm" onClick={() => setAsset({ url: product.imageUrl, type: 'image', name: product.name })}>Usar foto del producto</button>}
            </div>
            {!canUpload && <p className="text-[11px] text-warn mt-2">Tu rol puede crear borradores, pero necesita permiso de redes sociales para subir archivos.</p>}
            {asset?.type === 'video' && <video className="mt-4 w-full max-h-80 rounded-xl bg-black" controls src={asset.url} />}

            <div className="mt-5">
              <p className="label mb-2">¿Dónde quieres anunciar?</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <label key={p.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${platforms.includes(p.id) ? 'border-ink bg-sand-50' : 'border-line hover:bg-sand-50'}`}>
                    <input type="checkbox" className="accent-ink mt-1" checked={platforms.includes(p.id)} onChange={(e) => setPlatforms((old) => e.target.checked ? [...old, p.id] : old.filter((x) => x !== p.id))} />
                    <span className="h-8 w-8 rounded-lg flex items-center justify-center font-bold shrink-0" style={{ background: p.color, color: p.id === 'mercadolibre' ? '#222' : '#fff' }}>{p.icon}</span>
                    <span className="min-w-0"><span className="block text-sm font-medium">{p.name}</span><span className="block text-[11px] text-ink-muted">{p.label}</span></span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              <button className="btn-primary" onClick={saveDraft}><Save className="h-4 w-4" /> Guardar borrador</button>
              <button className="btn-secondary" onClick={copyText}><Clipboard className="h-4 w-4" /> Copiar texto</button>
              <button className="btn-secondary" disabled={busy || !asset} onClick={() => void downloadAsset()}>{busy ? <Spinner /> : asset?.type === 'video' ? <Download className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {asset?.type === 'video' ? 'Descargar video' : 'Crear y descargar imagen'}</button>
            </div>
          </Card>

          <Card title="Cuentas para publicar">
            <p className="text-xs text-ink-muted mb-4">Guarda una referencia para recordar qué cuenta usarás. Los botones te llevan al administrador oficial, donde inicias sesión y subes la pieza descargada.</p>
            <div className="space-y-3">
              {selectedPlatforms.length === 0 && <p className="text-sm text-ink-muted">Selecciona una red en el creador para ver sus opciones.</p>}
              {selectedPlatforms.map((p) => (
                <div key={p.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-medium">{p.name}</p><p className="text-[11px] text-ink-muted">{p.description}</p></div>
                    {accountNames[p.id] && <Badge tone="muted">Referencia guardada</Badge>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input className="input !py-2 text-xs" maxLength={100} value={accountNames[p.id] ?? ''} onChange={(e) => {
                      const next = { ...accountNames, [p.id]: e.target.value };
                      setAccountNames(next);
                      if (current?.businessId) localStorage.setItem(ACCOUNT_KEY(current.businessId), JSON.stringify(next));
                    }} placeholder="Nombre o ID de la cuenta publicitaria" aria-label={`Referencia de cuenta para ${p.name}`} />
                    <a className="btn-secondary btn-sm shrink-0" href={p.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir</a>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4"><Disclaimer>La apertura de la plataforma no conecta una API con DREAMS ni publica automáticamente. Cada negocio conserva el control de sus cuentas, presupuesto y revisión final del anuncio.</Disclaimer></div>
          </Card>

          <Card title="Tus borradores" actions={<span className="text-xs text-ink-muted">{saved.length} guardados</span>}>
            {saved.length === 0 ? <Empty icon={<Megaphone className="h-5 w-5" />} title="Aún no guardas anuncios" description="Guarda una pieza para volver a usarla cuando quieras." /> : (
              <div className="divide-y divide-line">
                {saved.map((d) => (
                  <div key={d.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="h-11 w-11 rounded-xl bg-sand-100 flex items-center justify-center shrink-0">{d.assetUrl ? <img src={d.assetUrl} alt="" className="h-full w-full object-cover rounded-xl" /> : <Package className="h-5 w-5 text-sand-500" />}</span>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{d.title}</p><p className="text-xs text-ink-muted truncate">{d.productName} · {d.platforms.map((id) => PLATFORMS.find((p) => p.id === id)?.name ?? id).join(', ') || 'sin red elegida'}</p></div>
                    <button className="btn-ghost btn-sm" onClick={() => { setHeadline(d.headline); setCampaignName(d.campaignName ?? ''); setDestination(d.trackingUrl ? (() => { try { const u = new URL(d.trackingUrl); ['utm_source','utm_medium','utm_campaign','utm_content'].forEach((k) => u.searchParams.delete(k)); return u.toString(); } catch { return d.trackingUrl ?? ''; } })() : ''); setCopy(d.body); setPlatforms(d.platforms); setFormat(d.format); setGoal(d.goal ?? 'sales'); setCta(d.cta ?? 'Comprar'); setProductId(''); setAsset(d.assetUrl ? { url: d.assetUrl, type: /\.(mp4|mov|webm)(\?|$)/i.test(d.assetUrl) ? 'video' : 'image', name: d.title } : null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Play className="h-3.5 w-3.5" /> Abrir</button>
                    <button className="btn-ghost btn-sm text-bad" onClick={() => setSaved((old) => {
                      const next = old.filter((x) => x.id !== d.id);
                      if (current?.businessId) localStorage.setItem(KEY(current.businessId), JSON.stringify(next));
                      return next;
                    })} aria-label={`Eliminar borrador ${d.title}`}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {can('business:manage') && <CampaignResults />}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-20">
          <Card title="Vista previa">
            <div className="rounded-2xl border border-line bg-[#f7f4ef] p-3">
              <div className="mx-auto max-w-[250px] rounded-2xl overflow-hidden bg-white shadow-card">
                {asset?.type === 'video' ? <video className="w-full aspect-[9/16] object-cover bg-black" controls src={asset.url} /> :
                  asset?.url ? <img src={asset.url} alt="Vista previa del anuncio" className={`w-full object-cover ${format === 'story' ? 'aspect-[9/16]' : format === 'landscape' ? 'aspect-video' : 'aspect-square'}`} /> :
                    <div className={`w-full bg-gradient-to-br from-[#f8f3eb] to-[#dfd0b8] flex items-center justify-center ${format === 'story' ? 'aspect-[9/16]' : format === 'landscape' ? 'aspect-video' : 'aspect-square'}`}><ImagePlus className="h-8 w-8 text-sand-500" /></div>}
                <div className="p-3"><p className="font-semibold text-sm line-clamp-2">{headline || 'Título de tu anuncio'}</p><p className="text-xs text-ink-muted mt-1 line-clamp-3">{copy || 'Aquí verás el texto que acompañará tu pieza.'}</p>{product?.salePrice && <p className="text-sm font-semibold mt-2">{money(product.salePrice)}</p>}<span className="mt-3 inline-flex rounded-lg bg-primary text-on-primary text-[11px] px-3 py-2">{cta}</span></div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted"><span>{chosenFormat.label}</span><span>{chosenFormat.size}px</span></div>
            <p className="mt-3 text-[11px] text-ink-faint">El diseño descargado incluye el producto, el título y el precio. Revisa las medidas que pide cada plataforma antes de publicar.</p>
          </Card>
          <Card title="Texto listo para copiar">
            <div className="rounded-xl bg-sand-50 border border-line p-3 text-xs whitespace-pre-wrap leading-relaxed">{adText || 'El texto aparecerá aquí.'}</div>
            <button className="btn-secondary btn-sm mt-3 w-full" onClick={copyText}><Clipboard className="h-4 w-4" /> Copiar texto publicitario</button>
          </Card>
          <div className="rounded-2xl bg-primary text-on-primary p-5">
            <p className="text-sm font-semibold flex items-center gap-2"><ArrowUpRight className="h-4 w-4" /> Publicar en pocos pasos</p>
            <ol className="mt-3 space-y-2 text-xs text-on-primary/75 list-decimal pl-4">
              <li>Elige producto y formato.</li><li>Descarga imagen/video y copia el texto.</li><li>Abre el administrador oficial.</li><li>Sube la pieza, define el público y presupuesto, y confirma allá.</li>
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
