import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Db, InjectDb } from '../db/db';
import { auditLogs } from '../db/schema';
import type { AuthedRequest } from './auth.guard';

const ACTIONS: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
const REDACT = /password|token|secret|code|accountNumber/i;

/** Registra en AuditLog toda operación de escritura exitosa (quién, qué, cuándo, desde dónde). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');
  constructor(@InjectDb() private db: Db) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const action = ACTIONS[req.method];
    if (!action) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const path = (req.route?.path as string | undefined) ?? req.path;
        const entity = path.replace(/^\/api\//, '').split('/')[0] || 'unknown';
        const entityId = (req.params?.id as string) ?? (result as { id?: string } | undefined)?.id ?? null;
        const body = Object.fromEntries(
          Object.entries((req.body ?? {}) as Record<string, unknown>).map(([k, v]) => [k, REDACT.test(k) ? '[oculto]' : v]),
        );
        this.db.insert(auditLogs).values({
          businessId: req.ctx?.businessId ?? null,
          userId: req.ctx?.userId ?? req.auth?.userId ?? null,
          action,
          entity: `${entity}${path.includes(':id/') ? '/' + path.split(':id/')[1] : ''}`,
          entityId: entityId ? String(entityId) : null,
          ip: req.ip ?? null,
          userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
          metadata: { path: req.originalUrl.split('?')[0], body: JSON.stringify(body).length < 4000 ? body : '[truncado]' },
        }).catch((e) => this.logger.warn(`No se pudo registrar auditoría: ${e.message}`));
      }),
    );
  }
}
