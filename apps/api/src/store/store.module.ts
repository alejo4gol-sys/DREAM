import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { isUniqueViolation } from '../common/db-errors';
import { D, Decimal, m2 } from '../common/money';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Db, InjectDb } from '../db/db';
import { appointments, businesses, categories, customers, incomes, marketingCampaigns, productVariants, products, saleItems, salePayments, sales, storeCarts, storeCoupons, storeOrderItems, storeOrders } from '../db/schema';
import { CryptoService } from '../common/crypto.service';
import { config } from '../config';
import { CollectModule, CollectService } from '../collect/collect.module';

const WOMPI_METHOD = 'Wompi · tarjeta o PSE';
const WOMPI_CURRENCY = 'COP';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const wompiApi = (publicKey: string) => publicKey.startsWith('pub_test_') ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';
class WompiConfigDto {
  @IsString() @Length(8, 120) publicKey: string;
  @IsString() @Length(8, 240) privateKey: string;
  @IsString() @Length(8, 240) integritySecret: string;
  @IsString() @Length(8, 240) eventSecret: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Imágenes: subidas a DREAMS (/uploads/…) o enlaces https. */
const IMAGE = /^(\/uploads\/[\w./-]+|https?:\/\/\S+)$/;
/** Enlaces de botones: https, anclas internas de la página, WhatsApp, teléfono o correo. Nunca javascript:. */
const LINK = /^(https:\/\/\S+|#[a-z0-9-]+|\/tienda\/[a-z0-9-]+\S*|mailto:\S+|tel:\+?[\d\s-]+)$/i;
const OptionalImage = () => (target: object, key: string) => { IsOptional()(target, key); ValidateIf((_, v) => v !== '')(target, key); Matches(IMAGE, { message: 'Usa una imagen subida o un enlace https' })(target, key); };
const OptionalLink = () => (target: object, key: string) => { IsOptional()(target, key); ValidateIf((_, v) => v !== '')(target, key); Matches(LINK, { message: 'El enlace debe empezar por https://, #, tel: o mailto:' })(target, key); };

export const PAYMENT_KINDS = ['NEQUI', 'DAVIPLATA', 'BREB', 'BANK_TRANSFER', 'CASH_ON_DELIVERY', 'CASH_PICKUP', 'CARD_ON_DELIVERY', 'PAYMENT_LINK', 'OTHER'] as const;
class StorePaymentDto {
  @IsString() @Length(2, 60) name: string;
  @IsOptional() @IsString() @MaxLength(240) instructions?: string;
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsIn(PAYMENT_KINDS) kind?: string;
  @IsOptional() @IsString() @MaxLength(120) accountHolder?: string;
  @IsOptional() @IsString() @MaxLength(60) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) bank?: string;
  @IsOptional() @IsString() @MaxLength(30) accountType?: string;
  @IsOptional() @IsString() @MaxLength(30) documentId?: string;
  @OptionalLink() link?: string;
  @OptionalImage() qrImage?: string;
}
export const SECTION_TYPES = ['hero', 'featured', 'catalog', 'about', 'benefits', 'gallery', 'testimonials', 'faq', 'video', 'cta', 'contact', 'policies', 'newsletter'] as const;
class SectionItemDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(600) text?: string;
  @OptionalImage() image?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
}
class StoreSectionDto {
  @IsString() @Matches(/^[a-z0-9-]{1,40}$/) id: string;
  @IsIn(SECTION_TYPES) type: string;
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(3000) text?: string;
  @OptionalImage() image?: string;
  @IsOptional() @IsString() @MaxLength(40) buttonLabel?: string;
  @OptionalLink() buttonUrl?: string;
  @IsOptional() @ValidateIf((_, v) => v !== '') @Matches(/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+$/, { message: 'Usa un enlace de YouTube o Vimeo' }) videoUrl?: string;
  @IsOptional() @IsIn(['light', 'accent', 'dark']) background?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => SectionItemDto) items?: SectionItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsUUID('all', { each: true }) productIds?: string[];
}
class StoreConfigDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Usa letras minúsculas, números y guiones para el enlace' }) @Length(3, 80) slug: string;
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsString() @MaxLength(40) template?: string;
  @IsOptional() @IsString() @MaxLength(100) headline?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @OptionalImage() heroImage?: string;
  @IsOptional() @IsString() @MaxLength(40) heroButtonText?: string;
  @IsOptional() @IsIn(['banner', 'split', 'overlay', 'simple']) heroLayout?: string;
  @IsOptional() @IsIn(['grid', 'editorial', 'minimal', 'list']) layout?: string;
  @IsOptional() @IsIn(['modern', 'serif', 'rounded', 'classic', 'mono', 'display']) fontStyle?: string;
  @IsOptional() @IsIn(['left', 'center']) textAlign?: string;
  @IsOptional() @IsIn(['classic', 'soft', 'outline', 'flat']) cardStyle?: string;
  @IsOptional() @IsIn(['round', 'square', 'pill']) buttonStyle?: string;
  @IsOptional() @IsIn(['square', 'portrait', 'wide']) imageRatio?: string;
  @IsOptional() @IsIn(['classic', 'centered', 'minimal']) headerStyle?: string;
  @IsOptional() @IsIn(['name', 'price-asc', 'price-desc', 'newest']) sortDefault?: string;
  @IsOptional() @IsString() @MaxLength(80) catalogTitle?: string;
  @IsOptional() @IsString() @MaxLength(32) productButtonText?: string;
  @IsOptional() @IsString() @MaxLength(100) announcement?: string;
  @IsOptional() @IsBoolean() showProductDescription?: boolean;
  @IsOptional() @IsBoolean() showSocialLinks?: boolean;
  @IsOptional() @IsBoolean() showSearch?: boolean;
  @IsOptional() @IsBoolean() showFloatingWhatsapp?: boolean;
  @IsOptional() @IsBoolean() showOutOfStock?: boolean;
  @IsOptional() @IsBoolean() allowOrderNotes?: boolean;
  @IsOptional() @IsBoolean() showInDirectory?: boolean;
  @IsOptional() @IsBoolean() showMap?: boolean;
  @IsOptional() @Matches(HEX) primaryColor?: string;
  @IsOptional() @Matches(HEX) backgroundColor?: string;
  @IsOptional() @Matches(HEX) accentColor?: string;
  @IsOptional() @Matches(HEX) textColor?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(70) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(170) seoDescription?: string;
  @OptionalImage() shareImage?: string;
  @IsOptional() @IsString() @MaxLength(255) contactAddress?: string;
  @IsOptional() @IsString() @MaxLength(255) contactHours?: string;
  @IsOptional() @IsString() @MaxLength(120) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @OptionalLink() mapUrl?: string;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  @IsOptional() @IsBoolean() pickupEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(255) pickupAddress?: string;
  @IsOptional() @IsString() @MaxLength(500) shippingInfo?: string;
  @IsOptional() @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) shippingFee?: string;
  @IsOptional() @ValidateIf((_, v) => v !== '') @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) freeShippingMinimum?: string;
  @IsOptional() @IsString() @MaxLength(3000) returnsPolicy?: string;
  @IsOptional() @IsBoolean() returnsEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) returnWindowDays?: number;
  @IsOptional() @IsString() @MaxLength(3000) privacyPolicy?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => StoreSectionDto) sections?: StoreSectionDto[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => StorePaymentDto)
  paymentMethods: StorePaymentDto[];
}
class StoreOrderLineDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() variantId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(99) quantity: number;
  @IsOptional() @IsObject() options?: Record<string, string | string[]>;
}
class CreateStoreOrderDto {
  @IsString() @Length(2, 160) customerName: string;
  @IsString() @Length(7, 40) @Matches(/^\+?[0-9\s()-]+$/) customerPhone: string;
  @IsOptional() @IsIn(['DELIVERY', 'PICKUP']) deliveryMethod?: 'DELIVERY' | 'PICKUP';
  @ValidateIf((o) => o.deliveryMethod !== 'PICKUP') @IsString() @Length(5, 255) address: string;
  @ValidateIf((o) => o.deliveryMethod !== 'PICKUP') @IsString() @Length(2, 120) city: string;
  @IsString() @Length(2, 80) paymentMethod: string;
  @IsBoolean() @Equals(true) acceptedDataUse: boolean;
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
  @IsOptional() @IsString() @MaxLength(40) couponCode?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsUUID() cartId?: string;
  @IsOptional() @IsString() @MaxLength(80) attributionSource?: string;
  @IsOptional() @IsString() @MaxLength(80) attributionMedium?: string;
  @IsOptional() @IsString() @MaxLength(160) attributionCampaign?: string;
  @IsOptional() @IsString() @MaxLength(160) attributionContent?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => StoreOrderLineDto)
  items: StoreOrderLineDto[];
}
class StoreOrderStatusDto {
  @IsIn(['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']) status: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  /** Al entregar: ¿ya se recibió el dinero? Si no, la venta queda como cuenta por cobrar. */
  @IsOptional() @IsBoolean() paid?: boolean;
}
class StoreOrderPaymentDto {
  @IsIn(['PAID', 'PENDING']) paymentStatus: 'PAID' | 'PENDING';
}
const CARRIERS = ['COORDINADORA', 'SERVIENTREGA', 'INTER_RAPIDISIMO', 'ENVIA', 'TCC', 'OTRA'] as const;
class StoreOrderShippingDto {
  @IsIn(CARRIERS) carrier: typeof CARRIERS[number];
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) pickupDate: string;
  @IsString() @Length(2, 40) pickupWindow: string;
  @IsOptional() @IsString() @MaxLength(100) pickupConfirmation?: string;
  @IsOptional() @IsString() @MaxLength(80) trackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) @Matches(/^https:\/\//) trackingUrl?: string;
}
const COUPON_CODE = /^[A-Z0-9_-]{3,40}$/;
class CouponDto {
  @IsString() @Matches(COUPON_CODE, { message: 'El código usa letras, números, guion o guion bajo (3 a 40)' }) code: string;
  @IsOptional() @IsString() @MaxLength(160) description?: string;
  @IsIn(['PERCENT', 'FIXED', 'SHIPPING']) kind: 'PERCENT' | 'FIXED' | 'SHIPPING';
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) value: string;
  @IsOptional() @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) minSubtotal?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) maxUses?: number | null;
  @IsOptional() @IsString() @MaxLength(160) campaign?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @Matches(/^\d{4}-\d{2}-\d{2}$/) startsAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @Matches(/^\d{4}-\d{2}-\d{2}$/) expiresAt?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class ValidateCouponDto {
  @IsString() @MaxLength(40) code: string;
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) subtotal: string;
}
class CartLineDto {
  @IsUUID() productId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(99) quantity: number;
}
class SaveCartDto {
  @IsString() @Length(2, 160) customerName: string;
  @IsString() @Length(7, 40) @Matches(/^\+?[0-9\s()-]+$/) customerPhone: string;
  @IsBoolean() @Equals(true) consent: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CartLineDto) items: CartLineDto[];
}
class CartActionDto {
  @IsIn(['REMINDED', 'DISMISSED']) action: 'REMINDED' | 'DISMISSED';
}
class CampaignDto {
  @IsString() @Length(2, 160) name: string;
  @IsString() @Length(2, 80) source: string;
  @IsString() @Length(2, 160) campaignKey: string;
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) spend: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @Matches(COUPON_CODE) couponCode?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @Matches(/^\d{4}-\d{2}-\d{2}$/) startsOn?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @Matches(/^\d{4}-\d{2}-\d{2}$/) endsOn?: string | null;
}

