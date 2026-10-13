import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'DREAMS — Tu negocio en un solo lugar', template: '%s · DREAMS' },
  description: 'Ventas, inventario, clientes, finanzas, bancos y redes sociales para pequeños negocios.',
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'DREAMS', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#111111', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans min-h-screen"><Providers>{children}</Providers></body>
    </html>
  );
}
