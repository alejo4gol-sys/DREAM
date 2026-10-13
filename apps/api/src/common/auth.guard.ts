import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
  createParamDecorator, BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import { Db, InjectDb } from '../db/db';
import { memberships, rolePermissions, roles, businesses } from '../db/schema';
import type { Permission } from './permissions';

export const IS_PUBLIC = 'isPublic';
export const PERMS = 'permissions';
export const NO_BUSINESS = 'noBusiness';

/** Ruta sin autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Ruta autenticada que no requiere negocio activo (ej. crear negocio, /auth/me). */
export const NoBusiness = () => SetMetadata(NO_BUSINESS, true);
/** Permisos requeridos dentro del negocio activo (todos deben cumplirse). */
export const RequirePermissions = (...p: Permission[]) => SetMetadata(PERMS, p);

export interface RequestContext {
  userId: string;
  sessionId: string;
  businessId: string;
  timezone: string;
  roleKey: string;
  permissions: Set<string>;
}

export type AuthedRequest = Request & { auth?: { userId: string; sessionId: string }; ctx?: RequestContext };

/** Contexto del negocio activo validado por el guard. */
export const Ctx = createParamDecorator((_: unknown, ec: ExecutionContext): RequestContext => {
  const req = ec.switchToHttp().getRequest<AuthedRequest>();
  if (!req.ctx) throw new BadRequestException('Se requiere un negocio activo (cabecera X-Business-Id)');
  return req.ctx;
});

/** Usuario autenticado (sin requerir negocio). */
export const CurrentUser = createParamDecorator((_: unknown, ec: ExecutionContext) => {
  return ec.switchToHttp().getRequest<AuthedRequest>().auth!;
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard global:
 * 1) valida el JWT de acceso (Authorization: Bearer)
 * 2) si la ruta es de negocio, valida membresía en X-Business-Id y carga permisos
 * 3) verifica @RequirePermissions
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private cache = new Map<string, { ctx: Omit<RequestContext, 'sessionId'>; exp: number }>();

  constructor(private reflector: Reflector, private jwt: JwtService, @InjectDb() private db: Db) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('No autenticado');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; typ: string }>(token);
      if (payload.typ !== 'access') throw new Error();
      req.auth = { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new UnauthorizedException('Sesión expirada');
    }

    if (this.reflector.getAllAndOverride<boolean>(NO_BUSINESS, targets)) return true;

    const businessId = String(req.headers['x-business-id'] ?? '');
    if (!UUID_RE.test(businessId)) throw new BadRequestException('Cabecera X-Business-Id inválida');

    const ctx = await this.loadContext(req.auth.userId, businessId);
    if (!ctx) throw new ForbiddenException('No perteneces a este negocio');
    req.ctx = { ...ctx, sessionId: req.auth.sessionId };

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMS, targets) ?? [];
    const missing = required.filter((p) => !ctx.permissions.has(p));
    if (missing.length) throw new ForbiddenException('Tu rol no tiene permiso para esta acción');
    return true;
  }

  /** Invalida la caché (tras cambiar roles o miembros). */
  invalidate(businessId?: string) {
    if (!businessId) return this.cache.clear();
    for (const k of this.cache.keys()) if (k.endsWith(`:${businessId}`)) this.cache.delete(k);
  }

  private async loadContext(userId: string, businessId: string) {
    const key = `${userId}:${businessId}`;
    const hit = this.cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.ctx;

    const [row] = await this.db
      .select({ roleId: memberships.roleId, roleKey: roles.key, status: memberships.status, tz: businesses.timezone })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .innerJoin(businesses, eq(businesses.id, memberships.businessId))
      .where(and(eq(memberships.userId, userId), eq(memberships.businessId, businessId)));
    if (!row || row.status !== 'ACTIVE') return null;

    const perms = await this.db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, row.roleId));
    const ctx = { userId, businessId, timezone: row.tz, roleKey: row.roleKey, permissions: new Set(perms.map((x) => x.p)) };
    this.cache.set(key, { ctx, exp: Date.now() + 30_000 });
    return ctx;
  }
}
