import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <p className="font-display text-7xl font-semibold">404</p>
      <p className="text-ink-muted mt-2">Esta página no existe.</p>
      <Link href="/dashboard" className="btn-primary mt-6">Volver al inicio</Link>
    </div>
  );
}
