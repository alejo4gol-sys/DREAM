/**
 * Cliente del proveedor tecnológico Factus (Halltec) para enviar facturas electrónicas a la DIAN.
 * Documentación: https://developers.factus.com.co
 * - Cada negocio usa SUS credenciales (contrato propio con Factus): client_id, client_secret, usuario y contraseña.
 * - Ambiente de pruebas (sandbox) y producción. En pruebas la DIAN no valida: no tiene validez fiscal.
 * IMPORTANTE: antes de producción, valide en el sandbox que los totales que devuelve Factus coinciden con los de DREAMS
 * (el sistema compara y avisa si no coinciden).
 */
export interface FactusConfig {
  env: 'sandbox' | 'production';
  clientId: string; clientSecret: string; username: string; password: string;
  numberingRangeId?: number | null; priceIncludesTax?: boolean;
}

export const FACTUS_URLS = { sandbox: 'https://api-sandbox.factus.com.co', production: 'https://api.factus.com.co' };
const base = (env: string) => (process.env.FACTUS_BASE_URL || (FACTUS_URLS as any)[env] || FACTUS_URLS.sandbox).replace(/\/$/, '');

export class FactusError extends Error {
  constructor(message: string, public status: number, public details?: any) { super(message); }
}

/** Medio de pago de DREAMS → código DIAN (tabla 13.3.4.2 del anexo técnico). */
export const FACTUS_PAYMENT_CODE: Record<string, string> = {
  CASH: '10', BANK_TRANSFER: '47', CREDIT_CARD: '48', DEBIT_CARD: '49', PSE: '47', NEQUI: '47', DAVIPLATA: '47', OTHER: 'ZZZ',
};

async function call(url: string, init: RequestInit & { timeoutMs?: number }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 30_000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await r.text();
    let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
    return { status: r.status, ok: r.ok, body };
  } catch (e: any) {
    throw new FactusError(e?.name === 'AbortError' ? 'Factus no respondió a tiempo.' : `No fue posible conectar con Factus: ${e?.message ?? e}`, 0);
  } finally { clearTimeout(t); }
}

const tokens = new Map<string, { token: string; exp: number }>();

