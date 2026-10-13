/**
 * Proveedores y mayoristas:
 * - Listas de precios (ej. «Mayorista», «Distribuidor») con precio por producto, cantidad mínima y pedido mínimo,
 *   o un descuento general sobre el precio de venta.
 * - Cada cliente puede tener su lista, cupo de crédito y plazo de pago.
 * - Cartera por cliente: saldo pendiente, vencido según el plazo y cupo disponible.
 * Al registrar una venta a un cliente con lista, DREAMS sugiere (y usa por defecto) el precio de su lista.
 */
import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { and, asc, count, eq, inArray, ne, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { D, m2 } from '../common/money';
import { Db, InjectDb } from '../db/db';
import { customers, priceListItems, priceLists, products, sales } from '../db/schema';

class PriceListDto {
  @IsString() @Length(2, 120) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsNumberString() discountPercent?: string;
  @IsOptional() @IsNumberString() minOrderTotal?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class ItemDto {
  @IsUUID() productId: string;
  @ValidateIf((_, v) => v !== null) @IsNumberString() price: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) minQty?: number;
}
class ItemsDto { @IsArray() @ArrayMaxSize(5000) @ValidateNested({ each: true }) @Type(() => ItemDto) items: ItemDto[]; }
class CustomerTermsDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() priceListId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumberString() creditLimit?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(0) @Max(365) paymentTermsDays?: number | null;
}
class ResolveQuery { @IsUUID() customerId: string; }

/** Precio de lista de un producto para un cliente (null si no tiene lista). Usado también por ventas. */
export async function listPricesFor(db: Db, businessId: string, customerId: string, productIds: string[]) {
  const [c] = await db.select({ list: customers.priceListId }).from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, businessId)));
  if (!c?.list) return null;
  const [pl] = await db.select().from(priceLists).where(and(eq(priceLists.id, c.list), eq(priceLists.active, true)));
  if (!pl) return null;
  const prods = productIds.length ? await db.select({ id: products.id, sale: products.salePrice }).from(products).where(and(eq(products.businessId, businessId), inArray(products.id, productIds))) : [];
  const items = productIds.length ? await db.select().from(priceListItems).where(and(eq(priceListItems.priceListId, pl.id), inArray(priceListItems.productId, productIds))) : [];
  const byItem = new Map(items.map((i) => [i.productId, i]));
  const disc = D(pl.discountPercent);
  const prices: Record<string, { price: string; minQty: number }> = {};
  for (const p of prods) {
    const it = byItem.get(p.id);
    prices[p.id] = it ? { price: it.price, minQty: it.minQty } : { price: m2(D(p.sale).mul(D(100).minus(disc)).div(100)), minQty: 1 };
  }
  return { list: { id: pl.id, name: pl.name, minOrderTotal: pl.minOrderTotal, discountPercent: pl.discountPercent }, prices };
}

@Injectable()
export class WholesaleService {
  constructor(@InjectDb() private db: Db) {}

  async lists(businessId: string) {
    const rows = await this.db.select().from(priceLists).where(eq(priceLists.businessId, businessId)).orderBy(asc(priceLists.name));
    const counts = rows.length ? await this.db.select({ id: priceListItems.priceListId, n: count() }).from(priceListItems).where(inArray(priceListItems.priceListId, rows.map((r) => r.id))).groupBy(priceListItems.priceListId) : [];
    const custs = rows.length ? await this.db.select({ id: customers.priceListId, n: count() }).from(customers).where(and(eq(customers.businessId, businessId), inArray(customers.priceListId, rows.map((r) => r.id)))).groupBy(customers.priceListId) : [];
    return rows.map((r) => ({ ...r, items: counts.find((c) => c.id === r.id)?.n ?? 0, customers: custs.find((c) => c.id === r.id)?.n ?? 0 }));
  }
  async createList(businessId: string, dto: PriceListDto) {
    const [r] = await this.db.insert(priceLists).values({ businessId, name: dto.name.trim(), description: dto.description?.trim() || null, discountPercent: dto.discountPercent ?? '0', minOrderTotal: dto.minOrderTotal ?? '0', active: dto.active ?? true }).returning();
    return r;
  }
  async updateList(businessId: string, id: string, dto: PriceListDto) {
    const d = D(dto.discountPercent ?? '0');
    if (d.lt(0) || d.gt(90)) throw new BadRequestException('El descuento debe estar entre 0 % y 90 %.');
    const [r] = await this.db.update(priceLists).set({ name: dto.name.trim(), description: dto.description?.trim() || null, discountPercent: dto.discountPercent ?? '0', minOrderTotal: dto.minOrderTotal ?? '0', active: dto.active ?? true })
      .where(and(eq(priceLists.id, id), eq(priceLists.businessId, businessId))).returning();
    if (!r) throw new NotFoundException();
    return r;
  }
  async removeList(businessId: string, id: string) {
    await this.db.delete(priceLists).where(and(eq(priceLists.id, id), eq(priceLists.businessId, businessId)));
    return { ok: true };
  }

