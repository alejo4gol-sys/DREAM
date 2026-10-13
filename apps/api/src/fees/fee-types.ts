/**
 * Tablas de honorarios y tarifas de referencia para negocios de servicios.
 *
 * Dos clases de tablas:
 *  - TARIFF: tablas gremiales o normativas expresadas en salarios mínimos (SMMLV) y porcentajes
 *            (p. ej. CONALBOS para abogados, Decreto 2090 de 1989 para arquitectos).
 *  - MARKET: rangos de precios de mercado en pesos colombianos publicados por fuentes citadas.
 *
 * Ninguna es obligatoria: los honorarios se pactan libremente con el cliente. Son guías para cotizar.
 */

/** Tramo marginal: hasta `upTo` pesos (null = en adelante) se cobra `pct` %. */
export type Tier = [upTo: number | null, pct: number];

export interface Formula {
  /** Valor fijo en salarios mínimos (SMMLV). */
  smmlv?: number;
  /** Valor fijo en pesos. */
  cop?: number;
  /** Rango de mercado en pesos [mínimo, máximo]. El nivel de precio elige el punto. */
  range?: [number, number];
  /** Porcentaje plano sobre la base (cuantía, valor del contrato, lo obtenido…). */
  pct?: number;
  /** Porcentajes por tramos (marginales) sobre la base. */
  tiers?: Tier[];
  /** Porcentaje adicional cuando la base supera un umbral. */
  above?: { over: number; pct: number; overSmmlv?: boolean; excessOnly?: boolean };
  /** Mínimo en salarios mínimos. */
  minSmmlv?: number;
}

export type Cuantia = 'MINIMA' | 'MENOR' | 'MAYOR';
export type ModKey = 'MEDIDAS' | 'CONCILIACION' | 'NOTARIA' | 'OPOSICION' | 'MINMINAS' | 'CONSEJO_ESTADO';

export interface FeeVariant { key: string; label: string; f: Formula; note?: string }

export interface FeeItem {
  key: string;
  /** Numeral en la tabla fuente (p. ej. «12.4»). */
  ref?: string;
  area: string;
  label: string;
  f?: Formula;
  /** Fórmula según la cuantía (Código General del Proceso, art. 25). */
  byCuantia?: Partial<Record<Cuantia, Formula>>;
  variants?: FeeVariant[];
  /** Qué valor se pide para calcular (cuando la fórmula usa porcentajes). */
  base?: string;
  /** Unidad cuando se cobra por cantidad: «hora», «mes», «clase»… */
  unit?: string;
  note?: string;
  mods?: ModKey[];
  /** El porcentaje depende de lo que se obtenga en el caso (honorario de resultado). */
  success?: boolean;
  /** Clave de la fuente (para tablas de mercado). */
  source?: string;
  /** Palabras extra para el buscador. */
  tags?: string;
}

export interface FeeArea { key: string; label: string }
export interface FeeSource { key: string; label: string; url?: string; note?: string }

export interface FeeTable {
  key: string;
  /** Perfil de servicio al que aplica por defecto (LEGAL, HEALTH…). */
  profile: string;
  title: string;
  profession: string;
  kind: 'TARIFF' | 'MARKET';
  areas: FeeArea[];
  items: FeeItem[];
  sources: FeeSource[];
  disclaimer: string;
  notes?: string[];
}

export const MODS: Record<ModKey, { label: string; help: string; factor?: number; addPct?: number; addSmmlv?: number }> = {
  MEDIDAS: { label: 'Medidas previas, incidentes o terceros (+10 %)', help: 'Si hay solicitud de medidas previas, incidentes o intervención de terceros el honorario aumenta 10 %.', addPct: 10 },
  CONCILIACION: { label: 'Termina por conciliación (50 %)', help: 'Cuando el asunto termina por conciliación en el juzgado o en un centro de conciliación, los honorarios son el 50 %.', factor: 0.5 },
  NOTARIA: { label: 'Se tramita ante notaría (50 %)', help: 'Los trámites que corresponden a las notarías se cobran al 50 % del proceso judicial equivalente.', factor: 0.5 },
  OPOSICION: { label: 'Hay oposición (+50 %)', help: 'Cuando exista oposición, los honorarios aumentan 50 %.', addPct: 50 },
  MINMINAS: { label: 'Trámite ante el Ministerio de Minas (+30 %)', help: 'Los trámites ante el Ministerio de Minas y Energía aumentan 30 %.', addPct: 30 },
  CONSEJO_ESTADO: { label: 'Única instancia en el Consejo de Estado (+30 %)', help: 'Si el negocio es de competencia del Consejo de Estado en única instancia, el honorario aumenta 30 %.', addPct: 30 },
};

/** Ajuste por ciudad para tablas de mercado (Bogotá = 1). Proporciones de las tarifas de psicología por ciudad publicadas por cuantomecuesta.com (abril 2026). */
export const CITY_FACTORS: Record<string, { label: string; factor: number }> = {
  BOGOTA: { label: 'Bogotá', factor: 1 },
  MEDELLIN: { label: 'Medellín', factor: 0.92 },
  CALI: { label: 'Cali', factor: 0.83 },
  BARRANQUILLA: { label: 'Barranquilla', factor: 0.78 },
  OTHER: { label: 'Otra ciudad o municipio', factor: 0.7 },
};

export const LEVELS: Record<string, { label: string; at: number }> = {
  LOW: { label: 'Económico', at: 0 },
  MID: { label: 'Promedio', at: 0.5 },
  HIGH: { label: 'Alto', at: 1 },
};
