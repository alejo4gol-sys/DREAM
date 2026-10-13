'use client';
import { MessageCircle, Quote, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

type T = { id: string; authorName: string; businessName: string; city: string | null; rating: number; body: string };

/** Opiniones reales de negocios (aprobadas por la administración, con autorización del autor). Si no hay, no se muestra nada. */
export function Testimonials() {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => { fetch('/api/growth/testimonials/public').then((r) => (r.ok ? r.json() : [])).then(setItems).catch(() => setItems([])); }, []);
  if (!items?.length) return null;
  return <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8F7651]">Lo que dicen los negocios</p>
    <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Emprendedores que ya usan DREAMS</h2>
    <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((t) => <figure key={t.id} className="rounded-3xl bg-white border border-[#EDE4D3] p-6 flex flex-col">
        <Quote className="h-6 w-6 text-[#D9A441]" />
        <blockquote className="text-[15px] text-[#3A3631] mt-2 flex-1">{t.body}</blockquote>
        <figcaption className="mt-4 text-sm">
          <span className="inline-flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= t.rating ? 'fill-[#D9A441] text-[#D9A441]' : 'text-[#D8D2C6]'}`} />)}</span>
          <b className="block mt-1">{t.authorName}</b>
          <span className="text-[#6B645A]">{t.businessName}{t.city ? ` · ${t.city}` : ''}</span>
        </figcaption>
      </figure>)}
    </div>
  </section>;
}

/** Botón flotante de soporte por WhatsApp (número configurado con SUPPORT_WHATSAPP). */
export function SupportButton({ message = 'Hola, necesito ayuda con DREAMS.', className = '' }: { message?: string; className?: string }) {
  const [n, setN] = useState<string | null>(null);
  useEffect(() => { fetch('/api/growth/support').then((r) => (r.ok ? r.json() : null)).then((d) => setN(d?.whatsapp ?? null)).catch(() => null); }, []);
  if (!n) return null;
  return <a href={`https://wa.me/${n}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" aria-label="Soporte por WhatsApp"
    className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-[#1F9D55] text-white font-semibold shadow-lg hover:brightness-105 no-print ${className}`}>
    <MessageCircle className="h-5 w-5" /> <span className="hidden sm:inline">¿Necesitas ayuda?</span>
  </a>;
}
