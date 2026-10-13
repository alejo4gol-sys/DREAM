import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { and, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { RangeKey, rangeFor } from '../common/dates';
import { D, num } from '../common/money';
import { Db, InjectDb } from '../db/db';
import { bankAccounts, customers, inventoryLevels, products, saleItems, sales } from '../db/schema';
import { AccountingService } from '../finance/accounting.service';
import { FinanceModule } from '../finance/finance.module';

class DashboardQuery {
  @IsOptional() @IsIn(['today', 'week', 'month', 'quarter', 'year']) range?: RangeKey;
}

const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 1000) / 10);

@Injectable()
export class DashboardService {
  constructor(@InjectDb() private db: Db, private acc: AccountingService) {}

  private async totalBetween(businessId: string, from: Date, to: Date) {
    const s = await this.acc.salesTotals(businessId, from, to);
    return { total: num(s.total), count: s.count };
  }

  private async series(businessId: string, from: Date, to: Date, tz: string, bucket: 'day' | 'month') {
    const fmt = bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
    return this.db.select({
      period: sql<string>`to_char(date_trunc(${bucket}, ${sales.date} at time zone ${tz}), ${fmt})`,
      total: sql<string>`sum(${sales.total})`,
      orders: sql<number>`count(*)::int`,
    }).from(sales)
      .where(and(eq(sales.businessId, businessId), gte(sales.date, from), lt(sales.date, to), isNull(sales.cancelledAt)))
      .groupBy(sql`1`).orderBy(sql`1`);
  }

  async build(ctx: RequestContext, range: RangeKey) {
    const tz = ctx.timezone;
    const b = ctx.businessId;
    const r = rangeFor(range, tz);
    const canFinance = ctx.permissions.has('finance:read');
    const canBanks = ctx.permissions.has('banks:read');

    const [today, week, month, cur, prev] = await Promise.all([
      this.totalBetween(b, rangeFor('today', tz).from, new Date()),
      this.totalBetween(b, rangeFor('week', tz).from, new Date()),
      this.totalBetween(b, rangeFor('month', tz).from, new Date()),
      this.totalBetween(b, r.from, r.to),
      this.totalBetween(b, r.prevFrom, r.prevTo),
    ]);

    const bucket = range === 'year' || range === 'quarter' ? (range === 'year' ? 'month' : 'day') : 'day';
    const [seriesCur, seriesPrev] = await Promise.all([
      this.series(b, r.from, r.to, tz, bucket),
      this.series(b, r.prevFrom, r.prevTo, tz, bucket),
    ]);

    const byChannel = await this.db.select({ channel: sales.channel, total: sql<string>`sum(${sales.total})`, orders: sql<number>`count(*)::int` })
      .from(sales).where(and(eq(sales.businessId, b), gte(sales.date, r.from), lt(sales.date, r.to), isNull(sales.cancelledAt)))
      .groupBy(sales.channel).orderBy(desc(sql`sum(${sales.total})`));

    const topProducts = await this.db.select({
      productId: saleItems.productId, name: saleItems.description,
      units: sql<number>`sum(${saleItems.quantity})::int`, revenue: sql<string>`sum(${saleItems.lineTotal})`,
    }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(and(eq(sales.businessId, b), gte(sales.date, r.from), lt(sales.date, r.to), isNull(sales.cancelledAt)))
      .groupBy(saleItems.productId, saleItems.description).orderBy(desc(sql`sum(${saleItems.quantity})`)).limit(5);

    const stock = sql<number>`coalesce(sum(${inventoryLevels.quantity}),0)::int`;
    const lowStock = await this.db.select({ id: products.id, name: products.name, sku: products.sku, minStock: products.minStock, stock })
      .from(products).leftJoin(inventoryLevels, eq(inventoryLevels.productId, products.id))
      .where(and(eq(products.businessId, b), eq(products.isActive, true), eq(products.isService, false)))
      .groupBy(products.id).having(sql`${stock} <= ${products.minStock}`).orderBy(stock).limit(8);

    const [{ customersCount }] = await this.db.select({ customersCount: count() }).from(customers).where(eq(customers.businessId, b));
    const [{ newCustomers }] = await this.db.select({ newCustomers: count() }).from(customers)
      .where(and(eq(customers.businessId, b), gte(customers.createdAt, r.from)));
    const unitsSold = topProducts.length
      ? (await this.db.select({ u: sql<number>`coalesce(sum(${saleItems.quantity}),0)::int` }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId))
        .where(and(eq(sales.businessId, b), gte(sales.date, r.from), lt(sales.date, r.to), isNull(sales.cancelledAt))))[0].u
      : 0;

    const result: Record<string, unknown> = {
      range, from: r.from, to: r.to,
      sales: {
        today: today.total, week: week.total, month: month.total,
        current: cur.total, previous: prev.total, change: pct(cur.total, prev.total),
        orders: cur.count, previousOrders: prev.count, ordersChange: pct(cur.count, prev.count),
        averageTicket: cur.count ? Math.round(cur.total / cur.count) : 0,
      },
      series: { bucket, current: seriesCur.map((s) => ({ ...s, total: num(s.total) })), previous: seriesPrev.map((s) => ({ ...s, total: num(s.total) })) },
      byChannel: byChannel.map((c) => ({ ...c, total: num(c.total) })),
      topProducts: topProducts.map((p) => ({ ...p, revenue: num(p.revenue) })),
      unitsSold,
      lowStock,
      customers: { total: customersCount, new: newCustomers },
    };

    if (canFinance) {
      const [is, isPrev, cash, rec, pay] = await Promise.all([
        this.acc.incomeStatement(b, r.from, r.to),
        this.acc.incomeStatement(b, r.prevFrom, r.prevTo),
        this.acc.cashFlow(b, r.from, r.to, tz),
        this.acc.receivables(b),
        this.acc.payables(b),
      ]);
      const totalExpenses = is.expensesByCategory.reduce((a, e) => a + e.total, 0);
      result.finance = {
        estimatedProfit: is.netProfit, previousProfit: isPrev.netProfit, profitChange: pct(is.netProfit, isPrev.netProfit),
        grossProfit: is.grossProfit, netMargin: is.netMargin,
        expenses: is.operatingExpenses, allExpenses: totalExpenses, previousExpenses: isPrev.operatingExpenses,
        income: cash.inflows, outflows: cash.outflows,
        receivables: rec.total, receivablesCount: rec.items.length,
        payables: pay.total, payablesCount: pay.purchases.length + pay.expenses.length,
        cashBalance: await this.acc.cashBalance(b),
      };
    }
    if (canBanks) {
      const accts = await this.db.select({ balance: bankAccounts.balance }).from(bankAccounts).where(eq(bankAccounts.businessId, b));
      result.banks = { accounts: accts.length, balance: num(accts.reduce((a, x) => a.plus(x.balance), D(0))) };
    }
    return result;
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get() @RequirePermissions('sales:read')
  get(@Ctx() ctx: RequestContext, @Query() q: DashboardQuery) {
    return this.service.build(ctx, q.range ?? 'month');
  }
}

@Module({ imports: [FinanceModule], controllers: [DashboardController], providers: [DashboardService], exports: [DashboardService] })
export class DashboardModule {}
