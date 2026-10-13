/**
 * DREAMS — modelo de datos (Drizzle ORM · PostgreSQL)
 * - Multi-tenant: toda tabla de negocio lleva businessId.
 * - Dinero: numeric(14,2) (se maneja como string + decimal.js; nunca float).
 * - Columnas en snake_case en la BD (casing: 'snake_case').
 */
import {
  pgTable, pgEnum, uuid, text, varchar, boolean, integer, numeric, timestamp, jsonb,
  primaryKey, uniqueIndex, index, customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const money = () => numeric({ precision: 14, scale: 2 });
const ts = () => timestamp({ withTimezone: true, mode: 'date' });
const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => ts().notNull().defaultNow();

export type StorePaymentMethod = {
  name: string; instructions: string; enabled: boolean;
  kind?: string; accountHolder?: string; accountNumber?: string; bank?: string; accountType?: string;
  documentId?: string; link?: string; qrImage?: string;
};
export interface InvoiceTemplate {
  accentColor?: string; showLogo?: boolean; logoUrl?: string | null; title?: string; headerNote?: string; footerNote?: string; terms?: string;
  warrantyText?: string; bankInfo?: string; showSku?: boolean; showReceivedBlock?: boolean;
}
export interface InvoiceSettings {
  personType?: 'NATURAL' | 'JURIDICA'; regime?: 'RESPONSABLE_IVA' | 'NO_RESPONSABLE' | 'SIMPLE'; responsibilities?: string[]; ciiu?: string;
  defaultDocType?: 'ELECTRONIC' | 'CONTINGENCY' | 'INTERNAL'; internalPrefix?: string; defaultWarrantyMonths?: number; defaultDueDays?: number;
  einvoiceMode?: 'OFF' | 'MANUAL' | 'SANDBOX' | 'PROVIDER'; providerName?: string; template?: InvoiceTemplate;
}
export interface FeeSettings { smmlv?: string; ivaResponsable?: boolean; ivaRate?: number; advancePct?: number; installments?: number; city?: string; level?: string; hourlyRate?: string; tableKey?: string }
export type StoreSiteConfig = Record<string, any> & { paymentMethods?: StorePaymentMethod[] };

// ───────────── Enums ─────────────
export const planCode = pgEnum('plan_code', ['FREE', 'BASIC', 'PRO', 'ENTERPRISE']);
export const subscriptionStatus = pgEnum('subscription_status', ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED']);
export const membershipStatus = pgEnum('membership_status', ['ACTIVE', 'SUSPENDED']);
export const saleStatus = pgEnum('sale_status', ['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']);
export const paymentMethod = pgEnum('payment_method', [
  'CASH', 'BANK_TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'PSE', 'NEQUI', 'DAVIPLATA', 'OTHER',
]);
export const salesChannel = pgEnum('sales_channel', [
  'INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'TIKTOK', 'WEBSITE', 'PHYSICAL_STORE', 'MARKETPLACE', 'OTHER',
]);
export const expenseCategory = pgEnum('expense_category', [
  'RENT', 'UTILITIES', 'PAYROLL', 'TRANSPORT', 'ADVERTISING', 'MERCHANDISE', 'BANK_FEES', 'TAXES', 'OTHER',
]);
export const payableStatus = pgEnum('payable_status', ['PAID', 'PENDING']);
export const purchaseStatus = pgEnum('purchase_status', ['PENDING', 'PARTIALLY_PAID', 'PAID']);
export const movementType = pgEnum('movement_type', ['INITIAL', 'PURCHASE', 'SALE', 'SALE_CANCEL', 'ADJUSTMENT', 'ORDER_RESERVE', 'ORDER_RELEASE', 'RETURN']);
export const storeOrderStatus = pgEnum('store_order_status', ['RECEIVED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
export const bankProvider = pgEnum('bank_provider', ['MANUAL', 'SANDBOX']);
export const bankTxType = pgEnum('bank_tx_type', ['CREDIT', 'DEBIT']);
export const bankTxStatus = pgEnum('bank_tx_status', ['UNMATCHED', 'MATCHED', 'IGNORED']);
export const reconciliationStatus = pgEnum('reconciliation_status', ['SUGGESTED', 'ACCEPTED', 'REJECTED']);
export const socialPlatform = pgEnum('social_platform', ['INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'TIKTOK', 'YOUTUBE', 'X']);
export const socialAccountStatus = pgEnum('social_account_status', ['CONNECTED', 'EXPIRED', 'REVOKED']);

// ───────────── Identidad y acceso ─────────────
export const users = pgTable('users', {
  id: id(),
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: text().notNull(),
  fullName: varchar({ length: 160 }).notNull(),
  phone: varchar({ length: 40 }),
  emailVerifiedAt: ts(),
  twoFactorEnabled: boolean().notNull().default(false),
  twoFactorSecretEnc: text(),
  failedLoginCount: integer().notNull().default(0),
  lockedUntil: ts(),
  acceptedPolicyAt: ts(),
  /** Redes sociales personales del usuario (instagram, tiktok, linkedin…). */
  /** Tutoriales de secciones que el usuario ya vio (claves como 'finanzas'). */
  tutorialsSeen: jsonb().$type<string[]>().notNull().default([]),
  socialLinks: jsonb().$type<Record<string, string>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
});

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text().notNull(),
  userAgent: text(),
  ip: varchar({ length: 64 }),
  createdAt: createdAt(),
  lastUsedAt: ts().notNull().defaultNow(),
  expiresAt: ts().notNull(),
  revokedAt: ts(),
}, (t) => [index().on(t.userId)]);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text().notNull().unique(),
  expiresAt: ts().notNull(),
  usedAt: ts(),
  createdAt: createdAt(),
});

// ───────────── Negocio ─────────────
export const businesses = pgTable('businesses', {
  id: id(),
  ownerId: uuid().notNull().references(() => users.id),
  tradeName: varchar({ length: 160 }).notNull(),
  legalName: varchar({ length: 200 }),
  taxId: varchar({ length: 40 }),
  phone: varchar({ length: 40 }),
  email: varchar({ length: 255 }),
  address: varchar({ length: 255 }),
  city: varchar({ length: 120 }),
  country: varchar({ length: 2 }).notNull().default('CO'),
  currency: varchar({ length: 3 }).notNull().default('COP'),
  timezone: varchar({ length: 64 }).notNull().default('America/Bogota'),
  businessType: varchar({ length: 80 }),
  category: varchar({ length: 80 }),
  /** PRODUCTS: vende productos · SERVICES: presta servicios (abogados, técnicos, salones…). Cambia la interfaz. */
  businessModel: varchar({ length: 20 }).notNull().default('PRODUCTS'),
  /** Perfil del negocio de servicios: LEGAL, TECH_REPAIR, BEAUTY, HEALTH, HOME, CONSULTING, EDUCATION, OTHER. */
  serviceProfile: varchar({ length: 30 }),
  logoUrl: text(),
  socialLinks: jsonb().$type<Record<string, string>>().notNull().default({}),
  /** Paleta de marca elegida por el negocio: colores en hex (#RRGGBB). */
  brandColors: jsonb().$type<{ primary: string; accent: string; paletteId?: string }>(),
  storeSlug: varchar({ length: 80 }).unique(),
  storeEnabled: boolean().notNull().default(false),
  /** Configuración del sitio web público (diseño, secciones, medios de pago…). Ver store.module.ts. */
  storeConfig: jsonb().$type<StoreSiteConfig>().notNull().default({}),
  /** Código para invitar a otros negocios (referidos) y negocio que lo invitó. */
  referralCode: varchar({ length: 12 }).unique(),
  referredByBusinessId: uuid(),
  /** Guía de arranque: pasos marcados manualmente y si se ocultó. */
  onboarding: jsonb().$type<{ dismissed?: boolean; marks?: Record<string, string> }>().notNull().default({}),
  /** Proveedor tecnológico de facturación electrónica (credenciales cifradas). */
  einvoiceProvider: jsonb().$type<Record<string, any>>().notNull().default({}),
  /** Ajustes de la calculadora de honorarios (SMMLV, IVA, anticipo, tarifa por hora…). Ver fees.module.ts. */
  feeSettings: jsonb().$type<FeeSettings>().notNull().default({}),
  /** Datos tributarios y diseño de las facturas (régimen, responsabilidades, plantilla, logo…). Ver invoicing.module.ts. */
  invoiceSettings: jsonb().$type<InvoiceSettings>().notNull().default({}),
  wompiPublicKey: varchar({ length: 120 }),
  wompiPrivateKeyEnc: text(),
  wompiIntegritySecretEnc: text(),
  wompiEventSecretEnc: text(),
  monthlyGoal: money(),
  nextSaleNumber: integer().notNull().default(1),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
});

export const roles = pgTable('roles', {
  id: id(),
  businessId: uuid().references(() => businesses.id, { onDelete: 'cascade' }), // null = rol del sistema
  key: varchar({ length: 40 }).notNull(),
  name: varchar({ length: 80 }).notNull(),
  isSystem: boolean().notNull().default(false),
}, (t) => [uniqueIndex().on(t.businessId, t.key)]);

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid().notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permission: varchar({ length: 60 }).notNull(),
}, (t) => [primaryKey({ columns: [t.roleId, t.permission] })]);

