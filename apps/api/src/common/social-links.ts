import { BadRequestException } from '@nestjs/common';

/** Redes admitidas para perfiles personales y de clientes. */
export const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'whatsapp', 'x', 'youtube', 'linkedin'] as const;

/**
 * Valida y limpia un objeto de redes sociales: solo claves conocidas, texto corto,
 * sin esquemas peligrosos (javascript:, data:). Vacíos se eliminan.
 */
export function normalizeSocialLinks(input: unknown): Record<string, string> {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Redes sociales inválidas');
  const out: Record<string, string> = {};
  for (const [k, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!(SOCIAL_KEYS as readonly string[]).includes(k)) throw new BadRequestException(`Red social no admitida: ${k}`);
    if (raw === null || raw === undefined || raw === '') continue;
    if (typeof raw !== 'string') throw new BadRequestException(`Valor inválido para ${k}`);
    const v = raw.trim();
    if (!v) continue;
    if (v.length > 200) throw new BadRequestException(`El valor de ${k} es demasiado largo`);
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) throw new BadRequestException(`Enlace no permitido en ${k}`);
    out[k] = v;
  }
  return out;
}
