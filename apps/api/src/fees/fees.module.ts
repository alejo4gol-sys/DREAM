import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { m2 } from '../common/money';
import { Db, InjectDb } from '../db/db';
import { businesses, customers, FeeSettings, feeQuotes } from '../db/schema';
import { ServicesModule, ServicesService } from '../services/services.module';
import { calculateQuote, defaultTableFor, FEE_TABLES, findItem, QuoteInput, QuoteResult, SMMLV_2026 } from './fee-engine';
import { CITY_FACTORS, LEVELS, MODS } from './fee-types';

const MONEY = /^\d{1,13}(?:\.\d{1,2})?$/;
const CITIES = Object.keys(CITY_FACTORS);
const LEVEL_KEYS = Object.keys(LEVELS);

class LineDto {
  @IsString() @Length(1, 40) itemKey: string;
  @IsOptional() @IsString() @MaxLength(30) variant?: string;
  @IsOptional() @Matches(MONEY) base?: string;
  @IsOptional() @Matches(/^\d{1,4}(?:\.\d{1,2})?$/) quantity?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsIn(Object.keys(MODS), { each: true }) mods?: string[];
  @IsOptional() @IsString() @MaxLength(200) label?: string;
  @IsOptional() @Matches(MONEY) amount?: string;
}
class ExpenseDto {
  @IsString() @Length(1, 120) label: string;
  @Matches(MONEY) amount: string;
}
class CalcDto {
  @IsOptional() @IsIn(FEE_TABLES.map((t) => t.key)) tableKey?: string;
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ExpenseDto) expenses?: ExpenseDto[];
  @IsOptional() @IsIn(LEVEL_KEYS) level?: string;
  @IsOptional() @IsIn(CITIES) city?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-50) @Max(200) adjustPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) discountPct?: number;
  @IsOptional() @IsBoolean() iva?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) advancePct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) installments?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(50) successPct?: number;
  @IsOptional() @Matches(MONEY) successBase?: string;
}
class SaveDto extends CalcDto {
  @IsString() @Length(2, 200) title: string;
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) area?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
}
class SettingsDto {
  @IsOptional() @Matches(/^\d{6,8}$/) smmlv?: string;
  @IsOptional() @IsBoolean() ivaResponsable?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30) ivaRate?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) advancePct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) installments?: number;
  @IsOptional() @IsIn(CITIES) city?: string;
  @IsOptional() @IsIn(LEVEL_KEYS) level?: string;
  @IsOptional() @Matches(MONEY) hourlyRate?: string;
  @IsOptional() @IsIn(FEE_TABLES.map((t) => t.key)) tableKey?: string;
}
class ListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

@Injectable()
export class FeesService {
  constructor(@InjectDb() private db: Db, private services: ServicesService) {}

  async settings(businessId: string) {
    const b = await this.db.query.businesses.findFirst({ where: eq(businesses.id, businessId), columns: { feeSettings: true, serviceProfile: true } });
    if (!b) throw new NotFoundException('Negocio no encontrado');
    const s: FeeSettings = b.feeSettings ?? {};
    return {
      smmlv: s.smmlv ?? String(SMMLV_2026), smmlvDefault: String(SMMLV_2026), ivaResponsable: s.ivaResponsable ?? false, ivaRate: s.ivaRate ?? 19,
      advancePct: s.advancePct ?? 50, installments: s.installments ?? 1, city: s.city ?? 'BOGOTA', level: s.level ?? 'MID',
      hourlyRate: s.hourlyRate ?? null, tableKey: s.tableKey ?? defaultTableFor(b.serviceProfile),
    };
  }

