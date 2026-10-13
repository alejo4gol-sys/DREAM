'use client';
import { ArrowRight, MapPin, Navigation, Search, Star, Store } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui';
import { api } from '@/lib/api';

type Item = { name: string; slug: string; logoUrl: string | null; city: string | null; category: string | null; headline: string | null; description: string | null; kind: string; kindLabel: string; items: number; accent: string | null; primary: string | null; rating: { avg: number; count: number }; directionsUrl: string | null; address: string | null };
type Dir = { total: number; page: number; pages: number; items: Item[]; cities: string[]; kinds: { key: string; label: string; count: number }[] };
const qs = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v) p.set(k, String(v)); const s = p.toString(); return s ? `?${s}` : ''; };
const hex = (v: string | null, d: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : d);

/** Directorio público de páginas de negocios hechas con DREAMS. */
export default function Negocios() {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [city, setCity] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('');
  const [d, setD] = useState<Dir | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [dq, city, kind, sort]);
  useEffect(() => {
    api<Dir>(`/store-share/directory${qs({ q: dq.trim(), city, kind, page, sort })}`, { noBusiness: true }).then((x) => { setD(x); setErr(''); }).catch((e) => setErr((e as Error).message));
  }, [dq, city, kind, page, sort]);

  return <>
    <header className="sticky top-0 z-30 bg-[#FBF9F5]/90 backdrop-blur border-b border-[#EDE4D3]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" aria-label="Inicio de DREAMS"><Logo /></Link>
        <Link href="/registro" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#111] text-white text-sm font-semibold hover:bg-[#2A2826]">Crea la página de tu negocio</Link>
      </div>
    </header>

    <section className="relative overflow-hidden bg-[#111] text-white">
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gradient-to-r from-[#C8963E] via-[#D9774B] to-[#C4513F] opacity-30 blur-3xl" aria-hidden />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E2D4BA]">Negocios en DREAMS</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold mt-2">Encuentra negocios cerca de ti</h1>
        <p className="text-white/75 mt-2 max-w-2xl">Tiendas, proveedores, restaurantes, peluquerías, talleres, abogados y más. Mira su catálogo, haz tu pedido o reserva tu cita en línea.</p>
        <div className="mt-6 grid sm:grid-cols-[1fr_220px] gap-2 max-w-3xl">
          <label className="flex items-center gap-2 h-12 rounded-full bg-white px-4 text-[#111]">
            <Search className="h-5 w-5 text-[#8F7651]" />
            <input className="flex-1 bg-transparent outline-none" placeholder="¿Qué buscas? Ej. arepas, abogado, celulares…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar negocios" />
          </label>
          <select className="h-12 rounded-full bg-white px-4 text-[#111]" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Ciudad">
            <option value="">Todas las ciudades</option>
            {(d?.cities ?? []).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </section>

    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {!!d?.kinds.length && <div className="flex flex-wrap gap-2 mb-6">
        <button type="button" onClick={() => setKind('')} className={`h-9 px-4 rounded-full text-sm border ${!kind ? 'bg-[#111] text-white border-[#111]' : 'bg-white border-[#E2D4BA] hover:border-[#B69C72]'}`}>Todos</button>
        {d.kinds.map((k) => <button key={k.key} type="button" onClick={() => setKind(k.key)} className={`h-9 px-4 rounded-full text-sm border ${kind === k.key ? 'bg-[#111] text-white border-[#111]' : 'bg-white border-[#E2D4BA] hover:border-[#B69C72]'}`}>{k.label} <span className="opacity-60">({k.count})</span></button>)}
      </div>}
      {err && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</p>}
      {!d && !err && <p className="text-center py-16 text-[#6B645A]">Cargando…</p>}
      {d && !d.items.length && <div className="text-center py-16">
        <Store className="h-10 w-10 mx-auto text-[#B69C72]" />
        <p className="font-semibold mt-3">No encontramos negocios con esa búsqueda</p>
        <p className="text-sm text-[#6B645A] mt-1">Prueba con otra palabra u otra ciudad.</p>
      </div>}
      {d && !!d.items.length && <>
        <div className="flex items-center justify-between mb-3"><p className="text-sm text-[#6B645A]">{d.total} negocio{d.total === 1 ? '' : 's'}</p>
          <select className="h-9 rounded-full border border-[#E2D4BA] bg-white px-3 text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar"><option value="">Orden alfabético</option><option value="rating">Mejor calificados</option></select></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {d.items.map((b) => {
            const p = hex(b.primary, '#111111'); const a = hex(b.accent, '#B69C72');
            return <div key={b.slug} className="group rounded-3xl bg-white border border-[#EDE4D3] overflow-hidden hover:border-[#B69C72] hover:shadow-lg transition flex flex-col">
              <Link href={`/negocios/${b.slug}`} className="block">
                <div className="h-20 relative" style={{ background: `linear-gradient(120deg, ${p}, ${a})` }}>
                  <span className="absolute -bottom-7 left-5 h-14 w-14 rounded-2xl bg-white shadow ring-4 ring-white overflow-hidden flex items-center justify-center font-display text-2xl font-semibold" style={{ color: p }}>
                    {b.logoUrl ? <img src={b.logoUrl} alt="" className="h-full w-full object-contain" /> : b.name.slice(0, 1)}
                  </span>
                </div>
                <div className="px-5 pt-9">
                  <p className="font-semibold text-lg leading-tight">{b.name}</p>
                  <p className="text-xs text-[#8F7651] mt-1">{b.kindLabel}{b.category ? ` · ${b.category}` : ''}</p>
                  <p className="text-xs mt-1.5 inline-flex items-center gap-1">{b.rating?.count ? <><Star className="h-3.5 w-3.5 fill-[#D9A441] text-[#D9A441]" /><b>{b.rating.avg.toFixed(1)}</b><span className="text-[#6B645A]">({b.rating.count} reseña{b.rating.count === 1 ? '' : 's'})</span></> : <span className="text-[#9A9285]">Sin reseñas aún</span>}</p>
                  {(b.headline || b.description) && <p className="text-sm text-[#5C564E] mt-2 line-clamp-2">{b.headline || b.description}</p>}
                </div>
              </Link>
              <div className="p-5 pt-3 mt-auto">
                {b.city && <p className="text-xs text-[#6B645A] inline-flex items-center gap-1 mb-3"><MapPin className="h-3.5 w-3.5" />{b.address ? `${b.address}` : b.city}</p>}
                <div className="flex gap-2">
                  <Link href={`/tienda/${b.slug}`} className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-full bg-[#111] text-white text-xs font-semibold">{b.items ? `Ver ${b.kind === 'PRODUCTS' ? 'catálogo' : 'servicios'}` : 'Ver página'} <ArrowRight className="h-3.5 w-3.5" /></Link>
                  {b.directionsUrl && <a href={b.directionsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 h-9 px-3 rounded-full border border-[#E2D4BA] text-xs font-semibold hover:border-[#B69C72]"><Navigation className="h-3.5 w-3.5" /> Cómo llegar</a>}
                </div>
              </div>
            </div>;
          })}
        </div>
        {d.pages > 1 && <div className="flex justify-center gap-2 mt-8">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-10 px-4 rounded-full border border-[#E2D4BA] bg-white disabled:opacity-40">Anterior</button>
          <span className="h-10 px-3 inline-flex items-center text-sm">{page} de {d.pages}</span>
          <button type="button" disabled={page >= d.pages} onClick={() => setPage(page + 1)} className="h-10 px-4 rounded-full border border-[#E2D4BA] bg-white disabled:opacity-40">Siguiente</button>
        </div>}
      </>}

      <div className="mt-12 rounded-3xl bg-[#F6F1E8] border border-[#E2D4BA] p-6 sm:p-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="font-display text-2xl font-semibold">¿Tienes un negocio?</p>
          <p className="text-sm text-[#5C564E] mt-1">Crea gratis tu página con catálogo, pedidos y reservas, y aparece en este directorio.</p>
        </div>
        <Link href="/registro" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-gradient-to-r from-[#C8963E] via-[#D9774B] to-[#C4513F] text-white font-semibold">Empezar gratis <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </main>
  </>;
}
