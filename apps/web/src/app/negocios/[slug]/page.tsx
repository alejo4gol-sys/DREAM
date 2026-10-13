'use client';
import { ArrowLeft, ArrowRight, ExternalLink, MapPin, MessageCircle, Navigation, Phone, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui';
import { api } from '@/lib/api';

const hex = (v: string | null, d: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return <span className="inline-flex" aria-label={`${value} de 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#D8D2C6]'}`} />)}</span>;
}

/** Ficha pública de un negocio del directorio: datos, mapa, «Cómo llegar» y reseñas. */
export default function BusinessProfile({ params }: { params: { slug: string } }) {
  const [b, setB] = useState<any>(null);
  const [rv, setRv] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ authorName: '', rating: 0, body: '', website: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  useEffect(() => { api(`/reviews/public/${params.slug}/profile`, { noBusiness: true }).then(setB).catch((e) => setErr((e as Error).message)); }, [params.slug]);
  useEffect(() => { api(`/reviews/public/${params.slug}?page=${page}`, { noBusiness: true }).then(setRv).catch(() => null); }, [params.slug, page, sent]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setFormErr('');
    try { await api(`/reviews/public/${params.slug}`, { body: { ...f, body: f.body.trim() || undefined, website: f.website || undefined }, noBusiness: true }); setSent(true); setPage(1); }
    catch (x) { setFormErr((x as Error).message); } finally { setBusy(false); }
  };
  if (err) return <div className="max-w-xl mx-auto px-4 py-20 text-center"><p className="font-semibold">Este negocio no está disponible.</p><Link className="underline text-sm mt-2 inline-block" href="/negocios">Ver el directorio</Link></div>;
  if (!b) return <p className="text-center py-20 text-[#6B645A]">Cargando…</p>;
  const p = hex(b.primary, '#111111'); const a = hex(b.accent, '#B69C72');
  const btn = 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full text-sm font-semibold';
  return <>
    <header className="sticky top-0 z-30 bg-[#FBF9F5]/90 backdrop-blur border-b border-[#EDE4D3]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/negocios" className="inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="h-4 w-4" /> Directorio</Link>
        <Link href="/" aria-label="DREAMS"><Logo /></Link>
      </div>
    </header>
    <section style={{ background: `linear-gradient(120deg, ${p}, ${a})` }} className="text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-5 sm:items-center">
        <span className="h-20 w-20 rounded-3xl bg-white overflow-hidden flex items-center justify-center font-display text-3xl font-semibold shrink-0" style={{ color: p }}>{b.logoUrl ? <img src={b.logoUrl} alt="" className="h-full w-full object-contain" /> : b.name.slice(0, 1)}</span>
        <div className="flex-1">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">{b.name}</h1>
          <p className="text-white/80 text-sm mt-1">{[b.category || b.businessType, b.city].filter(Boolean).join(' · ')}</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm">{b.rating.count ? <><Stars value={b.rating.avg} /><b>{b.rating.avg.toFixed(1)}</b><span className="text-white/80">({b.rating.count} reseña{b.rating.count === 1 ? '' : 's'})</span></> : <span className="text-white/80">Aún sin reseñas</span>}</p>
        </div>
      </div>
    </section>
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        {(b.headline || b.description) && <section className="rounded-3xl bg-white border border-[#EDE4D3] p-6">
          {b.headline && <p className="font-semibold text-lg">{b.headline}</p>}
          {b.description && <p className="text-sm text-[#5C564E] mt-2 whitespace-pre-line">{b.description}</p>}
        </section>}
        {b.map && <section className="rounded-3xl bg-white border border-[#EDE4D3] overflow-hidden">
          <iframe title={`Mapa de ${b.name}`} src={b.map.embedUrl} className="w-full h-72 border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="p-5 flex flex-col sm:flex-row gap-3 sm:items-center">
            <p className="flex-1 text-sm inline-flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-[#8F7651] shrink-0" />{b.address}{b.city && !b.address?.toLowerCase().includes(b.city.toLowerCase()) ? `, ${b.city}` : ''}</p>
            <a className={`${btn} bg-[#111] text-white`} href={b.map.directionsUrl} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" /> Cómo llegar</a>
            <a className={`${btn} border border-[#E2D4BA] bg-white`} href={b.map.wazeUrl} target="_blank" rel="noreferrer">Waze</a>
          </div>
        </section>}
        <section className="rounded-3xl bg-white border border-[#EDE4D3] p-6">
          <h2 className="font-semibold text-lg">Reseñas</h2>
          {rv && rv.total > 0 && <div className="flex flex-wrap gap-6 items-center mt-3">
            <div className="text-center"><p className="text-4xl font-semibold">{rv.avg.toFixed(1)}</p><Stars value={rv.avg} /><p className="text-xs text-[#6B645A]">{rv.total} reseña{rv.total === 1 ? '' : 's'}</p></div>
            <div className="flex-1 min-w-[180px] space-y-1">{[5, 4, 3, 2, 1].map((k) => <div key={k} className="flex items-center gap-2 text-xs"><span className="w-3">{k}</span><div className="flex-1 h-2 rounded-full bg-[#F1EBE0] overflow-hidden"><div className="h-full bg-[#D9A441]" style={{ width: `${rv.total ? (rv.distribution[k] / rv.total) * 100 : 0}%` }} /></div><span className="w-6 text-right text-[#6B645A]">{rv.distribution[k]}</span></div>)}</div>
          </div>}
          <ul className="mt-4 divide-y divide-[#EDE4D3]">
            {rv && !rv.items.length && <li className="py-3 text-sm text-[#6B645A]">Sé la primera persona en calificar este negocio.</li>}
            {rv?.items.map((r: any) => <li key={r.id} className="py-4">
              <div className="flex items-center gap-2"><Stars value={r.rating} size="h-3.5 w-3.5" /><b className="text-sm">{r.authorName}</b><span className="text-xs text-[#9A9285]">{new Date(r.createdAt).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}</span></div>
              {r.body && <p className="text-sm mt-1.5 text-[#3A3631]">{r.body}</p>}
              {r.reply && <p className="text-sm mt-2 ml-3 pl-3 border-l-2 border-[#E2D4BA] text-[#5C564E]"><b className="text-[#111]">Respuesta de {b.name}:</b> {r.reply}</p>}
            </li>)}
          </ul>
          {rv && rv.pages > 1 && <div className="flex gap-2 justify-center mt-2"><button className="h-9 px-4 rounded-full border border-[#E2D4BA] disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anteriores</button><button className="h-9 px-4 rounded-full border border-[#E2D4BA] disabled:opacity-40" disabled={page >= rv.pages} onClick={() => setPage(page + 1)}>Más</button></div>}

          <div className="mt-6 rounded-2xl bg-[#FBF9F5] border border-[#EDE4D3] p-5">
            {sent ? <p className="text-sm"><b>¡Gracias por tu reseña!</b> Ya está publicada.</p> : <form onSubmit={send} className="space-y-3">
              <p className="font-semibold">Califica a {b.name}</p>
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setF({ ...f, rating: n })} aria-label={`${n} estrellas`}><Star className={`h-8 w-8 ${n <= f.rating ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#D8D2C6]'}`} /></button>)}</div>
              <input className="w-full h-11 rounded-xl border border-[#E2D4BA] bg-white px-3 text-sm" placeholder="Tu nombre" maxLength={80} value={f.authorName} onChange={(e) => setF({ ...f, authorName: e.target.value })} required minLength={2} />
              <textarea className="w-full min-h-[90px] rounded-xl border border-[#E2D4BA] bg-white px-3 py-2 text-sm" placeholder="Cuéntanos tu experiencia (opcional)" maxLength={1200} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
              <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
              {formErr && <p className="text-sm text-red-700">{formErr}</p>}
              <button className={`${btn} bg-[#111] text-white disabled:opacity-50`} disabled={busy || !f.rating || f.authorName.trim().length < 2}>Publicar reseña</button>
              <p className="text-[11px] text-[#9A9285]">Tu nombre y tu reseña serán públicos. No incluyas datos personales como teléfonos o direcciones. Las reseñas falsas u ofensivas pueden ser retiradas.</p>
            </form>}
          </div>
        </section>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-20 self-start">
        <Link className={`${btn} w-full bg-gradient-to-r from-[#C8963E] via-[#D9774B] to-[#C4513F] text-white`} href={`/tienda/${b.slug}`}>{b.businessModel === 'SERVICES' ? 'Ver servicios y reservar' : 'Ver catálogo y pedir'} <ArrowRight className="h-4 w-4" /></Link>
        {b.whatsapp && <a className={`${btn} w-full bg-[#1F9D55] text-white`} href={`https://wa.me/${b.whatsapp}?text=${encodeURIComponent(`Hola ${b.name}, los encontré en DREAMS.`)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Escribir por WhatsApp</a>}
        {b.phone && <a className={`${btn} w-full border border-[#E2D4BA] bg-white`} href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}><Phone className="h-4 w-4" /> Llamar</a>}
        {b.map && <a className={`${btn} w-full border border-[#E2D4BA] bg-white`} href={b.map.directionsUrl} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" /> Cómo llegar</a>}
        {Object.entries(b.socialLinks ?? {}).filter(([k, v]) => v && k !== 'whatsapp').length > 0 && <div className="rounded-2xl bg-white border border-[#EDE4D3] p-4 text-sm">
          <p className="font-semibold mb-2">Redes</p>
          <ul className="space-y-1">{Object.entries(b.socialLinks).filter(([k, v]) => v && k !== 'whatsapp').map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span className="capitalize text-[#6B645A]">{k}</span><span className="truncate inline-flex items-center gap-1">{String(v)} <ExternalLink className="h-3 w-3" /></span></li>)}</ul>
        </div>}
      </aside>
    </main>
  </>;
}
