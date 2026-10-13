'use client';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CLIPS } from '@/lib/hero-clips';

/**
 * Montaje de la portada: clips cortos de distintos negocios que se van turnando con un fundido.
 * Cada clip se busca primero en /portada (copia local que descarga scripts/videos-portada.sh)
 * y, si no está, se carga directo desde Pexels. Licencia Pexels: uso libre, sin atribución obligatoria
 * (igual damos crédito en el pie de la portada).
 */

const SECONDS = 4.5;

export function HeroMontage() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    if (m.matches) setPaused(true);
  }, []);

  // Reproduce el clip activo desde el inicio y deja listo el siguiente.
  useEffect(() => {
    refs.current.forEach((v, k) => {
      if (!v) return;
      if (k === i) {
        try { v.currentTime = 0; } catch { /* aún sin datos */ }
        if (!paused) v.play().catch(() => {});
      } else {
        v.pause();
        if (k === (i + 1) % CLIPS.length && v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
      }
    });
  }, [i, paused]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % CLIPS.length), SECONDS * 1000);
    return () => clearTimeout(t);
  }, [i, paused]);

  const c = CLIPS[i];
  return <div className="relative overflow-hidden rounded-[28px] bg-[#111] shadow-2xl aspect-[4/3] ring-4 ring-[#F6F1E8]">
    {CLIPS.map((clip, k) => <video key={clip.file} ref={(el) => { refs.current[k] = el; }}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? 'opacity-100' : 'opacity-0'}`}
      muted playsInline loop preload={k <= 1 ? 'auto' : 'none'} aria-hidden={k !== i}
>
      <source src={`/portada/${clip.file}`} type="video/mp4" />
      <source src={clip.remote} type="video/mp4" />
    </video>)}
    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${c.color} via-transparent to-transparent opacity-30 transition-colors duration-700`} aria-hidden />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/20" aria-hidden />
    <div className="absolute top-4 left-4 right-4 flex gap-1.5" aria-hidden>
      {CLIPS.map((clip, k) => <span key={clip.file} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
        <span className={`block h-full bg-white ${k < i ? 'w-full' : k === i && !paused ? 'animate-[grow_4.5s_linear_forwards]' : k === i ? 'w-1/2' : 'w-0'}`} key={`${i}-${paused}`} />
      </span>)}
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 text-white">
      <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#E2D4BA]">DREAMS es para</p>
      <p key={c.label} className="font-display text-3xl sm:text-4xl font-semibold mt-1 animate-[rise_.6s_ease-out]">{c.label}</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => setPaused((p) => !p)} className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center" aria-label={paused ? 'Reproducir video' : 'Pausar video'}>
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <div className="flex gap-1.5 overflow-hidden">
          {CLIPS.map((clip, k) => <button key={clip.file} type="button" onClick={() => setI(k)} aria-label={clip.label}
            className={`h-2.5 rounded-full transition-all ${k === i ? 'w-6 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} />)}
        </div>
        {reduced && <span className="text-[11px] text-white/80 ml-1">Toca ▶ para ver el video</span>}
      </div>
    </div>
  </div>;
}
