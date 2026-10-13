import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Injectable,
  Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsNumberString, IsObject, IsOptional, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { AuthGuard, Ctx, CurrentUser, NoBusiness, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { CryptoService } from '../common/crypto.service';
import { PlanLimitsService } from '../common/plan-limits.service';
import { Db, InjectDb } from '../db/db';
import { businesses, memberships, passwordResetTokens, payments, plans, roles, subscriptions, users, warehouses } from '../db/schema';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../auth/mail.service';
import { AuthModule } from '../auth/auth.module';
import { config } from '../config';
import { REFERRAL_DAYS, grantReferralReward } from '../growth/growth.module';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeSocialLinks } from '../common/social-links';

const ROLE_KEYS = ['ADMIN', 'SELLER', 'ACCOUNTANT', 'EMPLOYEE'] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
class BrandColorsDto {
  @Matches(HEX, { message: 'Color principal inválido (usa #RRGGBB)' }) primary: string;
  @Matches(HEX, { message: 'Color de acento inválido (usa #RRGGBB)' }) accent: string;
  @IsOptional() @IsString() @MaxLength(40) paletteId?: string;
}

class BusinessDto {
  @IsString() @Length(2, 160) tradeName: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @Matches(/^[0-9A-Za-z.\- ]{3,40}$/, { message: 'NIT o identificación inválida' }) taxId?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsString() @MaxLength(80) businessType?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsIn(['PRODUCTS', 'SERVICES']) businessModel?: 'PRODUCTS' | 'SERVICES';
  @IsOptional() @IsIn(['LEGAL', 'TECH_REPAIR', 'BEAUTY', 'HEALTH', 'HOME', 'CONSULTING', 'EDUCATION', 'OTHER']) serviceProfile?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
  @IsOptional() @IsNumberString() monthlyGoal?: string;
  @IsOptional() @ValidateNested() @Type(() => BrandColorsDto) brandColors?: BrandColorsDto;
}
/** Al crear el negocio se puede indicar el código de quien lo invitó (referidos). */
class CreateBusinessDto extends BusinessDto {
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9]{4,12}$/) referralCode?: string;
}
class UpdateBusinessDto extends BusinessDto {
  @IsOptional() @IsString() @Length(2, 160) declare tradeName: string;
}

class AddMemberDto {
  @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email: string;
  @IsString() @Length(2, 160) fullName: string;
  @IsIn(ROLE_KEYS) roleKey: (typeof ROLE_KEYS)[number];
}
class UpdateMemberDto {
  @IsOptional() @IsIn(ROLE_KEYS) roleKey?: (typeof ROLE_KEYS)[number];
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
}

@Injectable()
export class BusinessesService {
  constructor(
    @InjectDb() private db: Db, private limits: PlanLimitsService, private auth: AuthService,
    private crypto: CryptoService, private mail: MailService, private guard: AuthGuard,
  ) {}

  private systemRole(key: string) {
    return this.db.query.roles.findFirst({ where: and(isNull(roles.businessId), eq(roles.key, key)) });
  }

  async create(userId: string, input: CreateBusinessDto) {
    const owner = await this.systemRole('OWNER');
    if (!owner) throw new Error('Roles no sembrados: ejecuta el seed');
    const { referralCode, ...dto } = input;
    const [referrer] = referralCode ? await this.db.select({ id: businesses.id }).from(businesses).where(eq(businesses.referralCode, referralCode.toUpperCase())) : [];
    return this.db.transaction(async (tx) => {
      const [b] = await tx.insert(businesses).values({ ...dto, socialLinks: normalizeSocialLinks(dto.socialLinks), ownerId: userId, referredByBusinessId: referrer?.id ?? null }).returning();
      await tx.insert(memberships).values({ userId, businessId: b.id, roleId: owner.id });
      await tx.insert(subscriptions).values({ businessId: b.id, planCode: 'FREE' });
      await tx.insert(warehouses).values({ businessId: b.id, name: 'Principal', isDefault: true });
      return b;
    });
  }

  async update(businessId: string, dto: UpdateBusinessDto) {
    const [b] = await this.db.update(businesses).set({ ...dto, socialLinks: dto.socialLinks === undefined ? undefined : normalizeSocialLinks(dto.socialLinks) }).where(eq(businesses.id, businessId)).returning();
    return b;
  }

  async get(businessId: string) {
    const b = await this.db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
    if (!b) return b;
    // Nunca se devuelven credenciales (aunque estén cifradas).
    const { wompiPrivateKeyEnc, wompiIntegritySecretEnc, wompiEventSecretEnc, einvoiceProvider, ...rest } = b as typeof b & Record<string, any>;
    return { ...rest, einvoiceProviderConfigured: !!(einvoiceProvider as any)?.provider };
  }

