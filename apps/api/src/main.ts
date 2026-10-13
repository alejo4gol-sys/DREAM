import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'node:path';
import { AppModule } from './app.module';
import { config } from './config';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  if (config.runMigrations) {
    await runMigrations();
    Logger.log('Migraciones aplicadas', 'Bootstrap');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // firma del webhook de WhatsApp (X-Hub-Signature-256)
    logger: config.isProd ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug'],
  });

  app.set('trust proxy', 1); // detrás de un proxy/ALB: IP real del cliente para rate limiting y auditoría
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, hsts: config.isProd }));
  app.use(cookieParser());
  app.enableCors({ origin: config.webOrigin.split(',').map((o) => o.trim()), credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: false },
  }));
  app.useBodyParser('json', { limit: '3mb' });
  app.useStaticAssets(path.resolve(config.uploadDir), { prefix: '/uploads', maxAge: '7d', index: false, dotfiles: 'deny' });
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`API DREAMS escuchando en http://localhost:${config.port}/api`, 'Bootstrap');
}

bootstrap();
