'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ErrorBox, Field, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    setBusy(true); setError(null);
    try {
      await api('/auth/password/reset', { body: { token, password } });
      setDone(true);
      setTimeout(() => router.replace('/ingresar'), 1800);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  if (!token) return <ErrorBox message="El enlace no es válido. Solicita uno nuevo." />;
  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-semibold">Nueva contraseña</h1>
        <p className="text-sm text-ink-muted mt-1">Por seguridad, se cerrarán todas tus sesiones abiertas.</p>
      </div>
      {error && <ErrorBox message={error} />}
      {done ? <div className="rounded-xl bg-sand-100 border border-line p-4 text-sm">Contraseña actualizada. Te llevamos a ingresar…</div> : (
        <>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con letras y números."><input className="input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Confirmar contraseña"><input className="input" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <button className="btn-primary w-full h-11" disabled={busy}>{busy && <Spinner />} Guardar contraseña</button>
        </>
      )}
      <p className="text-sm text-center"><Link href="/ingresar" className="text-ink-muted hover:text-ink">← Volver a ingresar</Link></p>
    </form>
  );
}

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>;
}