export const memberships = pgTable('memberships', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  roleId: uuid().notNull().references(() => roles.id),
  status: membershipStatus().notNull().default('ACTIVE'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex().on(t.userId, t.businessId)]);

export const plans = pgTable('plans', {
  code: planCode().primaryKey(),
  name: varchar({ length: 60 }).notNull(),
  priceMonthly: money().notNull(),
  currency: varchar({ length: 3 }).notNull().default('COP'),
  limits: jsonb().$type<PlanLimits>().notNull(),
});

export type PlanLimits = {
  users: number | null; products: number | null; salesPerMonth: number | null;
  bankAccounts: number | null; socialAccounts: number | null;
  assistant: boolean; reportFormats: string[];
  /** Procesos vigilados (null = ilimitado) y avisos por WhatsApp. */
  processWatches?: number | null; whatsappAlerts?: boolean;
};

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  businessId: uuid().notNull().unique().references(() => businesses.id, { onDelete: 'cascade' }),
  planCode: planCode().notNull().default('FREE').references(() => plans.code),
  status: subscriptionStatus().notNull().default('ACTIVE'),
  currentPeriodEnd: ts(),
  provider: varchar({ length: 40 }),
  providerRef: varchar({ length: 120 }),
  createdAt: createdAt(),
});

export const payments = pgTable('payments', {
  id: id(),
  subscriptionId: uuid().notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  amount: money().notNull(),
  currency: varchar({ length: 3 }).notNull().default('COP'),
  status: varchar({ length: 30 }).notNull(),
  provider: varchar({ length: 40 }).notNull(),
  targetPlanCode: planCode(),
  providerRef: varchar({ length: 120 }),
  transactionId: varchar({ length: 120 }),
  paymentMethod: varchar({ length: 40 }),
  paidAt: ts(),
  createdAt: createdAt(),
});

// ───────────── Catálogo e inventario ─────────────
export const categories = pgTable('categories', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar({ length: 80 }).notNull(),
}, (t) => [uniqueIndex().on(t.businessId, t.name)]);

export const suppliers = pgTable('suppliers', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar({ length: 160 }).notNull(),
  company: varchar({ length: 160 }),
  taxId: varchar({ length: 40 }),
  phone: varchar({ length: 40 }),
  email: varchar({ length: 255 }),
  notes: text(),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId)]);

export const products = pgTable('products', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  sku: varchar({ length: 60 }).notNull(),
  barcode: varchar({ length: 60 }),
  name: varchar({ length: 200 }).notNull(),
  description: text(),
  categoryId: uuid().references(() => categories.id, { onDelete: 'set null' }),
  supplierId: uuid().references(() => suppliers.id, { onDelete: 'set null' }),
  costPrice: money().notNull(),
  salePrice: money().notNull(),
  taxRate: numeric({ precision: 5, scale: 2 }).notNull().default('0'),
  minStock: integer().notNull().default(0),
  storeOptions: jsonb().$type<{ name: string; type: 'select' | 'multi' | 'text' | 'date' | 'time'; required: boolean; choices?: { label: string; priceDelta?: string }[] }[]>().notNull().default([]),
  preparationMinutes: integer(),
  depositPercent: integer().notNull().default(0),
  appointmentSchedule: jsonb().$type<{ weekdays: number[]; startTime: string; endTime: string; intervalMinutes: number; durationMinutes: number } | null>(),
  imageUrl: text(),
  isActive: boolean().notNull().default(true),
  /** Servicio (no maneja inventario) en vez de producto físico. */
  isService: boolean().notNull().default(false),
  /** Cómo se cobra un servicio: FIXED (precio fijo), HOUR, SESSION, MONTH. */
  pricingUnit: varchar({ length: 20 }).notNull().default('FIXED'),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex().on(t.businessId, t.sku), index().on(t.businessId, t.name)]);

