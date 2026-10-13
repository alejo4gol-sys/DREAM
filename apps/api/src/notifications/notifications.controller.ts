import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { and, eq, isNull, or } from 'drizzle-orm';
import { Ctx, RequestContext } from '../common/auth.guard';
import { Db, InjectDb } from '../db/db';
import { notificationPreferences, notifications } from '../db/schema';
import { NOTIFICATION_TYPES, NotificationsService } from './notifications.service';

class PreferencesDto {
  @IsObject() preferences: Record<string, boolean>;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService, @InjectDb() private db: Db) {}

  @Get()
  list(@Ctx() ctx: RequestContext) {
    return this.service.list(ctx.businessId, ctx.userId, ctx.permissions);
  }

  @Post('read-all')
  async readAll(@Ctx() ctx: RequestContext) {
    await this.db.update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.businessId, ctx.businessId), isNull(notifications.readAt), or(isNull(notifications.userId), eq(notifications.userId, ctx.userId))));
    return { ok: true };
  }

  @Post(':id/read')
  async read(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.db.update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.businessId, ctx.businessId)));
    return { ok: true };
  }

  @Get('preferences')
  async getPrefs(@Ctx() ctx: RequestContext) {
    const rows = await this.db.select().from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, ctx.userId), eq(notificationPreferences.businessId, ctx.businessId)));
    return Object.entries(NOTIFICATION_TYPES)
      .filter(([, v]) => ctx.permissions.has(v.permission))
      .map(([type, v]) => ({ type, label: v.label, enabled: rows.find((r) => r.type === type)?.enabled ?? true }));
  }

  @Put('preferences')
  async setPrefs(@Ctx() ctx: RequestContext, @Body() dto: PreferencesDto) {
    for (const [type, enabled] of Object.entries(dto.preferences)) {
      if (!(type in NOTIFICATION_TYPES) || typeof enabled !== 'boolean') continue;
      await this.db.insert(notificationPreferences)
        .values({ userId: ctx.userId, businessId: ctx.businessId, type, enabled })
        .onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.businessId, notificationPreferences.type], set: { enabled } });
    }
    return this.getPrefs(ctx);
  }
}

