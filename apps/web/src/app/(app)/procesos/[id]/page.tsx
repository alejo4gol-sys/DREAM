'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '@/components/ui';

/** Enlace de los avisos (WhatsApp): abre el proceso en la página de seguimiento. */
export default function OpenProcess() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/procesos?abrir=${encodeURIComponent(id)}`); }, [id, router]);
  return <Loading />;
}
