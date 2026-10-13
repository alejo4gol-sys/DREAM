/**
 * Cliente HTTP del frontend.
 * - El access token vive solo en memoria (no en localStorage) para reducir el impacto de un XSS.
 * - El refresh token es una cookie httpOnly que el navegador envía a /api/auth/refresh.
 * - Ante un 401 intenta renovar una vez y repite la solicitud.
 */
let accessToken: string | null = null;
let businessId: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export const session = {
  setToken(t: string | null) { accessToken = t; },
  hasToken() { return !!accessToken; },
  setBusiness(id: string | null) {
    businessId = id;
    try { id ? localStorage.setItem('dream.business', id) : localStorage.removeItem('dream.business'); } catch { /* sin almacenamiento */ }
  },
  storedBusiness(): string | null {
    try { return localStorage.getItem('dream.business'); } catch { return null; }
  },
  get businessId() { return businessId; },
  onUnauthorized(cb: () => void) { onUnauthorized = cb; },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export async function refresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) return false;
        const d = await r.json();
        accessToken = d.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => { setTimeout(() => { refreshing = null; }, 0); });
  }
  return refreshing;
}

type Opts = { method?: string; body?: unknown; raw?: boolean; noBusiness?: boolean; form?: FormData; timeoutMs?: number };

export async function api<T = any>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (businessId && !opts.noBusiness) headers['X-Business-Id'] = businessId;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = opts.timeoutMs ? new AbortController() : undefined;
  const timeout = controller ? setTimeout(() => controller.abort(), opts.timeoutMs) : undefined;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers, credentials: 'same-origin', signal: controller?.signal,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch (e) {
    if (controller?.signal.aborted) throw new ApiError(408, 'La tienda tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo.');
    throw e;
  } finally { if (timeout) clearTimeout(timeout); }

  if (res.status === 401 && !retried && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    if (await refresh()) return api<T>(path, opts, true);
    onUnauthorized?.();
  }
  if (!res.ok) {
    let msg = 'Ocurrió un error inesperado';
    let details: unknown;
    try {
      const d = await res.json();
      details = d;
      msg = Array.isArray(d.message) ? d.message[0] : d.message ?? msg;
      if (res.status === 429) msg = 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    } catch { /* respuesta sin JSON */ }
    throw new ApiError(res.status, translate(msg), details);
  }
  if (opts.raw) return res as unknown as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Traduce mensajes de validación genéricos de class-validator. */
function translate(msg: string) {
  return msg
    .replace(/property (\w+) should not exist/, 'El campo $1 no está permitido')
    .replace(/(\w+) must be a UUID/, 'Selecciona un valor válido para $1')
    .replace(/(\w+) should not be empty/, 'El campo $1 es obligatorio')
    .replace(/(\w+) must be a number string/, 'El campo $1 debe ser numérico')
    .replace(/(\w+) must be a valid ISO 8601 date string/, 'Fecha inválida en $1');
}

/** Descarga un archivo (reportes) respetando autenticación. */
export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