  /** Todos los productos con su precio normal y el de la lista. */
  async items(businessId: string, id: string) {
    const [pl] = await this.db.select().from(priceLists).where(and(eq(priceLists.id, id), eq(priceLists.businessId, businessId)));
    if (!pl) throw new NotFoundException();
    const prods = await this.db.select({ id: products.id, sku: products.sku, name: products.name, salePrice: products.salePrice, costPrice: products.costPrice, isService: products.isService })
      .from(products).where(and(eq(products.businessId, businessId), eq(products.isActive, true))).orderBy(asc(products.name));
    const items = await this.db.select().from(priceListItems).where(eq(priceListItems.priceListId, id));
    const by = new Map(items.map((i) => [i.productId, i]));
    const disc = D(pl.discountPercent);
    return { list: pl, products: prods.map((p) => {
      const it = by.get(p.id);
      return { ...p, listPrice: it?.price ?? null, minQty: it?.minQty ?? 1, effectivePrice: it?.price ?? m2(D(p.salePrice).mul(D(100).minus(disc)).div(100)), custom: !!it };
    }) };
  }

  async setItems(businessId: string, id: string, dto: ItemsDto) {
    const [pl] = await this.db.select({ id: priceLists.id }).from(priceLists).where(and(eq(priceLists.id, id), eq(priceLists.businessId, businessId)));
    if (!pl) throw new NotFoundException();
    const ids = dto.items.map((i) => i.productId);
    const own = ids.length ? await this.db.select({ id: products.id }).from(products).where(and(eq(products.businessId, businessId), inArray(products.id, ids))) : [];
    if (own.length !== new Set(ids).size) throw new BadRequestException('Hay productos que no son de este negocio.');
    await this.db.transaction(async (tx) => {
      for (const it of dto.items) {
        if (it.price === null) { await tx.delete(priceListItems).where(and(eq(priceListItems.priceListId, id), eq(priceListItems.productId, it.productId))); continue; }
        if (D(it.price).lt(0)) throw new BadRequestException('Los precios no pueden ser negativos.');
        await tx.insert(priceListItems).values({ priceListId: id, productId: it.productId, price: m2(it.price), minQty: it.minQty ?? 1 })
          .onConflictDoUpdate({ target: [priceListItems.priceListId, priceListItems.productId], set: { price: m2(it.price), minQty: it.minQty ?? 1 } });
      }
    });
    return this.items(businessId, id);
  }

  async resolve(businessId: string, customerId: string) {
    const prods = await this.db.select({ id: products.id }).from(products).where(and(eq(products.businessId, businessId), eq(products.isActive, true)));
    return (await listPricesFor(this.db, businessId, customerId, prods.map((p) => p.id))) ?? { list: null, prices: {} };
  }

  async setCustomerTerms(businessId: string, customerId: string, dto: CustomerTermsDto) {
    if (dto.priceListId) {
      const [pl] = await this.db.select({ id: priceLists.id }).from(priceLists).where(and(eq(priceLists.id, dto.priceListId), eq(priceLists.businessId, businessId)));
      if (!pl) throw new BadRequestException('Lista de precios inválida');
    }
    const [c] = await this.db.update(customers).set({
      ...(dto.priceListId !== undefined ? { priceListId: dto.priceListId } : {}),
      ...(dto.creditLimit !== undefined ? { creditLimit: dto.creditLimit === null ? null : m2(dto.creditLimit) } : {}),
      ...(dto.paymentTermsDays !== undefined ? { paymentTermsDays: dto.paymentTermsDays } : {}),
    }).where(and(eq(customers.id, customerId), eq(customers.businessId, businessId))).returning();
    if (!c) throw new NotFoundException();
    return c;
  }

