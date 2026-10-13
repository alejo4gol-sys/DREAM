'use client';
import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PALETTE_GROUPS, PALETTES } from '@/lib/palettes';
import { BrandColors, DEFAULT_BRAND, deriveTheme, isHex, rgbToHex } from '@/lib/theme';
import { cn } from './ui';

const css = (c: number[]) => `rgb(${c.map(Math.round).join(',')})`;

/** Vista previa en miniatura de cómo se verá la app con la paleta. */
export function PalettePreview({ brand, name }: { brand: BrandColors; name?: string }) {
  const t = useMemo(() => deriveTheme(brand), [brand]);
  return (
    <div className="rounded-2xl overflow-hidden border shadow-card flex h-44 text-[10px]" style={{ borderColor: css(t.line), background: css(t.sand[50]) }} aria-label="Vista previa de la paleta">
      <div className="w-24 p-2.5 space-y-1.5" style={{ background: css(t.primary), color: css(t.onPrimary) }}>
        <p className="font-semibold tracking-[0.2em] mb-2 truncate">{(name || 'TU MARCA').toUpperCase()}</p>
        <p className="rounded-md px-1.5 py-1 font-medium" style={{ background: css(t.sand[50]), color: '#111' }}>Dashboard</p>
        {['Ventas', 'Productos', 'Clientes'].map((x) => <p key={x} className="px-1.5 opacity-75">{x}</p>)}
      </div>
      <div className="flex-1 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-[12px] text-ink">Hola</p>
          <span className="rounded-md px-2 py-1 font-medium" style={{ background: css(t.primary), color: css(t.onPrimary) }}>+ Nueva venta</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2" style={{ background: css(t.primary), color: css(t.onPrimary) }}><p className="opacity-70">Ventas hoy</p><p className="font-semibold text-[12px]">$1,9 M</p></div>
          <div className="rounded-lg p-2 bg-white border" style={{ borderColor: css(t.line) }}><p className="text-ink-muted">Pedidos</p><p className="font-semibold text-[12px] text-ink">48</p></div>
        </div>
        <div className="rounded-lg p-2 bg-white border flex items-end gap-1 h-12" style={{ borderColor: css(t.line) }}>
          {[40, 65, 50, 80, 70, 100].map((h, i) => <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 5 ? css(t.primary) : css(t.sand[300]) }} />)}
        </div>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input type="color" className="h-10 w-12 rounded-lg border border-line bg-white p-1 cursor-pointer" value={isHex(value) ? value : '#000000'}
          onChange={(e) => { setText(e.target.value.toUpperCase()); onChange(e.target.value.toUpperCase()); }} aria-label={`${label} (selector)`} />
        <input className="input font-mono uppercase" maxLength={7} value={text} placeholder="#RRGGBB"
          onChange={(e) => { const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value; setText(v.toUpperCase()); if (isHex(v)) onChange(v.toUpperCase()); }} aria-label={`${label} (código hex)`} />
      </div>
    </label>
  );
}

/**
 * Selector de paleta de marca: galería completa por grupos + colores 100% personalizados.
 */
