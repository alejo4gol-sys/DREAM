'use client';
import { FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import { useState } from 'react';
import { PeriodPicker, usePeriod } from '@/components/period';
import { Badge, Card, Loading, PageHeader, Spinner, useToast } from '@/components/ui';
import { download } from '@/lib/api';
import { qs, useApi } from '@/lib/hooks';

const FORMATS = [
  { f: 'csv', label: 'CSV', icon: Sheet },
  { f: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { f: 'pdf', label: 'PDF', icon: FileText },
] as const;

const DESC: Record<string, string> = {
  sales: 'Detalle de cada venta con canal, pago, impuestos y costo.',
  expenses: 'Gastos por categoría, proveedor y estado.',
  incomes: 'Ingresos distintos a ventas.',
  profit: 'Estado de resultados gerencial del período.',
  'cash-flow': 'Entradas y salidas de dinero por día.',
  inventory: 'Existencias, mínimos y valor del inventario (fecha actual).',
  customers: 'Clientes con compras acumuladas y última compra.',
  suppliers: 'Proveedores y saldo pendiente.',
  'bank-transactions': 'Movimientos bancarios registrados o importados.',
  reconciliations: 'Asociaciones entre movimientos y ventas.',
  social: 'Ventas y pedidos por canal (redes, tienda, web).',
};

export default function ReportsPage() {
  const toast = useToast();
  const period = usePeriod('month');
  const { data: types } = useApi<any[]>('/reports');
  const { data: plan } = useApi<any>('/businesses/current/plan');
  const [busy, setBusy] = useState<string | null>(null);
  const allowed: string[] = plan?.limits.reportFormats ?? ['csv'];

  const get = async (type: string, format: string) => {
    setBusy(type + format);
    try { await download(`/reports/${type}${qs({ format, from: period.from, to: period.to })}`, `dream-${type}-${period.from}_${period.to}.${format}`); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(null); }
  };

  return (
    <>
      <PageHeader title="Reportes" subtitle="Consulta y descarga tu información por período." actions={<PeriodPicker {...period} />} />
      {plan && <p className="text-xs text-ink-muted mb-4">Tu plan <b>{plan.name}</b> permite exportar en: {allowed.map((a) => a.toUpperCase()).join(', ')}.</p>}
      {!types ? <Loading /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {types.map((t) => (
            <Card key={t.type}>
              <p className="font-semibold">{t.label}</p>
              <p className="text-sm text-ink-muted mt-1 min-h-[40px]">{DESC[t.type]}</p>
              <div className="flex gap-2 mt-4">
                {FORMATS.map(({ f, label, icon: Icon }) => (
                  <button key={f} className="btn-secondary btn-sm flex-1" disabled={!allowed.includes(f) || !!busy} onClick={() => get(t.type, f)} title={allowed.includes(f) ? `Descargar ${label}` : 'No incluido en tu plan'}>
                    {busy === t.type + f ? <Spinner /> : <Icon className="h-3.5 w-3.5" />} {label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      {plan && !allowed.includes('pdf') && <div className="mt-4"><Badge tone="sand">Mejora tu plan para exportar en Excel y PDF</Badge></div>}
    </>
  );
}
