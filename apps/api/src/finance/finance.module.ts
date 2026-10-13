import {
  BadRequestException, Body, Controller, Delete, Get, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import {
  IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID, Length, Matches, MaxLength,
} from 'class-validator';
import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { parsePeriod, rangeFor } from '../common/dates';
import { D } from '../common/money';
import { PageQuery, offset } from '../common/pagination';
import { Db, InjectDb } from '../db/db';
import { expenseCategory, expenses, incomes, paymentMethod, suppliers } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountingService, EXPENSE_LABELS } from './accounting.service';

const CATS = expenseCategory.enumValues;
const METHODS = paymentMethod.enumValues;

class ExpenseDto {
  @IsIn(CATS, { message: 'Categoría inválida' }) category: (typeof CATS)[number];
  @IsString() @Length(2, 255) description: string;
  @IsNumberString({}, { message: 'Monto inválido' }) amount: string;
  @IsDateString() date: string;
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
  @IsOptional() @IsIn(['PAID', 'PENDING']) status?: 'PAID' | 'PENDING';
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsUUID() supplierId?: string;
}
class UpdateExpenseDto {
  @IsOptional() @IsIn(CATS) category?: (typeof CATS)[number];
  @IsOptional() @IsString() @Length(2, 255) description?: string;
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
  @IsOptional() @IsIn(['PAID', 'PENDING']) status?: 'PAID' | 'PENDING';
  @IsOptional() @IsDateString() dueDate?: string;
}
class IncomeDto {
  @IsString() @Length(2, 60) category: string;
  @IsString() @Length(2, 255) description: string;
  @IsNumberString() amount: string;
  @IsDateString() date: string;
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
}
class PeriodQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(['day', 'month']) bucket?: 'day' | 'month';
}
class ListQuery extends PageQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(CATS) category?: (typeof CATS)[number];
}

const positive = (v?: string) => { if (v !== undefined && D(v).lte(0)) throw new BadRequestException('El monto debe ser mayor a 0'); };

@Controller('expenses')
export class ExpensesController {
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService) {}

  @Get() @RequirePermissions('finance:read')
  async list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) {
    const p = q.from && q.to ? parsePeriod(ctx.timezone, q.from, q.to) : null;
    const where = and(eq(expenses.businessId, ctx.businessId), q.category ? eq(expenses.category, q.category) : undefined,
      p ? and(gte(expenses.date, p.from), lt(expenses.date, p.to)) : undefined);
    const [items, [{ total }]] = await Promise.all([
      this.db.select({
        id: expenses.id, category: expenses.category, description: expenses.description, amount: expenses.amount,
        date: expenses.date, paymentMethod: expenses.paymentMethod, status: expenses.status, dueDate: expenses.dueDate,
        supplierId: expenses.supplierId, supplierName: suppliers.name,
      }).from(expenses).leftJoin(suppliers, eq(suppliers.id, expenses.supplierId))
        .where(where).orderBy(desc(expenses.date)).limit(q.pageSize).offset(offset(q)),
      this.db.select({ total: count() }).from(expenses).where(where),
    ]);
    return { items: items.map((i) => ({ ...i, label: EXPENSE_LABELS[i.category] })), total, page: q.page, pageSize: q.pageSize };
  }

  @Get('categories')
  categories() { return Object.entries(EXPENSE_LABELS).map(([value, label]) => ({ value, label })); }

  @Post() @RequirePermissions('finance:write')
  async create(@Ctx() ctx: RequestContext, @Body() dto: ExpenseDto) {
    positive(dto.amount);
    if (dto.supplierId) {
      const s = await this.db.query.suppliers.findFirst({ where: and(eq(suppliers.id, dto.supplierId), eq(suppliers.businessId, ctx.businessId)) });
      if (!s) throw new BadRequestException('Proveedor inválido');
    }
    const [e] = await this.db.insert(expenses).values({
      ...dto, businessId: ctx.businessId, date: new Date(dto.date), dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    }).returning();
    await this.checkHighExpenses(ctx, dto.amount);
    if (e.status === 'PENDING') {
      await this.notifications.notify(ctx.businessId, 'PENDING_ACCOUNT', 'Cuenta por pagar registrada', `${e.description}: ${Number(e.amount).toLocaleString('es-CO')}`, { expenseId: e.id });
    }
    return e;
  }

  /** Avisa cuando los gastos del mes superan en 30% a los del mes anterior completo. */
  private async checkHighExpenses(ctx: RequestContext, amount: string) {
    const r = rangeFor('month', ctx.timezone);
    const sum = async (from: Date, to: Date) => (await this.db.select({ t: sql<string>`coalesce(sum(${expenses.amount}),0)` }).from(expenses)
      .where(and(eq(expenses.businessId, ctx.businessId), gte(expenses.date, from), lt(expenses.date, to))))[0].t;
    const prev = D(await sum(r.prevFrom, r.from));
    const cur = D(await sum(r.from, new Date(Date.now() + 86_400_000)));
    const limit = prev.times(1.3);
    if (prev.gt(0) && cur.gt(limit) && cur.minus(amount).lte(limit)) {
      await this.notifications.notify(ctx.businessId, 'HIGH_EXPENSES', 'Gastos elevados este mes',
        `Los gastos del mes (${cur.toNumber().toLocaleString('es-CO')}) superan en más de 30% a los del mes anterior.`);
    }
  }

  @Patch(':id') @RequirePermissions('finance:write')
  async update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenseDto) {
    positive(dto.amount);
    const [e] = await this.db.update(expenses).set({
      ...dto, date: dto.date ? new Date(dto.date) : undefined, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    }).where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId))).returning();
    if (!e) throw new NotFoundException('Gasto no encontrado');
    return e;
  }

  @Delete(':id') @RequirePermissions('finance:write')
  async remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)));
    return { ok: true };
  }
}

