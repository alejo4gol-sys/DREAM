import Decimal from 'decimal.js';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

/** Convierte cualquier valor monetario (string de la BD, number, null) a Decimal. */
export const D = (v: Decimal.Value | null | undefined) => new Decimal(v ?? 0);
/** Formato para guardar en columnas numeric(14,2). */
export const m2 = (v: Decimal.Value) => new Decimal(v).toDecimalPlaces(2).toFixed(2);
/** Número JS para respuestas de agregados (solo presentación). */
export const num = (v: Decimal.Value | null | undefined) => Number(D(v).toDecimalPlaces(2).toString());

export { Decimal };
