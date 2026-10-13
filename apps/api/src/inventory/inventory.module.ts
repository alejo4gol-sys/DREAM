import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { and, asc, eq, sql } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { Db, InjectDb } from '../db/db';
import { categories, inventoryLevels, products } from '../db/schema';
import { InventoryService } from './inventory.service';

class AdjustmentDto {
  @IsUUID() productId: string;
  @Type(() => Number) @IsInt() @Min(0) quantity: number;
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}
class MovementsQuery {
  @IsOptional() @IsUUID() productId?: string;
}

const stock = sql<number>`coalesce(sum(${inventoryLevels.quantity}), 0)::int`;

@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService, @InjectDb() private db: Db) {}

  /** Resumen de inventario: stock, valor al costo y al precio de venta. */
  @Get() @RequirePermissions('products:read')
  async summary(@Ctx() ctx: RequestContext) {
    const items = await this.db.select({
      id: products.id, sku: products.sku, barcode: products.barcode, name: products.name, minStock: products.minStock,
      costPrice: products.costPrice, salePrice: products.salePrice, categoryName: categories.name, stock,
    }).from(products)
      .leftJoin(inventoryLevels, eq(inventoryLevels.productId, products.id))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.businessId, ctx.businessId), eq(products.isActive, true), eq(products.isService, false)))
      .groupBy(products.id, categories.name).orderBy(asc(products.name));
    const totals = items.reduce((acc, i) => {
      acc.units += i.stock;
      acc.costValue += i.stock * Number(i.costPrice);
      acc.saleValue += i.stock * Number(i.salePrice);
      if (i.stock <= i.minStock) acc.lowStock += 1;
      if (i.stock <= 0) acc.outOfStock += 1;
      return acc;
    }, { units: 0, costValue: 0, saleValue: 0, lowStock: 0, outOfStock: 0 });
    return { totals, items };
  }

  @Get('low-stock') @RequirePermissions('products:read')
  lowStock(@Ctx() ctx: RequestContext) {
    return this.db.select({ id: products.id, sku: products.sku, name: products.name, minStock: products.minStock, stock })
      .from(products).leftJoin(inventoryLevels, eq(inventoryLevels.productId, products.id))
      .where(and(eq(products.businessId, ctx.businessId), eq(products.isActive, true), eq(products.isService, false)))
      .groupBy(products.id).having(sql`${stock} <= ${products.minStock}`).orderBy(asc(stock));
  }

  @Get('movements') @RequirePermissions('products:read')
  movements(@Ctx() ctx: RequestContext, @Query() q: MovementsQuery) {
    return this.service.movements(ctx.businessId, q.productId);
  }

  @Post('adjustments') @RequirePermissions('inventory:adjust')
  adjust(@Ctx() ctx: RequestContext, @Body() dto: AdjustmentDto) {
    return this.service.adjust(ctx.businessId, ctx.userId, dto.productId, dto.quantity, dto.note);
  }
}

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
