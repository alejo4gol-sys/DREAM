/**
 * Seguimiento de procesos para abogados.
 * - Rama Judicial (CPNU): consulta automática cada ~6 horas; cada actuación nueva genera aviso en DREAMS y por WhatsApp.
 * - Demás entidades (Fiscalía, SNR, notarías, superintendencias, Colpensiones…): recordatorio cada N días con enlace
 *   a la consulta oficial y registro manual de novedades (que también avisa al equipo).
 */
import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Logger, Module, NotFoundException, OnModuleDestroy, OnModuleInit,
  Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { and, asc, desc, eq, ilike, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { PlanLimitsService } from '../common/plan-limits.service';
import { config } from '../config';
import { Db, InjectDb } from '../db/db';
import { jobs, processUpdates, processWatches } from '../db/schema';
import { AlertsService } from '../whatsapp/whatsapp.module';
import { CpnuError, getActions, getDetail, searchByRadicado } from './cpnu.client';
import { KINDS, SOURCES, SOURCE_BY_KEY, formatRadicado, normalizeReference } from './sources';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = 3600_000;

class CreateDto {
  @IsIn(SOURCES.map((s) => s.key)) source: string;
  @IsString() @Length(2, 60) reference: string;
  @IsString() @Length(2, 200) title: string;
  @IsOptional() @IsIn(Object.keys(KINDS)) kind?: string;
  @IsOptional() @IsUUID() jobId?: string | null;
  @IsOptional() @IsObject() extra?: Record<string, string>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) remindDays?: number;
}
class UpdateDto {
  @IsOptional() @IsString() @Length(2, 200) title?: string;
  @IsOptional() @IsIn(Object.keys(KINDS)) kind?: string;
  @IsOptional() @IsUUID() jobId?: string | null;
  @IsOptional() @IsObject() extra?: Record<string, string>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) remindDays?: number;
}
class StatusDto { @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED']) status: string; }
class NoteDto {
  @IsOptional() @Matches(DATE) date?: string;
  @IsString() @Length(2, 300) title: string;
  @IsOptional() @IsString() @MaxLength(4000) body?: string;
  @IsOptional() @IsBoolean() notify?: boolean;
}
class ListQuery {
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED', 'ALL']) status?: string;
  @IsOptional() @IsUUID() jobId?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(SOURCES.map((s) => s.key)) source?: string;
}

const bogotaHour = () => Number(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false })) % 24;
const shortText = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

