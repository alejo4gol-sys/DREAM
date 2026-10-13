import Link from 'next/link';
import {
  ArrowRight, BarChart3, Boxes, Check, FileText, Gavel, Landmark, MessageCircle, Minus, Scissors, ShieldCheck, ShoppingBasket, Sparkles, Store, Truck, Users, UtensilsCrossed, Wrench, X,
} from 'lucide-react';
import { HeroMontage } from '@/components/hero-montage';
import { SupportButton, Testimonials } from '@/components/public-trust';
import { Logo } from '@/components/ui';
import { CLIPS } from '@/lib/hero-clips';
import { HELP_BRAND } from '@/lib/help-brand';

/*
 * Portada de DREAMS. Paleta: la del logo (negro tinta #111 y arena #B69C72 con sus tonos claros)
 * más un acento cálido (dorado → coral) para dar vida sin perder formalidad.
 * Colores fijos (no las variables de tema) para que la portada no cambie con la paleta de cada negocio.
 */
const GRAD = 'bg-gradient-to-r from-[#C8963E] via-[#D9774B] to-[#C4513F]';
const GRAD_TEXT = 'bg-gradient-to-r from-[#B8862F] via-[#D46A3F] to-[#B8432F] bg-clip-text text-transparent';

const sectors = [
  { icon: ShoppingBasket, title: 'Tiendas y plazas de mercado', text: 'Ventas del día, fiado, inventario y pedidos por WhatsApp.', tone: 'text-[#B8862F] bg-[#FBF1DE]' },
  { icon: Truck, title: 'Proveedores y distribuidores', text: 'Clientes mayoristas, cuentas por cobrar, bodegas y entregas.', tone: 'text-[#2F5D73] bg-[#E6EFF3]' },
  { icon: UtensilsCrossed, title: 'Restaurantes y comidas', text: 'Pedidos, domicilios, insumos y lo que te deja cada plato.', tone: 'text-[#C4513F] bg-[#FBE9E5]' },
  { icon: Scissors, title: 'Belleza y confección', text: 'Agenda de citas, servicios, clientes frecuentes y recordatorios.', tone: 'text-[#9A4A6B] bg-[#F6E8EE]' },
  { icon: Wrench, title: 'Talleres y técnicos', text: 'Órdenes de servicio, repuestos, garantías y seguimiento para el cliente.', tone: 'text-[#2F6B4F] bg-[#E5F1EA]' },
  { icon: Gavel, title: 'Abogados y profesionales', text: 'Casos, términos, seguimiento de procesos y honorarios.', tone: 'text-[#111111] bg-[#EDE4D3]' },
];

const features = [
  { icon: BarChart3, title: 'Ventas y tablero', text: 'Registra cada venta en segundos y mira cómo vas hoy, esta semana y este mes.' },
  { icon: Boxes, title: 'Inventario al día', text: 'El stock se descuenta solo al vender y te avisamos antes de que algo se agote.' },
  { icon: Users, title: 'Clientes que vuelven', text: 'Historial, canal por el que llegaron y quiénes son tus mejores clientes.' },
  { icon: Store, title: 'Tu tienda en línea', text: 'Una página con tus productos y servicios para recibir pedidos y reservas.' },
  { icon: FileText, title: 'Facturas y comprobantes', text: 'Con tu logo, en PDF y guardadas para garantías. Lista para conectar con la DIAN.' },
  { icon: Landmark, title: 'Finanzas claras', text: 'Gastos, utilidad, flujo de caja y conciliación con tus bancos.' },
  { icon: MessageCircle, title: 'Redes y WhatsApp', text: 'Mide qué canal te vende más: Instagram, WhatsApp, Facebook, TikTok o tienda física.' },
  { icon: Sparkles, title: 'Asistente de negocio', text: 'Pregunta «¿cuánto vendí este mes?» y te responde con tus propios datos.' },
];

const plans = [
  { code: 'FREE', name: 'Gratis', price: '$0', note: 'para siempre', tagline: 'Para empezar a ordenar tu negocio.', cta: 'Empezar gratis' },
  { code: 'BASIC', name: 'Emprendedor', price: '$19.900', note: 'al mes', tagline: 'Menos de lo que cuesta un almuerzo a la semana.', cta: 'Elegir Emprendedor', featured: true },
  { code: 'PRO', name: 'Negocio', price: '$44.900', note: 'al mes', tagline: 'Para negocios con equipo y más movimiento.', cta: 'Elegir Negocio' },
  { code: 'ENTERPRISE', name: 'Empresa', price: '$99.900', note: 'al mes', tagline: 'Para crecer sin límites.', cta: 'Elegir Empresa' },
];