  members(businessId: string) {
    return this.db.select({
      id: memberships.id, userId: users.id, fullName: users.fullName, email: users.email,
      roleKey: roles.key, roleName: roles.name, status: memberships.status, createdAt: memberships.createdAt,
      twoFactorEnabled: users.twoFactorEnabled, phone: users.phone, socialLinks: users.socialLinks,
    }).from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(eq(memberships.businessId, businessId)).orderBy(asc(memberships.createdAt));
  }

  async addMember(businessId: string, dto: AddMemberDto) {
    await this.limits.assert(businessId, 'users');
    const role = await this.systemRole(dto.roleKey);
    if (!role) throw new BadRequestException('Rol inválido');
    let user = await this.db.query.users.findFirst({ where: eq(users.email, dto.email) });
    const business = await this.get(businessId);
    if (!user) {
      // Se crea la cuenta con contraseña aleatoria y se envía enlace para definirla
      [user] = await this.db.insert(users).values({
        email: dto.email, fullName: dto.fullName, passwordHash: await this.auth.hashPassword(this.crypto.randomToken()),
      }).returning();
      const token = this.crypto.randomToken();
      await this.db.insert(passwordResetTokens).values({
        userId: user.id, tokenHash: this.crypto.sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000),
      });
      await this.mail.send(dto.email, `Te invitaron a ${business?.tradeName} en DREAMS`,
        `Hola ${dto.fullName},\n\nTe agregaron como ${role.name} en ${business?.tradeName}.\nCrea tu contraseña aquí (válido 7 días):\n${config.webOrigin}/restablecer?token=${token}`);
    } else {
      await this.mail.send(dto.email, `Te agregaron a ${business?.tradeName} en DREAMS`,
        `Hola ${user.fullName},\n\nAhora tienes acceso a ${business?.tradeName} como ${role.name}. Inicia sesión en ${config.webOrigin}/ingresar`);
    }
    const exists = await this.db.query.memberships.findFirst({ where: and(eq(memberships.userId, user.id), eq(memberships.businessId, businessId)) });
    if (exists) throw new ConflictException('Esta persona ya pertenece al negocio');
    const [m] = await this.db.insert(memberships).values({ userId: user.id, businessId, roleId: role.id }).returning();
    return m;
  }

  private async memberOrThrow(businessId: string, id: string) {
    const m = await this.db.select({ id: memberships.id, userId: memberships.userId, roleKey: roles.key })
      .from(memberships).innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(and(eq(memberships.id, id), eq(memberships.businessId, businessId)));
    if (!m[0]) throw new NotFoundException('Miembro no encontrado');
    if (m[0].roleKey === 'OWNER') throw new ForbiddenException('No se puede modificar al propietario');
    return m[0];
  }

  async updateMember(businessId: string, id: string, dto: UpdateMemberDto) {
    await this.memberOrThrow(businessId, id);
    const set: Partial<typeof memberships.$inferInsert> = {};
    if (dto.roleKey) set.roleId = (await this.systemRole(dto.roleKey))!.id;
    if (dto.status) set.status = dto.status;
    await this.db.update(memberships).set(set).where(eq(memberships.id, id));
    this.guard.invalidate(businessId);
    return { ok: true };
  }

  async removeMember(businessId: string, id: string) {
    await this.memberOrThrow(businessId, id);
    await this.db.delete(memberships).where(eq(memberships.id, id));
    this.guard.invalidate(businessId);
    return { ok: true };
  }
}

const WOMPI_CURRENCY = 'COP';
const wompiApi = (publicKey: string) => publicKey.startsWith('pub_test_') ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

class PlanCheckoutDto {
  @IsIn(['BASIC', 'PRO', 'ENTERPRISE']) planCode: 'BASIC' | 'PRO' | 'ENTERPRISE';
}

