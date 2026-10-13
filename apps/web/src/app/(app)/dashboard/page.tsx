'use client';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, ClipboardList, Package, Plus, Receipt, ShoppingBag, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { HBars, SalesTrend } from '@/components/charts';
import { Badge, Card, ErrorBox, Loading, PageHeader, Stat, Tabs } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CHANNELS, money, number } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ServicesDashboard } from '@/components/services-dashboard';
import { OnboardingCard } from '@/components/growth';

type Range = 'today' | 'week' | 'month' | 'quarter' | 'year';
const RANGES: { value: Range; label: string }[] = [
  { value: 'today', label: 'Hoy' }, { value: 'week', label: 'Esta semana' }, { value: 'month', label: 'Este mes' },
  { value: 'quarter', label: 'Últimos 3 meses' }, { value: 'year', label: 'Este año' },
];

function ProductsDashboard() {
  const { user, can } = useAuth();
  const [range, setRange] = useState<Range>('month');
  const { data: d, error, loading, reload } = useApi<any>(`/dashboard?range=${range}`);
  const label = RANGES.find((r) => r.value === range)!.label.toLowerCase();

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.fullName.split(' ')[0]}`}
        subtitle="Así va tu negocio."
        actions={<>
          <Tabs value={range} onChange={setRange} items={RANGES} />
          {can('sales:create') && <Link href="/ventas/nueva" className="btn-primary"><Plus className="h-4 w-4" /> Nueva venta</Link>}
        </>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Loading />}
      {d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat dark label="Ventas del día" value={money(d.sales.today)} icon={<ShoppingBag className="h-4 w-4" />} hint={`Semana ${money(d.sales.week)}`} />
            <Stat label="Ventas del mes" value={money(d.sales.month)} icon={<Receipt className="h-4 w-4" />} hint={d.sales.averageTicket ? `Ticket prom. ${money(d.sales.averageTicket)}` : undefined} />
            <Stat label={`Ventas · ${label}`} value={money(d.sales.current)} change={d.sales.change} hint="vs. período anterior" />
            <Stat label="Pedidos" value={number(d.sales.orders)} change={d.sales.ordersChange} hint={`${number(d.unitsSold)} unidades`} icon={<Package className="h-4 w-4" />} />
          </div>

          <section aria-label="Acciones rápidas" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {can('sales:create') && <Link href="/ventas/nueva" className="rounded-2xl border border-line bg-white p-4 hover:border-primary/40 transition"><span className="h-9 w-9 rounded-xl bg-primary text-on-primary flex items-center justify-center"><Receipt className="h-4 w-4" /></span><span className="mt-3 block text-sm font-semibold">Registrar venta</span><span className="text-xs text-ink-muted">Guardar una venta ahora</span></Link>}
            {can('products:write') && <Link href="/productos" className="rounded-2xl border border-line bg-white p-4 hover:border-primary/40 transition"><span className="h-9 w-9 rounded-xl bg-sand-100 flex items-center justify-center"><Plus className="h-4 w-4" /></span><span className="mt-3 block text-sm font-semibold">Agregar producto</span><span className="text-xs text-ink-muted">Actualizar el catálogo</span></Link>}
            {can('sales:read') && <Link href="/pedidos-web" className="rounded-2xl border border-line bg-white p-4 hover:border-primary/40 transition"><span className="h-9 w-9 rounded-xl bg-warn/10 flex items-center justify-center"><ClipboardList className="h-4 w-4" /></span><span className="mt-3 block text-sm font-semibold">Pedidos por confirmar</span><span className="text-xs text-ink-muted">Revisar pedidos de la tienda</span></Link>}
            {can('inventory:adjust') && <Link href="/inventario" className="rounded-2xl border border-line bg-white p-4 hover:border-primary/40 transition"><span className="h-9 w-9 rounded-xl bg-bad/10 flex items-center justify-center"><Package className="h-4 w-4" /></span><span className="mt-3 block text-sm font-semibold">Reponer poco stock</span><span className="text-xs text-ink-muted">Revisar productos bajo mínimo</span></Link>}
          </section>

          <Card title="Pon tu tienda en marcha">
            <p className="text-xs text-ink-muted -mt-2 mb-3">Un recorrido corto para empezar a vender desde DREAMS.</p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { n: '01', title: 'Define tu negocio', detail: 'Tipo y datos del comercio', href: '/configuracion' },
                { n: '02', title: 'Carga productos', detail: 'Importa desde Excel', href: '/productos' },
                { n: '03', title: 'Ajusta inventario', detail: 'Stock actual y mínimo', href: '/inventario' },
                { n: '04', title: 'Configura y publica', detail: 'Pagos y página web', href: '/mi-tienda' },
              ].map((step) => <Link key={step.n} href={step.href} className="rounded-xl border border-line p-3 hover:border-primary/40 transition"><span className="text-[11px] text-ink-faint">PASO {step.n}</span><span className="block mt-1 text-sm font-semibold">{step.title}</span><span className="text-xs text-ink-muted">{step.detail}</span></Link>)}
            </div>
          </Card>

          {d.finance && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Stat label={`Utilidad estimada · ${label}`} value={money(d.finance.estimatedProfit)} change={d.finance.profitChange} hint={`Margen ${d.finance.netMargin}%`} icon={<Wallet className="h-4 w-4" />} />
              <Stat label="Ingresos recibidos" value={money(d.finance.income)} hint={`Gastos ${money(d.finance.expenses)}`} icon={<ArrowDownRight className="h-4 w-4" />} />
              <Stat label="Saldo disponible" value={money(d.banks?.accounts ? d.banks.balance : d.finance.cashBalance)} hint={d.banks?.accounts ? `${d.banks.accounts} cuenta(s) bancaria(s)` : 'Caja registrada'} icon={<Banknote className="h-4 w-4" />} />
              <Stat label="Por cobrar / por pagar" value={<span className="text-lg sm:text-xl">{money(d.finance.receivables)} <span className="text-ink-faint font-normal">/</span> {money(d.finance.payables)}</span>} hint={`${d.finance.receivablesCount} cobros · ${d.finance.payablesCount} pagos`} icon={<ArrowUpRight className="h-4 w-4" />} />
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            <Card title="Ventas" className="lg:col-span-2" actions={<span className="text-[11px] text-ink-muted flex items-center gap-3"><span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-primary inline-block" /> Actual</span><span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-sand-400 inline-block" /> Anterior</span></span>}>
              <SalesTrend current={d.series.current} previous={d.series.previous} bucket={d.series.bucket} />
            </Card>
            <Card title="Ventas por canal">
              <HBars data={d.byChannel.map((c: any) => ({ name: `${CHANNELS[c.channel]} · ${c.orders}`, value: c.total }))} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card title="Productos más vendidos" padded={false}>
              <ul className="divide-y divide-line">
                {d.topProducts.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">Sin ventas en este período</li>}
                {d.topProducts.map((p: any, i: number) => (
                  <li key={p.productId} className="px-5 py-3 flex items-center gap-3">
                    <span className="h-7 w-7 rounded-lg bg-sand-100 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-sm truncate">{p.name}</span>
                    <span className="text-xs text-ink-muted tabular-nums">{p.units} u · {money(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Inventario bajo" padded={false} actions={<Link href="/inventario" className="text-xs text-ink-muted hover:text-ink">Ver inventario</Link>}>
              <ul className="divide-y divide-line">
                {d.lowStock.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">Todo el inventario está sobre el mínimo.</li>}
                {d.lowStock.map((p: any) => (
                  <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-warn shrink-0" />
                    <span className="flex-1 text-sm truncate">{p.name}</span>
                    <Badge tone={p.stock <= 0 ? 'bad' : 'warn'}>{p.stock} / mín {p.minStock}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Clientes">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center"><Users className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{number(d.customers.total)}</p>
                  <p className="text-xs text-ink-muted">{d.customers.new} nuevo(s) {label}</p>
                </div>
              </div>
              {d.finance && (
                <div className="mt-5 pt-4 border-t border-line grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-ink-muted">Gastos operativos</p><p className="font-medium tabular-nums">{money(d.finance.expenses)}</p></div>
                  <div><p className="text-xs text-ink-muted">Utilidad bruta</p><p className="font-medium tabular-nums">{money(d.finance.grossProfit)}</p></div>
                </div>
              )}
              <Link href="/clientes" className="btn-secondary w-full mt-5">Ver clientes</Link>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { current } = useAuth();
  return <>
    <OnboardingCard />
    {current?.businessModel === 'SERVICES' ? <ServicesDashboard /> : <ProductsDashboard />}
  </>;
}
