'use client';
import { FileUp, ImagePlus, Package, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Pagination, Spinner, TableWrap, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { qs, useApi, useDebounced } from '@/lib/hooks';

const empty = { sku: '', barcode: '', name: '', description: '', categoryId: '', supplierId: '', costPrice: '', salePrice: '', taxRate: '0', minStock: '0', initialStock: '0', imageUrl: '', storeOptions: [], optionsText: '', preparationMinutes: '', depositPercent: '0' };
function optionsToText(options: any[] = []) {
  return options.map((o) => {
    if (['date', 'time', 'text'].includes(o.type)) return `${o.name} [${o.type}]${o.required ? '' : '?'}`;
    const choices = (o.choices ?? []).map((c: any) => c.priceDelta ? `${c.label}=${c.priceDelta}` : c.label).join(', ');
    return `${o.name}${o.type === 'multi' ? ' [varios]' : ''}${o.required ? '' : '?'}: ${choices}`;
  }).join('\n');
}
function textToOptions(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const optional = line.endsWith('?'); if (optional) line = line.slice(0, -1).trim();
    const match = line.match(/^(.+?)\s*\[(texto|fecha|hora|varios)\]\s*(?::\s*(.*))?$/i);
    if (match) {
      const type = match[2].toLowerCase();
      const choices = (match[3] ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((entry) => {
        const priced = entry.match(/^(.*?)\s*=\s*(\d+(?:\.\d{1,2})?)$/);
        return priced ? { label: priced[1].trim(), priceDelta: priced[2] } : { label: entry };
      });
      return { name: match[1].trim(), type: type === 'varios' ? 'multi' : type === 'texto' ? 'text' : type, required: !optional, ...(type === 'varios' ? { choices } : {}) };
    }
    const [name, values = ''] = line.split(':');
    return { name: name.trim(), type: 'select', required: !optional, choices: values.split(',').map((x) => x.trim()).filter(Boolean).map((entry) => {
      const priced = entry.match(/^(.*?)\s*=\s*(\d+(?:\.\d{1,2})?)$/);
      return priced ? { label: priced[1].trim(), priceDelta: priced[2] } : { label: entry };
    }) };
  });
}
function syncVariants(text: string, existing: any[], baseSku: string) {
  const groups = textToOptions(text).filter((o: any) => o.type === 'select');
  if (!groups.length || groups.some((g: any) => !g.choices.length)) return [];
  const combos = groups.reduce((rows: any[], group: any) => rows.flatMap((row) => group.choices.map((choice: any) => ({ ...row, [group.name]: choice.label }))), [{}]);
  return combos.map((options, index) => {
    const previous = existing.find((v) => Object.entries(options).every(([key, value]) => v.options?.[key] === value) && Object.keys(v.options ?? {}).length === Object.keys(options).length);
    return { ...(previous?.id ? { id: previous.id } : {}), sku: previous?.sku ?? `${baseSku || 'VAR'}-${String(index + 1).padStart(2, '0')}`, options,
      stock: Number(previous?.stock ?? 0), minStock: Number(previous?.minStock ?? 0) };
  });
}