/** Celda de la tabla: true = incluido, false = no incluido, texto = límite. Debe coincidir con los límites de seed.ts. */
type Cell = boolean | string;
const compare: { group: string; rows: { label: string; help?: string; v: [Cell, Cell, Cell, Cell] }[] }[] = [
  { group: 'Uso', rows: [
    { label: 'Usuarios', v: ['1', '2', '5', 'Ilimitados'] },
    { label: 'Productos o servicios', v: ['100', '1.000', '5.000', 'Ilimitados'] },
    { label: 'Ventas al mes', v: ['150', 'Ilimitadas', 'Ilimitadas', 'Ilimitadas'] },
  ] },
  { group: 'Vender', rows: [
    { label: 'Registro de ventas, cobros y métodos de pago', v: [true, true, true, true] },
    { label: 'Inventario con alertas de stock bajo', v: [true, true, true, true] },
    { label: 'Clientes y proveedores', v: [true, true, true, true] },
    { label: 'Tienda en línea con tu marca', v: [true, true, true, true] },
    { label: 'Agenda de citas y órdenes de servicio', v: [true, true, true, true] },
    { label: 'Facturas con tu logo en PDF', v: [true, true, true, true] },
    { label: 'Facturación electrónica DIAN', help: 'Conectada con Factus (contrato del negocio con el proveedor)', v: [true, true, true, true] },
    { label: 'Venta rápida desde el celular y cobros con link o QR', v: [true, true, true, true] },
    { label: 'Catálogo en PDF, para Canva y sincronizado con WhatsApp e Instagram', v: [true, true, true, true] },
    { label: 'Listas de precios mayoristas, cupo y cartera', v: [true, true, true, true] },
    { label: 'Paquetes de sesiones y membresías', v: [true, true, true, true] },
    { label: 'Ficha en el directorio con mapa, «Cómo llegar» y reseñas', v: [true, true, true, true] },
  ] },
  { group: 'Dinero', rows: [
    { label: 'Gastos, ingresos y contabilidad gerencial', v: [true, true, true, true] },
    { label: 'Cuentas bancarias y conciliación', v: ['1', '1', '3', 'Ilimitadas'] },
  ] },
  { group: 'Redes y avisos', rows: [
    { label: 'Redes sociales conectadas', v: ['1', '3', '6', 'Ilimitadas'] },
    { label: 'Avisos por WhatsApp', v: [false, true, true, true] },
    { label: 'Notificaciones dentro de DREAMS', v: [true, true, true, true] },
  ] },
  { group: 'Reportes y análisis', rows: [
    { label: 'Tablero y gráficos', v: [true, true, true, true] },
    { label: 'Descarga en CSV', v: [true, true, true, true] },
    { label: 'Descarga en Excel', v: [false, true, true, true] },
    { label: 'Descarga en PDF', v: [false, false, true, true] },
    { label: 'Asistente de negocio', v: [true, true, true, true] },
  ] },
  { group: 'Abogados y profesionales', rows: [
    { label: 'Casos, términos y calculadora de honorarios', v: [true, true, true, true] },
    { label: 'Plantillas de documentos que se llenan con el caso (Word y PDF)', v: [true, true, true, true] },
    { label: 'Procesos vigilados (Rama Judicial y entidades)', v: ['5', '30', '150', 'Ilimitados'] },
    { label: `Recibir clientes de «${HELP_BRAND.name}»`, help: 'Requiere tarjeta profesional verificada', v: [true, true, true, true] },
  ] },
  { group: 'Soporte', rows: [
    { label: 'Tutoriales, guía de arranque y ayuda por WhatsApp', v: [true, true, true, true] },
    { label: 'Soporte prioritario', v: [false, false, false, true] },
  ] },
];

