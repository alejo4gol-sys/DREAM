export const money = (v: number | string | null | undefined, currency = 'COP') =>
  Number(v ?? 0).toLocaleString('es-CO', { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 });

export const compactMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000) return `$${(v / 1_000).toLocaleString('es-CO', { maximumFractionDigits: 0 })} mil`;
  return money(v);
};

export const number = (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString('es-CO');

export const date = (v: string | Date | null | undefined, withTime = false) =>
  v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime && { hour: '2-digit', minute: '2-digit' }) }) : '—';

export const relative = (v: string | Date) => {
  const diff = (Date.now() - new Date(v).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`;
  return date(v);
};

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const monthStartISO = () => todayISO().slice(0, 8) + '01';

export const CHANNELS: Record<string, string> = {
  INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', WHATSAPP: 'WhatsApp', TIKTOK: 'TikTok', WEBSITE: 'Página web',
  PHYSICAL_STORE: 'Tienda física', MARKETPLACE: 'Marketplace', OTHER: 'Otros',
};
export const METHODS: Record<string, string> = {
  CASH: 'Efectivo', BANK_TRANSFER: 'Transferencia', DEBIT_CARD: 'Tarjeta débito', CREDIT_CARD: 'Tarjeta crédito',
  PSE: 'PSE', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', OTHER: 'Otro',
};
export const SALE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: 'Pagada', tone: 'ok' }, PARTIALLY_PAID: { label: 'Abono parcial', tone: 'warn' },
  PENDING: { label: 'Pendiente', tone: 'warn' }, CANCELLED: { label: 'Anulada', tone: 'muted' },
};
export const SEGMENTS: Record<string, string> = { NEW: 'Nuevo', FREQUENT: 'Frecuente', INACTIVE: 'Inactivo', HIGH_VALUE: 'Alto valor' };
export const ROLES: Record<string, string> = { OWNER: 'Propietario', ADMIN: 'Administrador', SELLER: 'Vendedor', ACCOUNTANT: 'Contador', EMPLOYEE: 'Empleado' };
export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'sand' | 'ink';

