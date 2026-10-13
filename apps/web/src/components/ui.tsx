'use client';
import clsx from 'clsx';
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Tone } from '@/lib/format';

export const cn = clsx;

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="9" style={{ fill: inverted ? 'rgb(var(--on-primary))' : 'rgb(var(--primary))' }} />
        <path d="M10 8h6.2c5 0 8.3 3.2 8.3 8s-3.3 8-8.3 8H10V8z" fill="none" style={{ stroke: inverted ? 'rgb(var(--primary))' : 'rgb(var(--on-primary))' }} strokeWidth="2.4" />
        <circle cx="16.4" cy="16" r="2.6" style={{ fill: 'rgb(var(--sand-400))' }} />
      </svg>
      <span className={cn('font-semibold tracking-[0.32em] text-[15px]', inverted ? 'text-on-primary' : 'text-ink')}>DREAMS</span>
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="font-display text-[32px] leading-tight font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const tones: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-ok', warn: 'bg-amber-50 text-warn', bad: 'bg-red-50 text-bad',
  muted: 'bg-sand-100 text-ink-muted', sand: 'bg-sand-200 text-sand-600', ink: 'bg-primary text-on-primary',
};
export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn('chip', tones[tone])}>{children}</span>;
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={cn(padded && 'px-5 pb-5', !title && !actions && padded && 'pt-5')}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, change, icon, dark }: { label: string; value: ReactNode; hint?: ReactNode; change?: number | null; icon?: ReactNode; dark?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4 sm:p-5', dark ? 'bg-primary border-primary text-on-primary' : 'bg-white border-line shadow-card')}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-xs font-medium', dark ? 'text-on-primary/70' : 'text-ink-muted')}>{label}</p>
        {icon && <span className={cn(dark ? 'text-on-primary/70' : 'text-sand-500')}>{icon}</span>}
      </div>
      <p className="mt-2 text-[22px] sm:text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {change !== undefined && change !== null && (
          <span className={cn('font-medium tabular-nums', change > 0 ? (dark ? 'text-on-primary' : 'text-ok') : change < 0 ? (dark ? 'text-on-primary' : 'text-bad') : 'text-ink-muted')}>
            {change > 0 ? '▲' : change < 0 ? '▼' : '•'} {Math.abs(change)}%
          </span>
        )}
        {hint && <span className={dark ? 'text-on-primary/70' : 'text-ink-faint'}>{hint}</span>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-faint mt-1">{hint}</span>}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted"><Spinner /> {label}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-bad">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && <button className="btn-secondary btn-sm" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}

export function Empty({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-2xl bg-sand-100 text-sand-600 flex items-center justify-center mb-3">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative w-full bg-white sm:rounded-2xl rounded-t-2xl shadow-pop max-h-[92vh] flex flex-col', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-semibold">{title}</h3>
          <button className="btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <footer className="px-5 py-4 border-t border-line flex justify-end gap-2 bg-sand-50/60 sm:rounded-b-2xl">{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-sand-100 p-1 gap-1 overflow-x-auto max-w-full">
      {items.map((i) => (
        <button key={i.value} onClick={() => onChange(i.value)}
          className={cn('px-3 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition', value === i.value ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-ink-muted border-t border-line">
      <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}</span>
      <div className="flex gap-1">
        <button className="btn-secondary btn-sm !px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
        <button className="btn-secondary btn-sm !px-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

// ── Toasts ──
type Toast = { id: number; message: string; tone: 'ok' | 'bad' };
const ToastCtx = createContext<(m: string, tone?: 'ok' | 'bad') => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 items-end pointer-events-none">
        {items.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-pop max-w-sm', t.tone === 'ok' ? 'bg-ink text-white' : 'bg-bad text-white')}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-ink-muted bg-sand-100 border border-line rounded-xl px-3 py-2">{children}</p>;
}
