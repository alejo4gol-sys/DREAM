import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumberString, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { and, asc, count, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { isUniqueViolation } from '../common/db-errors';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { PageQuery, likeTerm, offset } from '../common/pagination';
import { PlanLimitsService } from '../common/plan-limits.service';
import { Db, InjectDb } from '../db/db';
import { categories, inventoryLevels, productVariants, products, saleItems, storeOrderItems, suppliers } from '../db/schema';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryModule } from '../inventory/inventory.module';

// ───────── DTOs ─────────
class CategoryDto { @IsString() @Length(1, 80) name: string; }

class StoreOptionChoiceDto {
  @IsString() @Length(1, 80) label: string;
  @IsOptional() @Matches(/^\d+(?:\.\d{1,2})?$/) priceDelta?: string;
}
class StoreOptionDto {
  @IsString() @Length(1, 60) name: string;
  @IsIn(['select', 'multi', 'text', 'date', 'time']) type: 'select' | 'multi' | 'text' | 'date' | 'time';
  @IsBoolean() required: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => StoreOptionChoiceDto) choices?: StoreOptionChoiceDto[];
}
class ProductVariantDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @Length(1, 80) sku: string;
  @IsObject() options: Record<string, string>;
  @Type(() => Number) @IsInt() @Min(0) stock: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minStock?: number;
}
class AppointmentScheduleDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weekdays: number[];
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
  @Type(() => Number) @IsInt() @Min(5) @Max(480) intervalMinutes: number;
  @Type(() => Number) @IsInt() @Min(5) @Max(480) durationMinutes: number;
}

class ProductDto {
  @IsString() @Length(1, 60) sku: string;
  @IsOptional() @IsString() @MaxLength(60) barcode?: string;
  @IsString() @Length(1, 200) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsUUID() supplierId?: string | null;
  @IsNumberString({}, { message: 'Precio de compra inválido' }) costPrice: string;
  @IsNumberString({}, { message: 'Precio de venta inválido' }) salePrice: string;
  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) initialStock?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => StoreOptionDto) storeOptions?: StoreOptionDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) preparationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) depositPercent?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => ProductVariantDto) variants?: ProductVariantDto[];
  @IsOptional() @ValidateNested() @Type(() => AppointmentScheduleDto) appointmentSchedule?: AppointmentScheduleDto | null;
  @IsOptional() @IsBoolean() isService?: boolean;
  @IsOptional() @IsIn(['FIXED', 'HOUR', 'SESSION', 'MONTH']) pricingUnit?: string;
}
class UpdateProductDto {
  @IsOptional() @IsString() @Length(1, 60) sku?: string;
  @IsOptional() @IsString() @MaxLength(60) barcode?: string;
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsUUID() supplierId?: string | null;
  @IsOptional() @IsNumberString() costPrice?: string;
  @IsOptional() @IsNumberString() salePrice?: string;
  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => StoreOptionDto) storeOptions?: StoreOptionDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) preparationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) depositPercent?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => ProductVariantDto) variants?: ProductVariantDto[];
  @IsOptional() @ValidateNested() @Type(() => AppointmentScheduleDto) appointmentSchedule?: AppointmentScheduleDto | null;
  @IsOptional() @IsBoolean() isService?: boolean;
  @IsOptional() @IsIn(['FIXED', 'HOUR', 'SESSION', 'MONTH']) pricingUnit?: string;
}
class ProductQuery extends PageQuery {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsIn(['true', 'false']) lowStock?: string;
  @IsOptional() @IsIn(['true', 'false']) includeInactive?: string;
  @IsOptional() @IsIn(['true', 'false']) isService?: string;
}

const stockExpr = sql<number>`coalesce((select sum(${inventoryLevels.quantity}) from ${inventoryLevels} where ${inventoryLevels.productId} = "products"."id"), 0)::int`;

@Injectable()
export class CatalogService {
  constructor(@InjectDb() private db: Db, private inventory: InventoryService, private limits: PlanLimitsService) {}

