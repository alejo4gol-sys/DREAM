'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';
import { AppShell, navFor } from '@/components/shell';
import { Empty, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Lock } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, businesses, can, current } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/ingresar');
    else if (status === 'authenticated' && businesses.length === 0) router.replace('/bienvenida');
  }, [status, businesses.length, router]);

  // Aplica la paleta de marca del negocio activo; al salir de la app se vuelve a la de DREAMS.
  useEffect(() => {
    applyTheme(current?.brandColors);
    return () => applyTheme(null);
  }, [current?.businessId, current?.brandColors?.primary, current?.brandColors?.accent]);

  if (status !== 'authenticated' || !current) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;

  const section = navFor(current.businessModel, current.serviceProfile).find((n) => pathname === n.href || pathname.startsWith(n.href + '/'));
  const allowed = !section?.perm || can(section.perm);
  return (
    <AppShell>
      {allowed ? children : (
        <Empty icon={<Lock className="h-5 w-5" />} title="Sin acceso a esta sección" description={`Tu rol (${current.roleName}) no tiene permiso para ver ${section?.label}. Pide acceso al propietario del negocio.`} />
      )}
    </AppShell>
  );
}
