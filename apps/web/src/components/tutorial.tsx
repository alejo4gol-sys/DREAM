'use client';
import { ArrowLeft, ArrowRight, Check, Lightbulb, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Tutorial, tutorialFor, tutorialsFor } from '@/lib/tutorials';
import { cn } from './ui';

type Ctx = { open: (href: string) => void; current: Tutorial | null; resetAll: () => Promise<void> };
const TutorialCtx = createContext<Ctx>({ open: () => undefined, current: null, resetAll: async () => undefined });
export const useTutorial = () => useContext(TutorialCtx);

/**
 * Muestra el tutorial de cada sección la primera vez que el usuario entra (una sola vez por persona,
 * guardado en su cuenta, así no se repite en otro computador o celular) y permite volver a verlo.
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, reload, current } = useAuth();
  const model = current?.businessModel;
  const pathname = usePathname();
  const [shown, setShown] = useState<Tutorial | null>(null);
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const pending = useRef<string | null>(null);
  useEffect(() => { setSeen(user?.tutorialsSeen ?? []); }, [user?.id, user?.tutorialsSeen]);

  const markSeen = useCallback((key: string) => {
    setSeen((s) => s.includes(key) ? s : [...s, key]);
    api(`/auth/me/tutorials/${key}`, { method: 'POST', noBusiness: true }).catch(() => undefined);
  }, []);
  const show = useCallback((t: Tutorial) => { setStep(0); setShown(t); markSeen(t.key); }, [markSeen]);

  // Primera visita a una sección: abre su tutorial (con una pequeña espera para que cargue la página).
  useEffect(() => {
    if (!user) return;
    const t = tutorialFor(pathname, model);
    if (pending.current && t && tutorialsFor(model)[pending.current]?.key === t.key) { pending.current = null; show(t); return; }
    if (!t || seen.includes(t.key) || shown) return;
    const timer = setTimeout(() => show(t), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user?.id, seen.length, model]);

  const value = useMemo<Ctx>(() => ({
    current: tutorialFor(pathname, model),
    open: (href: string) => {
      const t = tutorialsFor(model)[href];
      if (!t) return;
      if (pathname === href || pathname.startsWith(href + '/')) show(t);
      else pending.current = href; // se abre al llegar a la sección
    },
    resetAll: async () => { await api('/auth/me/tutorials', { method: 'DELETE', noBusiness: true }); setSeen([]); await reload(); },
  }), [pathname, show, reload, model]);

  const close = () => setShown(null);
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, shown.steps.length - 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown]);

  const s = shown?.steps[step];
  const last = shown ? step === shown.steps.length - 1 : false;
  return <TutorialCtx.Provider value={value}>
    {children}
    {shown && s && <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={close} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-pop overflow-hidden">
        <div className="bg-primary text-on-primary px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[11px] uppercase tracking-[0.2em] text-on-primary/60">Tutorial · {shown.title}</p><p className="text-sm text-on-primary/80 mt-1">{shown.intro}</p></div>
            <button onClick={close} className="h-8 w-8 rounded-full hover:bg-on-primary/10 flex items-center justify-center shrink-0" aria-label="Cerrar tutorial"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex gap-1.5 mt-4" aria-hidden>{shown.steps.map((_, i) => <span key={i} className={cn('h-1 rounded-full flex-1 transition', i <= step ? 'bg-on-primary' : 'bg-on-primary/25')} />)}</div>
        </div>
        <div className="px-6 py-5 min-h-[180px]">
          <p className="text-xs text-ink-faint">Paso {step + 1} de {shown.steps.length}</p>
          <h2 id="tutorial-title" className="font-display text-xl font-semibold mt-1">{s.title}</h2>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">{s.body}</p>
          {s.tips?.length ? <ul className="mt-3 space-y-1.5">{s.tips.map((t) => <li key={t} className="flex gap-2 text-xs text-ink"><Lightbulb className="h-3.5 w-3.5 text-sand-500 shrink-0 mt-0.5" />{t}</li>)}</ul> : null}
        </div>
        <div className="px-6 pb-6 flex items-center gap-2">
          {step > 0 ? <button className="btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Anterior</button> : <button className="btn-ghost text-ink-muted" onClick={close}>Saltar</button>}
          <span className="flex-1" />
          {last ? <button className="btn-primary" onClick={close} autoFocus><Check className="h-4 w-4" /> Entendido</button>
            : <button className="btn-primary" onClick={() => setStep(step + 1)} autoFocus>Siguiente <ArrowRight className="h-4 w-4" /></button>}
        </div>
        <p className="px-6 pb-4 -mt-2 text-[11px] text-ink-faint">Puedes volver a verlo cuando quieras con el botón «?» junto a cada opción del menú.</p>
      </div>
    </div>}
  </TutorialCtx.Provider>;
}
