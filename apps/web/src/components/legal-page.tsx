import Link from 'next/link';
import { Logo } from './ui';

/** Estructura común de las páginas legales públicas. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#FBF9F5] text-[#111]">
    <header className="border-b border-[#EDE4D3] bg-[#FBF9F5]/90 backdrop-blur sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"><Link href="/" aria-label="DREAMS"><Logo /></Link><Link className="text-sm underline" href="/registro">Crear cuenta</Link></div>
    </header>
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold">{title}</h1>
      <p className="text-sm text-[#6B645A] mt-2">Última actualización: {updated}</p>
      <article className="mt-8 space-y-4 text-[15px] leading-relaxed text-[#2A2724] [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:text-[#111] [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1">{children}</article>
      <p className="mt-12 text-xs text-[#6B645A]"><Link className="underline" href="/terminos-y-condiciones">Términos y condiciones</Link> · <Link className="underline" href="/politica-de-datos">Política de tratamiento de datos</Link></p>
    </main>
  </div>;
}