const STORE_DEFAULTS = {
  headline: '', description: '', heroImage: '', heroLayout: 'banner', fontStyle: 'modern', textAlign: 'left',
  cardStyle: 'soft', buttonStyle: 'pill', imageRatio: 'square', catalogTitle: 'Nuestros productos', productButtonText: 'Agregar',
  announcement: '', showProductDescription: true, showSocialLinks: true, showSearch: true, showFloatingWhatsapp: true,
  allowOrderNotes: true, layout: 'grid', headerStyle: 'classic', sortDefault: 'name', primaryColor: '#171717',
  backgroundColor: '#FAF8F4', accentColor: '#B69C72', whatsapp: '', shippingInfo: '', shippingFee: '0', freeShippingMinimum: '',
  deliveryEnabled: true, pickupEnabled: false, pickupAddress: '', returnsEnabled: true, returnWindowDays: 30,
};

/** Traduce el medio de pago configurado en la tienda al medio de pago contable de la venta. */
function saleMethodFor(name: string, kind?: string): 'CASH' | 'BANK_TRANSFER' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'PSE' | 'NEQUI' | 'DAVIPLATA' | 'OTHER' {
  const k = kind ?? '';
  if (k === 'NEQUI') return 'NEQUI';
  if (k === 'DAVIPLATA') return 'DAVIPLATA';
  if (k === 'BREB' || k === 'BANK_TRANSFER') return 'BANK_TRANSFER';
  if (k === 'CASH_ON_DELIVERY' || k === 'CASH_PICKUP') return 'CASH';
  if (k === 'CARD_ON_DELIVERY') return 'DEBIT_CARD';
  const n = name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('nequi')) return 'NEQUI';
  if (n.includes('daviplata')) return 'DAVIPLATA';
  if (n.includes('pse') || n.includes('wompi')) return 'PSE';
  if (n.includes('transfer') || n.includes('bre-b') || n.includes('breb') || n.includes('consign')) return 'BANK_TRANSFER';
  if (n.includes('efectivo') || n.includes('contra entrega')) return 'CASH';
  if (n.includes('debito')) return 'DEBIT_CARD';
  if (n.includes('credito') || n.includes('tarjeta')) return 'CREDIT_CARD';
  return 'OTHER';
}

@Injectable()
class StoreService {
  constructor(@InjectDb() private db: Db, private inventory: InventoryService, private notifications: NotificationsService, private crypto: CryptoService, private collect: CollectService) {}
  async publicStore(slug: string) {
    const store = await this.db.query.businesses.findFirst({ where: eq(businesses.storeSlug, slug) });
    if (!store?.storeEnabled) throw new NotFoundException('Esta tienda no está disponible');
    return this.storePayload(store);
  }

  /** Vista previa para el editor: mismos datos que la página pública, aunque aún no esté publicada. */
  async preview(businessId: string) {
    const store = await this.db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
    if (!store) throw new NotFoundException();
    return this.storePayload(store);
  }