  async saveSettings(businessId: string, dto: SettingsDto) {
    const cur = await this.db.query.businesses.findFirst({ where: eq(businesses.id, businessId), columns: { feeSettings: true } });
    const next: FeeSettings = { ...(cur?.feeSettings ?? {}) };
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) (next as any)[k] = v;
    if (next.smmlv && Number(next.smmlv) < 500_000) throw new BadRequestException('El salario mínimo no parece válido.');
    await this.db.update(businesses).set({ feeSettings: next }).where(eq(businesses.id, businessId));
    return this.settings(businessId);
  }

  catalog() {
    return {
      tables: FEE_TABLES, mods: MODS, cities: CITY_FACTORS, levels: LEVELS, smmlvDefault: SMMLV_2026,
      cuantias: { minima: 40, menor: 150, source: 'Código General del Proceso, art. 25' },
    };
  }

  async calculate(businessId: string, dto: CalcDto): Promise<QuoteResult> {
    const s = await this.settings(businessId);
    for (const l of dto.lines) if (l.itemKey !== 'CUSTOM' && !findItem(l.itemKey)) throw new BadRequestException(`Tarifa desconocida: ${l.itemKey}`);
    return calculateQuote({ ...(dto as QuoteInput), ivaRate: s.ivaRate }, Number(s.smmlv));
  }

  private async assertCustomer(businessId: string, customerId?: string | null) {
    if (!customerId) return;
    const c = await this.db.query.customers.findFirst({ where: and(eq(customers.id, customerId), eq(customers.businessId, businessId)), columns: { id: true } });
    if (!c) throw new BadRequestException('El cliente no existe en este negocio.');
  }

  private splitInput(dto: SaveDto) {
    const { title, customerId, area, description, ...input } = dto;
    return { title: title.trim(), customerId: customerId ?? null, area: area ?? null, description: description?.trim() || null, input };
  }

  async list(businessId: string, q: ListQuery) {
    const term = q.q?.trim();
    const rows = await this.db.select({
      id: feeQuotes.id, number: feeQuotes.number, title: feeQuotes.title, tableKey: feeQuotes.tableKey, area: feeQuotes.area, total: feeQuotes.total,
      jobId: feeQuotes.jobId, createdAt: feeQuotes.createdAt, customerId: feeQuotes.customerId, customerName: customers.name,
    }).from(feeQuotes).leftJoin(customers, eq(customers.id, feeQuotes.customerId))
      .where(and(eq(feeQuotes.businessId, businessId), term ? or(ilike(feeQuotes.title, `%${term}%`), ilike(customers.name, `%${term}%`)) : undefined))
      .orderBy(desc(feeQuotes.createdAt)).limit(100);
    return rows;
  }

  async get(businessId: string, id: string) {
    const [row] = await this.db.select({ q: feeQuotes, customerName: customers.name, customerPhone: customers.phone })
      .from(feeQuotes).leftJoin(customers, eq(customers.id, feeQuotes.customerId))
      .where(and(eq(feeQuotes.id, id), eq(feeQuotes.businessId, businessId))).limit(1);
    if (!row) throw new NotFoundException('Propuesta no encontrada');
    return { ...row.q, customerName: row.customerName, customerPhone: row.customerPhone };
  }

  async create(ctx: RequestContext, dto: SaveDto) {
    if (!dto.lines.length) throw new BadRequestException('Agrega al menos un concepto a la propuesta.');
    await this.assertCustomer(ctx.businessId, dto.customerId);
    const result = await this.calculate(ctx.businessId, dto);
    const { title, customerId, area, description, input } = this.splitInput(dto);
    const tableKey = dto.tableKey ?? result.lines.find((l) => l.table)?.table ?? 'LEGAL';
    const id = await this.db.transaction(async (tx) => {
      await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, ctx.businessId)).for('update');
      const [r] = await tx.select({ n: sql<number>`coalesce(max(${feeQuotes.number}), 0)::int + 1` }).from(feeQuotes).where(eq(feeQuotes.businessId, ctx.businessId));
      const [q] = await tx.insert(feeQuotes).values({ businessId: ctx.businessId, number: r.n, customerId, title, tableKey, area, description, input, result, total: m2(result.total), createdById: ctx.userId }).returning({ id: feeQuotes.id });
      return q.id;
    });
    return this.get(ctx.businessId, id);
  }

  async update(ctx: RequestContext, id: string, dto: SaveDto) {
    await this.get(ctx.businessId, id);
    await this.assertCustomer(ctx.businessId, dto.customerId);
    const result = await this.calculate(ctx.businessId, dto);
    const { title, customerId, area, description, input } = this.splitInput(dto);
    await this.db.update(feeQuotes).set({ title, customerId, area, description, input, result, total: m2(result.total), tableKey: dto.tableKey ?? result.lines.find((l) => l.table)?.table ?? 'LEGAL' })
      .where(and(eq(feeQuotes.id, id), eq(feeQuotes.businessId, ctx.businessId)));
    return this.get(ctx.businessId, id);
  }

  async remove(ctx: RequestContext, id: string) {
    await this.get(ctx.businessId, id);
    await this.db.delete(feeQuotes).where(and(eq(feeQuotes.id, id), eq(feeQuotes.businessId, ctx.businessId)));
    return { ok: true };
  }

  /** Convierte la propuesta en un caso u orden de servicio en estado «Cotización», con cada concepto como ítem. */
  async toJob(ctx: RequestContext, id: string) {
    const q = await this.get(ctx.businessId, id);
    if (q.jobId) return { jobId: q.jobId, existing: true };
    const r = q.result as QuoteResult;
    const factor = r.feesSubtotal > 0 ? r.feesNet / r.feesSubtotal : 1;
    const items: { kind: 'FEE' | 'EXPENSE' | 'SERVICE'; description: string; quantity: string; unitPrice: string }[] = [];
    const feeLines = r.lines.filter((l) => l.amount > 0);
    let allocated = 0;
    feeLines.forEach((l, idx) => {
      // Reparte ajuste y descuento entre los conceptos en pesos enteros; el último absorbe la diferencia de redondeo.
      const lineTotal = idx === feeLines.length - 1 ? r.feesNet - allocated : Math.round(l.amount * factor);
      allocated += lineTotal;
      const qtyOk = Number.isInteger(lineTotal / l.quantity);
      const label = [l.ref ? `${l.ref}.` : '', l.label, l.variantLabel ? `— ${l.variantLabel}` : '', !qtyOk && l.quantity !== 1 ? `(${l.quantity} × ${l.unit ?? 'unidad'})` : ''].filter(Boolean).join(' ');
      items.push({ kind: 'FEE', description: label.slice(0, 200), quantity: qtyOk ? String(l.quantity) : '1', unitPrice: (qtyOk ? lineTotal / l.quantity : lineTotal).toFixed(2) });
    });
    if (r.ivaAmount > 0) items.push({ kind: 'FEE', description: `IVA (${r.ivaRate} %) sobre honorarios`, quantity: '1', unitPrice: r.ivaAmount.toFixed(2) });
    for (const e of r.expenses) items.push({ kind: 'EXPENSE', description: e.label.slice(0, 200), quantity: '1', unitPrice: e.amount.toFixed(2) });
    if (!items.length) throw new BadRequestException('La propuesta no tiene valores para pasar a un caso.');
    const plan = r.schedule.map((s) => `• ${s.label}: $${Math.round(s.amount).toLocaleString('es-CO')}`).join('\n');
    const description = [q.description, plan ? `Forma de pago propuesta:\n${plan}` : '', r.success ? `Honorario de resultado: ${r.success.pct} % de lo que se obtenga.` : '']
      .filter(Boolean).join('\n\n').slice(0, 8000);
    const table = FEE_TABLES.find((t) => t.key === q.tableKey);
    const details: Record<string, string> = {};
    if (table?.key === 'LEGAL') {
      // Las áreas de la ficha del caso son una lista fija (ver service-profiles.ts en el frontend).
      const AREA: Record<string, string> = { FAMILIA: 'Familia', LABORAL: 'Laboral', ADMINISTRATIVO: 'Administrativo', COMERCIAL: 'Comercial', INDUSTRIAL: 'Comercial', PENAL: 'Penal', MILITAR: 'Penal', POLICIA: 'Otro', SANITARIO: 'Otro', MINERO: 'Otro' };
      const key = feeLines[0]?.area ?? q.area ?? '';
      details.area = AREA[key] ?? 'Civil';
      if (feeLines[0]) details.process = `${feeLines[0].label}${feeLines[0].variantLabel ? ` — ${feeLines[0].variantLabel}` : ''}`.slice(0, 200);
    }
    const job = await this.services.create(ctx, {
      title: q.title, details, customerId: q.customerId, status: 'QUOTE',
      category: FEE_TABLES.find((t) => t.key === q.tableKey)?.areas.find((a) => a.key === q.area)?.label.slice(0, 80) ?? undefined, description, items: items.slice(0, 60),
    } as any);
    await this.db.update(feeQuotes).set({ jobId: job.id }).where(and(eq(feeQuotes.id, id), eq(feeQuotes.businessId, ctx.businessId)));
    return { jobId: job.id, existing: false };
  }
}

