/**
 * Paquetes y membresías para negocios de servicios.
 * - Paquete: N sesiones que vencen a los X días (ej. «10 sesiones de masaje», «5 lavados»).
 * - Membresía: acceso por un periodo (ej. «mensualidad gimnasio»); cada visita se registra.
 * Cada paquete crea un servicio vendible en DREAMS: al venderlo a un cliente (venta, tienda o cobro) queda activo en su cuenta.
 */
import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { m2 } from '../common/money';
import { Db, InjectDb, Tx } from '../db/db';
import { customerPackages, customers, packageUsages, products, servicePackages } from '../db/schema';

class PackageDto {
  @IsString() @Length(2, 160) name: string;
  @IsIn(['PACKAGE', 'MEMBERSHIP']) kind: 'PACKAGE' | 'MEMBERSHIP';
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) sessions?: number | null;
  @Type(() => Number) @IsInt() @Min(1) @Max(1095) validityDays: number;
  @IsNumberString() price: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) serviceIds?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
class UseDto { @IsOptional() @IsString() @MaxLength(300) note?: string; }
class ListQuery {
  @IsOptional() @IsIn(['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED', 'ALL']) status?: string;
  @IsOptional() @IsUUID() customerId?: string;
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const addDays = (iso: string, d: number) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

/** Llamado dentro de la transacción de una venta: activa los paquetes vendidos al cliente. */
export async function activatePackagesForSale(tx: Tx, businessId: string, saleId: string, customerId: string | null | undefined, items: { productId: string; quantity: number }[]) {
  const ids = [...new Set(items.map((i) => i.productId))];
  if (!ids.length) return 0;
  const pkgs = await tx.select().from(servicePackages).where(and(eq(servicePackages.businessId, businessId), inArray(servicePackages.productId, ids)));
  if (!pkgs.length) return 0;
  if (!customerId) throw new BadRequestException('Para vender un paquete o membresía elige el cliente: así queda registrado a su nombre.');
  const start = today();
  let n = 0;
  for (const it of items) {
    const p = pkgs.find((x) => x.productId === it.productId);
    if (!p) continue;
    for (let i = 0; i < it.quantity; i++) {
      await tx.insert(customerPackages).values({
        businessId, packageId: p.id, customerId, saleId, name: p.name, kind: p.kind, sessionsTotal: p.sessions, startsAt: start, endsAt: addDays(start, p.validityDays), price: p.price,
      });
      n++;
    }
  }
  return n;
}

@Injectable()
export class PackagesService {
  constructor(@InjectDb() private db: Db) {}

  async list(businessId: string) {
    const rows = await this.db.select().from(servicePackages).where(eq(servicePackages.businessId, businessId)).orderBy(desc(servicePackages.active), asc(servicePackages.name));
    const sold = rows.length ? await this.db.select({ id: customerPackages.packageId, n: count(), active: sql<number>`count(*) filter (where ${customerPackages.status} = 'ACTIVE' and ${customerPackages.endsAt} >= ${today()})::int` })
      .from(customerPackages).where(eq(customerPackages.businessId, businessId)).groupBy(customerPackages.packageId) : [];
    const by = new Map(sold.map((s) => [s.id, s]));
    return rows.map((r) => ({ ...r, sold: by.get(r.id)?.n ?? 0, activeNow: by.get(r.id)?.active ?? 0 }));
  }

  private async syncProduct(tx: Tx, businessId: string, pkg: typeof servicePackages.$inferSelect) {
    const values = {
      name: pkg.name.slice(0, 200), description: pkg.description ?? (pkg.kind === 'PACKAGE' ? `Paquete de ${pkg.sessions} sesiones · vence a los ${pkg.validityDays} días` : `Membresía por ${pkg.validityDays} días`),
      salePrice: pkg.price, isActive: pkg.active, isService: true, pricingUnit: pkg.kind === 'MEMBERSHIP' ? 'MONTH' : 'SESSION',
    };
    if (pkg.productId) { await tx.update(products).set(values).where(and(eq(products.id, pkg.productId), eq(products.businessId, businessId))); return pkg.productId; }
    const sku = `PAQ-${Array.from({ length: 6 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[randomInt(34)]).join('')}`;
    const [p] = await tx.insert(products).values({ businessId, sku, costPrice: '0', minStock: 0, ...values }).returning({ id: products.id });
    await tx.update(servicePackages).set({ productId: p.id }).where(eq(servicePackages.id, pkg.id));
    return p.id;
  }