  private async storePayload(store: typeof businesses.$inferSelect) {
    const items = await this.db.select({ id: products.id, name: products.name, description: products.description, storeOptions: products.storeOptions,
      preparationMinutes: products.preparationMinutes, depositPercent: products.depositPercent, appointmentSchedule: products.appointmentSchedule,
      salePrice: products.salePrice, imageUrl: products.imageUrl, categoryId: products.categoryId, categoryName: categories.name, createdAt: products.createdAt })
      .from(products).leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.businessId, store.id), eq(products.isActive, true))).orderBy(products.name);
    const variants = items.length ? await this.db.select().from(productVariants).where(and(eq(productVariants.businessId, store.id), inArray(productVariants.productId, items.map((p) => p.id)), eq(productVariants.isActive, true))) : [];
    const byProduct = new Map<string, typeof variants>();
    for (const variant of variants) byProduct.set(variant.productId, [...(byProduct.get(variant.productId) ?? []), variant]);
    const [coupon] = await this.db.select({ id: storeCoupons.id }).from(storeCoupons)
      .where(and(eq(storeCoupons.businessId, store.id), eq(storeCoupons.isActive, true))).limit(1);
    return { business: { name: store.tradeName, logoUrl: store.logoUrl, phone: store.phone, email: store.email,
      city: store.city, address: store.address, socialLinks: store.socialLinks, businessModel: store.businessModel, serviceProfile: store.serviceProfile }, settings: { ...STORE_DEFAULTS, ...store.storeConfig },
      couponsEnabled: Boolean(coupon),
      paymentGatewayEnabled: Boolean(store.wompiPublicKey && store.wompiPrivateKeyEnc && store.wompiIntegritySecretEnc && store.wompiEventSecretEnc),
      products: items.map((p) => ({ ...p, variants: byProduct.get(p.id) ?? [] })) };
  }

  async availability(slug: string, productId: string, date: string) {
    const store = await this.db.query.businesses.findFirst({ where: and(eq(businesses.storeSlug, slug), eq(businesses.storeEnabled, true)) });
    const product = store && await this.db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.businessId, store.id), eq(products.isActive, true)) });
    const schedule = product?.appointmentSchedule;
    if (!store || !schedule || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('No hay agenda configurada para ese servicio');
    const day = new Date(`${date}T12:00:00`).getDay();
    if (!schedule.weekdays.includes(day)) return { slots: [] };
    const dateGroup = (product.storeOptions ?? []).find((o) => o.type === 'date');
    const timeGroup = (product.storeOptions ?? []).find((o) => o.type === 'time');
    if (!dateGroup || !timeGroup) return { slots: [] };
    const booked = await this.db.select({ selectedOptions: storeOrderItems.selectedOptions }).from(storeOrderItems)
      .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
      .where(and(eq(storeOrders.businessId, store.id), eq(storeOrderItems.productId, productId), inArray(storeOrders.status, ['RECEIVED', 'CONFIRMED']), sql`${storeOrderItems.selectedOptions}->>${dateGroup.name} = ${date}`));
    const occupied = booked.map((b) => String((b.selectedOptions as any)?.[timeGroup.name] ?? '')).filter(Boolean).map((value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3)));
    const start = Number(schedule.startTime.slice(0, 2)) * 60 + Number(schedule.startTime.slice(3));
    const end = Number(schedule.endTime.slice(0, 2)) * 60 + Number(schedule.endTime.slice(3));
    const slots: string[] = [];
    for (let minute = start; minute + schedule.durationMinutes <= end; minute += schedule.intervalMinutes) {
      const slot = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      if (!occupied.some((used) => minute < used + schedule.durationMinutes && used < minute + schedule.durationMinutes)) slots.push(slot);
    }
    return { slots };
  }
  async settings(businessId: string) {
    const store = await this.db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
    if (!store) throw new NotFoundException();
    return { slug: store.storeSlug ?? '', enabled: store.storeEnabled, config: store.storeConfig ?? {},
      paymentGatewayEnabled: Boolean(store.wompiPublicKey && store.wompiPrivateKeyEnc && store.wompiIntegritySecretEnc && store.wompiEventSecretEnc) };
  }
  async saveWompi(businessId: string, dto: WompiConfigDto) {
    await this.db.update(businesses).set({ wompiPublicKey: dto.publicKey.trim(),
      wompiPrivateKeyEnc: this.crypto.encrypt(dto.privateKey.trim()), wompiIntegritySecretEnc: this.crypto.encrypt(dto.integritySecret.trim()),
      wompiEventSecretEnc: this.crypto.encrypt(dto.eventSecret.trim()) }).where(eq(businesses.id, businessId));
    return { configured: true };
  }
  async save(businessId: string, dto: StoreConfigDto) {
    const { slug, enabled, ...rest } = dto;
    // El DTO ya filtró y validó cada campo (whitelist): se guarda tal cual con valores por defecto.
    const provided = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const storeConfig = JSON.parse(JSON.stringify({ ...STORE_DEFAULTS, ...provided,
      paymentMethods: dto.paymentMethods.map((p) => ({ ...p, instructions: p.instructions ?? '' })) }));
    try {
      const [updated] = await this.db.update(businesses).set({ storeSlug: slug, storeEnabled: enabled, storeConfig })
        .where(eq(businesses.id, businessId)).returning({ slug: businesses.storeSlug, enabled: businesses.storeEnabled, config: businesses.storeConfig });
      return updated;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Ese enlace ya está siendo usado por otra tienda');
      throw e;
    }
  }

  async createOrder(slug: string, dto: CreateStoreOrderDto) {
    const store = await this.db.query.businesses.findFirst({ where: eq(businesses.storeSlug, slug) });
    if (!store?.storeEnabled) throw new NotFoundException('Esta tienda no está disponible');
    const settings = store.storeConfig as { paymentMethods?: { name: string; enabled: boolean; kind?: string }[]; shippingFee?: string; freeShippingMinimum?: string; deliveryEnabled?: boolean; pickupEnabled?: boolean; pickupAddress?: string };
    const deliveryMethod = dto.deliveryMethod ?? 'DELIVERY';
    if (deliveryMethod === 'PICKUP' && !settings.pickupEnabled) throw new BadRequestException('Esta tienda no ofrece recogida en el local');
    if (deliveryMethod === 'DELIVERY' && settings.deliveryEnabled === false) throw new BadRequestException('Esta tienda solo entrega pedidos para recoger en el local');
    if (dto.paymentMethod === WOMPI_METHOD) {
      if (!store.wompiPublicKey || !store.wompiPrivateKeyEnc || !store.wompiIntegritySecretEnc || !store.wompiEventSecretEnc) throw new BadRequestException('El pago en línea todavía no está configurado por esta tienda');
    } else if (!settings.paymentMethods?.some((m) => m.enabled && m.name === dto.paymentMethod)) throw new BadRequestException('Selecciona un medio de pago disponible');
    const quantities = new Map<string, number>();
    for (const item of dto.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    const ids = [...quantities.keys()];
    const catalog = await this.db.select().from(products).where(and(eq(products.businessId, store.id), inArray(products.id, ids), eq(products.isActive, true)));
    if (catalog.length !== ids.length) throw new BadRequestException('Uno de los productos ya no está disponible');
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const variants = await this.db.select().from(productVariants).where(and(eq(productVariants.businessId, store.id), inArray(productVariants.productId, ids), eq(productVariants.isActive, true)));
    const variantsByProduct = new Map<string, typeof variants>();
    for (const variant of variants) variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), variant]);
    const selections = new Map<string, Record<string, string | string[]>>();
    const unitPrices = new Map<string, string>();
    const variantByProduct = new Map<string, (typeof variants)[number]>();
    for (const line of dto.items) {
      if (selections.has(line.productId)) throw new BadRequestException('Envía cada producto una sola vez con sus opciones y cantidad');
      const product = byId.get(line.productId)!;
      const requested = line.options ?? {};
      const groups = product.storeOptions ?? [];
      if (Object.keys(requested).some((key) => !groups.some((g) => g.name === key))) throw new BadRequestException(`Opciones no válidas para ${product.name}`);
      const normalized: Record<string, string | string[]> = {};
      let extra = D('0');
      for (const group of groups) {
        const raw = requested[group.name];
        if (raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
          if (group.required) throw new BadRequestException(`Selecciona ${group.name} para ${product.name}`);
          continue;
        }
        if (group.type === 'select' || group.type === 'multi') {
          const picked = Array.isArray(raw) ? raw : [raw];
          if (group.type === 'select' && picked.length !== 1) throw new BadRequestException(`Elige una opción para ${group.name}`);
          if (group.type === 'multi' && !Array.isArray(raw)) throw new BadRequestException(`Selecciona una o más opciones para ${group.name}`);
          for (const choice of picked) {
            if (typeof choice !== 'string' || !group.choices?.some((candidate) => candidate.label === choice)) throw new BadRequestException(`Opción no válida en ${group.name}`);
            const selected = group.choices.find((candidate) => candidate.label === choice)!;
            if (selected.priceDelta) extra = extra.plus(D(selected.priceDelta));
          }
          normalized[group.name] = group.type === 'multi' ? picked as string[] : picked[0] as string;
        } else {
          if (Array.isArray(raw) || typeof raw !== 'string' || raw.length > 120) throw new BadRequestException(`Valor inválido en ${group.name}`);
          if (group.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException(`Fecha inválida en ${group.name}`);
          if (group.type === 'time' && !/^\d{2}:\d{2}$/.test(raw)) throw new BadRequestException(`Hora inválida en ${group.name}`);
          normalized[group.name] = raw.trim();
        }
      }
      const productVariantsList = variantsByProduct.get(product.id) ?? [];
      if (productVariantsList.length) {
        const variant = productVariantsList.find((v) => v.id === line.variantId);
        if (!variant) throw new BadRequestException(`Selecciona una combinación disponible de ${product.name}`);
        const variantGroups = groups.filter((g) => g.type === 'select');
        if (variantGroups.some((g) => variant.options[g.name] !== normalized[g.name])) throw new BadRequestException(`La combinación seleccionada ya no coincide con ${product.name}`);
        if (variant.stock < line.quantity) throw new BadRequestException(`No quedan suficientes unidades de esa combinación de ${product.name}`);
        variantByProduct.set(product.id, variant);
      } else if (line.variantId) throw new BadRequestException('Esta combinación de producto ya no está disponible');
      if (product.appointmentSchedule) {
        const dateGroup = groups.find((g) => g.type === 'date');
        const timeGroup = groups.find((g) => g.type === 'time');
        if (!dateGroup || !timeGroup) throw new BadRequestException(`La agenda de ${product.name} necesita campos de fecha y hora`);
        const date = String(normalized[dateGroup.name] ?? ''); const time = String(normalized[timeGroup.name] ?? '');
        const scheduledDay = new Date(`${date}T12:00:00`).getDay();
        const start = Number(product.appointmentSchedule.startTime.slice(0, 2)) * 60 + Number(product.appointmentSchedule.startTime.slice(3));
        const end = Number(product.appointmentSchedule.endTime.slice(0, 2)) * 60 + Number(product.appointmentSchedule.endTime.slice(3));
        const selectedMinute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        const now = new Date();
        if (!date || Number.isNaN(scheduledDay) || new Date(`${date}T23:59:59`).getTime() < now.getTime()) throw new BadRequestException('Elige una fecha futura para la cita');
        if (!product.appointmentSchedule.weekdays.includes(scheduledDay) || selectedMinute < start || selectedMinute + product.appointmentSchedule.durationMinutes > end || (selectedMinute - start) % product.appointmentSchedule.intervalMinutes !== 0) {
          throw new BadRequestException('Ese horario no está dentro de la agenda del servicio');
        }
      }
      selections.set(line.productId, normalized);
      unitPrices.set(line.productId, m2(D(product.salePrice).plus(extra)));
    }
    const subtotal = catalog.reduce((sum, p) => sum.plus(D(unitPrices.get(p.id) ?? p.salePrice).mul(quantities.get(p.id)!)), D('0'));
    const configuredShippingFee = Math.max(0, Number(settings.shippingFee ?? 0) || 0);
    const freeMinimum = Math.max(0, Number(settings.freeShippingMinimum ?? 0) || 0);
    const baseShippingFee = deliveryMethod === 'PICKUP' || (freeMinimum > 0 && subtotal.gte(freeMinimum)) ? 0 : configuredShippingFee;
    const depositBase = catalog.reduce((sum, p) => {
      const percent = p.depositPercent > 0 ? p.depositPercent : 100;
      return sum.plus(D(unitPrices.get(p.id) ?? p.salePrice).mul(quantities.get(p.id)!).mul(percent).div(100));
    }, D('0'));
    const paymentMethodConfig = settings.paymentMethods?.find((m) => m.name === dto.paymentMethod);
    const order = await this.db.transaction(async (tx) => {
      // Cupón: se bloquea la fila para que dos pedidos simultáneos no superen el máximo de usos.
      const applied = dto.couponCode?.trim()
        ? await this.resolveCoupon(tx, store.id, dto.couponCode, subtotal, D(baseShippingFee), true)
        : { code: null, discount: D(0), shippingFee: D(baseShippingFee), couponId: null as string | null };
      const shippingFee = applied.shippingFee;
      const total = subtotal.minus(applied.discount).plus(shippingFee);
      const ratio = subtotal.isZero() ? D(1) : subtotal.minus(applied.discount).div(subtotal);
      const paymentDue = depositBase.mul(ratio).plus(shippingFee);
      for (const product of catalog.filter((p) => p.appointmentSchedule)) {
        await tx.select({ id: products.id }).from(products).where(eq(products.id, product.id)).for('update');
        const groups = product.storeOptions ?? [];
        const dateGroup = groups.find((g) => g.type === 'date')!; const timeGroup = groups.find((g) => g.type === 'time')!;
        const date = String(selections.get(product.id)?.[dateGroup.name] ?? ''); const time = String(selections.get(product.id)?.[timeGroup.name] ?? '');
        const booked = await tx.select({ selectedOptions: storeOrderItems.selectedOptions }).from(storeOrderItems)
          .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
          .where(and(eq(storeOrders.businessId, store.id), eq(storeOrderItems.productId, product.id), inArray(storeOrders.status, ['RECEIVED', 'CONFIRMED']),
            sql`${storeOrderItems.selectedOptions}->>${dateGroup.name} = ${date}`));
        const requestedMinute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        const overlap = booked.some((b) => {
          const used = String((b.selectedOptions as any)?.[timeGroup.name] ?? '');
          if (!used) return false;
          const usedMinute = Number(used.slice(0, 2)) * 60 + Number(used.slice(3));
          return requestedMinute < usedMinute + product.appointmentSchedule!.durationMinutes && usedMinute < requestedMinute + product.appointmentSchedule!.durationMinutes;
        });
        if (overlap) throw new ConflictException('Ese horario acaba de ser reservado. Elige otro espacio disponible.');
      }
      const normalizedPhone = dto.customerPhone.replace(/\D/g, '');
      let [customer] = await tx.select().from(customers).where(and(eq(customers.businessId, store.id), sql`regexp_replace(${customers.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`)).limit(1).for('update');
      if (!customer) [customer] = await tx.insert(customers).values({ businessId: store.id, name: dto.customerName.trim(), phone: dto.customerPhone.trim(), city: dto.city?.trim() || store.city, channel: 'WEBSITE' }).returning();
      if (dto.marketingOptIn && !customer.marketingOptIn) {
        await tx.update(customers).set({ marketingOptIn: true, marketingOptInAt: new Date(), marketingOptOutAt: null }).where(eq(customers.id, customer.id));
      }
      if (applied.couponId) await tx.update(storeCoupons).set({ usedCount: sql`${storeCoupons.usedCount} + 1` }).where(eq(storeCoupons.id, applied.couponId));
      const [created] = await tx.insert(storeOrders).values({
        businessId: store.id, customerId: customer.id, customerName: dto.customerName.trim(), customerPhone: dto.customerPhone.trim(),
        address: deliveryMethod === 'PICKUP' ? (settings.pickupAddress?.trim() || 'Recoge en el local') : dto.address.trim(),
        city: deliveryMethod === 'PICKUP' ? (store.city ?? '—') : dto.city.trim(), paymentMethod: dto.paymentMethod,
        deliveryMethod, couponCode: applied.code, discount: m2(applied.discount), notes: dto.notes?.trim() || null,
        marketingOptIn: Boolean(dto.marketingOptIn),
        attributionSource: dto.attributionSource?.trim() || null, attributionMedium: dto.attributionMedium?.trim() || null,
        attributionCampaign: dto.attributionCampaign?.trim() || null, attributionContent: dto.attributionContent?.trim() || null,
        dataUseAcceptedAt: new Date(), total: m2(total), paymentDue: m2(paymentDue),
        shippingFee: m2(shippingFee),
        paymentProvider: dto.paymentMethod === WOMPI_METHOD ? 'WOMPI' : null,
      }).returning();
      for (const [productId, quantity] of quantities) {
        const product = byId.get(productId)!;
        const variant = variantByProduct.get(productId);
        if (variant) {
          const [lockedVariant] = await tx.select().from(productVariants).where(and(eq(productVariants.id, variant.id), eq(productVariants.businessId, store.id))).for('update');
          if (!lockedVariant || lockedVariant.stock < quantity) throw new BadRequestException(`La combinación de ${product.name} acaba de agotarse`);
          const remaining = await this.inventory.move(tx, { businessId: store.id, productId, delta: -quantity, type: 'ORDER_RESERVE',
            referenceType: 'STORE_ORDER', referenceId: created.id, unitCost: null, note: `Reserva por pedido ${created.id.slice(0, 8)}` });
          await this.inventory.checkLowStock(tx, store.id, productId, remaining, -quantity);
          await tx.update(productVariants).set({ stock: lockedVariant.stock - quantity }).where(eq(productVariants.id, lockedVariant.id));
        }
        await tx.insert(storeOrderItems).values({ orderId: created.id, productId, productName: product.name, quantity,
          unitPrice: unitPrices.get(productId) ?? product.salePrice, selectedOptions: selections.get(productId) ?? {},
          preparationMinutes: product.preparationMinutes, depositPercent: product.depositPercent, variantId: variant?.id ?? null });
      }
      // Servicios con agenda: la reserva hecha en la página web aparece en la Agenda del negocio.
      for (const product of catalog.filter((p) => p.appointmentSchedule)) {
        const groups = product.storeOptions ?? [];
        const dateName = groups.find((g) => g.type === 'date')?.name; const timeName = groups.find((g) => g.type === 'time')?.name;
        const date = String(selections.get(product.id)?.[dateName ?? ''] ?? ''); const time = String(selections.get(product.id)?.[timeName ?? ''] ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) continue;
        const startsAt = new Date(`${date}T${time}:00-05:00`);
        const endsAt = new Date(startsAt.getTime() + product.appointmentSchedule!.durationMinutes * 60_000);
        await tx.insert(appointments).values({ businessId: store.id, customerId: customer.id, customerName: dto.customerName.trim(), customerPhone: dto.customerPhone.trim(),
          productId: product.id, storeOrderId: created.id, title: product.name, startsAt, endsAt, status: 'SCHEDULED', source: 'WEB',
          modality: deliveryMethod === 'PICKUP' ? 'IN_PERSON' : 'AT_HOME', location: deliveryMethod === 'PICKUP' ? null : `${dto.address ?? ''}, ${dto.city ?? ''}`.trim(),
          notes: dto.notes?.trim() || null });
      }
      if (dto.cartId) {
        await tx.update(storeCarts).set({ convertedOrderId: created.id })
          .where(and(eq(storeCarts.id, dto.cartId), eq(storeCarts.businessId, store.id)));
      }
      await this.notifications.notify(store.id, 'NEW_STORE_ORDER', 'Nuevo pedido de la tienda',
        `${dto.customerName} · ${m2(total)} COP${deliveryMethod === 'PICKUP' ? ' · recoge en el local' : ''}`, { orderId: created.id }, tx);
      return created;
    });
    let checkout: Record<string, string> | undefined;
    if (dto.paymentMethod === WOMPI_METHOD) {
      const publicKey = store.wompiPublicKey!;
      const apiUrl = wompiApi(publicKey);
      const reference = `DREAM-${order.id}`;
      const amountInCents = D(order.paymentDue).mul(100).toDecimalPlaces(0).toString();
      const integritySecret = this.crypto.decrypt(store.wompiIntegritySecretEnc!);
      const merchantResponse = await fetch(`${apiUrl}/merchants/${encodeURIComponent(publicKey)}`);
      if (!merchantResponse.ok) throw new BadRequestException('No fue posible iniciar el pago. Intenta de nuevo o elige otro medio.');
      const merchant = await merchantResponse.json() as any;
      const acceptanceToken = merchant?.data?.presigned_acceptance?.acceptance_token;
      if (!acceptanceToken) throw new BadRequestException('La pasarela no entregó el token de aceptación requerido.');
      checkout = { url: 'https://checkout.wompi.co/p/', publicKey, reference,
        amountInCents, currency: WOMPI_CURRENCY, acceptanceToken,
        signature: sha256(`${reference}${amountInCents}${WOMPI_CURRENCY}${integritySecret}`),
        redirectUrl: `${config.webOrigin.split(',')[0]}/tienda/${encodeURIComponent(slug)}?pedido=${order.id.slice(0, 8)}` };
    }
    return { id: order.id, shortId: order.id.slice(0, 8), status: order.status, paymentStatus: order.paymentStatus,
      total: order.total, shippingFee: order.shippingFee, discount: order.discount, couponCode: order.couponCode, deliveryMethod: order.deliveryMethod,
      paymentDue: order.paymentDue, createdAt: order.createdAt, checkout, paymentKind: paymentMethodConfig?.kind ?? null,
      items: [...quantities].map(([productId, quantity]) => ({ productName: byId.get(productId)!.name, quantity,
        unitPrice: unitPrices.get(productId) ?? byId.get(productId)!.salePrice, options: selections.get(productId) ?? {} })) };
  }

  async handleWompiEvent(payload: any) {
    if (!payload?.signature?.checksum || !Array.isArray(payload.signature.properties) || !payload.timestamp) {
      throw new BadRequestException('Evento de pago inválido');
    }
    const transaction = payload.data?.transaction;
    // Links de pago creados en «Cobrar» (no son pedidos de la tienda).
    if (transaction?.payment_link_id && !String(transaction.reference ?? '').startsWith('DREAM-')) return this.collect.handleWompiPaymentLink(payload);
    if (!transaction?.reference?.startsWith('DREAM-') || !transaction?.id) throw new BadRequestException('Referencia de pedido inválida');
    const orderId = transaction.reference.slice('DREAM-'.length);
    const [order] = await this.db.select().from(storeOrders).where(eq(storeOrders.id, orderId)).limit(1);
    if (!order || order.paymentProvider !== 'WOMPI') throw new BadRequestException('Pedido de pago no encontrado');
    const [store] = await this.db.select().from(businesses).where(eq(businesses.id, order.businessId)).limit(1);
    if (!store?.wompiEventSecretEnc || !store.wompiPrivateKeyEnc || !store.wompiPublicKey) throw new BadRequestException('La tienda no tiene la pasarela configurada');
    const eventSecret = this.crypto.decrypt(store.wompiEventSecretEnc);
    const valueAt = (obj: any, path: string) => path.split('.').reduce((value, key) => value?.[key], obj);
    const signed = payload.signature.properties.map((path: string) => valueAt(payload.data, path));
    if (signed.some((value: unknown) => value === undefined || value === null)) throw new BadRequestException('Firma incompleta');
    const expected = sha256(`${signed.join('')}${payload.timestamp}${eventSecret}`).toLowerCase();
    const received = String(payload.signature.checksum).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(received) || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) throw new BadRequestException('Firma de evento inválida');
    if (payload.event !== 'transaction.updated') return { received: true };
    const response = await fetch(`${wompiApi(store.wompiPublicKey)}/transactions/${encodeURIComponent(transaction.id)}`, {
      headers: { Authorization: `Bearer ${this.crypto.decrypt(store.wompiPrivateKeyEnc)}` },
    });
    if (!response.ok) throw new BadRequestException('No se pudo verificar el pago con la pasarela');
    const verified = (await response.json() as any)?.data;
    if (verified?.id !== transaction.id || verified?.reference !== transaction.reference) throw new BadRequestException('La transacción no coincide con el pedido');
    if (verified.amount_in_cents !== Number(D(order.paymentDue).mul(100).toDecimalPlaces(0).toString()) || verified.currency !== WOMPI_CURRENCY) {
      throw new BadRequestException('El valor del pago no coincide con el pedido');
    }
    const paymentStatus = verified.status === 'APPROVED' ? 'PAID' : ['DECLINED', 'VOIDED', 'ERROR'].includes(verified.status) ? 'FAILED' : 'PENDING';
    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select().from(storeOrders).where(eq(storeOrders.id, order.id)).for('update');
      if (!locked) return;
      await tx.update(storeOrders).set({ paymentStatus, paymentTransactionId: verified.id, paidAt: paymentStatus === 'PAID' ? new Date() : null })
        .where(and(eq(storeOrders.id, order.id), eq(storeOrders.paymentProvider, 'WOMPI')));
      if (paymentStatus === 'PAID' && locked.customerId && !locked.customerPurchaseCountedAt) {
        await tx.update(customers).set({ purchaseCount: sql`${customers.purchaseCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${locked.total}`,
          firstPurchaseAt: sql`coalesce(${customers.firstPurchaseAt}, now())`, lastPurchaseAt: new Date() }).where(eq(customers.id, locked.customerId));
        await tx.update(storeOrders).set({ customerPurchaseCountedAt: new Date() }).where(eq(storeOrders.id, order.id));
      }
    });
    if (paymentStatus === 'PAID' && order.saleId) await this.settleSale(order.saleId, order.paymentMethod);
    return { received: true };
  }

  // ───────────── Cupones ─────────────
  async resolveCoupon(tx: any, businessId: string, rawCode: string, subtotal: Decimal.Value, shippingFee: Decimal.Value, lock = false) {
    const code = rawCode.trim().toUpperCase();
    const query = tx.select().from(storeCoupons).where(and(eq(storeCoupons.businessId, businessId), eq(storeCoupons.code, code))).limit(1);
    const [coupon] = lock ? await query.for('update') : await query;
    const now = new Date();
    if (!coupon || !coupon.isActive) throw new BadRequestException('Ese cupón no existe o ya no está activo');
    if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException('Ese cupón todavía no está disponible');
    if (coupon.expiresAt && coupon.expiresAt < now) throw new BadRequestException('Ese cupón ya venció');
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) throw new BadRequestException('Ese cupón ya alcanzó el máximo de usos');
    if (D(subtotal).lt(coupon.minSubtotal)) throw new BadRequestException(`Ese cupón aplica para compras desde ${Number(coupon.minSubtotal).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}`);
    let discount = D(0); let shipping = D(shippingFee);
    if (coupon.kind === 'PERCENT') discount = D(subtotal).mul(coupon.value).div(100);
    else if (coupon.kind === 'FIXED') discount = D(coupon.value);
    else shipping = D(0);
    if (discount.gt(subtotal)) discount = D(subtotal);
    return { code: coupon.code, couponId: coupon.id as string | null, discount: D(m2(discount)), shippingFee: shipping, description: coupon.description, kind: coupon.kind };
  }

  async validateCoupon(slug: string, dto: ValidateCouponDto) {
    const store = await this.db.query.businesses.findFirst({ where: and(eq(businesses.storeSlug, slug), eq(businesses.storeEnabled, true)) });
    if (!store) throw new NotFoundException('Esta tienda no está disponible');
    const r = await this.resolveCoupon(this.db, store.id, dto.code, D(dto.subtotal), D(0));
    return { code: r.code, kind: r.kind, discount: m2(r.discount), freeShipping: r.kind === 'SHIPPING', description: r.description };
  }

  listCoupons(businessId: string) {
    return this.db.select().from(storeCoupons).where(eq(storeCoupons.businessId, businessId)).orderBy(desc(storeCoupons.createdAt));
  }

  private couponValues(dto: CouponDto) {
    if (dto.kind === 'PERCENT' && (Number(dto.value) <= 0 || Number(dto.value) > 100)) throw new BadRequestException('El porcentaje debe estar entre 1 y 100');
    if (dto.kind === 'FIXED' && Number(dto.value) <= 0) throw new BadRequestException('El valor del descuento debe ser mayor a cero');
    return { code: dto.code.toUpperCase(), description: dto.description?.trim() || null, kind: dto.kind, value: dto.kind === 'SHIPPING' ? '0' : m2(dto.value),
      minSubtotal: m2(dto.minSubtotal ?? '0'), maxUses: dto.maxUses ?? null, campaign: dto.campaign?.trim() || null,
      startsAt: dto.startsAt ? new Date(`${dto.startsAt}T00:00:00-05:00`) : null,
      expiresAt: dto.expiresAt ? new Date(`${dto.expiresAt}T23:59:59-05:00`) : null, isActive: dto.isActive ?? true };
  }

  async createCoupon(businessId: string, dto: CouponDto) {
    try { const [c] = await this.db.insert(storeCoupons).values({ businessId, ...this.couponValues(dto) }).returning(); return c; }
    catch (e) { if (isUniqueViolation(e)) throw new ConflictException('Ya tienes un cupón con ese código'); throw e; }
  }

  async updateCoupon(businessId: string, id: string, dto: CouponDto) {
    try {
      const [c] = await this.db.update(storeCoupons).set(this.couponValues(dto)).where(and(eq(storeCoupons.id, id), eq(storeCoupons.businessId, businessId))).returning();
      if (!c) throw new NotFoundException('Cupón no encontrado');
      return c;
    } catch (e) { if (isUniqueViolation(e)) throw new ConflictException('Ya tienes un cupón con ese código'); throw e; }
  }

  // ───────────── Carritos sin terminar (solo con autorización del comprador) ─────────────
  async saveCart(slug: string, id: string, dto: SaveCartDto) {
    const store = await this.db.query.businesses.findFirst({ where: and(eq(businesses.storeSlug, slug), eq(businesses.storeEnabled, true)) });
    if (!store) throw new NotFoundException('Esta tienda no está disponible');
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const found = await this.db.select({ id: products.id, name: products.name, salePrice: products.salePrice }).from(products)
      .where(and(eq(products.businessId, store.id), inArray(products.id, ids), eq(products.isActive, true)));
    const byId = new Map(found.map((p) => [p.id, p]));
    const items = dto.items.filter((i) => byId.has(i.productId)).map((i) => ({ productId: i.productId, name: byId.get(i.productId)!.name, quantity: i.quantity, unitPrice: byId.get(i.productId)!.salePrice }));
    if (!items.length) return { saved: false };
    const subtotal = m2(items.reduce((sum, i) => sum.plus(D(i.unitPrice).mul(i.quantity)), D(0)));
    const [existing] = await this.db.select({ businessId: storeCarts.businessId, convertedOrderId: storeCarts.convertedOrderId }).from(storeCarts).where(eq(storeCarts.id, id)).limit(1);
    if (existing && (existing.businessId !== store.id || existing.convertedOrderId)) return { saved: false };
    const values = { customerName: dto.customerName.trim(), customerPhone: dto.customerPhone.trim(), items, subtotal, consentAt: new Date(), dismissedAt: null };
    await this.db.insert(storeCarts).values({ id, businessId: store.id, ...values })
      .onConflictDoUpdate({ target: storeCarts.id, set: { ...values, updatedAt: new Date() } });
    return { saved: true };
  }

  /** El comprador retiró su autorización o vació el carrito: se borra su información. */
  async deleteCart(slug: string, id: string) {
    const store = await this.db.query.businesses.findFirst({ where: eq(businesses.storeSlug, slug), columns: { id: true } });
    if (store) await this.db.delete(storeCarts).where(and(eq(storeCarts.id, id), eq(storeCarts.businessId, store.id), sql`${storeCarts.convertedOrderId} is null`));
    return { ok: true };
  }

  async abandonedCarts(businessId: string) {
    const rows = await this.db.select().from(storeCarts).where(and(eq(storeCarts.businessId, businessId),
      sql`${storeCarts.convertedOrderId} is null`, sql`${storeCarts.dismissedAt} is null`,
      sql`${storeCarts.updatedAt} < now() - interval '30 minutes'`, sql`${storeCarts.updatedAt} > now() - interval '30 days'`))
      .orderBy(desc(storeCarts.updatedAt)).limit(100);
    // Carritos de clientes que después sí compraron (con otro carrito) no se muestran.
    if (!rows.length) return [];
    const phones = [...new Set(rows.map((r) => r.customerPhone.replace(/\D/g, '')))];
    const later = await this.db.select({ phone: storeOrders.customerPhone, createdAt: storeOrders.createdAt }).from(storeOrders)
      .where(and(eq(storeOrders.businessId, businessId), sql`regexp_replace(${storeOrders.customerPhone}, '[^0-9]', '', 'g') in (${sql.join(phones.map((p) => sql`${p}`), sql`, `)})`));
    return rows.filter((r) => !later.some((o) => o.phone.replace(/\D/g, '') === r.customerPhone.replace(/\D/g, '') && o.createdAt > r.updatedAt));
  }

  async cartAction(businessId: string, id: string, action: 'REMINDED' | 'DISMISSED') {
    const [c] = await this.db.update(storeCarts).set(action === 'REMINDED' ? { remindedAt: new Date() } : { dismissedAt: new Date() })
      .where(and(eq(storeCarts.id, id), eq(storeCarts.businessId, businessId))).returning();
    if (!c) throw new NotFoundException('Carrito no encontrado');
    return c;
  }

  // ───────────── Campañas: inversión vs. ventas atribuidas ─────────────
  listCampaigns(businessId: string) {
    return this.db.select().from(marketingCampaigns).where(eq(marketingCampaigns.businessId, businessId)).orderBy(desc(marketingCampaigns.createdAt));
  }
  private campaignValues(dto: CampaignDto) {
    return { name: dto.name.trim(), source: dto.source.trim().toLowerCase(), campaignKey: dto.campaignKey.trim(), spend: m2(dto.spend),
      couponCode: dto.couponCode ? dto.couponCode.toUpperCase() : null, startsOn: dto.startsOn || null, endsOn: dto.endsOn || null };
  }
  async createCampaign(businessId: string, dto: CampaignDto) {
    try { const [c] = await this.db.insert(marketingCampaigns).values({ businessId, ...this.campaignValues(dto) }).returning(); return c; }
    catch (e) { if (isUniqueViolation(e)) throw new ConflictException('Ya registraste una campaña con ese identificador'); throw e; }
  }
  async updateCampaign(businessId: string, id: string, dto: CampaignDto) {
    try {
      const [c] = await this.db.update(marketingCampaigns).set(this.campaignValues(dto)).where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.businessId, businessId))).returning();
      if (!c) throw new NotFoundException('Campaña no encontrada');
      return c;
    } catch (e) { if (isUniqueViolation(e)) throw new ConflictException('Ya registraste una campaña con ese identificador'); throw e; }
  }
  async deleteCampaign(businessId: string, id: string) {
    await this.db.delete(marketingCampaigns).where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.businessId, businessId)));
    return { ok: true };
  }

  /** Pedidos web agrupados por campaña (enlace con utm_campaign) o por cupón de la campaña. */
  async campaignResults(businessId: string) {
    const campaigns = await this.listCampaigns(businessId);
    const orders = await this.db.select({ id: storeOrders.id, total: storeOrders.total, status: storeOrders.status, source: storeOrders.attributionSource,
      campaign: storeOrders.attributionCampaign, coupon: storeOrders.couponCode, createdAt: storeOrders.createdAt })
      .from(storeOrders).where(and(eq(storeOrders.businessId, businessId), sql`${storeOrders.status} <> 'CANCELLED'`,
        sql`(${storeOrders.attributionCampaign} is not null or ${storeOrders.couponCode} is not null)`));
    const inRange = (c: typeof campaigns[number], d: Date) => {
      const day = d.toISOString().slice(0, 10);
      return (!c.startsOn || day >= c.startsOn) && (!c.endsOn || day <= c.endsOn);
    };
    const used = new Set<string>();
    const results = campaigns.map((c) => {
      const matched = orders.filter((o) => inRange(c, o.createdAt) && (o.campaign === c.campaignKey || (c.couponCode && o.coupon === c.couponCode)));
      matched.forEach((o) => used.add(o.id));
      const revenue = matched.reduce((sum, o) => sum.plus(o.total), D(0));
      return { ...c, orders: matched.length, revenue: m2(revenue),
        roas: D(c.spend).gt(0) ? Number(revenue.div(c.spend).toDecimalPlaces(2)) : null,
        costPerOrder: matched.length ? m2(D(c.spend).div(matched.length)) : null };
    });
    // Campañas que llegaron con enlace rastreable pero aún no tienen inversión registrada.
    const untracked = new Map<string, { campaignKey: string; source: string | null; orders: number; revenue: string }>();
    for (const o of orders.filter((x) => !used.has(x.id) && x.campaign)) {
      const k = o.campaign!; const prev = untracked.get(k);
      untracked.set(k, { campaignKey: k, source: o.source, orders: (prev?.orders ?? 0) + 1, revenue: m2(D(prev?.revenue ?? 0).plus(o.total)) });
    }
    return { campaigns: results, unregistered: [...untracked.values()] };
  }

  // ───────────── Pago manual de pedidos ─────────────
  async updateOrderPayment(businessId: string, id: string, paymentStatus: 'PAID' | 'PENDING') {
    const [order] = await this.db.select().from(storeOrders).where(and(eq(storeOrders.id, id), eq(storeOrders.businessId, businessId))).limit(1);
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.paymentProvider === 'WOMPI') throw new BadRequestException('El estado de los pagos con Wompi lo confirma la pasarela automáticamente');
    if (order.status === 'CANCELLED') throw new BadRequestException('El pedido está cancelado');
    const [updated] = await this.db.update(storeOrders).set({ paymentStatus, paidAt: paymentStatus === 'PAID' ? new Date() : null }).where(eq(storeOrders.id, id)).returning();
    if (order.saleId && paymentStatus === 'PAID') await this.settleSale(order.saleId, order.paymentMethod);
    return updated;
  }

  /** Si el pedido ya generó su venta con saldo pendiente, registra el abono que la deja pagada. */
  private async settleSale(saleId: string, methodName: string) {
    await this.db.transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, saleId)).for('update');
      if (!sale || sale.status === 'CANCELLED' || sale.status === 'PAID') return;
      const due = D(sale.total).minus(sale.amountPaid);
      if (due.lte(0)) return;
      await tx.insert(salePayments).values({ saleId, amount: m2(due), method: saleMethodFor(methodName), reference: 'Pedido web' });
      await tx.update(sales).set({ amountPaid: sale.total, status: 'PAID' }).where(eq(sales.id, saleId));
    });
  }

  /** Cierra el ciclo: un pedido entregado se convierte en venta (sin volver a descontar inventario, ya estaba reservado). */
  private async createSaleFromOrder(tx: any, order: typeof storeOrders.$inferSelect, items: (typeof storeOrderItems.$inferSelect)[], userId: string, paid: boolean) {
    const productRows = await tx.select({ id: products.id, costPrice: products.costPrice }).from(products).where(inArray(products.id, items.map((i) => i.productId)));
    const cost = new Map<string, string>(productRows.map((p: any) => [p.id, p.costPrice]));
    const subtotal = items.reduce((sum, i) => sum.plus(D(i.unitPrice).mul(i.quantity)), D(0));
    const discount = D(order.discount ?? 0);
    const net = subtotal.minus(discount);
    let allocated = D(0);
    const lines = items.map((i, idx) => {
      const gross = D(i.unitPrice).mul(i.quantity);
      const share = idx === items.length - 1 ? discount.minus(allocated) : subtotal.isZero() ? D(0) : discount.mul(gross).div(subtotal).toDecimalPlaces(2);
      allocated = allocated.plus(share);
      return { item: i, gross, discount: share, total: gross.minus(share), unitCost: cost.get(i.productId) ?? '0' };
    });
    const costTotal = lines.reduce((sum, l) => sum.plus(D(l.unitCost).mul(l.item.quantity)), D(0));
    const isPaid = paid || order.paymentStatus === 'PAID';
    const method = saleMethodFor(order.paymentMethod);
    const [{ number }] = await tx.update(businesses).set({ nextSaleNumber: sql`${businesses.nextSaleNumber} + 1` })
      .where(eq(businesses.id, order.businessId)).returning({ number: sql<number>`${businesses.nextSaleNumber} - 1` });
    const [sale] = await tx.insert(sales).values({
      businessId: order.businessId, number, customerId: order.customerId, date: new Date(), channel: 'WEBSITE', paymentMethod: method,
      status: isPaid ? 'PAID' : 'PENDING', subtotal: m2(subtotal), discountTotal: m2(discount), taxTotal: '0.00', total: m2(net),
      amountPaid: isPaid ? m2(net) : '0.00', costTotal: m2(costTotal), createdById: userId,
      notes: `Pedido web #${order.id.slice(0, 8)}${order.couponCode ? ` · cupón ${order.couponCode}` : ''}${order.attributionCampaign ? ` · campaña ${order.attributionCampaign}` : ''}`,
    }).returning();
    for (const l of lines) {
      const options = Object.entries(l.item.selectedOptions ?? {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
      await tx.insert(saleItems).values({ saleId: sale.id, productId: l.item.productId, description: `${l.item.productName}${options ? ` (${options})` : ''}`.slice(0, 200),
        quantity: l.item.quantity, unitPrice: m2(l.item.unitPrice), unitCost: m2(l.unitCost), discount: m2(l.discount), taxRate: '0', lineTax: '0.00', lineTotal: m2(l.total) });
    }
    if (isPaid && net.gt(0)) await tx.insert(salePayments).values({ saleId: sale.id, amount: m2(net), method, reference: 'Pedido web' });
    if (D(order.shippingFee).gt(0)) {
      await tx.insert(incomes).values({ businessId: order.businessId, category: 'Envíos', description: `Envío del pedido web #${order.id.slice(0, 8)}`,
        amount: m2(order.shippingFee), date: new Date(), paymentMethod: method });
    }
    if (!isPaid) {
      await this.notifications.notify(order.businessId, 'PENDING_ACCOUNT', `Venta #${number} con saldo pendiente`, `Pedido web entregado sin pago registrado: ${m2(net)}`, { saleId: sale.id }, tx);
    }
    return sale;
  }

  async listOrders(businessId: string) {
    const orders = await this.db.select().from(storeOrders).where(eq(storeOrders.businessId, businessId))
      .orderBy(desc(storeOrders.createdAt)).limit(200);
    if (!orders.length) return [];
    const items = await this.db.select().from(storeOrderItems).where(inArray(storeOrderItems.orderId, orders.map((o) => o.id)));
    const byOrder = new Map<string, typeof items>();
    for (const item of items) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item]);
    return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
  }

  async updateOrderShipping(businessId: string, id: string, dto: StoreOrderShippingDto) {
    const [order] = await this.db.select().from(storeOrders).where(and(eq(storeOrders.id, id), eq(storeOrders.businessId, businessId))).limit(1);
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (!['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(order.status)) throw new BadRequestException('Confirma el pedido antes de gestionar su envío');
    const [updated] = await this.db.update(storeOrders).set({ shippingCarrier: dto.carrier, pickupDate: dto.pickupDate,
      pickupWindow: dto.pickupWindow.trim(), pickupConfirmation: dto.pickupConfirmation?.trim() || null,
      trackingNumber: dto.trackingNumber?.trim() || null, trackingUrl: dto.trackingUrl?.trim() || null }).where(eq(storeOrders.id, id)).returning();
    return updated;
  }

  async updateOrder(businessId: string, userId: string, id: string, next: StoreOrderStatusDto['status'], paid = true) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx.select().from(storeOrders).where(and(eq(storeOrders.id, id), eq(storeOrders.businessId, businessId))).for('update');
      if (!order) throw new NotFoundException('Pedido no encontrado');
      const items = await tx.select().from(storeOrderItems).where(eq(storeOrderItems.orderId, id));
      const valid = order.status === 'RECEIVED' ? ['CONFIRMED', 'CANCELLED']
        : order.status === 'CONFIRMED' ? ['SHIPPED', 'CANCELLED']
          : order.status === 'SHIPPED' ? ['DELIVERED'] : [];
      if (!valid.includes(next)) throw new BadRequestException(`No se puede pasar un pedido de ${order.status} a ${next}`);
      if (next === 'CANCELLED' && order.paymentStatus === 'PAID') throw new BadRequestException('Este pedido ya está pagado. Gestiona primero la devolución en Wompi.');
      if (next === 'CONFIRMED') {
        for (const item of items) {
          if (item.variantId) continue; // El inventario de variantes quedó reservado al crear el pedido.
          const quantity = await this.inventory.move(tx, { businessId, productId: item.productId, delta: -item.quantity,
            type: 'ORDER_RESERVE', unitCost: null, referenceType: 'STORE_ORDER', referenceId: id, userId,
            note: `Reserva por pedido ${id.slice(0, 8)}` });
          await this.inventory.checkLowStock(tx, businessId, item.productId, quantity, -item.quantity);
        }
      }
      if (next === 'CANCELLED') {
        for (const item of items) {
          if (item.variantId) {
            const [variant] = await tx.select().from(productVariants).where(and(eq(productVariants.id, item.variantId), eq(productVariants.businessId, businessId))).for('update');
            if (variant) await tx.update(productVariants).set({ stock: variant.stock + item.quantity }).where(eq(productVariants.id, variant.id));
            await this.inventory.move(tx, { businessId, productId: item.productId, delta: item.quantity, type: 'ORDER_RELEASE',
              referenceType: 'STORE_ORDER', referenceId: id, userId, note: `Liberación de variante por cancelación de pedido ${id.slice(0, 8)}` });
          } else if (order.status === 'CONFIRMED') {
            await this.inventory.move(tx, { businessId, productId: item.productId, delta: item.quantity, type: 'ORDER_RELEASE',
              referenceType: 'STORE_ORDER', referenceId: id, userId, note: `Liberación por cancelación de pedido ${id.slice(0, 8)}` });
          }
        }
      }
      const dates = next === 'CONFIRMED' ? { confirmedAt: new Date() }
        : next === 'SHIPPED' ? { shippedAt: new Date() }
          : next === 'DELIVERED' ? { deliveredAt: new Date() }
            : { cancelledAt: new Date() };
      let saleId: string | undefined;
      if (next === 'DELIVERED' && !order.saleId) saleId = (await this.createSaleFromOrder(tx, order, items, userId, paid)).id;
      if (next === 'CANCELLED' && order.couponCode) {
        await tx.update(storeCoupons).set({ usedCount: sql`greatest(${storeCoupons.usedCount} - 1, 0)` })
          .where(and(eq(storeCoupons.businessId, businessId), eq(storeCoupons.code, order.couponCode)));
      }
      const paymentUpdate = next === 'DELIVERED' && paid && order.paymentStatus !== 'PAID' && order.paymentProvider !== 'WOMPI' ? { paymentStatus: 'PAID', paidAt: new Date() } : {};
      const [updated] = await tx.update(storeOrders).set({ status: next, ...dates, ...paymentUpdate, ...(saleId ? { saleId } : {}) }).where(eq(storeOrders.id, id)).returning();
      if (next === 'CONFIRMED' && order.customerId && !order.customerPurchaseCountedAt) {
        await tx.update(customers).set({ purchaseCount: sql`${customers.purchaseCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${order.total}`,
          firstPurchaseAt: sql`coalesce(${customers.firstPurchaseAt}, now())`, lastPurchaseAt: new Date() }).where(eq(customers.id, order.customerId));
        await tx.update(storeOrders).set({ customerPurchaseCountedAt: new Date() }).where(eq(storeOrders.id, id));
      }
      return { ...updated, items };
    });
  }
}