export const productVariants = pgTable('product_variants', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: varchar({ length: 80 }).notNull(),
  options: jsonb().$type<Record<string, string>>().notNull(),
  stock: integer().notNull().default(0),
  minStock: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex().on(t.businessId, t.sku), index().on(t.productId)]);

export const storeOrders = pgTable('store_orders', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  customerPurchaseCountedAt: ts(),
  status: storeOrderStatus().notNull().default('RECEIVED'),
  customerName: varchar({ length: 160 }).notNull(),
  customerPhone: varchar({ length: 40 }).notNull(),
  address: varchar({ length: 255 }).notNull(),
  city: varchar({ length: 120 }).notNull(),
  paymentMethod: varchar({ length: 80 }).notNull(),
  shippingFee: money().notNull().default('0'),
  attributionSource: varchar({ length: 80 }),
  attributionMedium: varchar({ length: 80 }),
  attributionCampaign: varchar({ length: 160 }),
  attributionContent: varchar({ length: 160 }),
  deliveryMethod: varchar({ length: 20 }).notNull().default('DELIVERY'),
  couponCode: varchar({ length: 40 }),
  discount: money().notNull().default('0'),
  notes: varchar({ length: 500 }),
  marketingOptIn: boolean().notNull().default(false),
  saleId: uuid().references(() => sales.id, { onDelete: 'set null' }),
  paymentStatus: varchar({ length: 20 }).notNull().default('PENDING'),
  paymentProvider: varchar({ length: 30 }),
  paymentTransactionId: varchar({ length: 120 }),
  shippingCarrier: varchar({ length: 40 }),
  pickupDate: varchar({ length: 10 }),
  pickupWindow: varchar({ length: 40 }),
  pickupConfirmation: varchar({ length: 100 }),
  trackingNumber: varchar({ length: 80 }),
  trackingUrl: text(),
  paidAt: ts(),
  dataUseAcceptedAt: ts().notNull(),
  total: money().notNull(),
  paymentDue: money().notNull(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
  confirmedAt: ts(),
  shippedAt: ts(),
  deliveredAt: ts(),
  cancelledAt: ts(),
}, (t) => [index().on(t.businessId, t.createdAt), index().on(t.businessId, t.status)]);

export const storeOrderItems = pgTable('store_order_items', {
  id: id(),
  orderId: uuid().notNull().references(() => storeOrders.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id),
  variantId: uuid().references(() => productVariants.id, { onDelete: 'set null' }),
  productName: varchar({ length: 200 }).notNull(),
  quantity: integer().notNull(),
  unitPrice: money().notNull(),
  selectedOptions: jsonb().$type<Record<string, string | string[]>>().notNull().default({}),
  preparationMinutes: integer(),
  depositPercent: integer().notNull().default(0),
  appointmentSchedule: jsonb().$type<{ weekdays: number[]; startTime: string; endTime: string; intervalMinutes: number; durationMinutes: number } | null>(),
  createdAt: createdAt(),
}, (t) => [index().on(t.orderId)]);

export const storeCoupons = pgTable('store_coupons', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  code: varchar({ length: 40 }).notNull(),
  description: varchar({ length: 160 }),
  kind: varchar({ length: 10 }).notNull().default('PERCENT'), // PERCENT | FIXED | SHIPPING
  value: money().notNull(),
  minSubtotal: money().notNull().default('0'),
  maxUses: integer(),
  usedCount: integer().notNull().default(0),
  campaign: varchar({ length: 160 }),
  startsAt: ts(),
  expiresAt: ts(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
}, (t) => [uniqueIndex().on(t.businessId, t.code)]);

