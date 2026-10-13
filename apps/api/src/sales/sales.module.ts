import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Logger, Module, NotFoundException, Param,
  ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Matches,
  MaxLength, Min, ValidateNested,
} from 'class-validator';
import { and, count, desc, eq, gte, ilike, inArray, isNull, lt, max, or, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { parsePeriod, rangeFor } from '../common/dates';
import { D, m2 } from '../common/money';
import { PageQuery, likeTerm, offset } from '../common/pagination';
import { PlanLimitsService } from '../common/plan-limits.service';
import { Db, InjectDb, Tx } from '../db/db';
import {
  businesses, customers, paymentMethod, products, reconciliations, saleItems, salePayments, sales, saleStatus, salesChannel,
} from '../db/schema';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { computeSale, paymentStatus } from './sale-calculator';
import { activatePackagesForSale } from '../packages/packages.module';
import { listPricesFor } from '../wholesale/wholesale.module';

const METHODS = paymentMethod.enumValues;
const CHANNELS = salesChannel.enumValues;
const STATUSES = saleStatus.enumValues;

class SaleItemDto {
  @IsUUID() productId: string;
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsNumberString() unitPrice?: string;
  @IsOptional() @IsNumberString() discount?: string;
}
class CreateSaleDto {
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsIn(CHANNELS, { message: 'Canal inválido' }) channel: (typeof CHANNELS)[number];
  @IsIn(METHODS, { message: 'Método de pago inválido' }) paymentMethod: (typeof METHODS)[number];
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos un producto' }) @ValidateNested({ each: true }) @Type(() => SaleItemDto)
  items: SaleItemDto[];
  @IsOptional() @IsNumberString() discount?: string;
  /** Si se omite, la venta se registra como pagada en su totalidad. */
  @IsOptional() @IsNumberString() amountPaid?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
class PaymentDto {
  @IsNumberString() amount: string;
  @IsIn(METHODS) method: (typeof METHODS)[number];
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}
class SalesQuery extends PageQuery {
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsIn(CHANNELS) channel?: (typeof CHANNELS)[number];
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(['true']) receivable?: string;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);
  constructor(
    @InjectDb() private db: Db, private inventory: InventoryService,
    private notifications: NotificationsService, private limits: PlanLimitsService,
  ) {}

  async create(ctx: RequestContext, dto: CreateSaleDto) {
    await this.limits.assert(ctx.businessId, 'salesPerMonth');
    if (dto.customerId) {
      const c = await this.db.query.customers.findFirst({ where: and(eq(customers.id, dto.customerId), eq(customers.businessId, ctx.businessId)) });
      if (!c) throw new BadRequestException('Cliente inválido');
    }
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const prods = await this.db.select().from(products).where(and(eq(products.businessId, ctx.businessId), inArray(products.id, ids)));
    if (prods.length !== ids.length) throw new BadRequestException('Algún producto no existe en este negocio');
    const byId = new Map(prods.map((p) => [p.id, p]));
    if (prods.some((p) => !p.isActive)) throw new BadRequestException('Hay productos inactivos en la venta');

    // Clientes mayoristas: si no se indica precio, se usa el de su lista de precios.
    const listed = dto.customerId ? await listPricesFor(this.db, ctx.businessId, dto.customerId, ids) : null;
    const lines = dto.items.map((i) => {
      const p = byId.get(i.productId)!;
      return { quantity: i.quantity, unitPrice: i.unitPrice ?? listed?.prices[p.id]?.price ?? p.salePrice, unitCost: p.costPrice, discount: i.discount ?? '0', taxRate: p.taxRate };
    });
    let totals;
    try {
      totals = computeSale(lines, dto.discount ?? '0');
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const paid = dto.amountPaid !== undefined ? D(dto.amountPaid) : D(totals.total);
    if (paid.lt(0) || paid.gt(totals.total)) throw new BadRequestException('El valor pagado no puede superar el total');
    const date = dto.date ? new Date(dto.date) : new Date();
    const status = paymentStatus(totals.total, paid);

    const sale = await this.db.transaction(async (tx) => {
      // Consecutivo por negocio: el UPDATE bloquea la fila y garantiza números únicos sin huecos
      const [{ number }] = await tx.update(businesses)
        .set({ nextSaleNumber: sql`${businesses.nextSaleNumber} + 1` })
        .where(eq(businesses.id, ctx.businessId))
        .returning({ number: sql<number>`${businesses.nextSaleNumber} - 1` });

      const [s] = await tx.insert(sales).values({
        businessId: ctx.businessId, number, customerId: dto.customerId, date, channel: dto.channel,
        paymentMethod: dto.paymentMethod, status, subtotal: totals.subtotal, discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal, total: totals.total, amountPaid: m2(paid), costTotal: totals.costTotal,
        notes: dto.notes, createdById: ctx.userId,
      }).returning();

      for (const [idx, item] of dto.items.entries()) {
        const p = byId.get(item.productId)!;
        const r = totals.lines[idx];
        await tx.insert(saleItems).values({
          saleId: s.id, productId: p.id, description: p.name, quantity: item.quantity,
          unitPrice: m2(lines[idx].unitPrice), unitCost: p.costPrice, discount: r.discount, taxRate: p.taxRate,
          lineTax: r.tax, lineTotal: r.total,
        });
        const q = await this.inventory.move(tx, {
          businessId: ctx.businessId, productId: p.id, delta: -item.quantity, type: 'SALE', unitCost: p.costPrice,
          referenceType: 'SALE', referenceId: s.id, userId: ctx.userId, note: `Venta #${number}`,
        });
        await this.inventory.checkLowStock(tx, ctx.businessId, p.id, q, -item.quantity);
      }

      if (paid.gt(0)) await tx.insert(salePayments).values({ saleId: s.id, amount: m2(paid), method: dto.paymentMethod, paidAt: date });
      if (dto.customerId) await this.applyToCustomer(tx, dto.customerId, totals.total, date, +1);
      // Paquetes y membresías vendidos: quedan activos en la cuenta del cliente.
      await activatePackagesForSale(tx, ctx.businessId, s.id, dto.customerId, dto.items);

      await this.notifications.notify(ctx.businessId, 'NEW_SALE', `Nueva venta #${number}`,
        `Total ${Number(totals.total).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} · ${dto.channel}`, { saleId: s.id }, tx);
      if (status !== 'PAID') {
        await this.notifications.notify(ctx.businessId, 'PENDING_ACCOUNT', `Venta #${number} con saldo pendiente`,
          `Saldo por cobrar: ${m2(D(totals.total).minus(paid))}`, { saleId: s.id }, tx);
      }
      return s;
    });

    this.checkMonthlyGoal(ctx, sale.total).catch((e) => this.logger.warn(e.message));
    return this.get(ctx.businessId, sale.id);
  }

  private async applyToCustomer(tx: Tx, customerId: string, total: string, date: Date, sign: 1 | -1) {
    if (sign === 1) {
      await tx.update(customers).set({
        totalSpent: sql`${customers.totalSpent} + ${total}`,
        purchaseCount: sql`${customers.purchaseCount} + 1`,
        firstPurchaseAt: sql`least(coalesce(${customers.firstPurchaseAt}, ${date.toISOString()}::timestamptz), ${date.toISOString()}::timestamptz)`,
        lastPurchaseAt: sql`greatest(coalesce(${customers.lastPurchaseAt}, ${date.toISOString()}::timestamptz), ${date.toISOString()}::timestamptz)`,
      }).where(eq(customers.id, customerId));
    } else {
      const [agg] = await tx.select({ first: sql<Date | null>`min(${sales.date})`, last: max(sales.date) })
        .from(sales).where(and(eq(sales.customerId, customerId), isNull(sales.cancelledAt)));
      await tx.update(customers).set({
        totalSpent: sql`greatest(${customers.totalSpent} - ${total}, 0)`,
        purchaseCount: sql`greatest(${customers.purchaseCount} - 1, 0)`,
        firstPurchaseAt: agg?.first ? new Date(agg.first) : null,
        lastPurchaseAt: agg?.last ?? null,
      }).where(eq(customers.id, customerId));
    }
  }

  /** Avisa una sola vez cuando las ventas del mes superan la meta configurada. */
  private async checkMonthlyGoal(ctx: RequestContext, saleTotal: string) {
    const b = await this.db.query.businesses.findFirst({ where: eq(businesses.id, ctx.businessId), columns: { monthlyGoal: true } });
    if (!b?.monthlyGoal) return;
    const { from } = rangeFor('month', ctx.timezone);
    const [{ total }] = await this.db.select({ total: sql<string>`coalesce(sum(${sales.total}),0)` }).from(sales)
      .where(and(eq(sales.businessId, ctx.businessId), gte(sales.date, from), isNull(sales.cancelledAt)));
    const before = D(total).minus(saleTotal);
    if (D(total).gte(b.monthlyGoal) && before.lt(b.monthlyGoal)) {
      await this.notifications.notify(ctx.businessId, 'GOAL_REACHED', '¡Meta de ventas alcanzada!',
        `Las ventas del mes llegaron a ${Number(total).toLocaleString('es-CO')} (meta ${Number(b.monthlyGoal).toLocaleString('es-CO')}).`);
    }
  }

  async list(ctx: RequestContext, q: SalesQuery) {
    const period = q.from && q.to ? parsePeriod(ctx.timezone, q.from, q.to) : null;
    const numeric = q.q && /^\d+$/.test(q.q) ? Number(q.q) : null;
    const where = and(
      eq(sales.businessId, ctx.businessId),
      q.status ? eq(sales.status, q.status) : undefined,
      q.channel ? eq(sales.channel, q.channel) : undefined,
      q.customerId ? eq(sales.customerId, q.customerId) : undefined,
      period ? and(gte(sales.date, period.from), lt(sales.date, period.to)) : undefined,
      q.receivable ? inArray(sales.status, ['PENDING', 'PARTIALLY_PAID']) : undefined,
      q.q ? or(numeric !== null ? eq(sales.number, numeric) : undefined, ilike(customers.name, likeTerm(q.q))) : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      this.db.select({
        id: sales.id, number: sales.number, date: sales.date, channel: sales.channel, paymentMethod: sales.paymentMethod,
        status: sales.status, total: sales.total, amountPaid: sales.amountPaid, customerId: sales.customerId,
        customerName: customers.name,
        itemsCount: sql<number>`(select coalesce(sum(${saleItems.quantity}),0)::int from ${saleItems} where ${saleItems.saleId} = "sales"."id")`,
      }).from(sales).leftJoin(customers, eq(customers.id, sales.customerId))
        .where(where).orderBy(desc(sales.date), desc(sales.number)).limit(q.pageSize).offset(offset(q)),
      this.db.select({ total: count() }).from(sales).leftJoin(customers, eq(customers.id, sales.customerId)).where(where),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(businessId: string, id: string) {
    const s = await this.db.query.sales.findFirst({
      where: and(eq(sales.id, id), eq(sales.businessId, businessId)),
      with: { items: true, payments: { orderBy: desc(salePayments.paidAt) }, customer: true },
    });
    if (!s) throw new NotFoundException('Venta no encontrada');
    return { ...s, balance: m2(D(s.total).minus(s.amountPaid)) };
  }

  async addPayment(ctx: RequestContext, id: string, dto: PaymentDto) {
    const s = await this.get(ctx.businessId, id);
    if (s.status === 'CANCELLED') throw new BadRequestException('La venta está anulada');
    const amount = D(dto.amount);
    if (amount.lte(0) || amount.gt(s.balance)) throw new BadRequestException(`El abono debe ser mayor a 0 y máximo ${s.balance}`);
    const newPaid = D(s.amountPaid).plus(amount);
    await this.db.transaction(async (tx) => {
      await tx.insert(salePayments).values({ saleId: id, amount: m2(amount), method: dto.method, reference: dto.reference });
      await tx.update(sales).set({ amountPaid: m2(newPaid), status: paymentStatus(s.total, newPaid) }).where(eq(sales.id, id));
      await this.notifications.notify(ctx.businessId, 'PAYMENT_RECEIVED', `Pago recibido · venta #${s.number}`,
        `Abono de ${Number(amount).toLocaleString('es-CO')} por ${dto.method}.`, { saleId: id }, tx);
    });
    return this.get(ctx.businessId, id);
  }

  async cancel(ctx: RequestContext, id: string) {
    const s = await this.get(ctx.businessId, id);
    if (s.status === 'CANCELLED') throw new BadRequestException('La venta ya está anulada');
    await this.db.transaction(async (tx) => {
      await tx.update(sales).set({ status: 'CANCELLED', cancelledAt: new Date() }).where(eq(sales.id, id));
      for (const it of s.items) {
        await this.inventory.move(tx, {
          businessId: ctx.businessId, productId: it.productId, delta: it.quantity, type: 'SALE_CANCEL', unitCost: it.unitCost,
          referenceType: 'SALE', referenceId: id, userId: ctx.userId, note: `Anulación venta #${s.number}`,
        });
      }
      if (s.customerId) await this.applyToCustomer(tx, s.customerId, s.total, s.date, -1);
      await tx.delete(reconciliations).where(and(eq(reconciliations.saleId, id), eq(reconciliations.status, 'SUGGESTED')));
    });
    return this.get(ctx.businessId, id);
  }
}

@Controller('sales')
export class SalesController {
  constructor(private service: SalesService) {}

  @Get() @RequirePermissions('sales:read')
  list(@Ctx() ctx: RequestContext, @Query() q: SalesQuery) { return this.service.list(ctx, q); }

  @Get(':id') @RequirePermissions('sales:read')
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(ctx.businessId, id); }

  @Post() @RequirePermissions('sales:create')
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateSaleDto) {
    if (dto.date && !ctx.permissions.has('sales:cancel') && Math.abs(Date.now() - new Date(dto.date).getTime()) > 7 * 86_400_000) {
      throw new ForbiddenException('Solo un administrador puede registrar ventas con más de 7 días de diferencia');
    }
    return this.service.create(ctx, dto);
  }

  @Post(':id/payments') @RequirePermissions('sales:create')
  pay(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PaymentDto) {
    return this.service.addPayment(ctx, id, dto);
  }

  @Post(':id/cancel') @RequirePermissions('sales:cancel')
  cancel(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.cancel(ctx, id); }
}

@Module({
  imports: [InventoryModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
