import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser, NoBusiness, Public } from '../common/auth.guard';
import { config } from '../config';
import { AuthService, ClientInfo, IssuedTokens } from './auth.service';
import {
  ChangePasswordDto, DisableTwoFactorDto, ForgotPasswordDto, LoginDto, RegisterDto,
  ResetPasswordDto, TwoFactorCodeDto, TwoFactorLoginDto, UpdateProfileDto,
} from './auth.dto';

const COOKIE = 'dream_rt';
/**
 * La cookie es "Secure" cuando la app se usa por HTTPS (dominio propio o enlace público).
 * Por http (localhost o la red Wi-Fi local) no puede serlo, o el navegador la descartaría.
 */
const isHttps = (req: Request) =>
  String(req.headers.origin ?? '').startsWith('https://') ||
  String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
const cookieOpts = (req: Request, expires?: Date): CookieOptions => ({
  httpOnly: true, secure: config.isProd && isHttps(req), sameSite: 'strict', path: '/api/auth', expires,
});
const client = (req: Request): ClientInfo => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

/** Defensa CSRF adicional en rutas que usan la cookie: el Origin debe ser el del frontend. */
function assertOrigin(req: Request) {
  const origin = req.headers.origin;
  if (!origin) return;
  // Se acepta el origen configurado o el mismo host desde el que se sirve la app
  // (por ejemplo, un enlace público https://xxxx.trycloudflare.com o un dominio propio).
  const allowed = new Set(config.webOrigin.split(',').map((o) => o.trim()));
  if (allowed.has(origin)) return;
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { /* origen malformado */ }
  const fwd = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim();
  const host = fwd || String(req.headers.host ?? '');
  if (!originHost || originHost !== host) throw new ForbiddenException('Origen no permitido');
}

@Controller('auth')
@NoBusiness()
export class AuthController {
  constructor(private auth: AuthService) {}

  private withCookie(res: Response, t: IssuedTokens) {
    res.cookie(COOKIE, t.refreshCookie, cookieOpts(res.req, t.expiresAt));
    return { accessToken: t.accessToken };
  }

  @Public() @Post('register') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.register(dto, client(req));
    return { user: r.user, ...this.withCookie(res, r) };
  }

  @Public() @Post('login') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto.email, dto.password, client(req));
    if ('twoFactorRequired' in r) return r;
    return { user: r.user, ...this.withCookie(res, r) };
  }

  @Public() @Post('login/2fa') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login2fa(@Body() dto: TwoFactorLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.loginTwoFactor(dto.challengeToken, dto.code, client(req));
    return { user: r.user, ...this.withCookie(res, r) };
  }

  @Public() @Post('refresh') @HttpCode(200) @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertOrigin(req);
    try {
      return this.withCookie(res, await this.auth.refresh(req.cookies?.[COOKIE], client(req)));
    } catch (e) {
      res.clearCookie(COOKIE, cookieOpts(res.req));
      throw e;
    }
  }

  @Public() @Post('logout') @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertOrigin(req);
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, cookieOpts(res.req));
    return { ok: true };
  }

  @Post('logout-all') @HttpCode(200)
  async logoutAll(@CurrentUser() u: { userId: string }, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(u.userId);
    res.clearCookie(COOKIE, cookieOpts(res.req));
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() u: { userId: string }) {
    return this.auth.me(u.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() u: { userId: string }, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(u.userId, dto);
  }

  @Post('me/tutorials/:key') @HttpCode(200)
  seenTutorial(@CurrentUser() u: { userId: string }, @Param('key') key: string) {
    if (!/^[a-z0-9-]{2,40}$/.test(key)) throw new ForbiddenException('Tutorial inválido');
    return this.auth.markTutorial(u.userId, key);
  }

  @Delete('me/tutorials')
  resetTutorials(@CurrentUser() u: { userId: string }) {
    return this.auth.markTutorial(u.userId, null);
  }

  @Get('sessions')
  async sessions(@CurrentUser() u: { userId: string; sessionId: string }) {
    const list = await this.auth.listSessions(u.userId);
    return list.map((s) => ({ ...s, current: s.id === u.sessionId }));
  }

  @Delete('sessions/:id')
  async revoke(@CurrentUser() u: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    await this.auth.revokeSession(u.userId, id);
    return { ok: true };
  }

  @Public() @Post('password/forgot') @HttpCode(200) @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  @Public() @Post('password/reset') @HttpCode(200) @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }

  @Post('password/change') @HttpCode(200)
  async change(@CurrentUser() u: { userId: string; sessionId: string }, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(u.userId, u.sessionId, dto.currentPassword, dto.newPassword);
    return { message: 'Contraseña actualizada. Se cerraron las demás sesiones.' };
  }

  @Post('2fa/setup') @HttpCode(200)
  setup2fa(@CurrentUser() u: { userId: string }) {
    return this.auth.setupTwoFactor(u.userId);
  }

  @Post('2fa/enable') @HttpCode(200)
  async enable2fa(@CurrentUser() u: { userId: string }, @Body() dto: TwoFactorCodeDto) {
    await this.auth.enableTwoFactor(u.userId, dto.code);
    return { ok: true };
  }

  @Post('2fa/disable') @HttpCode(200)
  async disable2fa(@CurrentUser() u: { userId: string }, @Body() dto: DisableTwoFactorDto) {
    await this.auth.disableTwoFactor(u.userId, dto.password, dto.code);
    return { ok: true };
  }
}
