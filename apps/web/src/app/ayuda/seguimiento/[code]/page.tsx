'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Tracking } from '@/components/tu-derecho';

function Inner({ code }: { code: string }) {
  const t = useSearchParams().get('t') ?? '';
  return <Tracking code={code.toUpperCase()} token={t} />;
}

export default function SeguimientoPage({ params }: { params: { code: string } }) {
  return <Suspense fallback={null}><Inner code={params.code} /></Suspense>;
}
