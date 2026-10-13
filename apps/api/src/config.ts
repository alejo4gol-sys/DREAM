/** Configuración centralizada. Falla al arrancar si falta algo crítico en producción. */
import { existsSync } from 'node:fs';

// Carga apps/api/.env en desarrollo (Node 20.12+ trae loadEnvFile; Docker usa variables de entorno).
if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');
const isProd = process.env.NODE_ENV === 'production';

function required(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd) throw new Error(`Falta la variable de entorno ${name}`);
  return devDefault;
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://dream:dream@localhost:5432/dream'),
  redisUrl: process.env.REDIS_URL || '',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  jwtSecret: required('JWT_SECRET', 'dev-only-jwt-secret-change-me-0123456789abcdef'),
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlDays: 30,
  // 32 bytes en base64 → AES-256-GCM
  encryptionKey: required('ENCRYPTION_KEY', 'ZGV2LW9ubHktZW5jcnlwdGlvbi1rZXktMzJieXRlcyE='),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  runMigrations: process.env.RUN_MIGRATIONS === 'true',
  assistantApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  // Modelo para el asistente cuando hay clave de API (se puede cambiar sin tocar el código).
  assistantModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  // Llaves del comercio de DREAMS para pagar los planes SaaS. Separadas de las
  // llaves Wompi que cada negocio configura para su propia tienda.
  wompiSaasPublicKey: process.env.WOMPI_SAAS_PUBLIC_KEY ?? '',
  wompiSaasPrivateKey: process.env.WOMPI_SAAS_PRIVATE_KEY ?? '',
  wompiSaasIntegritySecret: process.env.WOMPI_SAAS_INTEGRITY_SECRET ?? '',
  wompiSaasEventSecret: process.env.WOMPI_SAAS_EVENT_SECRET ?? '',
  marketMercadoLibreToken: process.env.MERCADOLIBRE_ACCESS_TOKEN ?? '',
  marketEbayClientId: process.env.EBAY_CLIENT_ID ?? '',
  marketEbayClientSecret: process.env.EBAY_CLIENT_SECRET ?? '',
  marketSerpApiKey: process.env.SERPAPI_API_KEY ?? '',
  // Correos de quienes administran la plataforma (p. ej., verifican abogados). Configúralo en producción.
  // WhatsApp Business Platform (Cloud API de Meta) para avisos a abogados. Sin estas variables no se envía nada.
  whatsappToken: process.env.WHATSAPP_TOKEN ?? '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v26.0',
  whatsappApiBase: process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com',
  whatsappLang: process.env.WHATSAPP_TEMPLATE_LANG || 'es_CO',
  // Dirección pública de la app web (para los enlaces de los avisos).
  appPublicUrl: (process.env.APP_PUBLIC_URL || process.env.WEB_ORIGIN || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, ''),
  // Consulta de Procesos Nacional Unificada de la Rama Judicial (API pública que usa su propio portal).
  cpnuBaseUrl: process.env.CPNU_BASE_URL || 'https://consultaprocesos.ramajudicial.gov.co:448/api/v2',
  processWatchEnabled: process.env.PROCESS_WATCH_ENABLED !== 'false',
  platformAdmins: (process.env.PLATFORM_ADMIN_EMAILS || 'servicios@dream.co,demo@dream.co').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
};