@Injectable()
export class ProcessWatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessWatchService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(@InjectDb() private db: Db, private limits: PlanLimitsService, private alerts: AlertsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || !config.processWatchEnabled) return;
    this.timer = setInterval(() => this.tick().catch((e) => this.logger.warn(e.message)), 10 * 60_000);
    setTimeout(() => this.tick().catch((e) => this.logger.warn(e.message)), 60_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  catalog() {
    return {
      sources: SOURCES.map(({ refPattern, ...s }) => s),
      kinds: KINDS,
    };
  }

  private view(w: typeof processWatches.$inferSelect, job?: { number: number; title: string } | null) {
    const src = SOURCE_BY_KEY[w.source];
    const consultUrl = w.source === 'OTRA' ? (w.extra?.url && /^https?:\/\//.test(w.extra.url) ? w.extra.url : null) : src?.consultUrl ?? null;
    return {
      ...w, sourceLabel: src?.label ?? w.source, sourceGroup: src?.group ?? '', consultUrl, consultLabel: src?.consultLabel ?? null,
      referenceLabel: w.source === 'RAMA_JUDICIAL' || w.source === 'SAMAI' ? formatRadicado(w.reference) : w.reference,
      kindLabel: KINDS[w.kind] ?? w.kind, job: job ?? null,
    };
  }

  async list(businessId: string, q: ListQuery) {
    const conds = [eq(processWatches.businessId, businessId)];
    const status = q.status ?? 'ACTIVE';
    if (status === 'ACTIVE') conds.push(inArray(processWatches.status, ['ACTIVE', 'PAUSED']));
    else if (status !== 'ALL') conds.push(eq(processWatches.status, status));
    if (q.jobId) conds.push(eq(processWatches.jobId, q.jobId));
    if (q.source) conds.push(eq(processWatches.source, q.source));
    if (q.q?.trim()) {
      const t = `%${q.q.trim()}%`;
      conds.push(or(ilike(processWatches.title, t), ilike(processWatches.reference, `%${q.q.replace(/\D/g, '') || q.q.trim()}%`))!);
    }
    const rows = await this.db.select({ w: processWatches, jobNumber: jobs.number, jobTitle: jobs.title }).from(processWatches)
      .leftJoin(jobs, eq(jobs.id, processWatches.jobId)).where(and(...conds))
      .orderBy(desc(processWatches.unread), sql`${processWatches.lastChangeAt} desc nulls last`, desc(processWatches.createdAt)).limit(300);
    return rows.map((r) => this.view(r.w, r.jobNumber ? { number: r.jobNumber, title: r.jobTitle! } : null));
  }

  async summary(businessId: string) {
    const rows = await this.db.select({ mode: processWatches.mode, unread: processWatches.unread, err: processWatches.lastError, status: processWatches.status })
      .from(processWatches).where(and(eq(processWatches.businessId, businessId), ne(processWatches.status, 'ARCHIVED')));
    const recent = await this.db.select({ u: processUpdates, title: processWatches.title, source: processWatches.source, reference: processWatches.reference })
      .from(processUpdates).innerJoin(processWatches, eq(processWatches.id, processUpdates.watchId))
      .where(and(eq(processUpdates.businessId, businessId), eq(processUpdates.baseline, false)))
      .orderBy(desc(processUpdates.createdAt)).limit(30);
    const plan = await this.limits.limits(businessId).catch(() => null);
    const usage = rows.length;
    return {
      total: rows.length, auto: rows.filter((r) => r.mode === 'AUTO').length, manual: rows.filter((r) => r.mode === 'MANUAL').length,
      unread: rows.reduce((a, r) => a + r.unread, 0), withUnread: rows.filter((r) => r.unread > 0).length,
      errors: rows.filter((r) => r.err && r.status === 'ACTIVE').length,
      limit: plan?.limits.processWatches ?? null, used: usage, planName: plan?.name ?? '',
      recent: recent.map((r) => ({ ...r.u, watchTitle: r.title, sourceLabel: SOURCE_BY_KEY[r.source]?.label ?? r.source, referenceLabel: r.source === 'RAMA_JUDICIAL' ? formatRadicado(r.reference) : r.reference })),
    };
  }

  async get(businessId: string, id: string) {
    const [r] = await this.db.select({ w: processWatches, jobNumber: jobs.number, jobTitle: jobs.title }).from(processWatches)
      .leftJoin(jobs, eq(jobs.id, processWatches.jobId)).where(and(eq(processWatches.id, id), eq(processWatches.businessId, businessId)));
    if (!r) throw new NotFoundException('Proceso no encontrado');
    const updates = await this.db.select().from(processUpdates).where(eq(processUpdates.watchId, id))
      .orderBy(sql`${processUpdates.date} desc nulls last`, desc(processUpdates.createdAt)).limit(300);
    return { ...this.view(r.w, r.jobNumber ? { number: r.jobNumber, title: r.jobTitle! } : null), updates, how: SOURCE_BY_KEY[r.w.source]?.how, note: SOURCE_BY_KEY[r.w.source]?.note };
  }

  private async assertJob(businessId: string, jobId?: string | null) {
    if (!jobId) return;
    const [j] = await this.db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.businessId, businessId)));
    if (!j) throw new BadRequestException('El caso no existe');
  }

  private cleanExtra(sourceKey: string, extra?: Record<string, string>) {
    const src = SOURCE_BY_KEY[sourceKey];
    const out: Record<string, string> = {};
    for (const f of src.extra ?? []) {
      const v = String(extra?.[f.key] ?? '').trim().slice(0, 200);
      if (f.required && !v) throw new BadRequestException(`Falta: ${f.label}`);
      if (f.key === 'url' && v && !/^https:\/\//.test(v)) throw new BadRequestException('El enlace debe empezar por https://');
      if (v) out[f.key] = v;
    }
    return out;
  }

  async create(ctx: RequestContext, dto: CreateDto) {
    const src = SOURCE_BY_KEY[dto.source];
    const reference = normalizeReference(src, dto.reference);
    if (!reference) throw new BadRequestException(`Revisa el número: ${src.refLabel.toLowerCase()}.`);
    await this.limits.assert(ctx.businessId, 'processWatches');
    await this.assertJob(ctx.businessId, dto.jobId);
    const [dup] = await this.db.select({ id: processWatches.id, status: processWatches.status }).from(processWatches)
      .where(and(eq(processWatches.businessId, ctx.businessId), eq(processWatches.source, dto.source), eq(processWatches.reference, reference)));
    if (dup) throw new BadRequestException(dup.status === 'ARCHIVED' ? 'Ese proceso ya estaba vigilado y está archivado: reactívalo desde «Archivados».' : 'Ya estás vigilando ese proceso.');
    const remindDays = dto.remindDays ?? 7;
    const [w] = await this.db.insert(processWatches).values({
      businessId: ctx.businessId, jobId: dto.jobId ?? null, source: dto.source, kind: dto.kind && src.kinds.includes(dto.kind) ? dto.kind : src.kinds[0],
      reference, extra: this.cleanExtra(dto.source, dto.extra), title: dto.title.trim(), mode: src.mode, remindDays, createdById: ctx.userId,
      nextCheckAt: src.mode === 'AUTO' ? new Date() : new Date(Date.now() + remindDays * 24 * HOUR),
    }).returning();
    await this.db.insert(processUpdates).values({
      watchId: w.id, businessId: ctx.businessId, externalId: 'SYS-START', date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      title: src.mode === 'AUTO' ? 'Inicio de la vigilancia automática' : `Inicio del seguimiento (recordatorio cada ${remindDays} días)`, origin: 'SYSTEM', baseline: true, createdById: ctx.userId,
    });
    if (src.mode === 'AUTO') await this.checkAuto(w, true);
    return this.get(ctx.businessId, w.id);
  }

  async update(ctx: RequestContext, id: string, dto: UpdateDto) {
    const cur = await this.get(ctx.businessId, id);
    await this.assertJob(ctx.businessId, dto.jobId);
    const set: Partial<typeof processWatches.$inferInsert> = {};
    if (dto.title) set.title = dto.title.trim();
    if (dto.kind) set.kind = dto.kind;
    if (dto.jobId !== undefined) set.jobId = dto.jobId;
    if (dto.extra) set.extra = this.cleanExtra(cur.source, dto.extra);
    if (dto.remindDays) { set.remindDays = dto.remindDays; if (cur.mode === 'MANUAL') set.nextCheckAt = new Date(Date.now() + dto.remindDays * 24 * HOUR); }
    if (Object.keys(set).length) await this.db.update(processWatches).set(set).where(eq(processWatches.id, id));
    return this.get(ctx.businessId, id);
  }

  async setStatus(ctx: RequestContext, id: string, dto: StatusDto) {
    const cur = await this.get(ctx.businessId, id);
    if (dto.status !== 'ARCHIVED' && cur.status === 'ARCHIVED') await this.limits.assert(ctx.businessId, 'processWatches');
    await this.db.update(processWatches).set({
      status: dto.status,
      nextCheckAt: dto.status === 'ACTIVE' ? (cur.mode === 'AUTO' ? new Date() : new Date(Date.now() + cur.remindDays * 24 * HOUR)) : cur.nextCheckAt,
    }).where(eq(processWatches.id, id));
    return this.get(ctx.businessId, id);
  }

  async remove(ctx: RequestContext, id: string) {
    await this.get(ctx.businessId, id);
    await this.db.delete(processWatches).where(eq(processWatches.id, id));
    return { ok: true };
  }

  async markRead(ctx: RequestContext, id: string) {
    await this.get(ctx.businessId, id);
    await this.db.update(processWatches).set({ unread: 0 }).where(eq(processWatches.id, id));
    return { ok: true };
  }

  async checkNow(ctx: RequestContext, id: string) {
    const [w] = await this.db.select().from(processWatches).where(and(eq(processWatches.id, id), eq(processWatches.businessId, ctx.businessId)));
    if (!w) throw new NotFoundException('Proceso no encontrado');
    if (w.mode !== 'AUTO') throw new BadRequestException('Esta entidad no tiene consulta automática: ábrela con «Consultar en la entidad» y registra la novedad.');
    if (w.summary?.demo) throw new BadRequestException('Este es un proceso de ejemplo: registra uno real para consultarlo en la Rama Judicial.');
    if (w.lastCheckedAt && Date.now() - w.lastCheckedAt.getTime() < 2 * 60_000) return { ...(await this.get(ctx.businessId, id)), info: 'Se consultó hace menos de 2 minutos.' };
    await this.checkAuto(w, false);
    return this.get(ctx.businessId, id);
  }

  async addNote(ctx: RequestContext, id: string, dto: NoteDto) {
    const w = await this.get(ctx.businessId, id);
    const date = dto.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    await this.db.insert(processUpdates).values({
      watchId: id, businessId: ctx.businessId, externalId: `M-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, date,
      title: dto.title.trim(), body: dto.body?.trim() || null, origin: 'MANUAL', createdById: ctx.userId,
    });
    await this.db.update(processWatches).set({
      lastChangeAt: new Date(), lastActivity: w.lastActivity && w.lastActivity > date ? w.lastActivity : date, unread: sql`${processWatches.unread} + 1`,
      ...(w.mode === 'MANUAL' ? { nextCheckAt: new Date(Date.now() + w.remindDays * 24 * HOUR) } : {}),
    }).where(eq(processWatches.id, id));
    if (dto.notify !== false) {
      await this.alerts.send({
        businessId: ctx.businessId, type: 'PROCESS_UPDATE', title: `Novedad en ${w.title}`.slice(0, 160), body: dto.title.trim(),
        data: { processWatchId: id, jobId: w.jobId },
        whatsapp: { alert: 'PROCESS_UPDATE', params: { proceso: `${w.title} (${w.referenceLabel})`, novedad: dto.title.trim() }, linkSuffix: `procesos/${id}` },
      });
    }
    return this.get(ctx.businessId, id);
  }

  // ───────── Consulta automática (Rama Judicial) ─────────
  /** Consulta la CPNU. En la primera consulta las actuaciones existentes quedan como historial (sin avisar). */
  async checkAuto(w: typeof processWatches.$inferSelect, initial: boolean) {
    const now = new Date();
    const prev = (w.summary ?? {}) as Record<string, any>;
    try {
      const procs = await searchByRadicado(w.reference);
      if (!procs.length) {
        await this.db.update(processWatches).set({
          lastCheckedAt: now, nextCheckAt: new Date(now.getTime() + 24 * HOUR), errorCount: 0,
          lastError: 'El radicado no aparece en la Consulta Nacional Unificada. Puede tardar unos días en aparecer o el despacho no publica allí: seguiremos buscándolo una vez al día.',
          summary: { ...prev, notFound: true },
        }).where(eq(processWatches.id, w.id));
        return;
      }
      const visible = procs.filter((p) => !p.esPrivado);
      const lastBy: Record<string, string | null> = { ...(prev.lastByProcess ?? {}) };
      const recentDay = new Date(now.getTime() - 3 * 24 * HOUR).toISOString().slice(0, 10);
      const fresh: (typeof processUpdates.$inferSelect)[] = [];
      let detail = prev.detail ?? null;
      for (const p of visible) {
        const changed = initial || lastBy[p.idProceso] !== p.fechaUltimaActuacion || (p.fechaUltimaActuacion ?? '') >= recentDay;
        if (!changed) continue;
        if (!detail) detail = await getDetail(p.idProceso).catch(() => null);
        const maxPages = initial ? 1 : 3;
        for (let page = 1; page <= maxPages; page++) {
          const { items, pages } = await getActions(p.idProceso, page);
          if (!items.length) break;
          const inserted = await this.db.insert(processUpdates).values(items.map((a) => ({
            watchId: w.id, businessId: w.businessId, externalId: `CPNU-${a.idRegActuacion}`, date: a.fechaActuacion,
            title: shortText(a.actuacion || 'Actuación', 300), body: a.anotacion || null, termStart: a.fechaInicial, termEnd: a.fechaFinal,
            origin: 'AUTO', hasDocs: a.conDocumentos, baseline: initial,
          }))).onConflictDoNothing().returning();
          fresh.push(...inserted);
          // Si toda la página era conocida, no hace falta seguir.
          if (inserted.length < items.length || page >= pages) break;
        }
        lastBy[p.idProceso] = p.fechaUltimaActuacion;
      }
      const lastActivity = procs.map((p) => p.fechaUltimaActuacion).filter(Boolean).sort().pop() ?? w.lastActivity;
      const isNew = initial ? [] : fresh;
      const summary = {
        ...prev, notFound: false, lastByProcess: lastBy, detail,
        processes: procs.map((p) => ({ id: p.idProceso, despacho: p.despacho, departamento: p.departamento, sujetos: p.sujetosProcesales, fechaProceso: p.fechaProceso, fechaUltimaActuacion: p.fechaUltimaActuacion, privado: p.esPrivado })),
        private: !visible.length,
      };
      await this.db.update(processWatches).set({
        summary, lastActivity, lastCheckedAt: now, errorCount: 0,
        lastError: !visible.length ? 'El proceso tiene reserva: la Rama Judicial no publica sus actuaciones. Revisa el expediente con el despacho; te recordaremos cada semana.' : null,
        nextCheckAt: new Date(now.getTime() + (visible.length ? 6 * HOUR + Math.floor(Math.random() * 40) * 60_000 : 7 * 24 * HOUR)),
        ...(isNew.length ? { lastChangeAt: now, unread: sql`${processWatches.unread} + ${isNew.length}` } : {}),
      }).where(eq(processWatches.id, w.id));
      if (isNew.length) {
        const newest = [...isNew].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
        const label = formatRadicado(w.reference);
        await this.alerts.send({
          businessId: w.businessId, type: 'PROCESS_UPDATE',
          title: (isNew.length === 1 ? `Nueva actuación: ${w.title}` : `${isNew.length} actuaciones nuevas: ${w.title}`).slice(0, 160),
          body: `${newest.date ?? ''} · ${newest.title}${newest.body ? ` — ${shortText(newest.body, 200)}` : ''}`,
          data: { processWatchId: w.id, jobId: w.jobId },
          whatsapp: { alert: 'PROCESS_UPDATE', params: { proceso: `${w.title} (${label})`, novedad: isNew.length === 1 ? newest.title : `${isNew.length} actuaciones nuevas; la última: ${newest.title}` }, linkSuffix: `procesos/${w.id}` },
        });
      }
    } catch (e) {
      const msg = e instanceof CpnuError ? e.message : `Error al consultar: ${(e as Error).message}`;
      const errors = w.errorCount + 1;
      await this.db.update(processWatches).set({
        lastCheckedAt: now, lastError: msg, errorCount: errors, nextCheckAt: new Date(now.getTime() + Math.min(24, 2 ** errors) * HOUR),
      }).where(eq(processWatches.id, w.id));
      if (initial || !(e instanceof CpnuError)) this.logger.warn(`CPNU ${w.reference}: ${msg}`);
    }
  }

  /** Corre cada 10 minutos: consultas automáticas pendientes y recordatorios de entidades manuales (7 a. m. a 7 p. m.). */
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.db.select().from(processWatches)
        .where(and(eq(processWatches.status, 'ACTIVE'), eq(processWatches.mode, 'AUTO'), isNotNull(processWatches.nextCheckAt), lte(processWatches.nextCheckAt, new Date()), sql`coalesce((${processWatches.summary}->>'demo')::boolean, false) = false`))
        .orderBy(asc(processWatches.nextCheckAt)).limit(15);
      for (const w of due) await this.checkAuto(w, false);

      const h = bogotaHour();
      if (h < 7 || h >= 19) return;
      const reminders = await this.db.select().from(processWatches)
        .where(and(eq(processWatches.status, 'ACTIVE'), eq(processWatches.mode, 'MANUAL'), isNotNull(processWatches.nextCheckAt), lte(processWatches.nextCheckAt, new Date())))
        .limit(50);
      for (const w of reminders) {
        await this.db.update(processWatches).set({ nextCheckAt: new Date(Date.now() + w.remindDays * 24 * HOUR) }).where(eq(processWatches.id, w.id));
        const src = SOURCE_BY_KEY[w.source];
        const entity = w.source === 'OTRA' ? (w.extra?.entidad ?? 'la entidad') : w.source === 'NOTARIA' ? (w.extra?.notaria ?? 'la notaría') : (src?.label.split(' — ')[0] ?? 'la entidad');
        await this.alerts.send({
          businessId: w.businessId, type: 'PROCESS_REMINDER', title: `Revisa: ${w.title}`.slice(0, 160),
          body: `Consulta el estado en ${entity} (${w.reference}) y registra la novedad en DREAMS. Próximo recordatorio en ${w.remindDays} días.`,
          data: { processWatchId: w.id, jobId: w.jobId },
          whatsapp: { alert: 'PROCESS_REMINDER', params: { proceso: `${w.title} (${w.reference})`, entidad: entity }, linkSuffix: `procesos/${w.id}` },
        });
      }
    } finally { this.running = false; }
  }
}

@Controller('process-watch')
export class ProcessWatchController {
  constructor(private s: ProcessWatchService) {}
  @RequirePermissions('sales:read') @Get('catalog') catalog() { return this.s.catalog(); }
  @RequirePermissions('sales:read') @Get('summary') summary(@Ctx() ctx: RequestContext) { return this.s.summary(ctx.businessId); }
  @RequirePermissions('sales:read') @Get() list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) { return this.s.list(ctx.businessId, q); }
  @RequirePermissions('sales:read') @Get(':id') get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post() @Throttle({ default: { limit: 30, ttl: 60_000 } }) create(@Ctx() ctx: RequestContext, @Body() dto: CreateDto) { return this.s.create(ctx, dto); }
  @RequirePermissions('sales:create') @Put(':id') update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDto) { return this.s.update(ctx, id, dto); }
  @RequirePermissions('sales:create') @Patch(':id/status') status(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) { return this.s.setStatus(ctx, id, dto); }
  @RequirePermissions('sales:read') @Post(':id/check') @Throttle({ default: { limit: 10, ttl: 60_000 } }) check(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.checkNow(ctx, id); }
  @RequirePermissions('sales:read') @Post(':id/read') read(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.markRead(ctx, id); }
  @RequirePermissions('sales:create') @Post(':id/updates') note(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) { return this.s.addNote(ctx, id, dto); }
  @RequirePermissions('sales:create') @Delete(':id') remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.remove(ctx, id); }
}

@Module({ controllers: [ProcessWatchController], providers: [ProcessWatchService], exports: [ProcessWatchService] })
export class ProcessWatchModule {}
