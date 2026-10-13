import type { Metadata } from 'next';
import { headers } from 'next/headers';

/**
 * Título, descripción e imagen que aparecen al compartir el enlace de la página web
 * (WhatsApp, Instagram, Facebook, Google). Se arma en el servidor con la configuración del negocio.
 */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  if (params.slug === '__vista-previa') return { title: 'Vista previa', robots: { index: false } };
  try {
    const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
    const res = await fetch(`${api}/api/store/${encodeURIComponent(params.slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Tienda no disponible', robots: { index: false } };
    const data = await res.json();
    const s = data.settings ?? {};
    const h = headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    const base = `${proto}://${host}`;
    const title = s.seoTitle || `${data.business?.name ?? 'Tienda'}${s.headline ? ` · ${s.headline}` : ''}`;
    const description = s.seoDescription || s.description || `Compra en línea en ${data.business?.name ?? 'nuestra tienda'}.`;
    const image = s.shareImage || s.heroImage || data.business?.logoUrl || '';
    const abs = image ? new URL(image, base).toString() : undefined;
    return {
      title: { absolute: title }, description,
      icons: data.business?.logoUrl ? { icon: data.business.logoUrl } : undefined,
      openGraph: { title, description, type: 'website', url: `${base}/tienda/${params.slug}`, images: abs ? [{ url: abs }] : undefined },
      twitter: { card: abs ? 'summary_large_image' : 'summary', title, description, images: abs ? [abs] : undefined },
    };
  } catch {
    return { title: 'Tienda' };
  }
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
