import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AssistantModule } from './assistant/assistant.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BanksModule } from './banks/banks.module';
import { BusinessesModule } from './businesses/businesses.controller';
import { CatalogModule } from './catalog/catalog.module';
import { AuditInterceptor } from './common/audit.interceptor';
import { AuthGuard, Public } from './common/auth.guard';
import { CommonModule } from './common/common.module';
import { RedisThrottlerStorage } from './common/redis-throttler.storage';
import { config } from './config';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DbModule } from './db/db';
import { FeesModule } from './fees/fees.module';
import { FinanceModule } from './finance/finance.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { LegalTermsModule } from './legal-terms/legal-terms.module';
import { LegalHelpModule } from './legal-help/legal-help.module';
import { ProcessWatchModule } from './process-watch/process-watch.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { InventoryModule } from './inventory/inventory.module';
import { MarketPricesModule } from './market-prices/market-prices.module';
import { NotificationsController } from './notifications/notifications.controller';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { SocialModule } from './social/social.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { StoreModule } from './store/store.module';
import { StoreShareModule } from './store/store-share.module';
import { GrowthModule } from './growth/growth.module';
import { PackagesModule } from './packages/packages.module';
import { WholesaleModule } from './wholesale/wholesale.module';
import { BrochureModule } from './brochure/brochure.module';
import { LegalTemplatesModule } from './legal-templates/legal-templates.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReturnsModule } from './returns/returns.module';
import { ServicesModule } from './services/services.module';
import { UploadsModule } from './uploads/uploads.module';

@Controller('health')
class HealthController {
  @Public() @Get()
  health() { return { status: 'ok', time: new Date().toISOString() }; }
}

@Module({
  imports: [
    JwtModule.register({ global: true, secret: config.jwtSecret, signOptions: { issuer: 'dream' }, verifyOptions: { issuer: 'dream' } }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      storage: config.redisUrl ? new RedisThrottlerStorage(config.redisUrl) : undefined,
    }),
    DbModule, CommonModule, AuthModule, BusinessesModule, CatalogModule, InventoryModule, CustomersModule,
    SuppliersModule, SalesModule, FinanceModule, BanksModule, SocialModule, DashboardModule, ReportsModule,
    AssistantModule, AuditModule, UploadsModule, StoreModule, ReturnsModule, ServicesModule, MarketPricesModule, FeesModule, InvoicingModule, LegalTermsModule, LegalHelpModule, WhatsappModule, ProcessWatchModule, StoreShareModule, GrowthModule, PackagesModule, WholesaleModule, BrochureModule, LegalTemplatesModule, ReviewsModule,
  ],
  controllers: [HealthController, NotificationsController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
