'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { ErrorBox, Field, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '', acceptPolicy: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const [ref, setRef] = useState<{ code: string; businessName: string } | null>(null);
  // Enlace de referido: /registro?ref=CODIGO → se guarda para enviarlo al crear el negocio.
  useEffect(() => {
    let code = new URLSearchParams(window.location.search).get('ref');
    try { if (code) localStorage.setItem('dream.ref', code); else code = localStorage.getItem('dream.ref'); } catch { /* sin almacenamiento */ }
    if (!code) return;
    api<any>(`/growth/referrals/check/${encodeURIComponent(code)}`, { noBusiness: true }).then((r) => { if (r.valid) setRef(r); else try { localStorage.removeItem('dream.ref'); } catch { /* */ } }).catch(() => null);
  }, []);
  const strong = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api<{ accessToken: string }>('/auth/register', { body: { ...f, phone: f.phone || undefined } });
      await login(r.accessToken);
      router.replace('/bienvenida');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-4xl font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-ink-muted mt-1">Empieza gratis. Luego registramos tu negocio.</p>
      </div>
      {ref && <p className="flex items-center gap-2 rounded-xl bg-sand-50 border border-sand-200 px-3 py-2 text-sm"><Gift className="h-4 w-4 text-sand-600 shrink-0" /> Te invitó <b>{ref.businessName}</b>. ¡Bienvenido!</p>}
      {error && <ErrorBox message={error} />}
      <Field label="Nombre completo"><input className="input" required autoComplete="name" value={f.fullName} onChange={set('fullName')} /></Field>
      <Field label="Correo electrónico"><input className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
      <Field label="Teléfono (opcional)"><input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Contraseña" hint={<span className={strong ? 'text-ok' : ''}>Mínimo 8 caracteres, con letras y números.</span>}>
        <input className="input" type="password" required autoComplete="new-password" value={f.password} onChange={set('password')} />
      </Field>
      <label className="flex gap-2 items-start text-xs text-ink-muted">
        <input type="checkbox" className="mt-0.5 accent-ink" checked={f.acceptPolicy} onChange={set('acceptPolicy')} required />
        <span>Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012 y la <a href="/politica-de-datos" target="_blank" className="underline">política de tratamiento de datos</a>, y acepto los <a href="/terminos-y-condiciones" target="_blank" className="underline">términos y condiciones</a> de DREAMS.</span>
      </label>
      <button className="btn-primary w-full h-11" disabled={busy || !strong || !f.acceptPolicy}>{busy && <Spinner />} Crear cuenta</button>
      <p className="text-sm text-center text-ink-muted">¿Ya tienes cuenta? <Link href="/ingresar" className="text-ink font-medium hover:underline">Ingresa</Link></p>
    </form>
  );
}