  private async assertRefs(businessId: string, dto: { categoryId?: string | null; supplierId?: string | null }) {
    if (dto.categoryId) {
      const c = await this.db.query.categories.findFirst({ where: and(eq(categories.id, dto.categoryId), eq(categories.businessId, businessId)) });
      if (!c) throw new BadRequestException('Categoría inválida');
    }
    if (dto.supplierId) {
      const s = await this.db.query.suppliers.findFirst({ where: and(eq(suppliers.id, dto.supplierId), eq(suppliers.businessId, businessId)) });
      if (!s) throw new BadRequestException('Proveedor inválido');
    }
  }

  private async assertBarcodeAvailable(businessId: string, barcode?: string | null, exceptId?: string) {
    const code = barcode?.trim();
    if (!code) return;
    const [duplicate] = await this.db.select({ id: products.id }).from(products)
      .where(and(eq(products.businessId, businessId), eq(products.barcode, code), exceptId ? ne(products.id, exceptId) : undefined)).limit(1);
    if (duplicate) throw new ConflictException('Ese código de barras ya está asignado a otro producto de este negocio');
  }

  private assertStoreOptions(options?: StoreOptionDto[]) {
    if (!options) return;
    const names = new Set<string>();
    for (const option of options) {
      const key = option.name.trim().toLocaleLowerCase('es');
      if (names.has(key)) throw new BadRequestException('Cada campo personalizado debe tener un nombre diferente');
      names.add(key);
      if ((option.type === 'select' || option.type === 'multi') && !option.choices?.length) throw new BadRequestException(`Agrega opciones para ${option.name}`);
      const labels = new Set<string>();
      for (const choice of option.choices ?? []) {
        const label = choice.label.trim().toLocaleLowerCase('es');
        if (labels.has(label)) throw new BadRequestException(`Hay opciones repetidas en ${option.name}`);
        labels.add(label);
      }
    }
  }
  private assertVariants(options: StoreOptionDto[] | undefined, variants?: ProductVariantDto[]) {
    if (!variants) return;
    const groups = (options ?? []).filter((o) => o.type === 'select');
    if (variants.length && !groups.length) throw new BadRequestException('Configura primero campos de selección, como talla o color');
    if (variants.length && groups.some((g) => !g.required)) throw new BadRequestException('Los campos que definen variantes deben ser obligatorios');
    const seen = new Set<string>(); const skus = new Set<string>();
    for (const variant of variants) {
      if (skus.has(variant.sku.trim().toLocaleLowerCase('es'))) throw new BadRequestException('Los SKU de variantes deben ser únicos');
      skus.add(variant.sku.trim().toLocaleLowerCase('es'));
      if (Object.keys(variant.options).length !== groups.length || groups.some((g) => !g.choices?.some((choice) => choice.label === variant.options[g.name]))) {
        throw new BadRequestException(`Completa cada combinación de variantes con: ${groups.map((g) => g.name).join(', ')}`);
      }
      const key = groups.map((g) => variant.options[g.name]).join('\u0000');
      if (seen.has(key)) throw new BadRequestException('Hay combinaciones de variantes repetidas');
      seen.add(key);
    }
  }
  private assertAppointmentOptions(options?: StoreOptionDto[], schedule?: AppointmentScheduleDto | null) {
    const hasDate = options?.some((o) => o.type === 'date');
    const hasTime = options?.some((o) => o.type === 'time');
    if (hasDate !== hasTime) throw new BadRequestException('Configura fecha y hora juntas para las citas');
    if (hasDate && !schedule) throw new BadRequestException('Define los días y horarios disponibles para reservar citas');
    if (schedule && schedule.endTime <= schedule.startTime) throw new BadRequestException('La hora de cierre debe ser posterior a la hora de apertura');
  }

