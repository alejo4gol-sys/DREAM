import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { Db, InjectDb } from '../db/db';
import { businesses, memberships, passwordResetTokens, rolePermissions, roles, sessions, users } from '../db/schema';
import { CryptoService } from '../common/crypto.service';
import { config } from '../config';
import { MailService } from './mail.service';
import { normalizeSocialLinks } from '../common/social-links';
import type { RegisterDto } from './auth.dto';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP: argon2id m=19MiB t=2 p=1

authenticator.options = { window: 1 };

export interface ClientInfo { ip?: string; userAgent?: string }
export interface IssuedTokens { accessToken: string; refreshCookie: string; expiresAt: Date }

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private db: Db,
    private jwt: JwtService,
    private crypto: CryptoService,
    private mail: MailService,
  ) {}

  hashPassword(p: string) { return hash(p, ARGON); }

  async register(dto: RegisterDto, client: ClientInfo) {
    const exists = await this.db.query.users.findFirst({ where: eq(users.email, dto.email), columns: { id: true } });
    if (exists) throw new ConflictException('Ya existe una cuenta con este correo');
    const [user] = await this.db.insert(users).values({
      email: dto.email, fullName: dto.fullName.trim(), phone: dto.phone,
      passwordHash: await this.hashPassword(dto.password), acceptedPolicyAt: new Date(),
    }).returning();
    const tokens = await this.issueSession(user.id, client);
    return { user: this.publicUser(user), ...tokens };
  }

  async login(email: string, password: string, client: ClientInfo) {
    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    // Mensaje genérico: no revelar si el correo existe
    const invalid = new UnauthorizedException('Correo o contraseña incorrectos');
    if (!user) { await hash('timing-equalizer', ARGON); throw invalid; }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Cuenta bloqueada temporalmente por intentos fallidos. Intenta en unos minutos.');
    }
    if (!(await verify(user.passwordHash, password))) {
      const failed = user.failedLoginCount + 1;
      await this.db.update(users).set({
        failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      }).where(eq(users.id, user.id));
      throw invalid;
    }
    await this.db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));

    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwt.signAsync({ sub: user.id, typ: 'mfa' }, { expiresIn: 300 });
      return { twoFactorRequired: true as const, challengeToken };
    }
    return { user: this.publicUser(user), ...(await this.issueSession(user.id, client)) };
  }

  async loginTwoFactor(challengeToken: string, code: string, client: ClientInfo) {
    let sub: string;
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(challengeToken);
      if (p.typ !== 'mfa') throw new Error();
      sub = p.sub;
    } catch {
      throw new UnauthorizedException('El paso de verificación expiró. Inicia sesión de nuevo.');
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, sub) });
    if (!user?.twoFactorSecretEnc || !authenticator.verify({ token: code, secret: this.crypto.decrypt(user.twoFactorSecretEnc) })) {
      throw new UnauthorizedException('Código de verificación incorrecto');
    }
    return { user: this.publicUser(user), ...(await this.issueSession(user.id, client)) };
  }

  /** Crea una sesión con refresh token opaco (se guarda solo su hash). */
  private async issueSession(userId: string, client: ClientInfo): Promise<IssuedTokens> {
    const secret = this.crypto.randomToken();
    const expiresAt = new Date(Date.now() + config.refreshTokenTtlDays * 86_400_000);
    const [s] = await this.db.insert(sessions).values({
      userId, refreshTokenHash: this.crypto.sha256(secret), expiresAt,
      ip: client.ip, userAgent: client.userAgent?.slice(0, 300),
    }).returning({ id: sessions.id });
    return { accessToken: await this.signAccess(userId, s.id), refreshCookie: `${s.id}.${secret}`, expiresAt };
  }

  private signAccess(userId: string, sessionId: string) {
    return this.jwt.signAsync({ sub: userId, sid: sessionId, typ: 'access' }, { expiresIn: config.accessTokenTtlSec });
  }

  /** Rota el refresh token. Si se reutiliza uno viejo, se revoca la sesión (posible robo). */
  async refresh(cookie: string | undefined, client: ClientInfo): Promise<IssuedTokens & { userId: string }> {
    const [sessionId, secret] = (cookie ?? '').split('.');
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) throw new UnauthorizedException('Sesión no válida');
    const s = await this.db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
    if (!s || s.revokedAt || s.expiresAt < new Date()) throw new UnauthorizedException('Sesión expirada');
    if (s.refreshTokenHash !== this.crypto.sha256(secret)) {
      await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, s.id));
      throw new UnauthorizedException('Sesión revocada por seguridad');
    }
    const next = this.crypto.randomToken();
    await this.db.update(sessions).set({
      refreshTokenHash: this.crypto.sha256(next), lastUsedAt: new Date(),
      ip: client.ip ?? s.ip, userAgent: client.userAgent?.slice(0, 300) ?? s.userAgent,
    }).where(eq(sessions.id, s.id));
    return { userId: s.userId, accessToken: await this.signAccess(s.userId, s.id), refreshCookie: `${s.id}.${next}`, expiresAt: s.expiresAt };
  }

  async logout(cookie: string | undefined) {
    const [sessionId] = (cookie ?? '').split('.');
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
    }
  }

  async logoutAll(userId: string, exceptSessionId?: string) {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(and(
      eq(sessions.userId, userId), isNull(sessions.revokedAt),
      exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
    ));
  }

  listSessions(userId: string) {
    return this.db.select({
      id: sessions.id, ip: sessions.ip, userAgent: sessions.userAgent,
      createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt,
    }).from(sessions).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  }

  async me(userId: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new UnauthorizedException();
    const rows = await this.db.select({
      businessId: businesses.id, tradeName: businesses.tradeName, logoUrl: businesses.logoUrl, brandColors: businesses.brandColors,
      businessType: businesses.businessType, category: businesses.category, businessModel: businesses.businessModel, serviceProfile: businesses.serviceProfile,
      currency: businesses.currency, roleId: roles.id, roleKey: roles.key, roleName: roles.name,
    }).from(memberships)
      .innerJoin(businesses, eq(businesses.id, memberships.businessId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(and(eq(memberships.userId, userId), eq(memberships.status, 'ACTIVE')));
    const result = [];
    for (const r of rows) {
      const perms = await this.db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, r.roleId));
      const { roleId: _r, ...rest } = r;
      result.push({ ...rest, permissions: perms.map((x) => x.p) });
    }
    return { user: this.publicUser(user), businesses: result };
  }

  /** Marca un tutorial como visto (o los reinicia todos con key = null). */
  async markTutorial(userId: string, key: string | null) {
    const [u] = key
      ? await this.db.update(users).set({ tutorialsSeen: sql`(select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from jsonb_array_elements_text(${users.tutorialsSeen} || ${JSON.stringify([key])}::jsonb) v)` })
        .where(eq(users.id, userId)).returning({ seen: users.tutorialsSeen })
      : await this.db.update(users).set({ tutorialsSeen: [] }).where(eq(users.id, userId)).returning({ seen: users.tutorialsSeen });
    return { tutorialsSeen: u?.seen ?? [] };
  }

  async updateProfile(userId: string, data: { fullName?: string; phone?: string; socialLinks?: Record<string, string> }) {
    const set = { ...data, socialLinks: data.socialLinks === undefined ? undefined : normalizeSocialLinks(data.socialLinks) };
    const [u] = await this.db.update(users).set(set).where(eq(users.id, userId)).returning();
    return this.publicUser(u);
  }

  // ── Recuperación de contraseña ──
  async forgotPassword(email: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) return; // misma respuesta exista o no
    const token = this.crypto.randomToken();
    await this.db.insert(passwordResetTokens).values({
      userId: user.id, tokenHash: this.crypto.sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    await this.mail.send(user.email, 'Restablece tu contraseña de DREAMS',
      `Hola ${user.fullName},\n\nPara crear una nueva contraseña abre este enlace (válido 30 minutos):\n${config.webOrigin}/restablecer?token=${token}\n\nSi no lo solicitaste, ignora este mensaje.`);
  }

  async resetPassword(token: string, password: string) {
    const row = await this.db.query.passwordResetTokens.findFirst({ where: eq(passwordResetTokens.tokenHash, this.crypto.sha256(token)) });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('El enlace no es válido o expiró');
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: await this.hashPassword(password), failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, row.userId));
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, row.userId), isNull(sessions.revokedAt)));
    });
  }

  async changePassword(userId: string, sessionId: string, current: string, next: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || !(await verify(user.passwordHash, current))) throw new BadRequestException('La contraseña actual no es correcta');
    await this.db.update(users).set({ passwordHash: await this.hashPassword(next) }).where(eq(users.id, userId));
    await this.logoutAll(userId, sessionId);
  }

  // ── 2FA (TOTP) ──
  async setupTwoFactor(userId: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new UnauthorizedException();
    if (user.twoFactorEnabled) throw new BadRequestException('La verificación en dos pasos ya está activa');
    const secret = authenticator.generateSecret();
    await this.db.update(users).set({ twoFactorSecretEnc: this.crypto.encrypt(secret) }).where(eq(users.id, userId));
    const otpauthUrl = authenticator.keyuri(user.email, 'DREAMS', secret);
    return { otpauthUrl, secret, qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }) };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.twoFactorSecretEnc) throw new BadRequestException('Primero genera el código QR');
    if (!authenticator.verify({ token: code, secret: this.crypto.decrypt(user.twoFactorSecretEnc) })) {
      throw new BadRequestException('Código incorrecto');
    }
    await this.db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, userId));
  }

  async disableTwoFactor(userId: string, password: string, code: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || !(await verify(user.passwordHash, password))) throw new BadRequestException('Contraseña incorrecta');
    if (!user.twoFactorSecretEnc || !authenticator.verify({ token: code, secret: this.crypto.decrypt(user.twoFactorSecretEnc) })) {
      throw new BadRequestException('Código incorrecto');
    }
    await this.db.update(users).set({ twoFactorEnabled: false, twoFactorSecretEnc: null }).where(eq(users.id, userId));
  }

  private publicUser(u: typeof users.$inferSelect) {
    return { id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, socialLinks: u.socialLinks, twoFactorEnabled: u.twoFactorEnabled, tutorialsSeen: u.tutorialsSeen ?? [], createdAt: u.createdAt };
  }
}
