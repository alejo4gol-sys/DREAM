'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorBox, Field, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (challenge) {
        const r = await api<{ accessToken: string }>('/auth/login/2fa', { body: { challengeToken: challenge, code } });
        await login(r.accessToken);
      } else {
        const r = await api<{ accessToken?: string; twoFactorRequired?: boolean; challengeToken?: string }>('/auth/login', { body: { email, password } });
        if (r.twoFactorRequired) { setChallenge(r.challengeToken!); setBusy(false); return; }
        await login(r.accessToken!);
      }
      router.replace('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-semibold">{challenge ? 'Verificación' : 'Bienvenido'}</h1>
        <p className="text-sm text-ink-muted mt-1">{challenge ? 'Escribe el código de 6 dígitos de tu app autenticadora.' : 'Ingresa a tu cuenta de DREAMS.'}</p>
      </div>
      {error && <ErrorBox message={error} />}
      {challenge ? (
        <Field label="Código de verificación">
          <input className="input text-center tracking-[0.5em] text-lg" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </Field>
      ) : (
        <>
          <Field label="Correo electrónico">
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="text-right -mt-2"><Link href="/recuperar" className="text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline">¿Olvidaste tu contraseña?</Link></div>
        </>
      )}
      <button className="btn-primary w-full h-11" disabled={busy}>{busy && <Spinner />} {challenge ? 'Verificar' : 'Ingresar'}</button>
      <p className="text-sm text-center text-ink-muted">¿No tienes cuenta? <Link href="/registro" className="text-ink font-medium hover:underline">Regístrate gratis</Link></p>
      {!challenge && process.env.NODE_ENV !== 'production' && (
        <p className="text-[11px] text-center text-ink-faint">Demo: demo@dream.co · Dream2026</p>
      )}
    </form>
  );
}
