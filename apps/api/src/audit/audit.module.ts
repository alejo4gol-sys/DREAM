import { Controller, Get, Module, Query } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { PageQuery, offset } from '../common/pagination';
import { Db, InjectDb } from '../db/db';
import { auditLogs, users } from '../db/schema';

@Controller('audit-logs')
export class AuditController {
  constructor(@InjectDb() private db: Db) {}

  @Get() @RequirePermissions('audit:read')
  list(@Ctx() ctx: RequestContext, @Query() q: PageQuery) {
    return this.db.select({
      id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, entityId: auditLogs.entityId,
      ip: auditLogs.ip, createdAt: auditLogs.createdAt, userName: users.fullName, path: auditLogs.metadata,
    }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId))
      .where(eq(auditLogs.businessId, ctx.businessId)).orderBy(desc(auditLogs.createdAt))
      .limit(q.pageSize).offset(offset(q));
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
