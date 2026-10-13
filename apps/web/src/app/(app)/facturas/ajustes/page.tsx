'use client';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, ImagePlus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DOC_LABEL, InvoicePreview, REGIMES, RESPONSIBILITIES, nitDv } from '@/components/invoices';
import { Badge, Card, Disclaimer, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ProviderCard } from '@/components/einvoice-provider';

const MODES: { v: string; title: string; body: string }[] = [
  { v: 'OFF', title: 'No facturo electrónicamente', body: 'Usas comprobantes de venta (por ejemplo, si no eres responsable de IVA y no estás obligado) o facturas de talonario en contingencia.' },
  { v: 'MANUAL', title: 'Solución gratuita de la DIAN o mi proveedor', body: 'DREAMS te reserva el número y arma la factura; la expides en el portal de la DIAN o en tu proveedor y registras aquí el CUFE y los archivos.' },
  { v: 'PROVIDER', title: 'Proveedor tecnológico conectado', body: 'Envío automático a la DIAN a través de un proveedor tecnológico autorizado. Hoy DREAMS se conecta con Factus: contratas el servicio con ellos y pegas tus credenciales abajo.' },
  { v: 'SANDBOX', title: 'Pruebas (simulación)', body: 'Para practicar: calcula el CUFE con el algoritmo oficial, pero no envía nada a la DIAN. Los documentos salen marcados «SIMULACIÓN».' },
];

const SAMPLE = (st: any) => ({
  kind: 'INVOICE', docType: st.defaultDocType, fullNumber: st.defaultDocType === 'INTERNAL' ? `${st.internalPrefix}1` : 'SETP990000001', issuedAt: new Date().toISOString(),
  dueDate: null, paymentForm: 'CONTADO', paymentMeans: 'NEQUI', status: 'ISSUED', dianStatus: 'ACCEPTED', amountPaid: st.regime === 'RESPONSABLE_IVA' ? 119000 : 100000, total: st.regime === 'RESPONSABLE_IVA' ? 119000 : 100000, subtotal: 100000, discountTotal: 0,
  taxes: [{ rate: st.regime === 'RESPONSABLE_IVA' ? 19 : 0, base: 100000, tax: st.regime === 'RESPONSABLE_IVA' ? 19000 : 0 }],
  seller: { ...st.seller, regime: st.regime, responsibilities: st.responsibilities }, template: st.template,
  buyer: { finalConsumer: false, name: 'Cliente de ejemplo', idType: '13', idNumber: '1144000000', city: 'Cali', email: 'cliente@correo.co' },
  items: [{ code: 'PRD-001', description: 'Producto o servicio de ejemplo', quantity: 1, unitPrice: 100000, discount: 0, taxRate: st.regime === 'RESPONSABLE_IVA' ? 19 : 0, total: st.regime === 'RESPONSABLE_IVA' ? 119000 : 100000 }],
  warrantyMonths: st.defaultWarrantyMonths, warrantyUntil: new Date(Date.now() + st.defaultWarrantyMonths * 30 * 86400000).toISOString(), warrantyText: st.template.warrantyText,
  resolutionText: st.defaultDocType === 'INTERNAL' ? null : 'Autorización de numeración de facturación DIAN No. 18760000001 …',
});

