'use client';
import {
  Check, ChevronDown, Clock, Copy, CreditCard, Gift, Heart, Leaf, Mail, MapPin, MessageCircle, Phone, RotateCcw, Search, ShieldCheck,
  ShoppingBag, Sparkles, Star, Store as StoreIcon, Truck, X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { ErrorBox, Loading } from '@/components/ui';
import { StoreReturns } from '@/components/store-returns';
import { StoreTracking } from '@/components/store-tracking';
import { profileFor } from '@/lib/service-profiles';
import { FONTS, PaymentMethod, Section, SITE_DEFAULTS, inferKind, onColor, paymentDetails, safeHref, youtubeEmbed } from '@/lib/store-site';

type StoreOption = { name: string; type: 'select' | 'multi' | 'text' | 'date' | 'time'; required: boolean; choices?: { label: string; priceDelta?: string }[] };
type Variant = { id: string; sku: string; options: Record<string, string>; stock: number };
type Item = { id: string; name: string; description?: string; salePrice: string; imageUrl?: string; categoryId?: string; categoryName?: string | null; createdAt?: string; storeOptions?: StoreOption[]; variants?: Variant[]; preparationMinutes?: number | null; depositPercent?: number; appointmentSchedule?: { weekdays: number[]; startTime: string; endTime: string; intervalMinutes: number; durationMinutes: number } | null };
type StoreData = { business: { businessModel?: string; serviceProfile?: string | null; name: string; logoUrl?: string; phone?: string; email?: string; city?: string; address?: string; socialLinks?: Record<string, string> }; settings: any; paymentGatewayEnabled?: boolean; couponsEnabled?: boolean; products: Item[] };
type Checkout = { url: string; publicKey: string; reference: string; amountInCents: string; currency: string; acceptanceToken: string; signature: string; redirectUrl: string };
type Attribution = { source?: string; medium?: string; campaign?: string; content?: string };
type Applied = { code: string; discount: number; freeShipping: boolean; description?: string | null };
type Placed = { shortId: string; total: string; shippingFee: string; discount: string; paymentDue: string; method?: PaymentMethod; delivery: 'DELIVERY' | 'PICKUP' };

const PREVIEW_SLUG = '__vista-previa';
const WOMPI = 'Wompi · tarjeta o PSE';
const ICONS: Record<string, typeof Truck> = { truck: Truck, shield: ShieldCheck, star: Star, heart: Heart, clock: Clock, leaf: Leaf, gift: Gift, sparkles: Sparkles, check: Check, map: MapPin, phone: Phone, card: CreditCard };
/** UUID v4 también en http (la red Wi-Fi local), donde crypto.randomUUID no existe. */
const uuid = () => {
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};
const methodAllowed = (m: PaymentMethod, delivery: 'DELIVERY' | 'PICKUP') =>
  delivery === 'PICKUP' ? !['CASH_ON_DELIVERY', 'CARD_ON_DELIVERY'].includes(m.kind ?? '') : m.kind !== 'CASH_PICKUP';

export default function PublicStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const preview = slug === PREVIEW_SLUG;
  const [data, setData] = useState<StoreData | null>(null);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [productOptions, setProductOptions] = useState<Record<string, Record<string, string | string[]>>>({});
  const [availableSlots, setAvailableSlots] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<Record<string, boolean>>({});
  const [customer, setCustomer] = useState({ name: '', address: '', city: '' });
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('');
  const [delivery, setDelivery] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ productId: string; quantity: number }[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState<Applied | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptDataUse, setAcceptDataUse] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [keepCart, setKeepCart] = useState(false);
  const [cartId] = useState(uuid);
  const cartSaved = useRef(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [attribution, setAttribution] = useState<Attribution>({});
  const [copied, setCopied] = useState('');
  const [showReturns, setShowReturns] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);

  // Carga de la tienda (o, en el editor, recibe los datos del borrador por mensaje del mismo origen).
  useEffect(() => {
    if (!slug) return;
    if (preview) {
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin || e.data?.type !== 'dream-store-preview') return;
        setData(e.data.payload);
      };
      window.addEventListener('message', onMessage);
      window.parent?.postMessage({ type: 'dream-store-preview-ready' }, window.location.origin);
      return () => window.removeEventListener('message', onMessage);
    }
    const key = `dream.store-attribution.${slug}`;
    try {
      const params = new URLSearchParams(window.location.search);
      const incoming = { source: params.get('utm_source') ?? '', medium: params.get('utm_medium') ?? '', campaign: params.get('utm_campaign') ?? '', content: params.get('utm_content') ?? '' };
      const stored = JSON.parse(sessionStorage.getItem(key) ?? '{}') as Attribution;
      const next = Object.fromEntries(Object.entries(incoming).map(([k, v]) => [k, v || stored[k as keyof Attribution] || ''])) as Attribution;
      if (Object.values(incoming).some(Boolean)) sessionStorage.setItem(key, JSON.stringify(next));
      setAttribution(next);
      const seg = params.get('seguimiento');
      if (seg) setTracking(seg.toUpperCase());
      const cupon = params.get('cupon');
      if (cupon) setCouponInput(cupon.toUpperCase());
    } catch { setAttribution({}); }
    try { setFavorites(JSON.parse(store.get(`dream.fav.${slug}`) ?? '[]')); setLastOrder(JSON.parse(store.get(`dream.last.${slug}`) ?? '[]')); } catch { /* datos locales dañados */ }
    api<StoreData>(`/store/${encodeURIComponent(slug)}`, { timeoutMs: 15000 }).then(setData).catch((e) => setError((e as Error).message));
  }, [slug, preview]);

  const s = useMemo(() => ({ ...SITE_DEFAULTS, ...(data?.settings ?? {}) }), [data]);
  useEffect(() => {
    if (!data) return;
    if (!s.deliveryEnabled && s.pickupEnabled) setDelivery('PICKUP');
    setSort((cur) => cur || s.sortDefault || 'name');
  }, [data, s.deliveryEnabled, s.pickupEnabled, s.sortDefault]);

  const items = data?.products ?? [];
  const categories = [...new Set(items.map((p) => p.categoryName).filter(Boolean))] as string[];
  const visibleItems = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('es');
    const list = items.filter((p) => (!category || p.categoryName === category) && (!onlyFavorites || favorites.includes(p.id))
      && (!q || `${p.name} ${p.description ?? ''} ${p.categoryName ?? ''}`.toLocaleLowerCase('es').includes(q)));
    const by = sort === 'price-asc' ? (a: Item, b: Item) => Number(a.salePrice) - Number(b.salePrice)
      : sort === 'price-desc' ? (a: Item, b: Item) => Number(b.salePrice) - Number(a.salePrice)
        : sort === 'newest' ? (a: Item, b: Item) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
          : (a: Item, b: Item) => a.name.localeCompare(b.name, 'es');
    return [...list].sort(by);
  }, [items, category, onlyFavorites, favorites, search, sort]);
  const selected = useMemo(() => items.filter((p) => cart[p.id] > 0), [items, cart]);
  const cartCount = selected.reduce((sum, p) => sum + cart[p.id], 0);
  const optionExtra = (p: Item) => (p.storeOptions ?? []).reduce((sum, group) => {
    const raw = productOptions[p.id]?.[group.name]; const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return sum + values.reduce((n, value) => n + Number(group.choices?.find((choice) => choice.label === value)?.priceDelta ?? 0), 0);
  }, 0);
  const subtotal = selected.reduce((sum, p) => sum + (Number(p.salePrice) + optionExtra(p)) * cart[p.id], 0);
  const discount = Math.min(applied?.discount ?? 0, subtotal);
  const baseShipping = delivery === 'PICKUP' || (Number(s.freeShippingMinimum) > 0 && subtotal >= Number(s.freeShippingMinimum)) ? 0 : Math.max(0, Number(s.shippingFee) || 0);
  const shippingFee = applied?.freeShipping ? 0 : baseShipping;
  const total = subtotal - discount + shippingFee;
  const depositBase = selected.reduce((sum, p) => sum + (Number(p.salePrice) + optionExtra(p)) * cart[p.id] * ((p.depositPercent ?? 0) > 0 ? Number(p.depositPercent) / 100 : 1), 0);
  const amountNow = depositBase * (subtotal ? (subtotal - discount) / subtotal : 1) + shippingFee;
  const variantFor = (p: Item) => (p.variants ?? []).find((variant) => (p.storeOptions ?? []).filter((g) => g.type === 'select').every((g) => productOptions[p.id]?.[g.name] === variant.options[g.name]));
  const optionsReady = selected.every((p) => (p.storeOptions ?? []).every((g) => {
    const value = productOptions[p.id]?.[g.name];
    return !g.required || Boolean(value) && (!Array.isArray(value) || value.length > 0);
  }));
  const allPayments: PaymentMethod[] = [...(s.paymentMethods ?? []).filter((m: PaymentMethod) => m.enabled).map(inferKind),
    ...(data?.paymentGatewayEnabled ? [{ name: WOMPI, instructions: 'Pago seguro con tarjeta débito/crédito o PSE.', enabled: true, kind: 'PAYMENT_LINK' as const }] : [])];
  const activePayments = allPayments.filter((m) => methodAllowed(m, delivery));
  const selectedMethod = activePayments.find((m) => m.name === payment);
  const whatsappDigits = String(s.whatsapp ?? '').replace(/\D/g, '');

  useEffect(() => { if (activePayments.length && !activePayments.some((m) => m.name === payment)) setPayment(activePayments[0].name); }, [activePayments, payment]);

  // El cupón se vuelve a validar cuando cambia el valor de los productos.
  useEffect(() => {
    if (!applied || preview) return;
    const t = setTimeout(() => {
      if (!subtotal) return;
      api<{ code: string; discount: string; freeShipping: boolean; description?: string }>(`/store/${encodeURIComponent(slug)}/coupon`, { body: { code: applied.code, subtotal: subtotal.toFixed(2) } })
        .then((r) => setApplied({ code: r.code, discount: Number(r.discount), freeShipping: r.freeShipping, description: r.description }))
        .catch((e) => { setApplied(null); setCouponMsg((e as Error).message); });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  // Carrito guardado SOLO si el comprador lo autoriza; si retira la autorización se borra.
  useEffect(() => {
    if (preview || !slug) return;
    const path = `/store/${encodeURIComponent(slug)}/carts/${cartId}`;
    if (!keepCart || placed) {
      if (cartSaved.current && !placed) { cartSaved.current = false; api(path, { method: 'DELETE' }).catch(() => undefined); }
      return;
    }
    if (customer.name.trim().length < 2 || phone.replace(/\D/g, '').length < 7 || !selected.length) return;
    const t = setTimeout(() => {
      api(path, { method: 'PUT', body: { customerName: customer.name, customerPhone: phone, consent: true, items: selected.map((p) => ({ productId: p.id, quantity: cart[p.id] })) } })
        .then(() => { cartSaved.current = true; }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, [keepCart, customer.name, phone, cart, selected, slug, cartId, preview, placed]);

  if (error) return <main className="max-w-xl mx-auto p-6 mt-16"><ErrorBox message="No encontramos esta tienda o aún no está publicada." /></main>;
  if (!data) return <Loading label={preview ? 'Preparando la vista previa…' : 'Cargando tienda…'} />;

  const isServices = data.business.businessModel === 'SERVICES';
  const noun = isServices ? 'servicios' : 'productos';
  const primary = s.primaryColor || '#171717';
  const accent = s.accentColor || '#B69C72';
  const bg = s.backgroundColor || '#FAF8F4';
  const fontFamily = FONTS[s.fontStyle]?.family ?? FONTS.modern.family;
  const cardRadius = s.cardStyle === 'classic' ? 'rounded-lg border' : s.cardStyle === 'outline' ? 'rounded-none border-2' : s.cardStyle === 'flat' ? 'rounded-none border-0' : 'rounded-3xl border';
  const buttonRadius = s.buttonStyle === 'square' ? 0 : s.buttonStyle === 'round' ? 10 : 99;
  const imageRatio = s.imageRatio === 'portrait' ? 'aspect-[3/4]' : s.imageRatio === 'wide' ? 'aspect-[16/9]' : 'aspect-square';
  const center = s.textAlign === 'center';
  const sections: Section[] = (s.sections?.length ? s.sections : SITE_DEFAULTS.sections).filter((x: Section) => x.enabled);
  const has = (t: string) => sections.some((x) => x.type === t);
  const waLink = (text: string) => whatsappDigits ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(text)}` : '';
  const btn = { background: primary, color: onColor(primary), borderRadius: buttonRadius };

  const socialHosts: Record<string, string> = { instagram: 'instagram.com', facebook: 'facebook.com', tiktok: 'tiktok.com', whatsapp: 'wa.me', youtube: 'youtube.com', x: 'x.com' };
  const socialLinks = Object.entries(data.business.socialLinks ?? {}).flatMap(([network, value]) => {
    const host = socialHosts[network.toLowerCase()];
    if (!host || !value?.trim()) return [];
    const raw = value.trim();
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${host}/${raw.replace(/^@/, '').replace(/^\/+/, '')}`;
    try { return new URL(href).protocol === 'https:' ? [{ network, href }] : []; } catch { return []; }
  });

  const add = (id: string, amount: number) => {
    if (amount > 0 && placed) { setPlaced(null); setWhatsappUrl(''); setCheckout(null); setPayUrl(''); }
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + amount) }));
  };
  const toggleFavorite = (id: string) => setFavorites((f) => {
    const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
    if (!preview) store.set(`dream.fav.${slug}`, JSON.stringify(next));
    return next;
  });
  const repeatLast = () => {
    const next: Record<string, number> = { ...cart };
    for (const line of lastOrder) if (items.some((p) => p.id === line.productId && !(p.storeOptions ?? []).length)) next[line.productId] = (next[line.productId] ?? 0) + line.quantity;
    setCart(next); setPlaced(null);
    setTimeout(() => document.getElementById('carrito')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };
  const setOption = (productId: string, name: string, value: string | string[]) => setProductOptions((current) => ({ ...current, [productId]: { ...(current[productId] ?? {}), [name]: value } }));
  const loadSlots = async (productId: string, group: StoreOption, value: string) => {
    setOption(productId, group.name, value); setOption(productId, (items.find((p) => p.id === productId)?.storeOptions ?? []).find((o) => o.type === 'time')?.name ?? '', '');
    if (!value || preview) { setAvailableSlots((current) => ({ ...current, [productId]: [] })); return; }
    setLoadingSlots((current) => ({ ...current, [productId]: true }));
    try { const result = await api<{ slots: string[] }>(`/store/${encodeURIComponent(slug)}/${productId}/slots?date=${encodeURIComponent(value)}`); setAvailableSlots((current) => ({ ...current, [productId]: result.slots })); }
    catch (e) { setAvailableSlots((current) => ({ ...current, [productId]: [] })); setOrderError((e as Error).message); }
    finally { setLoadingSlots((current) => ({ ...current, [productId]: false })); }
  };
  const applyCoupon = async () => {
    setCouponMsg('');
    if (!couponInput.trim() || preview) return;
    try {
      const r = await api<{ code: string; discount: string; freeShipping: boolean; description?: string }>(`/store/${encodeURIComponent(slug)}/coupon`, { body: { code: couponInput.trim(), subtotal: subtotal.toFixed(2) } });
      setApplied({ code: r.code, discount: Number(r.discount), freeShipping: r.freeShipping, description: r.description });
      setCouponMsg(r.freeShipping ? 'Cupón aplicado: envío gratis.' : `Cupón aplicado: ahorras ${money(r.discount)}.`);
    } catch (e) { setApplied(null); setCouponMsg((e as Error).message); }
  };
  const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(text); setTimeout(() => setCopied(''), 1500); }).catch(() => undefined); };

  const order = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview || !selected.length || !payment || savingOrder) return;
    const method = selectedMethod;
    setSavingOrder(true); setOrderError('');
    try {
      const saved = await api<{ id: string; shortId: string; total: string; shippingFee: string; discount: string; paymentDue: string; checkout?: Checkout; items: { productName: string; quantity: number; unitPrice: string; options: Record<string, string | string[]> }[] }>(`/store/${encodeURIComponent(slug)}/orders`, {
        body: { customerName: customer.name, customerPhone: phone, deliveryMethod: delivery,
          ...(delivery === 'DELIVERY' ? { address: customer.address, city: customer.city } : {}),
          paymentMethod: payment, acceptedDataUse: acceptDataUse, marketingOptIn, couponCode: applied?.code, notes: notes.trim() || undefined,
          cartId: keepCart ? cartId : undefined,
          attributionSource: attribution.source || undefined, attributionMedium: attribution.medium || undefined, attributionCampaign: attribution.campaign || undefined, attributionContent: attribution.content || undefined,
          items: selected.map((p) => ({ productId: p.id, variantId: variantFor(p)?.id, quantity: cart[p.id], options: productOptions[p.id] ?? {} })) },
        timeoutMs: 20000,
      });
      const lines = saved.items.map((item) => `• ${item.productName} × ${item.quantity}${Object.entries(item.options).length ? ` (${Object.entries(item.options).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')})` : ''} — ${money(Number(item.unitPrice) * item.quantity)}`).join('\n');
      const message = [`Hola, acabo de hacer el pedido #${saved.shortId} en la página web:`, '', lines, '',
        Number(saved.discount) > 0 ? `Descuento${applied ? ` (${applied.code})` : ''}: -${money(saved.discount)}` : '',
        delivery === 'PICKUP' ? `Recojo en: ${s.pickupAddress || 'el local'}` : `Envío: ${money(saved.shippingFee)}`,
        `Total: ${money(saved.total)}`, `A pagar ahora: ${money(saved.paymentDue)}`, `Medio de pago: ${payment}`,
        `Nombre: ${customer.name}`, `Teléfono: ${phone}`, delivery === 'DELIVERY' ? `Dirección: ${customer.address}, ${customer.city}` : '',
        notes.trim() ? `Notas: ${notes.trim()}` : ''].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
      setPlaced({ shortId: saved.shortId, total: saved.total, shippingFee: saved.shippingFee, discount: saved.discount, paymentDue: saved.paymentDue, method, delivery });
      setCheckout(saved.checkout ?? null);
      setWhatsappUrl(waLink(message));
      setPayUrl(saved.checkout ? '' : safeHref(method?.link) || (/^https:\/\//i.test(method?.instructions ?? '') ? method!.instructions : ''));
      const repeatable = selected.filter((p) => !(p.storeOptions ?? []).length).map((p) => ({ productId: p.id, quantity: cart[p.id] }));
      if (repeatable.length) { store.set(`dream.last.${slug}`, JSON.stringify(repeatable)); setLastOrder(repeatable); }
      cartSaved.current = false;
      setCart({}); setApplied(null); setCouponInput(''); setNotes('');
      setTimeout(() => document.getElementById('confirmacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } catch (e) { setOrderError((e as Error).message); }
    finally { setSavingOrder(false); }
  };
  const openCheckout = () => {
    if (!checkout) return;
    const form = document.createElement('form'); form.method = 'GET'; form.action = checkout.url;
    const values: Record<string, string> = { 'public-key': checkout.publicKey, currency: checkout.currency, 'amount-in-cents': checkout.amountInCents,
      reference: checkout.reference, 'signature:integrity': checkout.signature, 'acceptance-token': checkout.acceptanceToken, 'redirect-url': checkout.redirectUrl };
    Object.entries(values).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input); });
    document.body.appendChild(form); form.submit(); form.remove();
  };

  const PaymentInfo = ({ m }: { m: PaymentMethod }) => {
    const details = paymentDetails(m);
    if (!details.length && !m.instructions && !m.qrImage) return null;
    return <div className="rounded-xl p-3 text-xs space-y-1.5" style={{ background: `${accent}1f` }}>
      {details.map((d) => <div key={d.label} className="flex items-center justify-between gap-2"><span className="opacity-70">{d.label}</span><span className="font-medium text-right flex items-center gap-1.5">{d.value}{d.copy && <button type="button" onClick={() => copy(d.value)} className="opacity-60 hover:opacity-100" aria-label={`Copiar ${d.label}`}>{copied === d.value ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>}</span></div>)}
      {m.instructions && !/^https:\/\//i.test(m.instructions) && <p className="opacity-80 pt-1">{m.instructions}</p>}
      {m.qrImage && <img src={m.qrImage} alt={`Código QR para pagar con ${m.name}`} className="mt-2 h-36 w-36 object-contain rounded-lg bg-white p-1 mx-auto" />}
    </div>;
  };

  const productCard = (p: Item) => {
    const v = variantFor(p);
    const needsOptions = (p.storeOptions ?? []).some((g) => { const val = productOptions[p.id]?.[g.name]; return g.required && (!val || Array.isArray(val) && !val.length); });
    const disabled = needsOptions || (p.storeOptions ?? []).some((g) => g.type === 'select') && (p.variants ?? []).length > 0 && (!v || v.stock < 1) || Boolean(v && cart[p.id] >= v.stock);
    const fav = favorites.includes(p.id);
    const list = s.layout === 'list';
    return <article key={p.id} className={`relative overflow-hidden border-black/10 bg-white ${cardRadius} ${s.layout === 'editorial' ? 'sm:grid sm:grid-cols-2' : ''} ${list ? 'grid grid-cols-[96px_1fr] sm:grid-cols-[140px_1fr]' : ''}`}>
      <button type="button" onClick={() => toggleFavorite(p.id)} aria-label={fav ? `Quitar ${p.name} de favoritos` : `Guardar ${p.name} en favoritos`} aria-pressed={fav}
        className="absolute z-10 top-2 right-2 h-8 w-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center"><Heart className="h-4 w-4" style={{ color: fav ? '#E11D48' : '#555', fill: fav ? '#E11D48' : 'none' }} /></button>
      <div className={`${list ? 'aspect-square h-full' : imageRatio} bg-black/5 overflow-hidden`}>{p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="h-full flex items-center justify-center text-sm opacity-40 p-2 text-center">{p.name}</div>}</div>
      <div className={`p-4 ${center && !list ? 'text-center' : ''}`}><p className="text-[10px] uppercase tracking-wider opacity-50">{p.categoryName}</p><h3 className="font-medium pr-6">{p.name}</h3>{s.showProductDescription !== false && p.description && <p className="text-xs opacity-65 mt-1 line-clamp-3">{p.description}</p>}{p.preparationMinutes ? <p className="text-[11px] opacity-60 mt-2">Preparación aproximada: {p.preparationMinutes} min</p> : null}{(p.depositPercent ?? 0) > 0 && <p className="text-[11px] opacity-60 mt-1">Anticipo para reservar: {p.depositPercent}%</p>}
        {(p.storeOptions ?? []).map((group) => <label key={group.name} className="block text-left mt-3"><span className="text-[11px] opacity-70">{group.name}{group.required ? ' *' : ''}{group.type === 'multi' ? ' · puedes elegir varios' : ''}</span>
          {group.type === 'select' || group.type === 'multi' ? <select multiple={group.type === 'multi'} required={group.required && group.type === 'select'} className="w-full rounded-lg border p-2 mt-1 text-xs min-h-9 bg-white" value={group.type === 'multi' ? (Array.isArray(productOptions[p.id]?.[group.name]) ? productOptions[p.id][group.name] as string[] : []) : String(productOptions[p.id]?.[group.name] ?? '')} onChange={(e) => setOption(p.id, group.name, group.type === 'multi' ? Array.from(e.target.selectedOptions).map((o) => o.value).filter(Boolean) : e.target.value)}><option value="">{group.type === 'multi' ? 'Elige opciones' : `Selecciona ${group.name.toLocaleLowerCase('es')}`}</option>{(group.choices ?? []).map((choice) => <option key={choice.label} value={choice.label}>{choice.label}{Number(choice.priceDelta) > 0 ? ` (+${money(choice.priceDelta)})` : ''}</option>)}</select>
            : group.type === 'date' && p.appointmentSchedule ? <input required={group.required} type="date" min={new Date().toLocaleDateString('en-CA')} className="w-full rounded-lg border p-2 mt-1 text-xs" value={String(productOptions[p.id]?.[group.name] ?? '')} onChange={(e) => loadSlots(p.id, group, e.target.value)} />
              : group.type === 'time' && p.appointmentSchedule ? <select required={group.required} disabled={!productOptions[p.id]?.[(p.storeOptions ?? []).find((o) => o.type === 'date')?.name ?? ''] || loadingSlots[p.id]} className="w-full rounded-lg border p-2 mt-1 text-xs disabled:opacity-50 bg-white" value={String(productOptions[p.id]?.[group.name] ?? '')} onChange={(e) => setOption(p.id, group.name, e.target.value)}><option value="">{loadingSlots[p.id] ? 'Buscando horarios…' : !productOptions[p.id]?.[(p.storeOptions ?? []).find((o) => o.type === 'date')?.name ?? ''] ? 'Elige primero una fecha' : availableSlots[p.id]?.length ? 'Selecciona un horario disponible' : 'No hay horarios disponibles'}</option>{(availableSlots[p.id] ?? []).map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select>
                : <input required={group.required} type={group.type === 'date' || group.type === 'time' ? group.type : 'text'} maxLength={120} className="w-full rounded-lg border p-2 mt-1 text-xs" value={String(productOptions[p.id]?.[group.name] ?? '')} onChange={(e) => setOption(p.id, group.name, e.target.value)} placeholder={group.type === 'text' ? `Indica ${group.name.toLocaleLowerCase('es')}` : undefined} />}
        </label>)}
        {v && <p className="text-[11px] opacity-65 mt-2">Disponibles en esta combinación: {v.stock}</p>}
        <div className={`flex items-center justify-between gap-2 mt-4 ${center && !list ? 'flex-col' : ''}`}><span className="font-semibold">{money(Number(p.salePrice) + optionExtra(p))}</span>
          <button type="button" className="px-4 py-2 text-xs font-medium disabled:opacity-40" disabled={disabled} style={btn} onClick={() => add(p.id, 1)}>{v?.stock === 0 ? 'Agotado' : s.productButtonText || 'Agregar'}{cart[p.id] > 0 ? ` · ${cart[p.id]}` : ''}</button></div>
      </div>
    </article>;
  };
  const gridCols = s.layout === 'editorial' ? 'grid-cols-1 sm:grid-cols-2' : s.layout === 'list' ? 'grid-cols-1 lg:grid-cols-2' : s.layout === 'minimal' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  const shell = (sec: Section, children: React.ReactNode, id?: string) => {
    const tone = sec.background === 'dark' ? { background: primary, color: onColor(primary) } : sec.background === 'accent' ? { background: accent, color: onColor(accent) } : undefined;
    return <section key={sec.id} id={id ?? sec.id} className="scroll-mt-20" style={tone}><div className="max-w-6xl mx-auto px-5 py-12">{children}</div></section>;
  };
  const heading = (sec: Section, fallback: string, kicker?: string) => <div className={`mb-6 ${center ? 'text-center' : ''}`}>{kicker && <p className="text-xs uppercase tracking-widest opacity-55">{kicker}</p>}<h2 className="text-2xl sm:text-3xl font-semibold mt-1">{sec.title || fallback}</h2>{sec.subtitle && <p className="mt-2 opacity-70 max-w-2xl" style={center ? { marginInline: 'auto' } : undefined}>{sec.subtitle}</p>}</div>;

  const heroCopy = <div className={`max-w-3xl py-8 ${center ? 'text-center mx-auto' : ''}`}><p className="text-xs uppercase tracking-[0.25em] opacity-60">{data.business.name}</p><h1 className="text-4xl sm:text-6xl font-semibold mt-3 leading-tight">{s.headline || 'Hecho para ti'}</h1>{s.description && <p className="mt-4 text-base sm:text-lg opacity-75 max-w-2xl" style={center ? { marginInline: 'auto' } : undefined}>{s.description}</p>}
    <div className={`mt-6 flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>{has('catalog') && <a href="#catalogo" className="px-6 py-3 text-sm font-medium" style={btn}>{s.heroButtonText && !(isServices && s.heroButtonText === 'Ver productos') ? s.heroButtonText : `Ver ${noun}`}</a>}{whatsappDigits && <a href={waLink(`Hola ${data.business.name}, quiero más información.`)} target="_blank" rel="noreferrer" className="px-6 py-3 text-sm font-medium border" style={{ borderRadius: buttonRadius, borderColor: 'currentColor' }}>Escríbenos</a>}</div>
    {s.shippingInfo && <p className="mt-5 inline-flex rounded-full px-4 py-2 text-xs" style={{ background: accent, color: onColor(accent) }}>{s.shippingInfo}</p>}</div>;

  const renderSection = (sec: Section) => {
    switch (sec.type) {
      case 'hero':
        return <section key={sec.id} id="inicio" className="max-w-6xl mx-auto px-5 pt-8">
          {s.heroLayout === 'overlay' && s.heroImage ? <div className="relative min-h-72 sm:min-h-[440px] rounded-3xl overflow-hidden"><img src={s.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" /><div className="absolute inset-0 bg-black/45" /><div className="relative min-h-72 sm:min-h-[440px] flex items-center px-6 sm:px-12 text-white">{heroCopy}</div></div>
            : s.heroLayout === 'split' && s.heroImage ? <div className="grid md:grid-cols-2 items-center gap-7"><div className="overflow-hidden rounded-3xl"><img src={s.heroImage} alt="" className="w-full aspect-[4/3] object-cover" /></div>{heroCopy}</div>
              : <>{s.heroImage && s.heroLayout !== 'simple' && <div className="h-56 sm:h-80 rounded-3xl overflow-hidden mb-2"><img src={s.heroImage} alt="" className="w-full h-full object-cover" /></div>}{heroCopy}</>}
        </section>;
      case 'featured': {
        const chosen = (sec.productIds ?? []).map((id) => items.find((p) => p.id === id)).filter(Boolean) as Item[];
        const list = chosen.length ? chosen : items.slice(0, 4);
        if (!list.length) return null;
        return shell(sec, <>{heading(sec, 'Destacados', 'Selección')}<div className={`grid ${gridCols} gap-4 sm:gap-6`}>{list.map(productCard)}</div></>);
      }
      case 'catalog':
        return shell(sec, <>
          <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 ${center ? 'text-center sm:text-left' : ''}`}><div><p className="text-xs uppercase tracking-widest opacity-55">{isServices ? 'Lo que hacemos' : 'Colección'}</p><h2 className="text-3xl font-semibold mt-1">{sec.title || s.catalogTitle || 'Nuestros productos'}</h2></div><span className="text-sm opacity-60">{visibleItems.length} de {items.length} {noun}</span></div>
          {lastOrder.length > 0 && !preview && <button type="button" onClick={repeatLast} className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium bg-white"><RotateCcw className="h-3.5 w-3.5" /> Repetir mi último pedido</button>}
          {(s.showSearch !== false || items.length > 8) && <div className="flex flex-col sm:flex-row gap-2 mb-4"><label className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${noun}…`} className="w-full rounded-full border border-black/15 bg-white pl-9 pr-4 py-2.5 text-sm" aria-label={`Buscar ${noun}`} /></label>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm" aria-label="Ordenar"><option value="name">Nombre</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="newest">Más nuevos</option></select>
            <button type="button" onClick={() => setOnlyFavorites((v) => !v)} aria-pressed={onlyFavorites} className="rounded-full border border-black/15 px-4 py-2.5 text-sm inline-flex items-center gap-2 justify-center" style={onlyFavorites ? { background: primary, color: onColor(primary) } : { background: '#fff' }}><Heart className="h-4 w-4" /> Favoritos {favorites.length ? `(${favorites.length})` : ''}</button></div>}
          {categories.length > 0 && <div className="flex flex-wrap gap-2 mb-5"><button type="button" onClick={() => setCategory('')} className="rounded-full px-4 py-2 text-xs" style={!category ? { background: primary, color: onColor(primary) } : { background: '#ffffffb8' }}>Todos</button>{categories.map((name) => <button type="button" key={name} onClick={() => setCategory(name)} className="rounded-full px-4 py-2 text-xs" style={category === name ? { background: primary, color: onColor(primary) } : { background: '#ffffffb8' }}>{name}</button>)}</div>}
          {visibleItems.length ? <div className={`grid ${gridCols} gap-4 sm:gap-6`}>{visibleItems.map(productCard)}</div> : <div className="rounded-2xl border border-dashed border-black/20 p-10 text-center opacity-70">{items.length ? (onlyFavorites ? 'Aún no guardas favoritos: toca el corazón de un producto.' : 'No encontramos productos con ese filtro.') : 'Pronto encontrarás productos aquí.'}</div>}
        </>, 'catalogo');
      case 'about':
        return shell(sec, <div className={`grid ${sec.image ? 'md:grid-cols-2' : ''} gap-8 items-center`}>{sec.image && <img src={sec.image} alt="" className="w-full aspect-[4/3] object-cover rounded-3xl" />}<div className={center && !sec.image ? 'text-center max-w-3xl mx-auto' : ''}><p className="text-xs uppercase tracking-widest opacity-55">Nuestra historia</p><h2 className="text-2xl sm:text-3xl font-semibold mt-1">{sec.title || 'Quiénes somos'}</h2>{sec.text && <p className="mt-4 opacity-80 whitespace-pre-line leading-relaxed">{sec.text}</p>}{sec.buttonLabel && safeHref(sec.buttonUrl) && <a href={safeHref(sec.buttonUrl)} target={sec.buttonUrl?.startsWith('#') ? undefined : '_blank'} rel="noreferrer" className="inline-flex mt-5 px-5 py-2.5 text-sm font-medium" style={btn}>{sec.buttonLabel}</a>}</div></div>, 'nosotros');
      case 'benefits':
        return shell(sec, <>{heading(sec, 'Beneficios')}<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{(sec.items ?? []).map((it, i) => { const Icon = ICONS[it.icon ?? ''] ?? Check; return <div key={i} className={`p-5 bg-white/80 text-[#171717] ${cardRadius} border-black/10 ${center ? 'text-center' : ''}`}><span className="inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${accent}33`, color: primary }}><Icon className="h-5 w-5" /></span><p className="font-medium mt-3">{it.title}</p>{it.text && <p className="text-sm opacity-70 mt-1">{it.text}</p>}</div>; })}</div></>);
      case 'gallery':
        if (!(sec.items ?? []).some((it) => it.image)) return null;
        return shell(sec, <>{heading(sec, 'Galería')}<div className="grid grid-cols-2 md:grid-cols-3 gap-3">{(sec.items ?? []).filter((it) => it.image).map((it, i) => <figure key={i} className="overflow-hidden rounded-2xl bg-black/5"><img src={it.image} alt={it.title ?? ''} loading="lazy" className="w-full aspect-square object-cover" />{it.title && <figcaption className="text-xs p-2 opacity-70">{it.title}</figcaption>}</figure>)}</div></>);
      case 'testimonials':
        if (!(sec.items ?? []).length) return null;
        return shell(sec, <>{heading(sec, 'Opiniones')}<div className="grid md:grid-cols-3 gap-4">{(sec.items ?? []).map((it, i) => <blockquote key={i} className={`p-5 bg-white text-[#171717] ${cardRadius} border-black/10`}><div className="flex gap-0.5 mb-2" aria-hidden>{[0, 1, 2, 3, 4].map((n) => <Star key={n} className="h-3.5 w-3.5" style={{ color: accent, fill: accent }} />)}</div><p className="text-sm opacity-80">“{it.text}”</p><footer className="mt-3 flex items-center gap-2">{it.image && <img src={it.image} alt="" className="h-8 w-8 rounded-full object-cover" />}<span className="text-xs font-medium">{it.title}</span></footer></blockquote>)}</div></>);
      case 'faq':
        if (!(sec.items ?? []).length) return null;
        return shell(sec, <div className="max-w-3xl mx-auto">{heading(sec, 'Preguntas frecuentes')}<div className="divide-y divide-black/10 border-y border-black/10">{(sec.items ?? []).map((it, i) => <details key={i} className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">{it.title}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>{it.text && <p className="mt-2 text-sm opacity-75 whitespace-pre-line">{it.text}</p>}</details>)}</div></div>, 'preguntas');
      case 'video': {
        const src = youtubeEmbed(sec.videoUrl);
        if (!src) return null;
        return shell(sec, <>{heading(sec, 'Video')}<div className="aspect-video rounded-3xl overflow-hidden bg-black"><iframe src={src} title={sec.title || 'Video'} className="w-full h-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div></>);
      }
      case 'cta': {
        const href = safeHref(sec.buttonUrl) || waLink(`Hola ${data.business.name}, vengo de su página web.`);
        return shell({ ...sec, background: sec.background ?? 'accent' }, <div className="text-center max-w-2xl mx-auto"><h2 className="text-2xl sm:text-3xl font-semibold">{sec.title}</h2>{sec.text && <p className="mt-3 opacity-85">{sec.text}</p>}{sec.buttonLabel && href && <a href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noreferrer" className="inline-flex mt-6 px-6 py-3 text-sm font-semibold bg-white text-[#171717]" style={{ borderRadius: buttonRadius }}>{sec.buttonLabel}</a>}</div>);
      }
      case 'newsletter': {
        const href = waLink(`Hola ${data.business.name}, quiero recibir novedades y promociones por WhatsApp.`);
        if (!href) return null;
        return shell({ ...sec, background: sec.background ?? 'dark' }, <div className="text-center max-w-2xl mx-auto"><MessageCircle className="h-8 w-8 mx-auto opacity-80" /><h2 className="text-2xl font-semibold mt-3">{sec.title}</h2>{sec.text && <p className="mt-3 opacity-80 text-sm">{sec.text}</p>}<a href={href} target="_blank" rel="noreferrer" className="inline-flex mt-6 px-6 py-3 text-sm font-semibold bg-white text-[#171717]" style={{ borderRadius: buttonRadius }}>{sec.buttonLabel || 'Quiero recibir novedades'}</a></div>);
      }
      case 'contact': {
        const address = s.contactAddress || data.business.address || '';
        const phoneTxt = s.contactPhone || data.business.phone || '';
        const email = s.contactEmail || data.business.email || '';
        const mapQuery = [address, data.business.city].filter(Boolean).join(', ');
        return shell(sec, <>{heading(sec, 'Contacto')}<div className={`grid ${mapQuery ? 'md:grid-cols-2' : ''} gap-6`}><div className="space-y-3 text-sm">
          {address && <p className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 opacity-70" /><span>{address}{data.business.city ? `, ${data.business.city}` : ''}{safeHref(s.mapUrl) && <> · <a className="underline" href={safeHref(s.mapUrl)} target="_blank" rel="noreferrer">Cómo llegar</a></>}</span></p>}
          {s.contactHours && <p className="flex gap-3"><Clock className="h-5 w-5 shrink-0 opacity-70" /><span className="whitespace-pre-line">{s.contactHours}</span></p>}
          {phoneTxt && <p className="flex gap-3"><Phone className="h-5 w-5 shrink-0 opacity-70" /><a href={`tel:${phoneTxt.replace(/[^\d+]/g, '')}`} className="underline">{phoneTxt}</a></p>}
          {whatsappDigits && <p className="flex gap-3"><MessageCircle className="h-5 w-5 shrink-0 opacity-70" /><a href={waLink('Hola, vengo de su página web.')} target="_blank" rel="noreferrer" className="underline">Escríbenos por WhatsApp</a></p>}
          {email && <p className="flex gap-3"><Mail className="h-5 w-5 shrink-0 opacity-70" /><a href={`mailto:${email}`} className="underline">{email}</a></p>}
          {socialLinks.length > 0 && s.showSocialLinks !== false && <p className="flex flex-wrap gap-3 pt-2">{socialLinks.map((l) => <a key={l.network} href={l.href} target="_blank" rel="noreferrer" className="capitalize rounded-full border px-3 py-1 text-xs">{l.network}</a>)}</p>}
        </div>{mapQuery && <iframe title="Mapa" className="w-full h-64 rounded-3xl border-0" loading="lazy" referrerPolicy="no-referrer" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`} />}</div></>, 'contacto');
      }
      case 'policies':
        return shell(sec, <div className="max-w-3xl mx-auto">{heading(sec, 'Políticas')}<div className="space-y-2">
          {[['Envíos y entregas', [s.shippingInfo, s.deliveryEnabled ? (Number(s.shippingFee) > 0 ? `Costo de envío: ${money(s.shippingFee)}${Number(s.freeShippingMinimum) > 0 ? `; gratis desde ${money(s.freeShippingMinimum)}` : ''}.` : 'Envío sin costo adicional.') : '', s.pickupEnabled ? `Puedes recoger tu pedido en ${s.pickupAddress || 'nuestro local'}.` : ''].filter(Boolean).join('\n')],
            ['Cambios y devoluciones', [s.returnsPolicy, s.returnsEnabled !== false ? `Puedes solicitar una devolución o un cambio hasta ${s.returnWindowDays ?? 30} días después de recibir tu pedido, con el número de pedido y tu celular.` : ''].filter(Boolean).join('\n')],
            ['Tratamiento de datos personales', s.privacyPolicy || `${data.business.name} usa tus datos (nombre, teléfono y dirección) solo para gestionar y entregar tu pedido. Si autorizas recibir promociones, puedes pedir en cualquier momento que dejemos de escribirte. Puedes consultar, actualizar o eliminar tus datos escribiéndonos.`]]
            .filter(([, text]) => text).map(([title, text]) => <details key={title} className="group rounded-2xl bg-white/80 text-[#171717] px-5 py-4"><summary className="flex cursor-pointer list-none items-center justify-between font-medium">{title}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary><p className="mt-2 text-sm opacity-75 whitespace-pre-line">{text}</p></details>)}
          {s.returnsEnabled !== false && <button type="button" onClick={() => setShowReturns(true)} className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 text-sm font-medium" style={btn}><RotateCcw className="h-4 w-4" /> Solicitar una devolución o cambio</button>}
        </div></div>, 'politicas');
      default: return null;
    }
  };

  const navLinks = [has('catalog') && ['#catalogo', isServices ? 'Servicios' : 'Productos'], has('about') && ['#nosotros', 'Nosotros'], has('faq') && ['#preguntas', 'Preguntas'], has('contact') && ['#contacto', 'Contacto']].filter(Boolean) as [string, string][];
  const cartButton = cartCount > 0 && <button type="button" className="rounded-full px-4 py-2 text-xs font-semibold inline-flex items-center gap-2" style={{ background: primary, color: onColor(primary) }} onClick={() => document.getElementById('carrito')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><ShoppingBag className="h-4 w-4" /> {cartCount} · {money(total)}</button>;
  const logo = <a href="#inicio" className="flex items-center gap-3 min-w-0">{data.business.logoUrl && <img src={data.business.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}<span className="font-semibold tracking-wide truncate">{data.business.name}</span></a>;
  const showPickup = Boolean(s.pickupEnabled);
  const trackLabel = profileFor(data.business.serviceProfile).trackingLabel;
  const trackButton = isServices && <button type="button" onClick={() => setTracking('')} className="text-sm opacity-80 hover:opacity-100 inline-flex items-center gap-1.5"><Search className="h-4 w-4" /><span className="sm:hidden">Seguimiento</span><span className="hidden sm:inline">{trackLabel}</span></button>;
  const showDelivery = s.deliveryEnabled !== false;

  return <main style={{ background: bg, color: s.textColor || primary, fontFamily }} className="min-h-screen pb-20">
    {preview && <div className="sticky top-0 z-30 bg-black text-white text-[11px] text-center py-1.5">Vista previa · así verán tu página tus clientes</div>}
    {s.announcement && <div className="px-4 py-2 text-center text-xs font-medium" style={{ background: accent, color: onColor(accent) }}>{s.announcement}</div>}
    <header className={`border-b border-black/10 ${preview ? '' : 'sticky top-0'} z-20 backdrop-blur`} style={{ background: `${bg}e6` }}>
      {s.headerStyle === 'centered'
        ? <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col items-center gap-3">{logo}<nav className="flex flex-wrap justify-center gap-5 text-sm opacity-80">{navLinks.map(([h, l]) => <a key={h} href={h}>{l}</a>)}{trackButton}</nav>{cartButton}</div>
        : <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-4">{logo}{s.headerStyle !== 'minimal' && <nav className="hidden md:flex gap-5 text-sm opacity-80 ml-6">{navLinks.map(([h, l]) => <a key={h} href={h}>{l}</a>)}</nav>}<span className="ml-auto" />{trackButton}{cartButton || (has('catalog') && !isServices && <a href="#catalogo" className="text-sm opacity-70">Ver productos</a>)}</div>}
    </header>

    {sections.map(renderSection)}

    {selected.length > 0 && <section id="carrito" className="max-w-6xl mx-auto px-5 pb-14 pt-6 scroll-mt-20"><div className="rounded-3xl bg-white text-[#171717] shadow-sm border border-black/10 p-5 sm:p-8 grid lg:grid-cols-[1fr_380px] gap-8">
      <div><p className="text-xs uppercase tracking-widest opacity-55">Tu selección</p><h2 className="text-3xl font-semibold mt-1">Finaliza tu pedido</h2>
        <div className="divide-y divide-black/10 mt-4">{selected.map((p) => <div key={p.id} className="py-3 flex items-center gap-3">{p.imageUrl && <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}<div className="flex-1 min-w-0"><p className="text-sm font-medium">{p.name}</p><p className="text-xs opacity-60">{money(Number(p.salePrice) + optionExtra(p))} c/u</p>{Object.entries(productOptions[p.id] ?? {}).filter(([, v]) => v && (!Array.isArray(v) || v.length)).map(([k, v]) => <p key={k} className="text-[11px] opacity-60">{k}: {Array.isArray(v) ? v.join(', ') : v}</p>)}</div><button type="button" onClick={() => add(p.id, -1)} className="h-8 w-8 rounded-full border" aria-label={`Quitar una unidad de ${p.name}`}>−</button><span className="w-5 text-center text-sm">{cart[p.id]}</span><button type="button" onClick={() => add(p.id, 1)} className="h-8 w-8 rounded-full border" aria-label={`Agregar una unidad de ${p.name}`}>+</button><button type="button" className="opacity-50 ml-1" onClick={() => setCart((c) => ({ ...c, [p.id]: 0 }))} aria-label={`Quitar ${p.name}`}><X className="h-4 w-4" /></button></div>)}</div>
        {(data.couponsEnabled || preview) && <div className="mt-4"><div className="flex gap-2"><input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="¿Tienes un cupón?" className="flex-1 min-w-0 rounded-xl border p-3 text-sm uppercase" aria-label="Código de cupón" /><button type="button" onClick={applyCoupon} className="rounded-xl px-4 text-sm font-medium border">{applied ? 'Cambiar' : 'Aplicar'}</button></div>{couponMsg && <p className={`text-xs mt-2 ${applied ? 'text-emerald-700' : 'text-red-700'}`}>{couponMsg}</p>}</div>}
        <div className="border-t border-black/10 pt-4 mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span>Productos</span><span>{money(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between text-emerald-700"><span>Descuento {applied?.code}</span><span>−{money(discount)}</span></div>}
          <div className="flex justify-between"><span>{delivery === 'PICKUP' ? 'Recoges en el local' : 'Envío'}</span><span>{shippingFee ? money(shippingFee) : 'Gratis'}</span></div>
          {delivery === 'DELIVERY' && !applied?.freeShipping && Number(s.freeShippingMinimum) > 0 && subtotal < Number(s.freeShippingMinimum) && <p className="text-xs opacity-60">Te faltan {money(Number(s.freeShippingMinimum) - subtotal)} para envío gratis.</p>}
          <div className="flex justify-between font-semibold text-base pt-1"><span>Total</span><span>{money(total)}</span></div>
          {Math.round(amountNow) !== Math.round(total) && <div className="flex justify-between font-semibold"><span>A pagar ahora (anticipo)</span><span>{money(amountNow)}</span></div>}
        </div></div>
      <form onSubmit={order} className="space-y-3">
        {showPickup && showDelivery && <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de entrega">{([['DELIVERY', 'Envío a domicilio', Truck], ['PICKUP', 'Recoger en el local', StoreIcon]] as const).map(([k, l, Icon]) => <button key={k} type="button" role="radio" aria-checked={delivery === k} onClick={() => setDelivery(k)} className="rounded-xl border p-3 text-xs font-medium flex flex-col items-center gap-1" style={delivery === k ? { borderColor: primary, boxShadow: `0 0 0 1px ${primary}` } : undefined}><Icon className="h-4 w-4" />{l}</button>)}</div>}
        {delivery === 'PICKUP' && <p className="text-xs rounded-xl bg-black/5 p-3">Recoges en: <b>{s.pickupAddress || 'el local de la tienda'}</b>{s.contactHours ? ` · ${s.contactHours}` : ''}</p>}
        <input className="w-full rounded-xl border p-3 text-sm" required autoComplete="name" placeholder="Tu nombre" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
        <input className="w-full rounded-xl border p-3 text-sm" required type="tel" inputMode="tel" autoComplete="tel" placeholder="Tu celular" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {delivery === 'DELIVERY' && <><input className="w-full rounded-xl border p-3 text-sm" required autoComplete="street-address" placeholder="Dirección de entrega" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /><input className="w-full rounded-xl border p-3 text-sm" required autoComplete="address-level2" placeholder="Ciudad" value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} /></>}
        {s.allowOrderNotes !== false && <textarea className="w-full rounded-xl border p-3 text-sm" rows={2} maxLength={500} placeholder="Notas para la tienda (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />}
        {activePayments.length > 0 ? <fieldset className="space-y-2"><legend className="text-xs opacity-70 mb-1">Medio de pago</legend>{activePayments.map((m) => <label key={m.name} className="flex items-center gap-3 rounded-xl border p-3 text-sm cursor-pointer" style={payment === m.name ? { borderColor: primary, boxShadow: `0 0 0 1px ${primary}` } : undefined}><input type="radio" name="pago" className="accent-black" checked={payment === m.name} onChange={() => setPayment(m.name)} />{m.name}</label>)}{selectedMethod && <PaymentInfo m={selectedMethod} />}{selectedMethod && (selectedMethod.link || selectedMethod.name === WOMPI) && <p className="text-[11px] opacity-60">Al confirmar verás el botón para pagar en línea.</p>}</fieldset>
          : <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl">Esta tienda aún no configuró medios de pago para esta forma de entrega.</p>}
        {orderError && <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-xl p-3">{orderError}</p>}
        <label className="flex items-start gap-2 text-xs opacity-80"><input type="checkbox" required checked={acceptDataUse} onChange={(e) => setAcceptDataUse(e.target.checked)} className="mt-0.5" /><span>Autorizo a {data.business.name} a usar estos datos para gestionar y entregar mi pedido{has('policies') ? <> (<a href="#politicas" className="underline">ver política</a>)</> : ''}.</span></label>
        <label className="flex items-start gap-2 text-xs opacity-80"><input type="checkbox" checked={keepCart} onChange={(e) => setKeepCart(e.target.checked)} className="mt-0.5" /><span>Si no termino ahora, pueden escribirme para recordarme este carrito.</span></label>
        <label className="flex items-start gap-2 text-xs opacity-80"><input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5" /><span>Quiero recibir novedades y promociones por WhatsApp (puedo pedir que dejen de escribirme cuando quiera).</span></label>
        <button className="w-full rounded-xl p-3.5 text-sm font-semibold disabled:opacity-40" disabled={preview || !activePayments.length || savingOrder || !optionsReady} style={{ background: primary, color: onColor(primary) }}>{preview ? 'Confirmar pedido (desactivado en vista previa)' : savingOrder ? 'Guardando pedido…' : !optionsReady ? 'Completa las opciones del producto' : `Confirmar pedido · ${money(total)}`}</button>
      </form>
    </div></section>}

    {placed && <section id="confirmacion" className="max-w-3xl mx-auto px-5 pb-14 pt-6"><div className="rounded-3xl bg-white text-[#171717] shadow-sm border border-black/10 p-6 text-center space-y-3">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></span>
      <p className="font-semibold text-lg">¡Listo! Tu pedido #{placed.shortId} quedó registrado</p>
      <p className="text-sm opacity-70">{placed.delivery === 'PICKUP' ? `Te avisaremos cuando esté listo para recoger en ${s.pickupAddress || 'el local'}.` : 'La tienda confirmará tu pedido y te contará cuándo sale el envío.'}</p>
      <p className="text-xs opacity-60">Guarda el número de tu pedido: lo necesitas para consultas, cambios o devoluciones.</p>
      <p className="text-sm">Total {money(placed.total)}{Number(placed.discount) > 0 ? ` (ahorraste ${money(placed.discount)})` : ''} · <b>a pagar ahora {money(placed.paymentDue)}</b></p>
      {placed.method && (paymentDetails(placed.method).length > 0 || placed.method.qrImage || (placed.method.instructions && !/^https:\/\//i.test(placed.method.instructions))) && <div className="text-left max-w-sm mx-auto"><p className="text-xs opacity-70 mb-1">Paga con {placed.method.name}:</p><PaymentInfo m={placed.method} /></div>}
      <div className="flex flex-wrap justify-center gap-2 pt-2">{checkout && <button type="button" onClick={openCheckout} className="inline-flex rounded-xl px-5 py-3 text-sm font-medium" style={{ background: accent, color: onColor(accent) }}>Pagar con Wompi</button>}{payUrl && <a href={payUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl px-5 py-3 text-sm font-medium" style={{ background: accent, color: onColor(accent) }}>Pagar ahora</a>}{whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl px-5 py-3 text-sm font-medium" style={{ background: primary, color: onColor(primary) }}>Enviar comprobante por WhatsApp</a>}</div>
    </div></section>}

    {cartCount > 0 && <div className="fixed z-20 bottom-3 inset-x-3 sm:hidden"><button type="button" className="w-full rounded-2xl py-4 shadow-lg text-sm font-semibold" style={{ background: primary, color: onColor(primary) }} onClick={() => document.getElementById('carrito')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver carrito · {cartCount} · {money(total)}</button></div>}
    {s.showFloatingWhatsapp !== false && whatsappDigits && !(cartCount > 0) && <a href={waLink(`Hola ${data.business.name}, vengo de su página web.`)} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp" className="fixed z-20 bottom-4 right-4 h-14 w-14 rounded-full shadow-lg flex items-center justify-center bg-[#25D366] text-white"><MessageCircle className="h-7 w-7" /></a>}
    <footer className="border-t border-black/10 mt-6"><div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row gap-4 justify-between text-xs opacity-75">
      <span>© {new Date().getFullYear()} {data.business.name}{data.business.city ? ` · ${data.business.city}` : ''}</span>
      <nav className="flex flex-wrap gap-4">{isServices && <button type="button" onClick={() => setTracking('')} className="hover:underline">{trackLabel}</button>}{!isServices && s.returnsEnabled !== false && <button type="button" onClick={() => setShowReturns(true)} className="hover:underline">Devoluciones</button>}{has('policies') && <a href="#politicas" className="hover:underline">Políticas y datos personales</a>}{s.showSocialLinks !== false && socialLinks.map((link) => <a key={link.network} href={link.href} target="_blank" rel="noreferrer" className="capitalize hover:underline">{link.network}</a>)}</nav>
      <span>Página creada con DREAMS</span>
    </div></footer>
    {tracking !== null && <StoreTracking slug={slug} profile={data.business.serviceProfile} primary={primary} radius={buttonRadius} businessName={data.business.name} initialCode={tracking} preview={preview} onClose={() => setTracking(null)} />}
    {showReturns && <StoreReturns slug={slug} primary={primary} radius={buttonRadius} businessName={data.business.name} preview={preview} onClose={() => setShowReturns(false)} />}
  </main>;
}
