/**
 * Difusión de las páginas web de los negocios:
 * - Enlace público oficial (usa APP_PUBLIC_URL: en la nube será https://su-dominio/tienda/<slug>).
 * - Código QR descargable (PNG) y afiche imprimible (SVG) con el nombre del negocio.
 * - Directorio público «Negocios en DREAMS» con buscador por nombre, ciudad y tipo de negocio.
 *   Solo aparecen páginas publicadas que no desactivaron «Aparecer en el directorio».
 */
import { BadRequestException, Controller, Get, Injectable, Module, NotFoundException, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { config } from '../config';
import { Db, InjectDb } from '../db/db';
import { businesses, products } from '../db/schema';
import { mapsQuery, ratingsFor } from '../reviews/reviews.module';

/** Grupos para filtrar el directorio. */
export const DIRECTORY_KINDS: Record<string, { label: string; match: (b: { businessModel: string; serviceProfile: string | null }) => boolean }> = {
  PRODUCTS: { label: 'Tiendas y productos', match: (b) => b.businessModel !== 'SERVICES' },
  LEGAL: { label: 'Abogados', match: (b) => b.serviceProfile === 'LEGAL' },
  BEAUTY: { label: 'Belleza y cuidado', match: (b) => b.serviceProfile === 'BEAUTY' },
  TECH_REPAIR: { label: 'Reparación y técnicos', match: (b) => b.serviceProfile === 'TECH_REPAIR' },
  HEALTH: { label: 'Salud y bienestar', match: (b) => b.serviceProfile === 'HEALTH' },
  HOME: { label: 'Hogar y mantenimiento', match: (b) => b.serviceProfile === 'HOME' },
  CONSULTING: { label: 'Asesorías', match: (b) => b.serviceProfile === 'CONSULTING' },
  EDUCATION: { label: 'Educación y clases', match: (b) => b.serviceProfile === 'EDUCATION' },
  OTHER: { label: 'Otros servicios', match: (b) => b.businessModel === 'SERVICES' && (!b.serviceProfile || b.serviceProfile === 'OTHER') },
};
const kindOf = (b: { businessModel: string; serviceProfile: string | null }) => Object.entries(DIRECTORY_KINDS).find(([, k]) => k.match(b))?.[0] ?? 'OTHER';

class DirectoryQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsIn(Object.keys(DIRECTORY_KINDS)) kind?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) page?: number;
  @IsOptional() @IsIn(['name', 'rating']) sort?: string;
}
class QrQuery { @IsOptional() @IsIn(['png', 'poster']) format?: string; }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
/** Corta el texto en líneas de máximo n caracteres (para el afiche SVG). */
function wrap(text: string, n: number, max = 3) {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, max);
}

@Injectable()
export class StoreShareService {
  constructor(@InjectDb() private db: Db) {}

  publicUrl(slug: string) { return `${config.appPublicUrl}/tienda/${slug}`; }
  get isLocal() { return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(config.appPublicUrl); }

  async share(businessId: string) {
    const [b] = await this.db.select({ name: businesses.tradeName, slug: businesses.storeSlug, enabled: businesses.storeEnabled, cfg: businesses.storeConfig, city: businesses.city })
      .from(businesses).where(eq(businesses.id, businessId));
    if (!b) throw new NotFoundException();
    return {
      name: b.name, slug: b.slug, enabled: b.enabled, url: b.slug ? this.publicUrl(b.slug) : null, local: this.isLocal,
      directoryUrl: `${config.appPublicUrl}/negocios`, inDirectory: b.enabled && (b.cfg as any)?.showInDirectory !== false,
      headline: (b.cfg as any)?.headline ?? '', city: b.city,
    };
  }

