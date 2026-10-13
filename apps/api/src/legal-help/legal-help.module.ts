import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min,
} from 'class-validator';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { m2 } from '../common/money';
import { config } from '../config';
import { Db, InjectDb } from '../db/db';
import { businesses, customers, helpProposals, helpRequests, lawyerProfiles, users } from '../db/schema';
import { computeTerm, daysUntil } from '../legal-terms/term-engine';
import { NotificationsService } from '../notifications/notifications.service';
import { ServicesModule, ServicesService } from '../services/services.module';
import { CONSENT_TEXT, DEPARTMENTS, TOPICS, TOPIC_LABELS, orient, scrub } from './help-catalog';
import { entitiesFor, placeFor } from './offices';
import { PLACES } from './places';

const TOPIC_KEYS = TOPICS.map((t) => t.key);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PROPOSALS = 5;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

class OrientDto {
  @IsIn(TOPIC_KEYS) topic: string;
  @IsOptional() @IsObject() answers?: Record<string, string>;
  /** Lugar de los hechos o donde está la persona, para mostrar direcciones cercanas. */
  @IsOptional() @IsIn(DEPARTMENTS) placeDept?: string;
  @IsOptional() @IsString() @MaxLength(80) placeCity?: string;
}
class RequestDto extends OrientDto {
  @IsString() @Length(20, 3000) description: string;
  @IsIn(DEPARTMENTS) department: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsString() @Length(2, 160) name: string;
  @Matches(/^[+\d\s()-]{7,20}$/) phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsBoolean() consent: boolean;
}
class TokenDto { @IsString() @Length(20, 80) token: string; }
class ChooseDto extends TokenDto { @IsString() @Length(36, 36) proposalId: string; }
class ProfileDto {
  @IsString() @Length(3, 160) displayName: string;
  @Matches(/^[\dA-Za-z.\-\s]{3,30}$/) professionalCard: string;
  @IsArray() @ArrayMaxSize(20) @IsIn(TOPIC_KEYS, { each: true }) topics: string[];
  @IsArray() @ArrayMaxSize(40) @IsIn(DEPARTMENTS, { each: true }) departments: string[];
  @IsBoolean() remote: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(70) yearsExperience: number;
  @IsOptional() @IsString() @MaxLength(1500) bio?: string;
  @IsBoolean() accepting: boolean;
}
class ProposalDto {
  @Matches(/^\d{1,12}(\.\d{1,2})?$/) feeAmount: string;
  @IsString() @Length(5, 1000) feeTerms: string;
  @IsString() @Length(20, 3000) plan: string;
  @IsString() @Length(2, 120) estimatedTime: string;
  @IsOptional() @IsString() @MaxLength(1500) experience?: string;
}
class VerifyDto { @IsIn(['VERIFIED', 'REJECTED', 'PENDING']) verification: string; @IsOptional() @IsString() @MaxLength(500) note?: string; }