  /** Cartera por cliente: saldo, vencido según el plazo y cupo disponible. */
  async receivables(businessId: string, onlyWholesale: boolean) {
    const rows = await this.db.select({
      id: customers.id, name: customers.name, phone: customers.phone, priceListId: customers.priceListId, listName: priceLists.name,
      creditLimit: customers.creditLimit, terms: customers.paymentTermsDays,
      balance: sql<string>`coalesce(sum(${sales.total} - ${sales.amountPaid}) filter (where ${sales.status} <> 'CANCELLED'), 0)::numeric(14,2)`,
      overdue: sql<string>`coalesce(sum(${sales.total} - ${sales.amountPaid}) filter (where ${sales.status} <> 'CANCELLED' and ${sales.date} < now() - make_interval(days => coalesce(${customers.paymentTermsDays}, 30))), 0)::numeric(14,2)`,
      oldest: sql<string | null>`min(${sales.date}) filter (where ${sales.status} in ('PENDING','PARTIALLY_PAID'))`,
    }).from(customers)
      .leftJoin(priceLists, eq(priceLists.id, customers.priceListId))
      .leftJoin(sales, and(eq(sales.customerId, customers.id), ne(sales.status, 'CANCELLED')))
      .where(and(eq(customers.businessId, businessId), onlyWholesale ? sql`(${customers.priceListId} is not null or ${customers.creditLimit} is not null)` : sql`true`))
      .groupBy(customers.id, priceLists.name).orderBy(sql`2`).limit(1000);
    const out = rows.map((r) => ({ ...r, available: r.creditLimit != null ? m2(D(r.creditLimit).minus(r.balance)) : null }))
      .filter((r) => onlyWholesale || D(r.balance).gt(0));
    return {
      customers: out,
      totals: { balance: m2(out.reduce((a, r) => a.plus(r.balance), D(0))), overdue: m2(out.reduce((a, r) => a.plus(r.overdue), D(0))) },
    };
  }
}

@Controller('wholesale')
export class WholesaleController {
  constructor(private s: WholesaleService) {}
  @RequirePermissions('products:read') @Get('price-lists') lists(@Ctx() ctx: RequestContext) { return this.s.lists(ctx.businessId); }
  @RequirePermissions('products:write') @Post('price-lists') create(@Ctx() ctx: RequestContext, @Body() dto: PriceListDto) { return this.s.createList(ctx.businessId, dto); }
  @RequirePermissions('products:write') @Put('price-lists/:id') update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PriceListDto) { return this.s.updateList(ctx.businessId, id, dto); }
  @RequirePermissions('products:write') @Delete('price-lists/:id') remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.removeList(ctx.businessId, id); }
  @RequirePermissions('products:read') @Get('price-lists/:id/items') items(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.items(ctx.businessId, id); }
  @RequirePermissions('products:write') @Put('price-lists/:id/items') setItems(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemsDto) { return this.s.setItems(ctx.businessId, id, dto); }
  @RequirePermissions('sales:read') @Get('resolve') resolve(@Ctx() ctx: RequestContext, @Query() q: ResolveQuery) { return this.s.resolve(ctx.businessId, q.customerId); }
  @RequirePermissions('customers:write') @Put('customers/:id') terms(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CustomerTermsDto) { return this.s.setCustomerTerms(ctx.businessId, id, dto); }
  @RequirePermissions('sales:read') @Get('receivables') receivables(@Ctx() ctx: RequestContext, @Query('all') all?: string) { return this.s.receivables(ctx.businessId, all !== '1'); }
}

@Module({ controllers: [WholesaleController], providers: [WholesaleService], exports: [WholesaleService] })
export class WholesaleModule {}