@Controller('incomes')
export class IncomesController {
  constructor(@InjectDb() private db: Db) {}

  @Get() @RequirePermissions('finance:read')
  async list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) {
    const p = q.from && q.to ? parsePeriod(ctx.timezone, q.from, q.to) : null;
    const where = and(eq(incomes.businessId, ctx.businessId), p ? and(gte(incomes.date, p.from), lt(incomes.date, p.to)) : undefined);
    const [items, [{ total }]] = await Promise.all([
      this.db.select().from(incomes).where(where).orderBy(desc(incomes.date)).limit(q.pageSize).offset(offset(q)),
      this.db.select({ total: count() }).from(incomes).where(where),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Post() @RequirePermissions('finance:write')
  async create(@Ctx() ctx: RequestContext, @Body() dto: IncomeDto) {
    positive(dto.amount);
    const [i] = await this.db.insert(incomes).values({ ...dto, businessId: ctx.businessId, date: new Date(dto.date) }).returning();
    return i;
  }

  @Delete(':id') @RequirePermissions('finance:write')
  async remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.businessId, ctx.businessId)));
    return { ok: true };
  }
}

@Controller('accounting')
export class AccountingController {
  constructor(private acc: AccountingService) {}

  @Get('income-statement') @RequirePermissions('finance:read')
  incomeStatement(@Ctx() ctx: RequestContext, @Query() q: PeriodQuery) {
    const p = parsePeriod(ctx.timezone, q.from, q.to);
    return this.acc.incomeStatement(ctx.businessId, p.from, p.to);
  }

  @Get('cash-flow') @RequirePermissions('finance:read')
  cashFlow(@Ctx() ctx: RequestContext, @Query() q: PeriodQuery) {
    const p = parsePeriod(ctx.timezone, q.from, q.to);
    return this.acc.cashFlow(ctx.businessId, p.from, p.to, ctx.timezone, q.bucket ?? 'day');
  }

  @Get('expenses-by-category') @RequirePermissions('finance:read')
  byCategory(@Ctx() ctx: RequestContext, @Query() q: PeriodQuery) {
    const p = parsePeriod(ctx.timezone, q.from, q.to);
    return this.acc.expensesByCategory(ctx.businessId, p.from, p.to);
  }

  @Get('receivables') @RequirePermissions('finance:read')
  receivables(@Ctx() ctx: RequestContext) { return this.acc.receivables(ctx.businessId); }

  @Get('payables') @RequirePermissions('finance:read')
  payables(@Ctx() ctx: RequestContext) { return this.acc.payables(ctx.businessId); }
}

@Module({
  controllers: [ExpensesController, IncomesController, AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class FinanceModule {}
