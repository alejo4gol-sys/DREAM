import { HELP_BRAND } from '@/lib/help-brand';

/** Manifiesto de la micro app (se arma con el nombre configurado en help-brand.ts). */
export function GET() {
  return Response.json({
    name: `${HELP_BRAND.name} — ${HELP_BRAND.tagline.toLowerCase()}`,
    short_name: HELP_BRAND.name,
    description: 'Cuéntanos tu problema legal y te orientamos gratis, en lenguaje sencillo.',
    start_url: '/ayuda', scope: '/ayuda', display: 'standalone', background_color: '#F7F5F0', theme_color: HELP_BRAND.themeColor, lang: 'es-CO',
    icons: [{ src: HELP_BRAND.icon, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }, { headers: { 'content-type': 'application/manifest+json' } });
}