/** Carritos que el comprador dejó sin terminar, guardados SOLO si autorizó que lo contacten. */
export const storeCarts = pgTable('store_carts', {
  id: uuid().primaryKey(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  customerName: varchar({ length: 160 }).notNull(),
  customerPhone: varchar({ length: 40 }).notNull(),
  items: jsonb().$type<{ productId: string; name: string; quantity: number; unitPrice: string }[]>().notNull(),
  subtotal: money().notNull(),
  consentAt: ts().notNull(),
  remindedAt: ts(),
  dismissedAt: ts(),
  convertedOrderId: uuid().references(() => storeOrders.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index().on(t.businessId, t.updatedAt)]);

export type ReturnItem = { productId: string; variantId?: string | null; name: string; quantity: number; unitPrice: string; restock?: boolean };
/** Devoluciones y cambios. source: STORE_ORDER (pedido de la página web) o SALE (venta registrada en el panel). */
export const returns = pgTable('returns', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  number: integer().notNull(),
  source: varchar({ length: 20 }).notNull(),
  storeOrderId: uuid().references(() => storeOrders.id, { onDelete: 'set null' }),
  saleId: uuid().references(() => sales.id, { onDelete: 'set null' }),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  customerName: varchar({ length: 160 }).notNull(),
  customerPhone: varchar({ length: 40 }),
  reason: varchar({ length: 30 }).notNull(),
  details: varchar({ length: 1000 }),
  resolution: varchar({ length: 20 }).notNull().default('REFUND'), // REFUND | EXCHANGE
  status: varchar({ length: 20 }).notNull().default('REQUESTED'), // REQUESTED | APPROVED | REJECTED | RECEIVED | REFUNDED | EXCHANGED
  items: jsonb().$type<ReturnItem[]>().notNull(),
  refundAmount: money().notNull().default('0'),
  refundMethod: varchar({ length: 20 }),
  refundReference: varchar({ length: 120 }),
  restockedCost: money().notNull().default('0'),
  responseNote: varchar({ length: 1000 }),
  createdById: uuid(),
  requestedAt: ts().notNull().defaultNow(),
  approvedAt: ts(),
  receivedAt: ts(),
  resolvedAt: ts(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex().on(t.businessId, t.number), index().on(t.businessId, t.status), index().on(t.businessId, t.resolvedAt)]);

/** Lo que el asistente sabe del negocio: guías de uso de servicios, cuidados, garantías, respuestas frecuentes. */
export const knowledgeEntries = pgTable('knowledge_entries', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  title: varchar({ length: 160 }).notNull(),
  content: text().notNull(),
  category: varchar({ length: 40 }).notNull().default('GENERAL'),
  productId: uuid().references(() => products.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index().on(t.businessId)]);

/** Casos (abogados), órdenes de servicio (técnicos) o trabajos: lo que el negocio de servicios atiende para un cliente. */
export const jobs = pgTable('jobs', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  number: integer().notNull(),
  trackingCode: varchar({ length: 12 }).notNull(),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  title: varchar({ length: 200 }).notNull(),
  category: varchar({ length: 80 }),
  status: varchar({ length: 20 }).notNull().default('OPEN'), // QUOTE | OPEN | IN_PROGRESS | WAITING | READY | DELIVERED | CANCELLED
  priority: varchar({ length: 10 }).notNull().default('NORMAL'),
  assignedUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
  description: text(),
  details: jsonb().$type<Record<string, string>>().notNull().default({}),
  dueAt: ts(),
  quoteStatus: varchar({ length: 12 }).notNull().default('NONE'), // NONE | SENT | APPROVED | REJECTED
  quoteSentAt: ts(),
  quoteDecidedAt: ts(),
  warrantyDays: integer().notNull().default(0),
  saleId: uuid().references(() => sales.id, { onDelete: 'set null' }),
  createdById: uuid(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
  closedAt: ts(),
}, (t) => [uniqueIndex().on(t.businessId, t.number), uniqueIndex().on(t.businessId, t.trackingCode), index().on(t.businessId, t.status), index().on(t.businessId, t.dueAt), index().on(t.customerId)]);

export const jobItems = pgTable('job_items', {
  id: id(),
  jobId: uuid().notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  productId: uuid().references(() => products.id, { onDelete: 'set null' }),
  kind: varchar({ length: 12 }).notNull().default('SERVICE'), // SERVICE | PART | FEE | EXPENSE
  description: varchar({ length: 200 }).notNull(),
  quantity: numeric({ precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: money().notNull(),
  createdAt: createdAt(),
}, (t) => [index().on(t.jobId)]);

/** Bitácora: notas, actuaciones, cambios de estado y horas trabajadas. */
export const jobEvents = pgTable('job_events', {
  id: id(),
  jobId: uuid().notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  type: varchar({ length: 12 }).notNull(), // NOTE | STATUS | TIME | QUOTE | PAYMENT
  body: text().notNull(),
  minutes: integer(),
  billable: boolean().notNull().default(false),
  visibleToCustomer: boolean().notNull().default(false),
  userId: uuid().references(() => users.id, { onDelete: 'set null' }),
  occurredAt: ts().notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [index().on(t.jobId, t.occurredAt)]);

export const appointments = pgTable('appointments', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  customerName: varchar({ length: 160 }),
  customerPhone: varchar({ length: 40 }),
  productId: uuid().references(() => products.id, { onDelete: 'set null' }),
  jobId: uuid().references(() => jobs.id, { onDelete: 'set null' }),
  storeOrderId: uuid().references(() => storeOrders.id, { onDelete: 'set null' }),
  assignedUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
  title: varchar({ length: 200 }).notNull(),
  startsAt: ts().notNull(),
  endsAt: ts().notNull(),
  status: varchar({ length: 12 }).notNull().default('SCHEDULED'), // SCHEDULED | CONFIRMED | DONE | CANCELLED | NO_SHOW
  modality: varchar({ length: 12 }).notNull().default('IN_PERSON'), // IN_PERSON | VIRTUAL | AT_HOME
  location: varchar({ length: 255 }),
  notes: varchar({ length: 1000 }),
  source: varchar({ length: 10 }).notNull().default('PANEL'), // PANEL | WEB
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index().on(t.businessId, t.startsAt)]);

/** Numeraciones autorizadas por la DIAN (resolución de facturación). La clave técnica va cifrada. */
export const invoiceResolutions = pgTable('invoice_resolutions', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  kind: varchar({ length: 20 }).notNull(), // ELECTRONIC | CONTINGENCY
  resolutionNumber: varchar({ length: 40 }).notNull(),
  resolutionDate: varchar({ length: 10 }).notNull(),
  prefix: varchar({ length: 4 }),
  fromNumber: integer().notNull(),
  toNumber: integer().notNull(),
  nextNumber: integer().notNull(),
  validFrom: varchar({ length: 10 }),
  validTo: varchar({ length: 10 }),
  technicalKeyEnc: text(),
  environment: varchar({ length: 1 }).notNull().default('1'), // 1 producción · 2 pruebas
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.kind)]);

/**
 * Facturas y notas crédito expedidas. Son inmutables: guardan una copia exacta de los datos del vendedor, el comprador
 * y los ítems al momento de expedir, para soportar reclamaciones de garantía y obligaciones de conservación.
 */
export const invoices = pgTable('invoices', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  saleId: uuid().references(() => sales.id, { onDelete: 'set null' }),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  kind: varchar({ length: 12 }).notNull().default('INVOICE'), // INVOICE | CREDIT_NOTE
  docType: varchar({ length: 20 }).notNull(), // ELECTRONIC | CONTINGENCY | INTERNAL
  resolutionId: uuid().references(() => invoiceResolutions.id, { onDelete: 'set null' }),
  prefix: varchar({ length: 10 }),
  number: integer().notNull(),
  fullNumber: varchar({ length: 30 }).notNull(),
  issuedAt: ts().notNull().defaultNow(),
  dueDate: ts(),
  paymentForm: varchar({ length: 10 }).notNull(), // CONTADO | CREDITO
  paymentMeans: varchar({ length: 20 }),
  seller: jsonb().notNull(),
  buyer: jsonb().notNull(),
  items: jsonb().notNull(),
  taxes: jsonb().notNull().default([]),
  subtotal: money().notNull(),
  discountTotal: money().notNull(),
  taxTotal: money().notNull(),
  total: money().notNull(),
  amountPaid: money().notNull().default('0'),
  notes: text(),
  warrantyMonths: integer().notNull().default(0),
  warrantyUntil: ts(),
  warrantyText: text(),
  template: jsonb().notNull().default({}),
  resolutionText: text(),
  status: varchar({ length: 12 }).notNull().default('ISSUED'), // ISSUED | VOIDED
  voidedAt: ts(),
  voidReason: text(),
  relatedInvoiceId: uuid(),
  dianStatus: varchar({ length: 20 }).notNull().default('NOT_APPLICABLE'), // NOT_APPLICABLE | PENDING | ACCEPTED | REJECTED | SIMULATED
  cufe: varchar({ length: 100 }),
  dianEnvironment: varchar({ length: 1 }),
  dianValidatedAt: ts(),
  dianMessage: text(),
  dianProvider: varchar({ length: 40 }),
  /** Respuesta del proveedor tecnológico (QR, enlace público, número asignado, errores). */
  dianData: jsonb().$type<Record<string, any>>().notNull().default({}),
  integrityHash: varchar({ length: 64 }).notNull(),
  createdById: uuid(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex().on(t.businessId, t.fullNumber), index().on(t.businessId, t.issuedAt), index().on(t.saleId), index().on(t.customerId)]);

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
/** Archivos de la factura electrónica (XML y PDF validados por la DIAN). Privados: se sirven solo con permiso. */
export const invoiceFiles = pgTable('invoice_files', {
  id: id(),
  invoiceId: uuid().notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  kind: varchar({ length: 10 }).notNull(), // PDF | XML | ZIP
  filename: varchar({ length: 160 }).notNull(),
  mime: varchar({ length: 80 }).notNull(),
  size: integer().notNull(),
  content: bytea().notNull(),
  createdAt: createdAt(),
}, (t) => [index().on(t.invoiceId)]);

/** Términos de caducidad y prescripción que vigila el abogado (ver legal-terms/). */
export const legalTerms = pgTable('legal_terms', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  jobId: uuid().references(() => jobs.id, { onDelete: 'set null' }),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  ruleKey: varchar({ length: 40 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  eventDate: varchar({ length: 10 }).notNull(),
  input: jsonb().notNull(),
  result: jsonb().notNull(),
  dueDate: varchar({ length: 10 }),
  status: varchar({ length: 12 }).notNull().default('ACTIVE'), // ACTIVE | FILED | LAPSED | ARCHIVED
  checklist: jsonb().$type<number[]>().notNull().default([]),
  notes: text(),
  alertsSent: jsonb().$type<number[]>().notNull().default([]),
  closedAt: ts(),
  createdById: uuid(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index().on(t.businessId, t.dueDate), index().on(t.jobId)]);

/** Perfil público del abogado para recibir solicitudes de la micro app «Tu Derecho». */
export const lawyerProfiles = pgTable('lawyer_profiles', {
  id: id(),
  businessId: uuid().notNull().unique().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid(),
  displayName: varchar({ length: 160 }).notNull(),
  professionalCard: varchar({ length: 30 }).notNull(),
  verification: varchar({ length: 12 }).notNull().default('PENDING'), // PENDING | VERIFIED | REJECTED
  verificationNote: text(),
  topics: jsonb().$type<string[]>().notNull().default([]),
  departments: jsonb().$type<string[]>().notNull().default([]),
  remote: boolean().notNull().default(false),
  yearsExperience: integer().notNull().default(0),
  bio: text(),
  accepting: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
});

/** Consultas de personas que pidieron propuestas de abogados. */
export const helpRequests = pgTable('help_requests', {
  id: id(),
  code: varchar({ length: 10 }).notNull().unique(),
  tokenHash: varchar({ length: 64 }).notNull(),
  topic: varchar({ length: 30 }).notNull(),
  answers: jsonb().$type<Record<string, string>>().notNull().default({}),
  description: text().notNull(),
  publicDescription: text().notNull(),
  department: varchar({ length: 60 }).notNull(),
  city: varchar({ length: 120 }),
  urgent: boolean().notNull().default(false),
  orientation: jsonb().notNull(),
  contactName: varchar({ length: 160 }).notNull(),
  contactPhone: varchar({ length: 40 }).notNull(),
  contactEmail: varchar({ length: 255 }),
  consentText: text().notNull(),
  consentAt: ts().notNull(),
  status: varchar({ length: 12 }).notNull().default('OPEN'), // OPEN | CHOSEN | CLOSED
  deadlineAt: ts().notNull(),
  chosenProposalId: uuid(),
  createdAt: createdAt(),
}, (t) => [index().on(t.status, t.topic), index().on(t.createdAt)]);

export const helpProposals = pgTable('help_proposals', {
  id: id(),
  requestId: uuid().notNull().references(() => helpRequests.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid(),
  feeAmount: money().notNull(),
  feeTerms: text().notNull(),
  plan: text().notNull(),
  estimatedTime: varchar({ length: 120 }).notNull(),
  experience: text(),
  status: varchar({ length: 12 }).notNull().default('SENT'), // SENT | CHOSEN | NOT_CHOSEN | WITHDRAWN
  jobId: uuid().references(() => jobs.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex().on(t.requestId, t.businessId), index().on(t.businessId)]);

/** Procesos vigilados: Rama Judicial (consulta automática) y otras entidades (recordatorio + registro manual). */
export const processWatches = pgTable('process_watches', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  jobId: uuid().references(() => jobs.id, { onDelete: 'set null' }),
  source: varchar({ length: 30 }).notNull(),
  kind: varchar({ length: 30 }).notNull().default('OTRO'),
  reference: varchar({ length: 80 }).notNull(),
  extra: jsonb().$type<Record<string, string>>().notNull().default({}),
  title: varchar({ length: 200 }).notNull(),
  mode: varchar({ length: 10 }).notNull(), // AUTO | MANUAL
  status: varchar({ length: 10 }).notNull().default('ACTIVE'), // ACTIVE | PAUSED | ARCHIVED
  remindDays: integer().notNull().default(7),
  summary: jsonb().$type<Record<string, any>>().notNull().default({}),
  lastActivity: varchar({ length: 10 }),
  lastCheckedAt: ts(),
  nextCheckAt: ts(),
  lastChangeAt: ts(),
  lastError: text(),
  errorCount: integer().notNull().default(0),
  unread: integer().notNull().default(0),
  createdById: uuid(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex('process_watches_business_source_ref').on(t.businessId, t.source, t.reference), index('process_watches_due').on(t.status, t.nextCheckAt), index('process_watches_job').on(t.jobId)]);

/** Actuaciones o novedades de un proceso vigilado. */
export const processUpdates = pgTable('process_updates', {
  id: id(),
  watchId: uuid().notNull().references(() => processWatches.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  externalId: varchar({ length: 60 }).notNull(),
  date: varchar({ length: 10 }),
  title: varchar({ length: 300 }).notNull(),
  body: text(),
  termStart: varchar({ length: 10 }),
  termEnd: varchar({ length: 10 }),
  origin: varchar({ length: 10 }).notNull().default('AUTO'), // AUTO | MANUAL | SYSTEM
  hasDocs: boolean().notNull().default(false),
  baseline: boolean().notNull().default(false),
  createdById: uuid(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('process_updates_watch_ext').on(t.watchId, t.externalId), index('process_updates_business_created').on(t.businessId, t.createdAt)]);

/** Autorización de cada usuario para recibir avisos por WhatsApp (Ley 1581 y política de WhatsApp). */
export const whatsappContacts = pgTable('whatsapp_contacts', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  phone: varchar({ length: 20 }).notNull(),
  alerts: jsonb().$type<string[]>().notNull().default([]),
  consentText: text().notNull(),
  consentVersion: varchar({ length: 10 }).notNull(),
  consentedAt: ts().notNull(),
  consentIp: varchar({ length: 64 }),
  revokedAt: ts(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex('whatsapp_contacts_user_business').on(t.userId, t.businessId), index('whatsapp_contacts_phone').on(t.phone)]);

/** Mensajes enviados (o que no se pudieron enviar) por WhatsApp. */
export const outboundMessages = pgTable('outbound_messages', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid(),
  channel: varchar({ length: 12 }).notNull().default('WHATSAPP'),
  toPhone: varchar({ length: 20 }).notNull(),
  template: varchar({ length: 80 }).notNull(),
  params: jsonb().$type<Record<string, string>>().notNull().default({}),
  status: varchar({ length: 20 }).notNull(), // SENT | DELIVERED | READ | FAILED | NOT_CONFIGURED
  providerId: varchar({ length: 160 }),
  error: text(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index('outbound_messages_business_created').on(t.businessId, t.createdAt), index('outbound_messages_provider').on(t.providerId)]);

export const referralRewards = pgTable('referral_rewards', {
  id: id(),
  referrerBusinessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  referredBusinessId: uuid().notNull().unique().references(() => businesses.id, { onDelete: 'cascade' }),
  paymentId: uuid(),
  planCode: varchar({ length: 20 }),
  days: integer().notNull().default(15),
  grantedAt: ts().notNull().defaultNow(),
});

export const testimonials = pgTable('testimonials', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid(),
  authorName: varchar({ length: 120 }).notNull(),
  businessName: varchar({ length: 160 }).notNull(),
  city: varchar({ length: 120 }),
  rating: integer().notNull(),
  body: text().notNull(),
  consent: boolean().notNull().default(false),
  status: varchar({ length: 12 }).notNull().default('PENDING'), // PENDING | APPROVED | REJECTED
  createdAt: createdAt(),
});

/** Links de pago (Wompi) para cobrar ventas o trabajos. */
export const paymentLinks = pgTable('payment_links', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  saleId: uuid().references(() => sales.id, { onDelete: 'set null' }),
  jobId: uuid().references(() => jobs.id, { onDelete: 'set null' }),
  provider: varchar({ length: 12 }).notNull().default('WOMPI'),
  providerId: varchar({ length: 80 }).notNull(),
  url: text().notNull(),
  amount: money().notNull(),
  description: varchar({ length: 200 }).notNull(),
  status: varchar({ length: 12 }).notNull().default('ACTIVE'), // ACTIVE | PAID | CANCELLED
  transactionId: varchar({ length: 80 }),
  paidAt: ts(),
  createdById: uuid(),
  createdAt: createdAt(),
});

/** Paquetes (N sesiones) y membresías (acceso por un periodo). */
export const servicePackages = pgTable('service_packages', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  productId: uuid().references(() => products.id, { onDelete: 'set null' }),
  name: varchar({ length: 160 }).notNull(),
  kind: varchar({ length: 12 }).notNull(), // PACKAGE | MEMBERSHIP
  description: text(),
  sessions: integer(),
  validityDays: integer().notNull().default(30),
  price: money().notNull(),
  serviceIds: jsonb().$type<string[]>().notNull().default([]),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});
export const customerPackages = pgTable('customer_packages', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  packageId: uuid().references(() => servicePackages.id, { onDelete: 'set null' }),
  customerId: uuid().notNull().references(() => customers.id, { onDelete: 'cascade' }),
  saleId: uuid().references(() => sales.id, { onDelete: 'set null' }),
  name: varchar({ length: 160 }).notNull(),
  kind: varchar({ length: 12 }).notNull(),
  sessionsTotal: integer(),
  sessionsUsed: integer().notNull().default(0),
  startsAt: varchar({ length: 10 }).notNull(),
  endsAt: varchar({ length: 10 }).notNull(),
  price: money().notNull(),
  status: varchar({ length: 12 }).notNull().default('ACTIVE'), // ACTIVE | USED | EXPIRED | CANCELLED
  createdAt: createdAt(),
});
export const packageUsages = pgTable('package_usages', {
  id: id(),
  customerPackageId: uuid().notNull().references(() => customerPackages.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  usedAt: ts().notNull().defaultNow(),
  note: varchar({ length: 300 }),
  createdById: uuid(),
});

/** Listas de precios (mayoristas, distribuidores, clientes especiales). */
export const priceLists = pgTable('price_lists', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar({ length: 120 }).notNull(),
  description: varchar({ length: 300 }),
  discountPercent: numeric({ precision: 5, scale: 2 }).notNull().default('0'),
  minOrderTotal: money().notNull().default('0'),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});
export const priceListItems = pgTable('price_list_items', {
  priceListId: uuid().notNull().references(() => priceLists.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id, { onDelete: 'cascade' }),
  price: money().notNull(),
  minQty: integer().notNull().default(1),
}, (t) => [primaryKey({ columns: [t.priceListId, t.productId] })]);

/** Plantillas jurídicas (globales con businessId null, o propias del despacho) y documentos generados. */
export const legalTemplates = pgTable('legal_templates', {
  id: id(),
  businessId: uuid().references(() => businesses.id, { onDelete: 'cascade' }),
  code: varchar({ length: 60 }),
  area: varchar({ length: 40 }).notNull(),
  category: varchar({ length: 80 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  body: text().notNull(),
  fields: jsonb().$type<{ key: string; label: string; help?: string }[]>().notNull().default([]),
  keywords: jsonb().$type<string[]>().notNull().default([]),
  legalBasis: text(),
  source: varchar({ length: 12 }).notNull().default('CUSTOM'), // SYSTEM | IMPORT | CUSTOM
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
});
export const legalDocuments = pgTable('legal_documents', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  jobId: uuid().references(() => jobs.id, { onDelete: 'set null' }),
  templateId: uuid().references(() => legalTemplates.id, { onDelete: 'set null' }),
  title: varchar({ length: 200 }).notNull(),
  body: text().notNull(),
  createdById: uuid(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
});

/** Reseñas públicas de los negocios del directorio. */
export const businessReviews = pgTable('business_reviews', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  authorName: varchar({ length: 80 }).notNull(),
  rating: integer().notNull(),
  body: text(),
  status: varchar({ length: 12 }).notNull().default('PUBLISHED'), // PUBLISHED | HIDDEN | REPORTED
  reply: text(),
  repliedAt: ts(),
  reportReason: varchar({ length: 300 }),
  fingerprint: varchar({ length: 64 }).notNull(),
  createdAt: createdAt(),
});

/** Propuestas de honorarios calculadas con las tablas de referencia (abogados, contadores, salud…). */
export const feeQuotes = pgTable('fee_quotes', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  number: integer().notNull(),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  title: varchar({ length: 200 }).notNull(),
  tableKey: varchar({ length: 30 }).notNull(),
  area: varchar({ length: 40 }),
  description: text(),
  input: jsonb().notNull(),
  result: jsonb().notNull(),
  total: money().notNull(),
  jobId: uuid().references(() => jobs.id, { onDelete: 'set null' }),
  createdById: uuid(),
  createdAt: createdAt(),
  updatedAt: ts().notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex().on(t.businessId, t.number), index().on(t.businessId, t.createdAt)]);

export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar({ length: 160 }).notNull(),
  source: varchar({ length: 80 }).notNull(),
  campaignKey: varchar({ length: 160 }).notNull(),
  spend: money().notNull().default('0'),
  couponCode: varchar({ length: 40 }),
  startsOn: varchar({ length: 10 }),
  endsOn: varchar({ length: 10 }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex().on(t.businessId, t.campaignKey)]);

export const warehouses = pgTable('warehouses', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar({ length: 80 }).notNull(),
  isDefault: boolean().notNull().default(false),
});

export const inventoryLevels = pgTable('inventory_levels', {
  productId: uuid().notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: uuid().notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  quantity: integer().notNull().default(0),
}, (t) => [primaryKey({ columns: [t.productId, t.warehouseId] })]);

export const inventoryMovements = pgTable('inventory_movements', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: uuid().notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  type: movementType().notNull(),
  quantity: integer().notNull(), // con signo
  unitCost: money(),
  referenceType: varchar({ length: 30 }),
  referenceId: uuid(),
  note: text(),
  userId: uuid(),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.createdAt), index().on(t.productId)]);