@Controller('store')
class StoreController {
  constructor(private service: StoreService) {}
  @RequirePermissions('business:manage') @Get('current') settings(@Ctx() ctx: RequestContext) { return this.service.settings(ctx.businessId); }
  @RequirePermissions('business:manage') @Get('current/preview') preview(@Ctx() ctx: RequestContext) { return this.service.preview(ctx.businessId); }
  @RequirePermissions('business:manage') @Patch('current') save(@Ctx() ctx: RequestContext, @Body() dto: StoreConfigDto) { return this.service.save(ctx.businessId, dto); }
  @RequirePermissions('business:manage') @Patch('current/wompi') saveWompi(@Ctx() ctx: RequestContext, @Body() dto: WompiConfigDto) { return this.service.saveWompi(ctx.businessId, dto); }
  @RequirePermissions('sales:read') @Get('orders') orders(@Ctx() ctx: RequestContext) { return this.service.listOrders(ctx.businessId); }
  @RequirePermissions('sales:create') @Patch('orders/:id/shipping') shipping(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StoreOrderShippingDto) {
    return this.service.updateOrderShipping(ctx.businessId, id, dto);
  }
  @RequirePermissions('sales:create') @Patch('orders/:id/status') updateOrder(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StoreOrderStatusDto) {
    return this.service.updateOrder(ctx.businessId, ctx.userId, id, dto.status, dto.paid ?? true);
  }
  @RequirePermissions('sales:create') @Patch('orders/:id/payment') payment(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StoreOrderPaymentDto) {
    return this.service.updateOrderPayment(ctx.businessId, id, dto.paymentStatus);
  }
  @RequirePermissions('business:manage') @Get('coupons') coupons(@Ctx() ctx: RequestContext) { return this.service.listCoupons(ctx.businessId); }
  @RequirePermissions('business:manage') @Post('coupons') createCoupon(@Ctx() ctx: RequestContext, @Body() dto: CouponDto) { return this.service.createCoupon(ctx.businessId, dto); }
  @RequirePermissions('business:manage') @Patch('coupons/:id') updateCoupon(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CouponDto) {
    return this.service.updateCoupon(ctx.businessId, id, dto);
  }
  @RequirePermissions('sales:read') @Get('carts') carts(@Ctx() ctx: RequestContext) { return this.service.abandonedCarts(ctx.businessId); }
  @RequirePermissions('sales:create') @Patch('carts/:id') cartAction(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CartActionDto) {
    return this.service.cartAction(ctx.businessId, id, dto.action);
  }
  @RequirePermissions('business:manage') @Get('campaigns') campaigns(@Ctx() ctx: RequestContext) { return this.service.campaignResults(ctx.businessId); }
  @RequirePermissions('business:manage') @Post('campaigns') createCampaign(@Ctx() ctx: RequestContext, @Body() dto: CampaignDto) { return this.service.createCampaign(ctx.businessId, dto); }
  @RequirePermissions('business:manage') @Patch('campaigns/:id') updateCampaign(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CampaignDto) {
    return this.service.updateCampaign(ctx.businessId, id, dto);
  }
  @RequirePermissions('business:manage') @Delete('campaigns/:id') deleteCampaign(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCampaign(ctx.businessId, id);
  }
  @Public() @Post(':slug/coupon') @HttpCode(200) @Throttle({ default: { limit: 15, ttl: 60_000 } })
  validateCoupon(@Param('slug') slug: string, @Body() dto: ValidateCouponDto) { return this.service.validateCoupon(slug, dto); }
  @Public() @Put(':slug/carts/:id') @Throttle({ default: { limit: 20, ttl: 60_000 } })
  saveCart(@Param('slug') slug: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveCartDto) { return this.service.saveCart(slug, id, dto); }
  @Public() @Delete(':slug/carts/:id') @Throttle({ default: { limit: 20, ttl: 60_000 } })
  deleteCart(@Param('slug') slug: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.deleteCart(slug, id); }
  @Public() @Post(':slug/orders') @Throttle({ default: { limit: 10, ttl: 60_000 } }) createOrder(@Param('slug') slug: string, @Body() dto: CreateStoreOrderDto) { return this.service.createOrder(slug, dto); }
  @Public() @Post('wompi/webhook') wompiWebhook(@Body() body: any) { return this.service.handleWompiEvent(body); }
  @Public() @Get(':slug/:productId/slots') slots(@Param('slug') slug: string, @Param('productId', ParseUUIDPipe) productId: string, @Query('date') date: string) {
    return this.service.availability(slug, productId, date);
  }
  @Public() @Get(':slug') publicStore(@Param('slug') slug: string) { return this.service.publicStore(slug); }
}

@Module({ imports: [InventoryModule, CollectModule], controllers: [StoreController], providers: [StoreService] })
export class StoreModule {}
