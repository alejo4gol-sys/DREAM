import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe,
  Patch, Post, Query,
} from '@nestjs/common';
import {
  IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID, Length, MaxLength,
} from 'class-validator';
import { and, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { CryptoService } from '../common/crypto.service';
import { D, m2, num } from '../common/money';
import { PlanLimitsService } from '../common/plan-limits.service';
import { Db, InjectDb } from '../db/db';
import { bankAccounts, bankTransactions, expenses, reconciliations, salePayments, sales } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { paymentStatus } from '../sales/sale-calculator';
import { ELECTRONIC_METHODS, daysBetween, parseAmount, parseCsv, parseDate, scoreMatch } from './reconciliation';

/** Catálogo honesto de proveedores: solo MANUAL y SANDBOX funcionan sin contrato externo. */
export const BANK_PROVIDERS = [
  { code: 'MANUAL', name: 'Registro manual / importación CSV', status: 'available',
    description: 'Registra movimientos a mano o importa el extracto en CSV que descargas de tu banca en línea.' },
  { code: 'SANDBOX', name: 'Banco de pruebas (datos simulados)', status: 'available',
    description: 'Genera movimientos ficticios para probar la conciliación. Nunca usar con dinero real.' },
  { code: 'OPEN_FINANCE', name: 'Conexión directa (Open Finance)', status: 'requires_contract',
    description: 'Requiere contrato con un agregador autorizado (p. ej. Belvo, Prometeo o Minka) y cobertura del banco. Autenticación por widget del proveedor; DREAMS nunca pide ni guarda tu contraseña bancaria.' },
] as const;

class BankAccountDto {
  @IsString() @Length(2, 80) bankName: string;
  @IsIn(['AHORROS', 'CORRIENTE', 'BILLETERA']) accountType: string;
  @IsOptional() @IsString() @Length(4, 34) accountNumber?: string;
  @IsIn(['MANUAL', 'SANDBOX']) provider: 'MANUAL' | 'SANDBOX';
  @IsOptional() @IsNumberString() balance?: string;
}
class TransactionDto {
  @IsUUID() bankAccountId: string;
  @IsDateString() date: string;
  @IsNumberString() amount: string;
  @IsIn(['CREDIT', 'DEBIT']) type: 'CREDIT' | 'DEBIT';
  @IsString() @Length(2, 255) description: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}
class ImportDto {
  @IsUUID() bankAccountId: string;
  @IsString() @MaxLength(2_000_000) csv: string;
}
class TxQuery {
  @IsOptional() @IsUUID() bankAccountId?: string;
  @IsOptional() @IsIn(['UNMATCHED', 'MATCHED', 'IGNORED']) status?: 'UNMATCHED' | 'MATCHED' | 'IGNORED';
}
class UpdateTxDto {
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsIn(['UNMATCHED', 'IGNORED']) status?: 'UNMATCHED' | 'IGNORED';
}

@Injectable()
export class BanksService {
  constructor(
    @InjectDb() private db: Db, private crypto: CryptoService,
    private limits: PlanLimitsService, private notifications: NotificationsService,
  ) {}

  async account(businessId: string, id: string) {
    const a = await this.db.query.bankAccounts.findFirst({ where: and(eq(bankAccounts.id, id), eq(bankAccounts.businessId, businessId)) });
    if (!a) throw new NotFoundException('Cuenta no encontrada');
    return a;
  }

  async addTransactions(businessId: string, accountId: string, rows: Omit<typeof bankTransactions.$inferInsert, 'businessId' | 'bankAccountId'>[]) {
    if (!rows.length) return { inserted: 0 };
    return this.db.transaction(async (tx) => {
      const inserted = await tx.insert(bankTransactions)
        .values(rows.map((r) => ({ ...r, businessId, bankAccountId: accountId })))
        .onConflictDoNothing().returning({ amount: bankTransactions.amount, type: bankTransactions.type });
      const delta = inserted.reduce((a, r) => (r.type === 'CREDIT' ? a.plus(r.amount) : a.minus(r.amount)), D(0));
      await tx.update(bankAccounts).set({ balance: sql`${bankAccounts.balance} + ${m2(delta)}`, lastSyncedAt: new Date() })
        .where(eq(bankAccounts.id, accountId));
      if (inserted.length) {
        await this.notifications.notify(businessId, 'BANK_TX', `${inserted.length} movimiento(s) bancario(s) nuevo(s)`,
          'Revisa la conciliación para asociarlos con tus ventas y gastos.', { bankAccountId: accountId }, tx);
      }
      return { inserted: inserted.length, skipped: rows.length - inserted.length };
    });
  }

  importCsv(businessId: string, accountId: string, csv: string) {
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new BadRequestException('El archivo no tiene movimientos');
    const header = rows[0].map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const iDate = idx('fecha', 'date');
    const iDesc = idx('descripcion', 'concepto', 'detalle', 'description');
    const iAmount = idx('valor', 'monto', 'amount', 'importe');
    const iRef = idx('referencia', 'reference', 'documento');
    if (iDate < 0 || iDesc < 0 || iAmount < 0) {
      throw new BadRequestException('El CSV debe tener columnas: fecha, descripcion, valor (y opcional referencia)');
    }
    const errors: string[] = [];
    const parsed = rows.slice(1).flatMap((r, n) => {
      const date = parseDate(r[iDate] ?? '');
      const amount = parseAmount(r[iAmount] ?? '');
      if (!date || !amount || D(amount).isZero()) { errors.push(`Fila ${n + 2}: fecha o valor inválido`); return []; }
      const ref = iRef >= 0 ? r[iRef] : '';
      return [{
        date, amount: m2(D(amount).abs()), type: D(amount).isNeg() ? 'DEBIT' as const : 'CREDIT' as const,
        description: (r[iDesc] || 'Sin descripción').slice(0, 255), reference: ref || null,
        externalId: this.crypto.sha256(`${date.toISOString()}|${amount}|${r[iDesc]}|${ref}|${n}`).slice(0, 40),
      }];
    });
    return this.addTransactions(businessId, accountId, parsed).then((r) => ({ ...r, errors }));
  }

  /** Conector Sandbox: datos SIMULADOS para desarrollo. Incluye movimientos que coinciden con ventas reales para probar la conciliación. */
  async syncSandbox(businessId: string, accountId: string) {
    const recent = await this.db.select({ id: sales.id, number: sales.number, total: sales.total, date: sales.date })
      .from(sales).where(and(eq(sales.businessId, businessId), isNull(sales.cancelledAt), inArray(sales.paymentMethod, [...ELECTRONIC_METHODS])))
      .orderBy(desc(sales.date)).limit(4);
    const now = Date.now();
    const rows: Omit<typeof bankTransactions.$inferInsert, 'businessId' | 'bankAccountId'>[] = recent.map((s, i) => ({
      date: new Date(Math.min(now, s.date.getTime() + (i % 2) * 86_400_000)), amount: s.total, type: 'CREDIT' as const,
      description: `Transferencia recibida ref ${100000 + s.number}`, reference: String(100000 + s.number),
      externalId: `sbx-sale-${s.id}`, isSimulated: true,
    }));
    rows.push(
      { date: new Date(now - 2 * 86_400_000), amount: '18900.00', type: 'DEBIT', description: 'Comisión manejo cuenta', externalId: `sbx-fee-${new Date().toISOString().slice(0, 7)}`, isSimulated: true },
      { date: new Date(now - 86_400_000), amount: '75000.00', type: 'CREDIT', description: 'Consignación sin referencia', externalId: `sbx-dep-${Math.floor(now / 86_400_000)}`, isSimulated: true },
    );
    return this.addTransactions(businessId, accountId, rows);
  }

  /** Genera sugerencias de conciliación para movimientos sin asociar. */
  async generateSuggestions(businessId: string) {
    const txs = await this.db.select().from(bankTransactions)
      .where(and(eq(bankTransactions.businessId, businessId), eq(bankTransactions.status, 'UNMATCHED')));
    let created = 0;
    for (const t of txs) {
      const from = new Date(t.date.getTime() - 5 * 86_400_000);
      const to = new Date(t.date.getTime() + 5 * 86_400_000);
      const prior = await this.db.select({ saleId: reconciliations.saleId, expenseId: reconciliations.expenseId })
        .from(reconciliations).where(eq(reconciliations.bankTransactionId, t.id));
      const seen = new Set(prior.flatMap((p) => [p.saleId, p.expenseId]).filter(Boolean));

      if (t.type === 'CREDIT') {
        const cands = await this.db.select({
          id: sales.id, number: sales.number, total: sales.total, amountPaid: sales.amountPaid, date: sales.date,
          method: sales.paymentMethod,
        }).from(sales).where(and(
          eq(sales.businessId, businessId), isNull(sales.cancelledAt), gte(sales.date, from), lte(sales.date, to),
          ne(sales.paymentMethod, 'CASH'),
        ));
        for (const s of cands) {
          if (seen.has(s.id)) continue;
          const accepted = await this.db.select({ id: reconciliations.id }).from(reconciliations)
            .where(and(eq(reconciliations.saleId, s.id), eq(reconciliations.status, 'ACCEPTED')));
          if (accepted.length) continue;
          const balance = D(s.total).minus(s.amountPaid);
          const amountMatches = D(t.amount).eq(s.total) ? 'total' : balance.gt(0) && D(t.amount).eq(balance) ? 'balance' : 'none';
          const score = scoreMatch({
            amountMatches, daysApart: daysBetween(t.date, s.date), method: s.method,
            referenceInDescription: t.description.includes(String(s.number)),
          });
          if (score >= 60) {
            const r = await this.db.insert(reconciliations).values({ businessId, bankTransactionId: t.id, saleId: s.id, score })
              .onConflictDoNothing().returning({ id: reconciliations.id });
            created += r.length;
          }
        }
      } else {
        const cands = await this.db.select({ id: expenses.id, amount: expenses.amount, date: expenses.date, method: expenses.paymentMethod })
          .from(expenses).where(and(eq(expenses.businessId, businessId), gte(expenses.date, from), lte(expenses.date, to), eq(expenses.amount, t.amount)));
        for (const e of cands) {
          if (seen.has(e.id)) continue;
          const score = scoreMatch({ amountMatches: 'total', daysApart: daysBetween(t.date, e.date), method: e.method });
          if (score >= 60) {
            const r = await this.db.insert(reconciliations).values({ businessId, bankTransactionId: t.id, expenseId: e.id, score })
              .onConflictDoNothing().returning({ id: reconciliations.id });
            created += r.length;
          }
        }
      }
    }
    return created;
  }

  async suggestions(businessId: string) {
    await this.generateSuggestions(businessId);
    const rows = await this.db.query.reconciliations.findMany({
      where: and(eq(reconciliations.businessId, businessId), eq(reconciliations.status, 'SUGGESTED')),
      orderBy: desc(reconciliations.score),
      with: {
        bankTransaction: { with: { bankAccount: { columns: { bankName: true, last4: true } } } },
        sale: { columns: { id: true, number: true, total: true, amountPaid: true, date: true, paymentMethod: true, status: true } },
        expense: { columns: { id: true, description: true, amount: true, date: true, category: true } },
      },
    });
    return rows.map((r) => ({
      ...r,
      question: r.sale
        ? `¿Deseas asociar este movimiento bancario con la venta #${r.sale.number}?`
        : `¿Deseas asociar este movimiento bancario con el gasto "${r.expense?.description}"?`,
    }));
  }

  async decide(ctx: RequestContext, id: string, accept: boolean) {
    const r = await this.db.query.reconciliations.findFirst({
      where: and(eq(reconciliations.id, id), eq(reconciliations.businessId, ctx.businessId)),
      with: { bankTransaction: true, sale: true },
    });
    if (!r) throw new NotFoundException('Sugerencia no encontrada');
    if (r.status !== 'SUGGESTED') throw new BadRequestException('Esta sugerencia ya fue resuelta');
    await this.db.transaction(async (tx) => {
      await tx.update(reconciliations).set({ status: accept ? 'ACCEPTED' : 'REJECTED', decidedAt: new Date(), decidedById: ctx.userId })
        .where(eq(reconciliations.id, id));
      if (!accept) return;
      await tx.update(bankTransactions).set({ status: 'MATCHED' }).where(eq(bankTransactions.id, r.bankTransactionId));
      await tx.update(reconciliations).set({ status: 'REJECTED', decidedAt: new Date(), decidedById: ctx.userId })
        .where(and(eq(reconciliations.bankTransactionId, r.bankTransactionId), eq(reconciliations.status, 'SUGGESTED')));
      // Si la venta tenía saldo pendiente, el movimiento conciliado se registra como abono
      if (r.sale && D(r.sale.amountPaid).lt(r.sale.total)) {
        const balance = D(r.sale.total).minus(r.sale.amountPaid);
        const amount = D(r.bankTransaction.amount).lt(balance) ? D(r.bankTransaction.amount) : balance;
        const newPaid = D(r.sale.amountPaid).plus(amount);
        await tx.insert(salePayments).values({
          saleId: r.sale.id, amount: m2(amount), method: 'BANK_TRANSFER', reference: `Conciliación ${r.bankTransaction.reference ?? ''}`.trim(),
          paidAt: r.bankTransaction.date,
        });
        await tx.update(sales).set({ amountPaid: m2(newPaid), status: paymentStatus(r.sale.total, newPaid) }).where(eq(sales.id, r.sale.id));
      }
    });
    return { ok: true, status: accept ? 'ACCEPTED' : 'REJECTED' };
  }
}

@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private service: BanksService, @InjectDb() private db: Db, private crypto: CryptoService, private limits: PlanLimitsService) {}

  @Get('providers') @RequirePermissions('banks:read')
  providers() { return BANK_PROVIDERS; }

  @Get() @RequirePermissions('banks:read')
  async list(@Ctx() ctx: RequestContext) {
    const rows = await this.db.select({
      id: bankAccounts.id, bankName: bankAccounts.bankName, accountType: bankAccounts.accountType, last4: bankAccounts.last4,
      currency: bankAccounts.currency, provider: bankAccounts.provider, balance: bankAccounts.balance, lastSyncedAt: bankAccounts.lastSyncedAt,
      unmatched: sql<number>`(select count(*)::int from ${bankTransactions} where ${bankTransactions.bankAccountId} = "bank_accounts"."id" and ${bankTransactions.status} = 'UNMATCHED')`,
    }).from(bankAccounts).where(eq(bankAccounts.businessId, ctx.businessId)).orderBy(bankAccounts.createdAt);
    return { items: rows, totalBalance: num(rows.reduce((a, r) => a.plus(r.balance), D(0))) };
  }

  @Post() @RequirePermissions('banks:write')
  async create(@Ctx() ctx: RequestContext, @Body() dto: BankAccountDto) {
    await this.limits.assert(ctx.businessId, 'bankAccounts');
    const digits = dto.accountNumber?.replace(/\D/g, '');
    const [a] = await this.db.insert(bankAccounts).values({
      businessId: ctx.businessId, bankName: dto.bankName, accountType: dto.accountType, provider: dto.provider,
      accountNumberEnc: digits ? this.crypto.encrypt(digits) : null, last4: digits ? digits.slice(-4) : null,
      balance: m2(dto.balance ?? 0),
    }).returning({ id: bankAccounts.id, bankName: bankAccounts.bankName, last4: bankAccounts.last4, provider: bankAccounts.provider });
    return a;
  }

  @Post(':id/sync') @RequirePermissions('banks:write')
  async sync(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const a = await this.service.account(ctx.businessId, id);
    if (a.provider !== 'SANDBOX') throw new BadRequestException('Esta cuenta es manual: registra o importa movimientos desde un CSV.');
    return this.service.syncSandbox(ctx.businessId, id);
  }

  @Delete(':id') @RequirePermissions('banks:write')
  async remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.account(ctx.businessId, id);
    await this.db.delete(bankAccounts).where(eq(bankAccounts.id, id));
    return { ok: true };
  }
}