export default function InvoiceSettingsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, reload, setData } = useApi<any>('/invoicing/settings');
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  useEffect(() => { if (data) setF({ ...data, taxId: data.seller.taxIdRaw ?? '', legalName: data.seller.legalName ?? '', address: data.seller.address ?? '', city: data.seller.city ?? '', phone: data.seller.phone ?? '', email: data.seller.email ?? '' }); }, [data]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || !f) return <Loading />;
  const set = (p: any) => setF((x: any) => ({ ...x, ...p }));
  const setT = (p: any) => setF((x: any) => ({ ...x, template: { ...x.template, ...p } }));
  const manage = can('business:manage');
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<any>('/invoicing/settings', { method: 'PUT', body: {
        personType: f.personType, regime: f.regime ?? undefined, responsibilities: f.responsibilities, ciiu: f.ciiu, defaultDocType: f.defaultDocType, internalPrefix: f.internalPrefix,
        defaultWarrantyMonths: f.defaultWarrantyMonths, defaultDueDays: f.defaultDueDays, einvoiceMode: f.einvoiceMode, providerName: f.providerName,
        template: { ...f.template, logoUrl: f.template.logoUrl || null }, legalName: f.legalName, taxId: f.taxId || undefined, address: f.address, city: f.city, phone: f.phone, email: f.email || undefined,
      } });
      setData(r); toast('Ajustes de facturación guardados');
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { toast('Para que el logo salga en el PDF usa PNG o JPG', 'bad'); return; }
    try { const form = new FormData(); form.append('file', file); const r = await api<{ url: string }>('/uploads/image', { form }); setT({ logoUrl: r.url, showLogo: true }); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  const nitNum = String(f.taxId ?? '').split('-')[0];
  const preview = SAMPLE({ ...f, seller: { tradeName: data.seller.tradeName, legalName: f.legalName, nit: nitNum.replace(/\D/g, ''), dv: nitNum ? nitDv(nitNum) : '', address: f.address, city: f.city, phone: f.phone, email: f.email, logoUrl: data.seller.businessLogoUrl } });

  return <>
    <Link href="/facturas" className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Facturas</Link>
    <PageHeader title="Ajustes de facturación" subtitle="Tus datos tributarios, el diseño de tus facturas y la numeración autorizada por la DIAN."
      actions={manage && <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Guardar cambios</button>} />

    <div className="grid sm:grid-cols-3 gap-3 mb-5">{data.readiness.map((r: any) => <Card key={r.docType}>
      <p className="text-sm font-medium flex items-center gap-2">{r.ready ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <AlertTriangle className="h-4 w-4 text-warn" />}{DOC_LABEL[r.docType]}</p>
      {r.ready ? <p className="text-xs text-ink-muted mt-1">Listo para expedir.</p> : <ul className="text-xs text-ink-muted mt-1 space-y-0.5">{r.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}</ul>}
      {r.warnings.map((w: string, i: number) => <p key={i} className="text-[11px] text-warn mt-1">{w}</p>)}
    </Card>)}</div>

    <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <Card title="1. Tus datos como vendedor">
          <p className="text-xs text-ink-muted mb-3">Van en todas tus facturas (art. 617 del Estatuto Tributario).</p>
          <fieldset disabled={!manage} className="grid sm:grid-cols-2 gap-3">
            <Field label="Nombre o razón social" className="sm:col-span-2"><input className="input" value={f.legalName} onChange={(e) => set({ legalName: e.target.value })} placeholder={data.seller.tradeName} /></Field>
            <Field label="NIT o cédula" hint={nitNum ? <span className={String(f.taxId).includes('-') && String(f.taxId).split('-')[1] !== nitDv(nitNum) ? 'text-bad' : ''}>Dígito de verificación: {nitDv(nitNum)}{String(f.taxId).includes('-') && String(f.taxId).split('-')[1] !== nitDv(nitNum) ? ' (el que escribiste no corresponde)' : ''}</span> : 'Sin el dígito, DREAMS lo calcula'}><input className="input" value={f.taxId} onChange={(e) => set({ taxId: e.target.value.replace(/[^\d.\-\s]/g, '') })} placeholder="900123456" /></Field>
            <Field label="Tipo de persona"><select className="input" value={f.personType} onChange={(e) => set({ personType: e.target.value })}><option value="NATURAL">Persona natural</option><option value="JURIDICA">Persona jurídica (empresa)</option></select></Field>
            <Field label="Dirección"><input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
            <Field label="Ciudad"><input className="input" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="Teléfono"><input className="input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label="Correo de facturación"><input className="input" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Régimen frente al IVA" hint="Está en tu RUT"><select className="input" value={f.regime ?? ''} onChange={(e) => set({ regime: e.target.value || null })}><option value="">Elige…</option>{Object.entries(REGIMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Actividad económica (CIIU)" hint="4 dígitos, opcional"><input className="input" value={f.ciiu} maxLength={4} onChange={(e) => set({ ciiu: e.target.value.replace(/\D/g, '') })} /></Field>
            <div className="sm:col-span-2"><p className="label">Responsabilidades que deben aparecer (casilla 53 del RUT)</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">{Object.entries(RESPONSIBILITIES).map(([k, v]) => <label key={k} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.responsibilities.includes(k)}
                onChange={(e) => set({ responsibilities: e.target.checked ? [...f.responsibilities, k] : f.responsibilities.filter((x: string) => x !== k) })} />{v} <span className="text-ink-faint text-xs">{k}</span></label>)}</div></div>
          </fieldset>
        </Card>

        <Card title="2. Diseño de tus facturas">
          <fieldset disabled={!manage} className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="h-16 w-28 rounded-xl border border-dashed border-line flex items-center justify-center cursor-pointer overflow-hidden bg-sand-50 text-xs text-ink-muted">
                {f.template.logoUrl || data.seller.businessLogoUrl ? <img src={f.template.logoUrl || data.seller.businessLogoUrl} alt="Logo" className="h-full w-full object-contain p-1" /> : <span className="flex flex-col items-center"><ImagePlus className="h-4 w-4" />Logo</span>}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
              </label>
              <div className="text-xs text-ink-muted"><p>Logo de la factura (PNG o JPG). Si no subes uno, se usa el logo de tu negocio.</p>
                <label className="flex items-center gap-1.5 mt-1 text-ink"><input type="checkbox" checked={f.template.showLogo !== false} onChange={(e) => setT({ showLogo: e.target.checked })} /> Mostrar logo</label>
                {f.template.logoUrl && <button type="button" className="underline mt-1" onClick={() => setT({ logoUrl: '' })}>Usar el logo del negocio</button>}</div>
            </div>
            <Field label="Color principal"><div className="flex gap-2"><input type="color" className="h-10 w-12 rounded-lg border border-line" value={f.template.accentColor ?? '#1F2937'} onChange={(e) => setT({ accentColor: e.target.value.toUpperCase() })} /><input className="input" value={f.template.accentColor ?? ''} onChange={(e) => setT({ accentColor: e.target.value })} /></div></Field>
            <Field label="Título del comprobante" hint="Solo para comprobantes. Las facturas llevan el título que exige la ley."><input className="input" value={f.template.title ?? ''} maxLength={60} placeholder="Comprobante de venta" onChange={(e) => setT({ title: e.target.value })} /></Field>
            <Field label="Frase bajo tu nombre (opcional)" className="sm:col-span-2"><input className="input" value={f.template.headerNote ?? ''} maxLength={300} placeholder="Ej.: Accesorios hechos a mano en Cali" onChange={(e) => setT({ headerNote: e.target.value })} /></Field>
            <Field label="Datos para pagar (opcional)" className="sm:col-span-2"><textarea className="input min-h-[56px]" value={f.template.bankInfo ?? ''} maxLength={400} placeholder="Ej.: Bancolombia ahorros 000-000000-00 · Nequi 300 000 0000" onChange={(e) => setT({ bankInfo: e.target.value })} /></Field>
            <Field label="Condiciones de garantía por defecto" className="sm:col-span-2"><textarea className="input min-h-[56px]" value={f.template.warrantyText ?? ''} maxLength={800} placeholder="Ej.: Cubre defectos de fabricación. No cubre golpes, humedad ni mal uso." onChange={(e) => setT({ warrantyText: e.target.value })} /></Field>
            <Field label="Términos y condiciones (opcional)" className="sm:col-span-2"><textarea className="input min-h-[56px]" value={f.template.terms ?? ''} maxLength={1500} onChange={(e) => setT({ terms: e.target.value })} /></Field>
            <Field label="Mensaje al pie" className="sm:col-span-2"><input className="input" value={f.template.footerNote ?? ''} maxLength={600} placeholder="¡Gracias por tu compra!" onChange={(e) => setT({ footerNote: e.target.value })} /></Field>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.template.showSku !== false} onChange={(e) => setT({ showSku: e.target.checked })} /> Mostrar código del producto</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={!!f.template.showReceivedBlock} onChange={(e) => setT({ showReceivedBlock: e.target.checked })} /> Espacio de «Recibido» también en ventas de contado</label>
          </fieldset>
        </Card>

        <Card title="3. Valores por defecto">
          <fieldset disabled={!manage} className="grid sm:grid-cols-2 gap-3">
            <Field label="Documento que se propone al facturar"><select className="input" value={f.defaultDocType} onChange={(e) => set({ defaultDocType: e.target.value })}>{Object.entries(DOC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Prefijo de comprobantes" hint="Hasta 4 letras o números"><input className="input" value={f.internalPrefix} maxLength={4} onChange={(e) => set({ internalPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></Field>
            <Field label="Garantía por defecto (meses)"><input className="input" type="number" min={0} max={120} value={f.defaultWarrantyMonths} onChange={(e) => set({ defaultWarrantyMonths: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} /></Field>
            <Field label="Plazo de pago a crédito (días)"><input className="input" type="number" min={0} max={365} value={f.defaultDueDays} onChange={(e) => set({ defaultDueDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} /></Field>
          </fieldset>
        </Card>
      </div>

      <div className="space-y-5 min-w-0 xl:sticky xl:top-4">
        <Card padded={false} className="overflow-hidden"><div className="px-5 pt-4 text-sm font-medium">Vista previa</div><div className="scale-[0.98] origin-top"><InvoicePreview inv={preview} compact /></div></Card>
      </div>
    </div>

    <div className="grid lg:grid-cols-2 gap-5 mt-5 items-start">
      <Card title="4. Facturación electrónica (DIAN)">
        <fieldset disabled={!manage} className="space-y-2">{MODES.map((m) => <label key={m.v} className={cn('flex gap-3 rounded-xl border p-3 cursor-pointer', f.einvoiceMode === m.v ? 'border-ink ring-1 ring-ink' : 'border-line')}>
          <input type="radio" name="mode" className="mt-1" checked={f.einvoiceMode === m.v} onChange={() => set({ einvoiceMode: m.v })} />
          <span><span className="text-sm font-medium block">{m.title}</span><span className="text-xs text-ink-muted">{m.body}</span></span>
        </label>)}
          {['MANUAL', 'PROVIDER'].includes(f.einvoiceMode) && <Field label="¿Dónde la expides?"><input className="input" value={f.providerName} maxLength={80} placeholder="Facturación gratuita DIAN, o el nombre de tu proveedor" onChange={(e) => set({ providerName: e.target.value })} /></Field>}
        </fieldset>
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Cómo habilitarte como facturador electrónico</summary>
          <ol className="list-decimal pl-5 mt-2 space-y-1 text-xs text-ink-muted">
            <li>Ten tu RUT actualizado con la responsabilidad 52 (facturador electrónico) y firma electrónica en la DIAN.</li>
            <li>Ingresa al servicio «Factura electrónica» de la DIAN, regístrate y elige cómo vas a facturar: solución gratuita de la DIAN, software propio o proveedor tecnológico.</li>
            <li>Supera el set de pruebas de habilitación (en la solución gratuita es automático).</li>
            <li>Solicita la numeración (formulario 1876) y asóciala al prefijo. Registra aquí la resolución, el rango, la vigencia y la clave técnica.</li>
            <li>Expide cada factura, valídala y regístrale el CUFE aquí, o conecta Factus para que se envíe sola.</li>
          </ol>
          <a className="text-xs underline inline-flex items-center gap-1 mt-2" href="https://www.dian.gov.co/impuestos/factura-electronica/Paginas/default.aspx" target="_blank" rel="noreferrer">Factura electrónica en la DIAN <ExternalLink className="h-3 w-3" /></a>
        </details>
      </Card>
      {manage && f.einvoiceMode === 'PROVIDER' && <ProviderCard onChanged={reload} />}

      <Card title="5. Numeración autorizada por la DIAN" actions={manage && <button className="btn-secondary text-xs" onClick={() => setResOpen(true)}><Plus className="h-3.5 w-3.5" /> Registrar</button>}>
        {!data.resolutions.length ? <p className="text-sm text-ink-muted">Aún no has registrado numeraciones. Los comprobantes de venta no la necesitan; las facturas sí.</p> :
          <ul className="divide-y divide-line">{data.resolutions.map((r: any) => <li key={r.id} className="py-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap"><b>{r.kind === 'ELECTRONIC' ? 'Electrónica' : 'Talonario'}</b>{r.prefix && <span className="font-mono">{r.prefix}</span>}
              {r.active ? <Badge tone="ok">Activa</Badge> : <Badge tone="muted">Inactiva</Badge>}{r.environment === '2' && <Badge tone="sand">Pruebas</Badge>}</div>
            <p className="text-xs text-ink-muted">Resolución {r.resolutionNumber} del {r.resolutionDate} · del {r.fromNumber} al {r.toNumber} · vigente hasta {r.validTo ?? '—'}</p>
            <p className="text-xs">Próximo número: <b>{r.prefix}{r.nextNumber}</b> · quedan {r.remaining.toLocaleString('es-CO')}{r.kind === 'ELECTRONIC' && ` · clave técnica ${r.hasTechnicalKey ? 'guardada (cifrada)' : 'pendiente'}`}</p>
            {manage && !r.active && <button className="text-xs underline mt-1" onClick={async () => { try { setData(await api(`/invoicing/resolutions/${r.id}`, { method: 'PATCH', body: { active: true } })); } catch (e) { toast((e as Error).message, 'bad'); } }}>Activar</button>}
          </li>)}</ul>}
      </Card>
    </div>

    <div className="mt-5"><Disclaimer>DREAMS te ayuda a cumplir los requisitos de la factura (art. 617 del Estatuto Tributario y Resolución DIAN 000165 de 2023), la conserva sin cambios y guarda los archivos de la DIAN. La responsabilidad de facturar, validar ante la DIAN y conservar los documentos (mínimo 5 años) es de cada vendedor. Si tienes dudas sobre si estás obligado a facturar electrónicamente, consulta a tu contador.</Disclaimer></div>
    {resOpen && <ResolutionModal onClose={() => setResOpen(false)} onSaved={(d) => { setData(d); setResOpen(false); toast('Numeración registrada'); }} />}
  </>;
}

function ResolutionModal({ onClose, onSaved }: { onClose: () => void; onSaved: (d: any) => void }) {
  const [r, setR] = useState<any>({ kind: 'ELECTRONIC', resolutionNumber: '', resolutionDate: '', prefix: '', fromNumber: '1', toNumber: '', nextNumber: '', validTo: '', technicalKey: '', environment: '1' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: any) => setR((x: any) => ({ ...x, ...p }));
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      onSaved(await api('/invoicing/resolutions', { body: { ...r, fromNumber: Number(r.fromNumber), toNumber: Number(r.toNumber), nextNumber: r.nextNumber ? Number(r.nextNumber) : undefined,
        validTo: r.validTo || undefined, technicalKey: r.kind === 'ELECTRONIC' ? r.technicalKey : undefined, prefix: r.prefix || undefined } }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title="Registrar numeración DIAN" footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy && <Spinner />} Guardar</button></>}>
    <div className="space-y-3">
      {err && <ErrorBox message={err} />}
      <p className="text-xs text-ink-muted">Copia los datos tal como aparecen en la resolución de autorización de numeración (formulario 1876) que te dio la DIAN. Al guardar, esta numeración queda activa y reemplaza a la anterior del mismo tipo.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Tipo"><select className="input" value={r.kind} onChange={(e) => set({ kind: e.target.value })}><option value="ELECTRONIC">Facturación electrónica</option><option value="CONTINGENCY">Talonario (contingencia)</option></select></Field>
        <Field label="Número de resolución"><input className="input" value={r.resolutionNumber} onChange={(e) => set({ resolutionNumber: e.target.value.replace(/\D/g, '').slice(0, 20) })} /></Field>
        <Field label="Fecha de la resolución"><input className="input" type="date" value={r.resolutionDate} onChange={(e) => set({ resolutionDate: e.target.value })} /></Field>
        <Field label="Vigente hasta"><input className="input" type="date" value={r.validTo} onChange={(e) => set({ validTo: e.target.value })} /></Field>
        <Field label="Prefijo" hint="Hasta 4 caracteres"><input className="input" value={r.prefix} maxLength={4} onChange={(e) => set({ prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></Field>
        <Field label="Próximo número a usar" hint="Si ya facturaste con esta numeración"><input className="input" inputMode="numeric" value={r.nextNumber} placeholder={r.fromNumber} onChange={(e) => set({ nextNumber: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Desde el número"><input className="input" inputMode="numeric" value={r.fromNumber} onChange={(e) => set({ fromNumber: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Hasta el número"><input className="input" inputMode="numeric" value={r.toNumber} onChange={(e) => set({ toNumber: e.target.value.replace(/\D/g, '') })} /></Field>
        {r.kind === 'ELECTRONIC' && <>
          <Field label="Clave técnica" className="sm:col-span-2" hint="Aparece en el portal de la DIAN junto a la numeración. Se guarda cifrada."><input className="input font-mono text-xs" value={r.technicalKey} onChange={(e) => set({ technicalKey: e.target.value.trim() })} /></Field>
          <Field label="Ambiente"><select className="input" value={r.environment} onChange={(e) => set({ environment: e.target.value })}><option value="1">Producción</option><option value="2">Pruebas / habilitación</option></select></Field>
        </>}
      </div>
    </div>
  </Modal>;
}