@Injectable()
export class PlanBillingService {
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService) {}

  async summary(businessId: string) {
    const subscription = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.businessId, businessId), with: { plan: true },
    });
    if (!subscription) throw new NotFoundException('No se encontró el plan de este negocio');
    const history = await this.db.select({ id: payments.id, amount: payments.amount, currency: payments.currency,
      status: payments.status, provider: payments.provider, paymentMethod: payments.paymentMethod,
      paidAt: payments.paidAt, createdAt: payments.createdAt, targetPlanCode: payments.targetPlanCode })
      .from(payments).where(eq(payments.subscriptionId, subscription.id)).orderBy(desc(payments.createdAt)).limit(20);
    return {
      configured: Boolean(config.wompiSaasPublicKey && config.wompiSaasPrivateKey && config.wompiSaasIntegritySecret && config.wompiSaasEventSecret),
      subscription: { planCode: subscription.planCode, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd,
        provider: subscription.provider, planName: subscription.plan.name },
      renewal: 'MANUAL', payments: history,
    };
  }

  async checkout(businessId: string, userId: string, planCode: PlanCheckoutDto['planCode']) {
    const keys = [config.wompiSaasPublicKey, config.wompiSaasPrivateKey, config.wompiSaasIntegritySecret, config.wompiSaasEventSecret];
    if (keys.some((key) => !key)) throw new BadRequestException('Los pagos de planes aún no están configurados. DREAMS debe agregar sus llaves Wompi en el servidor.');
    const plan = await this.db.query.plans.findFirst({ where: eq(plans.code, planCode) });
    if (!plan || Number(plan.priceMonthly) <= 0) throw new BadRequestException('El plan seleccionado no tiene un precio válido');
    const subscription = await this.db.query.subscriptions.findFirst({ where: eq(subscriptions.businessId, businessId) });
    if (!subscription) throw new NotFoundException('No se encontró el plan de este negocio');
    const [user] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.email) throw new BadRequestException('Agrega un correo válido a tu cuenta antes de pagar el plan');

    const publicKey = config.wompiSaasPublicKey;
    const apiUrl = wompiApi(publicKey);
    const merchantResponse = await fetch(`${apiUrl}/merchants/${encodeURIComponent(publicKey)}`);
    if (!merchantResponse.ok) throw new BadRequestException('No fue posible conectar con Wompi. Intenta más tarde.');
    const merchant = await merchantResponse.json() as any;
    const acceptanceToken = merchant?.data?.presigned_acceptance?.acceptance_token;
    if (!acceptanceToken) throw new BadRequestException('Wompi no entregó el token de aceptación requerido');

    const reference = `DREAMPLAN-${randomUUID()}`;
    const amountInCents = String(Math.round(Number(plan.priceMonthly) * 100));
    const [payment] = await this.db.insert(payments).values({ subscriptionId: subscription.id, amount: plan.priceMonthly,
      currency: WOMPI_CURRENCY, status: 'PENDING', provider: 'WOMPI', targetPlanCode: planCode, providerRef: reference }).returning();
    return {
      paymentId: payment.id,
      checkout: { url: 'https://checkout.wompi.co/p/', publicKey, reference, amountInCents,
        currency: WOMPI_CURRENCY, acceptanceToken,
        signature: sha256(`${reference}${amountInCents}${WOMPI_CURRENCY}${config.wompiSaasIntegritySecret}`),
        redirectUrl: `${config.webOrigin.split(',')[0]}/configuracion?tab=plan&payment=return`, email: user.email },
    };
  }

  async handleWompiEvent(payload: any) {
    if (!payload?.signature?.checksum || !Array.isArray(payload.signature.properties) || !payload.timestamp) {
      throw new BadRequestException('Evento de pago inválido');
    }
    const transaction = payload.data?.transaction;
    if (!transaction?.reference?.startsWith('DREAMPLAN-') || !transaction?.id) throw new BadRequestException('Referencia de pago de plan inválida');
    const [payment] = await this.db.select().from(payments).where(eq(payments.providerRef, transaction.reference)).limit(1);
    if (!payment || payment.provider !== 'WOMPI') throw new NotFoundException('Pago de plan no encontrado');
    const valueAt = (obj: any, path: string) => path.split('.').reduce((value, key) => value?.[key], obj);
    const signed = payload.signature.properties.map((path: string) => valueAt(payload.data, path));
    if (signed.some((value: unknown) => value === undefined || value === null)) throw new BadRequestException('Firma incompleta');
    const expected = sha256(`${signed.join('')}${payload.timestamp}${config.wompiSaasEventSecret}`).toLowerCase();
    const received = String(payload.signature.checksum).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(received) || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
      throw new BadRequestException('Firma de evento Wompi inválida');
    }
    if (payload.event !== 'transaction.updated') return { received: true };
    const response = await fetch(`${wompiApi(config.wompiSaasPublicKey)}/transactions/${encodeURIComponent(transaction.id)}`, {
      headers: { Authorization: `Bearer ${config.wompiSaasPrivateKey}` },
    });
    if (!response.ok) throw new BadRequestException('No se pudo verificar el pago con Wompi');
    const verified = (await response.json() as any)?.data;
    const expectedCents = Math.round(Number(payment.amount) * 100);
    if (verified?.id !== transaction.id || verified?.reference !== payment.providerRef ||
      verified?.amount_in_cents !== expectedCents || verified?.currency !== payment.currency) {
      throw new BadRequestException('El pago confirmado no coincide con el plan seleccionado');
    }
    const status = verified.status === 'APPROVED' ? 'PAID' : ['DECLINED', 'VOIDED', 'ERROR'].includes(verified.status) ? 'FAILED' : 'PENDING';
    const out: { rewarded: Awaited<ReturnType<typeof grantReferralReward>> } = { rewarded: null };
    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select().from(payments).where(eq(payments.id, payment.id)).for('update');
      if (!locked || locked.status === 'PAID') return;
      await tx.update(payments).set({ status, transactionId: verified.id,
        paymentMethod: verified.payment_method_type ?? verified.payment_method?.type ?? null,
        paidAt: status === 'PAID' ? new Date() : null }).where(eq(payments.id, payment.id));
      if (status === 'PAID' && locked.targetPlanCode) {
        const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, locked.subscriptionId)).for('update');
        if (sub) {
          const now = new Date();
          const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? new Date(sub.currentPeriodEnd) : now;
          base.setMonth(base.getMonth() + 1);
          await tx.update(subscriptions).set({ planCode: locked.targetPlanCode, status: 'ACTIVE', currentPeriodEnd: base, provider: 'WOMPI' })
            .where(eq(subscriptions.id, sub.id));
          // Referidos: quien invitó a este negocio recibe 15 días (solo con el primer pago de un plan).
          out.rewarded = await grantReferralReward(tx, sub.businessId, locked.id, locked.targetPlanCode);
        }
      }
    });
    const rewarded = out.rewarded;
    if (rewarded) {
      await this.notifications.notify(rewarded.referrer, 'GOAL_REACHED', `¡Ganaste ${REFERRAL_DAYS} días!`,
        `${rewarded.referredName} se unió a DREAMS con tu invitación y adquirió un plan. ${rewarded.wasFree ? `Tienes ${REFERRAL_DAYS} días del plan Emprendedor.` : `Sumamos ${REFERRAL_DAYS} días a tu plan.`}`);
    }
    return { received: true };
  }
}

