'use client';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import {
  BENEFIT_ICONS, FIELD_LABELS, PAYMENT_PRESETS, PaymentMethod, SECTION_LIBRARY, Section, SectionItem, SiteConfig, newSection, sectionLabel,
} from '@/lib/store-site';
import { Field, Spinner, cn } from './ui';

/** Imagen: subir desde el equipo/celular o pegar un enlace. */
export function ImageInput({ label, value, onChange, hint }: { label: string; value?: string; onChange: (v: string) => void; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr('');
    try { const form = new FormData(); form.append('file', file); const r = await api<{ url: string }>('/uploads/image', { form }); onChange(r.url); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  return <Field label={label} hint={err ? <span className="text-bad">{err}</span> : hint}>
    <div className="flex gap-2 items-center">
      {value ? <img src={value} alt="" className="h-10 w-10 rounded-lg object-cover border border-line shrink-0" /> : <span className="h-10 w-10 rounded-lg border border-dashed border-line shrink-0" />}
      <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim())} placeholder="Sube una imagen o pega un enlace https://" />
      <label className="btn-secondary btn-sm cursor-pointer shrink-0">{busy ? <Spinner /> : <ImagePlus className="h-4 w-4" />}<span className="hidden sm:inline">Subir</span>
        <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0])} /></label>
      {value && <button type="button" className="btn-ghost !px-2" onClick={() => onChange('')} aria-label={`Quitar ${label}`}><X className="h-4 w-4" /></button>}
    </div>
  </Field>;
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-start gap-3 rounded-xl border border-line p-3 cursor-pointer">
    <input type="checkbox" className="accent-ink h-4 w-4 mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="text-xs text-ink-muted">{hint}</span>}</span>
  </label>;
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <Field label={label}><div className="flex flex-wrap gap-1.5">{options.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)}
    className={cn('chip px-3 py-1.5 text-xs border', value === v ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink-muted hover:text-ink')}>{l}</button>)}</div></Field>;
}

function ItemsEditor({ items, onChange, fields, max = 12, addLabel, blank }: {
  items: SectionItem[]; onChange: (v: SectionItem[]) => void; fields: { key: keyof SectionItem; label: string; kind?: 'text' | 'area' | 'image' | 'icon' }[]; max?: number; addLabel: string; blank: SectionItem;
}) {
  const set = (i: number, patch: Partial<SectionItem>) => onChange(items.map((it, j) => j === i ? { ...it, ...patch } : it));
  return <div className="space-y-2">
    {items.map((it, i) => <div key={i} className="rounded-xl border border-line p-3 grid sm:grid-cols-2 gap-3 relative">
      <button type="button" className="absolute top-2 right-2 btn-ghost !px-1.5 !h-7 text-bad" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="h-3.5 w-3.5" /></button>
      {fields.map((f) => f.kind === 'image' ? <div key={f.key} className="sm:col-span-2"><ImageInput label={f.label} value={it[f.key]} onChange={(v) => set(i, { [f.key]: v })} /></div>
        : f.kind === 'icon' ? <Field key={f.key} label={f.label}><select className="input" value={it.icon ?? 'check'} onChange={(e) => set(i, { icon: e.target.value })}>{BENEFIT_ICONS.map((ic) => <option key={ic} value={ic}>{ICON_NAMES[ic]}</option>)}</select></Field>
          : f.kind === 'area' ? <Field key={f.key} label={f.label} className="sm:col-span-2"><textarea className="input min-h-16" maxLength={600} value={it[f.key] ?? ''} onChange={(e) => set(i, { [f.key]: e.target.value })} /></Field>
            : <Field key={f.key} label={f.label}><input className="input" maxLength={120} value={it[f.key] ?? ''} onChange={(e) => set(i, { [f.key]: e.target.value })} /></Field>)}
    </div>)}
    {items.length < max && <button type="button" className="btn-secondary btn-sm" onClick={() => onChange([...items, { ...blank }])}><Plus className="h-4 w-4" /> {addLabel}</button>}
  </div>;
}
const ICON_NAMES: Record<string, string> = { truck: 'Camión (envíos)', shield: 'Escudo (seguridad)', star: 'Estrella (calidad)', heart: 'Corazón', clock: 'Reloj (rapidez)', leaf: 'Hoja (natural)', gift: 'Regalo', sparkles: 'Brillos', check: 'Visto bueno', map: 'Ubicación', phone: 'Teléfono', card: 'Tarjeta (pagos)' };

type Product = { id: string; name: string; imageUrl?: string | null };

/** Editor de una sección. Algunas secciones editan datos generales de la página (portada, contacto, políticas). */
function SectionFields({ sec, set, config, setConfig, products }: { sec: Section; set: (p: Partial<Section>) => void; config: SiteConfig; setConfig: (p: Partial<SiteConfig>) => void; products: Product[] }) {
  const title = <Field label="Título de la sección"><input className="input" maxLength={120} value={sec.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></Field>;
  const subtitle = <Field label="Subtítulo (opcional)"><input className="input" maxLength={300} value={sec.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} /></Field>;
  const button = <><Field label="Texto del botón"><input className="input" maxLength={40} value={sec.buttonLabel ?? ''} onChange={(e) => set({ buttonLabel: e.target.value })} /></Field>
    <Field label="Enlace del botón" hint="https://…, #catalogo, #contacto, tel: o mailto:. Vacío = WhatsApp del negocio."><input className="input" maxLength={500} value={sec.buttonUrl ?? ''} onChange={(e) => set({ buttonUrl: e.target.value.trim() })} placeholder="#catalogo" /></Field></>;
  const background = <Choice label="Fondo" value={(sec.background ?? 'light') as 'light' | 'accent' | 'dark'} options={[['light', 'Claro'], ['accent', 'Color de acento'], ['dark', 'Color principal']]} onChange={(v) => set({ background: v })} />;
  switch (sec.type) {
    case 'hero': return <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Título principal"><input className="input" maxLength={100} value={config.headline} onChange={(e) => setConfig({ headline: e.target.value })} /></Field>
      <Field label="Texto del botón"><input className="input" maxLength={40} value={config.heroButtonText} onChange={(e) => setConfig({ heroButtonText: e.target.value })} /></Field>
      <Field label="Descripción" className="sm:col-span-2"><textarea className="input min-h-20" maxLength={1000} value={config.description} onChange={(e) => setConfig({ description: e.target.value })} /></Field>
      <div className="sm:col-span-2"><ImageInput label="Foto de portada" value={config.heroImage} onChange={(v) => setConfig({ heroImage: v })} hint="Horizontal, mínimo 1600 px de ancho para que se vea nítida." /></div>
      <div className="sm:col-span-2"><Choice label="Estilo de portada" value={config.heroLayout as any} options={[['banner', 'Foto arriba'], ['split', 'Foto al lado'], ['overlay', 'Texto sobre la foto'], ['simple', 'Solo texto']]} onChange={(v) => setConfig({ heroLayout: v })} /></div>
    </div>;
    case 'featured': return <div className="space-y-3">{title}{subtitle}
      <Field label={`Productos destacados (${(sec.productIds ?? []).length}/12)`} hint="Si no eliges ninguno se muestran los primeros 4 del catálogo.">
        <div className="max-h-56 overflow-y-auto rounded-xl border border-line divide-y divide-line">{products.map((p) => {
          const on = (sec.productIds ?? []).includes(p.id);
          return <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer"><input type="checkbox" className="accent-ink" checked={on} disabled={!on && (sec.productIds ?? []).length >= 12}
            onChange={() => set({ productIds: on ? (sec.productIds ?? []).filter((x) => x !== p.id) : [...(sec.productIds ?? []), p.id] })} />{p.imageUrl && <img src={p.imageUrl} alt="" className="h-7 w-7 rounded object-cover" />}{p.name}</label>;
        })}{!products.length && <p className="p-3 text-xs text-ink-muted">Aún no tienes productos activos.</p>}</div>
      </Field></div>;
    case 'catalog': return <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Título del catálogo"><input className="input" maxLength={80} value={config.catalogTitle} onChange={(e) => setConfig({ catalogTitle: e.target.value })} /></Field>
      <Field label="Texto del botón de producto"><input className="input" maxLength={32} value={config.productButtonText} onChange={(e) => setConfig({ productButtonText: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Choice label="Diseño del catálogo" value={config.layout as any} options={[['grid', 'Cuadrícula'], ['editorial', 'Editorial (grande)'], ['minimal', 'Compacto'], ['list', 'Lista / menú']]} onChange={(v) => setConfig({ layout: v })} /></div>
      <div className="sm:col-span-2"><Choice label="Orden inicial" value={config.sortDefault as any} options={[['name', 'Nombre'], ['price-asc', 'Menor precio'], ['price-desc', 'Mayor precio'], ['newest', 'Más nuevos']]} onChange={(v) => setConfig({ sortDefault: v })} /></div>
      <Toggle label="Buscador y favoritos" checked={config.showSearch} onChange={(v) => setConfig({ showSearch: v })} />
      <Toggle label="Mostrar descripciones" checked={config.showProductDescription} onChange={(v) => setConfig({ showProductDescription: v })} />
    </div>;
    case 'about': return <div className="grid sm:grid-cols-2 gap-3">{title}<span />
      <Field label="Tu historia" className="sm:col-span-2"><textarea className="input min-h-28" maxLength={3000} value={sec.text ?? ''} onChange={(e) => set({ text: e.target.value })} /></Field>
      <div className="sm:col-span-2"><ImageInput label="Foto" value={sec.image} onChange={(v) => set({ image: v })} /></div>{button}</div>;
    case 'benefits': return <div className="space-y-3">{title}<ItemsEditor items={sec.items ?? []} onChange={(items) => set({ items })} addLabel="Agregar beneficio" blank={{ icon: 'check', title: '', text: '' }}
      fields={[{ key: 'icon', label: 'Ícono', kind: 'icon' }, { key: 'title', label: 'Título' }, { key: 'text', label: 'Descripción', kind: 'area' }]} /></div>;
    case 'gallery': return <div className="space-y-3">{title}<ItemsEditor items={sec.items ?? []} onChange={(items) => set({ items })} addLabel="Agregar foto" blank={{ image: '', title: '' }}
      fields={[{ key: 'image', label: 'Foto', kind: 'image' }, { key: 'title', label: 'Pie de foto (opcional)' }]} /></div>;
    case 'testimonials': return <div className="space-y-3">{title}<p className="text-xs text-ink-muted">Usa solo comentarios reales que te hayan dejado tus clientes (puedes copiarlos de Instagram, WhatsApp o Google) y pídeles permiso para publicarlos.</p>
      <ItemsEditor items={sec.items ?? []} onChange={(items) => set({ items })} addLabel="Agregar opinión" blank={{ title: '', text: '' }}
        fields={[{ key: 'title', label: 'Nombre del cliente' }, { key: 'text', label: 'Comentario', kind: 'area' }, { key: 'image', label: 'Foto (opcional)', kind: 'image' }]} /></div>;
    case 'faq': return <div className="space-y-3">{title}<ItemsEditor items={sec.items ?? []} onChange={(items) => set({ items })} addLabel="Agregar pregunta" blank={{ title: '', text: '' }}
      fields={[{ key: 'title', label: 'Pregunta' }, { key: 'text', label: 'Respuesta', kind: 'area' }]} /></div>;
    case 'video': return <div className="grid sm:grid-cols-2 gap-3">{title}<Field label="Enlace de YouTube o Vimeo"><input className="input" value={sec.videoUrl ?? ''} onChange={(e) => set({ videoUrl: e.target.value.trim() })} placeholder="https://www.youtube.com/watch?v=…" /></Field></div>;
    case 'cta': return <div className="grid sm:grid-cols-2 gap-3">{title}<span /><Field label="Mensaje" className="sm:col-span-2"><textarea className="input min-h-16" maxLength={3000} value={sec.text ?? ''} onChange={(e) => set({ text: e.target.value })} /></Field>{button}<div className="sm:col-span-2">{background}</div></div>;
    case 'newsletter': return <div className="grid sm:grid-cols-2 gap-3">{title}<Field label="Texto del botón"><input className="input" maxLength={40} value={sec.buttonLabel ?? ''} onChange={(e) => set({ buttonLabel: e.target.value })} /></Field>
      <Field label="Mensaje" className="sm:col-span-2"><textarea className="input min-h-16" maxLength={3000} value={sec.text ?? ''} onChange={(e) => set({ text: e.target.value })} /></Field><div className="sm:col-span-2">{background}</div>
      <p className="sm:col-span-2 text-xs text-ink-muted">El botón abre un chat de WhatsApp con tu número. Necesita el WhatsApp del negocio (pestaña General).</p></div>;
    case 'contact': return <div className="grid sm:grid-cols-2 gap-3">{title}<span />
      <Field label="Dirección" hint="Vacío = la dirección registrada del negocio."><input className="input" maxLength={255} value={config.contactAddress} onChange={(e) => setConfig({ contactAddress: e.target.value })} /></Field>
      <Field label="Horario"><input className="input" maxLength={255} value={config.contactHours} onChange={(e) => setConfig({ contactHours: e.target.value })} placeholder="Lun a sáb 9:00 a.m. – 7:00 p.m." /></Field>
      <Field label="Teléfono"><input className="input" maxLength={40} value={config.contactPhone} onChange={(e) => setConfig({ contactPhone: e.target.value })} /></Field>
      <Field label="Correo"><input className="input" maxLength={120} value={config.contactEmail} onChange={(e) => setConfig({ contactEmail: e.target.value })} /></Field>
      <Field label="Enlace de Google Maps (opcional)" className="sm:col-span-2"><input className="input" value={config.mapUrl} onChange={(e) => setConfig({ mapUrl: e.target.value.trim() })} placeholder="https://maps.app.goo.gl/…" /></Field></div>;
    case 'policies': return <div className="space-y-3">{title}
      <Field label="Cambios y devoluciones"><textarea className="input min-h-20" maxLength={3000} value={config.returnsPolicy} onChange={(e) => setConfig({ returnsPolicy: e.target.value })} placeholder="Ej. Tienes 5 días hábiles para cambios con la etiqueta puesta…" /></Field>
      <Field label="Tratamiento de datos personales" hint="Si lo dejas vacío se muestra un texto básico. Para negocios formales en Colombia, revisa tu política con tu asesor (Ley 1581 de 2012)."><textarea className="input min-h-20" maxLength={3000} value={config.privacyPolicy} onChange={(e) => setConfig({ privacyPolicy: e.target.value })} /></Field>
      <p className="text-xs text-ink-muted">La política de envíos se arma con lo que configures en la pestaña Entregas.</p></div>;
    default: return null;
  }
}

export function SectionsEditor({ config, setConfig, products }: { config: SiteConfig; setConfig: (p: Partial<SiteConfig>) => void; products: Product[] }) {
  const [open, setOpen] = useState<string | null>(config.sections[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const sections = config.sections;
  const update = (next: Section[]) => setConfig({ sections: next });
  const move = (i: number, d: -1 | 1) => { const next = [...sections]; const j = i + d; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; update(next); };
  return <div className="space-y-2">
    {sections.map((sec, i) => <div key={sec.id} className={cn('rounded-xl border bg-white', open === sec.id ? 'border-ink/40' : 'border-line')}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" className="flex-1 text-left min-w-0" onClick={() => setOpen(open === sec.id ? null : sec.id)}>
          <span className={cn('text-sm font-medium', !sec.enabled && 'text-ink-faint line-through')}>{sectionLabel(sec.type)}</span>
          {sec.title && sec.type !== 'hero' && <span className="text-xs text-ink-muted ml-2 truncate">· {sec.title}</span>}
        </button>
        <button type="button" className="btn-ghost !px-1.5 !h-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" className="btn-ghost !px-1.5 !h-7" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
        <button type="button" className="btn-ghost !px-1.5 !h-7" onClick={() => update(sections.map((x) => x.id === sec.id ? { ...x, enabled: !x.enabled } : x))} aria-label={sec.enabled ? 'Ocultar sección' : 'Mostrar sección'} title={sec.enabled ? 'Ocultar' : 'Mostrar'}>{sec.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
        <button type="button" className="btn-ghost !px-1.5 !h-7 text-bad" onClick={() => update(sections.filter((x) => x.id !== sec.id))} aria-label="Eliminar sección"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {open === sec.id && <div className="border-t border-line p-3"><SectionFields sec={sec} config={config} setConfig={setConfig} products={products}
        set={(patch) => update(sections.map((x) => x.id === sec.id ? { ...x, ...patch } : x))} /></div>}
    </div>)}
    {sections.length < 20 && (adding
      ? <div className="rounded-xl border border-dashed border-line p-3"><div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">Agregar sección</p><button type="button" className="btn-ghost !px-1.5 !h-7" onClick={() => setAdding(false)} aria-label="Cerrar"><X className="h-4 w-4" /></button></div>
        <div className="grid sm:grid-cols-2 gap-2">{SECTION_LIBRARY.map((l) => {
          const taken = l.unique && sections.some((x) => x.type === l.type);
          return <button key={l.type} type="button" disabled={taken} className="text-left rounded-lg border border-line p-2.5 hover:border-ink/40 disabled:opacity-40"
            onClick={() => { const s = newSection(l.type, sections); const id = sections.some((x) => x.id === s.id) ? `${l.type}-${Date.now().toString(36)}` : s.id; update([...sections, { ...s, id }]); setOpen(id); setAdding(false); }}>
            <span className="block text-sm font-medium">{l.label}</span><span className="text-[11px] text-ink-muted">{taken ? 'Ya está en tu página' : l.hint}</span></button>;
        })}</div></div>
      : <button type="button" className="btn-secondary w-full" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Agregar sección</button>)}
  </div>;
}

export function PaymentsEditor({ methods, onChange }: { methods: PaymentMethod[]; onChange: (m: PaymentMethod[]) => void }) {
  const set = (i: number, patch: Partial<PaymentMethod>) => onChange(methods.map((m, j) => j === i ? { ...m, ...patch } : m));
  return <div className="space-y-3">
    {methods.map((m, i) => {
      const preset = PAYMENT_PRESETS.find((p) => p.kind === m.kind);
      return <div key={i} className={cn('rounded-xl border p-3 space-y-3', m.enabled ? 'border-ink/30 bg-white' : 'border-line bg-sand-50')}>
        <div className="flex items-center gap-3">
          <input type="checkbox" className="accent-ink h-4 w-4" checked={m.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} aria-label={`Activar ${m.name}`} />
          <input className="input flex-1" maxLength={60} value={m.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Nombre que verá el cliente" />
          <button type="button" className="btn-ghost !px-2 text-bad" onClick={() => onChange(methods.filter((_, j) => j !== i))} aria-label={`Quitar ${m.name}`}><Trash2 className="h-4 w-4" /></button>
        </div>
        {preset && <p className="text-[11px] text-ink-muted -mt-1">{preset.hint}</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {(preset?.fields ?? ['link']).map((f) => f === 'qrImage'
            ? <div key={f} className="sm:col-span-2"><ImageInput label={FIELD_LABELS.qrImage!} value={m.qrImage} onChange={(v) => set(i, { qrImage: v })} hint="Descárgalo desde la app de tu banco o billetera." /></div>
            : f === 'accountType' ? <Field key={f} label={FIELD_LABELS[f]!}><select className="input" value={m.accountType ?? ''} onChange={(e) => set(i, { accountType: e.target.value })}><option value="">Elige…</option><option>Ahorros</option><option>Corriente</option></select></Field>
              : <Field key={f} label={FIELD_LABELS[f] ?? f}><input className="input" value={(m[f] as string) ?? ''} maxLength={f === 'link' ? 500 : 120} placeholder={f === 'link' ? 'https://…' : undefined} onChange={(e) => set(i, { [f]: f === 'link' ? e.target.value.trim() : e.target.value })} /></Field>)}
          <Field label="Instrucciones para el cliente (opcional)" className="sm:col-span-2"><input className="input" maxLength={240} value={m.instructions ?? ''} onChange={(e) => set(i, { instructions: e.target.value })} placeholder="Ej. Envía el comprobante por WhatsApp" /></Field>
        </div>
      </div>;
    })}
    {methods.length < 12 && <div><p className="label mb-2">Agregar medio de pago</p><div className="flex flex-wrap gap-2">{PAYMENT_PRESETS.map((p) =>
      <button key={p.kind} type="button" className="btn-secondary btn-sm" onClick={() => onChange([...methods, { name: p.name, kind: p.kind, instructions: '', enabled: true }])}><Plus className="h-3.5 w-3.5" /> {p.name}</button>)}</div></div>}
  </div>;
}

export function Panel({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return <div className="space-y-3"><div><h3 className="text-sm font-semibold">{title}</h3>{description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}</div>{children}</div>;
}
