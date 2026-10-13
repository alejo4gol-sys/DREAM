import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { normalizeSocialLinks } from '../common/social-links';
import { SQL, and, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { PageQuery, likeTerm, offset } from '../common/pagination';
import { Db, InjectDb } from '../db/db';
import { businesses, customers, sales, salesChannel, storeOrderItems, storeOrders } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

const CHANNELS = salesChannel.enumValues;
export const SEGMENTS = ['NEW', 'FREQUENT', 'INACTIVE', 'HIGH_VALUE'] as const;
type Segment = (typeof SEGMENTS)[number];

class CustomerDto {
  @IsString() @Length(2, 160) name: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail({}, { message: 'Correo inválido' }) email?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(40) taxId?: string;
  @IsOptional() @IsIn(CHANNELS) channel?: (typeof CHANNELS)[number];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
}
class UpdateCustomerDto {
  @IsOptional() @IsString() @Length(2, 160) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(40) taxId?: string;
  @IsOptional() @IsIn(CHANNELS) channel?: (typeof CHANNELS)[number];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
  /** Autorización para recibir promociones. Solo debe activarse si el cliente lo pidió. */
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}
class CustomerQuery extends PageQuery {
  @IsOptional() @IsIn(SEGMENTS) segment?: Segment;
  @IsOptional() @IsIn(CHANNELS) channel?: (typeof CHANNELS)[number];
}

const DAY = 86_400_000;

@Injectable()
export class CustomersService {
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService) {}

  /** Umbral de "alto valor": percentil 80 del total gastado entre clientes con compras. */
  async highValueThreshold(businessId: string): Promise<number> {
    const [r] = await this.db.select({ p: sql<string | null>`percentile_cont(0.8) within group (order by ${customers.totalSpent})` })
      .from(customers).where(and(eq(customers.businessId, businessId), sql`${customers.purchaseCount} > 0`));
    return Number(r?.p ?? 0);
  }

  segmentCondition(seg: Segment, threshold: number): SQL {
    const now = Date.now();
    const d30 = new Date(now - 30 * DAY);
    const d90 = new Date(now - 90 * DAY);
    switch (seg) {
      case 'NEW': return or(gte(customers.firstPurchaseAt, d30), and(isNull(customers.firstPurchaseAt), gte(customers.createdAt, d30)))!;
      case 'FREQUENT': return and(gte(customers.purchaseCount, 3), gte(customers.lastPurchaseAt, d90))!;
      case 'INACTIVE': return or(lt(customers.lastPurchaseAt, d90), and(isNull(customers.lastPurchaseAt), lt(customers.createdAt, d30)))!;
      case 'HIGH_VALUE': return and(gte(customers.totalSpent, String(threshold)), sql`${customers.totalSpent} > 0`)!;
    }
  }

  segmentsOf(c: typeof customers.$inferSelect, threshold: number): Segment[] {
    const now = Date.now();
    const out: Segment[] = [];
    const first = c.firstPurchaseAt?.getTime();
    const last = c.lastPurchaseAt?.getTime();
    if ((first && now - first <= 30 * DAY) || (!first && now - c.createdAt.getTime() <= 30 * DAY)) out.push('NEW');
    if (c.purchaseCount >= 3 && last && now - last <= 90 * DAY) out.push('FREQUENT');
    if ((last && now - last > 90 * DAY) || (!last && now - c.createdAt.getTime() > 30 * DAY)) out.push('INACTIVE');
    if (Number(c.totalSpent) > 0 && Number(c.totalSpent) >= threshold) out.push('HIGH_VALUE');
    return out;
  }

  async list(businessId: string, q: CustomerQuery) {
    const threshold = await this.highValueThreshold(businessId);
    const where = and(
      eq(customers.businessId, businessId),
      q.q ? or(ilike(customers.name, likeTerm(q.q)), ilike(customers.phone, likeTerm(q.q)), ilike(customers.email, likeTerm(q.q)), sql`${customers.socialLinks}::text ilike ${likeTerm(q.q)}`) : undefined,
      q.channel ? eq(customers.channel, q.channel) : undefined,
      q.segment ? this.segmentCondition(q.segment, threshold) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(customers).where(where).orderBy(desc(customers.lastPurchaseAt), customers.name).limit(q.pageSize).offset(offset(q)),
      this.db.select({ total: count() }).from(customers).where(where),
    ]);
    const counts: Record<string, number> = {};
    for (const s of SEGMENTS) {
      const [{ n }] = await this.db.select({ n: count() }).from(customers).where(and(eq(customers.businessId, businessId), this.segmentCondition(s, threshold)));
      counts[s] = n;
    }
    return { items: rows.map((c) => ({ ...c, segments: this.segmentsOf(c, threshold) })), total, page: q.page, pageSize: q.pageSize, segmentCounts: counts };
  }

  async get(businessId: string, id: string) {
    const c = await this.db.query.customers.findFirst({ where: and(eq(customers.id, id), eq(customers.businessId, businessId)) });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    const history = await this.db.query.sales.findMany({
      where: and(eq(sales.customerId, id), eq(sales.businessId, businessId)),
      orderBy: desc(sales.date), limit: 50,
      columns: { id: true, number: true, date: true, total: true, amountPaid: true, status: true, channel: true, paymentMethod: true },
      with: { items: { columns: { description: true, quantity: true, lineTotal: true } } },
    });
    const business = await this.db.query.businesses.findFirst({ where: eq(businesses.id, businessId), columns: { storeSlug: true } });
    const orders = await this.db.select().from(storeOrders).where(and(eq(storeOrders.businessId, businessId), eq(storeOrders.customerId, id))).orderBy(desc(storeOrders.createdAt)).limit(50);
    const items = orders.length ? await this.db.select().from(storeOrderItems).where(inArray(storeOrderItems.orderId, orders.map((o) => o.id))) : [];
    const byOrder = new Map<string, typeof items>();
    for (const item of items) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item]);
    return { ...c, segments: this.segmentsOf(c, await this.highValueThreshold(businessId)), history,
      storeOrders: orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] })), storeSlug: business?.storeSlug ?? null };
  }

  async create(businessId: string, dto: CustomerDto) {
    const [c] = await this.db.insert(customers).values({ ...dto, socialLinks: normalizeSocialLinks(dto.socialLinks), businessId }).returning();
    await this.notifications.notify(businessId, 'NEW_CUSTOMER', 'Cliente nuevo', `${c.name} fue registrado${c.channel ? ` (canal ${c.channel})` : ''}.`, { customerId: c.id });
    return c;
  }

  async update(businessId: string, id: string, dto: UpdateCustomerDto) {
    const { marketingOptIn, ...rest } = dto;
    const consent = marketingOptIn === undefined ? {} : marketingOptIn
      ? { marketingOptIn: true, marketingOptInAt: new Date(), marketingOptOutAt: null }
      : { marketingOptIn: false, marketingOptOutAt: new Date() };
    const [c] = await this.db.update(customers).set({ ...rest, ...consent, socialLinks: dto.socialLinks === undefined ? undefined : normalizeSocialLinks(dto.socialLinks) }).where(and(eq(customers.id, id), eq(customers.businessId, businessId))).returning();
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  async remove(businessId: string, id: string) {
    const [c] = await this.db.delete(customers).where(and(eq(customers.id, id), eq(customers.businessId, businessId))).returning({ id: customers.id });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return { ok: true };
  }
}

@Controller('customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get() @RequirePermissions('customers:read')
  list(@Ctx() ctx: RequestContext, @Query() q: CustomerQuery) { return this.service.list(ctx.businessId, q); }

  @Get(':id') @RequirePermissions('customers:read')
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(ctx.businessId, id); }

  @Post() @RequirePermissions('customers:write')
  create(@Ctx() ctx: RequestContext, @Body() dto: CustomerDto) { return this.service.create(ctx.businessId, dto); }

  @Patch(':id') @RequirePermissions('customers:write')
  update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(ctx.businessId, id, dto);
  }

  @Delete(':id') @RequirePermissions('customers:write')
  remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.remove(ctx.businessId, id); }
}

@Module({ controllers: [CustomersController], providers: [CustomersService], exports: [CustomersService] })
export class CustomersModule {}