  async qr(businessId: string, format: string, res: Response) {
    const s = await this.share(businessId);
    if (!s.slug || !s.url) throw new BadRequestException('Primero elige la dirección de tu página y guárdala.');
    const file = s.slug.replace(/[^a-z0-9-]/g, '');
    if (format !== 'poster') {
      const png = await QRCode.toBuffer(s.url, { width: 1024, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#FFFFFF' } });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="qr-${file}.png"`);
      return res.send(png);
    }
    const qr = await QRCode.toDataURL(s.url, { width: 760, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#FFFFFF' } });
    const nameLines = wrap(s.name, 22, 2);
    const head = s.headline ? wrap(s.headline, 44, 2) : [];
    const shortUrl = s.url.replace(/^https?:\/\//, '');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1240" height="1754" viewBox="0 0 1240 1754">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#C8963E"/><stop offset=".5" stop-color="#D9774B"/><stop offset="1" stop-color="#C4513F"/></linearGradient></defs>
  <rect width="1240" height="1754" fill="#FBF9F5"/>
  <rect width="1240" height="430" fill="#111111"/>
  <rect y="430" width="1240" height="14" fill="url(#g)"/>
  ${nameLines.map((l, i) => `<text x="620" y="${nameLines.length === 1 ? 250 : 200 + i * 110}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="96" font-weight="700" fill="#F6F1E8">${esc(l)}</text>`).join('\n  ')}
  ${nameLines.length === 1 ? head.map((l, i) => `<text x="620" y="${330 + i * 46}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#E2D4BA">${esc(l)}</text>`).join('\n  ') : ''}
  <text x="620" y="560" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="54" font-weight="700" fill="#111111">Escanea y mira nuestro catálogo</text>
  <text x="620" y="625" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#5C564E">Haz tu pedido o reserva desde el celular</text>
  <rect x="220" y="680" width="800" height="800" rx="40" fill="#FFFFFF" stroke="#E2D4BA" stroke-width="6"/>
  <image x="240" y="700" width="760" height="760" href="${qr}" xlink:href="${qr}"/>
  <text x="620" y="1560" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#111111">${esc(shortUrl)}</text>
  <rect x="470" y="1630" width="300" height="64" rx="32" fill="#111111"/>
  <circle cx="512" cy="1662" r="10" fill="#B69C72"/>
  <text x="640" y="1674" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" letter-spacing="6" fill="#F6F1E8">DREAMS</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="afiche-${file}.svg"`);
    return res.send(svg);
  }

  async directory(q: DirectoryQuery) {
    const conds = [eq(businesses.storeEnabled, true), sql`coalesce(${businesses.storeConfig}->>'showInDirectory', 'true') <> 'false'`, sql`${businesses.storeSlug} is not null`, sql`${businesses.storeSlug} <> '__vista-previa'`];
    if (q.q?.trim()) {
      const t = `%${q.q.trim()}%`;
      conds.push(or(ilike(businesses.tradeName, t), ilike(businesses.category, t), ilike(businesses.businessType, t), sql`${businesses.storeConfig}->>'headline' ilike ${t}`)!);
    }
    if (q.city?.trim()) conds.push(ilike(businesses.city, `%${q.city.trim()}%`));
    const rows = await this.db.select({
      id: businesses.id, name: businesses.tradeName, slug: businesses.storeSlug, logoUrl: businesses.logoUrl, city: businesses.city, category: businesses.category,
      businessType: businesses.businessType, businessModel: businesses.businessModel, serviceProfile: businesses.serviceProfile,
      headline: sql<string>`${businesses.storeConfig}->>'headline'`, description: sql<string>`left(${businesses.storeConfig}->>'description', 180)`,
      accent: sql<string>`${businesses.storeConfig}->>'accentColor'`, primary: sql<string>`${businesses.storeConfig}->>'primaryColor'`,
      address: sql<string | null>`case when coalesce(${businesses.storeConfig}->>'showMap', 'true') <> 'false' then coalesce(nullif(${businesses.storeConfig}->>'pickupAddress', ''), ${businesses.address}) end`,
    }).from(businesses).where(and(...conds)).orderBy(asc(businesses.tradeName)).limit(600);
    const counts = rows.length ? await this.db.select({ b: products.businessId, n: sql<number>`count(*)::int` }).from(products)
      .where(and(inArray(products.businessId, rows.map((r) => r.id)), eq(products.isActive, true))).groupBy(products.businessId) : [];
    const countBy = new Map(counts.map((c) => [c.b, c.n]));
    const rates = await ratingsFor(this.db, rows.map((r) => r.id));
    const all = rows.map(({ id, ...r }) => {
      const dest = mapsQuery(r.address, r.city, r.name);
      return { ...r, kind: kindOf(r), kindLabel: DIRECTORY_KINDS[kindOf(r)].label, items: countBy.get(id) ?? 0, logoUrl: r.logoUrl?.startsWith('data:') ? null : r.logoUrl,
        rating: rates.get(id) ?? { avg: 0, count: 0 }, directionsUrl: r.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}` : null };
    });
    if (q.sort === 'rating') all.sort((a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count);
    const filtered = q.kind ? all.filter((r) => r.kind === q.kind) : all;
    const page = q.page ?? 1; const size = 24;
    const cities = [...new Set(all.map((r) => r.city?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es'));
    const kinds = Object.entries(DIRECTORY_KINDS).map(([key, k]) => ({ key, label: k.label, count: all.filter((r) => r.kind === key).length })).filter((k) => k.count > 0);
    return { total: filtered.length, page, pages: Math.max(1, Math.ceil(filtered.length / size)), items: filtered.slice((page - 1) * size, page * size), cities, kinds };
  }
}

@Controller('store-share')
export class StoreShareController {
  constructor(private s: StoreShareService) {}
  @RequirePermissions('business:manage') @Get('current') current(@Ctx() ctx: RequestContext) { return this.s.share(ctx.businessId); }
  @RequirePermissions('business:manage') @Get('current/qr') qr(@Ctx() ctx: RequestContext, @Query() q: QrQuery, @Res() res: Response) { return this.s.qr(ctx.businessId, q.format ?? 'png', res); }
  @Public() @Get('directory') @Throttle({ default: { limit: 60, ttl: 60_000 } }) directory(@Query() q: DirectoryQuery) { return this.s.directory(q); }
}

@Module({ controllers: [StoreShareController], providers: [StoreShareService] })
export class StoreShareModule {}