@Controller('bank-transactions')
export class BankTransactionsController {
  constructor(private service: BanksService, @InjectDb() private db: Db) {}

  @Get() @RequirePermissions('banks:read')
  list(@Ctx() ctx: RequestContext, @Query() q: TxQuery) {
    return this.db.select({
      id: bankTransactions.id, date: bankTransactions.date, amount: bankTransactions.amount, type: bankTransactions.type,
      description: bankTransactions.description, reference: bankTransactions.reference, status: bankTransactions.status,
      category: bankTransactions.category, isSimulated: bankTransactions.isSimulated, bankAccountId: bankTransactions.bankAccountId,
      bankName: bankAccounts.bankName,
    }).from(bankTransactions).innerJoin(bankAccounts, eq(bankAccounts.id, bankTransactions.bankAccountId))
      .where(and(eq(bankTransactions.businessId, ctx.businessId),
        q.bankAccountId ? eq(bankTransactions.bankAccountId, q.bankAccountId) : undefined,
        q.status ? eq(bankTransactions.status, q.status) : undefined))
      .orderBy(desc(bankTransactions.date)).limit(300);
  }

  @Post() @RequirePermissions('banks:write')
  async create(@Ctx() ctx: RequestContext, @Body() dto: TransactionDto) {
    await this.service.account(ctx.businessId, dto.bankAccountId);
    if (D(dto.amount).lte(0)) throw new BadRequestException('El valor debe ser mayor a 0');
    return this.service.addTransactions(ctx.businessId, dto.bankAccountId, [{
      date: new Date(dto.date), amount: m2(dto.amount), type: dto.type, description: dto.description, reference: dto.reference,
    }]);
  }

