import { ForbiddenException, Injectable } from '@nestjs/common';
import { and, count, eq, gte, ne } from 'drizzle-orm';
import { Db, InjectDb } from '../db/db';
import { bankAccounts, memberships, plans, processWatches, products, sales, socialAccounts, subscriptions, PlanLimits } from '../db/schema';

type LimitKey = 'users' | 'products' | 'salesPerMonth' | 'bankAccounts' | 'socialAccounts' | 'processWatches';

const LABELS: Record<LimitKey, string> = {
  users: 'usuarios', products: 'productos', salesPerMonth: 'ventas este mes',
  bankAccounts: 'cuentas bancarias', socialAccounts: 'redes conectadas', processWatches: 'procesos vigilados',
};

/** Verifica los límites del plan del negocio antes de crear recursos. */
@Injectable()
export class PlanLimitsService {
  constructor(@InjectDb() private db: Db) {}

  async limits(businessId: string): Promise<{ code: string; name: string; limits: PlanLimits; status: string }> {
    const [row] = await this.db
      .select({ code: plans.code, name: plans.name, limits: plans.limits, status: subscriptions.status })
      .from(subscriptions).innerJoin(plans, eq(plans.code, subscriptions.planCode))
      .where(eq(subscriptions.businessId, businessId));
    if (!row) throw new ForbiddenException('El negocio no tiene suscripción');
    return row;
  }

  async usage(businessId: string): Promise<Record<LimitKey, number>> {
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(5, 0, 0, 0);
    const c = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
    return {
      users: await c(this.db.select({ n: count() }).from(memberships).where(eq(memberships.businessId, businessId))),
      products: await c(this.db.select({ n: count() }).from(products).where(eq(products.businessId, businessId))),
      salesPerMonth: await c(this.db.select({ n: count() }).from(sales).where(and(eq(sales.businessId, businessId), gte(sales.date, monthStart)))),
      bankAccounts: await c(this.db.select({ n: count() }).from(bankAccounts).where(eq(bankAccounts.businessId, businessId))),
      socialAccounts: await c(this.db.select({ n: count() }).from(socialAccounts).where(eq(socialAccounts.businessId, businessId))),
      processWatches: await c(this.db.select({ n: count() }).from(processWatches).where(and(eq(processWatches.businessId, businessId), ne(processWatches.status, 'ARCHIVED')))),
    };
  }

  /** Avisos por WhatsApp: solo planes que los incluyen y con la suscripción activa. */
  async whatsappAllowed(businessId: string) {
    try {
      const { name, limits, status } = await this.limits(businessId);
      return { allowed: !!limits.whatsappAlerts && ['ACTIVE', 'TRIALING'].includes(status), plan: name, status };
    } catch { return { allowed: false, plan: '', status: 'NONE' }; }
  }

  async assert(businessId: string, key: LimitKey) {
    const { name, limits } = await this.limits(businessId);
    const max = limits[key];
    if (max === null || max === undefined) return;
    const used = (await this.usage(businessId))[key];
    if (used >= max) {
      throw new ForbiddenException(`Tu plan ${name} permite hasta ${max} ${LABELS[key]}. Mejora tu plan para continuar.`);
    }
  }
}