// ───────────── Clientes y ventas ─────────────
export const customers = pgTable('customers', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar({ length: 160 }).notNull(),
  phone: varchar({ length: 40 }),
  email: varchar({ length: 255 }),
  city: varchar({ length: 120 }),
  taxId: varchar({ length: 40 }),
  channel: salesChannel(),
  notes: text(),
  /** Redes sociales del cliente (para identificarlo en Instagram, TikTok, WhatsApp…). */
  socialLinks: jsonb().$type<Record<string, string>>().notNull().default({}),
  totalSpent: money().notNull().default('0'),
  purchaseCount: integer().notNull().default(0),
  firstPurchaseAt: ts(),
  lastPurchaseAt: ts(),
  /** Autorización expresa para recibir promociones (Ley 1581): se puede retirar en cualquier momento. */
  marketingOptIn: boolean().notNull().default(false),
  marketingOptInAt: ts(),
  marketingOptOutAt: ts(),
  /** Mayoristas: lista de precios, cupo de crédito y plazo de pago. */
  priceListId: uuid(),
  creditLimit: money(),
  paymentTermsDays: integer(),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.name)]);

export const sales = pgTable('sales', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  number: integer().notNull(),
  customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
  date: ts().notNull().defaultNow(),
  channel: salesChannel().notNull(),
  paymentMethod: paymentMethod().notNull(),
  status: saleStatus().notNull(),
  subtotal: money().notNull(),
  discountTotal: money().notNull(),
  taxTotal: money().notNull(),
  total: money().notNull(),
  amountPaid: money().notNull(),
  costTotal: money().notNull(),
  notes: text(),
  createdById: uuid(),
  cancelledAt: ts(),
  // Reservado para facturación electrónica (DIAN) futura
  einvoiceStatus: varchar({ length: 30 }),
  einvoiceRef: varchar({ length: 120 }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex().on(t.businessId, t.number), index().on(t.businessId, t.date)]);

