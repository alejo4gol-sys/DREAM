import {
  BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { D, m2 } from '../common/money';
import { Db, InjectDb } from '../db/db';
import {
  ReturnItem, businesses, customers, productVariants, products, returns, saleItems, sales, storeOrderItems, storeOrders,
} from '../db/schema';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';

export const RETURN_REASONS = {
  DEFECTIVE: 'Llegó defectuoso o dañado',
  WRONG_ITEM: 'Recibí un producto equivocado',
  SIZE: 'La talla o medida no me quedó',
  NOT_AS_DESCRIBED: 'No es como se describía',
  CHANGED_MIND: 'Me arrepentí de la compra (retracto)',
  SERVICE: 'Problema con el servicio',
  WARRANTY: 'Garantía: dejó de funcionar',
  OTHER: 'Otro motivo',
} as const;
const REASONS = Object.keys(RETURN_REASONS) as (keyof typeof RETURN_REASONS)[];
const REFUND_METHODS = ['CASH', 'BANK_TRANSFER', 'NEQUI', 'DAVIPLATA', 'CARD_REVERSAL', 'PAYMENT_GATEWAY', 'STORE_CREDIT', 'OTHER'] as const;
const OPEN = ['REQUESTED', 'APPROVED', 'RECEIVED'];

class ReturnLineDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() variantId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(999) quantity: number;
}
class PublicLookupDto {
  @IsString() @Matches(/^#?[0-9a-fA-F]{8}$/, { message: 'El número de pedido tiene 8 caracteres, por ejemplo 2e8b604e' }) orderCode: string;
  @IsString() @Length(7, 40) phone: string;
}
class PublicReturnDto extends PublicLookupDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) items: ReturnLineDto[];
  @IsIn(REASONS) reason: keyof typeof RETURN_REASONS;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsIn(['REFUND', 'EXCHANGE']) resolution: 'REFUND' | 'EXCHANGE';
  @IsBoolean() @Equals(true) acceptedDataUse: boolean;
}
class PublicStatusQuery {
  @Type(() => Number) @IsInt() @Min(1) number: number;
  @IsString() @Length(7, 40) phone: string;
}
class CreateReturnDto {
  @IsIn(['SALE', 'STORE_ORDER']) source: 'SALE' | 'STORE_ORDER';
  @ValidateIf((o) => o.source === 'SALE') @IsUUID() saleId?: string;
  @ValidateIf((o) => o.source === 'STORE_ORDER') @IsUUID() storeOrderId?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) items: ReturnLineDto[];
  @IsIn(REASONS) reason: keyof typeof RETURN_REASONS;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsIn(['REFUND', 'EXCHANGE']) resolution: 'REFUND' | 'EXCHANGE';
}
class NoteDto { @IsOptional() @IsString() @MaxLength(1000) note?: string; }
class ReceiveDto {
  /** productId (o productId:variantId) de las líneas que vuelven al inventario. Las demás (dañadas) no se reponen. */
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) restock: string[];
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
class RefundDto {
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) amount: string;
  @IsIn(REFUND_METHODS) method: typeof REFUND_METHODS[number];
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
class ListQuery { @IsOptional() @IsIn(['OPEN', 'ALL', 'REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'EXCHANGED', 'REJECTED']) status?: string; }
class EligibleQuery {
  @IsIn(['SALE', 'STORE_ORDER']) source: 'SALE' | 'STORE_ORDER';
  @IsUUID() id: string;
}

const digits = (s?: string | null) => String(s ?? '').replace(/\D/g, '');
/** Compara celulares con o sin indicativo (57…). */
const samePhone = (a?: string | null, b?: string | null) => {
  const x = digits(a); const y = digits(b);
  return x.length >= 7 && y.length >= 7 && (x === y || x.endsWith(y.slice(-10)) || y.endsWith(x.slice(-10)));
};
const lineKey = (productId: string, variantId?: string | null) => variantId ? `${productId}:${variantId}` : productId;

@Injectable()
export class ReturnsService {
  constructor(@InjectDb() private db: Db, private inventory: InventoryService, private notifications: NotificationsService) {}

  /** Líneas que todavía se pueden devolver (lo comprado menos lo ya pedido en devoluciones no rechazadas). */
  async eligible(businessId: string, source: 'SALE' | 'STORE_ORDER', id: string) {
    let bought: ReturnItem[] = [];
    let meta: { customerId: string | null; customerName: string; customerPhone: string | null; saleId: string | null; storeOrderId: string | null; label: string; date: Date; status?: string; deliveredAt?: Date | null };
    if (source === 'STORE_ORDER') {
      const [o] = await this.db.select().from(storeOrders).where(and(eq(storeOrders.id, id), eq(storeOrders.businessId, businessId))).limit(1);
      if (!o) throw new NotFoundException('Pedido no encontrado');
      const its = await this.db.select().from(storeOrderItems).where(eq(storeOrderItems.orderId, o.id));
      // Precio efectivamente pagado por unidad: se reparte el descuento del cupón.
      const subtotal = its.reduce((a, i) => a.plus(D(i.unitPrice).mul(i.quantity)), D(0));
      const ratio = subtotal.isZero() ? D(1) : subtotal.minus(o.discount ?? 0).div(subtotal);
      bought = its.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.productName, quantity: i.quantity, unitPrice: m2(D(i.unitPrice).mul(ratio)) }));
      meta = { customerId: o.customerId, customerName: o.customerName, customerPhone: o.customerPhone, saleId: o.saleId, storeOrderId: o.id, label: `Pedido web #${o.id.slice(0, 8)}`, date: o.createdAt, status: o.status, deliveredAt: o.deliveredAt };
    } else {
      const s = await this.db.query.sales.findFirst({ where: and(eq(sales.id, id), eq(sales.businessId, businessId)), with: { items: true } });
      if (!s) throw new NotFoundException('Venta no encontrada');
      if (s.status === 'CANCELLED') throw new BadRequestException('La venta está anulada');
      const c = s.customerId ? await this.db.query.customers.findFirst({ where: eq(customers.id, s.customerId), columns: { name: true, phone: true } }) : null;
      bought = s.items.map((i) => ({ productId: i.productId, variantId: null, name: i.description, quantity: i.quantity, unitPrice: m2(D(i.lineTotal).div(i.quantity)) }));
      // Si la venta viene de un pedido web, la devolución se asocia también al pedido.
      const [fromOrder] = await this.db.select({ id: storeOrders.id }).from(storeOrders).where(eq(storeOrders.saleId, s.id)).limit(1);
      meta = { customerId: s.customerId, customerName: c?.name ?? 'Cliente de mostrador', customerPhone: c?.phone ?? null, saleId: s.id, storeOrderId: fromOrder?.id ?? null, label: `Venta #${s.number}`, date: s.date };
    }
    const previous = await this.db.select({ items: returns.items }).from(returns).where(and(eq(returns.businessId, businessId), ne(returns.status, 'REJECTED'),
      meta.storeOrderId && meta.saleId ? sql`(${returns.storeOrderId} = ${meta.storeOrderId} or ${returns.saleId} = ${meta.saleId})`
        : meta.storeOrderId ? eq(returns.storeOrderId, meta.storeOrderId) : eq(returns.saleId, meta.saleId!)));
    const used = new Map<string, number>();
    for (const r of previous) for (const i of r.items) used.set(lineKey(i.productId, i.variantId), (used.get(lineKey(i.productId, i.variantId)) ?? 0) + i.quantity);
    // Agrupa líneas iguales (mismo producto/variante) para comparar contra lo ya devuelto.
    const grouped = new Map<string, ReturnItem>();
    for (const b of bought) {
      const k = lineKey(b.productId, b.variantId); const prev = grouped.get(k);
      grouped.set(k, prev ? { ...prev, quantity: prev.quantity + b.quantity } : { ...b });
    }
    const items = [...grouped.entries()].map(([k, b]) => ({ ...b, bought: b.quantity, available: Math.max(0, b.quantity - (used.get(k) ?? 0)) }));
    return { ...meta, items };
  }

