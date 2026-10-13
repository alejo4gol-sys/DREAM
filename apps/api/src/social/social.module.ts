import { Body, Controller, Get, Module, Put, Query } from '@nestjs/common';
import { IsObject, IsOptional, Matches } from 'class-validator';
import { and, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { normalizeSocialLinks } from '../common/social-links';
import { parsePeriod } from '../common/dates';
import { num } from '../common/money';
import { Db, InjectDb } from '../db/db';
import { businesses, customers, sales, socialAccounts } from '../db/schema';

/**
 * Catálogo de integraciones de redes sociales con sus requisitos REALES.
 * Ninguna aparece como "conectada" hasta que exista una app aprobada y credenciales en el servidor.
 */
export const SOCIAL_PLATFORMS = [
  {
    platform: 'INSTAGRAM', name: 'Instagram Business', api: 'Instagram Graph API (Meta)',
    auth: 'OAuth 2.0 mediante Facebook Login; token de la Página vinculada',
    requirements: ['Cuenta Instagram Business o Creator', 'Página de Facebook vinculada', 'App en Meta for Developers', 'App Review de Meta + verificación del negocio'],
    permissions: ['instagram_basic', 'instagram_manage_comments', 'instagram_manage_insights', 'instagram_manage_messages', 'instagram_content_publish'],
    can: ['Publicaciones y métricas', 'Comentarios (leer/responder)', 'Seguidores (conteo) e insights', 'Mensajes directos (permiso avanzado)', 'Programar publicaciones'],
    cannot: ['Lista detallada de seguidores', 'Datos de cuentas personales'],
    envVars: ['META_APP_ID', 'META_APP_SECRET'],
  },
  {
    platform: 'FACEBOOK', name: 'Facebook Pages', api: 'Graph API – Pages (Meta)',
    auth: 'OAuth 2.0; Page Access Token',
    requirements: ['Página de Facebook administrada por ti', 'App en Meta for Developers', 'App Review + verificación del negocio'],
    permissions: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_messaging'],
    can: ['Publicaciones, comentarios e insights', 'Mensajes de Messenger', 'Programar publicaciones'],
    cannot: ['Datos de perfiles personales'],
    envVars: ['META_APP_ID', 'META_APP_SECRET'],
  },
  {
    platform: 'WHATSAPP', name: 'WhatsApp Business', api: 'WhatsApp Business Platform – Cloud API (Meta)',
    auth: 'Token de usuario del sistema en Meta Business Manager',
    requirements: ['Cuenta de Meta Business verificada', 'Número de teléfono dedicado a la API', 'Plantillas aprobadas para iniciar conversaciones', 'Costo por conversación según Meta'],
    permissions: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    can: ['Recibir y enviar mensajes por webhooks', 'Mensajes con plantillas', 'Registrar clientes y ventas desde chats'],
    cannot: ['Leer chats de la app WhatsApp Business del celular', 'Importar historial anterior a la conexión'],
    envVars: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN'],
  },
  {
    platform: 'TIKTOK', name: 'TikTok Business', api: 'TikTok API for Business / Content Posting API',
    auth: 'OAuth 2.0',
    requirements: ['Cuenta TikTok Business', 'App registrada en TikTok for Developers', 'Auditoría para publicar contenido público'],
    permissions: ['user.info.basic', 'video.list', 'video.publish'],
    can: ['Listar videos y métricas básicas', 'Publicar videos (tras auditoría)'],
    cannot: ['Mensajes directos (sin API pública general)'],
    envVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  },
  {
    platform: 'YOUTUBE', name: 'YouTube', api: 'YouTube Data API v3 + YouTube Analytics API',
    auth: 'OAuth 2.0 (Google)',
    requirements: ['Proyecto en Google Cloud', 'Pantalla de consentimiento OAuth verificada', 'Cuota diaria de la API'],
    permissions: ['youtube.readonly', 'yt-analytics.readonly', 'youtube.upload'],
    can: ['Videos, comentarios y estadísticas', 'Subir videos'],
    cannot: ['Mensajes privados (no existen en YouTube)'],
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  {
    platform: 'X', name: 'X (Twitter)', api: 'X API v2',
    auth: 'OAuth 2.0 con PKCE',
    requirements: ['Cuenta de desarrollador en X', 'Plan de acceso de pago para la mayoría de lecturas y publicaciones'],
    permissions: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    can: ['Publicar y leer posts y menciones (según plan)', 'Métricas públicas'],
    cannot: ['Funciones fuera del nivel de plan contratado'],
    envVars: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
  },
] as const;

class LinksDto {
  @IsObject() links: Record<string, string>;
}

class PeriodQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

@Controller('social')
export class SocialController {
  constructor(@InjectDb() private db: Db) {}

  @Get('platforms') @RequirePermissions('social:read')
  platforms() {
    return SOCIAL_PLATFORMS.map((p) => ({
      ...p,
      configured: p.envVars.every((v) => !!process.env[v]),
      connectorImplemented: false, // se activa al implementar el conector OAuth de cada plataforma
    }));
  }

  /** Cuentas del negocio registradas manualmente (usuario o enlace). No requieren aprobación de ninguna plataforma. */
  @Get('links') @RequirePermissions('social:read')
  async links(@Ctx() ctx: RequestContext) {
    const b = await this.db.query.businesses.findFirst({ where: eq(businesses.id, ctx.businessId), columns: { socialLinks: true } });
    return b?.socialLinks ?? {};
  }

  /** Registra o actualiza las cuentas (se combinan con las existentes; un valor vacío la elimina). */
  @Put('links') @RequirePermissions('social:manage')
  async setLinks(@Ctx() ctx: RequestContext, @Body() dto: LinksDto) {
    const b = await this.db.query.businesses.findFirst({ where: eq(businesses.id, ctx.businessId), columns: { socialLinks: true } });
    const merged: Record<string, string> = { ...(b?.socialLinks ?? {}) };
    for (const [k, v] of Object.entries(dto.links)) {
      if (typeof v === 'string' && v.trim() === '') delete merged[k];
      else merged[k] = v;
    }
    const clean = normalizeSocialLinks(merged);
    await this.db.update(businesses).set({ socialLinks: clean }).where(eq(businesses.id, ctx.businessId));
    return clean;
  }

  @Get('accounts') @RequirePermissions('social:read')
  accounts(@Ctx() ctx: RequestContext) {
    return this.db.select({
      id: socialAccounts.id, platform: socialAccounts.platform, name: socialAccounts.name, status: socialAccounts.status,
      connectedAt: socialAccounts.connectedAt, tokenExpiresAt: socialAccounts.tokenExpiresAt,
    }).from(socialAccounts).where(eq(socialAccounts.businessId, ctx.businessId));
  }

  /** Ventas y clientes atribuidos a cada canal: dato real, disponible sin conectar ninguna API. */
  @Get('channel-stats') @RequirePermissions('social:read')
  async channelStats(@Ctx() ctx: RequestContext, @Query() q: PeriodQuery) {
    const p = parsePeriod(ctx.timezone, q.from, q.to, 'month');
    const salesBy = await this.db.select({
      channel: sales.channel, orders: sql<number>`count(*)::int`, total: sql<string>`sum(${sales.total})`,
      avgTicket: sql<string>`avg(${sales.total})`,
    }).from(sales).where(and(eq(sales.businessId, ctx.businessId), gte(sales.date, p.from), lt(sales.date, p.to), isNull(sales.cancelledAt)))
      .groupBy(sales.channel).orderBy(desc(sql`sum(${sales.total})`));
    const customersBy = await this.db.select({ channel: customers.channel, customers: count() })
      .from(customers).where(eq(customers.businessId, ctx.businessId)).groupBy(customers.channel);
    return {
      from: p.from, to: p.to,
      sales: salesBy.map((s) => ({ ...s, total: num(s.total), avgTicket: num(s.avgTicket) })),
      customers: customersBy,
    };
  }
}

@Module({ controllers: [SocialController] })
export class SocialModule {}
