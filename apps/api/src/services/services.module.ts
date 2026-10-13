import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { randomInt } from 'node:crypto';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { D, m2, num } from '../common/money';
import { Db, InjectDb } from '../db/db';
import {
  appointments, businesses, customers, jobEvents, jobItems, jobs, memberships, products, saleItems, salePayments, sales, users,
} from '../db/schema';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';

export const JOB_STATUSES = ['QUOTE', 'OPEN', 'IN_PROGRESS', 'WAITING', 'READY', 'DELIVERED', 'CANCELLED'] as const;
type JobStatus = typeof JOB_STATUSES[number];
const CLOSED: JobStatus[] = ['DELIVERED', 'CANCELLED'];
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'PSE', 'NEQUI', 'DAVIPLATA', 'OTHER'] as const;
const CHANNELS = ['INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'TIKTOK', 'WEBSITE', 'PHYSICAL_STORE', 'MARKETPLACE', 'OTHER'] as const;
const MONEY = /^\d{1,12}(?:\.\d{1,2})?$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

class JobItemDto {
  @IsOptional() @IsUUID() productId?: string | null;
  @IsIn(['SERVICE', 'PART', 'FEE', 'EXPENSE']) kind: 'SERVICE' | 'PART' | 'FEE' | 'EXPENSE';
  @IsString() @Length(1, 200) description: string;
  @Matches(/^\d{1,6}(?:\.\d{1,2})?$/) quantity: string;
  @Matches(MONEY) unitPrice: string;
}
class JobDto {
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsString() @Length(2, 200) title: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsIn(JOB_STATUSES) status?: JobStatus;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional() @IsUUID() assignedUserId?: string | null;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsObject() details?: Record<string, string>;
  @IsOptional() @Matches(ISO) dueAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) warrantyDays?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => JobItemDto) items?: JobItemDto[];
}
class UpdateJobDto {
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsOptional() @IsString() @Length(2, 200) title?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional() @IsUUID() assignedUserId?: string | null;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsObject() details?: Record<string, string>;
  @IsOptional() @Matches(ISO) dueAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) warrantyDays?: number;
}
class ItemsDto { @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => JobItemDto) items: JobItemDto[]; }
class StatusDto {
  @IsIn(JOB_STATUSES) status: JobStatus;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsBoolean() visibleToCustomer?: boolean;
  /** Nombre del estado tal como lo ve este negocio (ej. «En trámite» para abogados). */
  @IsOptional() @IsString() @MaxLength(60) label?: string;
}
class EventDto {
  @IsIn(['NOTE', 'TIME']) type: 'NOTE' | 'TIME';
  @IsString() @Length(1, 4000) body: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) minutes?: number;
  @IsOptional() @IsBoolean() billable?: boolean;
  @IsOptional() @IsBoolean() visibleToCustomer?: boolean;
  @IsOptional() @Matches(ISO) occurredAt?: string;
}
class QuoteDto { @IsIn(['SENT', 'APPROVED', 'REJECTED']) quoteStatus: 'SENT' | 'APPROVED' | 'REJECTED'; }
class ChargeDto {
  @IsIn(PAYMENT_METHODS) paymentMethod: typeof PAYMENT_METHODS[number];
  @Matches(MONEY) amountPaid: string;
  @IsOptional() @IsIn(CHANNELS) channel?: typeof CHANNELS[number];
  @IsOptional() @Matches(MONEY) discount?: string;
}
class JobQuery {
  @IsOptional() @IsIn(['ACTIVE', 'ALL', ...JOB_STATUSES]) status?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsUUID() customerId?: string;
}
class AppointmentDto {
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsOptional() @IsString() @MaxLength(160) customerName?: string;
  @IsOptional() @IsString() @MaxLength(40) customerPhone?: string;
  @IsOptional() @IsUUID() productId?: string | null;
  @IsOptional() @IsUUID() jobId?: string | null;
  @IsOptional() @IsUUID() assignedUserId?: string | null;
  @IsString() @Length(2, 200) title: string;
  @Matches(ISO) startsAt: string;
  @Matches(ISO) endsAt: string;
  @IsOptional() @IsIn(['SCHEDULED', 'CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW']) status?: string;
  @IsOptional() @IsIn(['IN_PERSON', 'VIRTUAL', 'AT_HOME']) modality?: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsBoolean() allowOverlap?: boolean;
}
class AppointmentStatusDto { @IsIn(['SCHEDULED', 'CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW']) status: string; }
class RangeQuery { @Matches(ISO) from: string; @Matches(ISO) to: string; }
class TrackQuery { @IsString() @Matches(/^[A-Za-z0-9]{6,12}$/) code: string; @IsString() @Length(7, 40) phone: string; }

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const trackingCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const digits = (s?: string | null) => String(s ?? '').replace(/\D/g, '');
const samePhone = (a?: string | null, b?: string | null) => { const x = digits(a); const y = digits(b); return x.length >= 7 && y.length >= 7 && (x.endsWith(y.slice(-10)) || y.endsWith(x.slice(-10))); };

