/**
 * Plantillas y documentos para abogados.
 * - Biblioteca: plantillas globales de DREAMS (importadas por la administración) + plantillas propias del despacho.
 * - Sugerencias: según el área, tipo de proceso, categoría y descripción del caso.
 * - Llenado: los {{campos}} se completan con los datos del caso, del cliente y del abogado; el resto se escribe a mano.
 * - Documentos: se guardan en el caso y se descargan en Word (.doc) o PDF.
 * Las plantillas son borradores de apoyo: el abogado responde por su revisión y uso.
 */
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException, OnModuleInit, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { config } from '../config';
import { Db, InjectDb } from '../db/db';
import { businesses, customers, jobs, lawyerProfiles, legalDocuments, legalTemplates, users } from '../db/schema';
import { AUTO_FIELDS, STARTER_TEMPLATES, TemplateInput } from './starter-templates';

export const AREAS: Record<string, string> = {
  general: 'General', constitucional: 'Constitucional', civil: 'Civil', familia: 'Familia', penal: 'Penal',
  laboral: 'Laboral', seguridad_social: 'Seguridad social', comercial: 'Comercial', administrativo: 'Administrativo',
  tributario: 'Tributario', notarial: 'Notarial y registral', consumidor: 'Consumidor', policivo: 'Policivo y convivencia',
  disciplinario: 'Disciplinario', insolvencia: 'Insolvencia', propiedad_intelectual: 'Propiedad intelectual', datos: 'Datos personales',
};

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Relaciona las categorías y áreas de los casos con las áreas de la biblioteca. */
const CASE_AREA: Record<string, string> = {
  tutela: 'constitucional', 'derecho de peticion': 'administrativo', 'proceso ejecutivo': 'civil', penal: 'penal', familia: 'familia',
  laboral: 'laboral', civil: 'civil', contratos: 'civil', sucesiones: 'familia', administrativo: 'administrativo', constitucional: 'constitucional',
  'seguridad social': 'seguridad_social', comercial: 'comercial', tributario: 'tributario', consulta: 'general',
};
const STOP = new Set('de la el los las del y o a en por para con un una que se su al lo como contra sin sobre ante'.split(' '));

class FieldDto {
  @IsString() @Length(1, 40) @Matches(/^[a-z0-9_]+$/) key: string;
  @IsString() @Length(1, 120) label: string;
  @IsOptional() @IsString() @MaxLength(300) help?: string;
}
class TemplateDto {
  @IsOptional() @IsString() @MaxLength(60) code?: string;
  @IsString() @Length(2, 40) area: string;
  @IsString() @Length(2, 80) category: string;
  @IsString() @Length(3, 200) title: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsString() @Length(20, 60000) body: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => FieldDto) fields?: FieldDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(60, { each: true }) keywords?: string[];
  @IsOptional() @IsString() @MaxLength(2000) legalBasis?: string;
}
class ImportDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => TemplateDto) templates: TemplateDto[];
  /** Solo administración de DREAMS: cargarlas para todos los abogados. */
  @IsOptional() @IsString() scope?: 'GLOBAL' | 'MINE';
}
class ListQuery {
  @IsOptional() @IsString() @MaxLength(40) area?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}
class RenderDto {
  @IsOptional() @IsUUID() jobId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsObject() values?: Record<string, string>;
}
class DocumentDto {
  @IsOptional() @IsUUID() jobId?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsString() @Length(2, 200) title: string;
  @IsString() @Length(1, 100000) body: string;
}

const longDate = () => new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' });

@Injectable()
export class LegalTemplatesService implements OnModuleInit {
  constructor(@InjectDb() private db: Db) {}

  /** Siembra los borradores iniciales (no pisa los que ya existan ni los editados por la administración). */
  async onModuleInit() {
    try {
      for (const t of STARTER_TEMPLATES) {
        const [ex] = await this.db.select({ id: legalTemplates.id }).from(legalTemplates).where(and(isNull(legalTemplates.businessId), eq(legalTemplates.code, t.code))).limit(1);
        if (!ex) await this.db.insert(legalTemplates).values(this.row(t, null, 'SYSTEM'));
      }
    } catch { /* la migración aún no corre: se intenta en el próximo arranque */ }
  }

