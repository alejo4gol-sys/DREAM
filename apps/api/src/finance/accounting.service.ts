import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { D, num } from '../common/money';
import { Db, InjectDb } from '../db/db';
import {
  customers, expenses, incomes, purchasePayments, purchases, returns, salePayments, sales, suppliers,
} from '../db/schema';

export const EXPENSE_LABELS: Record<string, string> = {
  RENT: 'Arriendo', UTILITIES: 'Servicios', PAYROLL: 'Nómina', TRANSPORT: 'Transporte', ADVERTISING: 'Publicidad',
  MERCHANDISE: 'Compra de mercancía', BANK_FEES: 'Comisiones bancarias', TAXES: 'Impuestos', OTHER: 'Otros gastos',
};

/**
 * Contabilidad ADMINISTRATIVA / GERENCIAL (no financiera formal NIIF).
 * Ver docs/ARQUITECTURA.md §9 para fórmulas.
 */
@Injectable()
export class AccountingService {
  constructor(@InjectDb() private db: Db) {}

  private salesIn(businessId: string, from: Date, to: Date) {
    return and(eq(sales.businessId, businessId), gte(sales.date, from), lt(sales.date, to), isNull(sales.cancelledAt));
  }

  async salesTotals(businessId: string, from: Date, to: Date) {
    const [r] = await this.db.select({
      total: sql<string>`coalesce(sum(${sales.total}),0)`,
      tax: sql<string>`coalesce(sum(${sales.taxTotal}),0)`,
      discounts: sql<string>`coalesce(sum(${sales.discountTotal}),0)`,
      cost: sql<string>`coalesce(sum(${sales.costTotal}),0)`,
      count: sql<number>`count(*)::int`,
    }).from(sales).where(this.salesIn(businessId, from, to));
    return r;
  }

  async expensesByCategory(businessId: string, from: Date, to: Date) {
    const rows = await this.db.select({ category: expenses.category, total: sql<string>`sum(${expenses.amount})` })
      .from(expenses).where(and(eq(expenses.businessId, businessId), gte(expenses.date, from), lt(expenses.date, to)))
      .groupBy(expenses.category).orderBy(desc(sql`sum(${expenses.amount})`));
    return rows.map((r) => ({ category: r.category, label: EXPENSE_LABELS[r.category], total: num(r.total) }));
  }

  async incomeStatement(businessId: string, from: Date, to: Date) {
    const s = await this.salesTotals(businessId, from, to);
    const [oi] = await this.db.select({ total: sql<string>`coalesce(sum(${incomes.amount}),0)` }).from(incomes)
      .where(and(eq(incomes.businessId, businessId), gte(incomes.date, from), lt(incomes.date, to)));
    const byCat = (await this.expensesByCategory(businessId, from, to)).filter((e) => e.category !== 'MERCHANDISE');

    // Devoluciones: lo reembolsado resta ventas; lo que volvió al inventario resta el costo de ventas.
    const [rf] = await this.db.select({ total: sql<string>`coalesce(sum(${returns.refundAmount}),0)` }).from(returns)
      .where(and(eq(returns.businessId, businessId), eq(returns.status, 'REFUNDED'), gte(returns.resolvedAt, from), lt(returns.resolvedAt, to)));
    const [rc] = await this.db.select({ total: sql<string>`coalesce(sum(${returns.restockedCost}),0)` }).from(returns)
      .where(and(eq(returns.businessId, businessId), gte(returns.receivedAt, from), lt(returns.receivedAt, to)));
    const netSales = D(s.total).minus(s.tax).minus(rf.total);
    const cogs = D(s.cost).minus(rc.total);
    const gross = netSales.minus(cogs);
    const opex = byCat.reduce((a, e) => a.plus(e.total), D(0));
    const net = gross.plus(oi.total).minus(opex);
    return {
      period: { from, to },
      salesCount: s.count,
      grossSales: num(D(s.total).minus(s.tax).plus(s.discounts)),
      discounts: num(s.discounts),
      returns: num(rf.total),
      netSales: num(netSales),
      taxCollected: num(s.tax),
      costOfSales: num(cogs),
      grossProfit: num(gross),
      grossMargin: netSales.isZero() ? 0 : num(gross.div(netSales).times(100)),
      otherIncome: num(oi.total),
      operatingExpenses: num(opex),
      expensesByCategory: byCat,
      netProfit: num(net),
      netMargin: netSales.isZero() ? 0 : num(net.div(netSales).times(100)),
      disclaimer: 'Estado de resultados gerencial. No reemplaza la contabilidad financiera formal ni la asesoría de un contador público.',
    };
  }

