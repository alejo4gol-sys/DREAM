/**
 * Catálogo para compartir:
 * - PDF listo para enviar por WhatsApp o imprimir (portada con logo, productos con foto y precio, contacto y QR a la página).
 *   Puede salir con los precios de una lista mayorista.
 * - Excel para «Crear en lote» (Bulk Create) de Canva: una fila por producto con nombre, precio, descripción y foto.
 * - Feed público (CSV) con el formato de Meta para sincronizar el catálogo de WhatsApp Business, Facebook e Instagram
 *   desde el Administrador de ventas (Commerce Manager → Fuente de datos → Feed programado).
 */
import { Controller, Get, Injectable, Module, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { and, asc, eq, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Ctx, Public, RequestContext, RequirePermissions } from '../common/auth.guard';
import { D, m2 } from '../common/money';
import { config } from '../config';
import { Db, InjectDb } from '../db/db';
import { businesses, categories, priceListItems, priceLists, products } from '../db/schema';

class BrochureQuery {
  @IsOptional() @IsUUID() priceListId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() hidePrices?: boolean;
  @IsOptional() @IsIn(['grid', 'list']) layout?: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
}

const money = (v: string | number) => Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Imagen local (/uploads/...) como Buffer si es PNG o JPG (PDFKit no lee WebP). */
function localImage(url?: string | null): Buffer | null {
  if (!url || !url.startsWith('/uploads/')) return null;
  const rel = url.slice('/uploads/'.length);
  if (rel.includes('..')) return null;
  const file = path.resolve(config.uploadDir, rel);
  if (!file.startsWith(path.resolve(config.uploadDir)) || !existsSync(file)) return null;
  const buf = readFileSync(file);
  const png = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  return png || jpg ? buf : null;
}
/** Imagen remota https (máx. 3 MB, 6 s). */
async function remoteImage(url?: string | null): Promise<Buffer | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 3_000_000) return null;
    const png = b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    return png || (b[0] === 0xff && b[1] === 0xd8) ? b : null;
  } catch { return null; }
}
const absolute = (url?: string | null) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${config.appPublicUrl}${url.startsWith('/') ? '' : '/'}${url}`);

@Injectable()
export class BrochureService {
  constructor(@InjectDb() private db: Db) {}

  private async data(businessId: string, q: BrochureQuery) {
    const [b] = await this.db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!b) throw new NotFoundException();
    const conds = [eq(products.businessId, businessId), eq(products.isActive, true)];
    if (q.categoryId) conds.push(eq(products.categoryId, q.categoryId));
    const rows = await this.db.select({ id: products.id, sku: products.sku, name: products.name, description: products.description, price: products.salePrice, imageUrl: products.imageUrl, isService: products.isService, category: categories.name })
      .from(products).leftJoin(categories, eq(categories.id, products.categoryId)).where(and(...conds)).orderBy(asc(categories.name), asc(products.name)).limit(400);
    let list: typeof priceLists.$inferSelect | undefined;
    const special = new Map<string, { price: string; minQty: number }>();
    if (q.priceListId) {
      [list] = await this.db.select().from(priceLists).where(and(eq(priceLists.id, q.priceListId), eq(priceLists.businessId, businessId)));
      if (!list) throw new NotFoundException('Lista de precios no encontrada');
      const items = rows.length ? await this.db.select().from(priceListItems).where(and(eq(priceListItems.priceListId, list.id), inArray(priceListItems.productId, rows.map((r) => r.id)))) : [];
      for (const it of items) special.set(it.productId, { price: it.price, minQty: it.minQty });
    }
    const items = rows.map((r) => {
      const s = special.get(r.id);
      const price = list ? (s?.price ?? m2(D(r.price).mul(D(100).minus(list.discountPercent)).div(100))) : r.price;
      return { ...r, price, minQty: s?.minQty ?? 1 };
    });
    return { b, items, list };
  }

  async pdf(businessId: string, q: BrochureQuery, res: Response) {
    const { b, items, list } = await this.data(businessId, q);
    const cfg = (b.storeConfig ?? {}) as any;
    const accent = HEX.test(cfg.accentColor ?? '') ? cfg.accentColor : '#B69C72';
    const ink = HEX.test(cfg.primaryColor ?? '') ? cfg.primaryColor : '#111111';
    const url = b.storeSlug && b.storeEnabled ? `${config.appPublicUrl}/tienda/${b.storeSlug}` : null;
    const whatsapp = (cfg.whatsapp || b.phone || '').toString();
    const images = new Map<string, Buffer>();
    for (const it of items.slice(0, 120)) {
      const img = localImage(it.imageUrl) ?? (await remoteImage(it.imageUrl));
      if (img) images.set(it.id, img);
    }
    const logo = localImage(b.logoUrl) ?? (await remoteImage(b.logoUrl));
    const qr = url ? await QRCode.toBuffer(url, { width: 300, margin: 1 }) : null;
    const title = q.title?.trim() || (list ? `Catálogo ${list.name}` : 'Catálogo');

    const doc = new PDFDocument({ size: 'LETTER', margin: 40, bufferPages: true, info: { Title: `${title} · ${b.tradeName}`, Author: b.tradeName } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="catalogo-${(b.storeSlug ?? 'negocio').replace(/[^a-z0-9-]/g, '')}.pdf"`);
    doc.pipe(res);
    const W = doc.page.width; const H = doc.page.height; const M = 40;

    // Portada
    doc.rect(0, 0, W, H).fill(ink);
    doc.rect(0, H * 0.62, W, 8).fill(accent);
    if (logo) { try { doc.image(logo, W / 2 - 60, 120, { fit: [120, 120], align: 'center' }); } catch { /* imagen inválida */ } }
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(34).text(b.tradeName, M, logo ? 270 : 220, { width: W - 2 * M, align: 'center' });
    doc.fillColor(accent).font('Helvetica').fontSize(16).text(title.toUpperCase(), M, doc.y + 12, { width: W - 2 * M, align: 'center', characterSpacing: 2 });
    if (cfg.headline) doc.fillColor('#EDE4D3').fontSize(13).text(String(cfg.headline), M, doc.y + 14, { width: W - 2 * M, align: 'center' });
    doc.fillColor('#FFFFFF').fontSize(11);
    const contact = [whatsapp && `WhatsApp ${whatsapp}`, b.city, url && url.replace(/^https?:\/\//, '')].filter(Boolean).join('   ·   ');
    doc.text(contact, M, H * 0.62 + 40, { width: W - 2 * M, align: 'center' });
    if (list) doc.fillColor('#EDE4D3').fontSize(10).text(`Precios de la lista «${list.name}»${D(list.minOrderTotal).gt(0) ? ` · pedido mínimo ${money(list.minOrderTotal)}` : ''}`, M, doc.y + 8, { width: W - 2 * M, align: 'center' });
    if (qr) { doc.image(qr, W / 2 - 50, H * 0.62 + 100, { width: 100 }); doc.fillColor('#EDE4D3').fontSize(9).text('Escanea para pedir en línea', M, H * 0.62 + 206, { width: W - 2 * M, align: 'center' }); }
    doc.fillColor('#9A9285').fontSize(8).text(`Precios en pesos colombianos · ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`, M, H - 50, { width: W - 2 * M, align: 'center' });

    // Productos
    const grid = q.layout !== 'list';
    const cols = grid ? 3 : 1; const gap = 14;
    const cw = (W - 2 * M - gap * (cols - 1)) / cols;
    const ch = grid ? 220 : 90;
    let x = M; let y = 0; let col = 0; let lastCat: string | null | undefined = undefined;
    const newPage = () => {
      doc.addPage(); doc.rect(0, 0, W, 50).fill(ink);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text(b.tradeName, M, 18, { width: W / 2 });
      doc.fillColor(accent).font('Helvetica').fontSize(10).text(title, W / 2, 20, { width: W / 2 - M, align: 'right' });
      y = 66; x = M; col = 0;
    };
    newPage();
    for (const it of items) {
      if (it.category !== lastCat && it.category) {
        if (col !== 0) { y += ch + gap; col = 0; x = M; }
        if (y + 30 + ch > H - 40) newPage();
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(14).text(it.category, M, y); doc.rect(M, y + 18, 40, 2).fill(accent); y += 30;
      }
      lastCat = it.category;
      if (y + ch > H - 40) newPage();
      doc.roundedRect(x, y, cw, ch, 8).lineWidth(0.8).strokeColor('#E2D4BA').stroke();
      const img = images.get(it.id);
      if (grid) {
        if (img) { try { doc.image(img, x + 6, y + 6, { fit: [cw - 12, 120], align: 'center', valign: 'center' }); } catch { /* */ } }
        else { doc.rect(x + 6, y + 6, cw - 12, 120).fill('#F6F1E8'); doc.fillColor('#B69C72').fontSize(28).text(it.name.slice(0, 1).toUpperCase(), x, y + 50, { width: cw, align: 'center' }); }
        doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text(it.name, x + 8, y + 132, { width: cw - 16, height: 26, ellipsis: true });
        if (it.description) doc.fillColor('#6B645A').font('Helvetica').fontSize(7.5).text(it.description, x + 8, y + 158, { width: cw - 16, height: 22, ellipsis: true });
        if (!q.hidePrices) doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text(money(it.price), x + 8, y + ch - 22, { width: cw - 16 });
        if (it.minQty > 1) doc.fillColor('#8F7651').font('Helvetica').fontSize(7.5).text(`Mín. ${it.minQty} und.`, x + 8, y + ch - 22, { width: cw - 16, align: 'right' });
      } else {
        if (img) { try { doc.image(img, x + 6, y + 6, { fit: [78, 78] }); } catch { /* */ } }
        const tx = x + (img ? 96 : 12);
        doc.fillColor('#111111').font('Helvetica-Bold').fontSize(11).text(it.name, tx, y + 10, { width: cw - (tx - x) - 120, height: 30, ellipsis: true });
        if (it.description) doc.fillColor('#6B645A').font('Helvetica').fontSize(8.5).text(it.description, tx, y + 34, { width: cw - (tx - x) - 120, height: 44, ellipsis: true });
        if (!q.hidePrices) doc.fillColor(ink).font('Helvetica-Bold').fontSize(13).text(money(it.price), x + cw - 120, y + 30, { width: 110, align: 'right' });
        if (it.minQty > 1) doc.fillColor('#8F7651').font('Helvetica').fontSize(8).text(`Mín. ${it.minQty} und.`, x + cw - 120, y + 50, { width: 110, align: 'right' });
      }
      col++; x += cw + gap;
      if (col >= cols) { col = 0; x = M; y += ch + gap; }
    }
    // Pie con número de página
    const range = doc.bufferedPageRange();
    for (let i = 1; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#9A9285').font('Helvetica').fontSize(8).text(`${b.tradeName}${whatsapp ? ` · WhatsApp ${whatsapp}` : ''}${url ? ` · ${url.replace(/^https?:\/\//, '')}` : ''}   —   ${i}/${range.count - 1}`, M, H - 30, { width: W - 2 * M, align: 'center', lineBreak: false });
    }
    doc.end();
  }

  async canva(businessId: string, q: BrochureQuery, res: Response) {
    const { b, items } = await this.data(businessId, q);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Productos');
    ws.columns = [
      { header: 'Nombre', key: 'name', width: 34 }, { header: 'Precio', key: 'price', width: 16 }, { header: 'Descripcion', key: 'desc', width: 50 },
      { header: 'Categoria', key: 'cat', width: 20 }, { header: 'Codigo', key: 'sku', width: 16 }, { header: 'Imagen', key: 'img', width: 22 },
    ];
    ws.getRow(1).font = { bold: true };
    let r = 2;
    for (const it of items) {
      ws.addRow({ name: it.name, price: q.hidePrices ? '' : money(it.price), desc: it.description ?? '', cat: it.category ?? '', sku: it.sku });
      const img = localImage(it.imageUrl) ?? (await remoteImage(it.imageUrl));
      if (img) {
        const ext = img[0] === 0x89 ? 'png' : 'jpeg';
        const id = wb.addImage({ base64: img.toString('base64'), extension: ext });
        ws.getRow(r).height = 90;
        ws.addImage(id, { tl: { col: 5.05, row: r - 1 + 0.05 }, ext: { width: 110, height: 110 } });
      }
      r++;
    }
    const help = wb.addWorksheet('Cómo usarlo en Canva');
    [
      `Catálogo de ${b.tradeName} para Canva (Crear en lote / Bulk Create)`, '',
      '1. En Canva (computador) abre una plantilla de catálogo o crea tu diseño con una tarjeta de producto.',
      '2. Ve a Apps → «Crear en lote» (Bulk create) → «Subir datos» y elige este archivo.',
      '3. Conecta cada elemento del diseño con su columna: Nombre, Precio, Descripcion e Imagen.',
      '4. Toca «Continuar» y «Generar»: Canva crea una página por producto.',
      'Nota: Crear en lote está disponible en Canva Pro, Teams, Educación y ONG. Las fotos van dentro del archivo.',
    ].forEach((t, i) => { help.getCell(`A${i + 1}`).value = t; });
    help.getColumn(1).width = 110; help.getCell('A1').font = { bold: true, size: 14 };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="catalogo-canva-${(b.storeSlug ?? 'negocio').replace(/[^a-z0-9-]/g, '')}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }

  /** Feed público para Meta (Commerce Manager): solo negocios con página publicada. */
  async metaFeed(slug: string, res: Response) {
    const [b] = await this.db.select().from(businesses).where(eq(businesses.storeSlug, slug.replace(/\.csv$/, '')));
    if (!b?.storeEnabled) throw new NotFoundException('Catálogo no disponible');
    const rows = await this.db.select({ id: products.id, sku: products.sku, name: products.name, description: products.description, price: products.salePrice, imageUrl: products.imageUrl })
      .from(products).where(and(eq(products.businessId, b.id), eq(products.isActive, true))).orderBy(asc(products.name)).limit(5000);
    const esc = (v: string) => `"${v.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
    const store = `${config.appPublicUrl}/tienda/${b.storeSlug}`;
    const lines = ['id,title,description,availability,condition,price,link,image_link,brand'];
    for (const p of rows) {
      if (!p.imageUrl) continue; // Meta exige imagen
      lines.push([p.sku || p.id, p.name.slice(0, 200), (p.description || p.name).slice(0, 5000), 'in stock', 'new', `${Number(p.price).toFixed(2)} COP`, store, absolute(p.imageUrl), b.tradeName.slice(0, 100)].map((v) => esc(String(v))).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.send(lines.join('\n'));
  }

  async feedInfo(businessId: string) {
    const [b] = await this.db.select({ slug: businesses.storeSlug, enabled: businesses.storeEnabled }).from(businesses).where(eq(businesses.id, businessId));
    const [withImg] = await this.db.select({ n: products.id }).from(products).where(and(eq(products.businessId, businessId), eq(products.isActive, true))).limit(1);
    return { url: b?.slug && b.enabled ? `${config.appPublicUrl}/api/brochure/feed/${b.slug}.csv` : null, enabled: !!b?.enabled, hasProducts: !!withImg, local: /localhost|127\.0\.0\.1/.test(config.appPublicUrl) };
  }
}

@Controller('brochure')
export class BrochureController {
  constructor(private s: BrochureService) {}
  @RequirePermissions('products:read') @Get('pdf') pdf(@Ctx() ctx: RequestContext, @Query() q: BrochureQuery, @Res() res: Response) { return this.s.pdf(ctx.businessId, q, res); }
  @RequirePermissions('products:read') @Get('canva') canva(@Ctx() ctx: RequestContext, @Query() q: BrochureQuery, @Res() res: Response) { return this.s.canva(ctx.businessId, q, res); }
  @RequirePermissions('products:read') @Get('feed-info') feedInfo(@Ctx() ctx: RequestContext) { return this.s.feedInfo(ctx.businessId); }
  @Public() @Get('feed/:slug') @Throttle({ default: { limit: 30, ttl: 60_000 } }) feed(@Param('slug') slug: string, @Res() res: Response) { return this.s.metaFeed(slug, res); }
}

@Module({ controllers: [BrochureController], providers: [BrochureService] })
export class BrochureModule {}