function CellView({ v, featured }: { v: Cell; featured?: boolean }) {
  if (v === true) return <span className="inline-flex items-center gap-1 text-[#2F6B4F]"><Check className="h-4 w-4" /><span className="sr-only">Incluido</span></span>;
  if (v === false) return <span className="inline-flex items-center gap-1 text-[#A8A196] text-xs"><X className="h-4 w-4" /> No incluye</span>;
  return <span className={`font-semibold ${featured ? 'text-[#111]' : 'text-[#2A2826]'}`}>{v}</span>;
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#111111]">
      {/* Encabezado */}
      <header className="sticky top-0 z-30 bg-[#FBF9F5]/90 backdrop-blur border-b border-[#EDE4D3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/negocios" className="hidden sm:inline-flex btn-ghost">Negocios</Link>
            <a href="#planes" className="hidden sm:inline-flex btn-ghost">Planes</a>
            <Link href="/ayuda" className="hidden md:inline-flex btn-ghost">{HELP_BRAND.name}</Link>
            <Link href="/ingresar" className="btn-ghost">Ingresar</Link>
            <Link href="/registro" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#111] text-white text-sm font-semibold hover:bg-[#2A2826]">Crear cuenta</Link>
          </nav>
        </div>
      </header>

      {/* Portada */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#F3E3C3_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_right,_#F4D6CB_0%,_transparent_45%)]" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 grid lg:grid-cols-[1.05fr_.95fr] gap-10 lg:gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E2D4BA] px-3 py-1 text-xs font-semibold text-[#8F7651]">
              <span className="h-2 w-2 rounded-full bg-[#B69C72]" /> Hecho en Colombia para emprendedores
            </span>
            <h1 className="font-display text-5xl sm:text-[4.2rem] leading-[1] font-semibold mt-5">
              Tu negocio, <span className={`${GRAD_TEXT} italic`}>ordenado</span><br className="hidden sm:block" /> y vendiendo más.
            </h1>
            <p className="mt-5 text-lg text-[#4A453F] max-w-xl">
              Ventas, inventario, clientes, facturas, tienda en línea y finanzas en un solo lugar. Para tiendas, proveedores, restaurantes, peluquerías, talleres, profesionales y todo el que se le mide a emprender.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registro" className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-full ${GRAD} text-white text-base font-semibold shadow-lg shadow-[#D9774B]/25 hover:brightness-105`}>
                Empieza gratis <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#planes" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white border border-[#D9CDB6] text-[#111] text-base font-semibold hover:border-[#B69C72]">Comparar planes</a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#4A453F]">
              {['Sin tarjeta de crédito', 'Funciona en el celular', 'Cancela cuando quieras'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-[#2F6B4F]" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 rounded-[36px] bg-[#111] rotate-2" aria-hidden />
            <div className={`absolute -inset-3 rounded-[36px] ${GRAD} -rotate-2 opacity-70`} aria-hidden />
            <div className="relative"><HeroMontage /></div>
          </div>
        </div>
      </section>

      {/* Cifras rápidas en franja tinta (como el logo) */}
      <section className="bg-[#111] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[['Desde $0', 'para empezar'], ['15+', 'herramientas en un solo lugar'], ['100 %', 'en español y en pesos'], ['24/7', 'desde el celular o el computador']].map(([a, b]) => (
            <div key={b}><p className="font-display text-3xl font-semibold text-[#E2D4BA]">{a}</p><p className="text-xs text-white/70 mt-1">{b}</p></div>
          ))}
        </div>
      </section>

      {/* Para quién */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8F7651]">Para todo tipo de negocio</p>
        <h2 className="font-display text-4xl sm:text-5xl font-semibold mt-2">Se adapta a lo que tú haces</h2>
        <p className="text-[#4A453F] mt-3 max-w-2xl">Al crear tu cuenta eliges tu tipo de negocio y DREAMS te muestra las herramientas que necesitas, con las palabras de tu oficio.</p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((s) => (
            <div key={s.title} className="rounded-3xl bg-white p-6 border border-[#EDE4D3] hover:border-[#B69C72] hover:shadow-md transition">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${s.tone}`}><s.icon className="h-6 w-6" /></span>
              <h3 className="font-semibold text-lg mt-4">{s.title}</h3>
              <p className="text-sm text-[#5C564E] mt-1.5">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Funciones */}
      <section className="bg-white border-y border-[#EDE4D3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C4513F]">Todo en un solo lugar</p>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold mt-2">Lo que necesitas, nada que te sobre</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, k) => (
              <div key={f.title} className="rounded-3xl border border-[#EDE4D3] p-6 bg-[#FBF9F5]">
                <span className={`relative inline-flex h-11 w-11 items-center justify-center rounded-[12px] ${k % 2 ? 'bg-[#111] text-[#E2D4BA]' : `${GRAD} text-white`}`}>
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold mt-4">{f.title}</h3>
                <p className="text-sm text-[#5C564E] mt-1.5 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Propósito */}
      <section className="relative overflow-hidden bg-[#111] text-white">
        <div className={`absolute -right-32 -top-32 h-80 w-80 rounded-full ${GRAD} opacity-30 blur-3xl`} aria-hidden />
        <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-[#B69C72]/30 blur-3xl" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-[.9fr_1.1fr] gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E2D4BA]">Nuestro propósito</p>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold mt-2">Que dediques tu tiempo a lo que sabes hacer.</h2>
            <p className="mt-4 text-white/80 text-lg">Tecnología sencilla y a un precio justo para que el pequeño negocio colombiano crezca con orden, venda en más lugares y decida con información clara.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              ['Más claridad', 'Ventas, productos y gastos desde un solo lugar.'],
              ['Menos tareas repetidas', 'Pedidos, clientes e inventario organizados.'],
              ['Crece a tu ritmo', 'Empieza gratis y suma herramientas cuando estés listo.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl bg-white/5 p-5 border border-white/15">
                <span className="block h-2 w-8 rounded-full bg-[#B69C72]" />
                <p className="font-semibold text-[#F6F1E8] mt-3">{title}</p>
                <p className="text-sm text-white/70 mt-2">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 scroll-mt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8F7651]">Planes</p>
        <h2 className="font-display text-4xl sm:text-5xl font-semibold mt-2">Precios pensados para emprendedores</h2>
        <p className="text-[#4A453F] mt-3">Empieza gratis y cambia de plan cuando tu negocio lo pida. Precios mensuales en pesos colombianos.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {plans.map((p) => (
            <div key={p.name} className={`relative rounded-3xl p-6 flex flex-col ${p.featured ? 'bg-[#111] text-white shadow-2xl lg:-translate-y-2' : 'bg-white border border-[#EDE4D3]'}`}>
              {p.featured && <span className={`absolute -top-3 left-6 rounded-full ${GRAD} text-white text-xs font-semibold px-3 py-1 shadow`}>El más elegido</span>}
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${p.featured ? 'text-[#E2D4BA]' : 'text-[#8F7651]'}`}>{p.name}</p>
              <p className="mt-3"><span className="font-display text-5xl font-semibold">{p.price}</span><span className={`text-sm ${p.featured ? 'text-white/70' : 'text-[#6B645A]'}`}> {p.note}</span></p>
              <p className={`text-sm mt-2 flex-1 ${p.featured ? 'text-white/80' : 'text-[#5C564E]'}`}>{p.tagline}</p>
              <Link href="/registro" className={`mt-6 inline-flex justify-center items-center h-11 rounded-full text-sm font-semibold ${p.featured ? `${GRAD} text-white hover:brightness-105` : 'bg-[#111] text-white hover:bg-[#2A2826]'}`}>{p.cta}</Link>
            </div>
          ))}
        </div>

        {/* Tabla comparativa */}
        <h3 className="font-display text-3xl font-semibold mt-14">Compara los planes</h3>
        <p className="text-sm text-[#5C564E] mt-1">Todo lo que incluye y lo que no incluye cada plan.</p>
        <div className="mt-5 overflow-x-auto rounded-3xl border border-[#EDE4D3] bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#EDE4D3]">
                <th className="sticky left-0 z-10 bg-white text-left font-semibold p-4 w-[34%]">Funciones</th>
                {plans.map((p) => (
                  <th key={p.code} className={`p-4 text-center align-bottom ${p.featured ? 'bg-[#F6F1E8]' : ''}`}>
                    <span className={`block text-xs uppercase tracking-[0.15em] ${p.featured ? 'text-[#C4513F]' : 'text-[#8F7651]'}`}>{p.name}</span>
                    <span className="block font-display text-2xl font-semibold mt-1">{p.price}</span>
                    <span className="block text-[11px] font-normal text-[#6B645A]">{p.note}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.map((g) => [
                <tr key={g.group} className="bg-[#111] text-[#E2D4BA]">
                  <td colSpan={5} className="sticky left-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">{g.group}</td>
                </tr>,
                ...g.rows.map((r) => (
                  <tr key={r.label} className="border-b border-[#F1EADC] last:border-0">
                    <td className="sticky left-0 z-10 bg-white p-4">
                      <span className="font-medium">{r.label}</span>
                      {r.help && <span className="block text-[11px] text-[#8A8378] mt-0.5">{r.help}</span>}
                    </td>
                    {r.v.map((v, k) => <td key={k} className={`p-4 text-center ${plans[k].featured ? 'bg-[#FBF6EC]' : ''}`}><CellView v={v} featured={plans[k].featured} /></td>)}
                  </tr>
                )),
              ])}
              <tr>
                <td className="sticky left-0 z-10 bg-white p-4" />
                {plans.map((p) => (
                  <td key={p.code} className={`p-4 text-center ${p.featured ? 'bg-[#FBF6EC]' : ''}`}>
                    <Link href="/registro" className={`inline-flex justify-center items-center h-10 px-4 rounded-full text-xs font-semibold ${p.featured ? `${GRAD} text-white` : 'bg-[#111] text-white'}`}>{p.cta}</Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#6B645A] mt-3 flex items-start gap-1.5"><Minus className="h-3.5 w-3.5 mt-0.5 shrink-0" />La facturación electrónica requiere habilitarte ante la DIAN y contratar el proveedor tecnológico (DREAMS se conecta con Factus). Los avisos por WhatsApp se envían solo a quien los autoriza.</p>
      </section>

      {/* Micro app ciudadana */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl bg-[#F6F1E8] border border-[#E2D4BA] p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8F7651]">Orientación legal gratuita</p>
            <p className="font-display text-3xl sm:text-4xl font-semibold mt-1">¿Tienes un problema legal? Entra a «{HELP_BRAND.name}»</p>
            <p className="text-[#4A453F] mt-2 max-w-2xl">Te decimos en palabras sencillas qué puedes hacer, dónde acudir en tu municipio y si tienes un plazo corriendo. Si quieres, abogados verificados te envían propuestas.</p>
          </div>
          <Link href="/ayuda" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[#111] text-white font-semibold shrink-0 hover:bg-[#2A2826]">Abrir {HELP_BRAND.name} <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <Testimonials />

      {/* Seguridad y llamado final */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-[#111] text-white p-8 sm:p-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className={`absolute -right-20 -bottom-24 h-64 w-64 rounded-full ${GRAD} opacity-25 blur-3xl`} aria-hidden />
          <div className="relative flex gap-4 items-start">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B69C72]/20 text-[#E2D4BA] shrink-0"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <p className="font-display text-2xl font-semibold">Seguridad desde el primer día</p>
              <p className="text-sm text-white/70 mt-1 max-w-xl">Contraseñas cifradas, verificación en dos pasos, permisos por rol y registro de actividad. Nunca te pediremos la contraseña de tu banco.</p>
            </div>
          </div>
          <Link href="/registro" className={`relative inline-flex items-center gap-2 h-12 px-6 rounded-full ${GRAD} font-semibold shrink-0 hover:brightness-105`}>Crear mi cuenta gratis <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <footer className="border-t border-[#EDE4D3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-3 text-xs text-[#6B645A]">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <Logo />
            <p>La contabilidad de DREAMS es gerencial y no reemplaza la asesoría de un contador público.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Legal">
            <Link className="underline underline-offset-2 hover:text-[#111]" href="/terminos-y-condiciones">Términos y condiciones</Link>
            <Link className="underline underline-offset-2 hover:text-[#111]" href="/politica-de-datos">Política de tratamiento de datos</Link>
            <Link className="underline underline-offset-2 hover:text-[#111]" href="/negocios">Directorio de negocios</Link>
            <Link className="underline underline-offset-2 hover:text-[#111]" href="/registro">Invita y gana: 15 días por cada negocio que pague un plan</Link>
          </nav>
          <p>Videos de la portada: Pexels — {CLIPS.map((c, k) => <span key={c.id}>{k > 0 && ', '}<a className="underline underline-offset-2 hover:text-[#111]" href={`https://www.pexels.com/video/${c.id}/`} target="_blank" rel="noreferrer">{c.credit}</a></span>)}.</p>
        </div>
      </footer>
      <SupportButton />
    </div>
  );
}
