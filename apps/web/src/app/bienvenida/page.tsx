'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ErrorBox, Field, Loading, Logo, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PalettePicker } from '@/components/palette-picker';
import { BrandColors, DEFAULT_BRAND } from '@/lib/theme';
import { SERVICE_PROFILES } from '@/lib/service-profiles';

const TYPES = ['Tienda minorista', 'Venta por redes sociales', 'Restaurante o comidas', 'Mayorista / distribuidor', 'Manufactura / artesanías', 'Otro'];
const CATEGORIES = ['Moda y accesorios', 'Belleza y cuidado personal', 'Alimentos y bebidas', 'Tecnología', 'Hogar y decoración', 'Salud y bienestar', 'Mascotas', 'Papelería y regalos', 'Otro'];
const PROFILES: Record<string, { summary: string; setup: string }> = {
  'Tienda minorista': { summary: 'Ropa, accesorios, tecnología, hogar y productos físicos.', setup: 'Catálogo con variantes, códigos de barras y stock por producto o combinación.' },
  'Venta por redes sociales': { summary: 'Vendes por Instagram, Facebook, TikTok o WhatsApp.', setup: 'Catálogo listo para compartir, pedidos web y seguimiento de clientes.' },
  'Restaurante o comidas': { summary: 'Restaurante, cafetería, panadería o comida por encargo.', setup: 'Productos con extras, notas y tiempo de preparación.' },
  'Servicios': { summary: 'Belleza, consultoría, reparaciones, citas y otros servicios.', setup: 'Servicios con fecha, hora y anticipo opcional.' },
  'Mayorista / distribuidor': { summary: 'Vendes por volumen a otros negocios.', setup: 'Catálogo con precios, cantidades y control de existencias.' },
  'Manufactura / artesanías': { summary: 'Creas productos a mano o fabricas por pedido.', setup: 'Productos personalizados con detalles del pedido y tiempo de preparación.' },
  Otro: { summary: 'Tu negocio tiene una actividad diferente.', setup: 'Configuración flexible que puedes adaptar desde DREAMS.' },
};

