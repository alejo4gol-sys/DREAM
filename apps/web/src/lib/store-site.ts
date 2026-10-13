/**
 * Página web de cada negocio: tipos, valores por defecto, biblioteca de secciones,
 * plantillas por tipo de negocio y medios de pago predefinidos.
 */

export type SectionType = 'hero' | 'featured' | 'catalog' | 'about' | 'benefits' | 'gallery' | 'testimonials' | 'faq' | 'video' | 'cta' | 'contact' | 'policies' | 'newsletter';
export type SectionItem = { title?: string; text?: string; image?: string; icon?: string };
export type Section = {
  id: string; type: SectionType; enabled: boolean; title?: string; subtitle?: string; text?: string; image?: string;
  buttonLabel?: string; buttonUrl?: string; videoUrl?: string; background?: 'light' | 'accent' | 'dark'; items?: SectionItem[]; productIds?: string[];
};
export type PaymentKind = 'NEQUI' | 'DAVIPLATA' | 'BREB' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'CASH_PICKUP' | 'CARD_ON_DELIVERY' | 'PAYMENT_LINK' | 'OTHER';
export type PaymentMethod = {
  name: string; instructions: string; enabled: boolean; kind?: PaymentKind;
  accountHolder?: string; accountNumber?: string; bank?: string; accountType?: string; documentId?: string; link?: string; qrImage?: string;
};
export type SiteConfig = {
  template: string; headline: string; description: string; heroImage: string; heroButtonText: string; heroLayout: string; layout: string;
  fontStyle: string; textAlign: string; cardStyle: string; buttonStyle: string; imageRatio: string; headerStyle: string; sortDefault: string;
  catalogTitle: string; productButtonText: string; announcement: string; showProductDescription: boolean; showSocialLinks: boolean;
  showSearch: boolean; showFloatingWhatsapp: boolean; allowOrderNotes: boolean; showInDirectory: boolean; showMap?: boolean; primaryColor: string; backgroundColor: string; accentColor: string;
  whatsapp: string; seoTitle: string; seoDescription: string; shareImage: string; contactAddress: string; contactHours: string;
  contactEmail: string; contactPhone: string; mapUrl: string; deliveryEnabled: boolean; pickupEnabled: boolean; pickupAddress: string;
  shippingInfo: string; shippingFee: string; freeShippingMinimum: string; returnsPolicy: string; privacyPolicy: string; returnsEnabled: boolean; returnWindowDays: number;
  sections: Section[]; paymentMethods: PaymentMethod[];
};

export const SECTION_LIBRARY: { type: SectionType; label: string; hint: string; unique?: boolean }[] = [
  { type: 'hero', label: 'Portada', hint: 'Título grande, foto y botón principal', unique: true },
  { type: 'featured', label: 'Productos destacados', hint: 'Elige hasta 12 productos para mostrar primero' },
  { type: 'catalog', label: 'Catálogo completo', hint: 'Todos tus productos con búsqueda y categorías', unique: true },
  { type: 'about', label: 'Quiénes somos', hint: 'Tu historia con foto y botón' },
  { type: 'benefits', label: 'Beneficios', hint: 'Envíos, garantía, calidad… en tarjetas' },
  { type: 'gallery', label: 'Galería de fotos', hint: 'Hasta 12 imágenes de tu negocio' },
  { type: 'testimonials', label: 'Opiniones de clientes', hint: 'Comentarios reales que te hayan dejado' },
  { type: 'faq', label: 'Preguntas frecuentes', hint: 'Resuelve dudas antes de que pregunten' },
  { type: 'video', label: 'Video', hint: 'Un video de YouTube o Vimeo' },
  { type: 'cta', label: 'Llamado a la acción', hint: 'Franja con mensaje y botón (promo, cita, WhatsApp)' },
  { type: 'contact', label: 'Contacto y ubicación', hint: 'Dirección, horario, mapa y teléfono', unique: true },
  { type: 'policies', label: 'Políticas', hint: 'Envíos, cambios, devoluciones y datos', unique: true },
  { type: 'newsletter', label: 'Únete por WhatsApp', hint: 'Invita a escribirte para recibir novedades' },
];
export const sectionLabel = (t: SectionType) => SECTION_LIBRARY.find((s) => s.type === t)?.label ?? t;

