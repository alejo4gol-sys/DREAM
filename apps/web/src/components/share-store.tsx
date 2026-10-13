'use client';
import { AlertTriangle, Check, Copy, Download, ExternalLink, Facebook, Instagram, Mail, MessageCircle, Printer, QrCode, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Card, Loading, Spinner, cn, useToast } from './ui';

type Share = { name: string; slug: string | null; enabled: boolean; url: string | null; local: boolean; directoryUrl: string; inDirectory: boolean; headline: string; city: string | null };

/** Panel «Comparte tu página»: enlace, redes, código QR y afiche imprimible. */
export function SharePanel({ reloadKey = 0 }: { reloadKey?: number }) {
  const toast = useToast();
  const { data: s, reload } = useApi<Share>('/store-share/current');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { reload(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!s?.url) return;
    let url: string | null = null;
    api<Response>('/store-share/current/qr?format=png', { raw: true }).then((r) => r.blob()).then((b) => { url = URL.createObjectURL(b); setQr(url); }).catch(() => setQr(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [s?.url]);
  if (!s) return <Loading />;
  if (!s.slug || !s.url) return <Card><p className="text-sm text-ink-muted">Primero elige la dirección de tu página en «Enlace y SEO» y guárdala.</p></Card>;

  const text = `Mira ${s.name}${s.headline ? ` — ${s.headline}` : ''}. Haz tu pedido aquí: ${s.url}`;
  const mark = () => { api('/growth/onboarding/mark', { body: { step: 'shared' } }).catch(() => null); };
  const copy = (what: string, value: string) => navigator.clipboard?.writeText(value).then(() => { mark(); setCopied(what); setTimeout(() => setCopied(''), 1500); toast('Copiado'); }).catch(() => undefined);
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); } };
  const printPoster = () => run('print', async () => {
    const r = await api<Response>('/store-share/current/qr?format=poster', { raw: true });
    const svg = await r.text();
    const w = window.open('', '_blank');
    if (!w) throw new Error('Permite las ventanas emergentes para imprimir el afiche.');
    w.document.write(`<!doctype html><html><head><title>Afiche ${s.name}</title><style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}svg{width:100%;height:auto;display:block}</style></head><body>${svg.replace(/^<\?xml[^>]*>/, '')}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  });
  const btn = 'inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-line bg-white px-3 text-sm font-medium hover:bg-sand-50';

  return <div className="space-y-4">
    {!s.enabled && <div className="rounded-xl bg-amber-50 text-amber-900 p-3 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />Tu página aún no está publicada: quien abra el enlace verá «tienda no disponible». Publícala con el botón de arriba.</div>}
    {s.local && <div className="rounded-xl bg-sand-100 p-3 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warn" /><span>DREAMS está funcionando en este computador, por eso el enlace empieza por <b>localhost</b> y solo sirve aquí. Cuando DREAMS se publique en internet, el enlace y el código QR se actualizan solos con el dominio real; no tendrás que cambiar nada.</span></div>}

    <Card title={<span className="flex items-center gap-2"><Store className="h-4 w-4" /> Tu enlace</span>}>
      <div className="flex items-center gap-2 rounded-xl bg-sand-50 border border-line p-3">
        <span className="truncate flex-1 font-mono text-sm">{s.url}</span>
        <button type="button" className="btn-secondary btn-sm" onClick={() => copy('url', s.url!)}>{copied === 'url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar</button>
        <a className="btn-ghost btn-sm" href={s.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <a className={cn(btn, 'text-emerald-700')} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" onClick={mark}><MessageCircle className="h-4 w-4" /> WhatsApp</a>
        <a className={cn(btn, 'text-[#1877F2]')} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(s.url)}`} target="_blank" rel="noreferrer" onClick={mark}><Facebook className="h-4 w-4" /> Facebook</a>
        <button type="button" className={cn(btn, 'text-[#C13584]')} onClick={() => copy('ig', s.url!)}><Instagram className="h-4 w-4" /> {copied === 'ig' ? 'Copiado' : 'Instagram'}</button>
        <a className={btn} href={`mailto:?subject=${encodeURIComponent(s.name)}&body=${encodeURIComponent(text)}`}><Mail className="h-4 w-4" /> Correo</a>
      </div>
      <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs text-ink-muted">
        <p><b className="text-ink">WhatsApp Business:</b> ponlo en Ajustes → Herramientas para la empresa → Perfil → Sitio web, y en tus estados.</p>
        <p><b className="text-ink">Instagram y TikTok:</b> pega el enlace en «Editar perfil → Enlaces» para que aparezca en tu biografía.</p>
        <p><b className="text-ink">Google:</b> agrégalo como sitio web en tu Perfil de Empresa de Google (Google Maps).</p>
      </div>
      <div className="mt-4 rounded-xl border border-line p-3">
        <p className="text-sm font-medium">Mensaje listo para enviar</p>
        <p className="text-sm text-ink-muted mt-1">{text}</p>
        <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => copy('text', text)}>{copied === 'text' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar mensaje</button>
      </div>
    </Card>

    <Card title={<span className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Código QR para tu local</span>}>
      <div className="grid sm:grid-cols-[180px_1fr] gap-4 items-center">
        <div className="rounded-2xl border border-line bg-white p-3 aspect-square flex items-center justify-center">{qr ? <img src={qr} alt={`Código QR de ${s.name}`} className="w-full h-full" /> : <Spinner />}</div>
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">Quien lo escanee con la cámara del celular abre tu página. Imprímelo en el mostrador, la vitrina, tus tarjetas, bolsas, volantes o el menú.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-sm" disabled={!!busy} onClick={() => run('png', () => { mark(); return download('/store-share/current/qr?format=png', `qr-${s.slug}.png`); })}>{busy === 'png' ? <Spinner /> : <Download className="h-4 w-4" />} Descargar QR</button>
            <button type="button" className="btn-secondary btn-sm" disabled={!!busy} onClick={() => run('svg', () => download('/store-share/current/qr?format=poster', `afiche-${s.slug}.svg`))}>{busy === 'svg' ? <Spinner /> : <Download className="h-4 w-4" />} Descargar afiche</button>
            <button type="button" className="btn-secondary btn-sm" disabled={!!busy} onClick={printPoster}>{busy === 'print' ? <Spinner /> : <Printer className="h-4 w-4" />} Imprimir afiche</button>
          </div>
          <p className="text-[11px] text-ink-muted">El afiche (tamaño carta/A4) lleva el nombre de tu negocio, el QR y la dirección de tu página.</p>
        </div>
      </div>
    </Card>

    <Card title="Directorio «Negocios en DREAMS»">
      <p className="text-sm text-ink-muted">{s.inDirectory ? 'Tu página aparece en el directorio público, donde las personas buscan negocios por nombre, ciudad y tipo.' : 'Tu página no aparece en el directorio. Puedes activarlo en «Enlace y SEO».'}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <a className="btn-secondary btn-sm" href="/negocios" target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver el directorio</a>
        {s.inDirectory && <a className="btn-secondary btn-sm" href={`/negocios/${s.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver mi ficha (mapa y reseñas)</a>}
      </div>
      <p className="text-[11px] text-ink-muted mt-2">Tu ficha muestra tu dirección con mapa y el botón «Cómo llegar», y las reseñas de tus clientes. Puedes ocultar el mapa en «Enlace y SEO».</p>
    </Card>
  </div>;
}
