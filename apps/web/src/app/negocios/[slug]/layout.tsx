import type { Metadata } from 'next';

/** Título y descripción de la ficha pública del directorio (para buscadores y al compartir). */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
    const res = await fetch(`${api}/api/reviews/public/${encodeURIComponent(params.slug)}/profile`, { next: { revalidate: 120 } });
    if (!res.ok) return { title: 'Negocio no encontrado', robots: { index: false } };
    const b = await res.json();
    const rating = b.rating?.count ? ` · ★ ${b.rating.avg.toFixed(1)} (${b.rating.count} reseñas)` : '';
    const title = `${b.name}${b.city ? ` en ${b.city}` : ''}${rating}`;
    const description = b.headline || b.description || `Dirección, cómo llegar, reseñas y catálogo de ${b.name}.`;
    return { title: { absolute: title }, description, openGraph: { title, description, type: 'website', images: b.logoUrl ? [{ url: b.logoUrl }] : undefined } };
  } catch {
    return { title: 'Negocios en DREAMS' };
  }
}

export default function BusinessProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
