import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CryptoService } from './crypto.service';
import { PlanLimitsService } from './plan-limits.service';
import { NotificationsService } from '../notifications/notifications.service';

@Global()
@Module({
  providers: [AuthGuard, CryptoService, PlanLimitsService, NotificationsService],
  exports: [AuthGuard, CryptoService, PlanLimitsService, NotificationsService],
})
export class CommonModule {}
