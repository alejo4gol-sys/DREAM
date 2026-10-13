import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe,
  Patch, Post, Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumberString, IsOptional, IsString,
  IsUUID, Length, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { D, m2 } from '../common/money';
import { PageQuery, likeTerm, offset } from '../common/pagination';
import { Db, InjectDb } from '../db/db';
import { expenses, paymentMethod, products, purchaseItems, purchasePayments, purchases, suppliers } from '../db/schema';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryService } from '../inventory/inventory.service';

const METHODS = paymentMethod.enumValues;

class SupplierDto {
  @IsString() @Length(2, 160) name: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsString() @MaxLength(40) taxId?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
class UpdateSupplierDto {
  @IsOptional() @IsString() @Length(2, 160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsString() @MaxLength(40) taxId?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
class PurchaseItemDto {
  @IsUUID() productId: string;
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
  @IsNumberString() unitCost: string;
}
class PurchaseDto {
  @IsUUID() supplierId: string;
  @IsOptional() @IsDateString() date?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseItemDto) items: PurchaseItemDto[];
  @IsOptional() @IsNumberString() amountPaid?: string;
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
  @IsOptional() @IsBoolean() updateCostPrice?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
class PaymentDto {
  @IsNumberString() amount: string;
  @IsIn(METHODS) method: (typeof METHODS)[number];
}

const statusFor = (total: string, paid: string) =>
  D(paid).gte(total) ? 'PAID' as const : D(paid).gt(0) ? 'PARTIALLY_PAID' as const : 'PENDING' as const;

@Injectable()
export class SuppliersService {
  constructor(@InjectDb() private db: Db, private inventory: InventoryService) {}

  debtExpr = sql<string>`coalesce((select sum(${purchases.total} - ${purchases.amountPaid}) from ${purchases} where ${purchases.supplierId} = "suppliers"."id"), 0)
    + coalesce((select sum(${expenses.amount}) from ${expenses} where ${expenses.supplierId} = "suppliers"."id" and ${expenses.status} = 'PENDING'), 0)`;

  async list(businessId: string, q: PageQuery) {
    const where = and(eq(suppliers.businessId, businessId),
      q.q ? or(ilike(suppliers.name, likeTerm(q.q)), ilike(suppliers.company, likeTerm(q.q)), ilike(suppliers.taxId, likeTerm(q.q))) : undefined);
    const [items, [{ total }]] = await Promise.all([
      this.db.select({
        id: suppliers.id, name: suppliers.name, company: suppliers.company, taxId: suppliers.taxId, phone: suppliers.phone,
        email: suppliers.email, notes: suppliers.notes, createdAt: suppliers.createdAt, debt: this.debtExpr,
        purchasesTotal: sql<string>`coalesce((select sum(${purchases.total}) from ${purchases} where ${purchases.supplierId} = "suppliers"."id"), 0)`,
        productsCount: sql<number>`(select count(*)::int from ${products} where ${products.supplierId} = "suppliers"."id")`,
      }).from(suppliers).where(where).orderBy(asc(suppliers.name)).limit(q.pageSize).offset(offset(q)),
      this.db.select({ total: count() }).from(suppliers).where(where),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(businessId: string, id: string) {
    const s = await this.db.query.suppliers.findFirst({ where: and(eq(suppliers.id, id), eq(suppliers.businessId, businessId)) });
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    const [{ debt }] = await this.db.select({ debt: this.debtExpr }).from(suppliers).where(eq(suppliers.id, id));
    const prods = await this.db.select({ id: products.id, name: products.name, sku: products.sku, costPrice: products.costPrice })
      .from(products).where(eq(products.supplierId, id));
    const history = await this.db.query.purchases.findMany({
      where: eq(purchases.supplierId, id), orderBy: desc(purchases.date), limit: 50,
      with: { items: { with: { product: { columns: { name: true } } } }, payments: true },
    });
    return { ...s, debt, products: prods, purchases: history };
  }

  async createPurchase(ctx: RequestContext, dto: PurchaseDto) {
    const supplier = await this.db.query.suppliers.findFirst({ where: and(eq(suppliers.id, dto.supplierId), eq(suppliers.businessId, ctx.businessId)) });
    if (!supplier) throw new BadRequestException('Proveedor inválido');
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const prods = await this.db.select({ id: products.id }).from(products).where(and(eq(products.businessId, ctx.businessId), inArray(products.id, ids)));
    if (prods.length !== ids.length) throw new BadRequestException('Algún producto no pertenece al negocio');

    const total = dto.items.reduce((acc, i) => acc.plus(D(i.unitCost).times(i.quantity)), D(0));
    const paid = D(dto.amountPaid ?? 0);
    if (paid.gt(total)) throw new BadRequestException('El pago no puede superar el total de la compra');

    return this.db.transaction(async (tx) => {
      const [p] = await tx.insert(purchases).values({
        businessId: ctx.businessId, supplierId: dto.supplierId, date: dto.date ? new Date(dto.date) : new Date(),
        total: m2(total), amountPaid: m2(paid), status: statusFor(m2(total), m2(paid)), notes: dto.notes,
      }).returning();
      for (const i of dto.items) {
        await tx.insert(purchaseItems).values({ purchaseId: p.id, productId: i.productId, quantity: i.quantity, unitCost: m2(i.unitCost), lineTotal: m2(D(i.unitCost).times(i.quantity)) });
        await this.inventory.move(tx, {
          businessId: ctx.businessId, productId: i.productId, delta: i.quantity, type: 'PURCHASE', unitCost: m2(i.unitCost),
          referenceType: 'PURCHASE', referenceId: p.id, userId: ctx.userId, note: `Compra a ${supplier.name}`,
        });
        if (dto.updateCostPrice !== false) await tx.update(products).set({ costPrice: m2(i.unitCost) }).where(eq(products.id, i.productId));
      }
      if (paid.gt(0)) await tx.insert(purchasePayments).values({ purchaseId: p.id, amount: m2(paid), method: dto.paymentMethod ?? 'CASH' });
      return p;
    });
  }

  async addPayment(businessId: string, id: string, dto: PaymentDto) {
    const p = await this.db.query.purchases.findFirst({ where: and(eq(purchases.id, id), eq(purchases.businessId, businessId)) });
    if (!p) throw new NotFoundException('Compra no encontrada');
    const newPaid = D(p.amountPaid).plus(dto.amount);
    if (D(dto.amount).lte(0) || newPaid.gt(p.total)) throw new BadRequestException('Monto inválido: supera el saldo pendiente');
    return this.db.transaction(async (tx) => {
      await tx.insert(purchasePayments).values({ purchaseId: id, amount: m2(dto.amount), method: dto.method });
      const [u] = await tx.update(purchases).set({ amountPaid: m2(newPaid), status: statusFor(p.total, m2(newPaid)) }).where(eq(purchases.id, id)).returning();
      return u;
    });
  }
}

@Controller('suppliers')
export class SuppliersController {
  constructor(private service: SuppliersService, @InjectDb() private db: Db) {}

  @Get() @RequirePermissions('suppliers:read')
  list(@Ctx() ctx: RequestContext, @Query() q: PageQuery) { return this.service.list(ctx.businessId, q); }

  @Get(':id') @RequirePermissions('suppliers:read')
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(ctx.businessId, id); }

  @Post() @RequirePermissions('suppliers:write')
  async create(@Ctx() ctx: RequestContext, @Body() dto: SupplierDto) {
    const [s] = await this.db.insert(suppliers).values({ ...dto, businessId: ctx.businessId }).returning();
    return s;
  }

  @Patch(':id') @RequirePermissions('suppliers:write')
  async update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto) {
    const [s] = await this.db.update(suppliers).set(dto).where(and(eq(suppliers.id, id), eq(suppliers.businessId, ctx.businessId))).returning();
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    return s;
  }

  @Delete(':id') @RequirePermissions('suppliers:write')
  async remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const [{ n }] = await this.db.select({ n: count() }).from(purchases).where(eq(purchases.supplierId, id));
    if (n > 0) throw new BadRequestException('El proveedor tiene compras registradas y no puede eliminarse');
    await this.db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.businessId, ctx.businessId)));
    return { ok: true };
  }
}

@Controller('purchases')
export class PurchasesController {
  constructor(private service: SuppliersService, @InjectDb() private db: Db) {}

  @Get() @RequirePermissions('suppliers:read')
  async list(@Ctx() ctx: RequestContext, @Query() q: PageQuery) {
    return this.db.query.purchases.findMany({
      where: eq(purchases.businessId, ctx.businessId), orderBy: desc(purchases.date),
      limit: q.pageSize, offset: offset(q),
      with: { supplier: { columns: { name: true } }, items: { with: { product: { columns: { name: true } } } } },
    });
  }

  @Post() @RequirePermissions('suppliers:write')
  create(@Ctx() ctx: RequestContext, @Body() dto: PurchaseDto) { return this.service.createPurchase(ctx, dto); }

  @Post(':id/payments') @RequirePermissions('suppliers:write', 'finance:write')
  pay(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PaymentDto) {
    return this.service.addPayment(ctx.businessId, id, dto);
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [SuppliersController, PurchasesController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
