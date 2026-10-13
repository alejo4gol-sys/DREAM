import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Logger, Module, NotFoundException, OnModuleDestroy, OnModuleInit, Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { and, asc, eq, ilike, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { Db, InjectDb } from '../db/db';
import { customers, jobs, legalTerms } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertsService } from '../whatsapp/whatsapp.module';
import { TermInput, computeTerm, daysUntil, findRule, holidays } from './term-engine';
import { AREAS, GUIDE, PHENOMENA, TERM_RULES } from './term-rules';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const THRESHOLDS = [30, 15, 7, 3, 1, 0];

class PeriodDto {
  @Matches(DATE) from: string;
  @Matches(DATE) to: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
}
class PenalDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.1) @Max(60) maxPenaltyYears?: number;
  @IsOptional() @IsBoolean() publicServant?: boolean;
  @IsOptional() @IsBoolean() special30?: boolean;
  @IsOptional() @IsBoolean() imprescriptible?: boolean;
}
class CalcDto {
  @IsIn(TERM_RULES.map((r) => r.key)) ruleKey: string;
  @Matches(DATE) eventDate: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PeriodDto) suspensions?: PeriodDto[];
  @IsOptional() @Matches(DATE) interruptionDate?: string | null;
  @IsOptional() @IsBoolean() vacation?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(36) offsetMonths?: number;
  @IsOptional() @ValidateNested() @Type(() => PenalDto) penal?: PenalDto;
}
class SaveDto extends CalcDto {
  @IsString() @Length(2, 200) title: string;
  @IsOptional() @IsUUID() jobId?: string | null;
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsInt({ each: true }) checklist?: number[];
  @IsOptional() @IsBoolean() syncJobDue?: boolean;
}
class StatusDto {
  @IsIn(['ACTIVE', 'FILED', 'LAPSED', 'ARCHIVED']) status: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
class ListQuery {
  @IsOptional() @IsIn(['ACTIVE', 'FILED', 'LAPSED', 'ARCHIVED', 'ALL']) status?: string;
  @IsOptional() @IsUUID() jobId?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

export const levelOf = (days: number | null, status: string) =>
  status !== 'ACTIVE' ? 'CLOSED' : days == null ? 'NONE' : days < 0 ? 'EXPIRED' : days <= 7 ? 'RED' : days <= 30 ? 'YELLOW' : 'GREEN';

@Injectable()
export class LegalTermsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LegalTermsService.name);
  private timer?: NodeJS.Timeout;
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService, private alerts: AlertsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    // Revisión periódica de vencimientos (cada 6 horas) para avisar aunque nadie abra la sección.
    this.timer = setInterval(() => this.scanAll().catch((e) => this.logger.warn(e.message)), 6 * 3600_000);
    setTimeout(() => this.scanAll().catch((e) => this.logger.warn(e.message)), 30_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  catalog() {
    const y = new Date().getFullYear();
    const hol = [y, y + 1].flatMap((yy) => [...holidays(yy).entries()].map(([date, name]) => ({ date, name })));
    return { rules: TERM_RULES, areas: AREAS, phenomena: PHENOMENA, guide: GUIDE, holidays: hol };
  }

  calculate(dto: CalcDto) {
    const rule = findRule(dto.ruleKey)!;
    return { rule: { key: rule.key, name: rule.name }, ...computeTerm(dto as TermInput) };
  }

  private decorate<T extends { dueDate: string | null; status: string }>(r: T) {
    const daysLeft = r.dueDate ? daysUntil(r.dueDate) : null;
    return { ...r, daysLeft, level: levelOf(daysLeft, r.status) };
  }

  async list(businessId: string, q: ListQuery) {
    await this.checkAlerts(businessId);
    const conds = [eq(legalTerms.businessId, businessId)];
    if (q.status && q.status !== 'ALL') conds.push(eq(legalTerms.status, q.status));
    else if (!q.status) conds.push(ne(legalTerms.status, 'ARCHIVED'));
    if (q.jobId) conds.push(eq(legalTerms.jobId, q.jobId));
    if (q.q?.trim()) conds.push(ilike(legalTerms.title, `%${q.q.trim()}%`));
    const rows = await this.db.select({
      t: legalTerms, jobNumber: jobs.number, jobTitle: jobs.title, customerName: customers.name,
    }).from(legalTerms).leftJoin(jobs, eq(jobs.id, legalTerms.jobId)).leftJoin(customers, eq(customers.id, legalTerms.customerId))
      .where(and(...conds)).orderBy(sql`${legalTerms.dueDate} asc nulls last`, asc(legalTerms.createdAt)).limit(300);
    return rows.map((r) => ({ ...this.decorate(r.t), ruleName: findRule(r.t.ruleKey)?.name ?? r.t.ruleKey, area: findRule(r.t.ruleKey)?.area,
      phenomenon: findRule(r.t.ruleKey)?.phenomenon, jobNumber: r.jobNumber, jobTitle: r.jobTitle, customerName: r.customerName }));
  }

  async summary(businessId: string) {
    const all = await this.list(businessId, { status: 'ACTIVE' });
    const count = (l: string) => all.filter((x) => x.level === l).length;
    return { expired: count('EXPIRED'), red: count('RED'), yellow: count('YELLOW'), green: count('GREEN'), none: count('NONE'), upcoming: all.filter((x) => x.dueDate).slice(0, 8) };
  }

  async get(businessId: string, id: string) {
    const [r] = await this.db.select().from(legalTerms).where(and(eq(legalTerms.id, id), eq(legalTerms.businessId, businessId)));
    if (!r) throw new NotFoundException('Término no encontrado');
    return this.decorate(r);
  }

  private async assertRefs(businessId: string, dto: SaveDto) {
    if (dto.jobId) {
      const j = await this.db.query.jobs.findFirst({ where: and(eq(jobs.id, dto.jobId), eq(jobs.businessId, businessId)), columns: { id: true, customerId: true } });
      if (!j) throw new BadRequestException('El caso no existe en este negocio.');
      if (!dto.customerId && j.customerId) dto.customerId = j.customerId;
    }
    if (dto.customerId) {
      const c = await this.db.query.customers.findFirst({ where: and(eq(customers.id, dto.customerId), eq(customers.businessId, businessId)), columns: { id: true } });
      if (!c) throw new BadRequestException('El cliente no existe en este negocio.');
    }
  }

  private split(dto: SaveDto) {
    const { title, jobId, customerId, notes, checklist, syncJobDue, ...input } = dto;
    return { title: title.trim(), jobId: jobId ?? null, customerId: customerId ?? null, notes: notes?.trim() || null, checklist: checklist ?? [], syncJobDue, input };
  }

  private async syncJob(businessId: string, jobId: string | null) {
    if (!jobId) return;
    const [r] = await this.db.select({ due: sql<string | null>`min(${legalTerms.dueDate})` }).from(legalTerms)
      .where(and(eq(legalTerms.businessId, businessId), eq(legalTerms.jobId, jobId), eq(legalTerms.status, 'ACTIVE'), isNotNull(legalTerms.dueDate)));
    if (r?.due) await this.db.update(jobs).set({ dueAt: new Date(`${r.due}T12:00:00-05:00`) }).where(and(eq(jobs.id, jobId), eq(jobs.businessId, businessId)));
  }

  async create(ctx: RequestContext, dto: SaveDto) {
    await this.assertRefs(ctx.businessId, dto);
    const result = computeTerm(dto as TermInput);
    const p = this.split(dto);
    const [row] = await this.db.insert(legalTerms).values({
      businessId: ctx.businessId, jobId: p.jobId, customerId: p.customerId, ruleKey: dto.ruleKey, title: p.title, eventDate: dto.eventDate, input: p.input, result,
      dueDate: result.dueDate, notes: p.notes, checklist: p.checklist, createdById: ctx.userId,
    }).returning({ id: legalTerms.id });
    if (p.syncJobDue) await this.syncJob(ctx.businessId, p.jobId);
    await this.checkAlerts(ctx.businessId);
    return this.get(ctx.businessId, row.id);
  }

  async update(ctx: RequestContext, id: string, dto: SaveDto) {
    const cur = await this.get(ctx.businessId, id);
    await this.assertRefs(ctx.businessId, dto);
    const result = computeTerm(dto as TermInput);
    const p = this.split(dto);
    const dueChanged = result.dueDate !== cur.dueDate;
    await this.db.update(legalTerms).set({
      jobId: p.jobId, customerId: p.customerId, ruleKey: dto.ruleKey, title: p.title, eventDate: dto.eventDate, input: p.input, result, dueDate: result.dueDate,
      notes: p.notes, checklist: p.checklist, ...(dueChanged ? { alertsSent: [] } : {}),
    }).where(and(eq(legalTerms.id, id), eq(legalTerms.businessId, ctx.businessId)));
    if (p.syncJobDue) await this.syncJob(ctx.businessId, p.jobId);
    return this.get(ctx.businessId, id);
  }

  async setStatus(ctx: RequestContext, id: string, dto: StatusDto) {
    const cur = await this.get(ctx.businessId, id);
    const note = dto.note?.trim() ? `${cur.notes ? cur.notes + '\n' : ''}${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}: ${dto.note.trim()}` : cur.notes;
    await this.db.update(legalTerms).set({ status: dto.status, closedAt: dto.status === 'ACTIVE' ? null : new Date(), notes: note })
      .where(and(eq(legalTerms.id, id), eq(legalTerms.businessId, ctx.businessId)));
    return this.get(ctx.businessId, id);
  }

  async remove(ctx: RequestContext, id: string) {
    await this.get(ctx.businessId, id);
    await this.db.delete(legalTerms).where(and(eq(legalTerms.id, id), eq(legalTerms.businessId, ctx.businessId)));
    return { ok: true };
  }

  /** Crea avisos cuando un término activo cruza 30, 15, 7, 3, 1 o 0 días. Un aviso por umbral. */
  async checkAlerts(businessId: string) {
    const rows = await this.db.select().from(legalTerms)
      .where(and(eq(legalTerms.businessId, businessId), eq(legalTerms.status, 'ACTIVE'), isNotNull(legalTerms.dueDate)));
    for (const r of rows) {
      const d = daysUntil(r.dueDate!);
      const crossed = THRESHOLDS.filter((t) => d <= t && !(r.alertsSent ?? []).includes(t));
      if (!crossed.length || d < -1) {
        if (crossed.length) await this.db.update(legalTerms).set({ alertsSent: THRESHOLDS }).where(eq(legalTerms.id, r.id));
        continue;
      }
      const when = d < 0 ? `venció hace ${-d} día(s)` : d === 0 ? 'vence HOY' : `vence en ${d} día(s)`;
      // Dentro de DREAMS siempre; por WhatsApp (si el plan lo incluye y la persona lo autorizó) desde 7 días antes.
      await this.alerts.send({
        businessId, type: 'TERM_DUE', title: `Término ${when}: ${r.title}`.slice(0, 160),
        body: `${findRule(r.ruleKey)?.name ?? ''} — último día: ${r.dueDate}. Revisa y marca el término como presentado cuando radiques.`, data: { legalTermId: r.id, jobId: r.jobId },
        whatsapp: d <= 7 ? { alert: 'TERM_DUE', params: { termino: r.title, fecha: new Date(`${r.dueDate}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) }, linkSuffix: 'terminos' } : undefined,
      });
      await this.db.update(legalTerms).set({ alertsSent: [...new Set([...(r.alertsSent ?? []), ...crossed])] }).where(eq(legalTerms.id, r.id));
    }
  }

  private async scanAll() {
    const biz = await this.db.selectDistinct({ id: legalTerms.businessId }).from(legalTerms).where(eq(legalTerms.status, 'ACTIVE'));
    for (const b of biz) await this.checkAlerts(b.id);
  }

  async forJobs(businessId: string, jobIds: string[]) {
    if (!jobIds.length) return [];
    return this.db.select().from(legalTerms).where(and(eq(legalTerms.businessId, businessId), inArray(legalTerms.jobId, jobIds)));
  }
}

@Controller()
export class LegalTermsController {
  constructor(private s: LegalTermsService) {}
  @RequirePermissions('sales:read') @Get('legal-terms/catalog') catalog() { return this.s.catalog(); }
  @RequirePermissions('sales:read') @Post('legal-terms/calculate') calculate(@Body() dto: CalcDto) { return this.s.calculate(dto); }
  @RequirePermissions('sales:read') @Get('legal-terms/summary') summary(@Ctx() ctx: RequestContext) { return this.s.summary(ctx.businessId); }
  @RequirePermissions('sales:read') @Get('legal-terms') list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) { return this.s.list(ctx.businessId, q); }
  @RequirePermissions('sales:read') @Get('legal-terms/:id') get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('legal-terms') create(@Ctx() ctx: RequestContext, @Body() dto: SaveDto) { return this.s.create(ctx, dto); }
  @RequirePermissions('sales:create') @Put('legal-terms/:id') update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveDto) { return this.s.update(ctx, id, dto); }
  @RequirePermissions('sales:create') @Patch('legal-terms/:id/status') status(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) { return this.s.setStatus(ctx, id, dto); }
  @RequirePermissions('sales:create') @Delete('legal-terms/:id') remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.remove(ctx, id); }
}

@Module({ controllers: [LegalTermsController], providers: [LegalTermsService], exports: [LegalTermsService] })
export class LegalTermsModule {}