export async function factusToken(cfg: FactusConfig) {
  const key = `${cfg.env}|${cfg.clientId}|${cfg.username}`;
  const c = tokens.get(key);
  if (c && c.exp > Date.now() + 60_000) return c.token;
  const form = new URLSearchParams({ grant_type: 'password', client_id: cfg.clientId, client_secret: cfg.clientSecret, username: cfg.username, password: cfg.password });
  const r = await call(`${base(cfg.env)}/oauth/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  if (!r.ok || !r.body?.access_token) throw new FactusError(r.status === 401 || r.status === 400 ? 'Factus rechazó las credenciales. Revisa client_id, client_secret, usuario y contraseña.' : `Factus respondió ${r.status} al iniciar sesión.`, r.status, r.body);
  tokens.set(key, { token: r.body.access_token, exp: Date.now() + (Number(r.body.expires_in) || 600) * 1000 });
  return r.body.access_token as string;
}

async function authed(cfg: FactusConfig, method: string, path: string, body?: unknown) {
  const token = await factusToken(cfg);
  return call(`${base(cfg.env)}${path}`, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
}

const errText = (b: any) => {
  if (!b) return '';
  const parts: string[] = [];
  if (b.message) parts.push(String(b.message));
  const data = b.data?.errors ?? b.errors;
  if (data && typeof data === 'object') for (const [k, v] of Object.entries(data)) parts.push(`${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
  return parts.join(' · ').slice(0, 1500);
};

/** Prueba de conexión: inicia sesión y consulta los rangos de numeración (si el endpoint está disponible). */
export async function factusTest(cfg: FactusConfig) {
  await factusToken(cfg);
  let ranges: { id: number; prefix?: string; from?: number; to?: number; current?: number; document?: string; resolution?: string }[] = [];
  try {
    const r = await authed(cfg, 'GET', '/v1/numbering-ranges?filter[is_active]=1');
    const list = r.body?.data?.data ?? r.body?.data ?? [];
    if (r.ok && Array.isArray(list)) ranges = list.map((x: any) => ({ id: x.id, prefix: x.prefix, from: x.from, to: x.to, current: x.current, document: x.document, resolution: x.resolution_number }));
  } catch { /* opcional */ }
  return { ok: true, ranges };
}

export interface BillInput {
  referenceCode: string; numberingRangeId?: number | null; observation?: string | null;
  paymentForm: 'CONTADO' | 'CREDITO'; paymentMeans?: string | null; dueDate?: Date | null; total: number;
  buyer: { finalConsumer: boolean; name: string; idType: string; idNumber: string; dv?: string | null; address?: string | null; email?: string | null; phone?: string | null };
  items: { code?: string | null; description: string; quantity: number; unitPrice: number; discount: number; taxRate: number }[];
  priceIncludesTax?: boolean;
}

export function factusBillPayload(b: BillInput) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const fc = b.buyer.finalConsumer;
  const customer: Record<string, any> = fc
    ? { identification_document_code: '13', identification: '222222222222', names: 'Consumidor final', legal_organization_code: '2', tribute_code: 'ZZ', responsibilities: ['R-99-PN'] }
    : {
      identification_document_code: b.buyer.idType, identification: b.buyer.idNumber, ...(b.buyer.idType === '31' && b.buyer.dv ? { dv: b.buyer.dv } : {}),
      ...(b.buyer.idType === '31' ? { company: b.buyer.name } : { names: b.buyer.name }),
      legal_organization_code: b.buyer.idType === '31' ? '1' : '2', tribute_code: 'ZZ', responsibilities: ['R-99-PN'],
      ...(b.buyer.address ? { address: b.buyer.address } : {}), ...(b.buyer.email ? { email: b.buyer.email } : {}), ...(b.buyer.phone ? { phone: b.buyer.phone } : {}),
      country_code: 'CO',
    };
  return {
    reference_code: b.referenceCode, document: '01', operation_type: '10',
    ...(b.numberingRangeId ? { numbering_range_id: b.numberingRangeId } : {}),
    ...(b.observation ? { observation: b.observation.slice(0, 250) } : {}),
    payment_details: [{
      payment_form: b.paymentForm === 'CONTADO' ? '1' : '2',
      payment_method_code: FACTUS_PAYMENT_CODE[b.paymentMeans ?? ''] ?? (b.paymentForm === 'CREDITO' ? 'ZZZ' : '10'),
      amount: r2(b.total).toFixed(2),
      ...(b.paymentForm === 'CREDITO' && b.dueDate ? { payment_due_date: b.dueDate.toISOString().slice(0, 10) } : {}),
    }],
    customer,
    items: b.items.map((it, i) => {
      const gross = it.unitPrice * it.quantity;
      const rate = gross > 0 ? r2((it.discount / gross) * 100) : 0;
      const price = b.priceIncludesTax ? it.unitPrice * (1 + it.taxRate / 100) : it.unitPrice;
      return {
        code_reference: (it.code || `ITEM-${i + 1}`).slice(0, 50), name: it.description.slice(0, 250), quantity: it.quantity,
        discount_rate: rate.toFixed(2), price: r2(price).toFixed(2), unit_measure_code: '94', standard_code: '999',
        taxes: [{ code: '01', rate: it.taxRate.toFixed(2) }],
      };
    }),
  };
}

export interface BillResult { number: string; cufe: string | null; qr: string | null; publicUrl: string | null; total: number | null; raw: any }

function billOf(body: any): BillResult {
  const d = body?.data?.bill ?? body?.data ?? {};
  const links = body?.data?.links ?? d.links ?? {};
  return {
    number: String(d.number ?? ''), cufe: d.cufe ?? null, qr: links.qr ?? d.qr ?? null, publicUrl: links.public_url ?? d.public_url ?? null,
    total: d.total != null ? Number(d.total) : null, raw: { status: body?.status, message: body?.message, number: d.number, cufe: d.cufe, links },
  };
}

/** Envía y valida una factura. Si quedó una pendiente con la misma referencia (409), la borra y reintenta una vez. */
export async function factusSendBill(cfg: FactusConfig, payload: ReturnType<typeof factusBillPayload>): Promise<BillResult> {
  let r = await authed(cfg, 'POST', '/v2/bills/validate', payload);
  if (r.status === 409) {
    await authed(cfg, 'DELETE', `/v1/bills/destroy/reference/${encodeURIComponent(payload.reference_code)}`).catch(() => null);
    r = await authed(cfg, 'POST', '/v2/bills/validate', payload);
  }
  if (!r.ok) throw new FactusError(errText(r.body) || `Factus respondió ${r.status}.`, r.status, r.body);
  return billOf(r.body);
}

export const factusConfigured = (p: Record<string, any> | null | undefined) => !!(p && p.provider === 'FACTUS' && p.clientId && p.clientSecretEnc && p.username && p.passwordEnc);