  private row(t: TemplateInput, businessId: string | null, source: string) {
    const area = AREAS[t.area] ? t.area : (CASE_AREA[norm(t.area)] ?? 'general');
    const declared = new Map((t.fields ?? []).map((f) => [f.key, f]));
    // Los {{campos}} usados en el cuerpo que no son automáticos ni están declarados se agregan con su nombre como etiqueta.
    for (const k of this.placeholders(t.body)) if (!declared.has(k) && !AUTO_FIELDS.some((a) => a.key === k)) declared.set(k, { key: k, label: k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) });
    return {
      businessId, code: t.code?.trim() || null, area, category: t.category.trim(), title: t.title.trim(), description: t.description?.trim() || null,
      body: t.body.replace(/\r\n/g, '\n'), fields: [...declared.values()], keywords: (t.keywords ?? []).map((k) => k.trim()).filter(Boolean),
      legalBasis: t.legalBasis?.trim() || null, source,
    };
  }

  placeholders(body: string) { return [...new Set([...body.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1].toLowerCase()))]; }

  private async isAdmin(userId: string) {
    const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    return !!u && config.platformAdmins.includes(u.email.toLowerCase());
  }

  private visible(businessId: string) { return or(isNull(legalTemplates.businessId), eq(legalTemplates.businessId, businessId)); }

  async list(businessId: string, q: ListQuery) {
    const conds = [this.visible(businessId)];
    if (q.area) conds.push(eq(legalTemplates.area, q.area));
    if (q.q) { const like = `%${q.q.replace(/[%_]/g, '')}%`; conds.push(sql`(${legalTemplates.title} ILIKE ${like} OR ${legalTemplates.category} ILIKE ${like} OR ${legalTemplates.keywords}::text ILIKE ${like})`); }
    const rows = await this.db.select({
      id: legalTemplates.id, code: legalTemplates.code, area: legalTemplates.area, category: legalTemplates.category, title: legalTemplates.title,
      description: legalTemplates.description, legalBasis: legalTemplates.legalBasis, source: legalTemplates.source, businessId: legalTemplates.businessId, updatedAt: legalTemplates.updatedAt,
    }).from(legalTemplates).where(and(...conds)).orderBy(legalTemplates.area, legalTemplates.category, legalTemplates.title).limit(500);
    const counts = await this.db.select({ area: legalTemplates.area, n: sql<number>`count(*)::int` }).from(legalTemplates).where(this.visible(businessId)).groupBy(legalTemplates.area);
    return { areas: AREAS, counts: Object.fromEntries(counts.map((c) => [c.area, c.n])), autoFields: AUTO_FIELDS, items: rows.map((r) => ({ ...r, mine: r.businessId === businessId, businessId: undefined })) };
  }

  async get(businessId: string, id: string) {
    const [t] = await this.db.select().from(legalTemplates).where(and(eq(legalTemplates.id, id), this.visible(businessId))).limit(1);
    if (!t) throw new NotFoundException('Plantilla no encontrada');
    return { ...t, mine: t.businessId === businessId };
  }

  async create(businessId: string, dto: TemplateDto) {
    const [t] = await this.db.insert(legalTemplates).values(this.row({ ...dto, code: dto.code ?? '' }, businessId, 'CUSTOM')).returning({ id: legalTemplates.id });
    return t;
  }

  /** Editar una propia; si es de DREAMS se crea una copia propia (o la edita la administración). */
  async update(ctx: RequestContext, id: string, dto: TemplateDto) {
    const t = await this.get(ctx.businessId, id);
    if (!t.mine) {
      if (!(await this.isAdmin(ctx.userId))) return this.create(ctx.businessId, { ...dto, code: undefined });
      await this.db.update(legalTemplates).set(this.row({ ...dto, code: t.code ?? '' }, null, t.source)).where(eq(legalTemplates.id, id));
      return { id };
    }
    await this.db.update(legalTemplates).set(this.row({ ...dto, code: t.code ?? '' }, ctx.businessId, t.source)).where(eq(legalTemplates.id, id));
    return { id };
  }

  async remove(ctx: RequestContext, id: string) {
    const t = await this.get(ctx.businessId, id);
    if (!t.mine && !(await this.isAdmin(ctx.userId))) throw new ForbiddenException('Las plantillas de DREAMS no se pueden borrar; puede crear una copia propia.');
    await this.db.delete(legalTemplates).where(eq(legalTemplates.id, id));
    return { ok: true };
  }

  /** Importa el JSON generado por la IA jurídica. Actualiza por «code» si ya existe. */
  async import(ctx: RequestContext, dto: ImportDto) {
    const global = dto.scope === 'GLOBAL';
    if (global && !(await this.isAdmin(ctx.userId))) throw new ForbiddenException('Solo la administración de DREAMS puede cargar plantillas para todos.');
    const owner = global ? null : ctx.businessId;
    let created = 0, updated = 0; const errors: string[] = [];
    for (const [i, t] of dto.templates.entries()) {
      try {
        const row = this.row({ ...t, code: t.code ?? '' }, owner, 'IMPORT');
        const [ex] = row.code ? await this.db.select({ id: legalTemplates.id }).from(legalTemplates)
          .where(and(owner ? eq(legalTemplates.businessId, owner) : isNull(legalTemplates.businessId), eq(legalTemplates.code, row.code))).limit(1) : [];
        if (ex) { await this.db.update(legalTemplates).set(row).where(eq(legalTemplates.id, ex.id)); updated++; }
        else { await this.db.insert(legalTemplates).values(row); created++; }
      } catch (e: any) { errors.push(`#${i + 1} ${t.title ?? ''}: ${e?.message ?? 'error'}`); }
    }
    return { created, updated, errors };
  }

  private async caseData(businessId: string, jobId?: string, customerId?: string) {
    const [b] = await this.db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const [lp] = await this.db.select().from(lawyerProfiles).where(eq(lawyerProfiles.businessId, businessId)).limit(1);
    const [owner] = b ? await this.db.select({ fullName: users.fullName }).from(users).where(eq(users.id, b.ownerId)).limit(1) : [];
    let job: typeof jobs.$inferSelect | undefined;
    if (jobId) { [job] = await this.db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.businessId, businessId))).limit(1); if (!job) throw new NotFoundException('Caso no encontrado'); }
    const cid = customerId ?? job?.customerId ?? undefined;
    const [c] = cid ? await this.db.select().from(customers).where(and(eq(customers.id, cid), eq(customers.businessId, businessId))).limit(1) : [];
    const d = job?.details ?? {};
    const v: Record<string, string> = {
      fecha: longDate(), ciudad: b?.city ?? '',
      cliente_nombre: c?.name ?? '', cliente_documento: c?.taxId ?? '', cliente_telefono: c?.phone ?? '', cliente_correo: c?.email ?? '', cliente_ciudad: c?.city ?? '',
      abogado_nombre: lp?.displayName ?? owner?.fullName ?? b?.tradeName ?? '', abogado_tp: lp?.professionalCard ?? '',
      abogado_correo: b?.email ?? '', abogado_telefono: b?.phone ?? '', abogado_direccion: [b?.address, b?.city].filter(Boolean).join(', '),
      despacho: d.court ?? '', radicado: d.filing ?? '', contraparte: d.counterpart ?? '', calidad_cliente: (d.role ?? '').toLowerCase(),
      tipo_proceso: d.process ?? job?.category ?? '', etapa: d.stage ?? '', caso_titulo: job?.title ?? '', caso_descripcion: job?.description ?? '',
    };
    return { v, job };
  }

  /** Sugiere plantillas para un caso: área + categoría + palabras del título, proceso y descripción. */
  async suggest(businessId: string, jobId: string) {
    const { job } = await this.caseData(businessId, jobId);
    const d = job!.details ?? {};
    const areas = new Set([CASE_AREA[norm(d.area)], CASE_AREA[norm(job!.category)]].filter(Boolean) as string[]);
    const words = new Set(norm(`${job!.title} ${job!.category ?? ''} ${d.process ?? ''} ${d.stage ?? ''} ${job!.description ?? ''}`).split(' ').filter((w) => w.length > 3 && !STOP.has(w)));
    const cat = norm(job!.category);
    const all = await this.db.select({ id: legalTemplates.id, area: legalTemplates.area, category: legalTemplates.category, title: legalTemplates.title, description: legalTemplates.description, keywords: legalTemplates.keywords, businessId: legalTemplates.businessId })
      .from(legalTemplates).where(this.visible(businessId));
    const scored = all.map((t) => {
      let s = 0; const reasons: string[] = [];
      if (areas.has(t.area)) { s += 4; reasons.push(`área ${AREAS[t.area] ?? t.area}`); }
      if (cat && norm(t.category) === cat) { s += 5; reasons.push(`categoría ${t.category}`); }
      const hay = new Set(norm(`${t.title} ${t.category} ${t.keywords.join(' ')}`).split(' '));
      const hits = [...words].filter((w) => hay.has(w) || t.keywords.some((k) => norm(k).includes(w)));
      if (hits.length) { s += Math.min(hits.length, 4) * 2; reasons.push(`coincide con «${hits.slice(0, 3).join(', ')}»`); }
      if (t.area === 'general') s += 1;
      if (t.businessId === businessId) s += 1;
      return { id: t.id, area: t.area, category: t.category, title: t.title, description: t.description, score: s, reasons };
    }).sort((a, b) => b.score - a.score);
    const strong = scored.filter((t) => t.score >= 3);
    const general = scored.filter((t) => t.score < 3 && t.area === 'general').map((t) => ({ ...t, reasons: t.reasons.length ? t.reasons : ['útil en cualquier caso'] }));
    return { items: [...strong, ...general].slice(0, 8) };
  }

  async render(businessId: string, id: string, dto: RenderDto) {
    const t = await this.get(businessId, id);
    const { v } = await this.caseData(businessId, dto.jobId, dto.customerId);
    for (const [k, val] of Object.entries(dto.values ?? {})) if (typeof val === 'string' && /^[a-z0-9_]+$/.test(k)) v[k] = val.slice(0, 20000);
    const used = this.placeholders(t.body);
    const missing = used.filter((k) => !v[k]?.trim());
    const body = t.body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => v[k.toLowerCase()]?.trim() || '________');
    const labels = new Map([...AUTO_FIELDS, ...t.fields].map((f) => [f.key, f]));
    return {
      title: t.title, body, legalBasis: t.legalBasis,
      fields: used.map((k) => ({ key: k, label: labels.get(k)?.label ?? k, help: (labels.get(k) as any)?.help, value: v[k] ?? '', auto: AUTO_FIELDS.some((a) => a.key === k) })),
      missing,
    };
  }

  // ---------- Documentos del caso ----------
  async documents(businessId: string, jobId?: string) {
    return this.db.select({ id: legalDocuments.id, title: legalDocuments.title, jobId: legalDocuments.jobId, templateId: legalDocuments.templateId, createdAt: legalDocuments.createdAt, updatedAt: legalDocuments.updatedAt })
      .from(legalDocuments).where(and(eq(legalDocuments.businessId, businessId), jobId ? eq(legalDocuments.jobId, jobId) : undefined)).orderBy(desc(legalDocuments.updatedAt)).limit(200);
  }
  async document(businessId: string, id: string) {
    const [d] = await this.db.select().from(legalDocuments).where(and(eq(legalDocuments.id, id), eq(legalDocuments.businessId, businessId))).limit(1);
    if (!d) throw new NotFoundException('Documento no encontrado');
    return d;
  }
  async saveDocument(ctx: RequestContext, dto: DocumentDto, id?: string) {
    if (dto.jobId) { const [j] = await this.db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, dto.jobId), eq(jobs.businessId, ctx.businessId))).limit(1); if (!j) throw new BadRequestException('Caso no válido'); }
    if (id) {
      await this.document(ctx.businessId, id);
      await this.db.update(legalDocuments).set({ title: dto.title, body: dto.body }).where(eq(legalDocuments.id, id));
      return { id };
    }
    const [d] = await this.db.insert(legalDocuments).values({ businessId: ctx.businessId, jobId: dto.jobId ?? null, templateId: dto.templateId ?? null, title: dto.title, body: dto.body, createdById: ctx.userId }).returning({ id: legalDocuments.id });
    return d;
  }
  async removeDocument(businessId: string, id: string) {
    await this.document(businessId, id);
    await this.db.delete(legalDocuments).where(eq(legalDocuments.id, id));
    return { ok: true };
  }

  /** Word: HTML con los estilos de Word (se abre y edita en Word, Google Docs y LibreOffice). */
  async word(businessId: string, id: string, res: Response) {
    const d = await this.document(businessId, id);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>');
    const html = d.body.split(/\n{2,}/).map((p) => {
      if (p.startsWith('# ')) return `<p class="t">${inline(p.slice(2))}</p>`;
      if (p.startsWith('## ')) return `<p class="s">${inline(p.slice(3))}</p>`;
      return `<p>${inline(p)}</p>`;
    }).join('\n');
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page{size:21.59cm 27.94cm;margin:2.5cm 3cm}body{font-family:Arial;font-size:12pt;line-height:1.5}p{margin:0 0 12pt;text-align:justify}.t{text-align:center;font-weight:bold;font-size:13pt}.s{font-weight:bold}</style></head><body>${html}</body></html>`;
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${this.fileName(d.title)}.doc"`);
    res.end('﻿' + doc);
  }

  async pdf(businessId: string, id: string, res: Response) {
    const d = await this.document(businessId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${this.fileName(d.title)}.pdf"`);
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 72, bottom: 72, left: 85, right: 85 }, info: { Title: d.title } });
    doc.pipe(res);
    const W = doc.page.width - 170;
    for (const p of d.body.split(/\n{2,}/)) {
      if (p.startsWith('# ')) { doc.font('Helvetica-Bold').fontSize(13).text(p.slice(2).replace(/\*\*/g, ''), { width: W, align: 'center' }); doc.moveDown(0.8); continue; }
      const head = p.startsWith('## ');
      const text = head ? p.slice(3) : p;
      for (const line of text.split('\n')) {
        const parts = line.split(/(\*\*.+?\*\*)/g).filter((x) => x !== '');
        if (!parts.length) { doc.moveDown(0.5); continue; }
        parts.forEach((part, i) => {
          const bold = head || /^\*\*.+\*\*$/.test(part);
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11.5).text(bold && !head ? part.slice(2, -2) : part, { width: W, align: head ? 'left' : 'justify', lineGap: 3, continued: i < parts.length - 1 });
        });
      }
      doc.moveDown(0.8);
    }
    doc.end();
  }

  private fileName(t: string) { return norm(t).replace(/ /g, '-').slice(0, 60) || 'documento'; }
}

