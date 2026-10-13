'use client';
import { Check, Copy, ExternalLink, Monitor, Plus, Save, Smartphone, Ticket, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Choice, ImageInput, Panel, PaymentsEditor, SectionsEditor, Toggle } from '@/components/site-editor';
import { SharePanel } from '@/components/share-store';
import { ReviewsPanel } from '@/components/reviews';
import { Badge, Card, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, Tabs, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { FONTS, SITE_DEFAULTS, SiteConfig, TEMPLATES, Template, inferKind, templateForBusiness } from '@/lib/store-site';

type Tab = 'plantilla' | 'secciones' | 'diseno' | 'pagos' | 'entregas' | 'cupones' | 'general' | 'compartir' | 'resenas';
const toSlug = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const PREVIEW = '/tienda/__vista-previa';

type Coupon = { id: string; code: string; description: string | null; kind: 'PERCENT' | 'FIXED' | 'SHIPPING'; value: string; minSubtotal: string; maxUses: number | null; usedCount: number; campaign: string | null; startsAt: string | null; expiresAt: string | null; isActive: boolean };
const emptyCoupon = { code: '', description: '', kind: 'PERCENT' as Coupon['kind'], value: '10', minSubtotal: '0', maxUses: '', campaign: '', startsAt: '', expiresAt: '', isActive: true };

export default function SiteBuilderPage() {
  const { current } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any>('/store/current');
  const { data: previewData } = useApi<any>('/store/current/preview');
  const { data: coupons, reload: reloadCoupons } = useApi<Coupon[]>('/store/coupons');
  const [tab, setTab] = useState<Tab>('secciones');
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t && ['plantilla', 'secciones', 'diseno', 'pagos', 'entregas', 'cupones', 'general', 'compartir', 'resenas'].includes(t)) setTab(t as Tab); }, []);
  const [slug, setSlug] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [config, setConfigState] = useState<SiteConfig>(SITE_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareKey, setShareKey] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [wompi, setWompi] = useState({ publicKey: '', privateKey: '', integritySecret: '', eventSecret: '' });
  const [savingWompi, setSavingWompi] = useState(false);
  const [couponForm, setCouponForm] = useState<typeof emptyCoupon & { id?: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [copied, setCopied] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!data) return;
    const isNew = !data.config || !Object.keys(data.config).length;
    setSlug(data.slug || toSlug(current?.tradeName ?? 'mi-tienda'));
    setEnabled(data.enabled);
    const suggested = templateForBusiness(current?.businessType, current?.category);
    const base: SiteConfig = isNew ? { ...SITE_DEFAULTS, ...(suggested.config as Partial<SiteConfig>), template: suggested.id,
      ...(current?.brandColors ? { primaryColor: current.brandColors.primary, accentColor: current.brandColors.accent } : {}) } : SITE_DEFAULTS;
    const loaded = { ...base, ...(data.config ?? {}) } as SiteConfig;
    if (!data.config?.sections?.length) loaded.sections = base.sections;
    if (!data.config?.paymentMethods?.length) loaded.paymentMethods = SITE_DEFAULTS.paymentMethods;
    loaded.paymentMethods = loaded.paymentMethods.map(inferKind);
    setConfigState(loaded);
    setDirty(isNew);
    if (isNew) setTab('plantilla');
  }, [data, current?.tradeName, current?.businessType, current?.category, current?.brandColors]);

  const setConfig = useCallback((patch: Partial<SiteConfig>) => { setConfigState((c) => ({ ...c, ...patch })); setDirty(true); }, []);

  // Vista previa en vivo: la página pública (mismo origen) recibe el borrador por mensaje.
  const sendPreview = useCallback(() => {
    if (!previewData || !frame.current?.contentWindow) return;
    frame.current.contentWindow.postMessage({ type: 'dream-store-preview', payload: { ...previewData, settings: config, couponsEnabled: Boolean(coupons?.some((c) => c.isActive)) } }, window.location.origin);
  }, [previewData, config, coupons]);
  useEffect(() => { const t = setTimeout(sendPreview, 150); return () => clearTimeout(t); }, [sendPreview]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === 'dream-store-preview-ready') sendPreview(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [sendPreview]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async (publish?: boolean) => {
    setBusy(true); setSaveError('');
    const nextEnabled = publish ?? enabled;
    try {
      const paymentMethods = config.paymentMethods.filter((m) => m.name.trim().length >= 2);
      if (!paymentMethods.length) throw new Error('Agrega al menos un medio de pago (pestaña Pagos).');
      const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
      const colors = { primaryColor: hex(config.primaryColor) ? config.primaryColor : SITE_DEFAULTS.primaryColor, accentColor: hex(config.accentColor) ? config.accentColor : SITE_DEFAULTS.accentColor,
        backgroundColor: hex(config.backgroundColor) ? config.backgroundColor : SITE_DEFAULTS.backgroundColor, textColor: hex((config as any).textColor) ? (config as any).textColor : undefined };
      await api('/store/current', { method: 'PATCH', body: { slug, enabled: nextEnabled, ...config, ...colors, paymentMethods } });
      setEnabled(nextEnabled); setDirty(false); await reload();
      toast(publish ? '¡Tu página web está publicada! Ahora compártela.' : 'Cambios guardados');
      setShareKey((k) => k + 1); if (publish) setTab('compartir');
    } catch (e) { setSaveError((e as Error).message); }
    finally { setBusy(false); }
  };
  const applyTemplate = (t: Template) => {
    setConfig({ announcement: '', deliveryEnabled: true, pickupEnabled: false, layout: 'grid', ...(t.config as Partial<SiteConfig>), template: t.id, sections: t.config.sections ?? config.sections });
    toast(`Plantilla «${t.label}» aplicada. Ajusta lo que quieras y guarda.`);
    setTab('secciones');
  };
  const connectWompi = async () => {
    setSavingWompi(true); setSaveError('');
    try { await api('/store/current/wompi', { method: 'PATCH', body: wompi }); setWompi({ publicKey: '', privateKey: '', integritySecret: '', eventSecret: '' }); await reload(); toast('Pasarela Wompi conectada'); }
    catch (e) { setSaveError((e as Error).message); }
    finally { setSavingWompi(false); }
  };
  const saveCoupon = async () => {
    if (!couponForm) return;
    setCouponBusy(true); setCouponError('');
    const { id, ...f } = couponForm;
    const body = { ...f, code: f.code.trim().toUpperCase(), description: f.description || undefined, campaign: f.campaign || undefined,
      maxUses: f.maxUses ? Number(f.maxUses) : null, startsAt: f.startsAt || null, expiresAt: f.expiresAt || null, value: f.kind === 'SHIPPING' ? '0' : f.value };
    try { await api(id ? `/store/coupons/${id}` : '/store/coupons', { method: id ? 'PATCH' : 'POST', body }); setCouponForm(null); await reloadCoupons(); toast('Cupón guardado'); }
    catch (e) { setCouponError((e as Error).message); }
    finally { setCouponBusy(false); }
  };
  const toggleCoupon = async (c: Coupon) => {
    try {
      await api(`/store/coupons/${c.id}`, { method: 'PATCH', body: { code: c.code, description: c.description ?? undefined, kind: c.kind, value: c.value, minSubtotal: c.minSubtotal, maxUses: c.maxUses,
        campaign: c.campaign ?? undefined, startsAt: c.startsAt?.slice(0, 10) ?? null, expiresAt: c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : null, isActive: !c.isActive } });
      await reloadCoupons();
    } catch (e) { toast((e as Error).message); }
  };

  if (loading && !data) return <Loading />;
  const publicUrl = typeof window !== 'undefined' && slug ? `${window.location.origin}/tienda/${slug}` : '';
  const copyLink = () => { navigator.clipboard?.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); };
  const suggested = templateForBusiness(current?.businessType, current?.category);
  const enabledPayments = config.paymentMethods.filter((m) => m.enabled).length + (data?.paymentGatewayEnabled ? 1 : 0);

  return <>
    <PageHeader title="Mi página web" subtitle={<>Diseña tu propia página, recibe pedidos y cobra con tus medios de pago. {enabled ? <Badge tone="ok">Publicada</Badge> : <Badge tone="warn">Sin publicar</Badge>}</>}
      actions={<>
        {enabled && slug && <a className="btn-secondary" href={`/tienda/${slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ver página</a>}
        <button className="btn-secondary" onClick={() => save()} disabled={busy || !slug}><Save className="h-4 w-4" />{busy && <Spinner />} Guardar{dirty ? ' *' : ''}</button>
        {!enabled && <button className="btn-primary" onClick={() => save(true)} disabled={busy || !slug}>Publicar página</button>}
      </>} />
    {(error || saveError) && <div className="mb-4"><ErrorBox message={saveError || error || 'No se pudo cargar la configuración'} onRetry={saveError ? undefined : reload} /></div>}

    <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'plantilla', label: 'Plantillas' }, { value: 'secciones', label: 'Secciones' }, { value: 'diseno', label: 'Diseño' },
          { value: 'pagos', label: `Pagos (${enabledPayments})` }, { value: 'entregas', label: 'Entregas' }, { value: 'cupones', label: 'Cupones' }, { value: 'general', label: 'Enlace y SEO' }, { value: 'compartir', label: 'Compartir' }, { value: 'resenas', label: 'Reseñas' },
        ]} />

        {tab === 'plantilla' && <Card><Panel title="Empieza con una plantilla para tu tipo de negocio" description="La plantilla organiza secciones, colores, tipografía y forma de comprar. Luego puedes cambiar todo.">
          <div className="grid sm:grid-cols-2 gap-3">{TEMPLATES.map((t) => {
            const c = t.config;
            return <button key={t.id} type="button" onClick={() => applyTemplate(t)} className={cn('text-left rounded-xl border p-3 hover:shadow-card transition bg-white', config.template === t.id ? 'border-ink ring-2 ring-ink/10' : 'border-line')}>
              <div className="h-16 rounded-lg overflow-hidden flex mb-2" style={{ background: c.backgroundColor }}><span className="w-1/3" style={{ background: c.primaryColor }} /><span className="flex-1 flex items-end p-2"><span className="h-2 w-2/3 rounded" style={{ background: c.accentColor }} /></span></div>
              <p className="text-sm font-medium flex items-center gap-2">{t.label}{t.id === suggested.id && <Badge tone="sand">Sugerida</Badge>}{config.template === t.id && <Check className="h-4 w-4" />}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t.description}</p>
            </button>;
          })}</div>
        </Panel></Card>}

        {tab === 'secciones' && <Card><Panel title="Secciones de tu página" description="Ordénalas con las flechas, ocúltalas con el ojo y toca cada una para editar su contenido.">
          <SectionsEditor config={config} setConfig={setConfig} products={previewData?.products ?? []} />
        </Panel></Card>}

        {tab === 'diseno' && <Card><div className="space-y-5">
          <Panel title="Colores">
            {current?.brandColors && <button type="button" className="btn-secondary btn-sm" onClick={() => setConfig({ primaryColor: current.brandColors!.primary, accentColor: current.brandColors!.accent })}><Wand2 className="h-4 w-4" /> Usar la paleta de mi marca</button>}
            <div className="grid sm:grid-cols-2 gap-3">{([['primaryColor', 'Principal (botones y títulos)'], ['accentColor', 'Acento (avisos y detalles)'], ['backgroundColor', 'Fondo de la página'], ['textColor', 'Texto (opcional)']] as const).map(([key, label]) =>
              <Field key={key} label={label}><div className="flex gap-2"><input type="color" className="h-10 w-12 rounded-lg border border-line p-1 cursor-pointer" value={(config as any)[key] || config.primaryColor} onChange={(e) => setConfig({ [key]: e.target.value.toUpperCase() } as any)} /><input className="input font-mono uppercase" maxLength={7} value={(config as any)[key] ?? ''} placeholder={key === 'textColor' ? 'Igual al principal' : '#RRGGBB'} onChange={(e) => { const v = e.target.value.startsWith('#') || !e.target.value ? e.target.value : `#${e.target.value}`; setConfig({ [key]: v.toUpperCase() } as any); }} /></div></Field>)}</div>
          </Panel>
          <Choice label="Tipografía" value={config.fontStyle as any} options={Object.entries(FONTS).map(([k, f]) => [k, f.label]) as [string, string][]} onChange={(v) => setConfig({ fontStyle: v })} />
          <Choice label="Encabezado" value={config.headerStyle as any} options={[['classic', 'Logo a la izquierda'], ['centered', 'Logo centrado'], ['minimal', 'Mínimo']]} onChange={(v) => setConfig({ headerStyle: v })} />
          <Choice label="Alineación de textos" value={config.textAlign as any} options={[['left', 'Izquierda'], ['center', 'Centrada']]} onChange={(v) => setConfig({ textAlign: v })} />
          <Choice label="Tarjetas de producto" value={config.cardStyle as any} options={[['soft', 'Redondeadas'], ['classic', 'Clásicas'], ['outline', 'Borde marcado'], ['flat', 'Planas']]} onChange={(v) => setConfig({ cardStyle: v })} />
          <Choice label="Botones" value={config.buttonStyle as any} options={[['pill', 'Pastilla'], ['round', 'Redondeados'], ['square', 'Cuadrados']]} onChange={(v) => setConfig({ buttonStyle: v })} />
          <Choice label="Formato de fotos" value={config.imageRatio as any} options={[['square', 'Cuadradas'], ['portrait', 'Verticales'], ['wide', 'Panorámicas']]} onChange={(v) => setConfig({ imageRatio: v })} />
          <Field label="Aviso superior (opcional)" hint="Ej. Envío gratis en compras desde $150.000"><input className="input" maxLength={100} value={config.announcement} onChange={(e) => setConfig({ announcement: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Toggle label="Botón flotante de WhatsApp" checked={config.showFloatingWhatsapp} onChange={(v) => setConfig({ showFloatingWhatsapp: v })} />
            <Toggle label="Mostrar redes del negocio" hint="Se toman de Configuración" checked={config.showSocialLinks} onChange={(v) => setConfig({ showSocialLinks: v })} />
          </div>
        </div></Card>}

        {tab === 'pagos' && <Card><div className="space-y-5">
          <Panel title="Medios de pago que verá tu cliente" description="Activa los que uses. El cliente ve los datos para pagar (con botón de copiar y tu QR) antes y después de confirmar el pedido. DREAMS no mueve el dinero: llega directo a tus cuentas.">
            <PaymentsEditor methods={config.paymentMethods} onChange={(paymentMethods) => setConfig({ paymentMethods })} />
          </Panel>
          <div className="rounded-xl border border-line bg-sand-50 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Cobro automático con tarjeta y PSE · Wompi {data?.paymentGatewayEnabled ? <Badge tone="ok">Conectado</Badge> : <Badge>Sin configurar</Badge>}</p>
              <p className="text-xs text-ink-muted mt-1">Requiere una cuenta de comercio Wompi aprobada (Bancolombia). Copia las 4 llaves desde el panel de Wompi → Desarrolladores. Usa llaves <b>pub_test_</b> para ensayar. Se guardan cifradas y el pago se confirma solo, con firma verificada.</p></div></div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <Field label="Llave pública"><input className="input" autoComplete="off" value={wompi.publicKey} onChange={(e) => setWompi({ ...wompi, publicKey: e.target.value })} placeholder="pub_test_…" /></Field>
              <Field label="Llave privada"><input className="input" type="password" autoComplete="new-password" value={wompi.privateKey} onChange={(e) => setWompi({ ...wompi, privateKey: e.target.value })} /></Field>
              <Field label="Secreto de integridad"><input className="input" type="password" autoComplete="new-password" value={wompi.integritySecret} onChange={(e) => setWompi({ ...wompi, integritySecret: e.target.value })} /></Field>
              <Field label="Secreto de eventos"><input className="input" type="password" autoComplete="new-password" value={wompi.eventSecret} onChange={(e) => setWompi({ ...wompi, eventSecret: e.target.value })} /></Field>
            </div>
            <button type="button" className="btn-secondary mt-3" disabled={savingWompi || Object.values(wompi).some((v) => !v.trim())} onClick={connectWompi}>{savingWompi ? <Spinner /> : <Save className="h-4 w-4" />} Conectar Wompi</button>
            <p className="text-[11px] text-ink-muted mt-2">En Wompi configura la URL de eventos: <span className="font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/api/store/wompi/webhook</span> (debe ser una dirección pública https).</p>
          </div>
          <p className="text-xs text-ink-muted">¿Usas Bold, Mercado Pago, PayU o ePayco? Agrega «Link de pago» y pega tu enlace: el cliente lo abre al confirmar y luego marcas el pedido como pagado en Pedidos y envíos.</p>
        </div></Card>}

        {tab === 'entregas' && <Card><div className="space-y-4">
          <Toggle label="Envío a domicilio" checked={config.deliveryEnabled} onChange={(v) => setConfig({ deliveryEnabled: v, ...(v || config.pickupEnabled ? {} : { pickupEnabled: true }) })} />
          {config.deliveryEnabled && <div className="grid sm:grid-cols-2 gap-3 pl-1">
            <Field label="Costo del envío (COP)" hint="0 si tú asumes el envío."><input className="input" inputMode="decimal" value={config.shippingFee} onChange={(e) => setConfig({ shippingFee: e.target.value.replace(/[^0-9.]/g, '') || '0' })} /></Field>
            <Field label="Envío gratis desde (COP)" hint="Opcional."><input className="input" inputMode="decimal" value={config.freeShippingMinimum} onChange={(e) => setConfig({ freeShippingMinimum: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Sin mínimo" /></Field>
            <Field label="Información de envíos" className="sm:col-span-2"><input className="input" maxLength={500} value={config.shippingInfo} onChange={(e) => setConfig({ shippingInfo: e.target.value })} placeholder="Envíos nacionales en 2 a 5 días hábiles" /></Field>
          </div>}
          <Toggle label="Recoger en el local" hint="El cliente no paga envío y puede pagar al recoger." checked={config.pickupEnabled} onChange={(v) => setConfig({ pickupEnabled: v, ...(v || config.deliveryEnabled ? {} : { deliveryEnabled: true }) })} />
          {config.pickupEnabled && <Field label="Dirección para recoger"><input className="input" maxLength={255} value={config.pickupAddress} onChange={(e) => setConfig({ pickupAddress: e.target.value })} placeholder="Cra. 10 # 20-30, local 4" /></Field>}
          <Toggle label="Permitir notas en el pedido" hint="Ej. «sin cebolla», «es para regalo»" checked={config.allowOrderNotes} onChange={(v) => setConfig({ allowOrderNotes: v })} />
          <div className="border-t border-line pt-4 space-y-3">
            <Toggle label="Devoluciones desde la página web" hint="Tus clientes las solicitan con su número de pedido y celular; tú las apruebas en Devoluciones." checked={config.returnsEnabled !== false} onChange={(v) => setConfig({ returnsEnabled: v })} />
            {config.returnsEnabled !== false && <Field label="Plazo para solicitar una devolución (días después de la entrega)" hint="En ventas a distancia en Colombia el comprador tiene derecho de retracto de al menos 5 días hábiles (Ley 1480 de 2011, art. 47), y la garantía legal aplica aparte. Revisa el plazo con tu asesor."><input className="input w-32" type="number" min={1} max={365} value={config.returnWindowDays ?? 30} onChange={(e) => setConfig({ returnWindowDays: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} /></Field>}
            <Field label="Política de cambios y devoluciones (la verá el cliente)"><textarea className="input min-h-20" maxLength={3000} value={config.returnsPolicy} onChange={(e) => setConfig({ returnsPolicy: e.target.value })} placeholder="Ej. Aceptamos cambios con etiqueta y empaque original. El reembolso se hace al mismo medio de pago en máximo 5 días hábiles." /></Field>
          </div>
        </div></Card>}

        {tab === 'cupones' && <Card title={<span className="flex items-center gap-2"><Ticket className="h-4 w-4" /> Cupones de descuento</span>} actions={<button className="btn-primary btn-sm" onClick={() => { setCouponError(''); setCouponForm({ ...emptyCoupon }); }}><Plus className="h-4 w-4" /> Nuevo cupón</button>}>
          <p className="text-xs text-ink-muted mb-3">Compártelos en tus anuncios y redes. Cada uso queda registrado en el pedido, y en Publicidad ves cuánto vendió cada campaña.</p>
          {!coupons?.length ? <p className="text-sm text-ink-muted">Aún no tienes cupones.</p> : <div className="divide-y divide-line">{coupons.map((c) =>
            <div key={c.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]"><p className="font-mono font-semibold text-sm">{c.code} {!c.isActive && <Badge>Pausado</Badge>}</p>
                <p className="text-xs text-ink-muted">{c.kind === 'PERCENT' ? `${Number(c.value)}% de descuento` : c.kind === 'FIXED' ? `${money(c.value)} de descuento` : 'Envío gratis'}{Number(c.minSubtotal) > 0 ? ` · desde ${money(c.minSubtotal)}` : ''} · {c.usedCount}{c.maxUses ? `/${c.maxUses}` : ''} usos{c.expiresAt ? ` · vence ${date(c.expiresAt)}` : ''}{c.campaign ? ` · campaña ${c.campaign}` : ''}</p></div>
              {slug && <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(`${publicUrl}?cupon=${c.code}`).then(() => toast('Enlace con cupón copiado'))}><Copy className="h-3.5 w-3.5" /> Enlace</button>}
              <button className="btn-ghost btn-sm" onClick={() => toggleCoupon(c)}>{c.isActive ? 'Pausar' : 'Activar'}</button>
              <button className="btn-secondary btn-sm" onClick={() => { setCouponError(''); setCouponForm({ id: c.id, code: c.code, description: c.description ?? '', kind: c.kind, value: String(Number(c.value)), minSubtotal: String(Number(c.minSubtotal)), maxUses: c.maxUses ? String(c.maxUses) : '', campaign: c.campaign ?? '', startsAt: c.startsAt ? new Date(c.startsAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : '', expiresAt: c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : '', isActive: c.isActive }); }}>Editar</button>
            </div>)}</div>}
        </Card>}

        {tab === 'compartir' && <SharePanel reloadKey={shareKey} />}
        {tab === 'resenas' && <ReviewsPanel />}

        {tab === 'general' && <Card><div className="space-y-4">
          <Field label="Dirección de tu página" hint="Letras minúsculas, números y guiones."><div className="flex items-center gap-2"><span className="text-xs text-ink-muted whitespace-nowrap">/tienda/</span><input className="input" value={slug} onChange={(e) => { setSlug(toSlug(e.target.value)); setDirty(true); }} placeholder="mi-marca" /></div></Field>
          {publicUrl && <div className="flex items-center gap-2 rounded-xl bg-sand-50 border border-line p-3 text-xs"><span className="truncate flex-1 font-mono">{publicUrl}</span><button type="button" className="btn-secondary btn-sm" onClick={copyLink}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar</button></div>}
          <p className="text-[11px] text-ink-muted">Mientras DREAMS corra en tu computador, el enlace funciona en tu red o con el enlace público de «compartir-dream». Para un dominio propio (www.tunegocio.com) hay que publicar DREAMS en un servidor en la nube.</p>
          <Toggle label="Página publicada" hint="Visible para cualquier persona con el enlace" checked={enabled} onChange={(v) => { setEnabled(v); setDirty(true); }} />
          <Toggle label="Aparecer en el directorio «Negocios en DREAMS»" hint="Las personas te encuentran por nombre, ciudad y tipo de negocio" checked={config.showInDirectory !== false} onChange={(v) => setConfig({ showInDirectory: v })} />
          <Toggle label="Mostrar mi dirección con mapa y «Cómo llegar»" hint="En tu ficha del directorio. Desactívalo si vendes desde casa y no recibes clientes" checked={config.showMap !== false} onChange={(v) => setConfig({ showMap: v })} />
          <Field label="WhatsApp del negocio" hint="Con indicativo del país, ej. 573001234567. Se usa para pedidos, botón flotante y contacto."><input className="input" inputMode="tel" value={config.whatsapp} onChange={(e) => setConfig({ whatsapp: e.target.value.replace(/[^\d+]/g, '') })} placeholder="573001234567" /></Field>
          <Panel title="Cómo se ve al compartir el enlace (WhatsApp, Instagram, Google)">
            <Field label="Título" hint={`${config.seoTitle.length}/70`}><input className="input" maxLength={70} value={config.seoTitle} onChange={(e) => setConfig({ seoTitle: e.target.value })} placeholder={`${current?.tradeName ?? 'Mi negocio'} · ${config.headline}`} /></Field>
            <Field label="Descripción" hint={`${config.seoDescription.length}/170`}><textarea className="input min-h-16" maxLength={170} value={config.seoDescription} onChange={(e) => setConfig({ seoDescription: e.target.value })} placeholder={config.description} /></Field>
            <ImageInput label="Imagen para compartir" value={config.shareImage} onChange={(v) => setConfig({ shareImage: v })} hint="Ideal 1200 × 630 px. Si la dejas vacía se usa la portada." />
            <div className="rounded-xl border border-line overflow-hidden max-w-sm bg-white">{(config.shareImage || config.heroImage) && <img src={config.shareImage || config.heroImage} alt="" className="w-full aspect-[1.91/1] object-cover" />}<div className="p-3"><p className="text-[11px] text-ink-muted uppercase">{typeof window !== 'undefined' ? window.location.host : ''}</p><p className="text-sm font-medium truncate">{config.seoTitle || `${current?.tradeName ?? ''} · ${config.headline}`}</p><p className="text-xs text-ink-muted line-clamp-2">{config.seoDescription || config.description}</p></div></div>
          </Panel>
        </div></Card>}
      </div>

      <div className="xl:sticky xl:top-4 space-y-2 min-w-0">
        <div className="flex items-center justify-between"><p className="label !mb-0">Vista previa en vivo</p>
          <div className="inline-flex rounded-lg bg-sand-100 p-0.5">{([['desktop', Monitor, 'Computador'], ['mobile', Smartphone, 'Celular']] as const).map(([k, Icon, l]) =>
            <button key={k} type="button" onClick={() => setDevice(k)} className={cn('h-7 px-2.5 rounded-md text-xs inline-flex items-center gap-1', device === k ? 'bg-white shadow-card' : 'text-ink-muted')} aria-pressed={device === k}><Icon className="h-3.5 w-3.5" />{l}</button>)}</div></div>
        <div className="rounded-2xl border border-line bg-sand-100 p-2 flex justify-center">
          <iframe ref={frame} src={PREVIEW} title="Vista previa de tu página web" onLoad={sendPreview}
            className={cn('bg-white rounded-xl border border-line transition-all', device === 'mobile' ? 'w-[390px] max-w-full h-[720px]' : 'w-full h-[640px] xl:h-[calc(100vh-150px)]')} />
        </div>
        {dirty && <p className="text-[11px] text-warn">Tienes cambios sin guardar. Tus clientes verán los cambios cuando guardes.</p>}
      </div>
    </div>

    <Modal open={Boolean(couponForm)} onClose={() => setCouponForm(null)} title={couponForm?.id ? 'Editar cupón' : 'Nuevo cupón'}
      footer={<><button className="btn-secondary" onClick={() => setCouponForm(null)}>Cancelar</button><button className="btn-primary" onClick={saveCoupon} disabled={couponBusy || !couponForm?.code}>{couponBusy && <Spinner />} Guardar</button></>}>
      {couponForm && <div className="grid sm:grid-cols-2 gap-3">
        {couponError && <div className="sm:col-span-2"><ErrorBox message={couponError} /></div>}
        <Field label="Código"><input className="input font-mono uppercase" maxLength={40} value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="BIENVENIDA10" /></Field>
        <Field label="Tipo"><select className="input" value={couponForm.kind} onChange={(e) => setCouponForm({ ...couponForm, kind: e.target.value as Coupon['kind'] })}><option value="PERCENT">Porcentaje</option><option value="FIXED">Valor fijo</option><option value="SHIPPING">Envío gratis</option></select></Field>
        {couponForm.kind !== 'SHIPPING' && <Field label={couponForm.kind === 'PERCENT' ? 'Porcentaje (%)' : 'Descuento (COP)'}><input className="input" inputMode="decimal" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>}
        <Field label="Compra mínima (COP)"><input className="input" inputMode="decimal" value={couponForm.minSubtotal} onChange={(e) => setCouponForm({ ...couponForm, minSubtotal: e.target.value.replace(/[^0-9.]/g, '') || '0' })} /></Field>
        <Field label="Máximo de usos" hint="Vacío = sin límite"><input className="input" inputMode="numeric" value={couponForm.maxUses} onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Campaña (opcional)" hint="Mismo nombre que usas en Publicidad"><input className="input" maxLength={160} value={couponForm.campaign} onChange={(e) => setCouponForm({ ...couponForm, campaign: e.target.value })} /></Field>
        <Field label="Desde (opcional)"><input type="date" className="input" value={couponForm.startsAt} onChange={(e) => setCouponForm({ ...couponForm, startsAt: e.target.value })} /></Field>
        <Field label="Vence (opcional)"><input type="date" className="input" value={couponForm.expiresAt} onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })} /></Field>
        <Field label="Descripción interna (opcional)" className="sm:col-span-2"><input className="input" maxLength={160} value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-ink" checked={couponForm.isActive} onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })} /> Activo</label>
      </div>}
    </Modal>
  </>;
}