export const saleItems = pgTable('sale_items', {
  id: id(),
  saleId: uuid().notNull().references(() => sales.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id),
  description: varchar({ length: 200 }).notNull(),
  quantity: integer().notNull(),
  unitPrice: money().notNull(),
  unitCost: money().notNull(),
  discount: money().notNull().default('0'),
  taxRate: numeric({ precision: 5, scale: 2 }).notNull().default('0'),
  lineTax: money().notNull(),
  lineTotal: money().notNull(),
}, (t) => [index().on(t.saleId), index().on(t.productId)]);

export const salePayments = pgTable('sale_payments', {
  id: id(),
  saleId: uuid().notNull().references(() => sales.id, { onDelete: 'cascade' }),
  amount: money().notNull(),
  method: paymentMethod().notNull(),
  reference: varchar({ length: 120 }),
  paidAt: ts().notNull().defaultNow(),
}, (t) => [index().on(t.saleId)]);

// ───────────── Compras, gastos, ingresos ─────────────
export const purchases = pgTable('purchases', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  supplierId: uuid().notNull().references(() => suppliers.id),
  date: ts().notNull().defaultNow(),
  total: money().notNull(),
  amountPaid: money().notNull(),
  status: purchaseStatus().notNull(),
  notes: text(),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.date)]);

