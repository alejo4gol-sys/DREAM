'use client';
import { FileDown } from 'lucide-react';
import { CashFlowChart, CategoryBars } from '@/components/charts';
import { PeriodPicker, usePeriod } from '@/components/period';
import { Card, Disclaimer, ErrorBox, Loading, PageHeader, Stat } from '@/components/ui';
import { download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { qs, useApi } from '@/lib/hooks';

export default function AccountingPage() {
  const { can } = useAuth();
  const period = usePeriod('month');
  const q = qs({ from: period.from, to: period.to });
  const { data: is, error, reload } = useApi<any>(`/accounting/income-statement${q}`);
  const span = (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86_400_000;
  const { data: cf } = useApi<any>(`/accounting/cash-flow${qs({ from: period.from, to: period.to, bucket: span > 62 ? 'month' : 'day' })}`);

  const Row = ({ label, value, strong, indent, negative }: { label: string; value: number; strong?: boolean; indent?: boolean; negative?: boolean }) => (
    <div className={`flex justify-between py-2 ${strong ? 'font-semibold border-t border-line mt-1 pt-3' : ''} ${indent ? 'pl-4 text-ink-muted' : ''}`}>
      <span>{label}</span><span className={`tabular-nums ${value < 0 && strong ? 'text-bad' : ''}`}>{negative ? `−${money(Math.abs(value))}` : money(value)}</span>
    </div>
  );

  return (
    <>
      <PageHeader title="Contabilidad" subtitle="Contabilidad administrativa: ¿estoy ganando y en qué se va el dinero?"
        actions={<>
          <PeriodPicker {...period} />
          {can('reports:read') && <button className="btn-secondary" onClick={() => download(`/reports/profit${qs({ format: 'pdf', from: period.from, to: period.to })}`, `estado-resultados-${period.from}.pdf`).catch((e) => alert(e.message))}><FileDown className="h-4 w-4" /> PDF</button>}
        </>} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!is ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat dark label="Ventas netas" value={money(is.netSales)} hint={`${is.salesCount} ventas`} />
            <Stat label="Utilidad bruta" value={money(is.grossProfit)} hint={`Margen bruto ${is.grossMargin}%`} />
            <Stat label="Gastos operacionales" value={money(is.operatingExpenses)} />
            <Stat label="Utilidad neta estimada" value={money(is.netProfit)} hint={`Margen neto ${is.netMargin}%`} />
          </div>
          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <Card title="Estado de resultados">
              <div className="text-sm">
                <Row label="Ventas brutas" value={is.grossSales} />
                <Row label="Descuentos" value={is.discounts} indent negative />
                {Number(is.returns) > 0 && <Row label="Devoluciones (reembolsos)" value={is.returns} indent negative />}
                <Row label="Ventas netas" value={is.netSales} strong />
                <Row label="Costo de ventas" value={is.costOfSales} indent negative />
                <Row label="Utilidad bruta" value={is.grossProfit} strong />
                <Row label="Otros ingresos" value={is.otherIncome} indent />
                {is.expensesByCategory.map((e: any) => <Row key={e.category} label={e.label} value={e.total} indent negative />)}
                <Row label="Utilidad neta estimada" value={is.netProfit} strong />
              </div>
              <p className="text-[11px] text-ink-muted mt-3">Impuestos cobrados en ventas (no son ingreso del negocio): {money(is.taxCollected)}. La compra de mercancía se refleja en el costo de ventas, no como gasto.</p>
            </Card>
            <div className="space-y-5">
              <Card title="Gastos por categoría"><CategoryBars data={is.expensesByCategory} /></Card>
              {cf && (
                <Card title="Flujo de caja">
                  <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                    <div><p className="text-xs text-ink-muted">Entradas</p><p className="font-semibold tabular-nums">{money(cf.inflows)}</p></div>
                    <div><p className="text-xs text-ink-muted">Salidas</p><p className="font-semibold tabular-nums">{money(cf.outflows)}</p></div>
                    <div><p className="text-xs text-ink-muted">Neto</p><p className={`font-semibold tabular-nums ${cf.net < 0 ? 'text-bad' : 'text-ok'}`}>{money(cf.net)}</p></div>
                  </div>
                  <CashFlowChart data={cf.series} />
                </Card>
              )}
            </div>
          </div>
          <Disclaimer>{is.disclaimer} DREAMS diferencia la contabilidad administrativa/gerencial (para decidir) de la contabilidad financiera formal (NIIF, libros oficiales, declaraciones tributarias), que debe llevarla o revisarla un contador público cuando la ley lo exige.</Disclaimer>
        </div>
      )}
    </>
  );
}