  private async nextNumber(tx: any, businessId: string) {
    await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).for('update');
    const [r] = await tx.select({ n: sql<number>`coalesce(max(${returns.number}), 0)::int + 1` }).from(returns).where(eq(returns.businessId, businessId));
    return r.n as number;
  }

  private pick(eligible: Awaited<ReturnType<ReturnsService['eligible']>>, lines: ReturnLineDto[]): ReturnItem[] {
    const out: ReturnItem[] = [];
    for (const l of lines) {
      const it = eligible.items.find((i) => i.productId === l.productId && (i.variantId ?? null) === (l.variantId ?? null));
      if (!it) throw new BadRequestException('Uno de los productos no hace parte de esa compra');
      if (l.quantity > it.available) throw new BadRequestException(`De «${it.name}» solo se pueden devolver ${it.available} unidad(es)`);
      out.push({ productId: it.productId, variantId: it.variantId ?? null, name: it.name, quantity: l.quantity, unitPrice: it.unitPrice });
    }
    return out;
  }

  // ───────────── Página pública ─────────────
  private async storeBySlug(slug: string) {
    const store = await this.db.query.businesses.findFirst({ where: and(eq(businesses.storeSlug, slug), eq(businesses.storeEnabled, true)) });
    if (!store) throw new NotFoundException('Esta tienda no está disponible');
    const cfg = (store.storeConfig ?? {}) as { returnsEnabled?: boolean; returnWindowDays?: number; returnsPolicy?: string };
    if (cfg.returnsEnabled === false) throw new BadRequestException('Esta tienda gestiona las devoluciones directamente por WhatsApp');
    return { store, windowDays: Math.max(1, Number(cfg.returnWindowDays ?? 30)), policy: cfg.returnsPolicy ?? '' };
  }

  private async findOrder(storeId: string, code: string, phone: string) {
    const clean = code.replace('#', '').toLowerCase();
    const rows = await this.db.select().from(storeOrders).where(and(eq(storeOrders.businessId, storeId), sql`${storeOrders.id}::text like ${clean + '%'}`)).limit(2);
    const order = rows.find((o) => samePhone(o.customerPhone, phone));
    // Mismo mensaje si no existe o si el celular no coincide: no revela pedidos de otras personas.
    if (!order) throw new NotFoundException('No encontramos un pedido con ese número y celular');
    return order;
  }

  async publicLookup(slug: string, dto: PublicLookupDto) {
    const { store, windowDays, policy } = await this.storeBySlug(slug);
    const order = await this.findOrder(store.id, dto.orderCode, dto.phone);
    const el = await this.eligible(store.id, 'STORE_ORDER', order.id);
    const deadline = order.deliveredAt ? new Date(order.deliveredAt.getTime() + windowDays * 86_400_000) : null;
    const existing = await this.db.select({ number: returns.number, status: returns.status, requestedAt: returns.requestedAt }).from(returns)
      .where(and(eq(returns.businessId, store.id), eq(returns.storeOrderId, order.id))).orderBy(desc(returns.requestedAt));
    let blocked = '';
    if (order.status === 'CANCELLED') blocked = 'Este pedido fue cancelado.';
    else if (order.status !== 'DELIVERED') blocked = 'Podrás solicitar la devolución cuando el pedido esté entregado.';
    else if (deadline && deadline < new Date()) blocked = `El plazo de ${windowDays} días para solicitar devoluciones de este pedido venció el ${deadline.toLocaleDateString('es-CO')}. Escríbenos si se trata de una garantía.`;
    else if (!el.items.some((i) => i.available > 0)) blocked = 'Todos los productos de este pedido ya tienen una devolución en curso.';
    return {
      order: { code: order.id.slice(0, 8), date: order.createdAt, deliveredAt: order.deliveredAt, status: order.status },
      items: el.items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, unitPrice: i.unitPrice, bought: i.bought, available: i.available })),
      deadline, windowDays, policy, blocked, reasons: RETURN_REASONS, existing,
    };
  }

  async publicRequest(slug: string, dto: PublicReturnDto) {
    const info = await this.publicLookup(slug, dto);
    if (info.blocked) throw new BadRequestException(info.blocked);
    const { store } = await this.storeBySlug(slug);
    const order = await this.findOrder(store.id, dto.orderCode, dto.phone);
    const el = await this.eligible(store.id, 'STORE_ORDER', order.id);
    const items = this.pick(el, dto.items);
    const created = await this.db.transaction(async (tx) => {
      const number = await this.nextNumber(tx, store.id);
      const [r] = await tx.insert(returns).values({
        businessId: store.id, number, source: 'STORE_ORDER', storeOrderId: order.id, saleId: order.saleId, customerId: order.customerId,
        customerName: order.customerName, customerPhone: order.customerPhone, reason: dto.reason, details: dto.details?.trim() || null,
        resolution: dto.resolution, status: 'REQUESTED', items,
      }).returning();
      await this.notifications.notify(store.id, 'RETURN_REQUESTED', `Solicitud de devolución #${number}`,
        `${order.customerName} · pedido #${order.id.slice(0, 8)} · ${RETURN_REASONS[dto.reason]}`, { returnId: r.id }, tx);
      return r;
    });
    return { number: created.number, status: created.status };
  }

  async publicStatus(slug: string, q: PublicStatusQuery) {
    const { store } = await this.storeBySlug(slug);
    const [r] = await this.db.select().from(returns).where(and(eq(returns.businessId, store.id), eq(returns.number, q.number))).limit(1);
    if (!r || !samePhone(r.customerPhone, q.phone)) throw new NotFoundException('No encontramos una devolución con ese número y celular');
    return { number: r.number, status: r.status, resolution: r.resolution, requestedAt: r.requestedAt, responseNote: r.responseNote,
      refundAmount: r.status === 'REFUNDED' ? r.refundAmount : null, items: r.items.map((i) => ({ name: i.name, quantity: i.quantity })) };
  }

  // ───────────── Panel ─────────────
  async list(businessId: string, status = 'OPEN') {
    const where = status === 'ALL' ? eq(returns.businessId, businessId)
      : status === 'OPEN' ? and(eq(returns.businessId, businessId), inArray(returns.status, OPEN))
        : and(eq(returns.businessId, businessId), eq(returns.status, status));
    const rows = await this.db.select().from(returns).where(where).orderBy(desc(returns.requestedAt)).limit(300);
    const saleIds = rows.map((r) => r.saleId).filter(Boolean) as string[];
    const saleNumbers = saleIds.length ? await this.db.select({ id: sales.id, number: sales.number }).from(sales).where(inArray(sales.id, saleIds)) : [];
    const [counts] = await this.db.select({
      requested: sql<number>`count(*) filter (where ${returns.status} = 'REQUESTED')::int`,
      open: sql<number>`count(*) filter (where ${returns.status} in ('REQUESTED','APPROVED','RECEIVED'))::int`,
      refundedMonth: sql<string>`coalesce(sum(${returns.refundAmount}) filter (where ${returns.status} = 'REFUNDED' and ${returns.resolvedAt} >= date_trunc('month', now())), 0)`,
    }).from(returns).where(eq(returns.businessId, businessId));
    return { items: rows.map((r) => ({ ...r, saleNumber: saleNumbers.find((s) => s.id === r.saleId)?.number ?? null, reasonLabel: RETURN_REASONS[r.reason as keyof typeof RETURN_REASONS] ?? r.reason })),
      summary: counts, reasons: RETURN_REASONS };
  }

  async create(ctx: RequestContext, dto: CreateReturnDto) {
    const el = await this.eligible(ctx.businessId, dto.source, dto.source === 'SALE' ? dto.saleId! : dto.storeOrderId!);
    if (dto.source === 'STORE_ORDER' && el.status !== 'DELIVERED') throw new BadRequestException('El pedido aún no está entregado. Si no se entregó, cancélalo desde Pedidos y envíos.');
    const items = this.pick(el, dto.items);
    return this.db.transaction(async (tx) => {
      const number = await this.nextNumber(tx, ctx.businessId);
      const [r] = await tx.insert(returns).values({
        businessId: ctx.businessId, number, source: dto.source, storeOrderId: el.storeOrderId, saleId: el.saleId, customerId: el.customerId,
        customerName: el.customerName, customerPhone: el.customerPhone, reason: dto.reason, details: dto.details?.trim() || null,
        resolution: dto.resolution, status: 'APPROVED', items, createdById: ctx.userId, approvedAt: new Date(),
      }).returning();
      return r;
    });
  }

  private async load(businessId: string, id: string) {
    const [r] = await this.db.select().from(returns).where(and(eq(returns.id, id), eq(returns.businessId, businessId))).limit(1);
    if (!r) throw new NotFoundException('Devolución no encontrada');
    return r;
  }
  private assert(r: { status: string }, allowed: string[], action: string) {
    if (!allowed.includes(r.status)) throw new BadRequestException(`No se puede ${action} una devolución en estado ${r.status}`);
  }

  async approve(businessId: string, id: string, note?: string) {
    const r = await this.load(businessId, id); this.assert(r, ['REQUESTED'], 'aprobar');
    const [u] = await this.db.update(returns).set({ status: 'APPROVED', approvedAt: new Date(), responseNote: note?.trim() || r.responseNote }).where(eq(returns.id, id)).returning();
    return u;
  }
  async reject(businessId: string, id: string, note?: string) {
    const r = await this.load(businessId, id); this.assert(r, ['REQUESTED', 'APPROVED'], 'rechazar');
    if (!note?.trim()) throw new BadRequestException('Escribe el motivo del rechazo: el cliente lo verá al consultar su devolución');
    const [u] = await this.db.update(returns).set({ status: 'REJECTED', resolvedAt: new Date(), responseNote: note.trim() }).where(eq(returns.id, id)).returning();
    return u;
  }

  /** El producto llegó: lo que está en buen estado vuelve al inventario (y a la variante). */
  async receive(ctx: RequestContext, id: string, dto: ReceiveDto) {
    const r = await this.load(ctx.businessId, id); this.assert(r, ['APPROVED'], 'recibir');
    return this.db.transaction(async (tx) => {
      const restock = new Set(dto.restock);
      const prods = await tx.select({ id: products.id, costPrice: products.costPrice }).from(products).where(inArray(products.id, r.items.map((i) => i.productId)));
      let cost = D(0);
      const items: ReturnItem[] = [];
      for (const it of r.items) {
        const back = restock.has(lineKey(it.productId, it.variantId));
        if (back) {
          const unitCost = prods.find((p) => p.id === it.productId)?.costPrice ?? '0';
          await this.inventory.move(tx, { businessId: ctx.businessId, productId: it.productId, delta: it.quantity, type: 'RETURN', unitCost,
            referenceType: 'RETURN', referenceId: r.id, userId: ctx.userId, note: `Devolución #${r.number}` });
          if (it.variantId) await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${it.quantity}` })
            .where(and(eq(productVariants.id, it.variantId), eq(productVariants.businessId, ctx.businessId)));
          cost = cost.plus(D(unitCost).mul(it.quantity));
        }
        items.push({ ...it, restock: back });
      }
      const [u] = await tx.update(returns).set({ status: 'RECEIVED', receivedAt: new Date(), items, restockedCost: m2(cost),
        responseNote: dto.note?.trim() || r.responseNote }).where(eq(returns.id, id)).returning();
      return u;
    });
  }

  async refund(ctx: RequestContext, id: string, dto: RefundDto) {
    const r = await this.load(ctx.businessId, id); this.assert(r, ['APPROVED', 'RECEIVED'], 'reembolsar');
    const max = r.items.reduce((a, i) => a.plus(D(i.unitPrice).mul(i.quantity)), D(0));
    const amount = D(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('El valor del reembolso debe ser mayor a cero');
    if (amount.gt(max)) throw new BadRequestException(`El reembolso no puede superar lo pagado por esos productos (${m2(max)})`);
    return this.db.transaction(async (tx) => {
      const [u] = await tx.update(returns).set({ status: 'REFUNDED', resolvedAt: new Date(), refundAmount: m2(amount), refundMethod: dto.method,
        refundReference: dto.reference?.trim() || null, responseNote: dto.note?.trim() || r.responseNote }).where(eq(returns.id, id)).returning();
      if (r.customerId) await tx.update(customers).set({ totalSpent: sql`greatest(${customers.totalSpent} - ${m2(amount)}, 0)` }).where(eq(customers.id, r.customerId));
      return u;
    });
  }

  async exchange(businessId: string, id: string, note?: string) {
    const r = await this.load(businessId, id); this.assert(r, ['APPROVED', 'RECEIVED'], 'cerrar como cambio');
    const [u] = await this.db.update(returns).set({ status: 'EXCHANGED', resolvedAt: new Date(), responseNote: note?.trim() || r.responseNote }).where(eq(returns.id, id)).returning();
    return u;
  }

  /** Para buscar la compra a devolver desde el panel. */
  async searchPurchases(businessId: string, q: string) {
    const term = q.trim();
    const n = Number(term.replace('#', ''));
    const saleRows = await this.db.select({ id: sales.id, number: sales.number, date: sales.date, total: sales.total, customer: customers.name })
      .from(sales).leftJoin(customers, eq(customers.id, sales.customerId))
      .where(and(eq(sales.businessId, businessId), ne(sales.status, 'CANCELLED'),
        Number.isInteger(n) && n > 0 ? eq(sales.number, n) : sql`${customers.name} ilike ${'%' + term + '%'}`))
      .orderBy(desc(sales.date)).limit(10);
    const orderRows = /^[0-9a-f#]{3,9}$/i.test(term) || term.length >= 3 ? await this.db.select({ id: storeOrders.id, date: storeOrders.createdAt, total: storeOrders.total, customer: storeOrders.customerName, status: storeOrders.status })
      .from(storeOrders).where(and(eq(storeOrders.businessId, businessId), eq(storeOrders.status, 'DELIVERED'), sql`${storeOrders.saleId} is null`,
        sql`(${storeOrders.id}::text like ${term.replace('#', '').toLowerCase() + '%'} or ${storeOrders.customerName} ilike ${'%' + term + '%'})`)).limit(10) : [];
    return [
      ...saleRows.map((s) => ({ source: 'SALE' as const, id: s.id, label: `Venta #${s.number}`, date: s.date, total: s.total, customer: s.customer })),
      ...orderRows.map((o) => ({ source: 'STORE_ORDER' as const, id: o.id, label: `Pedido web #${o.id.slice(0, 8)}`, date: o.date, total: o.total, customer: o.customer })),
    ];
  }
}

@Controller()
class ReturnsController {
  constructor(private service: ReturnsService) {}

  @Public() @Post('store/:slug/returns/lookup') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  lookup(@Param('slug') slug: string, @Body() dto: PublicLookupDto) { return this.service.publicLookup(slug, dto); }
  @Public() @Post('store/:slug/returns') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  request(@Param('slug') slug: string, @Body() dto: PublicReturnDto) { return this.service.publicRequest(slug, dto); }
  @Public() @Get('store/:slug/returns/status') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  status(@Param('slug') slug: string, @Query() q: PublicStatusQuery) { return this.service.publicStatus(slug, q); }

  @RequirePermissions('sales:read') @Get('returns') list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) { return this.service.list(ctx.businessId, q.status); }
  @RequirePermissions('sales:read') @Get('returns/purchases') purchases(@Ctx() ctx: RequestContext, @Query('q') q = '') { return this.service.searchPurchases(ctx.businessId, String(q).slice(0, 80)); }
  @RequirePermissions('sales:read') @Get('returns/eligible') eligible(@Ctx() ctx: RequestContext, @Query() q: EligibleQuery) { return this.service.eligible(ctx.businessId, q.source, q.id); }
  @RequirePermissions('sales:create') @Post('returns') create(@Ctx() ctx: RequestContext, @Body() dto: CreateReturnDto) { return this.service.create(ctx, dto); }
  @RequirePermissions('sales:create') @Patch('returns/:id/approve') approve(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) { return this.service.approve(ctx.businessId, id, dto.note); }
  @RequirePermissions('sales:create') @Patch('returns/:id/reject') reject(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) { return this.service.reject(ctx.businessId, id, dto.note); }
  @RequirePermissions('sales:create') @Patch('returns/:id/receive') receive(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveDto) { return this.service.receive(ctx, id, dto); }
  @RequirePermissions('finance:write') @Patch('returns/:id/refund') refund(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundDto) { return this.service.refund(ctx, id, dto); }
  @RequirePermissions('sales:create') @Patch('returns/:id/exchange') exchange(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) { return this.service.exchange(ctx.businessId, id, dto.note); }
}

@Module({ imports: [InventoryModule], controllers: [ReturnsController], providers: [ReturnsService] })
export class ReturnsModule {}