@Controller()
export class FeesController {
  constructor(private s: FeesService) {}
  @RequirePermissions('sales:read') @Get('fees/catalog') catalog() { return this.s.catalog(); }
  @RequirePermissions('sales:read') @Get('fees/settings') settings(@Ctx() ctx: RequestContext) { return this.s.settings(ctx.businessId); }
  @RequirePermissions('business:manage') @Put('fees/settings') saveSettings(@Ctx() ctx: RequestContext, @Body() dto: SettingsDto) { return this.s.saveSettings(ctx.businessId, dto); }
  @RequirePermissions('sales:read') @Post('fees/calculate') calculate(@Ctx() ctx: RequestContext, @Body() dto: CalcDto) { return this.s.calculate(ctx.businessId, dto); }
  @RequirePermissions('sales:read') @Get('fee-quotes') list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) { return this.s.list(ctx.businessId, q); }
  @RequirePermissions('sales:read') @Get('fee-quotes/:id') get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('fee-quotes') create(@Ctx() ctx: RequestContext, @Body() dto: SaveDto) { return this.s.create(ctx, dto); }
  @RequirePermissions('sales:create') @Put('fee-quotes/:id') update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveDto) { return this.s.update(ctx, id, dto); }
  @RequirePermissions('sales:create') @Delete('fee-quotes/:id') remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.remove(ctx, id); }
  @RequirePermissions('sales:create') @Post('fee-quotes/:id/job') toJob(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.toJob(ctx, id); }
}

@Module({ imports: [ServicesModule], controllers: [FeesController], providers: [FeesService] })
export class FeesModule {}