function Onboarding() {
  const { status, user, businesses, reload, switchBusiness } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    tradeName: '', legalName: '', taxId: '', phone: '', email: '', address: '', city: '', country: 'CO',
    businessModel: 'PRODUCTS' as 'PRODUCTS' | 'SERVICES', serviceProfile: 'LEGAL',
    businessType: TYPES[0], category: CATEGORIES[0], instagram: '', facebook: '', whatsapp: '', tiktok: '',
  });
  const [brand, setBrand] = useState<BrandColors>(DEFAULT_BRAND);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (status === 'anonymous') router.replace('/ingresar');
    if (status === 'authenticated' && businesses.length > 0 && !params.get('nuevo')) router.replace('/dashboard');
  }, [status, businesses.length, params, router]);

  if (status !== 'authenticated') return <Loading />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) return setStep(step + 1);
    setBusy(true); setError(null);
    try {
      const socialLinks = Object.fromEntries(['instagram', 'facebook', 'whatsapp', 'tiktok'].map((k) => [k, f[k as keyof typeof f]]).filter(([, v]) => v));
      const body = Object.fromEntries(Object.entries({
        tradeName: f.tradeName, legalName: f.legalName, taxId: f.taxId, phone: f.phone, email: f.email,
        address: f.address, city: f.city, country: f.country,
        businessType: f.businessModel === 'SERVICES' ? SERVICE_PROFILES[f.serviceProfile].label : f.businessType,
        category: f.businessModel === 'SERVICES' ? SERVICE_PROFILES[f.serviceProfile].label : f.category,
        businessModel: f.businessModel, serviceProfile: f.businessModel === 'SERVICES' ? f.serviceProfile : undefined,
      }).filter(([, v]) => v));
      let referralCode: string | undefined;
      try { referralCode = localStorage.getItem('dream.ref') || undefined; } catch { /* */ }
      const b = await api<{ id: string }>('/businesses', { body: { ...body, socialLinks, brandColors: brand, ...(referralCode && /^[A-Za-z0-9]{4,12}$/.test(referralCode) ? { referralCode } : {}) }, noBusiness: true });
      try { localStorage.removeItem('dream.ref'); } catch { /* */ }
      await reload();
      switchBusiness(b.id);
      router.replace('/dashboard');
    } catch (err) { setError((err as Error).message); setStep(1); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="h-16 flex items-center px-6"><Logo /></header>
      <div className={`${step === 3 ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-4 py-8`}>
        <p className="text-xs text-ink-muted">Paso {step} de 3</p>
        <h1 className="font-display text-4xl font-semibold mt-1">{step === 1 ? `Hola, ${user?.fullName.split(' ')[0]}. Registremos tu negocio` : step === 2 ? 'Contacto y redes' : 'Los colores de tu marca'}</h1>
        <p className="text-sm text-ink-muted mt-2">{step === 3 ? 'Elige la paleta que usa tu negocio: DREAMS se verá con tus colores. Puedes cambiarla cuando quieras.' : 'Podrás cambiar estos datos cuando quieras en Configuración.'}</p>
        <form onSubmit={submit} className="card p-6 mt-6 space-y-4">
          {error && <ErrorBox message={error} />}
          {step === 1 ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nombre comercial *" className="sm:col-span-2"><input className="input" required value={f.tradeName} onChange={set('tradeName')} placeholder="Ej. Luna Accesorios" /></Field>
              <Field label="Razón social (si aplica)"><input className="input" value={f.legalName} onChange={set('legalName')} /></Field>
              <Field label="NIT o identificación tributaria"><input className="input" value={f.taxId} onChange={set('taxId')} placeholder="900.123.456-7" /></Field>
              <div className="sm:col-span-2"><p className="label mb-2">¿Qué ofrece tu negocio?</p><div className="grid sm:grid-cols-2 gap-2">
                {([['PRODUCTS', 'Vendo productos', 'Tiendas, ropa, comida, tecnología, artesanías… Manejas inventario, pedidos y envíos.'], ['SERVICES', 'Presto servicios', 'Abogados, técnicos, salones, consultores, clases… Manejas agenda, casos u órdenes y cobros.']] as const).map(([k, t, d]) =>
                  <button key={k} type="button" aria-pressed={f.businessModel === k} onClick={() => setF((x) => ({ ...x, businessModel: k }))} className={`rounded-2xl border p-4 text-left transition ${f.businessModel === k ? 'border-ink bg-sand-50 ring-1 ring-ink' : 'border-line hover:bg-sand-50'}`}><span className="block font-semibold">{t}</span><span className="block text-xs text-ink-muted mt-1">{d}</span></button>)}
              </div><p className="text-xs text-ink-muted mt-2">DREAMS adapta el menú y las herramientas a lo que elijas. Puedes cambiarlo después en Configuración.</p></div>
              {f.businessModel === 'SERVICES' ? <div className="sm:col-span-2"><p className="label mb-2">¿Qué tipo de servicio?</p><div className="grid sm:grid-cols-2 gap-2">{Object.values(SERVICE_PROFILES).map((sp) => <button key={sp.key} type="button" aria-pressed={f.serviceProfile === sp.key} onClick={() => setF((x) => ({ ...x, serviceProfile: sp.key }))} className={`rounded-xl border p-3 text-left transition ${f.serviceProfile === sp.key ? 'border-ink bg-sand-50 ring-1 ring-ink' : 'border-line hover:bg-sand-50'}`}><span className="block text-sm font-medium">{sp.label}</span><span className="block text-xs text-ink-muted mt-1">{sp.examples}</span></button>)}</div>
                <p className="text-xs text-ink-muted mt-3"><strong>Prepararemos:</strong> agenda, {SERVICE_PROFILES[f.serviceProfile].job.plural.toLowerCase()} con sus estados{SERVICE_PROFILES[f.serviceProfile].hours ? ', registro de horas' : ''}, {SERVICE_PROFILES[f.serviceProfile].quote.toLowerCase()} y cobros.</p></div> : <>
              <div className="sm:col-span-2"><p className="label mb-2">¿Qué tipo de negocio tienes?</p><div className="grid sm:grid-cols-2 gap-2">{TYPES.map((t) => <button key={t} type="button" aria-pressed={f.businessType === t} onClick={() => setF((x) => ({ ...x, businessType: t }))} className={`rounded-xl border p-3 text-left transition ${f.businessType === t ? 'border-ink bg-sand-50 ring-1 ring-ink' : 'border-line hover:bg-sand-50'}`}><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-ink-muted mt-1">{PROFILES[t].summary}</span></button>)}</div><p className="text-xs text-ink-muted mt-3"><strong>Prepararemos:</strong> {PROFILES[f.businessType].setup}</p></div>
              <Field label="Categoría"><select className="input" value={f.category} onChange={set('category')}>{CATEGORIES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              </>}
            </div>
          ) : step === 2 ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Teléfono"><input className="input" type="tel" value={f.phone} onChange={set('phone')} /></Field>
              <Field label="Correo del negocio"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
              <Field label="Dirección"><input className="input" value={f.address} onChange={set('address')} /></Field>
              <Field label="Ciudad"><input className="input" value={f.city} onChange={set('city')} /></Field>
              <Field label="País"><select className="input" value={f.country} onChange={set('country')}><option value="CO">Colombia</option><option value="EC">Ecuador</option><option value="PE">Perú</option><option value="MX">México</option><option value="CL">Chile</option></select></Field>
              <Field label="Instagram"><input className="input" value={f.instagram} onChange={set('instagram')} placeholder="@tunegocio" /></Field>
              <Field label="WhatsApp"><input className="input" value={f.whatsapp} onChange={set('whatsapp')} placeholder="+57 300 …" /></Field>
              <Field label="Facebook"><input className="input" value={f.facebook} onChange={set('facebook')} /></Field>
              <Field label="TikTok"><input className="input" value={f.tiktok} onChange={set('tiktok')} /></Field>
              <p className="sm:col-span-2 text-[11px] text-ink-faint">La información bancaria se agrega de forma segura en el módulo Bancos. El logo se sube en Configuración.</p>
            </div>
          ) : (
            <PalettePicker value={brand} onChange={setBrand} businessName={f.tradeName} />
          )}
          <div className="flex justify-between pt-2">
            {step > 1 ? <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>← Atrás</button> : <span />}
            <button className="btn-primary" disabled={busy}>{busy && <Spinner />}{step < 3 ? 'Continuar' : 'Crear negocio'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><Onboarding /></Suspense>;
}