@Injectable()
export class ServicesService {
  constructor(@InjectDb() private db: Db, private inventory: InventoryService, private notifications: NotificationsService) {}

  // ───────────── Casos / órdenes de servicio ─────────────
  private async assertRefs(businessId: string, dto: { customerId?: string | null; assignedUserId?: string | null; items?: JobItemDto[] }) {
    if (dto.customerId) {
      const c = await this.db.query.customers.findFirst({ where: and(eq(customers.id, dto.customerId), eq(customers.businessId, businessId)), columns: { id: true } });
      if (!c) throw new BadRequestException('Cliente inválido');
    }
    if (dto.assignedUserId) {
      const m = await this.db.query.memberships.findFirst({ where: and(eq(memberships.userId, dto.assignedUserId), eq(memberships.businessId, businessId)), columns: { id: true } });
      if (!m) throw new BadRequestException('Esa persona no hace parte del equipo');
    }
    const ids = [...new Set((dto.items ?? []).map((i) => i.productId).filter(Boolean))] as string[];
    if (ids.length) {
      const found = await this.db.select({ id: products.id }).from(products).where(and(eq(products.businessId, businessId), inArray(products.id, ids)));
      if (found.length !== ids.length) throw new BadRequestException('Uno de los servicios o repuestos no existe');
    }
  }
  private cleanDetails(d?: Record<string, string>) {
    if (!d) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(d).slice(0, 40)) if (/^[a-zA-Z0-9_]{1,40}$/.test(k) && v != null) out[k] = String(v).slice(0, 1000);
    return out;
  }

  async list(businessId: string, q: JobQuery) {
    const status = q.status ?? 'ACTIVE';
    const term = q.q?.trim();
    const where = and(eq(jobs.businessId, businessId),
      status === 'ALL' ? undefined : status === 'ACTIVE' ? sql`${jobs.status} not in ('DELIVERED','CANCELLED')` : eq(jobs.status, status),
      q.customerId ? eq(jobs.customerId, q.customerId) : undefined,
      term ? or(ilike(jobs.title, `%${term}%`), ilike(customers.name, `%${term}%`), sql`${jobs.details}::text ilike ${'%' + term + '%'}`, eq(jobs.trackingCode, term.toUpperCase()),
        Number.isInteger(Number(term)) ? eq(jobs.number, Number(term)) : undefined) : undefined);
    const total = sql<string>`coalesce((select sum(${jobItems.quantity} * ${jobItems.unitPrice}) from ${jobItems} where ${jobItems.jobId} = "jobs"."id"), 0)`;
    const rows = await this.db.select({ id: jobs.id, number: jobs.number, trackingCode: jobs.trackingCode, title: jobs.title, category: jobs.category, status: jobs.status,
      priority: jobs.priority, dueAt: jobs.dueAt, quoteStatus: jobs.quoteStatus, saleId: jobs.saleId, details: jobs.details, createdAt: jobs.createdAt, updatedAt: jobs.updatedAt,
      customerId: jobs.customerId, customerName: customers.name, customerPhone: customers.phone, assignedUserId: jobs.assignedUserId, assignedName: users.fullName, total })
      .from(jobs).leftJoin(customers, eq(customers.id, jobs.customerId)).leftJoin(users, eq(users.id, jobs.assignedUserId))
      .where(where).orderBy(sql`case ${jobs.priority} when 'URGENT' then 0 when 'HIGH' then 1 else 2 end`, sql`${jobs.dueAt} asc nulls last`, desc(jobs.updatedAt)).limit(300);
    const counts = await this.db.select({ status: jobs.status, n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.businessId, businessId)).groupBy(jobs.status);
    return { items: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
  }

  async get(businessId: string, id: string) {
    const [j] = await this.db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.businessId, businessId))).limit(1);
    if (!j) throw new NotFoundException('No encontramos ese registro');
    const [items, events, customer, appts, sale] = await Promise.all([
      this.db.select().from(jobItems).where(eq(jobItems.jobId, id)).orderBy(asc(jobItems.createdAt)),
      this.db.select({ e: jobEvents, userName: users.fullName }).from(jobEvents).leftJoin(users, eq(users.id, jobEvents.userId)).where(eq(jobEvents.jobId, id)).orderBy(desc(jobEvents.occurredAt)),
      j.customerId ? this.db.query.customers.findFirst({ where: eq(customers.id, j.customerId) }) : null,
      this.db.select().from(appointments).where(and(eq(appointments.jobId, id), eq(appointments.businessId, businessId))).orderBy(asc(appointments.startsAt)),
      j.saleId ? this.db.query.sales.findFirst({ where: eq(sales.id, j.saleId), columns: { id: true, number: true, total: true, amountPaid: true, status: true } }) : null,
    ]);
    const assigned = j.assignedUserId ? await this.db.query.users.findFirst({ where: eq(users.id, j.assignedUserId), columns: { fullName: true } }) : null;
    const total = items.reduce((a, i) => a.plus(D(i.unitPrice).mul(i.quantity)), D(0));
    const minutes = events.filter((x) => x.e.type === 'TIME').reduce((a, x) => a + (x.e.minutes ?? 0), 0);
    const billableMinutes = events.filter((x) => x.e.type === 'TIME' && x.e.billable).reduce((a, x) => a + (x.e.minutes ?? 0), 0);
    return { ...j, assignedName: assigned?.fullName ?? null, customer, items, total: m2(total), sale, appointments: appts, minutes, billableMinutes,
      events: events.map((x) => ({ ...x.e, userName: x.userName })) };
  }

  private async nextNumber(tx: any, businessId: string) {
    await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).for('update');
    const [r] = await tx.select({ n: sql<number>`coalesce(max(${jobs.number}), 0)::int + 1` }).from(jobs).where(eq(jobs.businessId, businessId));
    return r.n as number;
  }

  async create(ctx: RequestContext, dto: JobDto) {
    await this.assertRefs(ctx.businessId, dto);
    const id = await this.db.transaction(async (tx) => {
      const number = await this.nextNumber(tx, ctx.businessId);
      let code = trackingCode();
      for (let i = 0; i < 5; i++) {
        const [dup] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.businessId, ctx.businessId), eq(jobs.trackingCode, code))).limit(1);
        if (!dup) break; code = trackingCode();
      }
      const status = dto.status ?? 'OPEN';
      const [j] = await tx.insert(jobs).values({ businessId: ctx.businessId, number, trackingCode: code, customerId: dto.customerId ?? null, title: dto.title.trim(),
        category: dto.category?.trim() || null, status, priority: dto.priority ?? 'NORMAL', assignedUserId: dto.assignedUserId ?? null,
        description: dto.description?.trim() || null, details: this.cleanDetails(dto.details) ?? {}, dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        warrantyDays: dto.warrantyDays ?? 0, createdById: ctx.userId, quoteStatus: status === 'QUOTE' ? 'NONE' : 'NONE' }).returning();
      if (dto.items?.length) await tx.insert(jobItems).values(dto.items.map((i) => ({ jobId: j.id, productId: i.productId ?? null, kind: i.kind, description: i.description.trim(), quantity: i.quantity, unitPrice: m2(i.unitPrice) })));
      await tx.insert(jobEvents).values({ jobId: j.id, businessId: ctx.businessId, type: 'STATUS', body: 'Registro creado', visibleToCustomer: true, userId: ctx.userId });
      return j.id;
    });
    return this.get(ctx.businessId, id);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateJobDto) {
    await this.get(ctx.businessId, id);
    await this.assertRefs(ctx.businessId, dto);
    const { dueAt, details, ...rest } = dto;
    await this.db.update(jobs).set({ ...rest, ...(details !== undefined ? { details: this.cleanDetails(details) } : {}),
      ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}) }).where(and(eq(jobs.id, id), eq(jobs.businessId, ctx.businessId)));
    return this.get(ctx.businessId, id);
  }

  async setItems(ctx: RequestContext, id: string, dto: ItemsDto) {
    const j = await this.get(ctx.businessId, id);
    if (j.saleId) throw new BadRequestException('Este registro ya se cobró. Para cambiar valores, anula la venta primero.');
    await this.assertRefs(ctx.businessId, dto);
    await this.db.transaction(async (tx) => {
      await tx.delete(jobItems).where(eq(jobItems.jobId, id));
      if (dto.items.length) await tx.insert(jobItems).values(dto.items.map((i) => ({ jobId: id, productId: i.productId ?? null, kind: i.kind, description: i.description.trim(), quantity: i.quantity, unitPrice: m2(i.unitPrice) })));
      await tx.update(jobs).set({ updatedAt: new Date() }).where(eq(jobs.id, id));
    });
    return this.get(ctx.businessId, id);
  }

  async setStatus(ctx: RequestContext, id: string, dto: StatusDto, labels?: Record<string, string>) {
    const j = await this.get(ctx.businessId, id);
    if (j.status === dto.status) return j;
    await this.db.transaction(async (tx) => {
      await tx.update(jobs).set({ status: dto.status, closedAt: CLOSED.includes(dto.status) ? new Date() : null }).where(eq(jobs.id, id));
      await tx.insert(jobEvents).values({ jobId: id, businessId: ctx.businessId, type: 'STATUS', userId: ctx.userId, visibleToCustomer: dto.visibleToCustomer ?? true,
        body: `Estado: ${dto.label?.trim() || labels?.[dto.status] || dto.status}${dto.note?.trim() ? ` — ${dto.note.trim()}` : ''}` });
    });
    return this.get(ctx.businessId, id);
  }

  async addEvent(ctx: RequestContext, id: string, dto: EventDto) {
    await this.get(ctx.businessId, id);
    if (dto.type === 'TIME' && !dto.minutes) throw new BadRequestException('Indica cuántos minutos trabajaste');
    await this.db.insert(jobEvents).values({ jobId: id, businessId: ctx.businessId, type: dto.type, body: dto.body.trim(), minutes: dto.type === 'TIME' ? dto.minutes : null,
      billable: dto.type === 'TIME' ? dto.billable ?? true : false, visibleToCustomer: dto.visibleToCustomer ?? false, userId: ctx.userId,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date() });
    await this.db.update(jobs).set({ updatedAt: new Date() }).where(eq(jobs.id, id));
    return this.get(ctx.businessId, id);
  }

  async deleteEvent(ctx: RequestContext, id: string, eventId: string) {
    await this.db.delete(jobEvents).where(and(eq(jobEvents.id, eventId), eq(jobEvents.jobId, id), eq(jobEvents.businessId, ctx.businessId), ne(jobEvents.type, 'STATUS')));
    return this.get(ctx.businessId, id);
  }

  async quote(ctx: RequestContext, id: string, dto: QuoteDto) {
    const j = await this.get(ctx.businessId, id);
    if (!j.items.length) throw new BadRequestException('Agrega al menos un concepto con su valor antes de cotizar');
    const now = new Date();
    const text = dto.quoteStatus === 'SENT' ? `Cotización enviada por ${Number(j.total).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}`
      : dto.quoteStatus === 'APPROVED' ? 'El cliente aprobó la cotización' : 'El cliente no aprobó la cotización';
    await this.db.transaction(async (tx) => {
      await tx.update(jobs).set({ quoteStatus: dto.quoteStatus, ...(dto.quoteStatus === 'SENT' ? { quoteSentAt: now } : { quoteDecidedAt: now }),
        ...(dto.quoteStatus === 'APPROVED' && j.status === 'QUOTE' ? { status: 'OPEN' } : {}) }).where(eq(jobs.id, id));
      await tx.insert(jobEvents).values({ jobId: id, businessId: ctx.businessId, type: 'QUOTE', body: text, visibleToCustomer: true, userId: ctx.userId });
    });
    return this.get(ctx.businessId, id);
  }

  /** Producto comodín para cobrar conceptos escritos a mano (honorarios, mano de obra…). */
  private async genericService(tx: any, businessId: string) {
    const [found] = await tx.select({ id: products.id }).from(products).where(and(eq(products.businessId, businessId), eq(products.sku, 'SRV-CONCEPTO'))).limit(1);
    if (found) return found.id as string;
    const [p] = await tx.insert(products).values({ businessId, sku: 'SRV-CONCEPTO', name: 'Servicio (concepto libre)', costPrice: '0', salePrice: '0', isService: true, isActive: false }).returning({ id: products.id });
    return p.id as string;
  }

  /** Cobrar: crea la venta con los conceptos del caso u orden. Los repuestos sí descuentan inventario. */
  async charge(ctx: RequestContext, id: string, dto: ChargeDto) {
    const j = await this.get(ctx.businessId, id);
    if (j.saleId) throw new ConflictException('Este registro ya tiene un cobro');
    if (!j.items.length) throw new BadRequestException('Agrega los conceptos a cobrar');
    const prodIds = j.items.map((i) => i.productId).filter(Boolean) as string[];
    const prods = prodIds.length ? await this.db.select().from(products).where(inArray(products.id, prodIds)) : [];
    const lines = j.items.map((i) => {
      const p = prods.find((x) => x.id === i.productId);
      const qty = Number(i.quantity);
      return { item: i, p, qty, gross: D(i.unitPrice).mul(i.quantity), unitCost: p?.costPrice ?? '0' };
    });
    if (lines.some((l) => !Number.isInteger(l.qty) && l.p && !l.p.isService)) throw new BadRequestException('Los repuestos se cobran en unidades enteras');
    const subtotal = lines.reduce((a, l) => a.plus(l.gross), D(0));
    const discount = D(dto.discount ?? 0);
    if (discount.gt(subtotal)) throw new BadRequestException('El descuento no puede superar el total');
    const total = subtotal.minus(discount);
    const paid = D(dto.amountPaid);
    if (paid.gt(total)) throw new BadRequestException('El valor pagado no puede superar el total');
    const status = paid.gte(total) ? 'PAID' : paid.gt(0) ? 'PARTIALLY_PAID' : 'PENDING';
    const saleId = await this.db.transaction(async (tx) => {
      const [{ number }] = await tx.update(businesses).set({ nextSaleNumber: sql`${businesses.nextSaleNumber} + 1` })
        .where(eq(businesses.id, ctx.businessId)).returning({ number: sql<number>`${businesses.nextSaleNumber} - 1` });
      const costTotal = lines.reduce((a, l) => a.plus(D(l.unitCost).mul(l.qty)), D(0));
      const [s] = await tx.insert(sales).values({ businessId: ctx.businessId, number, customerId: j.customerId, date: new Date(), channel: dto.channel ?? 'PHYSICAL_STORE',
        paymentMethod: dto.paymentMethod, status, subtotal: m2(subtotal), discountTotal: m2(discount), taxTotal: '0.00', total: m2(total), amountPaid: m2(paid),
        costTotal: m2(costTotal), createdById: ctx.userId, notes: `${j.title} · registro #${j.number}` }).returning();
      let allocated = D(0);
      for (const [idx, l] of lines.entries()) {
        const share = idx === lines.length - 1 ? discount.minus(allocated) : subtotal.isZero() ? D(0) : discount.mul(l.gross).div(subtotal).toDecimalPlaces(2);
        allocated = allocated.plus(share);
        // La venta guarda unidades enteras: horas fraccionadas se cobran como 1 línea con el valor total.
        const wholeQty = Number.isInteger(l.qty) ? l.qty : 1;
        const unit = Number.isInteger(l.qty) ? D(l.item.unitPrice) : l.gross;
        const productId = l.p?.id ?? await this.genericService(tx, ctx.businessId);
        const description = (Number.isInteger(l.qty) ? l.item.description : `${l.item.description} (${l.qty})`).slice(0, 200);
        await tx.insert(saleItems).values({ saleId: s.id, productId, description, quantity: wholeQty, unitPrice: m2(unit), unitCost: m2(l.unitCost),
          discount: m2(share), taxRate: '0', lineTax: '0.00', lineTotal: m2(l.gross.minus(share)) });
        if (l.p && !l.p.isService) {
          const q = await this.inventory.move(tx, { businessId: ctx.businessId, productId: l.p.id, delta: -wholeQty, type: 'SALE', unitCost: l.p.costPrice,
            referenceType: 'SALE', referenceId: s.id, userId: ctx.userId, note: `Venta #${number} (${j.title})` });
          await this.inventory.checkLowStock(tx, ctx.businessId, l.p.id, q, -wholeQty);
        }
      }
      if (paid.gt(0)) await tx.insert(salePayments).values({ saleId: s.id, amount: m2(paid), method: dto.paymentMethod });
      if (j.customerId) await tx.update(customers).set({ purchaseCount: sql`${customers.purchaseCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${m2(total)}`,
        firstPurchaseAt: sql`coalesce(${customers.firstPurchaseAt}, now())`, lastPurchaseAt: new Date() }).where(eq(customers.id, j.customerId));
      await tx.update(jobs).set({ saleId: s.id }).where(eq(jobs.id, id));
      await tx.insert(jobEvents).values({ jobId: id, businessId: ctx.businessId, type: 'PAYMENT', userId: ctx.userId, visibleToCustomer: true,
        body: `Cobro registrado (venta #${number}): ${m2(total)}${paid.lt(total) ? ` · abonado ${m2(paid)}, saldo ${m2(total.minus(paid))}` : ' · pagado'}` });
      await this.notifications.notify(ctx.businessId, 'NEW_SALE', `Nueva venta #${number}`, `${j.title} · ${m2(total)}`, { saleId: s.id }, tx);
      if (status !== 'PAID') await this.notifications.notify(ctx.businessId, 'PENDING_ACCOUNT', `Venta #${number} con saldo pendiente`, `Saldo por cobrar: ${m2(total.minus(paid))}`, { saleId: s.id }, tx);
      return s.id;
    });
    return { ...(await this.get(ctx.businessId, id)), saleId };
  }

  // ───────────── Seguimiento público (página web) ─────────────
  async track(slug: string, q: TrackQuery) {
    const store = await this.db.query.businesses.findFirst({ where: and(eq(businesses.storeSlug, slug), eq(businesses.storeEnabled, true)), columns: { id: true } });
    if (!store) throw new NotFoundException('Esta página no está disponible');
    const [row] = await this.db.select({ j: jobs, phone: customers.phone }).from(jobs).leftJoin(customers, eq(customers.id, jobs.customerId))
      .where(and(eq(jobs.businessId, store.id), eq(jobs.trackingCode, q.code.toUpperCase()))).limit(1);
    if (!row || !samePhone(row.phone, q.phone)) throw new NotFoundException('No encontramos un registro con ese código y celular');
    const events = await this.db.select({ body: jobEvents.body, occurredAt: jobEvents.occurredAt, type: jobEvents.type }).from(jobEvents)
      .where(and(eq(jobEvents.jobId, row.j.id), eq(jobEvents.visibleToCustomer, true))).orderBy(desc(jobEvents.occurredAt)).limit(30);
    const items = await this.db.select({ description: jobItems.description, quantity: jobItems.quantity, unitPrice: jobItems.unitPrice }).from(jobItems).where(eq(jobItems.jobId, row.j.id));
    const nextAppt = await this.db.select({ title: appointments.title, startsAt: appointments.startsAt, modality: appointments.modality, location: appointments.location }).from(appointments)
      .where(and(eq(appointments.jobId, row.j.id), gte(appointments.startsAt, new Date()), inArray(appointments.status, ['SCHEDULED', 'CONFIRMED']))).orderBy(asc(appointments.startsAt)).limit(1);
    return { number: row.j.number, title: row.j.title, status: row.j.status, dueAt: row.j.dueAt, quoteStatus: row.j.quoteStatus, warrantyDays: row.j.warrantyDays, closedAt: row.j.closedAt,
      quote: row.j.quoteStatus === 'SENT' || row.j.quoteStatus === 'APPROVED' ? { items, total: m2(items.reduce((a, i) => a.plus(D(i.unitPrice).mul(i.quantity)), D(0))) } : null,
      nextAppointment: nextAppt[0] ?? null, events };
  }

  // ───────────── Agenda ─────────────
  async listAppointments(businessId: string, q: RangeQuery) {
    return this.db.select({ a: appointments, customerName: customers.name, customerPhoneDb: customers.phone, assignedName: users.fullName, productName: products.name, jobNumber: jobs.number, jobTitle: jobs.title })
      .from(appointments).leftJoin(customers, eq(customers.id, appointments.customerId)).leftJoin(users, eq(users.id, appointments.assignedUserId))
      .leftJoin(products, eq(products.id, appointments.productId)).leftJoin(jobs, eq(jobs.id, appointments.jobId))
      .where(and(eq(appointments.businessId, businessId), gte(appointments.startsAt, new Date(q.from)), lt(appointments.startsAt, new Date(q.to))))
      .orderBy(asc(appointments.startsAt)).limit(1000)
      .then((rows) => rows.map((r) => ({ ...r.a, customerName: r.customerName ?? r.a.customerName, customerPhone: r.customerPhoneDb ?? r.a.customerPhone,
        assignedName: r.assignedName, productName: r.productName, jobNumber: r.jobNumber, jobTitle: r.jobTitle })));
  }

  private async assertAppointment(businessId: string, dto: AppointmentDto, ignoreId?: string) {
    const starts = new Date(dto.startsAt); const ends = new Date(dto.endsAt);
    if (!(ends > starts)) throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    if (ends.getTime() - starts.getTime() > 24 * 3600_000) throw new BadRequestException('Una cita no puede durar más de 24 horas');
    await this.assertRefs(businessId, dto);
    if (dto.productId) await this.assertRefs(businessId, { items: [{ productId: dto.productId } as any] });
    if (dto.jobId) { const [j] = await this.db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, dto.jobId), eq(jobs.businessId, businessId))).limit(1); if (!j) throw new BadRequestException('Registro inválido'); }
    if (!dto.allowOverlap && dto.status !== 'CANCELLED') {
      const overlap = await this.db.select({ title: appointments.title, startsAt: appointments.startsAt }).from(appointments).where(and(eq(appointments.businessId, businessId),
        inArray(appointments.status, ['SCHEDULED', 'CONFIRMED']), lt(appointments.startsAt, ends), sql`${appointments.endsAt} > ${starts}`,
        dto.assignedUserId ? eq(appointments.assignedUserId, dto.assignedUserId) : isNull(appointments.assignedUserId),
        ignoreId ? ne(appointments.id, ignoreId) : undefined)).limit(1);
      if (overlap.length) throw new ConflictException(`Se cruza con «${overlap[0].title}» a las ${overlap[0].startsAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}. Cambia la hora o confirma que quieres agendarla igual.`);
    }
    return { starts, ends };
  }
  private apptValues(dto: AppointmentDto, starts: Date, ends: Date) {
    return { customerId: dto.customerId ?? null, customerName: dto.customerName?.trim() || null, customerPhone: dto.customerPhone?.trim() || null,
      productId: dto.productId ?? null, jobId: dto.jobId ?? null, assignedUserId: dto.assignedUserId ?? null, title: dto.title.trim(), startsAt: starts, endsAt: ends,
      status: dto.status ?? 'SCHEDULED', modality: dto.modality ?? 'IN_PERSON', location: dto.location?.trim() || null, notes: dto.notes?.trim() || null };
  }
  async createAppointment(ctx: RequestContext, dto: AppointmentDto) {
    const { starts, ends } = await this.assertAppointment(ctx.businessId, dto);
    const [a] = await this.db.insert(appointments).values({ businessId: ctx.businessId, ...this.apptValues(dto, starts, ends) }).returning();
    if (a.jobId) await this.db.insert(jobEvents).values({ jobId: a.jobId, businessId: ctx.businessId, type: 'NOTE', visibleToCustomer: true, userId: ctx.userId,
      body: `Agendado: ${a.title} · ${starts.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })}` });
    return a;
  }
  async updateAppointment(ctx: RequestContext, id: string, dto: AppointmentDto) {
    const [cur] = await this.db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.businessId))).limit(1);
    if (!cur) throw new NotFoundException('Cita no encontrada');
    const { starts, ends } = await this.assertAppointment(ctx.businessId, dto, id);
    const [a] = await this.db.update(appointments).set(this.apptValues(dto, starts, ends)).where(eq(appointments.id, id)).returning();
    return a;
  }
  async appointmentStatus(ctx: RequestContext, id: string, status: string) {
    const [a] = await this.db.update(appointments).set({ status }).where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.businessId))).returning();
    if (!a) throw new NotFoundException('Cita no encontrada');
    return a;
  }
  async deleteAppointment(ctx: RequestContext, id: string) {
    await this.db.delete(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.businessId)));
    return { ok: true };
  }

  async team(businessId: string) {
    return this.db.select({ userId: users.id, fullName: users.fullName }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.businessId, businessId), eq(memberships.status, 'ACTIVE'))).orderBy(asc(users.fullName));
  }

  // ───────────── Dashboard de servicios ─────────────
  async dashboard(ctx: RequestContext) {
    const b = ctx.businessId;
    const now = new Date();
    const bog = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const dayStart = new Date(Date.UTC(bog.getFullYear(), bog.getMonth(), bog.getDate(), 5));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const monthStart = new Date(Date.UTC(bog.getFullYear(), bog.getMonth(), 1, 5));
    const prevMonthStart = new Date(Date.UTC(bog.getFullYear(), bog.getMonth() - 1, 1, 5));
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
    const salesIn = (from: Date, to: Date) => and(eq(sales.businessId, b), gte(sales.date, from), lt(sales.date, to), isNull(sales.cancelledAt));
    const [today, counts, dueSoon, ready, [month], [prev], [recv], topServices, [hours], monthly] = await Promise.all([
      this.listAppointments(b, { from: dayStart.toISOString(), to: dayEnd.toISOString() }),
      this.db.select({ status: jobs.status, n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.businessId, b)).groupBy(jobs.status),
      this.db.select({ id: jobs.id, number: jobs.number, title: jobs.title, dueAt: jobs.dueAt, status: jobs.status, customerName: customers.name }).from(jobs).leftJoin(customers, eq(customers.id, jobs.customerId))
        .where(and(eq(jobs.businessId, b), sql`${jobs.status} not in ('DELIVERED','CANCELLED')`, lt(jobs.dueAt, weekAhead))).orderBy(asc(jobs.dueAt)).limit(8),
      this.db.select({ id: jobs.id, number: jobs.number, title: jobs.title, customerName: customers.name, customerPhone: customers.phone, trackingCode: jobs.trackingCode }).from(jobs)
        .leftJoin(customers, eq(customers.id, jobs.customerId)).where(and(eq(jobs.businessId, b), eq(jobs.status, 'READY'))).orderBy(desc(jobs.updatedAt)).limit(8),
      this.db.select({ total: sql<string>`coalesce(sum(${sales.total}),0)`, n: sql<number>`count(*)::int` }).from(sales).where(salesIn(monthStart, dayEnd)),
      this.db.select({ total: sql<string>`coalesce(sum(${sales.total}),0)` }).from(sales).where(salesIn(prevMonthStart, new Date(Math.min(monthStart.getTime(), prevMonthStart.getTime() + (dayEnd.getTime() - monthStart.getTime()))))),
      this.db.select({ total: sql<string>`coalesce(sum(${sales.total} - ${sales.amountPaid}),0)`, n: sql<number>`count(*)::int` }).from(sales)
        .where(and(eq(sales.businessId, b), isNull(sales.cancelledAt), inArray(sales.status, ['PENDING', 'PARTIALLY_PAID']))),
      this.db.select({ name: saleItems.description, revenue: sql<string>`sum(${saleItems.lineTotal})`, n: sql<number>`count(*)::int` }).from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId)).where(salesIn(new Date(now.getTime() - 90 * 86_400_000), dayEnd))
        .groupBy(saleItems.description).orderBy(desc(sql`sum(${saleItems.lineTotal})`)).limit(6),
      this.db.select({ total: sql<number>`coalesce(sum(${jobEvents.minutes}),0)::int`, billable: sql<number>`coalesce(sum(${jobEvents.minutes}) filter (where ${jobEvents.billable}),0)::int` })
        .from(jobEvents).where(and(eq(jobEvents.businessId, b), eq(jobEvents.type, 'TIME'), gte(jobEvents.occurredAt, monthStart))),
      this.db.select({ month: sql<string>`to_char(${sales.date} at time zone 'America/Bogota', 'YYYY-MM')`, total: sql<string>`sum(${sales.total})` }).from(sales)
        .where(salesIn(new Date(Date.UTC(bog.getFullYear(), bog.getMonth() - 5, 1, 5)), dayEnd)).groupBy(sql`1`).orderBy(sql`1`),
    ]);
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n]));
    const active = ['QUOTE', 'OPEN', 'IN_PROGRESS', 'WAITING', 'READY'].reduce((a, k) => a + (byStatus[k] ?? 0), 0);
    return { today, byStatus, active, dueSoon, ready, revenueMonth: num(month.total), salesMonth: month.n, revenuePrevMonth: num(prev.total),
      receivables: num(recv.total), receivablesCount: recv.n, topServices: topServices.map((t) => ({ ...t, revenue: num(t.revenue) })),
      minutesMonth: hours.total, billableMinutesMonth: hours.billable, monthly: monthly.map((m) => ({ month: m.month, total: num(m.total) })) };
  }
}