export const BENEFIT_ICONS = ['truck', 'shield', 'star', 'heart', 'clock', 'leaf', 'gift', 'sparkles', 'check', 'map', 'phone', 'card'] as const;

const sid = (type: string, n = 1) => `${type}-${n}`;
export const newSection = (type: SectionType, existing: Section[] = []): Section => {
  const n = existing.filter((s) => s.type === type).length + 1;
  const base: Section = { id: sid(type, n), type, enabled: true };
  switch (type) {
    case 'featured': return { ...base, title: 'Lo más pedido', productIds: [] };
    case 'about': return { ...base, title: 'Quiénes somos', text: 'Cuenta aquí la historia de tu negocio: qué haces, para quién y qué te hace diferente.' };
    case 'benefits': return { ...base, title: '¿Por qué comprarnos?', items: [
      { icon: 'truck', title: 'Envíos a todo el país', text: 'Recibe tu pedido en la puerta de tu casa.' },
      { icon: 'shield', title: 'Compra segura', text: 'Pagas por medios confiables y te acompañamos.' },
      { icon: 'heart', title: 'Hecho con cariño', text: 'Cuidamos cada detalle de tu pedido.' }] };
    case 'gallery': return { ...base, title: 'Galería', items: [] };
    case 'testimonials': return { ...base, title: 'Lo que dicen nuestros clientes', items: [] };
    case 'faq': return { ...base, title: 'Preguntas frecuentes', items: [
      { title: '¿Cuánto tarda el envío?', text: 'Entre 2 y 5 días hábiles según tu ciudad.' },
      { title: '¿Cómo puedo pagar?', text: 'Elige el medio de pago al finalizar tu pedido; verás los datos para pagar.' }] };
    case 'video': return { ...base, title: 'Conócenos', videoUrl: '' };
    case 'cta': return { ...base, title: '¿Tienes dudas?', text: 'Escríbenos y te ayudamos a elegir.', buttonLabel: 'Escribir por WhatsApp', buttonUrl: '', background: 'accent' };
    case 'contact': return { ...base, title: 'Visítanos' };
    case 'policies': return { ...base, title: 'Políticas de la tienda' };
    case 'newsletter': return { ...base, title: 'Recibe novedades y promociones', text: 'Escríbenos por WhatsApp y te contamos primero de lanzamientos y descuentos. Puedes pedir que dejemos de escribirte cuando quieras.', buttonLabel: 'Quiero recibir novedades', background: 'dark' };
    case 'catalog': return { ...base };
    default: return base;
  }
};

export const DEFAULT_SECTIONS: Section[] = [
  { id: 'hero-1', type: 'hero', enabled: true },
  newSection('benefits'),
  { id: 'catalog-1', type: 'catalog', enabled: true },
  newSection('about'),
  newSection('faq'),
  { ...newSection('contact'), enabled: true },
  { ...newSection('policies'), enabled: true },
];

export const PAYMENT_PRESETS: { kind: PaymentKind; name: string; hint: string; fields: (keyof PaymentMethod)[] }[] = [
  { kind: 'NEQUI', name: 'Nequi', hint: 'Número de celular Nequi', fields: ['accountNumber', 'accountHolder', 'qrImage'] },
  { kind: 'DAVIPLATA', name: 'Daviplata', hint: 'Número de celular Daviplata', fields: ['accountNumber', 'accountHolder', 'qrImage'] },
  { kind: 'BREB', name: 'Bre-B (llave)', hint: 'Tu llave Bre-B: celular, correo, documento o alfanumérica', fields: ['accountNumber', 'accountHolder', 'bank', 'qrImage'] },
  { kind: 'BANK_TRANSFER', name: 'Transferencia bancaria', hint: 'Banco, tipo y número de cuenta', fields: ['bank', 'accountType', 'accountNumber', 'accountHolder', 'documentId'] },
  { kind: 'PAYMENT_LINK', name: 'Link de pago (tarjeta / PSE)', hint: 'Enlace de tu pasarela: Wompi, Bold, Mercado Pago, PayU, ePayco…', fields: ['link'] },
  { kind: 'CASH_ON_DELIVERY', name: 'Efectivo contra entrega', hint: 'El cliente paga al recibir', fields: [] },
  { kind: 'CARD_ON_DELIVERY', name: 'Datáfono contra entrega', hint: 'Llevas datáfono al entregar', fields: [] },
  { kind: 'CASH_PICKUP', name: 'Pago al recoger en el local', hint: 'Solo aparece si el cliente elige recoger', fields: [] },
  { kind: 'OTHER', name: 'Otro medio de pago', hint: 'Addi, Sistecrédito, cripto… con tus instrucciones', fields: ['link'] },
];