export const purchaseItems = pgTable('purchase_items', {
  id: id(),
  purchaseId: uuid().notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id),
  quantity: integer().notNull(),
  unitCost: money().notNull(),
  lineTotal: money().notNull(),
});

export const purchasePayments = pgTable('purchase_payments', {
  id: id(),
  purchaseId: uuid().notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  amount: money().notNull(),
  method: paymentMethod().notNull(),
  paidAt: ts().notNull().defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  category: expenseCategory().notNull(),
  description: varchar({ length: 255 }).notNull(),
  amount: money().notNull(),
  date: ts().notNull(),
  paymentMethod: paymentMethod(),
  status: payableStatus().notNull().default('PAID'),
  dueDate: ts(),
  supplierId: uuid().references(() => suppliers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.date)]);

export const incomes = pgTable('incomes', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  category: varchar({ length: 60 }).notNull(),
  description: varchar({ length: 255 }).notNull(),
  amount: money().notNull(),
  date: ts().notNull(),
  paymentMethod: paymentMethod(),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.date)]);

// ───────────── Bancos ─────────────
export const bankAccounts = pgTable('bank_accounts', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  bankName: varchar({ length: 80 }).notNull(),
  accountType: varchar({ length: 20 }).notNull(), // AHORROS | CORRIENTE | BILLETERA
  accountNumberEnc: text(),
  last4: varchar({ length: 4 }),
  currency: varchar({ length: 3 }).notNull().default('COP'),
  provider: bankProvider().notNull().default('MANUAL'),
  providerAccountId: varchar({ length: 120 }),
  accessTokenEnc: text(),
  balance: money().notNull().default('0'),
  lastSyncedAt: ts(),
  createdAt: createdAt(),
});

