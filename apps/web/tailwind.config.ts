import type { Config } from 'tailwindcss';

// Identidad DREAM: blanco, negro y beige por defecto; cada negocio puede elegir su paleta.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Texto: siempre oscuro para legibilidad
        ink: { DEFAULT: '#111111', soft: '#2A2826', muted: '#6B645A', faint: '#9A9285' },
        // Colores de marca del negocio (variables CSS, ver src/lib/theme.ts)
        primary: { DEFAULT: v('--primary'), soft: v('--primary-soft') },
        'on-primary': v('--on-primary'),
        sand: { 50: v('--sand-50'), 100: v('--sand-100'), 200: v('--sand-200'), 300: v('--sand-300'), 400: v('--sand-400'), 500: v('--sand-500'), 600: v('--sand-600') },
        line: v('--line'),
        ok: '#2F6B4F',
        warn: '#9A6A12',
        bad: '#A23B2A',
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: {
        card: '0 1px 2px rgba(17,17,17,.04), 0 1px 1px rgba(17,17,17,.02)',
        pop: '0 12px 32px -8px rgba(17,17,17,.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
