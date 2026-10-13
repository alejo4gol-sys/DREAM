import type { Metadata, Viewport } from 'next';
import { HELP_BRAND } from '@/lib/help-brand';

export const metadata: Metadata = {
  title: { absolute: `${HELP_BRAND.name} — ${HELP_BRAND.tagline.toLowerCase()}` },
  description: 'Cuéntanos tu problema legal y te orientamos gratis, en lenguaje sencillo. Si quieres, abogados verificados te envían propuestas.',
  manifest: '/ayuda/app.webmanifest',
  icons: { icon: HELP_BRAND.icon, apple: HELP_BRAND.icon },
  openGraph: { title: HELP_BRAND.name, description: HELP_BRAND.description },
};
export const viewport: Viewport = { themeColor: HELP_BRAND.themeColor, width: 'device-width', initialScale: 1 };

export default function TuDerechoLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F5F0] text-[#13202B]">{children}</div>;
}
