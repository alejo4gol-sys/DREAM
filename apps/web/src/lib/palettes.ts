import type { BrandColors } from './theme';

export interface Palette extends BrandColors { id: string; name: string; group: string }

/**
 * Galería de paletas. Cada una define el color principal (menú, botones) y el de acento
 * (fondos, bordes y realces se generan como tintes del acento). Además, el selector permite
 * elegir CUALQUIER color con el selector libre.
 */
export const PALETTES: Palette[] = [
  // Neutros y elegantes
  { id: 'dream', name: 'DREAMS (blanco, negro y beige)', group: 'Neutros y elegantes', primary: '#111111', accent: '#B69C72' },
  { id: 'grafito', name: 'Grafito', group: 'Neutros y elegantes', primary: '#2B2B2B', accent: '#9CA3AF' },
  { id: 'carbon-oro', name: 'Carbón y oro', group: 'Neutros y elegantes', primary: '#1C1C1C', accent: '#C9A227' },
  { id: 'piedra', name: 'Piedra', group: 'Neutros y elegantes', primary: '#57534E', accent: '#A8A29E' },
  { id: 'monocromo', name: 'Monocromo', group: 'Neutros y elegantes', primary: '#000000', accent: '#737373' },
  { id: 'champana', name: 'Champaña', group: 'Neutros y elegantes', primary: '#3F3A34', accent: '#D8C3A5' },

  // Cálidos
  { id: 'terracota', name: 'Terracota', group: 'Cálidos', primary: '#9A3412', accent: '#E9A27A' },
  { id: 'coral', name: 'Coral', group: 'Cálidos', primary: '#E5533D', accent: '#FFB4A2' },
  { id: 'mostaza', name: 'Mostaza', group: 'Cálidos', primary: '#7C5E10', accent: '#E3B505' },
  { id: 'naranja', name: 'Naranja', group: 'Cálidos', primary: '#EA580C', accent: '#FDBA74' },
  { id: 'vino', name: 'Vino', group: 'Cálidos', primary: '#7F1D1D', accent: '#D4A5A5' },
  { id: 'rojo', name: 'Rojo intenso', group: 'Cálidos', primary: '#B91C1C', accent: '#F87171' },
  { id: 'canela', name: 'Canela', group: 'Cálidos', primary: '#7B4B2A', accent: '#D2A679' },

  // Fríos
  { id: 'azul-marino', name: 'Azul marino', group: 'Fríos', primary: '#1E3A8A', accent: '#93C5FD' },
  { id: 'azul', name: 'Azul', group: 'Fríos', primary: '#2563EB', accent: '#60A5FA' },
  { id: 'petroleo', name: 'Petróleo', group: 'Fríos', primary: '#134E4A', accent: '#5EEAD4' },
  { id: 'turquesa', name: 'Turquesa', group: 'Fríos', primary: '#0E7490', accent: '#67E8F9' },
  { id: 'indigo', name: 'Índigo', group: 'Fríos', primary: '#3730A3', accent: '#A5B4FC' },
  { id: 'acero', name: 'Acero', group: 'Fríos', primary: '#334155', accent: '#94A3B8' },

  // Pastel
  { id: 'rosa-pastel', name: 'Rosa pastel', group: 'Pastel', primary: '#F9A8D4', accent: '#FBCFE8' },
  { id: 'lavanda', name: 'Lavanda', group: 'Pastel', primary: '#C4B5FD', accent: '#DDD6FE' },
  { id: 'menta', name: 'Menta', group: 'Pastel', primary: '#86EFAC', accent: '#BBF7D0' },
  { id: 'cielo', name: 'Cielo', group: 'Pastel', primary: '#7DD3FC', accent: '#BAE6FD' },
  { id: 'durazno', name: 'Durazno', group: 'Pastel', primary: '#FDBA8C', accent: '#FED7AA' },
  { id: 'vainilla', name: 'Vainilla', group: 'Pastel', primary: '#FDE68A', accent: '#FEF3C7' },

  // Vibrantes
  { id: 'fucsia', name: 'Fucsia', group: 'Vibrantes', primary: '#C026D3', accent: '#F0ABFC' },
  { id: 'morado', name: 'Morado', group: 'Vibrantes', primary: '#7E22CE', accent: '#C084FC' },
  { id: 'rosa', name: 'Rosa', group: 'Vibrantes', primary: '#DB2777', accent: '#F9A8D4' },
  { id: 'lima', name: 'Lima', group: 'Vibrantes', primary: '#4D7C0F', accent: '#A3E635' },
  { id: 'amarillo', name: 'Amarillo', group: 'Vibrantes', primary: '#FACC15', accent: '#FDE047' },
  { id: 'electrico', name: 'Azul eléctrico', group: 'Vibrantes', primary: '#1D4ED8', accent: '#22D3EE' },

  // Naturales
  { id: 'oliva', name: 'Oliva', group: 'Naturales', primary: '#4D5B23', accent: '#B5BF8A' },
  { id: 'bosque', name: 'Bosque', group: 'Naturales', primary: '#14532D', accent: '#86C29B' },
  { id: 'salvia', name: 'Salvia', group: 'Naturales', primary: '#5F7161', accent: '#B7C9B0' },
  { id: 'arena', name: 'Arena', group: 'Naturales', primary: '#8B6F47', accent: '#E3CFA9' },
  { id: 'cafe', name: 'Café', group: 'Naturales', primary: '#3E2723', accent: '#A1887F' },
  { id: 'esmeralda', name: 'Esmeralda', group: 'Naturales', primary: '#047857', accent: '#6EE7B7' },

  // Oscuros y lujo
  { id: 'noche', name: 'Noche y plata', group: 'Oscuros y lujo', primary: '#0F172A', accent: '#CBD5E1' },
  { id: 'esmeralda-oro', name: 'Esmeralda y oro', group: 'Oscuros y lujo', primary: '#064E3B', accent: '#D4AF37' },
  { id: 'burdeos-oro', name: 'Burdeos y oro', group: 'Oscuros y lujo', primary: '#4A0E1C', accent: '#C9A227' },
  { id: 'azul-oro', name: 'Azul real y oro', group: 'Oscuros y lujo', primary: '#172554', accent: '#E0B84E' },
  { id: 'negro-rosa', name: 'Negro y rosa', group: 'Oscuros y lujo', primary: '#18181B', accent: '#F472B6' },
  { id: 'berenjena', name: 'Berenjena', group: 'Oscuros y lujo', primary: '#3B0764', accent: '#D8B4FE' },
];

export const PALETTE_GROUPS = [...new Set(PALETTES.map((p) => p.group))];
