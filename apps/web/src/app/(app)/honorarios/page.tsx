'use client';
import { FeeCalculator } from '@/components/fee-calculator';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function HonorariosPage() {
  const { current } = useAuth();
  const legal = current?.serviceProfile === 'LEGAL';
  return <>
    <div className="no-print">
      <PageHeader title={legal ? 'Calculadora de honorarios' : 'Cotizador de tarifas'}
        subtitle={legal
          ? 'Calcula cuánto cobrar por un caso según el asunto, la especialidad y la cuantía, con la tabla de tarifas de abogados 2026.'
          : 'Calcula cuánto cobrar con tablas de referencia y precios promedio en Colombia, y envía la propuesta a tu cliente.'} />
    </div>
    <FeeCalculator />
  </>;
}
