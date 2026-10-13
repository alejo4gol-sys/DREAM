/**
 * Avisos por WhatsApp (WhatsApp Business Platform · Cloud API oficial de Meta) y envío centralizado de alertas.
 *
 * - Solo se envía a usuarios que autorizaron expresamente los avisos (tabla whatsapp_contacts) y cuyo negocio
 *   tiene un plan con avisos por WhatsApp y la suscripción activa.
 * - Fuera de la ventana de 24 h, WhatsApp solo permite plantillas aprobadas por Meta (categoría UTILITY).
 *   Las plantillas que usa DREAMS están en WA_TEMPLATES y deben crearse en el WhatsApp Manager con ese mismo nombre.
 * - Sin WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID no se envía nada: el intento queda registrado como NOT_CONFIGURED.
 * - El webhook recibe los estados (entregado, leído, fallido) y las respuestas «STOP» / «BAJA» para retirar la autorización.
 */
import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Global, Headers, HttpCode, Injectable, Logger, Module, Post, Put, Query, Req, Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsString, Matches } from 'class-validator';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { Ctx, NoBusiness, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { PlanLimitsService } from '../common/plan-limits.service';
import { config } from '../config';
import { Db, InjectDb } from '../db/db';
import { businesses, memberships, outboundMessages, users, whatsappContacts } from '../db/schema';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';

/** Tipos de aviso que se pueden recibir por WhatsApp. */
export const WA_ALERTS = {
  PROCESS_UPDATE: 'Nuevas actuaciones o novedades en procesos vigilados',
  TERM_DUE: 'Términos de caducidad o prescripción por vencer',
  PROCESS_REMINDER: 'Recordatorios para revisar procesos en entidades sin consulta automática',
} as const;
export type WaAlert = keyof typeof WA_ALERTS;

/** Plantillas (categoría UTILITY, idioma es_CO, parámetros con nombre). Deben aprobarse en el WhatsApp Manager. */
export const WA_TEMPLATES: Record<WaAlert, { name: string; body: string; params: string[]; button: string }> = {
  PROCESS_UPDATE: {
    name: 'dreams_novedad_proceso',
    body: 'Hola {{nombre}}, hay una novedad en el proceso {{proceso}}: {{novedad}}. Revisa el detalle en DREAMS.',
    params: ['nombre', 'proceso', 'novedad'], button: 'Ver proceso',
  },
  TERM_DUE: {
    name: 'dreams_termino_por_vencer',
    body: 'Hola {{nombre}}, el término {{termino}} vence el {{fecha}}. Revisa el caso en DREAMS.',
    params: ['nombre', 'termino', 'fecha'], button: 'Ver término',
  },
  PROCESS_REMINDER: {
    name: 'dreams_recordatorio_proceso',
    body: 'Hola {{nombre}}, te recordamos revisar el estado del proceso {{proceso}} en {{entidad}}.',
    params: ['nombre', 'proceso', 'entidad'], button: 'Abrir proceso',
  },
};

export const CONSENT_VERSION = '2026-10';
export const consentText = (business: string) =>
  `Autorizo a DREAMS a enviarme por WhatsApp avisos de servicio sobre ${business}: novedades de los procesos que vigilo, términos por vencer y recordatorios que yo active. `
  + 'Puedo dejar de recibirlos en cualquier momento desde DREAMS o respondiendo STOP. Mis datos se tratan según la Ley 1581 de 2012.';

/** Normaliza un celular colombiano a formato internacional sin «+» (57XXXXXXXXXX). */
export function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (/^3\d{9}$/.test(d)) return `57${d}`;
  if (/^573\d{9}$/.test(d)) return d;
  if (/^\d{10,15}$/.test(d) && !d.startsWith('0')) return d;
  return null;
}
/** WhatsApp no acepta saltos de línea, tabulaciones ni más de 4 espacios seguidos en los parámetros. */
const clean = (s: string, max = 180) => {
  const t = s.replace(/[\n\r\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t || '-';
};

class ContactDto {
  @Matches(/^[+\d\s()-]{7,20}$/) phone: string;
  @IsBoolean() consent: boolean;
  @IsArray() @ArrayMaxSize(5) @IsIn(Object.keys(WA_ALERTS), { each: true }) alerts: string[];
}
class TestDto { @IsString() @IsIn(Object.keys(WA_ALERTS)) alert: string; }

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  constructor(@InjectDb() private db: Db, private limits: PlanLimitsService) {}

  get configured() { return !!(config.whatsappToken && config.whatsappPhoneNumberId); }

  /** Envía una plantilla y registra el resultado. Nunca lanza: los avisos no deben romper la operación principal. */
  async sendTemplate(input: { businessId: string; userId?: string; to: string; alert: WaAlert; params: Record<string, string>; linkSuffix?: string }) {
    const tpl = WA_TEMPLATES[input.alert];
    const params = Object.fromEntries(tpl.params.map((p) => [p, clean(input.params[p] ?? '')]));
    const [row] = await this.db.insert(outboundMessages).values({
      businessId: input.businessId, userId: input.userId, toPhone: input.to, template: tpl.name, params,
      status: this.configured ? 'SENDING' : 'NOT_CONFIGURED',
      error: this.configured ? null : 'WhatsApp Business no está configurado en el servidor (faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID).',
    }).returning();
    if (!this.configured) return row;
    const components: any[] = [{ type: 'body', parameters: tpl.params.map((p) => ({ type: 'text', parameter_name: p, text: params[p] })) }];
    if (input.linkSuffix) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: input.linkSuffix }] });
    try {
      const res = await fetch(`${config.whatsappApiBase}/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.whatsappToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: input.to, type: 'template', template: { name: tpl.name, language: { code: config.whatsappLang }, components } }),
        signal: AbortSignal.timeout(15_000),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      const wamid = json?.messages?.[0]?.id ?? null;
      const [upd] = await this.db.update(outboundMessages).set({ status: 'SENT', providerId: wamid }).where(eq(outboundMessages.id, row.id)).returning();
      return upd;
    } catch (e) {
      this.logger.warn(`WhatsApp no enviado: ${(e as Error).message}`);
      const [upd] = await this.db.update(outboundMessages).set({ status: 'FAILED', error: (e as Error).message.slice(0, 500) }).where(eq(outboundMessages.id, row.id)).returning();
      return upd;
    }
  }

  /** Destinatarios: miembros activos del negocio con autorización vigente para ese tipo de aviso. */
  async recipients(businessId: string, alert: WaAlert) {
    const rows = await this.db.select({ userId: whatsappContacts.userId, phone: whatsappContacts.phone, alerts: whatsappContacts.alerts, name: users.fullName })
      .from(whatsappContacts)
      .innerJoin(users, eq(users.id, whatsappContacts.userId))
      .innerJoin(memberships, and(eq(memberships.userId, whatsappContacts.userId), eq(memberships.businessId, businessId), eq(memberships.status, 'ACTIVE')))
      .where(and(eq(whatsappContacts.businessId, businessId), isNull(whatsappContacts.revokedAt)));
    return rows.filter((r) => r.alerts.includes(alert));
  }

  // ───── Panel del usuario ─────
  async me(ctx: RequestContext, businessName: string) {
    const [contact] = await this.db.select().from(whatsappContacts).where(and(eq(whatsappContacts.userId, ctx.userId), eq(whatsappContacts.businessId, ctx.businessId)));
    const [u] = await this.db.select({ phone: users.phone }).from(users).where(eq(users.id, ctx.userId));
    const plan = await this.limits.whatsappAllowed(ctx.businessId);
    const recent = await this.db.select().from(outboundMessages)
      .where(and(eq(outboundMessages.businessId, ctx.businessId), eq(outboundMessages.userId, ctx.userId))).orderBy(desc(outboundMessages.createdAt)).limit(10);
    return {
      configured: this.configured, plan, alerts: WA_ALERTS, templates: WA_TEMPLATES,
      consentText: consentText(businessName), suggestedPhone: u?.phone ?? '',
      contact: contact && !contact.revokedAt ? { phone: contact.phone, alerts: contact.alerts, consentedAt: contact.consentedAt } : null,
      recent: recent.map((m) => ({ id: m.id, template: m.template, status: m.status, error: m.error, params: m.params, createdAt: m.createdAt })),
    };
  }

  async saveContact(ctx: RequestContext, dto: ContactDto, businessName: string, ip?: string) {
    if (!dto.consent) throw new BadRequestException('Para recibir avisos por WhatsApp debes autorizarlo.');
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('Escribe un celular válido, por ejemplo 300 123 4567.');
    const values = {
      phone, alerts: dto.alerts, consentText: consentText(businessName), consentVersion: CONSENT_VERSION, consentedAt: new Date(), consentIp: ip?.slice(0, 64) ?? null, revokedAt: null,
    };
    await this.db.insert(whatsappContacts).values({ userId: ctx.userId, businessId: ctx.businessId, ...values })
      .onConflictDoUpdate({ target: [whatsappContacts.userId, whatsappContacts.businessId], set: values });
    return this.me(ctx, businessName);
  }

  async revoke(ctx: RequestContext, businessName: string) {
    await this.db.update(whatsappContacts).set({ revokedAt: new Date() }).where(and(eq(whatsappContacts.userId, ctx.userId), eq(whatsappContacts.businessId, ctx.businessId)));
    return this.me(ctx, businessName);
  }

  async test(ctx: RequestContext, alert: WaAlert) {
    const plan = await this.limits.whatsappAllowed(ctx.businessId);
    if (!plan.allowed) throw new ForbiddenException(`Tu plan ${plan.plan || ''} no incluye avisos por WhatsApp o la suscripción no está activa.`.replace('  ', ' '));
    const [c] = await this.db.select().from(whatsappContacts).where(and(eq(whatsappContacts.userId, ctx.userId), eq(whatsappContacts.businessId, ctx.businessId), isNull(whatsappContacts.revokedAt)));
    if (!c) throw new BadRequestException('Primero registra tu celular y autoriza los avisos.');
    const [u] = await this.db.select({ name: users.fullName }).from(users).where(eq(users.id, ctx.userId));
    const sample: Record<WaAlert, Record<string, string>> = {
      PROCESS_UPDATE: { nombre: u.name.split(' ')[0], proceso: 'Prueba 76001-31-03-001-2026-00001-00', novedad: 'Mensaje de prueba de DREAMS' },
      TERM_DUE: { nombre: u.name.split(' ')[0], termino: 'de prueba', fecha: new Date().toLocaleDateString('es-CO') },
      PROCESS_REMINDER: { nombre: u.name.split(' ')[0], proceso: 'de prueba', entidad: 'la entidad' },
    };
    return this.sendTemplate({ businessId: ctx.businessId, userId: ctx.userId, to: c.phone, alert, params: sample[alert], linkSuffix: 'procesos' });
  }

  // ───── Webhook de Meta ─────
  verifySignature(raw: Buffer | undefined, header?: string) {
    if (!config.whatsappAppSecret) return false;
    if (!raw || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', config.whatsappAppSecret).update(raw).digest('hex');
    const got = header.slice(7);
    return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  }

  async handleWebhook(body: any) {
    for (const entry of body?.entry ?? []) for (const change of entry?.changes ?? []) {
      const v = change?.value ?? {};
      for (const s of v.statuses ?? []) {
        const map: Record<string, string> = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };
        const status = map[s.status];
        if (!status || !s.id) continue;
        await this.db.update(outboundMessages).set({ status, error: s.errors?.[0] ? `${s.errors[0].code}: ${s.errors[0].title ?? s.errors[0].message ?? ''}`.slice(0, 500) : null })
          .where(eq(outboundMessages.providerId, String(s.id)));
      }
      for (const m of v.messages ?? []) {
        const text = String(m?.text?.body ?? m?.button?.text ?? '').trim().toUpperCase();
        if (['STOP', 'BAJA', 'PARAR', 'CANCELAR', 'NO MAS', 'NO MÁS'].includes(text) && m.from) {
          await this.db.update(whatsappContacts).set({ revokedAt: new Date() }).where(and(eq(whatsappContacts.phone, String(m.from)), isNull(whatsappContacts.revokedAt)));
        }
      }
    }
  }
}

/**
 * Alertas: notificación dentro de DREAMS y, si el plan lo incluye y la persona lo autorizó, aviso por WhatsApp.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  constructor(private notifications: NotificationsService, private wa: WhatsappService, private limits: PlanLimitsService) {}

  async send(input: {
    businessId: string; type: NotificationType; title: string; body: string; data?: Record<string, unknown>;
    whatsapp?: { alert: WaAlert; params: Record<string, string>; linkSuffix?: string };
  }) {
    await this.notifications.notify(input.businessId, input.type, input.title, input.body, input.data ?? {});
    if (!input.whatsapp) return;
    try {
      const plan = await this.limits.whatsappAllowed(input.businessId);
      if (!plan.allowed) return;
      for (const r of await this.wa.recipients(input.businessId, input.whatsapp.alert)) {
        await this.wa.sendTemplate({
          businessId: input.businessId, userId: r.userId, to: r.phone, alert: input.whatsapp.alert,
          params: { nombre: r.name.split(' ')[0], ...input.whatsapp.params }, linkSuffix: input.whatsapp.linkSuffix,
        });
      }
    } catch (e) { this.logger.warn(`Aviso por WhatsApp no enviado: ${(e as Error).message}`); }
  }
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(private s: WhatsappService, @InjectDb() private db: Db) {}

  private async businessName(id: string) {
    const [r] = await this.db.select({ tradeName: businesses.tradeName }).from(businesses).where(eq(businesses.id, id));
    return r?.tradeName ?? 'mi negocio';
  }

  @RequirePermissions('sales:read') @Get('me') async me(@Ctx() ctx: RequestContext) { return this.s.me(ctx, await this.businessName(ctx.businessId)); }
  @RequirePermissions('sales:read') @Put('me') async save(@Ctx() ctx: RequestContext, @Body() dto: ContactDto, @Req() req: Request) {
    return this.s.saveContact(ctx, dto, await this.businessName(ctx.businessId), req.ip);
  }
  @RequirePermissions('sales:read') @Delete('me') async revoke(@Ctx() ctx: RequestContext) { return this.s.revoke(ctx, await this.businessName(ctx.businessId)); }
  @RequirePermissions('sales:read') @Post('me/test') @Throttle({ default: { limit: 5, ttl: 3600_000 } }) test(@Ctx() ctx: RequestContext, @Body() dto: TestDto) { return this.s.test(ctx, dto.alert as WaAlert); }

  /** Verificación del webhook (Meta envía hub.mode, hub.verify_token y hub.challenge). */
  @Public() @NoBusiness() @Get('webhook')
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: Response) {
    if (mode === 'subscribe' && config.whatsappVerifyToken && token === config.whatsappVerifyToken) return res.status(200).send(challenge);
    return res.status(403).send('forbidden');
  }

  @Public() @NoBusiness() @Post('webhook') @HttpCode(200) @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-hub-signature-256') sig: string, @Body() body: any) {
    if (!this.s.verifySignature(req.rawBody, sig)) return { ok: false };
    await this.s.handleWebhook(body);
    return { ok: true };
  }
}

@Global()
@Module({ controllers: [WhatsappController], providers: [WhatsappService, AlertsService], exports: [WhatsappService, AlertsService] })
export class WhatsappModule {}