@Controller('billing')
export class PlanBillingController {
  constructor(private billing: PlanBillingService) {}
  @Get('current') @RequirePermissions('business:manage')
  summary(@Ctx() ctx: RequestContext) { return this.billing.summary(ctx.businessId); }
  @Post('current/checkout') @RequirePermissions('business:manage')
  checkout(@Ctx() ctx: RequestContext, @Body() dto: PlanCheckoutDto) { return this.billing.checkout(ctx.businessId, ctx.userId, dto.planCode); }
  @Public() @Post('wompi/webhook')
  webhook(@Body() body: any) { return this.billing.handleWompiEvent(body); }
}

@Controller('businesses')
export class BusinessesController {
  constructor(private service: BusinessesService, private limits: PlanLimitsService, @InjectDb() private db: Db) {}

  @Post() @NoBusiness()
  create(@CurrentUser() u: { userId: string }, @Body() dto: CreateBusinessDto) {
    return this.service.create(u.userId, dto);
  }

  @Get('current')
  current(@Ctx() ctx: RequestContext) {
    return this.service.get(ctx.businessId);
  }

  @Patch('current') @RequirePermissions('business:manage')
  update(@Ctx() ctx: RequestContext, @Body() dto: UpdateBusinessDto) {
    return this.service.update(ctx.businessId, dto);
  }

  @Get('current/members') @RequirePermissions('members:manage')
  members(@Ctx() ctx: RequestContext) {
    return this.service.members(ctx.businessId);
  }

  @Post('current/members') @RequirePermissions('members:manage')
  addMember(@Ctx() ctx: RequestContext, @Body() dto: AddMemberDto) {
    return this.service.addMember(ctx.businessId, dto);
  }

  @Patch('current/members/:id') @RequirePermissions('members:manage')
  updateMember(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMemberDto) {
    return this.service.updateMember(ctx.businessId, id, dto);
  }

  @Delete('current/members/:id') @RequirePermissions('members:manage')
  removeMember(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeMember(ctx.businessId, id);
  }

  @Get('current/roles')
  async roles() {
    const rows = await this.db.query.roles.findMany({ where: isNull(roles.businessId), with: { permissions: true } });
    return rows.map((r) => ({ key: r.key, name: r.name, permissions: r.permissions.map((p) => p.permission) }));
  }

  @Get('current/plan')
  async plan(@Ctx() ctx: RequestContext) {
    return { ...(await this.limits.limits(ctx.businessId)), usage: await this.limits.usage(ctx.businessId) };
  }
}

@Controller('plans')
export class PlansController {
  constructor(@InjectDb() private db: Db) {}
  @Public() @Get()
  list() {
    return this.db.select().from(plans).orderBy(asc(plans.priceMonthly));
  }
}

@Module({
  imports: [AuthModule],
  controllers: [BusinessesController, PlansController, PlanBillingController],
  providers: [BusinessesService, PlanBillingService],
})
export class BusinessesModule {}
