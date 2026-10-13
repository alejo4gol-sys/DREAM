import { BadRequestException, Controller, ForbiddenException, Get, Module, Param, Query, Res } from '@nestjs/common';
import { IsIn, IsOptional, Matches } from 'class-validator';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { Ctx, RequestContext } from '../common/auth.guard';
import { parsePeriod } from '../common/dates';
import { PlanLimitsService } from '../common/plan-limits.service';
import { Db, InjectDb } from '../db/db';
import {
  bankAccounts, bankTransactions, businesses, categories, customers, expenses, incomes, inventoryLevels, products,
  reconciliations, reports, sales, suppliers,
} from '../db/schema';
import { AccountingService, EXPENSE_LABELS } from '../finance/accounting.service';
import { FinanceModule } from '../finance/finance.module';

type Col = { key: string; label: string; type?: 'money' | 'date' | 'number' };
type Table = { title: string; columns: Col[]; rows: Record<string, unknown>[] };

export const REPORT_TYPES: Record<string, { label: string; permission: string }> = {
  sales: { label: 'Ventas', permission: 'sales:read' },
  expenses: { label: 'Gastos', permission: 'finance:read' },
  incomes: { label: 'Otros ingresos', permission: 'finance:read' },
  profit: { label: 'Estado de resultados', permission: 'finance:read' },
  'cash-flow': { label: 'Flujo de caja', permission: 'finance:read' },
  inventory: { label: 'Inventario', permission: 'products:read' },
  customers: { label: 'Clientes', permission: 'customers:read' },
  suppliers: { label: 'Proveedores', permission: 'suppliers:read' },
  'bank-transactions': { label: 'Movimientos bancarios', permission: 'banks:read' },
  reconciliations: { label: 'Conciliaciones', permission: 'banks:read' },
  social: { label: 'Ventas por canal / redes', permission: 'sales:read' },
};

const STATUS: Record<string, string> = { PENDING: 'Pendiente', PARTIALLY_PAID: 'Abono parcial', PAID: 'Pagada', CANCELLED: 'Anulada' };

class ReportQuery {
  @IsIn(['csv', 'xlsx', 'pdf']) format: 'csv' | 'xlsx' | 'pdf';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

@Controller('reports')
export class ReportsController {
  constructor(@InjectDb() private db: Db, private acc: AccountingService, private limits: PlanLimitsService) {}

  @Get()
  types(@Ctx() ctx: RequestContext) {
    return Object.entries(REPORT_TYPES).filter(([, v]) => ctx.permissions.has(v.permission)).map(([type, v]) => ({ type, label: v.label }));
  }