  /** Flujo de caja por método directo: dinero que efectivamente entró y salió. */
  async cashFlow(businessId: string, from: Date, to: Date, tz: string, bucket: 'day' | 'month' = 'day') {
    const trunc = (col: unknown) => sql`date_trunc(${bucket}, ${col} at time zone ${tz})`;
    const key = (col: unknown) => sql<string>`to_char(${trunc(col)}, ${bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'})`;

    const inSales = await this.db.select({ k: key(salePayments.paidAt), v: sql<string>`sum(${salePayments.amount})` })
      .from(salePayments).innerJoin(sales, eq(sales.id, salePayments.saleId))
      .where(and(eq(sales.businessId, businessId), isNull(sales.cancelledAt), gte(salePayments.paidAt, from), lt(salePayments.paidAt, to)))
      .groupBy(sql`1`);
    const inOther = await this.db.select({ k: key(incomes.date), v: sql<string>`sum(${incomes.amount})` })
      .from(incomes).where(and(eq(incomes.businessId, businessId), gte(incomes.date, from), lt(incomes.date, to))).groupBy(sql`1`);
    const outExp = await this.db.select({ k: key(expenses.date), v: sql<string>`sum(${expenses.amount})` })
      .from(expenses).where(and(eq(expenses.businessId, businessId), eq(expenses.status, 'PAID'), gte(expenses.date, from), lt(expenses.date, to)))
      .groupBy(sql`1`);
    const outPur = await this.db.select({ k: key(purchasePayments.paidAt), v: sql<string>`sum(${purchasePayments.amount})` })
      .from(purchasePayments).innerJoin(purchases, eq(purchases.id, purchasePayments.purchaseId))
      .where(and(eq(purchases.businessId, businessId), gte(purchasePayments.paidAt, from), lt(purchasePayments.paidAt, to))).groupBy(sql`1`);

    const outRefunds = await this.db.select({ k: key(returns.resolvedAt), v: sql<string>`sum(${returns.refundAmount})` })
      .from(returns).where(and(eq(returns.businessId, businessId), eq(returns.status, 'REFUNDED'), ne(returns.refundMethod, 'STORE_CREDIT'),
        gte(returns.resolvedAt, from), lt(returns.resolvedAt, to))).groupBy(sql`1`);

    const map = new Map<string, { period: string; inflows: number; outflows: number }>();
    const add = (rows: { k: string; v: string }[], field: 'inflows' | 'outflows') => {
      for (const r of rows) {
        const e = map.get(r.k) ?? { period: r.k, inflows: 0, outflows: 0 };
        e[field] = num(D(e[field]).plus(r.v));
        map.set(r.k, e);
      }
    };
    add(inSales, 'inflows'); add(inOther, 'inflows'); add(outExp, 'outflows'); add(outPur, 'outflows'); add(outRefunds, 'outflows');
    const series = [...map.values()].sort((a, b) => a.period.localeCompare(b.period)).map((e) => ({ ...e, net: num(D(e.inflows).minus(e.outflows)) }));
    const sum = (rows: { v: string }[]) => rows.reduce((a, r) => a.plus(r.v), D(0));
    const inflows = sum(inSales).plus(sum(inOther));
    const outflows = sum(outExp).plus(sum(outPur)).plus(sum(outRefunds));
    return {
      inflows: num(inflows), outflows: num(outflows), net: num(inflows.minus(outflows)),
      detail: {
        salesCollections: num(sum(inSales)), otherIncome: num(sum(inOther)),
        expensesPaid: num(sum(outExp)), supplierPayments: num(sum(outPur)), refundsPaid: num(sum(outRefunds)),
      },
      series,
    };
  }

  /** Saldo acumulado de caja desde el inicio (entradas − salidas registradas). */
  async cashBalance(businessId: string) {
    const r = await this.cashFlow(businessId, new Date(0), new Date(Date.now() + 86_400_000), 'UTC', 'month');
    return r.net;
  }

  async receivables(businessId: string) {
    const rows = await this.db.select({
      id: sales.id, number: sales.number, date: sales.date, total: sales.total, amountPaid: sales.amountPaid,
      balance: sql<string>`${sales.total} - ${sales.amountPaid}`, customerName: customers.name, customerPhone: customers.phone,
    }).from(sales).leftJoin(customers, eq(customers.id, sales.customerId))
      .where(and(eq(sales.businessId, businessId), inArray(sales.status, ['PENDING', 'PARTIALLY_PAID'])))
      .orderBy(asc(sales.date));
    return { total: num(rows.reduce((a, r) => a.plus(r.balance), D(0))), items: rows.map((r) => ({ ...r, balance: num(r.balance) })) };
  }

  async payables(businessId: string) {
    const pur = await this.db.select({
      id: purchases.id, date: purchases.date, total: purchases.total, amountPaid: purchases.amountPaid,
      balance: sql<string>`${purchases.total} - ${purchases.amountPaid}`, supplierName: suppliers.name,
    }).from(purchases).innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
      .where(and(eq(purchases.businessId, businessId), ne(purchases.status, 'PAID'))).orderBy(asc(purchases.date));
    const exp = await this.db.select({
      id: expenses.id, date: expenses.date, dueDate: expenses.dueDate, description: expenses.description,
      category: expenses.category, amount: expenses.amount, supplierName: suppliers.name,
    }).from(expenses).leftJoin(suppliers, eq(suppliers.id, expenses.supplierId))
      .where(and(eq(expenses.businessId, businessId), eq(expenses.status, 'PENDING'))).orderBy(asc(expenses.dueDate));
    const total = pur.reduce((a, r) => a.plus(r.balance), D(0)).plus(exp.reduce((a, r) => a.plus(r.amount), D(0)));
    return {
      total: num(total),
      purchases: pur.map((r) => ({ ...r, balance: num(r.balance) })),
      expenses: exp.map((r) => ({ ...r, amount: num(r.amount), label: EXPENSE_LABELS[r.category] })),
    };
  }
}