  async create(businessId: string, dto: PackageDto) {
    if (dto.kind === 'PACKAGE' && !dto.sessions) throw new BadRequestException('Indica cuántas sesiones trae el paquete.');
    return this.db.transaction(async (tx) => {
      const [pkg] = await tx.insert(servicePackages).values({
        businessId, name: dto.name.trim(), kind: dto.kind, description: dto.description?.trim() || null, sessions: dto.kind === 'PACKAGE' ? dto.sessions! : null,
        validityDays: dto.validityDays, price: m2(dto.price), serviceIds: dto.serviceIds ?? [], active: dto.active ?? true,
      }).returning();
      await this.syncProduct(tx, businessId, pkg);
      return pkg;
    });
  }

  async update(businessId: string, id: string, dto: PackageDto) {
    return this.db.transaction(async (tx) => {
      const [pkg] = await tx.update(servicePackages).set({
        name: dto.name.trim(), kind: dto.kind, description: dto.description?.trim() || null, sessions: dto.kind === 'PACKAGE' ? dto.sessions ?? null : null,
        validityDays: dto.validityDays, price: m2(dto.price), serviceIds: dto.serviceIds ?? [], active: dto.active ?? true,
      }).where(and(eq(servicePackages.id, id), eq(servicePackages.businessId, businessId))).returning();
      if (!pkg) throw new NotFoundException();
      await this.syncProduct(tx, businessId, pkg);
      return pkg;
    });
  }

  async remove(businessId: string, id: string) {
    const [pkg] = await this.db.select().from(servicePackages).where(and(eq(servicePackages.id, id), eq(servicePackages.businessId, businessId)));
    if (!pkg) throw new NotFoundException();
    await this.db.transaction(async (tx) => {
      await tx.update(servicePackages).set({ active: false }).where(eq(servicePackages.id, id));
      if (pkg.productId) await tx.update(products).set({ isActive: false }).where(eq(products.id, pkg.productId));
    });
    return { ok: true };
  }

  /** Marca vencidos los paquetes cuya fecha pasó (perezoso, al consultar). */
  private async expire(businessId: string) {
    await this.db.update(customerPackages).set({ status: 'EXPIRED' })
      .where(and(eq(customerPackages.businessId, businessId), eq(customerPackages.status, 'ACTIVE'), sql`${customerPackages.endsAt} < ${today()}`));
  }

  async customerList(businessId: string, q: ListQuery) {
    await this.expire(businessId);
    const conds = [eq(customerPackages.businessId, businessId)];
    if (q.customerId) conds.push(eq(customerPackages.customerId, q.customerId));
    if (q.status && q.status !== 'ALL') conds.push(eq(customerPackages.status, q.status));
    const rows = await this.db.select({ cp: customerPackages, customerName: customers.name, customerPhone: customers.phone })
      .from(customerPackages).innerJoin(customers, eq(customers.id, customerPackages.customerId)).where(and(...conds))
      .orderBy(asc(customerPackages.endsAt)).limit(500);
    return rows.map((r) => ({ ...r.cp, customerName: r.customerName, customerPhone: r.customerPhone, remaining: r.cp.sessionsTotal == null ? null : r.cp.sessionsTotal - r.cp.sessionsUsed }));
  }

  async detail(businessId: string, id: string) {
    const [cp] = await this.db.select().from(customerPackages).where(and(eq(customerPackages.id, id), eq(customerPackages.businessId, businessId)));
    if (!cp) throw new NotFoundException();
    const usages = await this.db.select().from(packageUsages).where(eq(packageUsages.customerPackageId, id)).orderBy(desc(packageUsages.usedAt));
    return { ...cp, usages };
  }