export const bankTransactions = pgTable('bank_transactions', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  bankAccountId: uuid().notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  date: ts().notNull(),
  amount: money().notNull(), // siempre positivo
  type: bankTxType().notNull(),
  description: varchar({ length: 255 }).notNull(),
  reference: varchar({ length: 120 }),
  externalId: varchar({ length: 120 }),
  category: varchar({ length: 60 }),
  status: bankTxStatus().notNull().default('UNMATCHED'),
  isSimulated: boolean().notNull().default(false),
  createdAt: createdAt(),
}, (t) => [uniqueIndex().on(t.bankAccountId, t.externalId), index().on(t.businessId, t.date)]);

export const reconciliations = pgTable('reconciliations', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  bankTransactionId: uuid().notNull().references(() => bankTransactions.id, { onDelete: 'cascade' }),
  saleId: uuid().references(() => sales.id, { onDelete: 'cascade' }),
  expenseId: uuid().references(() => expenses.id, { onDelete: 'cascade' }),
  status: reconciliationStatus().notNull().default('SUGGESTED'),
  score: integer().notNull(),
  decidedAt: ts(),
  decidedById: uuid(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex().on(t.bankTransactionId, t.saleId),
  uniqueIndex().on(t.bankTransactionId, t.expenseId),
  index().on(t.businessId, t.status),
]);

// ───────────── Redes sociales ─────────────
export const socialAccounts = pgTable('social_accounts', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  platform: socialPlatform().notNull(),
  externalId: varchar({ length: 120 }).notNull(),
  name: varchar({ length: 160 }).notNull(),
  accessTokenEnc: text(),
  scopes: text().array().notNull().default([]),
  status: socialAccountStatus().notNull().default('CONNECTED'),
  tokenExpiresAt: ts(),
  connectedAt: createdAt(),
}, (t) => [uniqueIndex().on(t.businessId, t.platform, t.externalId)]);

export const socialPosts = pgTable('social_posts', {
  id: id(),
  socialAccountId: uuid().notNull().references(() => socialAccounts.id, { onDelete: 'cascade' }),
  externalId: varchar({ length: 120 }),
  content: text(),
  mediaUrl: text(),
  scheduledAt: ts(),
  publishedAt: ts(),
  metrics: jsonb().notNull().default({}),
});

export const socialMessages = pgTable('social_messages', {
  id: id(),
  socialAccountId: uuid().notNull().references(() => socialAccounts.id, { onDelete: 'cascade' }),
  externalId: varchar({ length: 120 }).notNull(),
  threadId: varchar({ length: 120 }),
  fromName: varchar({ length: 160 }),
  body: text().notNull(),
  direction: varchar({ length: 3 }).notNull(), // IN | OUT
  receivedAt: ts().notNull(),
  customerId: uuid(),
}, (t) => [uniqueIndex().on(t.socialAccountId, t.externalId)]);

// ───────────── Notificaciones, reportes, auditoría ─────────────
export const notifications = pgTable('notifications', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid(), // null = para todos los miembros con permiso
  type: varchar({ length: 40 }).notNull(),
  title: varchar({ length: 160 }).notNull(),
  body: text().notNull(),
  data: jsonb().notNull().default({}),
  readAt: ts(),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.createdAt)]);

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  type: varchar({ length: 40 }).notNull(),
  enabled: boolean().notNull().default(true),
}, (t) => [primaryKey({ columns: [t.userId, t.businessId, t.type] })]);

export const reports = pgTable('reports', {
  id: id(),
  businessId: uuid().notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  type: varchar({ length: 40 }).notNull(),
  format: varchar({ length: 10 }).notNull(),
  params: jsonb().notNull().default({}),
  createdById: uuid(),
  createdAt: createdAt(),
});

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  businessId: uuid().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid(),
  action: varchar({ length: 20 }).notNull(),
  entity: varchar({ length: 80 }).notNull(),
  entityId: varchar({ length: 80 }),
  ip: varchar({ length: 64 }),
  userAgent: text(),
  metadata: jsonb().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index().on(t.businessId, t.createdAt)]);

// ───────────── Relaciones (para consultas anidadas) ─────────────
export const usersRelations = relations(users, ({ many }) => ({ memberships: many(memberships), sessions: many(sessions) }));
export const businessesRelations = relations(businesses, ({ many, one }) => ({
  memberships: many(memberships),
  subscription: one(subscriptions, { fields: [businesses.id], references: [subscriptions.businessId] }),
}));
export const rolesRelations = relations(roles, ({ many }) => ({ permissions: many(rolePermissions) }));
export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({ role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }) }));
export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  business: one(businesses, { fields: [memberships.businessId], references: [businesses.id] }),
  role: one(roles, { fields: [memberships.roleId], references: [roles.id] }),
}));
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  plan: one(plans, { fields: [subscriptions.planCode], references: [plans.code] }),
}));
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  supplier: one(suppliers, { fields: [products.supplierId], references: [suppliers.id] }),
  levels: many(inventoryLevels),
}));
export const inventoryLevelsRelations = relations(inventoryLevels, ({ one }) => ({
  product: one(products, { fields: [inventoryLevels.productId], references: [products.id] }),
}));
export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  items: many(saleItems),
  payments: many(salePayments),
}));
export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));
export const salePaymentsRelations = relations(salePayments, ({ one }) => ({ sale: one(sales, { fields: [salePayments.saleId], references: [sales.id] }) }));
export const customersRelations = relations(customers, ({ many }) => ({ sales: many(sales) }));
export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
  items: many(purchaseItems),
  payments: many(purchasePayments),
}));
export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseItems.purchaseId], references: [purchases.id] }),
  product: one(products, { fields: [purchaseItems.productId], references: [products.id] }),
}));
export const purchasePaymentsRelations = relations(purchasePayments, ({ one }) => ({ purchase: one(purchases, { fields: [purchasePayments.purchaseId], references: [purchases.id] }) }));
export const suppliersRelations = relations(suppliers, ({ many }) => ({ purchases: many(purchases), products: many(products) }));
export const bankAccountsRelations = relations(bankAccounts, ({ many }) => ({ transactions: many(bankTransactions) }));
export const bankTransactionsRelations = relations(bankTransactions, ({ one, many }) => ({
  bankAccount: one(bankAccounts, { fields: [bankTransactions.bankAccountId], references: [bankAccounts.id] }),
  reconciliations: many(reconciliations),
}));
export const reconciliationsRelations = relations(reconciliations, ({ one }) => ({
  bankTransaction: one(bankTransactions, { fields: [reconciliations.bankTransactionId], references: [bankTransactions.id] }),
  sale: one(sales, { fields: [reconciliations.saleId], references: [sales.id] }),
  expense: one(expenses, { fields: [reconciliations.expenseId], references: [expenses.id] }),
}));