  @Get(':type')
  async download(@Ctx() ctx: RequestContext, @Param('type') type: string, @Query() q: ReportQuery, @Res() res: Response) {
    const def = REPORT_TYPES[type];
    if (!def) throw new BadRequestException('Tipo de reporte desconocido');
    if (!ctx.permissions.has(def.permission)) throw new ForbiddenException('Tu rol no tiene acceso a este reporte');
    const { limits, name } = await this.limits.limits(ctx.businessId);
    if (!limits.reportFormats.includes(q.format)) {
      throw new ForbiddenException(`El plan ${name} permite exportar en: ${limits.reportFormats.join(', ').toUpperCase()}`);
    }
    const p = parsePeriod(ctx.timezone, q.from, q.to);
    const business = await this.db.query.businesses.findFirst({ where: eq(businesses.id, ctx.businessId) });
    const table = await this.build(ctx, type, p.from, p.to);
    await this.db.insert(reports).values({ businessId: ctx.businessId, type, format: q.format, params: { from: q.from, to: q.to }, createdById: ctx.userId });

    const stamp = `${q.from ?? p.from.toISOString().slice(0, 10)}_${q.to ?? p.to.toISOString().slice(0, 10)}`;
    const filename = `dream-${type}-${stamp}.${q.format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const subtitle = `${business?.tradeName ?? ''} · ${p.from.toISOString().slice(0, 10)} a ${new Date(p.to.getTime() - 1).toISOString().slice(0, 10)}`;

    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send('﻿' + toCsv(table));
    } else if (q.format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(Buffer.from(await toXlsx(table, subtitle)));
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(await toPdf(table, subtitle));
    }
  }

  private async build(ctx: RequestContext, type: string, from: Date, to: Date): Promise<Table> {
    const b = ctx.businessId;
    switch (type) {
      case 'sales': {
        const rows = await this.db.select({
          number: sales.number, date: sales.date, customer: customers.name, channel: sales.channel, method: sales.paymentMethod,
          status: sales.status, subtotal: sales.subtotal, discount: sales.discountTotal, tax: sales.taxTotal, total: sales.total,
          paid: sales.amountPaid, cost: sales.costTotal,
        }).from(sales).leftJoin(customers, eq(customers.id, sales.customerId))
          .where(and(eq(sales.businessId, b), gte(sales.date, from), lt(sales.date, to))).orderBy(asc(sales.date));
        return {
          title: 'Reporte de ventas',
          columns: [
            { key: 'number', label: 'N°' }, { key: 'date', label: 'Fecha', type: 'date' }, { key: 'customer', label: 'Cliente' },
            { key: 'channel', label: 'Canal' }, { key: 'method', label: 'Pago' }, { key: 'status', label: 'Estado' },
            { key: 'subtotal', label: 'Subtotal', type: 'money' }, { key: 'discount', label: 'Descuento', type: 'money' },
            { key: 'tax', label: 'Impuestos', type: 'money' }, { key: 'total', label: 'Total', type: 'money' },
            { key: 'paid', label: 'Pagado', type: 'money' }, { key: 'cost', label: 'Costo', type: 'money' },
          ],
          rows: rows.map((r) => ({ ...r, status: STATUS[r.status], customer: r.customer ?? 'Consumidor final' })),
        };
      }
      case 'expenses': {
        const rows = await this.db.select({ date: expenses.date, category: expenses.category, description: expenses.description, amount: expenses.amount, status: expenses.status, supplier: suppliers.name })
          .from(expenses).leftJoin(suppliers, eq(suppliers.id, expenses.supplierId))
          .where(and(eq(expenses.businessId, b), gte(expenses.date, from), lt(expenses.date, to))).orderBy(asc(expenses.date));
        return {
          title: 'Reporte de gastos',
          columns: [{ key: 'date', label: 'Fecha', type: 'date' }, { key: 'category', label: 'Categoría' }, { key: 'description', label: 'Descripción' },
            { key: 'supplier', label: 'Proveedor' }, { key: 'status', label: 'Estado' }, { key: 'amount', label: 'Valor', type: 'money' }],
          rows: rows.map((r) => ({ ...r, category: EXPENSE_LABELS[r.category], status: r.status === 'PAID' ? 'Pagado' : 'Pendiente' })),
        };
      }
      case 'incomes': {
        const rows = await this.db.select().from(incomes).where(and(eq(incomes.businessId, b), gte(incomes.date, from), lt(incomes.date, to))).orderBy(asc(incomes.date));
        return { title: 'Otros ingresos', columns: [{ key: 'date', label: 'Fecha', type: 'date' }, { key: 'category', label: 'Categoría' }, { key: 'description', label: 'Descripción' }, { key: 'amount', label: 'Valor', type: 'money' }], rows };
      }
      case 'profit': {
        const s = await this.acc.incomeStatement(b, from, to);
        const rows: Record<string, unknown>[] = [
          { concept: 'Ventas brutas (antes de descuentos e impuestos)', value: s.grossSales },
          { concept: '(-) Descuentos', value: -s.discounts },
          { concept: 'Ventas netas', value: s.netSales },
          { concept: '(-) Costo de ventas', value: -s.costOfSales },
          { concept: 'Utilidad bruta', value: s.grossProfit },
          { concept: '(+) Otros ingresos', value: s.otherIncome },
          ...s.expensesByCategory.map((e) => ({ concept: `(-) ${e.label}`, value: -e.total })),
          { concept: 'Utilidad neta estimada', value: s.netProfit },
          { concept: 'Margen neto (%)', value: s.netMargin },
          { concept: 'IVA/impuestos cobrados (no es ingreso)', value: s.taxCollected },
        ];
        return { title: 'Estado de resultados (gerencial)', columns: [{ key: 'concept', label: 'Concepto' }, { key: 'value', label: 'Valor', type: 'money' }], rows: [...rows, { concept: s.disclaimer, value: null }] };
      }
      case 'cash-flow': {
        const cf = await this.acc.cashFlow(b, from, to, ctx.timezone, 'day');
        return {
          title: 'Flujo de caja',
          columns: [{ key: 'period', label: 'Día' }, { key: 'inflows', label: 'Entradas', type: 'money' }, { key: 'outflows', label: 'Salidas', type: 'money' }, { key: 'net', label: 'Neto', type: 'money' }],
          rows: [...cf.series, { period: 'TOTAL', inflows: cf.inflows, outflows: cf.outflows, net: cf.net }],
        };
      }
      case 'inventory': {
        const stock = sql<number>`coalesce(sum(${inventoryLevels.quantity}),0)::int`;
        const rows = await this.db.select({ sku: products.sku, name: products.name, category: categories.name, stock, minStock: products.minStock, cost: products.costPrice, price: products.salePrice })
          .from(products).leftJoin(inventoryLevels, eq(inventoryLevels.productId, products.id)).leftJoin(categories, eq(categories.id, products.categoryId))
          .where(and(eq(products.businessId, b), eq(products.isActive, true), eq(products.isService, false))).groupBy(products.id, categories.name).orderBy(asc(products.name));
        return {
          title: 'Inventario',
          columns: [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Producto' }, { key: 'category', label: 'Categoría' }, { key: 'stock', label: 'Stock', type: 'number' },
            { key: 'minStock', label: 'Mínimo', type: 'number' }, { key: 'cost', label: 'Costo', type: 'money' }, { key: 'price', label: 'Precio', type: 'money' }, { key: 'value', label: 'Valor al costo', type: 'money' }],
          rows: rows.map((r) => ({ ...r, value: r.stock * Number(r.cost) })),
        };
      }
      case 'customers': {
        const rows = await this.db.select().from(customers).where(eq(customers.businessId, b)).orderBy(desc(customers.totalSpent));
        return {
          title: 'Clientes',
          columns: [{ key: 'name', label: 'Nombre' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo' }, { key: 'city', label: 'Ciudad' },
            { key: 'channel', label: 'Canal' }, { key: 'purchaseCount', label: 'Compras', type: 'number' }, { key: 'totalSpent', label: 'Total comprado', type: 'money' }, { key: 'lastPurchaseAt', label: 'Última compra', type: 'date' }],
          rows,
        };
      }
      case 'suppliers': {
        const rows = await this.db.select({
          name: suppliers.name, company: suppliers.company, taxId: suppliers.taxId, phone: suppliers.phone, email: suppliers.email,
          debt: sql<string>`coalesce((select sum(total - amount_paid) from purchases where purchases.supplier_id = "suppliers"."id"),0)`,
        }).from(suppliers).where(eq(suppliers.businessId, b)).orderBy(asc(suppliers.name));
        return { title: 'Proveedores', columns: [{ key: 'name', label: 'Nombre' }, { key: 'company', label: 'Empresa' }, { key: 'taxId', label: 'NIT' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo' }, { key: 'debt', label: 'Deuda', type: 'money' }], rows };
      }
      case 'bank-transactions': {
        const rows = await this.db.select({ date: bankTransactions.date, bank: bankAccounts.bankName, description: bankTransactions.description, type: bankTransactions.type, amount: bankTransactions.amount, status: bankTransactions.status, simulated: bankTransactions.isSimulated })
          .from(bankTransactions).innerJoin(bankAccounts, eq(bankAccounts.id, bankTransactions.bankAccountId))
          .where(and(eq(bankTransactions.businessId, b), gte(bankTransactions.date, from), lt(bankTransactions.date, to))).orderBy(asc(bankTransactions.date));
        return {
          title: 'Movimientos bancarios',
          columns: [{ key: 'date', label: 'Fecha', type: 'date' }, { key: 'bank', label: 'Banco' }, { key: 'description', label: 'Descripción' }, { key: 'type', label: 'Tipo' }, { key: 'amount', label: 'Valor', type: 'money' }, { key: 'status', label: 'Estado' }, { key: 'simulated', label: 'Simulado' }],
          rows: rows.map((r) => ({ ...r, type: r.type === 'CREDIT' ? 'Ingreso' : 'Egreso', simulated: r.simulated ? 'Sí' : 'No' })),
        };
      }
      case 'reconciliations': {
        const rows = await this.db.select({ decidedAt: reconciliations.decidedAt, status: reconciliations.status, score: reconciliations.score, txDate: bankTransactions.date, description: bankTransactions.description, amount: bankTransactions.amount, sale: sales.number })
          .from(reconciliations).innerJoin(bankTransactions, eq(bankTransactions.id, reconciliations.bankTransactionId)).leftJoin(sales, eq(sales.id, reconciliations.saleId))
          .where(and(eq(reconciliations.businessId, b), gte(bankTransactions.date, from), lt(bankTransactions.date, to))).orderBy(asc(bankTransactions.date));
        return {
          title: 'Conciliaciones',
          columns: [{ key: 'txDate', label: 'Fecha mov.', type: 'date' }, { key: 'description', label: 'Movimiento' }, { key: 'amount', label: 'Valor', type: 'money' }, { key: 'sale', label: 'Venta #' }, { key: 'score', label: 'Coincidencia %', type: 'number' }, { key: 'status', label: 'Estado' }, { key: 'decidedAt', label: 'Decidido', type: 'date' }],
          rows,
        };
      }
      case 'social': {
        const rows = await this.db.select({ channel: sales.channel, orders: sql<number>`count(*)::int`, total: sql<string>`sum(${sales.total})` })
          .from(sales).where(and(eq(sales.businessId, b), gte(sales.date, from), lt(sales.date, to), sql`${sales.cancelledAt} is null`)).groupBy(sales.channel);
        return { title: 'Ventas por canal', columns: [{ key: 'channel', label: 'Canal' }, { key: 'orders', label: 'Pedidos', type: 'number' }, { key: 'total', label: 'Ventas', type: 'money' }], rows };
      }
    }
    throw new BadRequestException('Tipo de reporte desconocido');
  }
}

const fmtDate = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : '');
const cell = (c: Col, v: unknown) => (v === null || v === undefined ? '' : c.type === 'date' ? fmtDate(v) : c.type === 'money' || c.type === 'number' ? Number(v) : String(v));

export function toCsv(t: Table) {
  const esc = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = `'${s}`; // evita inyección de fórmulas
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns.map((c) => esc(c.label)).join(','), ...t.rows.map((r) => t.columns.map((c) => esc(cell(c, r[c.key]))).join(','))].join('\n');
}

async function toXlsx(t: Table, subtitle: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DREAMS';
  const ws = wb.addWorksheet(t.title.slice(0, 31));
  ws.addRow([t.title]).font = { bold: true, size: 14 };
  ws.addRow([subtitle]).font = { color: { argb: 'FF6B645A' } };
  ws.addRow([]);
  const header = ws.addRow(t.columns.map((c) => c.label));
  header.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } }; });
  for (const r of t.rows) ws.addRow(t.columns.map((c) => cell(c, r[c.key])));
  t.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(12, Math.min(48, c.label.length + 6));
    if (c.type === 'money') col.numFmt = '#,##0.00';
  });
  return wb.xlsx.writeBuffer();
}