@Injectable()
export class LegalHelpService {
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService, private services: ServicesService) {}

  catalog() {
    return { topics: TOPICS, departments: DEPARTMENTS, places: PLACES, consentText: CONSENT_TEXT };
  }

  /** Orientación sin guardar nada: tema + respuestas → rutas con plazos calculados. */
  orient(dto: OrientDto) {
    const answers = this.cleanAnswers(dto.answers);
    const o = orient(dto.topic, answers);
    const dept = dto.placeDept ?? (dto as Partial<RequestDto>).department;
    const rawCity = dto.placeCity ?? (dto as Partial<RequestDto>).city;
    const city = dept && rawCity ? PLACES[dept]?.find((c) => c.toLowerCase() === rawCity.trim().toLowerCase()) : undefined;
    const place = dept ? { department: dept, city: city ?? null } : null;
    const withPlaces = o.routes.map((r) => ({ ...r, places: entitiesFor(r.where).map((e) => placeFor(e, dept, city)) }));
    const routes = withPlaces.map((r) => {
      if (!r.ruleKey || !r.dateKey || !answers[r.dateKey]) return { ...r, deadline: null };
      try {
        const t = computeTerm({ ruleKey: r.ruleKey, eventDate: answers[r.dateKey] });
        if (!t.dueDate) return { ...r, deadline: null };
        const days = daysUntil(t.dueDate);
        return { ...r, deadline: { dueDate: t.dueDate, daysLeft: days, label: r.dateLabel ?? '' } };
      } catch { return { ...r, deadline: null }; }
    });
    const urgent = routes.some((r) => r.urgent || (r.deadline && r.deadline.daysLeft >= 0 && r.deadline.daysLeft <= 30));
    return { ...o, routes, urgent, place };
  }

  private cleanAnswers(a?: Record<string, string>) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(a ?? {}).slice(0, 12)) {
      if (!/^[a-zA-Z]{1,20}$/.test(k) || typeof v !== 'string') continue;
      if (DATE.test(v)) { if (v <= new Date().toISOString().slice(0, 10) && v >= '1950-01-01') out[k] = v; }
      else if (/^[A-Z_]{1,20}$/.test(v)) out[k] = v;
    }
    return out;
  }

  async create(dto: RequestDto) {
    if (!dto.consent) throw new BadRequestException('Para recibir propuestas necesitamos tu autorización.');
    const o = this.orient(dto);
    const token = randomBytes(24).toString('base64url');
    const now = new Date();
    const deadline = new Date(now.getTime() + (o.urgent ? 24 : 48) * 3600_000);
    let code = newCode();
    for (let i = 0; i < 5; i++) { const [d] = await this.db.select({ id: helpRequests.id }).from(helpRequests).where(eq(helpRequests.code, code)); if (!d) break; code = newCode(); }
    const [row] = await this.db.insert(helpRequests).values({
      code, tokenHash: sha(token), topic: dto.topic, answers: this.cleanAnswers(dto.answers), description: dto.description.trim(), publicDescription: scrub(dto.description.trim()),
      department: dto.department, city: dto.city?.trim() || null, urgent: o.urgent, orientation: o, contactName: dto.name.trim(), contactPhone: dto.phone.trim(),
      contactEmail: dto.email?.trim() || null, consentText: CONSENT_TEXT, consentAt: now, status: 'OPEN', deadlineAt: deadline,
    }).returning({ id: helpRequests.id });
    // Avisar a los abogados que atienden ese tema y ese departamento
    for (const b of await this.matchedBusinesses(dto.topic, dto.department)) {
      await this.notifications.notify(b, 'LEGAL_REQUEST', `${o.urgent ? 'URGENTE · ' : ''}Nueva consulta: ${TOPIC_LABELS[dto.topic]} en ${dto.department}`,
        `Una persona busca abogado. Tienes hasta el ${deadline.toLocaleString('es-CO', { timeZone: 'America/Bogota' })} para enviar tu propuesta.`, { helpRequestId: row.id });
    }
    return { code, token, deadlineAt: deadline };
  }

  private async matchedBusinesses(topic: string, department: string) {
    const rows = await this.db.select({ businessId: lawyerProfiles.businessId, topics: lawyerProfiles.topics, departments: lawyerProfiles.departments, remote: lawyerProfiles.remote })
      .from(lawyerProfiles).innerJoin(businesses, eq(businesses.id, lawyerProfiles.businessId))
      .where(and(eq(lawyerProfiles.verification, 'VERIFIED'), eq(lawyerProfiles.accepting, true), eq(businesses.serviceProfile, 'LEGAL')));
    return rows.filter((r) => (r.topics.includes(topic) || topic === 'OTRO') && (r.remote || r.departments.includes(department))).map((r) => r.businessId);
  }

  private async byCode(code: string, token: string) {
    const [r] = await this.db.select().from(helpRequests).where(eq(helpRequests.code, code.toUpperCase()));
    if (!r || r.tokenHash !== sha(token)) throw new NotFoundException('No encontramos esa consulta. Revisa el enlace.');
    return r;
  }

  /** Vista de la persona: su consulta y las propuestas recibidas. */
  async track(code: string, token: string) {
    const r = await this.byCode(code, token);
    const props = await this.db.select({
      p: helpProposals, tradeName: businesses.tradeName, logoUrl: businesses.logoUrl, phone: businesses.phone, email: businesses.email, city: businesses.city,
      displayName: lawyerProfiles.displayName, years: lawyerProfiles.yearsExperience, bio: lawyerProfiles.bio, verification: lawyerProfiles.verification,
    }).from(helpProposals).innerJoin(businesses, eq(businesses.id, helpProposals.businessId)).leftJoin(lawyerProfiles, eq(lawyerProfiles.businessId, helpProposals.businessId))
      .where(and(eq(helpProposals.requestId, r.id), inArray(helpProposals.status, ['SENT', 'CHOSEN', 'NOT_CHOSEN']))).orderBy(helpProposals.createdAt);
    return {
      code: r.code, topic: r.topic, topicLabel: TOPIC_LABELS[r.topic], status: r.status, urgent: r.urgent, deadlineAt: r.deadlineAt, createdAt: r.createdAt,
      department: r.department, city: r.city, orientation: r.orientation, name: r.contactName.split(' ')[0],
      proposals: props.map((x) => ({
        id: x.p.id, status: x.p.status, feeAmount: x.p.feeAmount, feeTerms: x.p.feeTerms, plan: x.p.plan, estimatedTime: x.p.estimatedTime, experience: x.p.experience, createdAt: x.p.createdAt,
        lawyer: { name: x.displayName ?? x.tradeName, firm: x.tradeName, logoUrl: x.logoUrl, years: x.years, bio: x.bio, verified: x.verification === 'VERIFIED', city: x.city,
          ...(x.p.status === 'CHOSEN' ? { phone: x.phone, email: x.email } : {}) },
      })),
    };
  }

  async choose(code: string, dto: ChooseDto) {
    const r = await this.byCode(code, dto.token);
    if (r.status !== 'OPEN') throw new BadRequestException('Ya elegiste un abogado o cerraste esta consulta.');
    const [p] = await this.db.select().from(helpProposals).where(and(eq(helpProposals.id, dto.proposalId), eq(helpProposals.requestId, r.id), eq(helpProposals.status, 'SENT')));
    if (!p) throw new NotFoundException('Propuesta no encontrada');
    const others = await this.db.select({ id: helpProposals.id, businessId: helpProposals.businessId }).from(helpProposals)
      .where(and(eq(helpProposals.requestId, r.id), eq(helpProposals.status, 'SENT')));
    await this.db.transaction(async (tx) => {
      await tx.update(helpProposals).set({ status: 'CHOSEN' }).where(eq(helpProposals.id, p.id));
      await tx.update(helpProposals).set({ status: 'NOT_CHOSEN' }).where(and(eq(helpProposals.requestId, r.id), eq(helpProposals.status, 'SENT')));
      await tx.update(helpRequests).set({ status: 'CHOSEN', chosenProposalId: p.id }).where(eq(helpRequests.id, r.id));
    });
    await this.notifications.notify(p.businessId, 'LEGAL_REQUEST', `¡Te eligieron! ${TOPIC_LABELS[r.topic]} · ${r.contactName}`.slice(0, 160),
      `${r.contactName} aceptó tu propuesta. Ya puedes ver sus datos de contacto y crear el caso.`, { helpRequestId: r.id });
    for (const o of others) if (o.id !== p.id) await this.notifications.notify(o.businessId, 'LEGAL_REQUEST', `Consulta ${r.code}: la persona eligió otro abogado`, 'Gracias por enviar tu propuesta.', { helpRequestId: r.id });
    return this.track(code, dto.token);
  }

  async close(code: string, dto: TokenDto) {
    const r = await this.byCode(code, dto.token);
    await this.db.update(helpRequests).set({ status: 'CLOSED' }).where(eq(helpRequests.id, r.id));
    await this.db.update(helpProposals).set({ status: 'NOT_CHOSEN' }).where(and(eq(helpProposals.requestId, r.id), eq(helpProposals.status, 'SENT')));
    return { ok: true };
  }

  // ───── Abogados ─────
  async profile(businessId: string) {
    const [p] = await this.db.select().from(lawyerProfiles).where(eq(lawyerProfiles.businessId, businessId));
    return p ?? null;
  }

  async saveProfile(ctx: RequestContext, dto: ProfileDto) {
    const cur = await this.profile(ctx.businessId);
    const values = { displayName: dto.displayName.trim(), professionalCard: dto.professionalCard.trim(), topics: dto.topics, departments: dto.departments, remote: dto.remote,
      yearsExperience: dto.yearsExperience, bio: dto.bio?.trim() || null, accepting: dto.accepting };
    if (cur) {
      const cardChanged = cur.professionalCard !== values.professionalCard;
      await this.db.update(lawyerProfiles).set({ ...values, ...(cardChanged ? { verification: 'PENDING', verificationNote: null } : {}) }).where(eq(lawyerProfiles.id, cur.id));
    } else await this.db.insert(lawyerProfiles).values({ ...values, businessId: ctx.businessId, userId: ctx.userId, verification: 'PENDING' });
    return this.profile(ctx.businessId);
  }

  async inbox(businessId: string) {
    const prof = await this.profile(businessId);
    const mine = await this.db.select({ p: helpProposals, r: helpRequests }).from(helpProposals).innerJoin(helpRequests, eq(helpRequests.id, helpProposals.requestId))
      .where(eq(helpProposals.businessId, businessId)).orderBy(desc(helpProposals.createdAt)).limit(100);
    let open: (typeof helpRequests.$inferSelect & { proposals: number })[] = [];
    if (prof && prof.verification === 'VERIFIED' && prof.accepting) {
      const rows = await this.db.select({ r: helpRequests, n: sql<number>`(select count(*)::int from help_proposals hp where hp.request_id = ${helpRequests.id} and hp.status <> 'WITHDRAWN')` })
        .from(helpRequests).where(and(eq(helpRequests.status, 'OPEN'), gt(helpRequests.deadlineAt, new Date()))).orderBy(desc(helpRequests.urgent), helpRequests.deadlineAt).limit(200);
      const done = new Set(mine.map((m) => m.r.id));
      open = rows.filter((x) => !done.has(x.r.id) && x.n < MAX_PROPOSALS && (prof.topics.includes(x.r.topic) || x.r.topic === 'OTRO') && (prof.remote || prof.departments.includes(x.r.department)))
        .map((x) => ({ ...x.r, proposals: x.n }));
    }
    const pub = (r: typeof helpRequests.$inferSelect, chosen: boolean) => ({
      id: r.id, code: r.code, topic: r.topic, topicLabel: TOPIC_LABELS[r.topic], answers: r.answers, description: chosen ? r.description : r.publicDescription,
      department: r.department, city: r.city, urgent: r.urgent, deadlineAt: r.deadlineAt, createdAt: r.createdAt, status: r.status, orientation: r.orientation,
      ...(chosen ? { contact: { name: r.contactName, phone: r.contactPhone, email: r.contactEmail } } : {}),
    });
    return {
      profile: prof,
      open: open.map((r) => ({ ...pub(r, false), proposals: r.proposals })),
      mine: mine.map((m) => ({ ...pub(m.r, m.p.status === 'CHOSEN'), proposal: m.p })),
    };
  }

  async propose(ctx: RequestContext, requestId: string, dto: ProposalDto) {
    const prof = await this.profile(ctx.businessId);
    if (!prof || prof.verification !== 'VERIFIED') throw new ForbiddenException('Tu perfil de abogado debe estar verificado para enviar propuestas.');
    const [r] = await this.db.select().from(helpRequests).where(eq(helpRequests.id, requestId));
    if (!r || r.status !== 'OPEN') throw new NotFoundException('Esta consulta ya no recibe propuestas.');
    if (r.deadlineAt < new Date()) throw new BadRequestException('Se cumplió el plazo para enviar propuestas.');
    if (!(prof.topics.includes(r.topic) || r.topic === 'OTRO') || !(prof.remote || prof.departments.includes(r.department))) throw new ForbiddenException('Esta consulta no corresponde a tus áreas o zonas.');
    if (/\b(garantiz|seguro gan|100 ?%)/i.test(`${dto.plan} ${dto.feeTerms}`)) throw new BadRequestException('La propuesta no puede prometer o garantizar resultados.');
    await this.db.transaction(async (tx) => {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(helpProposals).where(eq(helpProposals.requestId, r.id));
      if (n >= MAX_PROPOSALS) throw new ConflictException('Esta consulta ya recibió el máximo de propuestas.');
      await tx.insert(helpProposals).values({ requestId: r.id, businessId: ctx.businessId, userId: ctx.userId, feeAmount: m2(dto.feeAmount), feeTerms: dto.feeTerms.trim(),
        plan: dto.plan.trim(), estimatedTime: dto.estimatedTime.trim(), experience: dto.experience?.trim() || null });
    }).catch((e) => { if (String(e?.message ?? '').includes('help_proposals_request_business')) throw new ConflictException('Ya enviaste una propuesta para esta consulta.'); throw e; });
    return this.inbox(ctx.businessId);
  }

  async withdraw(ctx: RequestContext, requestId: string) {
    await this.db.update(helpProposals).set({ status: 'WITHDRAWN' })
      .where(and(eq(helpProposals.requestId, requestId), eq(helpProposals.businessId, ctx.businessId), eq(helpProposals.status, 'SENT')));
    return this.inbox(ctx.businessId);
  }

  /** Cuando la persona eligió al abogado: crea el cliente y el caso en DREAMS. */
  async toCase(ctx: RequestContext, requestId: string) {
    const [x] = await this.db.select({ p: helpProposals, r: helpRequests }).from(helpProposals).innerJoin(helpRequests, eq(helpRequests.id, helpProposals.requestId))
      .where(and(eq(helpProposals.requestId, requestId), eq(helpProposals.businessId, ctx.businessId), eq(helpProposals.status, 'CHOSEN')));
    if (!x) throw new ForbiddenException('Solo puedes crear el caso cuando la persona te elige.');
    if (x.p.jobId) return { jobId: x.p.jobId };
    const [c] = await this.db.insert(customers).values({ businessId: ctx.businessId, name: x.r.contactName, phone: x.r.contactPhone, email: x.r.contactEmail, city: x.r.city ?? x.r.department, notes: `Llegó por la micro app Tu Derecho (consulta ${x.r.code}).` }).returning({ id: customers.id });
    const job = await this.services.create(ctx, {
      title: `${TOPIC_LABELS[x.r.topic]} — ${x.r.contactName}`.slice(0, 200), customerId: c.id, status: 'QUOTE', category: TOPIC_LABELS[x.r.topic],
      description: `${x.r.description}\n\nPropuesta aceptada: ${Number(x.p.feeAmount).toLocaleString('es-CO')} COP — ${x.p.feeTerms}\nPlan: ${x.p.plan}`.slice(0, 8000),
      items: [{ kind: 'FEE', description: 'Honorarios según propuesta aceptada en Tu Derecho', quantity: '1', unitPrice: String(Number(x.p.feeAmount).toFixed(2)) }],
    } as any);
    await this.db.update(helpProposals).set({ jobId: job.id }).where(eq(helpProposals.id, x.p.id));
    return { jobId: job.id };
  }

  // ───── Administración de la plataforma ─────
  async assertAdmin(userId: string) {
    const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (!u || !config.platformAdmins.includes(u.email.toLowerCase())) throw new ForbiddenException('Solo los administradores de la plataforma pueden hacer esto.');
  }
  async adminList(ctx: RequestContext) {
    await this.assertAdmin(ctx.userId);
    return this.db.select({ p: lawyerProfiles, tradeName: businesses.tradeName, email: businesses.email, phone: businesses.phone })
      .from(lawyerProfiles).innerJoin(businesses, eq(businesses.id, lawyerProfiles.businessId)).orderBy(desc(lawyerProfiles.createdAt));
  }
  async adminVerify(ctx: RequestContext, id: string, dto: VerifyDto) {
    await this.assertAdmin(ctx.userId);
    await this.db.update(lawyerProfiles).set({ verification: dto.verification, verificationNote: dto.note?.trim() || null }).where(eq(lawyerProfiles.id, id));
    return this.adminList(ctx);
  }
  async isAdmin(userId: string) { try { await this.assertAdmin(userId); return true; } catch { return false; } }
}

