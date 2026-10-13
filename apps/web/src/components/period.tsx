'use client';
import { useState } from 'react';
import { todayISO } from '@/lib/format';

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function presets() {
  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth();
  return {
    month: { label: 'Este mes', from: iso(new Date(y, m, 1)), to: todayISO() },
    lastMonth: { label: 'Mes pasado', from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    quarter: { label: 'Últimos 3 meses', from: iso(new Date(y, m - 2, 1)), to: todayISO() },
    year: { label: 'Este año', from: iso(new Date(y, 0, 1)), to: todayISO() },
  };
}

export function usePeriod(initial: keyof ReturnType<typeof presets> = 'month') {
  const p = presets()[initial];
  const [from, setFrom] = useState(p.from);
  const [to, setTo] = useState(p.to);
  return { from, to, setFrom, setTo };
}

export function PeriodPicker({ from, to, setFrom, setTo }: ReturnType<typeof usePeriod>) {
  const ps = presets();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-40" aria-label="Período" value={Object.entries(ps).find(([, v]) => v.from === from && v.to === to)?.[0] ?? ''}
        onChange={(e) => { const v = ps[e.target.value as keyof typeof ps]; if (v) { setFrom(v.from); setTo(v.to); } }}>
        {Object.entries(ps).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        <option value="">Personalizado</option>
      </select>
      <input type="date" className="input w-36" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
      <span className="text-ink-faint">–</span>
      <input type="date" className="input w-36" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
    </div>
  );
}
