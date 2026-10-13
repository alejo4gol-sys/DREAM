/**
 * Crecimiento de DREAMS:
 * - Guía de arranque (pasos calculados con los datos reales del negocio).
 * - Referidos: cada negocio invita con su código; cuando el negocio invitado PAGA un plan, quien invitó recibe 15 días.
 *   Si quien invitó está en un plan pago, se suman 15 días a su periodo; si está en Gratis, recibe 15 días del plan Emprendedor.
 * - Testimonios: los usuarios los escriben con autorización de publicación; la administración de la plataforma los aprueba.
 */
import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Logger, Module, NotFoundException, OnModuleDestroy, OnModuleInit, Param, ParseUUIDPipe, Post, Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { and, count, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { config } from '../config';
import { Db, InjectDb, Tx } from '../db/db';
import { businesses, jobs, products, referralRewards, sales, subscriptions, testimonials, users } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

export const REFERRAL_DAYS = 15;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class MarkDto { @IsIn(['shared', 'testimonial']) step: string; }
class TestimonialDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @Length(20, 600) body: string;
  @IsString() @Length(2, 120) authorName: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsBoolean() consent: boolean;
}
class ReviewStatusDto { @IsIn(['APPROVED', 'REJECTED', 'PENDING']) status: string; }

/** Otorga los días al negocio que invitó. Se llama dentro de la transacción del pago aprobado. */
export async function grantReferralReward(tx: Tx, referredBusinessId: string, paymentId: string | null, planCode: string | null) {
  const [ref] = await tx.select({ by: businesses.referredByBusinessId, name: businesses.tradeName }).from(businesses).where(eq(businesses.id, referredBusinessId));
  if (!ref?.by || ref.by === referredBusinessId) return null;
  const [already] = await tx.select({ id: referralRewards.id }).from(referralRewards).where(eq(referralRewards.referredBusinessId, referredBusinessId));
  if (already) return null;
  const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.businessId, ref.by)).for('update');
  if (!sub) return null;
  const now = new Date();
  const day = 86400_000;
  if (sub.planCode === 'FREE' || sub.status === 'CANCELLED') {
    await tx.update(subscriptions).set({ planCode: 'BASIC', status: 'TRIALING', currentPeriodEnd: new Date(now.getTime() + REFERRAL_DAYS * day) }).where(eq(subscriptions.id, sub.id));
  } else {
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    await tx.update(subscriptions).set({ currentPeriodEnd: new Date(base.getTime() + REFERRAL_DAYS * day) }).where(eq(subscriptions.id, sub.id));
  }
  await tx.insert(referralRewards).values({ referrerBusinessId: ref.by, referredBusinessId, paymentId, planCode, days: REFERRAL_DAYS });
  return { referrer: ref.by, referredName: ref.name, wasFree: sub.planCode === 'FREE' };
}