function toPdf(t: Table, subtitle: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', layout: t.columns.length > 6 ? 'landscape' : 'portrait', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text('DREAMS', { characterSpacing: 4 });
    doc.moveDown(0.3).font('Helvetica-Bold').fontSize(13).text(t.title);
    doc.font('Helvetica').fontSize(9).fillColor('#6B645A').text(subtitle).moveDown();
    const width = doc.page.width - 80;
    const colW = width / t.columns.length;
    const drawRow = (vals: string[], bold = false, fill?: string) => {
      const y = doc.y;
      if (y > doc.page.height - 60) { doc.addPage(); }
      const yy = doc.y;
      if (fill) doc.rect(40, yy - 2, width, 16).fill(fill);
      doc.fillColor(fill === '#111111' ? '#FFFFFF' : '#111111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      vals.forEach((v, i) => doc.text(v, 40 + i * colW + 2, yy, { width: colW - 4, height: 12, ellipsis: true, align: t.columns[i].type ? 'right' : 'left', lineBreak: false }));
      doc.x = 40; doc.y = yy + 16;
    };
    drawRow(t.columns.map((c) => c.label), true, '#111111');
    t.rows.forEach((r, idx) => drawRow(t.columns.map((c) => {
      const v = cell(c, r[c.key]);
      return c.type === 'money' && v !== '' ? Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0 }) : String(v);
    }), false, idx % 2 ? '#F3EEE4' : undefined));
    doc.moveDown(2).font('Helvetica').fontSize(7).fillColor('#6B645A')
      .text(`Generado por DREAMS el ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Información gerencial; no reemplaza la contabilidad formal.`, 40);
    doc.end();
  });
}

@Module({ imports: [FinanceModule], controllers: [ReportsController] })
export class ReportsModule {}
