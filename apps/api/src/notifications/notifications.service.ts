import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { Db, InjectDb, Tx } from '../db/db';
import { notificationPreferences, notifications } from '../db/schema';

export const NOTIFICATION_TYPES = {
  LOW_STOCK: { label: 'Inventario bajo', permission: 'products:read' },
  NEW_SALE: { label: 'Nueva venta', permission: 'sales:read' },
  PAYMENT_RECEIVED: { label: 'Pago recibido', permission: 'sales:read' },
  BANK_TX: { label: 'Movimiento bancario nuevo', permission: 'banks:read' },
  PENDING_ACCOUNT: { label: 'Cuenta pendiente', permission: 'finance:read' },
  NEW_CUSTOMER: { label: 'Cliente nuevo', permission: 'customers:read' },
  NEW_STORE_ORDER: { label: 'Nuevo pedido web', permission: 'sales:read' },
  RETURN_REQUESTED: { label: 'Solicitud de devolución', permission: 'sales:read' },
  GOAL_REACHED: { label: 'Meta de ventas alcanzada', permission: 'finance:read' },
  SALES_DROP: { label: 'Disminución significativa de ventas', permission: 'finance:read' },
  HIGH_EXPENSES: { label: 'Gastos elevados', permission: 'finance:read' },
  LEGAL_REQUEST: { label: 'Solicitudes de personas que buscan abogado', permission: 'sales:read' },
  TERM_DUE: { label: 'Término de caducidad o prescripción por vencer', permission: 'sales:read' },
  PROCESS_UPDATE: { label: 'Nuevas actuaciones en procesos vigilados', permission: 'sales:read' },
  PROCESS_REMINDER: { label: 'Recordatorio para revisar un proceso', permission: 'sales:read' },
  NEW_REVIEW: { label: 'Nueva reseña en el directorio', permission: 'customers:read' },
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(@InjectDb() private db: Db) {}

  async notify(
    businessId: string, type: NotificationType, title: string, body: string,
    data: Record<string, unknown> = {}, tx?: Tx,
  ) {
    try {
      await (tx ?? this.db).insert(notifications).values({ businessId, type, title, body, data });
    } catch (e) {
      this.logger.warn(`No se pudo crear notificación: ${(e as Error).message}`);
    }
  }

  async list(businessId: string, userId: string, permissions: Set<string>, limit = 30) {
    const allowedTypes = Object.entries(NOTIFICATION_TYPES)
      .filter(([, v]) => permissions.has(v.permission)).map(([k]) => k);
    const disabled = (await this.db.select({ type: notificationPreferences.type }).from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.businessId, businessId), eq(notificationPreferences.enabled, false))))
      .map((r) => r.type);
    const types = allowedTypes.filter((t) => !disabled.includes(t));
    if (!types.length) return { items: [], unread: 0 };

    const where = and(
      eq(notifications.businessId, businessId),
      or(isNull(notifications.userId), eq(notifications.userId, userId)),
      inArray(notifications.type, types),
    );
    const items = await this.db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(limit);
    const [{ n }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(where, isNull(notifications.readAt)));
    return { items, unread: n };
  }
}