export const FIELD_LABELS: Partial<Record<keyof PaymentMethod, string>> = {
  accountNumber: 'Número / llave', accountHolder: 'Titular', bank: 'Banco', accountType: 'Tipo de cuenta',
  documentId: 'Documento del titular', link: 'Enlace de pago (https://…)', qrImage: 'Código QR (imagen)',
};

/** Texto de instrucciones a partir de los datos estructurados del medio de pago. */
export function paymentDetails(m: PaymentMethod): { label: string; value: string; copy?: boolean }[] {
  const out: { label: string; value: string; copy?: boolean }[] = [];
  if (m.bank) out.push({ label: 'Banco', value: m.bank });
  if (m.accountType) out.push({ label: 'Tipo de cuenta', value: m.accountType });
  if (m.accountNumber) out.push({ label: m.kind === 'BREB' ? 'Llave' : m.kind === 'BANK_TRANSFER' ? 'Cuenta' : 'Número', value: m.accountNumber, copy: true });
  if (m.accountHolder) out.push({ label: 'Titular', value: m.accountHolder });
  if (m.documentId) out.push({ label: 'Documento', value: m.documentId });
  return out;
}

export type Template = { id: string; label: string; types: string[]; description: string; config: Partial<SiteConfig> };

const T = (sections: SectionType[]) => sections.map((t, i) => {
  const s = t === 'hero' || t === 'catalog' ? { id: `${t}-1`, type: t, enabled: true } as Section : newSection(t);
  return { ...s, id: `${t}-${i + 1}` };
});

