'use client';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  ComposedChart,
} from 'recharts';
import { useMemo } from 'react';
import { compactMoney, money } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { themeColors } from '@/lib/theme';

/** Colores del gráfico según la paleta del negocio activo. */
function useChartColors() {
  const { current } = useAuth();
  return useMemo(() => themeColors(current?.brandColors), [current?.brandColors?.primary, current?.brandColors?.accent]);
}

const axis = { fontSize: 11, fill: '#6B645A' };
const tooltipStyle = { borderRadius: 12, border: '1px solid rgb(var(--line))', boxShadow: '0 12px 32px -8px rgba(17,17,17,.18)', fontSize: 12 };

export function SalesTrend({ current, previous, bucket }: { current: { period: string; total: number }[]; previous: { period: string; total: number }[]; bucket: 'day' | 'month' }) {
  const c = useChartColors();
  // Se alinean por posición: día 1 del período actual vs día 1 del anterior
  const len = Math.max(current.length, 1);
  const data = current.map((c, i) => ({
    label: bucket === 'day' ? new Date(c.period + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : new Date(c.period + '-15').toLocaleDateString('es-CO', { month: 'short' }),
    actual: c.total, anterior: previous[i]?.total ?? null,
  }));
  if (!data.length) return <div className="h-64 flex items-center justify-center text-sm text-ink-muted">Aún no hay ventas en este período</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.primary} stopOpacity={0.18} /><stop offset="100%" stopColor={c.primary} stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={len > 14 ? Math.ceil(len / 8) : 0} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={64} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [money(v), n === 'actual' ? 'Período actual' : 'Período anterior']} />
        <Area type="monotone" dataKey="anterior" stroke={c.accentLight} strokeWidth={2} strokeDasharray="4 4" fill="none" dot={false} connectNulls />
        <Area type="monotone" dataKey="actual" stroke={c.primary} strokeWidth={2.2} fill="url(#g1)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HBars({ data }: { data: { name: string; value: number }[] }) {
  const c = useChartColors();
  const max = Math.max(...data.map((d) => d.value), 1);
  if (!data.length) return <p className="text-sm text-ink-muted py-6 text-center">Sin datos en este período</p>;
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.name}>
          <div className="flex justify-between text-xs mb-1"><span className="text-ink-soft">{d.name}</span><span className="tabular-nums font-medium">{money(d.value)}</span></div>
          <div className="h-2 rounded-full bg-sand-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: c.series[i % c.series.length] }} /></div>
        </div>
      ))}
    </div>
  );
}

export function CashFlowChart({ data }: { data: { period: string; inflows: number; outflows: number; net: number }[] }) {
  const c = useChartColors();
  if (!data.length) return <div className="h-64 flex items-center justify-center text-sm text-ink-muted">Sin movimientos en este período</div>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data.map((d) => ({ ...d, outflows: -d.outflows }))} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="period" tick={axis} tickLine={false} axisLine={false} tickFormatter={(p: string) => p.length > 7 ? p.slice(8) + '/' + p.slice(5, 7) : p} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={64} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [money(Math.abs(v)), n === 'inflows' ? 'Entradas' : n === 'outflows' ? 'Salidas' : 'Neto']} />
        <Legend formatter={(n) => (n === 'inflows' ? 'Entradas' : n === 'outflows' ? 'Salidas' : 'Neto')} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="inflows" fill={c.primary} radius={[4, 4, 0, 0]} />
        <Bar dataKey="outflows" fill={c.accentLight} radius={[0, 0, 4, 4]} />
        <Line dataKey="net" stroke="#2F6B4F" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ data }: { data: { label: string; total: number }[] }) {
  const c = useChartColors();
  if (!data.length) return <p className="text-sm text-ink-muted py-6 text-center">Sin gastos en este período</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={140} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [money(v), 'Total']} cursor={{ fill: c.hover }} />
        <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((_, i) => <Cell key={i} fill={c.series[i % c.series.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ingresos por mes en barras (negocios de servicios). */
export function MonthlyBars({ data }: { data: { month: string; total: number }[] }) {
  const c = useChartColors();
  const rows = data.map((m) => ({ ...m, label: new Date(`${m.month}-15T12:00:00`).toLocaleDateString('es-CO', { month: 'short' }) }));
  if (!rows.length) return <div className="h-56 flex items-center justify-center text-sm text-ink-muted">Aún no hay cobros</div>;
  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={64} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [money(v), 'Ingresos']} cursor={{ fill: c.grid }} />
        <Bar dataKey="total" fill={c.primary} radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}