export function PalettePicker({ value, onChange, businessName }: { value: BrandColors | null | undefined; onChange: (v: BrandColors) => void; businessName?: string }) {
  const current = value && isHex(value.primary) && isHex(value.accent) ? value : DEFAULT_BRAND;
  const [group, setGroup] = useState<string>(() => PALETTES.find((p) => p.id === current.paletteId)?.group ?? PALETTE_GROUPS[0]);
  const [query, setQuery] = useState('');
  const isCustom = current.paletteId === 'custom' || !PALETTES.some((p) => p.id === current.paletteId);
  const [tab, setTab] = useState<'gallery' | 'custom'>(isCustom && value ? 'custom' : 'gallery');
  const t = deriveTheme(current);
  const filteredPalettes = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return PALETTES.filter((p) => term
      ? `${p.name} ${p.group} ${p.primary} ${p.accent}`.toLocaleLowerCase('es').includes(term)
      : p.group === group);
  }, [group, query]);

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
      <div>
        <div className="inline-flex rounded-xl bg-sand-100 p-1 gap-1 mb-4">
          {([['gallery', `Paletas (${PALETTES.length})`], ['custom', 'Personalizada']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn('px-3 h-8 rounded-lg text-xs font-medium', tab === k ? 'bg-white shadow-card text-ink' : 'text-ink-muted')}>{l}</button>
          ))}
        </div>

        {tab === 'gallery' ? (
          <>
            <label className="relative block mb-3">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
              <input className="input pl-9" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar entre todas las paletas…" aria-label="Buscar entre todas las paletas" />
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PALETTE_GROUPS.map((g) => (
                <button key={g} type="button" onClick={() => { setGroup(g); setQuery(''); }}
                  aria-pressed={!query && g === group}
                  className={cn('chip px-3 py-1 text-xs border', !query && g === group ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink-muted hover:text-ink')}>{g}</button>
              ))}
            </div>
            <p className="text-xs text-ink-muted mb-2" aria-live="polite">{query.trim() ? `${filteredPalettes.length} resultados en todas las categorías` : `${filteredPalettes.length} paletas · ${group}`}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredPalettes.map((p) => {
                const sel = current.paletteId === p.id;
                const d = deriveTheme(p);
                return (
                  <button key={p.id} type="button" onClick={() => onChange({ primary: p.primary, accent: p.accent, paletteId: p.id })}
                    className={cn('relative text-left rounded-xl border p-2.5 transition bg-white hover:shadow-card', sel ? 'border-ink ring-2 ring-ink/10' : 'border-line')} aria-pressed={sel}>
                    <div className="flex h-10 rounded-lg overflow-hidden">
                      <span className="flex-[2]" style={{ background: p.primary }} />
                      <span className="flex-1" style={{ background: p.accent }} />
                      <span className="flex-1" style={{ background: css(d.sand[200]) }} />
                      <span className="flex-1" style={{ background: css(d.sand[50]) }} />
                    </div>
                    <p className="text-xs font-medium mt-2 truncate">{p.name}</p>
                    {sel && <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-ink text-white flex items-center justify-center"><Check className="h-3 w-3" /></span>}
                  </button>
                );
              })}
            </div>
            {filteredPalettes.length === 0 && <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-muted">No encontramos paletas con “{query}”. Prueba otro nombre o código de color.</p>}
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Elige exactamente los colores de tu marca: usa el selector o pega el código (por ejemplo, el de tu logo).</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <ColorInput label="Color principal (menú y botones)" value={current.primary} onChange={(v) => onChange({ ...current, primary: v, paletteId: 'custom' })} />
              <ColorInput label="Color de acento (fondos y detalles)" value={current.accent} onChange={(v) => onChange({ ...current, accent: v, paletteId: 'custom' })} />
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
              Tonos generados:
              {Object.entries(t.sand).map(([k, c]) => <span key={k} title={`${k}: ${rgbToHex(c as [number, number, number])}`} className="h-5 w-8 rounded border border-line" style={{ background: css(c as number[]) }} />)}
            </div>
            <p className="text-[11px] text-ink-faint">El texto siempre se mantiene oscuro y, si el color principal es muy claro, los textos sobre él se oscurecen automáticamente para que se lean bien.</p>
          </div>
        )}
      </div>

      <div className="space-y-2 lg:sticky lg:top-4">
        <p className="label">Vista previa</p>
        <PalettePreview brand={current} name={businessName} />
        <p className="text-[11px] text-ink-muted">
          {PALETTES.find((p) => p.id === current.paletteId)?.name ?? 'Paleta personalizada'} · {current.primary} / {current.accent}
        </p>
      </div>
    </div>
  );
}