export const TEMPLATES: Template[] = [
  { id: 'moda', label: 'Moda y accesorios', types: ['ropa', 'moda', 'accesorios', 'calzado', 'joyer', 'minorista', 'boutique'],
    description: 'Editorial, fotos verticales y tipografía elegante.',
    config: { heroLayout: 'overlay', layout: 'editorial', fontStyle: 'serif', imageRatio: 'portrait', cardStyle: 'flat', buttonStyle: 'square', headerStyle: 'centered',
      primaryColor: '#111111', backgroundColor: '#F7F4EF', accentColor: '#B69C72', productButtonText: 'Lo quiero', catalogTitle: 'Nueva colección',
      sections: T(['hero', 'featured', 'catalog', 'benefits', 'gallery', 'testimonials', 'faq', 'policies', 'contact']) } },
  { id: 'restaurante', label: 'Restaurante y comidas', types: ['restaurante', 'comida', 'cafe', 'café', 'panader', 'reposter', 'postre', 'bebida'],
    description: 'Menú claro, botón grande y recogida en el local.',
    config: { heroLayout: 'split', layout: 'list', fontStyle: 'rounded', imageRatio: 'square', cardStyle: 'soft', buttonStyle: 'pill', headerStyle: 'classic',
      primaryColor: '#3B2A1A', backgroundColor: '#FFF8EE', accentColor: '#D9822B', productButtonText: 'Pedir', catalogTitle: 'Nuestro menú', pickupEnabled: true,
      announcement: 'Pide en línea y recoge sin hacer fila',
      sections: T(['hero', 'catalog', 'cta', 'about', 'gallery', 'contact', 'faq']) } },
  { id: 'servicios', label: 'Servicios y citas', types: ['servicio', 'salon', 'salón', 'spa', 'belleza', 'barber', 'consult', 'clase', 'taller', 'salud'],
    description: 'Agenda de citas, confianza y contacto directo.',
    config: { heroLayout: 'banner', layout: 'list', fontStyle: 'modern', imageRatio: 'wide', cardStyle: 'outline', buttonStyle: 'round', headerStyle: 'classic',
      primaryColor: '#1F3A5F', backgroundColor: '#F5F8FB', accentColor: '#4C9A8A', productButtonText: 'Reservar', catalogTitle: 'Servicios', deliveryEnabled: false, pickupEnabled: true,
      sections: T(['hero', 'benefits', 'catalog', 'testimonials', 'about', 'faq', 'contact', 'policies']) } },
  { id: 'belleza', label: 'Belleza y cuidado personal', types: ['cosmet', 'maquill', 'cuidado', 'skincare', 'perfum', 'uñas'],
    description: 'Suave, luminosa y con beneficios destacados.',
    config: { heroLayout: 'split', layout: 'grid', fontStyle: 'display', imageRatio: 'square', cardStyle: 'soft', buttonStyle: 'pill', headerStyle: 'centered',
      primaryColor: '#5B2B3F', backgroundColor: '#FFF5F6', accentColor: '#E8A3B5', productButtonText: 'Agregar', catalogTitle: 'Favoritos de la casa',
      sections: T(['hero', 'featured', 'benefits', 'catalog', 'video', 'testimonials', 'faq', 'newsletter', 'policies']) } },
  { id: 'tecnologia', label: 'Tecnología y electrónica', types: ['tecnolog', 'electr', 'celular', 'computador', 'gamer', 'accesorios tecno'],
    description: 'Limpia, directa, con garantía y especificaciones.',
    config: { heroLayout: 'banner', layout: 'grid', fontStyle: 'modern', imageRatio: 'square', cardStyle: 'outline', buttonStyle: 'round', headerStyle: 'minimal',
      primaryColor: '#0F172A', backgroundColor: '#F8FAFC', accentColor: '#2563EB', productButtonText: 'Comprar', catalogTitle: 'Catálogo',
      sections: T(['hero', 'featured', 'catalog', 'benefits', 'faq', 'policies', 'contact']) } },
  { id: 'artesanal', label: 'Artesanías y hecho a mano', types: ['artesan', 'hecho a mano', 'decoraci', 'regalo', 'hogar', 'mascota'],
    description: 'Cálida, con historia y galería de procesos.',
    config: { heroLayout: 'overlay', layout: 'grid', fontStyle: 'classic', imageRatio: 'portrait', cardStyle: 'soft', buttonStyle: 'pill', headerStyle: 'centered',
      primaryColor: '#3F3A2E', backgroundColor: '#F6F1E7', accentColor: '#8A9A5B', productButtonText: 'Agregar', catalogTitle: 'Piezas disponibles',
      sections: T(['hero', 'about', 'catalog', 'gallery', 'video', 'testimonials', 'faq', 'contact']) } },
  { id: 'mercado', label: 'Mercado, tienda de barrio y víveres', types: ['mercado', 'víveres', 'viveres', 'tienda de barrio', 'minimercado', 'fruver', 'licor', 'drogu'],
    description: 'Catálogo amplio con búsqueda y domicilios.',
    config: { heroLayout: 'simple', layout: 'minimal', fontStyle: 'modern', imageRatio: 'square', cardStyle: 'classic', buttonStyle: 'round', headerStyle: 'classic',
      primaryColor: '#14532D', backgroundColor: '#F7FBF4', accentColor: '#F59E0B', productButtonText: 'Agregar', catalogTitle: 'Todo lo que necesitas', showSearch: true, pickupEnabled: true,
      announcement: 'Domicilios en tu barrio', sections: T(['hero', 'catalog', 'benefits', 'contact', 'policies']) } },
  { id: 'minimal', label: 'Minimalista (cualquier negocio)', types: [],
    description: 'Blanco, negro y beige: la identidad DREAMS.',
    config: { heroLayout: 'banner', layout: 'grid', fontStyle: 'modern', imageRatio: 'square', cardStyle: 'soft', buttonStyle: 'pill', headerStyle: 'classic',
      primaryColor: '#171717', backgroundColor: '#FAF8F4', accentColor: '#B69C72', sections: DEFAULT_SECTIONS } },
];

