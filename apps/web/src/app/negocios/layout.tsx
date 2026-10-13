import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Negocios en DREAMS — encuentra tiendas y servicios cerca de ti' },
  description: 'Directorio de tiendas, proveedores, restaurantes, peluquerías, talleres, abogados y más negocios colombianos con página en DREAMS.',
  openGraph: { title: 'Negocios en DREAMS', description: 'Encuentra tiendas y servicios por nombre, ciudad y tipo de negocio.' },
};

export default function NegociosLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#FBF9F5] text-[#111111]">{children}</div>;
}