@Injectable()
export class GrowthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrowthService.name);
  private timer?: NodeJS.Timeout;
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    // Los días de regalo del plan Emprendedor (estado TRIALING) vuelven a Gratis al terminar.
    this.timer = setInterval(() => this.expireTrials().catch((e) => this.logger.warn(e.message)), 3600_000);
    setTimeout(() => this.expireTrials().catch((e) => this.logger.warn(e.message)), 20_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async expireTrials() {
    const rows = await this.db.update(subscriptions).set({ planCode: 'FREE', status: 'ACTIVE', currentPeriodEnd: null })
      .where(and(eq(subscriptions.status, 'TRIALING'), isNotNull(subscriptions.currentPeriodEnd), lt(subscriptions.currentPeriodEnd, new Date()))).returning({ b: subscriptions.businessId });
    for (const r of rows) await this.notifications.notify(r.b, 'GOAL_REACHED', 'Terminaron tus días de regalo', 'Tu negocio volvió al plan Gratis. Invita más negocios o mejora tu plan para seguir con las funciones del plan Emprendedor.');
  }

  private async isAdmin(userId: string) {
    const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    return !!u && config.platformAdmins.includes(u.email.toLowerCase());
  }

  // ───────── Guía de arranque ─────────
  async onboarding(businessId: string) {
    const [b] = await this.db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!b) throw new NotFoundException();
    const services = b.businessModel === 'SERVICES';
    const [{ n: items }] = await this.db.select({ n: count() }).from(products).where(and(eq(products.businessId, businessId), eq(products.isActive, true)));
    const [{ n: withAgenda }] = await this.db.select({ n: count() }).from(products).where(and(eq(products.businessId, businessId), isNotNull(products.appointmentSchedule)));
    const [{ n: salesCount }] = await this.db.select({ n: count() }).from(sales).where(eq(sales.businessId, businessId));
    const [{ n: jobsCount }] = await this.db.select({ n: count() }).from(jobs).where(eq(jobs.businessId, businessId));
    const cfg = (b.storeConfig ?? {}) as any;
    const payments = (cfg.paymentMethods ?? []).filter((m: any) => m?.enabled).length + (b.wompiPublicKey ? 1 : 0);
    const marks = b.onboarding?.marks ?? {};
    const steps = [
      { key: 'logo', title: 'Sube el logo de tu negocio', text: 'Aparece en tu página, tus facturas y tus catálogos.', href: '/configuracion', done: !!b.logoUrl },
      services
        ? { key: 'catalog', title: 'Crea tus primeros servicios', text: 'Con precio y, si quieres, horario para que te reserven.', href: '/servicios', done: items >= 1 }
        : { key: 'catalog', title: 'Carga tus primeros 5 productos', text: 'Con foto y precio. Puedes agregar más después.', href: '/productos', done: items >= 5 },
      ...(services ? [{ key: 'agenda', title: 'Activa la agenda de un servicio', text: 'Tus clientes reservan la cita desde tu página.', href: '/servicios', done: withAgenda >= 1 }] : []),
      { key: 'payments', title: 'Elige cómo te pagan', text: 'Nequi, Daviplata, Bre-B, transferencia, efectivo o link de pago.', href: '/mi-tienda', done: payments >= 1 },
      { key: 'page', title: 'Publica tu página web', text: 'Tu catálogo en línea para recibir pedidos y reservas.', href: '/mi-tienda', done: !!b.storeEnabled },
      { key: 'shared', title: 'Comparte tu página', text: 'Por WhatsApp, Instagram o con tu código QR.', href: '/mi-tienda?tab=compartir', done: !!marks.shared },
      services
        ? { key: 'first', title: 'Registra tu primer trabajo o cita', text: 'Así empiezas a ver tu tablero con datos reales.', href: '/trabajos', done: jobsCount + salesCount >= 1 }
        : { key: 'first', title: 'Registra tu primera venta', text: 'En 3 toques desde «Venta rápida».', href: '/venta-rapida', done: salesCount >= 1 },
    ];
    const done = steps.filter((s) => s.done).length;
    return { steps, done, total: steps.length, percent: Math.round((done / steps.length) * 100), dismissed: !!b.onboarding?.dismissed, testimonialGiven: !!marks.testimonial };
  }

  async mark(businessId: string, step: string) {
    const [b] = await this.db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, businessId));
    const o = b?.o ?? {};
    await this.db.update(businesses).set({ onboarding: { ...o, marks: { ...(o.marks ?? {}), [step]: new Date().toISOString() } } }).where(eq(businesses.id, businessId));
    return { ok: true };
  }
  async dismiss(businessId: string, value: boolean) {
    const [b] = await this.db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, businessId));
    await this.db.update(businesses).set({ onboarding: { ...(b?.o ?? {}), dismissed: value } }).where(eq(businesses.id, businessId));
    return this.onboarding(businessId);
  }

  // ───────── Referidos ─────────
  private async ensureCode(businessId: string) {
    const [b] = await this.db.select({ code: businesses.referralCode, name: businesses.tradeName }).from(businesses).where(eq(businesses.id, businessId));
    if (!b) throw new NotFoundException();
    if (b.code) return b.code;
    const base = b.name.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4).padEnd(3, 'X');
    for (let i = 0; i < 8; i++) {
      const code = `${base}${Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;
      try {
        await this.db.update(businesses).set({ referralCode: code }).where(eq(businesses.id, businessId));
        return code;
      } catch { /* código repetido: intenta otro */ }
    }
    throw new BadRequestException('No se pudo crear el código. Intenta de nuevo.');
  }

  async myReferrals(businessId: string) {
    const code = await this.ensureCode(businessId);
    const invited = await this.db.select({ id: businesses.id, name: businesses.tradeName, createdAt: businesses.createdAt, plan: subscriptions.planCode, status: subscriptions.status })
      .from(businesses).leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
      .where(eq(businesses.referredByBusinessId, businessId)).orderBy(desc(businesses.createdAt)).limit(200);
    const rewards = invited.length ? await this.db.select().from(referralRewards).where(inArray(referralRewards.referredBusinessId, invited.map((i) => i.id))) : [];
    const byRef = new Map(rewards.map((r) => [r.referredBusinessId, r]));
    const [sub] = await this.db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId));
    return {
      code, link: `${config.appPublicUrl}/registro?ref=${code}`, days: REFERRAL_DAYS,
      invited: invited.map((i) => ({ name: i.name, createdAt: i.createdAt, rewarded: byRef.has(i.id), rewardedAt: byRef.get(i.id)?.grantedAt ?? null })),
      totalDays: rewards.reduce((a, r) => a + r.days, 0),
      subscription: sub ? { planCode: sub.planCode, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null,
    };
  }

  async checkCode(code: string) {
    const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const [b] = await this.db.select({ name: businesses.tradeName }).from(businesses).where(eq(businesses.referralCode, c));
    return b ? { valid: true, businessName: b.name, code: c } : { valid: false };
  }

  // ───────── Testimonios ─────────
  async addTestimonial(ctx: RequestContext, dto: TestimonialDto) {
    if (!dto.consent) throw new BadRequestException('Necesitamos tu autorización para publicar tu opinión.');
    const [b] = await this.db.select({ name: businesses.tradeName, city: businesses.city }).from(businesses).where(eq(businesses.id, ctx.businessId));
    const [recent] = await this.db.select({ n: count() }).from(testimonials).where(and(eq(testimonials.businessId, ctx.businessId), sql`${testimonials.createdAt} > now() - interval '1 day'`));
    if (recent.n >= 2) throw new BadRequestException('Ya recibimos tu opinión hoy. ¡Gracias!');
    await this.db.insert(testimonials).values({
      businessId: ctx.businessId, userId: ctx.userId, authorName: dto.authorName.trim(), businessName: b?.name ?? '', city: dto.city?.trim() || b?.city || null,
      rating: dto.rating, body: dto.body.trim(), consent: true,
    });
    await this.mark(ctx.businessId, 'testimonial');
    return { ok: true };
  }

  async publicTestimonials() {
    const rows = await this.db.select({ id: testimonials.id, authorName: testimonials.authorName, businessName: testimonials.businessName, city: testimonials.city, rating: testimonials.rating, body: testimonials.body })
      .from(testimonials).where(eq(testimonials.status, 'APPROVED')).orderBy(desc(testimonials.createdAt)).limit(9);
    return rows;
  }

  async adminTestimonials(userId: string) {
    if (!(await this.isAdmin(userId))) throw new ForbiddenException('Solo la administración de DREAMS.');
    return this.db.select().from(testimonials).orderBy(desc(testimonials.createdAt)).limit(200);
  }
  async setTestimonial(userId: string, id: string, status: string) {
    if (!(await this.isAdmin(userId))) throw new ForbiddenException('Solo la administración de DREAMS.');
    const [t] = await this.db.update(testimonials).set({ status }).where(eq(testimonials.id, id)).returning();
    if (!t) throw new NotFoundException();
    return t;
  }
  async adminMe(userId: string) { return { admin: await this.isAdmin(userId) }; }
}

@Controller('growth')
export class GrowthController {
  constructor(private s: GrowthService) {}
  @RequirePermissions('sales:read') @Get('onboarding') onboarding(@Ctx() ctx: RequestContext) { return this.s.onboarding(ctx.businessId); }
  @RequirePermissions('sales:read') @Post('onboarding/mark') mark(@Ctx() ctx: RequestContext, @Body() dto: MarkDto) { return this.s.mark(ctx.businessId, dto.step); }
  @RequirePermissions('sales:read') @Post('onboarding/dismiss') dismiss(@Ctx() ctx: RequestContext) { return this.s.dismiss(ctx.businessId, true); }
  @RequirePermissions('sales:read') @Post('onboarding/show') show(@Ctx() ctx: RequestContext) { return this.s.dismiss(ctx.businessId, false); }
  @RequirePermissions('business:manage') @Get('referrals') referrals(@Ctx() ctx: RequestContext) { return this.s.myReferrals(ctx.businessId); }
  @Public() @Get('referrals/check/:code') @Throttle({ default: { limit: 30, ttl: 60_000 } }) check(@Param('code') code: string) { return this.s.checkCode(code); }
  @RequirePermissions('sales:read') @Post('testimonials') @Throttle({ default: { limit: 5, ttl: 3600_000 } }) testimonial(@Ctx() ctx: RequestContext, @Body() dto: TestimonialDto) { return this.s.addTestimonial(ctx, dto); }
  @Public() @Get('testimonials/public') publicT() { return this.s.publicTestimonials(); }
  /** Datos públicos de contacto de DREAMS (botón de soporte por WhatsApp). */
  @Public() @Get('support') support() { const n = (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, ''); return { whatsapp: n ? (n.length === 10 ? `57${n}` : n) : null }; }
  @RequirePermissions('sales:read') @Get('admin/me') adminMe(@Ctx() ctx: RequestContext) { return this.s.adminMe(ctx.userId); }
  @RequirePermissions('sales:read') @Get('admin/testimonials') adminT(@Ctx() ctx: RequestContext) { return this.s.adminTestimonials(ctx.userId); }
  @RequirePermissions('sales:read') @Put('admin/testimonials/:id') setT(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewStatusDto) { return this.s.setTestimonial(ctx.userId, id, dto.status); }
}

@Module({ controllers: [GrowthController], providers: [GrowthService], exports: [GrowthService] })
export class GrowthModule {}