export const templateForBusiness = (businessType?: string | null, category?: string | null) => {
  const text = `${businessType ?? ''} ${category ?? ''}`.toLocaleLowerCase('es');
  return TEMPLATES.find((t) => t.types.some((k) => text.includes(k))) ?? TEMPLATES[TEMPLATES.length - 1];
};

export const DEFAULT_PAYMENTS: PaymentMethod[] = [
  { name: 'Nequi', kind: 'NEQUI', instructions: '', enabled: false },
  { name: 'Transferencia bancaria', kind: 'BANK_TRANSFER', instructions: '', enabled: false },
  { name: 'Efectivo contra entrega', kind: 'CASH_ON_DELIVERY', instructions: 'Ten el valor exacto, por favor.', enabled: true },
];

export const SITE_DEFAULTS: SiteConfig = {
  template: 'minimal', headline: 'Hecho para ti', description: 'Descubre nuestros productos y encuentra tu favorito.', heroImage: '', heroButtonText: 'Ver productos',
  heroLayout: 'banner', layout: 'grid', fontStyle: 'modern', textAlign: 'left', cardStyle: 'soft', buttonStyle: 'pill', imageRatio: 'square',
  headerStyle: 'classic', sortDefault: 'name', catalogTitle: 'Nuestros productos', productButtonText: 'Agregar', announcement: '',
  showProductDescription: true, showSocialLinks: true, showSearch: true, showFloatingWhatsapp: true, allowOrderNotes: true, showInDirectory: true,
  primaryColor: '#171717', backgroundColor: '#FAF8F4', accentColor: '#B69C72', whatsapp: '', seoTitle: '', seoDescription: '', shareImage: '',
  contactAddress: '', contactHours: '', contactEmail: '', contactPhone: '', mapUrl: '', deliveryEnabled: true, pickupEnabled: false, pickupAddress: '',
  shippingInfo: '', shippingFee: '0', freeShippingMinimum: '', returnsPolicy: '', privacyPolicy: '', returnsEnabled: true, returnWindowDays: 30, sections: DEFAULT_SECTIONS, paymentMethods: DEFAULT_PAYMENTS,
};

export const FONTS: Record<string, { label: string; family: string }> = {
  modern: { label: 'Moderna', family: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  serif: { label: 'Elegante', family: 'Georgia, "Times New Roman", serif' },
  rounded: { label: 'Amigable', family: '"Trebuchet MS", "Segoe UI", Arial, sans-serif' },
  classic: { label: 'Clásica', family: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  mono: { label: 'Técnica', family: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  display: { label: 'Estilizada', family: '"Didot", "Bodoni MT", "Hoefler Text", Georgia, serif' },
};

/** Solo enlaces seguros en botones (defensa adicional a la validación del servidor). */
export const safeHref = (url?: string) => {
  const u = (url ?? '').trim();
  return /^(https:\/\/|#[a-z0-9-]+$|\/tienda\/|mailto:|tel:)/i.test(u) ? u : '';
};

export const youtubeEmbed = (url?: string) => {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : '');
      return v ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}` : '';
    }
    if (u.hostname.includes('vimeo.com')) { const id = u.pathname.split('/').filter(Boolean).pop(); return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : ''; }
  } catch { /* enlace inválido */ }
  return '';
};

/** Contraste: color de texto legible sobre un fondo. */
export const onColor = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111111' : '#ffffff';
};

/** Medios de pago creados antes de los tipos predefinidos: se reconoce el tipo por su nombre. */
export const inferKind = (m: PaymentMethod): PaymentMethod => {
  if (m.kind) return m;
  const n = m.name.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const kind: PaymentKind = n.includes('nequi') ? 'NEQUI' : n.includes('daviplata') ? 'DAVIPLATA' : n.includes('bre') ? 'BREB'
    : n.includes('transfer') || n.includes('consigna') ? 'BANK_TRANSFER' : n.includes('recoger') ? 'CASH_PICKUP'
      : n.includes('efectivo') || n.includes('contra entrega') ? 'CASH_ON_DELIVERY' : n.includes('datafono') ? 'CARD_ON_DELIVERY'
        : n.includes('link') || n.includes('pse') || n.includes('tarjeta') ? 'PAYMENT_LINK' : 'OTHER';
  return { ...m, kind };
};