@Controller()
class ServicesController {
  constructor(private s: ServicesService) {}
  @RequirePermissions('sales:read') @Get('jobs') list(@Ctx() ctx: RequestContext, @Query() q: JobQuery) { return this.s.list(ctx.businessId, q); }
  @RequirePermissions('sales:read') @Get('jobs/:id') get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('jobs') create(@Ctx() ctx: RequestContext, @Body() dto: JobDto) { return this.s.create(ctx, dto); }
  @RequirePermissions('sales:create') @Patch('jobs/:id') update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobDto) { return this.s.update(ctx, id, dto); }
  @RequirePermissions('sales:create') @Put('jobs/:id/items') items(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemsDto) { return this.s.setItems(ctx, id, dto); }
  @RequirePermissions('sales:create') @Patch('jobs/:id/status') status(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) { return this.s.setStatus(ctx, id, dto, STATUS_LABELS); }
  @RequirePermissions('sales:create') @Post('jobs/:id/events') event(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EventDto) { return this.s.addEvent(ctx, id, dto); }
  @RequirePermissions('sales:create') @Delete('jobs/:id/events/:eventId') deleteEvent(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Param('eventId', ParseUUIDPipe) eventId: string) { return this.s.deleteEvent(ctx, id, eventId); }
  @RequirePermissions('sales:create') @Patch('jobs/:id/quote') quote(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QuoteDto) { return this.s.quote(ctx, id, dto); }
  @RequirePermissions('sales:create') @Post('jobs/:id/charge') charge(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChargeDto) { return this.s.charge(ctx, id, dto); }

  @RequirePermissions('sales:read') @Get('appointments') appts(@Ctx() ctx: RequestContext, @Query() q: RangeQuery) { return this.s.listAppointments(ctx.businessId, q); }
  @RequirePermissions('sales:create') @Post('appointments') createAppt(@Ctx() ctx: RequestContext, @Body() dto: AppointmentDto) { return this.s.createAppointment(ctx, dto); }
  @RequirePermissions('sales:create') @Put('appointments/:id') updateAppt(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AppointmentDto) { return this.s.updateAppointment(ctx, id, dto); }
  @RequirePermissions('sales:create') @Patch('appointments/:id/status') apptStatus(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AppointmentStatusDto) { return this.s.appointmentStatus(ctx, id, dto.status); }
  @RequirePermissions('sales:create') @Delete('appointments/:id') deleteAppt(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.deleteAppointment(ctx, id); }

  @RequirePermissions('sales:read') @Get('services/team') team(@Ctx() ctx: RequestContext) { return this.s.team(ctx.businessId); }
  @RequirePermissions('sales:read') @Get('services/dashboard') dashboard(@Ctx() ctx: RequestContext) { return this.s.dashboard(ctx); }

  @Public() @Get('store/:slug/track') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  track(@Param('slug') slug: string, @Query() q: TrackQuery) { return this.s.track(slug, q); }
}

const STATUS_LABELS: Record<string, string> = { QUOTE: 'Cotización', OPEN: 'Recibido', IN_PROGRESS: 'En proceso', WAITING: 'En espera', READY: 'Listo', DELIVERED: 'Entregado / cerrado', CANCELLED: 'Cancelado' };

@Module({ imports: [InventoryModule], controllers: [ServicesController], providers: [ServicesService], exports: [ServicesService] })
export class ServicesModule {}