  @Post('import') @RequirePermissions('banks:write')
  async import(@Ctx() ctx: RequestContext, @Body() dto: ImportDto) {
    await this.service.account(ctx.businessId, dto.bankAccountId);
    return this.service.importCsv(ctx.businessId, dto.bankAccountId, dto.csv);
  }

  @Patch(':id') @RequirePermissions('banks:write')
  async update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTxDto) {
    const [t] = await this.db.update(bankTransactions).set(dto)
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.businessId, ctx.businessId), ne(bankTransactions.status, 'MATCHED'))).returning();
    if (!t) throw new NotFoundException('Movimiento no encontrado o ya conciliado');
    return t;
  }
}

@Controller('reconciliations')
export class ReconciliationsController {
  constructor(private service: BanksService) {}

  @Get('suggestions') @RequirePermissions('banks:read')
  suggestions(@Ctx() ctx: RequestContext) { return this.service.suggestions(ctx.businessId); }

  @Post(':id/accept') @RequirePermissions('banks:write')
  accept(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.decide(ctx, id, true); }

  @Post(':id/reject') @RequirePermissions('banks:write')
  reject(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.decide(ctx, id, false); }
}

@Module({
  controllers: [BankAccountsController, BankTransactionsController, ReconciliationsController],
  providers: [BanksService],
})
export class BanksModule {}
