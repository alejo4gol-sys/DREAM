'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => { if (status === 'authenticated') router.replace('/dashboard'); }, [status, router]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-ink text-white p-12">
        <Link href="/"><Logo inverted /></Link>
        <div>
          <p className="font-display text-5xl leading-tight">Vende más.<br />Controla mejor.<br /><span className="text-sand-400">Sueña en grande.</span></p>
          <p className="text-sand-200/70 mt-6 max-w-sm text-sm">Ventas, inventario, clientes, finanzas y redes sociales de tu negocio en un solo lugar.</p>
        </div>
        <p className="text-xs text-sand-200/50">© {new Date().getFullYear()} DREAMS</p>
      </aside>
      <main className="flex flex-col">
        <div className="lg:hidden p-4"><Link href="/"><Logo /></Link></div>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