@Controller('help')
export class LegalHelpController {
  constructor(private s: LegalHelpService) {}
  // Públicos (micro app)
  @Public() @Get('catalog') catalog() { return this.s.catalog(); }
  @Public() @Post('orient') @HttpCode(200) @Throttle({ default: { limit: 40, ttl: 60_000 } }) orient(@Body() dto: OrientDto) { return this.s.orient(dto); }
  @Public() @Post('requests') @Throttle({ default: { limit: 5, ttl: 3_600_000 } }) create(@Body() dto: RequestDto) { return this.s.create(dto); }
  @Public() @Get('requests/:code') @Throttle({ default: { limit: 30, ttl: 60_000 } }) track(@Param('code') code: string, @Query('token') token: string) {
    if (!/^[A-Z0-9]{8}$/i.test(code) || !token) throw new NotFoundException('Enlace no válido');
    return this.s.track(code, token);
  }
  @Public() @Post('requests/:code/choose') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } }) choose(@Param('code') code: string, @Body() dto: ChooseDto) { return this.s.choose(code, dto); }
  @Public() @Post('requests/:code/close') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } }) close(@Param('code') code: string, @Body() dto: TokenDto) { return this.s.close(code, dto); }
  // Abogados
  @RequirePermissions('sales:read') @Get('inbox') inbox(@Ctx() ctx: RequestContext) { return this.s.inbox(ctx.businessId); }
  @RequirePermissions('business:manage') @Put('profile') saveProfile(@Ctx() ctx: RequestContext, @Body() dto: ProfileDto) { return this.s.saveProfile(ctx, dto); }
  @RequirePermissions('sales:create') @Post('inbox/:id/proposals') propose(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProposalDto) { return this.s.propose(ctx, id, dto); }
  @RequirePermissions('sales:create') @Post('inbox/:id/withdraw') @HttpCode(200) withdraw(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.withdraw(ctx, id); }
  @RequirePermissions('sales:create') @Post('inbox/:id/case') toCase(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.toCase(ctx, id); }
  // Administración
  @RequirePermissions('sales:read') @Get('admin/me') async adminMe(@Ctx() ctx: RequestContext) { return { admin: await this.s.isAdmin(ctx.userId) }; }
  @RequirePermissions('sales:read') @Get('admin/lawyers') adminList(@Ctx() ctx: RequestContext) { return this.s.adminList(ctx); }
  @RequirePermissions('sales:read') @Put('admin/lawyers/:id') adminVerify(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDto) { return this.s.adminVerify(ctx, id, dto); }
}

@Module({ imports: [ServicesModule], controllers: [LegalHelpController], providers: [LegalHelpService] })
export class LegalHelpModule {}
