/**
 * Tema de marca por negocio.
 * Con solo dos colores (principal y acento) se derivan todas las variables CSS:
 *  --primary / --primary-soft / --on-primary  → menú lateral, botones, tarjetas destacadas
 *  --sand-50 … --sand-600 / --line             → fondos, bordes y realces (tintes del acento)
 * El texto (ink) se mantiene oscuro para conservar la legibilidad.
 */
export type BrandColors = { primary: string; accent: string; paletteId?: string };

export const DEFAULT_BRAND: BrandColors = { primary: '#111111', accent: '#B69C72', paletteId: 'dream' };

type RGB = [number, number, number];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export function hexToRgb(hex: string): RGB {
  const h = isHex(hex) ? hex.slice(1) : '111111';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const rgbToHex = (c: RGB) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');

/** Mezcla a→b en proporción t (0 = a, 1 = b). */
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function luminance([r, g, b]: RGB) {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: RGB, b: RGB) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto legible sobre un color: blanco o casi negro, el de mayor contraste. */
export const onColor = (c: RGB): RGB => (contrast(c, WHITE) >= contrast(c, [17, 17, 17]) ? WHITE : [17, 17, 17]);

export function deriveTheme(brand: BrandColors) {
  const p = hexToRgb(brand.primary);
  const a = hexToRgb(brand.accent);
  const on = onColor(p);
  const soft = mix(p, on[0] === 255 ? WHITE : BLACK, 0.14);
  const sand: Record<string, RGB> = {
    50: mix(WHITE, a, 0.05), 100: mix(WHITE, a, 0.11), 200: mix(WHITE, a, 0.22), 300: mix(WHITE, a, 0.38),
    400: mix(WHITE, a, 0.65), 500: a, 600: mix(a, BLACK, 0.3),
  };
  // El tono 600 se usa como texto/ícono: si queda muy claro, se oscurece hasta ser legible.
  let s600 = sand[600];
  for (let i = 0; i < 6 && contrast(s600, sand[100]) < 3; i++) s600 = mix(s600, BLACK, 0.25);
  sand[600] = s600;
  const line = mix(WHITE, a, 0.17);
  return { primary: p, primarySoft: soft, onPrimary: on, sand, line };
}

const triple = (c: RGB) => c.map((x) => Math.round(x)).join(' ');

export function applyTheme(brand: BrandColors | null | undefined) {
  if (typeof document === 'undefined') return;
  const t = deriveTheme(brand && isHex(brand.primary) && isHex(brand.accent) ? brand : DEFAULT_BRAND);
  const root = document.documentElement.style;
  root.setProperty('--primary', triple(t.primary));
  root.setProperty('--primary-soft', triple(t.primarySoft));
  root.setProperty('--on-primary', triple(t.onPrimary));
  for (const [k, v] of Object.entries(t.sand)) root.setProperty(`--sand-${k}`, triple(v));
  root.setProperty('--line', triple(t.line));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', rgbToHex(t.primary));
  window.dispatchEvent(new Event('dream-theme'));
}

/** Colores ya resueltos (hex) para gráficos SVG, que no leen variables CSS. */
export function themeColors(brand?: BrandColors | null) {
  const t = deriveTheme(brand && isHex(brand.primary) && isHex(brand.accent) ? brand : DEFAULT_BRAND);
  // En gráficos el principal debe verse sobre blanco: si es muy claro, se oscurece.
  let main = t.primary;
  for (let i = 0; i < 6 && contrast(main, WHITE) < 2.2; i++) main = mix(main, BLACK, 0.25);
  return {
    primary: rgbToHex(main), accent: rgbToHex(t.sand[500]), accentLight: rgbToHex(t.sand[400]),
    grid: rgbToHex(mix(WHITE, t.sand[500], 0.12)), hover: rgbToHex(t.sand[100]), border: rgbToHex(t.line),
    series: [rgbToHex(main), rgbToHex(t.sand[500]), '#6B645A', rgbToHex(t.sand[400]), '#2F6B4F', rgbToHex(t.sand[600]), '#9A9285', rgbToHex(t.sand[300])],
  };
}