export default function ProductsPage() {
  const { can, current } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any>(`/products${qs({ page, pageSize: 25, q: dq, categoryId })}`);
  const { data: cats, reload: reloadCats } = useApi<any[]>('/categories');
  const { data: sups } = useApi<any>(can('suppliers:read') ? '/suppliers?pageSize=200' : null);
  const [editing, setEditing] = useState<any | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState('');
  const newProduct = () => {
    const type = current?.businessType ?? '';
    const category = current?.category ?? '';
    const optionsText = type === 'Restaurante o comidas'
      ? 'Extras [varios]: Queso=2000, Aguacate=2500\nNotas [texto]?'
      : type === 'Servicios'
        ? 'Fecha [fecha]\nHora [hora]\nDetalles [texto]?'
        : /moda|ropa|accesorios/i.test(category)
          ? 'Talla: XS, S, M, L, XL\nColor: Negro, Blanco, Azul'
          : '';
    return { ...empty, optionsText, storeOptions: textToOptions(optionsText), variants: syncVariants(optionsText, [], empty.sku) };
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setImporting(true); setImportSummary('');
    try {
      const form = new FormData(); form.append('file', file);
      const result = await api<{ imported: number; errors: string[]; remainingErrors: number }>('/products/import-xlsx', { form });
      setImportSummary(`${result.imported} productos importados${result.errors.length ? ` · ${result.errors.length + result.remainingErrors} filas con error (${result.errors.slice(0, 2).join('; ')})` : ''}`);
      reload();
    } catch (e) { setImportSummary((e as Error).message); }
    finally { setImporting(false); }
  };

  const remove = async (p: any) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    try {
      const r = await api(`/products/${p.id}`, { method: 'DELETE' });
      toast(r.archived ? 'El producto tiene ventas: se desactivó para conservar el historial' : 'Producto eliminado');
      reload();
    } catch (e) { toast((e as Error).message, 'bad'); }
  };

  return (
    <>
      <PageHeader title="Productos" subtitle="Tu catálogo con precios, costos y stock."
        actions={can('products:write') && <>
          <label className="btn-secondary cursor-pointer"><FileUp className="h-4 w-4" />{importing ? 'Importando…' : 'Importar Excel'}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={importing} onChange={(e) => { void importFile(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
          <button className="btn-secondary" onClick={() => setCatsOpen(true)}><Tags className="h-4 w-4" /> Categorías</button>
          <button className="btn-primary" onClick={() => setEditing(newProduct())}><Plus className="h-4 w-4" /> Nuevo producto</button>
        </>} />
      {importSummary && <div className="mb-4 rounded-xl border border-line bg-white p-3 text-sm">{importSummary}<p className="mt-1 text-xs text-ink-muted">Columnas requeridas: SKU, Nombre, Precio de venta. Opcionales: Costo, Stock, Stock mínimo y Código de barras.</p></div>}
      <Card padded={false}>
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-line">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-ink-faint" />
            <input className="input pl-9" placeholder="Buscar por nombre, SKU o código de barras" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <select className="input sm:w-52" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
        {loading && !data && <Loading />}
        {data?.items.length === 0 && <Empty icon={<Package className="h-5 w-5" />} title="Aún no tienes productos" description="Crea tu primer producto para empezar a vender." action={can('products:write') && <button className="btn-primary" onClick={() => setEditing(newProduct())}>Crear producto</button>} />}
        {data?.items.length > 0 && (
          <TableWrap>
            <table className="table">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="text-right">Costo</th><th className="text-right">Precio</th><th className="text-right">Margen</th><th className="text-right">Stock</th>{can('products:write') && <th />}</tr></thead>
              <tbody>
                {data.items.map((p: any) => {
                  const margin = Number(p.salePrice) ? Math.round(((Number(p.salePrice) - Number(p.costPrice)) / Number(p.salePrice)) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-sand-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-sand-500" />}
                          </div>
                          <div className="min-w-0"><p className="font-medium truncate max-w-[260px]">{p.name}</p><p className="text-[11px] text-ink-muted">{p.sku}{p.barcode && ` · ${p.barcode}`}</p></div>
                        </div>
                      </td>
                      <td className="text-ink-muted">{p.categoryName ?? '—'}</td>
                      <td className="text-right tabular-nums text-ink-muted">{money(p.costPrice)}</td>
                      <td className="text-right tabular-nums font-medium">{money(p.salePrice)}</td>
                      <td className="text-right tabular-nums">{margin}%</td>
                      <td className="text-right"><Badge tone={p.stock <= 0 ? 'bad' : p.stock <= p.minStock ? 'warn' : 'muted'}>{p.stock}</Badge></td>
                      {can('products:write') && (
                        <td className="text-right whitespace-nowrap">
                          <button className="btn-ghost btn-sm !px-2" onClick={async () => { try { const detail = await api<any>(`/products/${p.id}`); setEditing({ ...detail, variants: detail.variants ?? [], optionsText: optionsToText(detail.storeOptions), preparationMinutes: String(detail.preparationMinutes ?? ''), depositPercent: String(detail.depositPercent ?? 0), categoryId: detail.categoryId ?? '', supplierId: detail.supplierId ?? '', costPrice: String(Number(detail.costPrice)), salePrice: String(Number(detail.salePrice)), taxRate: String(Number(detail.taxRate)), minStock: String(detail.minStock) }); } catch (e) { toast((e as Error).message, 'bad'); } }} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                          <button className="btn-ghost btn-sm !px-2 text-bad" onClick={() => remove(p)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        {data && <Pagination page={page} pageSize={25} total={data.total} onPage={setPage} />}
      </Card>
      {editing && <ProductForm initial={editing} cats={cats ?? []} sups={sups?.items ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <CategoriesModal open={catsOpen} onClose={() => setCatsOpen(false)} cats={cats ?? []} reload={reloadCats} />
    </>
  );
}

function ProductForm({ initial, cats, sups, onClose, onSaved }: { initial: any; cats: any[]; sups: any[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ ...initial, variants: initial.variants ?? [], optionsText: initial.optionsText ?? optionsToText(initial.storeOptions), appointmentSchedule: initial.appointmentSchedule ?? { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00', intervalMinutes: 30, durationMinutes: 30 } });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isNew = !initial.id;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const updateOptionsText = (value: string) => setF((x: any) => ({ ...x, optionsText: value, variants: syncVariants(value, x.variants ?? [], x.sku) }));

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      const r = await api<{ url: string }>('/uploads/image', { form });
      setF((x: any) => ({ ...x, imageUrl: r.url }));
    } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  };

  const save = async () => {
    setBusy(true); setError(null);
    const body: any = {
      sku: f.sku, name: f.name, barcode: f.barcode || undefined, description: f.description || undefined,
      categoryId: f.categoryId || null, supplierId: f.supplierId || null, costPrice: String(f.costPrice || 0), salePrice: String(f.salePrice || 0),
      taxRate: String(f.taxRate || 0), minStock: Number(f.minStock || 0), imageUrl: f.imageUrl || undefined,
      storeOptions: textToOptions(f.optionsText || ''),
      variants: (f.variants ?? []).map(({ id, sku, options, stock, minStock }: any) => ({ ...(id ? { id } : {}), sku, options, stock: Number(stock), minStock: Number(minStock ?? 0) })),
      appointmentSchedule: textToOptions(f.optionsText || '').some((o: any) => o.type === 'date' || o.type === 'time') ? f.appointmentSchedule : null,
      preparationMinutes: f.preparationMinutes ? Number(f.preparationMinutes) : undefined, depositPercent: Number(f.depositPercent || 0),
    };
    if (isNew) body.initialStock = Number(f.initialStock || 0);
    try {
      await api(isNew ? '/products' : `/products/${initial.id}`, { method: isNew ? 'POST' : 'PATCH', body });
      toast(isNew ? 'Producto creado' : 'Producto actualizado');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Nuevo producto' : 'Editar producto'} wide
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={busy || !f.name || !f.sku}>{busy && <Spinner />} Guardar</button></>}>
      <div className="grid sm:grid-cols-[140px_1fr] gap-5">
        <label className="h-36 w-full sm:w-36 rounded-2xl border border-dashed border-sand-400 bg-sand-50 flex flex-col items-center justify-center text-xs text-ink-muted cursor-pointer overflow-hidden">
          {f.imageUrl ? <img src={f.imageUrl} alt="" className="h-full w-full object-cover" /> : uploading ? <Spinner /> : <><ImagePlus className="h-5 w-5 mb-1 text-sand-500" /> Imagen</>}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          {error && <div className="sm:col-span-2"><ErrorBox message={error} /></div>}
          <Field label="Nombre *" className="sm:col-span-2"><input className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
          <Field label="SKU / código *"><input className="input" value={f.sku} onChange={set('sku')} /></Field>
          <Field label="Código de barras" hint="Conecta el lector, deja el cursor aquí y escanea la etiqueta del producto."><input className="input font-mono" autoComplete="off" inputMode="none" placeholder="Escanea o escribe el EAN / UPC" value={f.barcode ?? ''} onChange={set('barcode')} /></Field>
          <Field label="Precio de compra (costo)"><input className="input" inputMode="decimal" value={f.costPrice} onChange={set('costPrice')} /></Field>
          <Field label="Precio de venta"><input className="input" inputMode="decimal" value={f.salePrice} onChange={set('salePrice')} /></Field>
          <Field label="Categoría"><select className="input" value={f.categoryId} onChange={set('categoryId')}><option value="">Sin categoría</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Proveedor"><select className="input" value={f.supplierId} onChange={set('supplierId')}><option value="">Sin proveedor</option>{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Impuesto (IVA %)" hint="0 si no eres responsable de IVA"><select className="input" value={String(Number(f.taxRate))} onChange={set('taxRate')}><option value="0">0%</option><option value="5">5%</option><option value="19">19%</option></select></Field>
          <Field label="Stock mínimo" hint="Te avisamos al llegar a este nivel"><input className="input" inputMode="numeric" value={f.minStock} onChange={set('minStock')} /></Field>
          {isNew && <Field label="Stock inicial"><input className="input" inputMode="numeric" value={f.initialStock} onChange={set('initialStock')} /></Field>}
          <Field label="Descripción" className="sm:col-span-2"><textarea className="input" rows={2} value={f.description ?? ''} onChange={set('description')} /></Field>
          <Field label="Plantilla de opciones" className="sm:col-span-2"><select className="input" value="" onChange={(e) => { const templates: Record<string, string> = { ropa: 'Talla: XS, S, M, L, XL\nColor: Negro, Blanco, Azul', comida: 'Modificadores [varios]: Queso=2000, Aguacate=2500\nNotas [texto]?', servicios: 'Fecha [fecha]\nHora [hora]\nDetalles [texto]?' }; if (e.target.value) setF((x: any) => ({ ...x, optionsText: templates[e.target.value] })); }}><option value="">Elige un ejemplo para personalizar…</option><option value="ropa">Ropa: tallas y colores</option><option value="comida">Restaurante: extras y notas</option><option value="servicios">Servicios: fecha, hora y detalles</option></select></Field>
          <Field label="Opciones para pedidos en línea" className="sm:col-span-2" hint={'Una por línea: Talla: S, M, L · Extra [varios]: Queso=1500 · Fecha [fecha] · Hora [hora] · Notas [texto]?. Usa ? al final para que sea opcional.'}><textarea className="input min-h-28 font-mono text-xs" value={f.optionsText ?? ''} onChange={(e) => updateOptionsText(e.target.value)} placeholder={'Talla: S, M, L\nColor: Negro, Azul\nExtras [varios]: Queso=2000, Aguacate=2500\nFecha [fecha]\nHora [hora]'} /></Field>
          {textToOptions(f.optionsText ?? '').some((o: any) => o.type === 'select') && <div className="sm:col-span-2 rounded-xl border border-line p-3"><p className="text-sm font-medium">Inventario por combinación</p><p className="text-xs text-ink-muted mt-1">Cada combinación tiene SKU y existencias propias. Al entrar un pedido, DREAMS reserva esa variante.</p><div className="mt-3 space-y-2">{(f.variants ?? []).map((variant: any, index: number) => <div key={variant.id ?? `${index}-${JSON.stringify(variant.options)}`} className="grid sm:grid-cols-[1fr_110px_100px_100px] gap-2 items-center"><span className="text-xs">{Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span><input className="input" aria-label="SKU de variante" value={variant.sku} onChange={(e) => setF((x: any) => ({ ...x, variants: x.variants.map((v: any, i: number) => i === index ? { ...v, sku: e.target.value } : v) }))} /><input className="input" aria-label="Existencias de variante" type="number" min="0" value={variant.stock} onChange={(e) => setF((x: any) => ({ ...x, variants: x.variants.map((v: any, i: number) => i === index ? { ...v, stock: Number(e.target.value) } : v) }))} /><input className="input" aria-label="Stock mínimo de variante" type="number" min="0" value={variant.minStock} onChange={(e) => setF((x: any) => ({ ...x, variants: x.variants.map((v: any, i: number) => i === index ? { ...v, minStock: Number(e.target.value) } : v) }))} placeholder="Mínimo" /></div>)}</div></div>}
          <Field label="Preparación (minutos)" hint="Opcional; útil para restaurantes y productos preparados"><input className="input" type="number" min="0" value={f.preparationMinutes ?? ''} onChange={set('preparationMinutes')} placeholder="Ej. 25" /></Field>
          <Field label="Anticipo para reservar (%)" hint="0 cobra el total al pagar. Para servicios, indica el porcentaje para reservar la cita."><input className="input" type="number" min="0" max="100" value={f.depositPercent ?? '0'} onChange={set('depositPercent')} /></Field>
          {textToOptions(f.optionsText ?? '').some((o: any) => o.type === 'date' || o.type === 'time') && <div className="sm:col-span-2 rounded-xl border border-line p-4"><p className="text-sm font-medium">Agenda disponible para citas</p><div className="flex flex-wrap gap-3 mt-3">{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => <label key={day} className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.appointmentSchedule.weekdays.includes(i)} onChange={(e) => setF((x: any) => ({ ...x, appointmentSchedule: { ...x.appointmentSchedule, weekdays: e.target.checked ? [...x.appointmentSchedule.weekdays, i] : x.appointmentSchedule.weekdays.filter((d: number) => d !== i) } }))} />{day}</label>)}</div><div className="grid sm:grid-cols-4 gap-3 mt-3"><Field label="Abre"><input className="input" type="time" value={f.appointmentSchedule.startTime} onChange={(e) => setF((x: any) => ({ ...x, appointmentSchedule: { ...x.appointmentSchedule, startTime: e.target.value } }))} /></Field><Field label="Cierra"><input className="input" type="time" value={f.appointmentSchedule.endTime} onChange={(e) => setF((x: any) => ({ ...x, appointmentSchedule: { ...x.appointmentSchedule, endTime: e.target.value } }))} /></Field><Field label="Cada (min)" hint="Separación de turnos"><input className="input" type="number" min="5" step="5" value={f.appointmentSchedule.intervalMinutes} onChange={(e) => setF((x: any) => ({ ...x, appointmentSchedule: { ...x.appointmentSchedule, intervalMinutes: Number(e.target.value) } }))} /></Field><Field label="Duración (min)"><input className="input" type="number" min="5" step="5" value={f.appointmentSchedule.durationMinutes} onChange={(e) => setF((x: any) => ({ ...x, appointmentSchedule: { ...x.appointmentSchedule, durationMinutes: Number(e.target.value) } }))} /></Field></div><p className="text-[11px] text-ink-muted mt-2">DREAMS solo ofrecerá espacios disponibles y bloqueará una cita cuando otro pedido ya haya tomado ese horario.</p></div>}
        </div>
      </div>
    </Modal>
  );
}

function CategoriesModal({ open, onClose, cats, reload }: { open: boolean; onClose: () => void; cats: any[]; reload: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    try { await api('/categories', { body: { name } }); setName(''); setError(null); reload(); } catch (e) { setError((e as Error).message); }
  };
  const del = async (id: string) => { await api(`/categories/${id}`, { method: 'DELETE' }); reload(); };
  return (
    <Modal open={open} onClose={onClose} title="Categorías">
      <div className="flex gap-2"><input className="input" placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name && add()} /><button className="btn-primary" disabled={!name} onClick={add}>Agregar</button></div>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <ul className="mt-4 divide-y divide-line">
        {cats.map((c) => (
          <li key={c.id} className="py-2.5 flex items-center justify-between text-sm">
            <span>{c.name} <span className="text-ink-faint text-xs">· {c.products} producto(s)</span></span>
            <button className="btn-ghost btn-sm !px-2 text-bad" onClick={() => del(c.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