@Controller('legal')
export class LegalTemplatesController {
  constructor(private s: LegalTemplatesService) {}
  @RequirePermissions('sales:read') @Get('templates') list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) { return this.s.list(ctx.businessId, q); }
  @RequirePermissions('sales:read') @Get('templates/suggest/:jobId') suggest(@Ctx() ctx: RequestContext, @Param('jobId', ParseUUIDPipe) jobId: string) { return this.s.suggest(ctx.businessId, jobId); }
  @RequirePermissions('sales:read') @Get('templates/:id') get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('templates') create(@Ctx() ctx: RequestContext, @Body() dto: TemplateDto) { return this.s.create(ctx.businessId, dto); }
  @RequirePermissions('sales:create') @Post('templates/import') import(@Ctx() ctx: RequestContext, @Body() dto: ImportDto) { return this.s.import(ctx, dto); }
  @RequirePermissions('sales:create') @Put('templates/:id') update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateDto) { return this.s.update(ctx, id, dto); }
  @RequirePermissions('sales:create') @Delete('templates/:id') remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.remove(ctx, id); }
  @RequirePermissions('sales:read') @Post('templates/:id/render') render(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenderDto) { return this.s.render(ctx.businessId, id, dto); }

  @RequirePermissions('sales:read') @Get('documents') documents(@Ctx() ctx: RequestContext, @Query('jobId') jobId?: string) { return this.s.documents(ctx.businessId, jobId && /^[0-9a-f-]{36}$/i.test(jobId) ? jobId : undefined); }
  @RequirePermissions('sales:read') @Get('documents/:id') document(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.document(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('documents') createDoc(@Ctx() ctx: RequestContext, @Body() dto: DocumentDto) { return this.s.saveDocument(ctx, dto); }
  @RequirePermissions('sales:create') @Put('documents/:id') updateDoc(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DocumentDto) { return this.s.saveDocument(ctx, dto, id); }
  @RequirePermissions('sales:create') @Delete('documents/:id') removeDoc(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.removeDocument(ctx.businessId, id); }
  @RequirePermissions('sales:read') @Get('documents/:id/word') word(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { return this.s.word(ctx.businessId, id, res); }
  @RequirePermissions('sales:read') @Get('documents/:id/pdf') pdf(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { return this.s.pdf(ctx.businessId, id, res); }
}

@Module({ controllers: [LegalTemplatesController], providers: [LegalTemplatesService] })
export class LegalTemplatesModule {}
