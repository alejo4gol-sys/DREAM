/**
 * Reseñas y ficha pública de los negocios del directorio «Negocios en DREAMS».
 * - Cualquier persona puede calificar (1 a 5) sin crear cuenta; una reseña por dispositivo y negocio cada 30 días.
 * - El negocio puede responder públicamente y reportar reseñas falsas u ofensivas; no puede borrarlas.
 *   La administración de DREAMS revisa los reportes y decide si ocultarlas.
 * - Ficha pública: datos de contacto, mapa y botón «Cómo llegar» (Google Maps, sin llave de API).
 */
import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { and, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { config } from '../config';
import { Db, InjectDb } from '../db/db';
import { businessReviews, businesses, users } from '../db/schema';

class ReviewDto {
  @IsString() @Length(2, 80) authorName: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1200) body?: string;
  /** Campo trampa para robots: debe llegar vacío. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
class ReplyDto { @IsString() @MaxLength(1000) reply: string; }
class ReportDto { @IsString() @Length(5, 300) reason: string; }
class AdminDto { @IsIn(['PUBLISHED', 'HIDDEN']) status: 'PUBLISHED' | 'HIDDEN'; }
class PageQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page?: number; }
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Promedio y cantidad de reseñas visibles por negocio (para el directorio). */
export async function ratingsFor(db: Db, ids: string[]) {
  if (!ids.length) return new Map<string, { avg: number; count: number }>();
  const rows = await db.select({ b: businessReviews.businessId, avg: sql<string>`round(avg(${businessReviews.rating})::numeric, 1)`, n: sql<number>`count(*)::int` })
    .from(businessReviews).where(and(inArray(businessReviews.businessId, ids), ne(businessReviews.status, 'HIDDEN'))).groupBy(businessReviews.businessId);
  return new Map(rows.map((r) => [r.b, { avg: Number(r.avg), count: r.n }]));
}

export const mapsQuery = (address?: string | null, city?: string | null, name?: string) => {
  const a = address?.trim() ?? ''; const c = city?.trim() ?? '';
  const withCity = c && !a.toLowerCase().includes(c.toLowerCase()) ? [a, c] : [a];
  return [...withCity, 'Colombia'].filter(Boolean).join(', ') || name || '';
};

@Injectable()
export class ReviewsService {
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService) {}

  private async listed(slug: string) {
    if (!SLUG.test(slug)) throw new NotFoundException('Negocio no encontrado');
    const [b] = await this.db.select().from(businesses).where(and(eq(businesses.storeSlug, slug), eq(businesses.storeEnabled, true))).limit(1);
    if (!b || (b.storeConfig as any)?.showInDirectory === false) throw new NotFoundException('Negocio no encontrado');
    return b;
  }

  /** Ficha pública del directorio. */
  async profile(slug: string) {
    const b = await this.listed(slug);
    const cfg = (b.storeConfig ?? {}) as Record<string, any>;
    const showMap = cfg.showMap !== false && !!(b.address?.trim() || cfg.pickupAddress?.trim());
    const address = cfg.pickupAddress?.trim() || b.address?.trim() || null;
    const q = mapsQuery(address, b.city, b.tradeName);
    const r = (await ratingsFor(this.db, [b.id])).get(b.id) ?? { avg: 0, count: 0 };
    const wa = String(cfg.whatsapp || b.phone || '').replace(/\D/g, '');
    return {
      name: b.tradeName, slug: b.storeSlug, logoUrl: b.logoUrl?.startsWith('data:') ? null : b.logoUrl, city: b.city, category: b.category, businessType: b.businessType,
      businessModel: b.businessModel, serviceProfile: b.serviceProfile, headline: cfg.headline ?? '', description: cfg.description ?? '',
      primary: cfg.primaryColor ?? null, accent: cfg.accentColor ?? null, socialLinks: cfg.showSocialLinks === false ? {} : b.socialLinks,
      whatsapp: wa ? (wa.length === 10 ? `57${wa}` : wa) : null, phone: b.phone,
      storeUrl: `${config.appPublicUrl}/tienda/${b.storeSlug}`,
      address: showMap ? address : null,
      map: showMap ? {
        embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`,
        openUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
        wazeUrl: `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`,
      } : null,
      rating: r,
    };
  }

  async publicList(slug: string, page = 1) {
    const b = await this.listed(slug);
    const size = 10;
    const where = and(eq(businessReviews.businessId, b.id), ne(businessReviews.status, 'HIDDEN'));
    const items = await this.db.select({ id: businessReviews.id, authorName: businessReviews.authorName, rating: businessReviews.rating, body: businessReviews.body, reply: businessReviews.reply, repliedAt: businessReviews.repliedAt, createdAt: businessReviews.createdAt })
      .from(businessReviews).where(where).orderBy(desc(businessReviews.createdAt)).limit(size).offset((page - 1) * size);
    const dist = await this.db.select({ rating: businessReviews.rating, n: sql<number>`count(*)::int` }).from(businessReviews).where(where).groupBy(businessReviews.rating);
    const total = dist.reduce((s, d) => s + d.n, 0);
    const avg = total ? Math.round((dist.reduce((s, d) => s + d.rating * d.n, 0) / total) * 10) / 10 : 0;
    return { avg, total, distribution: Object.fromEntries([5, 4, 3, 2, 1].map((k) => [k, dist.find((d) => d.rating === k)?.n ?? 0])), page, pages: Math.max(1, Math.ceil(total / size)), items };
  }

  async create(slug: string, dto: ReviewDto, req: Request) {
    if (dto.website) return { ok: true }; // robot
    const b = await this.listed(slug);
    const ip = (req.ip ?? '').replace(/^::ffff:/, '');
    const fingerprint = createHash('sha256').update(`${config.jwtSecret}|${ip}|${req.headers['user-agent'] ?? ''}|${b.id}`).digest('hex');
    const since = new Date(Date.now() - 30 * 86400_000);
    const [dup] = await this.db.select({ id: businessReviews.id }).from(businessReviews)
      .where(and(eq(businessReviews.businessId, b.id), eq(businessReviews.fingerprint, fingerprint), gte(businessReviews.createdAt, since))).limit(1);
    if (dup) throw new BadRequestException('Ya dejaste una reseña para este negocio. Podrás dejar otra en 30 días.');
    const body = dto.body?.replace(/\s+\n/g, '\n').trim() || null;
    if (body && /(https?:\/\/|www\.)/i.test(body)) throw new BadRequestException('La reseña no puede tener enlaces.');
    const [r] = await this.db.insert(businessReviews).values({ businessId: b.id, authorName: dto.authorName.trim(), rating: dto.rating, body, fingerprint }).returning({ id: businessReviews.id });
    await this.notifications.notify(b.id, 'NEW_REVIEW', `Nueva reseña: ${'★'.repeat(dto.rating)}${'☆'.repeat(5 - dto.rating)}`,
      `${dto.authorName.trim()} calificó tu negocio${body ? `: «${body.slice(0, 120)}${body.length > 120 ? '…' : ''}»` : '.'} Puedes responderle desde Mi página → Reseñas.`, { reviewId: r.id });
    return { ok: true, id: r.id };
  }

  // ---------- Panel del negocio ----------
  async mine(businessId: string) {
    const items = await this.db.select().from(businessReviews).where(eq(businessReviews.businessId, businessId)).orderBy(desc(businessReviews.createdAt)).limit(300);
    const visible = items.filter((i) => i.status !== 'HIDDEN');
    const avg = visible.length ? Math.round((visible.reduce((s, i) => s + i.rating, 0) / visible.length) * 10) / 10 : 0;
    const [b] = await this.db.select({ slug: businesses.storeSlug }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
    return { avg, total: visible.length, pendingReply: visible.filter((i) => !i.reply).length, profileUrl: b?.slug ? `${config.appPublicUrl}/negocios/${b.slug}` : null, items: items.map(({ fingerprint, ...r }) => r) };
  }
  private async own(businessId: string, id: string) {
    const [r] = await this.db.select().from(businessReviews).where(and(eq(businessReviews.id, id), eq(businessReviews.businessId, businessId))).limit(1);
    if (!r) throw new NotFoundException('Reseña no encontrada');
    return r;
  }
  async reply(businessId: string, id: string, dto: ReplyDto) {
    await this.own(businessId, id);
    const reply = dto.reply.trim() || null;
    await this.db.update(businessReviews).set({ reply, repliedAt: reply ? new Date() : null }).where(eq(businessReviews.id, id));
    return { ok: true };
  }
  async report(businessId: string, id: string, dto: ReportDto) {
    const r = await this.own(businessId, id);
    if (r.status === 'HIDDEN') return { ok: true };
    await this.db.update(businessReviews).set({ status: 'REPORTED', reportReason: dto.reason.trim() }).where(eq(businessReviews.id, id));
    return { ok: true };
  }

  // ---------- Administración de DREAMS ----------
  private async assertAdmin(userId: string) {
    const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!u || !config.platformAdmins.includes(u.email.toLowerCase())) throw new ForbiddenException('Solo la administración de DREAMS.');
  }
  async reported(userId: string) {
    await this.assertAdmin(userId);
    return this.db.select({ id: businessReviews.id, business: businesses.tradeName, slug: businesses.storeSlug, authorName: businessReviews.authorName, rating: businessReviews.rating, body: businessReviews.body, reportReason: businessReviews.reportReason, status: businessReviews.status, createdAt: businessReviews.createdAt })
      .from(businessReviews).innerJoin(businesses, eq(businesses.id, businessReviews.businessId))
      .where(inArray(businessReviews.status, ['REPORTED', 'HIDDEN'])).orderBy(desc(businessReviews.createdAt)).limit(200);
  }
  async moderate(userId: string, id: string, dto: AdminDto) {
    await this.assertAdmin(userId);
    const [r] = await this.db.update(businessReviews).set({ status: dto.status }).where(eq(businessReviews.id, id)).returning({ id: businessReviews.id });
    if (!r) throw new NotFoundException('Reseña no encontrada');
    return { ok: true };
  }
}

@Controller('reviews')
export class ReviewsController {
  constructor(private s: ReviewsService) {}
  @Public() @Throttle({ default: { limit: 60, ttl: 60_000 } }) @Get('public/:slug') list(@Param('slug') slug: string, @Query() q: PageQuery) { return this.s.publicList(slug, q.page ?? 1); }
  @Public() @Throttle({ default: { limit: 60, ttl: 60_000 } }) @Get('public/:slug/profile') profile(@Param('slug') slug: string) { return this.s.profile(slug); }
  @Public() @Throttle({ default: { limit: 4, ttl: 3_600_000 } }) @Post('public/:slug') create(@Param('slug') slug: string, @Body() dto: ReviewDto, @Req() req: Request) { return this.s.create(slug, dto, req); }

  @RequirePermissions('customers:read') @Get() mine(@Ctx() ctx: RequestContext) { return this.s.mine(ctx.businessId); }
  @RequirePermissions('customers:write') @Post(':id/reply') reply(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto) { return this.s.reply(ctx.businessId, id, dto); }
  @RequirePermissions('customers:write') @Post(':id/report') report(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDto) { return this.s.report(ctx.businessId, id, dto); }

  @RequirePermissions('customers:read') @Get('admin/reported') reported(@Ctx() ctx: RequestContext) { return this.s.reported(ctx.userId); }
  @RequirePermissions('customers:read') @Patch('admin/:id') moderate(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminDto) { return this.s.moderate(ctx.userId, id, dto); }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
