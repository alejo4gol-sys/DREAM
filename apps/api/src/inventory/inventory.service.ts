import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Db, InjectDb, Tx } from '../db/db';
import { inventoryLevels, inventoryMovements, products, warehouses } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

type MovementType = (typeof inventoryMovements.$inferInsert)['type'];

export interface MoveInput {
  businessId: string;
  productId: string;
  delta: number; // + entra, - sale
  type: MovementType;
  unitCost?: string | null;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  userId?: string;
  allowNegative?: boolean;
}

@Injectable()
export class InventoryService {
  constructor(@InjectDb() private db: Db, private notifications: NotificationsService) {}

  async defaultWarehouse(businessId: string, tx: Tx | Db = this.db) {
    const w = await tx.query.warehouses.findFirst({ where: and(eq(warehouses.businessId, businessId), eq(warehouses.isDefault, true)) });
    if (w) return w;
    const [created] = await tx.insert(warehouses).values({ businessId, name: 'Principal', isDefault: true }).returning();
    return created;
  }

  /**
   * Mueve stock de forma atómica. Para salidas usa un UPDATE condicional
   * (quantity >= n) que evita vender más de lo disponible aun con ventas simultáneas.
   */
  async move(tx: Tx, input: MoveInput) {
    // Los servicios (asesorías, mano de obra, citas…) no manejan existencias.
    const kind = await tx.query.products.findFirst({ where: eq(products.id, input.productId), columns: { isService: true } });
    if (kind?.isService) return 0;
    const wh = await this.defaultWarehouse(input.businessId, tx);
    await tx.insert(inventoryLevels).values({ productId: input.productId, warehouseId: wh.id, quantity: 0 }).onConflictDoNothing();

    const cond = [eq(inventoryLevels.productId, input.productId), eq(inventoryLevels.warehouseId, wh.id)];
    if (input.delta < 0 && !input.allowNegative) cond.push(sql`${inventoryLevels.quantity} >= ${-input.delta}`);
    const updated = await tx.update(inventoryLevels)
      .set({ quantity: sql`${inventoryLevels.quantity} + ${input.delta}` })
      .where(and(...cond)).returning({ quantity: inventoryLevels.quantity });

    if (!updated.length) {
      const p = await tx.query.products.findFirst({ where: eq(products.id, input.productId), columns: { name: true } });
      throw new BadRequestException(`Inventario insuficiente para "${p?.name ?? 'producto'}"`);
    }

    await tx.insert(inventoryMovements).values({
      businessId: input.businessId, productId: input.productId, warehouseId: wh.id, type: input.type,
      quantity: input.delta, unitCost: input.unitCost ?? null, referenceType: input.referenceType,
      referenceId: input.referenceId, note: input.note, userId: input.userId,
    });
    return updated[0].quantity;
  }

  /** Notifica cuando un producto cruza el stock mínimo (solo al cruzar, para no repetir avisos). */
  async checkLowStock(tx: Tx, businessId: string, productId: string, quantity: number, delta: number) {
    if (delta >= 0) return;
    const p = await tx.query.products.findFirst({ where: eq(products.id, productId), columns: { name: true, minStock: true, sku: true } });
    const previous = quantity - delta;
    if (p && p.minStock > 0 && quantity <= p.minStock && previous > p.minStock) {
      await this.notifications.notify(businessId, 'LOW_STOCK', 'Producto con inventario bajo',
        `${p.name} (${p.sku}) tiene ${quantity} unidades; mínimo ${p.minStock}.`, { productId }, tx);
    }
  }

  async adjust(businessId: string, userId: string, productId: string, newQuantity: number, note?: string) {
    const product = await this.db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.businessId, businessId)) });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.db.transaction(async (tx) => {
      const current = await this.stockOf(tx, businessId, productId);
      const delta = newQuantity - current;
      if (delta === 0) return { quantity: current };
      const q = await this.move(tx, {
        businessId, productId, delta, type: 'ADJUSTMENT', unitCost: product.costPrice, note: note ?? 'Ajuste manual', userId,
      });
      await this.checkLowStock(tx, businessId, productId, q, delta);
      return { quantity: q };
    });
  }

  async stockOf(tx: Tx | Db, businessId: string, productId: string) {
    const [r] = await tx.select({ q: sql<number>`coalesce(sum(${inventoryLevels.quantity}),0)::int` })
      .from(inventoryLevels).innerJoin(warehouses, eq(warehouses.id, inventoryLevels.warehouseId))
      .where(and(eq(inventoryLevels.productId, productId), eq(warehouses.businessId, businessId)));
    return r?.q ?? 0;
  }

  movements(businessId: string, productId?: string, limit = 100) {
    return this.db.select({
      id: inventoryMovements.id, type: inventoryMovements.type, quantity: inventoryMovements.quantity,
      unitCost: inventoryMovements.unitCost, note: inventoryMovements.note, createdAt: inventoryMovements.createdAt,
      referenceType: inventoryMovements.referenceType, referenceId: inventoryMovements.referenceId,
      productId: products.id, productName: products.name, sku: products.sku,
    }).from(inventoryMovements).innerJoin(products, eq(products.id, inventoryMovements.productId))
      .where(and(eq(inventoryMovements.businessId, businessId), productId ? eq(inventoryMovements.productId, productId) : undefined))
      .orderBy(desc(inventoryMovements.createdAt)).limit(limit);
  }
}