  async use(ctx: RequestContext, id: string, dto: UseDto) {
    await this.expire(ctx.businessId);
    return this.db.transaction(async (tx) => {
      const [cp] = await tx.select().from(customerPackages).where(and(eq(customerPackages.id, id), eq(customerPackages.businessId, ctx.businessId))).for('update');
      if (!cp) throw new NotFoundException();
      if (cp.status !== 'ACTIVE') throw new BadRequestException(cp.status === 'EXPIRED' ? `Este ${cp.kind === 'PACKAGE' ? 'paquete' : 'plan'} venció el ${cp.endsAt}.` : 'Ya no está activo.');
      if (cp.sessionsTotal != null && cp.sessionsUsed >= cp.sessionsTotal) throw new BadRequestException('Ya se usaron todas las sesiones.');
      const used = cp.sessionsUsed + 1;
      await tx.insert(packageUsages).values({ customerPackageId: id, businessId: ctx.businessId, note: dto.note?.trim() || null, createdById: ctx.userId });
      await tx.update(customerPackages).set({ sessionsUsed: used, status: cp.sessionsTotal != null && used >= cp.sessionsTotal ? 'USED' : 'ACTIVE' }).where(eq(customerPackages.id, id));
      return { sessionsUsed: used, remaining: cp.sessionsTotal == null ? null : cp.sessionsTotal - used };
    });
  }

  async cancel(businessId: string, id: string) {
    const [cp] = await this.db.update(customerPackages).set({ status: 'CANCELLED' }).where(and(eq(customerPackages.id, id), eq(customerPackages.businessId, businessId))).returning();
    if (!cp) throw new NotFoundException();
    return cp;
  }

  async summary(businessId: string) {
    await this.expire(businessId);
    const soon = new Date(); soon.setDate(soon.getDate() + 7);
    const [r] = await this.db.select({
      active: sql<number>`count(*) filter (where ${customerPackages.status} = 'ACTIVE')::int`,
      expiring: sql<number>`count(*) filter (where ${customerPackages.status} = 'ACTIVE' and ${customerPackages.endsAt} <= ${soon.toISOString().slice(0, 10)})::int`,
      lowSessions: sql<number>`count(*) filter (where ${customerPackages.status} = 'ACTIVE' and ${customerPackages.sessionsTotal} is not null and ${customerPackages.sessionsTotal} - ${customerPackages.sessionsUsed} <= 1)::int`,
    }).from(customerPackages).where(eq(customerPackages.businessId, businessId));
    return r;
  }
}

@Controller('packages')
export class PackagesController {
  constructor(private s: PackagesService) {}
  @RequirePermissions('products:read') @Get() list(@Ctx() ctx: RequestContext) { return this.s.list(ctx.businessId); }
  @RequirePermissions('sales:read') @Get('summary') summary(@Ctx() ctx: RequestContext) { return this.s.summary(ctx.businessId); }
  @RequirePermissions('sales:read') @Get('customers') customers(@Ctx() ctx: RequestContext, @Query() q: ListQuery) { return this.s.customerList(ctx.businessId, q); }
  @RequirePermissions('sales:read') @Get('customers/:id') detail(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.detail(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('customers/:id/use') use(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UseDto) { return this.s.use(ctx, id, dto); }
  @RequirePermissions('sales:create') @Post('customers/:id/cancel') cancel(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.cancel(ctx.businessId, id); }
  @RequirePermissions('products:write') @Post() create(@Ctx() ctx: RequestContext, @Body() dto: PackageDto) { return this.s.create(ctx.businessId, dto); }
  @RequirePermissions('products:write') @Put(':id') update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PackageDto) { return this.s.update(ctx.businessId, id, dto); }
  @RequirePermissions('products:write') @Delete(':id') remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.remove(ctx.businessId, id); }
}

@Module({ controllers: [PackagesController], providers: [PackagesService] })
export class PackagesModule {}
