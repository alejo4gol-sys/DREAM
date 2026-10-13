'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorBox, Field, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api<{ message: string }>('/auth/password/forgot', { body: { email } });
      setMsg(r.message);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-semibold">Recupera tu acceso</h1>
        <p className="text-sm text-ink-muted mt-1">Te enviaremos un enlace para crear una nueva contraseña.</p>
      </div>
      {error && <ErrorBox message={error} />}
      {msg ? (
        <div className="rounded-xl bg-sand-100 border border-line p-4 text-sm">{msg}</div>
      ) : (
        <>
          <Field label="Correo electrónico"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn-primary w-full h-11" disabled={busy}>{busy && <Spinner />} Enviar enlace</button>
        </>
      )}
      <p className="text-sm text-center"><Link href="/ingresar" className="text-ink-muted hover:text-ink">← Volver a ingresar</Link></p>
    </form>
  );
}