  async list(businessId: string, q: ProductQuery) {
    const where = and(
      eq(products.businessId, businessId),
      q.includeInactive === 'true' ? undefined : eq(products.isActive, true),
      q.categoryId ? eq(products.categoryId, q.categoryId) : undefined,
      q.q ? or(ilike(products.name, likeTerm(q.q)), ilike(products.sku, likeTerm(q.q)), ilike(products.barcode, likeTerm(q.q))) : undefined,
      q.lowStock === 'true' ? and(eq(products.isService, false), sql`${stockExpr} <= ${products.minStock}`) : undefined,
      q.isService ? eq(products.isService, q.isService === 'true') : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      this.db.select({
        id: products.id, sku: products.sku, barcode: products.barcode, name: products.name, description: products.description,
        costPrice: products.costPrice, salePrice: products.salePrice, taxRate: products.taxRate, minStock: products.minStock, storeOptions: products.storeOptions,
        preparationMinutes: products.preparationMinutes, depositPercent: products.depositPercent, isService: products.isService, pricingUnit: products.pricingUnit, appointmentSchedule: products.appointmentSchedule,
        imageUrl: products.imageUrl, isActive: products.isActive, categoryId: products.categoryId, supplierId: products.supplierId,
        categoryName: categories.name, supplierName: suppliers.name, stock: stockExpr,
      }).from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
        .where(where).orderBy(asc(products.name)).limit(q.pageSize).offset(offset(q)),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(businessId: string, id: string) {
    const [p] = await this.db.select({ product: products, stock: stockExpr }).from(products)
      .where(and(eq(products.id, id), eq(products.businessId, businessId)));
    if (!p) throw new NotFoundException('Producto no encontrado');
    const variants = await this.db.select().from(productVariants).where(and(eq(productVariants.businessId, businessId), eq(productVariants.productId, id), eq(productVariants.isActive, true))).orderBy(productVariants.sku);
    return { ...p.product, stock: p.stock, variants };
  }

  async lookupBarcode(businessId: string, barcode: string) {
    const code = barcode.trim();
    if (!code) throw new BadRequestException('Escanea o escribe un código de barras');
    const matches = await this.db.select({ product: products, stock: stockExpr }).from(products)
      .where(and(eq(products.businessId, businessId), eq(products.barcode, code), eq(products.isActive, true))).limit(2);
    if (!matches.length) throw new NotFoundException('No encontramos un producto con ese código. Asígnale el código desde Productos.');
    if (matches.length > 1) throw new ConflictException('Ese código está repetido. Corrígelo en Productos antes de registrar la venta.');
    return { ...matches[0].product, stock: matches[0].stock };
  }

  async create(ctx: RequestContext, dto: ProductDto) {
    await this.limits.assert(ctx.businessId, 'products');
    await this.assertRefs(ctx.businessId, dto);
    await this.assertBarcodeAvailable(ctx.businessId, dto.barcode);
    this.assertStoreOptions(dto.storeOptions);
    this.assertVariants(dto.storeOptions, dto.variants);
    this.assertAppointmentOptions(dto.storeOptions, dto.appointmentSchedule);
    const { initialStock, variants, ...data } = dto;
    try {
      return await this.db.transaction(async (tx) => {
        const [p] = await tx.insert(products).values({ ...data, businessId: ctx.businessId }).returning();
        if (variants?.length) await tx.insert(productVariants).values(variants.map((v) => ({ ...v, businessId: ctx.businessId, productId: p.id, minStock: v.minStock ?? 0 })));
        const wh = await this.inventory.defaultWarehouse(ctx.businessId, tx);
        await tx.insert(inventoryLevels).values({ productId: p.id, warehouseId: wh.id, quantity: 0 });
        const stock = variants ? variants.reduce((sum, v) => sum + v.stock, 0) : initialStock ?? 0;
        if (stock > 0) {
          await this.inventory.move(tx, {
            businessId: ctx.businessId, productId: p.id, delta: stock, type: 'INITIAL',
            unitCost: p.costPrice, note: 'Inventario inicial', userId: ctx.userId,
          });
        }
        return { ...p, stock };
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Ya existe un producto con ese SKU');
      throw e;
    }
  }

  async importXlsx(ctx: RequestContext, file?: Express.Multer.File) {
    if (!file || file.size > 5 * 1024 * 1024) throw new BadRequestException('Adjunta un Excel .xlsx de máximo 5 MB');
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(file.buffer as any); } catch { throw new BadRequestException('No pudimos leer el archivo .xlsx'); }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) throw new BadRequestException('El archivo debe tener encabezados y al menos un producto');
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(String(cell.value ?? '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, ''), column));
    const col = (...names: string[]) => names.map((n) => headers.get(n)).find((n) => n !== undefined);
    const skuCol = col('sku', 'codigo'), nameCol = col('nombre', 'producto'), costCol = col('costo', 'precio de compra'), priceCol = col('precio de venta', 'precio', 'venta');
    if (!skuCol || !nameCol || !priceCol) throw new BadRequestException('Incluye columnas SKU, Nombre y Precio de venta. Costo y Stock son opcionales.');
    if (sheet.rowCount > 501) throw new BadRequestException('Importa máximo 500 productos por archivo');
    const stockCol = col('stock', 'existencias'), minCol = col('stock minimo', 'minimo'), barcodeCol = col('codigo de barras', 'barcode');
    let imported = 0; const errors: string[] = [];
    for (let n = 2; n <= sheet.rowCount; n++) {
      const row = sheet.getRow(n); const value = (idx?: number) => idx ? String(row.getCell(idx).value ?? '').trim() : '';
      const sku = value(skuCol), name = value(nameCol), price = value(priceCol);
      if (!sku && !name && !price) continue;
      try {
        if (!/^\d+(?:\.\d{1,2})?$/.test(price) || (costCol && value(costCol) && !/^\d+(?:\.\d{1,2})?$/.test(value(costCol)))) throw new Error('Precio inválido');
        const stock = Number(value(stockCol) || 0), minStock = Number(value(minCol) || 0);
        if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(minStock) || minStock < 0) throw new Error('Stock inválido');
        await this.create(ctx, { sku, name, salePrice: price, costPrice: value(costCol) || '0', barcode: value(barcodeCol) || undefined, minStock, initialStock: stock });
        imported++;
      } catch (error) { errors.push(`Fila ${n}: ${(error as Error).message}`); }
    }
    return { imported, errors: errors.slice(0, 25), remainingErrors: Math.max(0, errors.length - 25) };
  }

  async update(ctx: RequestContext, id: string, dto: UpdateProductDto) {
    const businessId = ctx.businessId;
    const current = await this.get(businessId, id);
    await this.assertRefs(businessId, dto);
    await this.assertBarcodeAvailable(businessId, dto.barcode, id);
    this.assertStoreOptions(dto.storeOptions);
    this.assertVariants(dto.storeOptions ?? current.storeOptions, dto.variants);
    this.assertAppointmentOptions(dto.storeOptions ?? current.storeOptions, dto.appointmentSchedule === undefined ? current.appointmentSchedule : dto.appointmentSchedule);
    try {
      await this.db.transaction(async (tx) => {
        const { variants, ...data } = dto;
        await tx.update(products).set(data).where(and(eq(products.id, id), eq(products.businessId, businessId)));
        if (variants !== undefined) {
          const existing = current.variants;
          const incomingIds = new Set(variants.flatMap((v) => v.id ? [v.id] : []));
          if ([...incomingIds].some((variantId) => !existing.some((v) => v.id === variantId))) throw new BadRequestException('Una variante pertenece a otro producto');
          const removed = existing.filter((v) => !incomingIds.has(v.id));
          if (removed.length) {
            const [{ used }] = await tx.select({ used: count() }).from(storeOrderItems).where(inArray(storeOrderItems.variantId, removed.map((v) => v.id)));
            if (used) throw new BadRequestException('No puedes eliminar variantes que ya aparecen en pedidos. Desactívalas y deja su stock en cero.');
            await tx.delete(productVariants).where(inArray(productVariants.id, removed.map((v) => v.id)));
          }
          for (const variant of variants) {
            const { id: variantId, ...data } = variant;
            if (variantId) await tx.update(productVariants).set({ ...data, minStock: data.minStock ?? 0 }).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, id)));
            else await tx.insert(productVariants).values({ ...data, businessId, productId: id, minStock: data.minStock ?? 0 });
          }
          const nextStock = variants.reduce((sum, v) => sum + v.stock, 0);
          const delta = nextStock - current.stock;
          if (delta) await this.inventory.move(tx, { businessId, productId: id, delta, type: 'ADJUSTMENT', unitCost: null, userId: ctx.userId, note: 'Ajuste de inventario por variantes' });
        }
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Ya existe un producto con ese SKU');
      throw e;
    }
    return this.get(businessId, id);
  }

  async remove(businessId: string, id: string) {
    await this.get(businessId, id);
    const [{ salesUsed }] = await this.db.select({ salesUsed: count() }).from(saleItems).where(eq(saleItems.productId, id));
    const [{ ordersUsed }] = await this.db.select({ ordersUsed: count() }).from(storeOrderItems).where(eq(storeOrderItems.productId, id));
    const used = salesUsed + ordersUsed;
    if (used > 0) {
      // Tiene historial de ventas: se desactiva para conservar la trazabilidad contable
      await this.db.update(products).set({ isActive: false }).where(eq(products.id, id));
      return { ok: true, archived: true };
    }
    await this.db.delete(products).where(and(eq(products.id, id), eq(products.businessId, businessId)));
    return { ok: true, archived: false };
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(@InjectDb() private db: Db) {}

  @Get() @RequirePermissions('products:read')
  list(@Ctx() ctx: RequestContext) {
    return this.db.select({ id: categories.id, name: categories.name, products: sql<number>`(select count(*)::int from ${products} where ${products.categoryId} = "categories"."id")` })
      .from(categories).where(eq(categories.businessId, ctx.businessId)).orderBy(asc(categories.name));
  }

  @Post() @RequirePermissions('products:write')
  async create(@Ctx() ctx: RequestContext, @Body() dto: CategoryDto) {
    const [c] = await this.db.insert(categories).values({ businessId: ctx.businessId, name: dto.name.trim() })
      .onConflictDoNothing().returning();
    if (!c) throw new ConflictException('La categoría ya existe');
    return c;
  }

  @Patch(':id') @RequirePermissions('products:write')
  async update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryDto) {
    const [c] = await this.db.update(categories).set({ name: dto.name.trim() })
      .where(and(eq(categories.id, id), eq(categories.businessId, ctx.businessId))).returning();
    if (!c) throw new NotFoundException();
    return c;
  }

  @Delete(':id') @RequirePermissions('products:write')
  async remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.db.delete(categories).where(and(eq(categories.id, id), eq(categories.businessId, ctx.businessId)));
    return { ok: true };
  }
}

@Controller('products')
export class ProductsController {
  constructor(private service: CatalogService) {}

  @Get() @RequirePermissions('products:read')
  list(@Ctx() ctx: RequestContext, @Query() q: ProductQuery) { return this.service.list(ctx.businessId, q); }

  @Get('barcode/:code') @RequirePermissions('products:read')
  lookupBarcode(@Ctx() ctx: RequestContext, @Param('code') code: string) { return this.service.lookupBarcode(ctx.businessId, code); }

  @Post('import-xlsx') @RequirePermissions('products:write') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  import(@Ctx() ctx: RequestContext, @UploadedFile() file?: Express.Multer.File) { return this.service.importXlsx(ctx, file); }

  @Get(':id') @RequirePermissions('products:read')
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(ctx.businessId, id); }

  @Post() @RequirePermissions('products:write')
  create(@Ctx() ctx: RequestContext, @Body() dto: ProductDto) { return this.service.create(ctx, dto); }

  @Patch(':id') @RequirePermissions('products:write')
  update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(ctx, id, dto);
  }

  @Delete(':id') @RequirePermissions('products:write')
  remove(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.service.remove(ctx.businessId, id); }
}

@Module({
  imports: [InventoryModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CatalogService],
})
export class CatalogModule {}
