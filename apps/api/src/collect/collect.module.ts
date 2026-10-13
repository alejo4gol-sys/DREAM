/**
 * Cobrar fácil: para cualquier venta con saldo pendiente (incluidos los cobros de casos u órdenes de servicio).
 * - Link de pago Wompi (tarjeta, PSE, Nequi, Bancolombia…) creado con las llaves Wompi del propio negocio.
 *   El pago aprobado llega por el webhook de Wompi (el mismo de la tienda) y se registra solo como abono de la venta.
 * - Medios propios del negocio (Nequi, Daviplata, llave Bre-B, transferencia) con su QR subido desde la app del banco.
 *   DREAMS no genera QR Bre-B: el estándar interoperable exige campos que solo emiten las entidades participantes.
 * - Mensaje de cobro listo para WhatsApp con todos los medios.
 */
import { BadRequestException, Body, Controller, Get, Injectable, Logger, Module, NotFoundException, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { IsNumberString, IsOptional, IsUUID } from 'class-validator';
import { and, desc, eq } from 'drizzle-orm';
import type { Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { CryptoService } from '../common/crypto.service';
import { D, m2 } from '../common/money';
import { Db, InjectDb } from '../db/db';
import { businesses, customers, paymentLinks, sales } from '../db/schema';
import { SalesModule, SalesService } from '../sales/sales.module';

const wompiApi = (publicKey: string) => (publicKey.startsWith('pub_test_') ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1');
const money = (v: string | number) => Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const METHOD_MAP: Record<string, string> = { CARD: 'CREDIT_CARD', NEQUI: 'NEQUI', PSE: 'PSE', BANCOLOMBIA_TRANSFER: 'BANK_TRANSFER', DAVIPLATA: 'DAVIPLATA' };

class LinkDto { @IsUUID() saleId: string; @IsOptional() @IsNumberString() amount?: string; }

@Injectable()
export class CollectService {
  private readonly logger = new Logger(CollectService.name);
  constructor(@InjectDb() private db: Db, private crypto: CryptoService, private salesSvc: SalesService) {}

  private async sale(businessId: string, saleId: string) {
    const [s] = await this.db.select({ id: sales.id, number: sales.number, total: sales.total, amountPaid: sales.amountPaid, status: sales.status, customerId: sales.customerId })
      .from(sales).where(and(eq(sales.id, saleId), eq(sales.businessId, businessId)));
    if (!s) throw new NotFoundException('Venta no encontrada');
    return s;
  }

  async options(businessId: string, saleId: string) {
    const s = await this.sale(businessId, saleId);
    const [b] = await this.db.select({ name: businesses.tradeName, cfg: businesses.storeConfig, wompi: businesses.wompiPublicKey, wompiPriv: businesses.wompiPrivateKeyEnc, slug: businesses.storeSlug })
      .from(businesses).where(eq(businesses.id, businessId));
    const [c] = s.customerId ? await this.db.select({ name: customers.name, phone: customers.phone }).from(customers).where(eq(customers.id, s.customerId)) : [];
    const balance = D(s.total).minus(s.amountPaid);
    const methods = (((b?.cfg as any)?.paymentMethods ?? []) as any[]).filter((m) => m?.enabled && !['CASH_ON_DELIVERY', 'CASH_PICKUP', 'CARD_ON_DELIVERY'].includes(m.kind))
      .map((m) => ({ kind: m.kind ?? 'OTHER', name: m.name, holder: m.accountHolder ?? '', number: m.accountNumber ?? '', bank: m.bank ?? '', type: m.accountType ?? '', document: m.documentId ?? '', link: m.link ?? '', qrImage: m.qrImage ?? '', instructions: m.instructions ?? '' }));
    const links = await this.db.select().from(paymentLinks).where(and(eq(paymentLinks.businessId, businessId), eq(paymentLinks.saleId, saleId))).orderBy(desc(paymentLinks.createdAt)).limit(5);
    const active = links.find((l) => l.status === 'ACTIVE' && D(l.amount).eq(balance));
    const lines = [
      `Hola${c?.name ? ` ${c.name.split(' ')[0]}` : ''}, te comparto el cobro de ${b?.name ?? 'tu compra'} (venta #${s.number}).`,
      `Valor a pagar: ${money(balance.toString())}`, '',
      ...(active ? [`💳 Paga en línea (tarjeta, PSE, Nequi): ${active.url}`] : []),
      ...methods.map((m) => {
        const detail = [m.bank, m.type, m.number].filter(Boolean).join(' ');
        return `• ${m.name}${detail ? `: ${detail}` : ''}${m.holder ? ` a nombre de ${m.holder}` : ''}${m.link ? ` ${m.link}` : ''}`;
      }),
      '', 'Cuando pagues, envíame el comprobante por aquí. ¡Gracias!',
    ];
    return {
      sale: { id: s.id, number: s.number, total: s.total, amountPaid: s.amountPaid, balance: m2(balance), status: s.status },
      customer: c ? { name: c.name, phone: c.phone } : null,
      wompiEnabled: !!(b?.wompi && b?.wompiPriv), wompiTest: !!b?.wompi?.startsWith('pub_test_'),
      methods, links: links.map((l) => ({ id: l.id, url: l.url, amount: l.amount, status: l.status, createdAt: l.createdAt, paidAt: l.paidAt })),
      message: lines.join('\n').replace(/\n{3,}/g, '\n\n'),
    };
  }

  async createLink(ctx: RequestContext, dto: LinkDto) {
    const s = await this.sale(ctx.businessId, dto.saleId);
    if (s.status === 'CANCELLED') throw new BadRequestException('La venta está anulada.');
    const balance = D(s.total).minus(s.amountPaid);
    const amount = dto.amount ? D(dto.amount) : balance;
    if (amount.lte(0) || amount.gt(balance)) throw new BadRequestException(`El valor debe ser mayor a 0 y máximo ${money(balance.toString())}.`);
    if (amount.lt(1500)) throw new BadRequestException('Wompi acepta cobros desde $1.500.');
    const [b] = await this.db.select({ name: businesses.tradeName, pub: businesses.wompiPublicKey, priv: businesses.wompiPrivateKeyEnc, logo: businesses.logoUrl })
      .from(businesses).where(eq(businesses.id, ctx.businessId));
    if (!b?.pub || !b.priv) throw new BadRequestException('Conecta tu cuenta de Wompi en «Mi página web → Pagos» para crear links de pago.');
    const res = await fetch(`${wompiApi(b.pub)}/payment_links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.crypto.decrypt(b.priv)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${b.name}`.slice(0, 60), description: `Pago venta #${s.number}`, single_use: true, collect_shipping: false,
        currency: 'COP', amount_in_cents: Number(amount.mul(100).toDecimalPlaces(0).toString()), sku: `DREAMS-V${s.number}`.slice(0, 36),
        ...(b.logo && /^https:\/\//.test(b.logo) ? { image_url: b.logo } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch((e) => { throw new BadRequestException(`No se pudo conectar con Wompi: ${(e as Error).message}`); });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.data?.id) throw new BadRequestException(`Wompi no creó el link: ${json?.error?.messages ? JSON.stringify(json.error.messages) : json?.error?.reason ?? res.status}`);
    const [link] = await this.db.insert(paymentLinks).values({
      businessId: ctx.businessId, saleId: s.id, provider: 'WOMPI', providerId: String(json.data.id), url: `https://checkout.wompi.co/l/${json.data.id}`,
      amount: m2(amount), description: `Pago venta #${s.number}`, createdById: ctx.userId,
    }).returning();
    return link;
  }

  async qr(businessId: string, linkId: string, res: Response) {
    const [l] = await this.db.select().from(paymentLinks).where(and(eq(paymentLinks.id, linkId), eq(paymentLinks.businessId, businessId)));
    if (!l) throw new NotFoundException();
    const png = await QRCode.toBuffer(l.url, { width: 600, margin: 2, color: { dark: '#111111', light: '#FFFFFF' } });
    res.setHeader('Content-Type', 'image/png');
    return res.send(png);
  }

  /** Evento de Wompi de un link de pago (lo entrega el webhook de la tienda). */
  async handleWompiPaymentLink(payload: any) {
    const tr = payload?.data?.transaction;
    const linkId = tr?.payment_link_id ? String(tr.payment_link_id) : null;
    if (!linkId) return { received: true };
    const [link] = await this.db.select().from(paymentLinks).where(and(eq(paymentLinks.provider, 'WOMPI'), eq(paymentLinks.providerId, linkId)));
    if (!link) return { received: true };
    const [b] = await this.db.select().from(businesses).where(eq(businesses.id, link.businessId));
    if (!b?.wompiEventSecretEnc || !b.wompiPrivateKeyEnc || !b.wompiPublicKey) throw new BadRequestException('El negocio no tiene la pasarela configurada');
    const secret = this.crypto.decrypt(b.wompiEventSecretEnc);
    const valueAt = (obj: any, path: string) => path.split('.').reduce((v, k) => v?.[k], obj);
    const signed = (payload.signature?.properties ?? []).map((p: string) => valueAt(payload.data, p));
    const expected = createHash('sha256').update(`${signed.join('')}${payload.timestamp}${secret}`).digest('hex');
    const received = String(payload.signature?.checksum ?? '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(received) || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) throw new BadRequestException('Firma de evento inválida');
    if (payload.event !== 'transaction.updated' || link.status === 'PAID') return { received: true };
    // Confirmar con Wompi antes de registrar el pago.
    const r = await fetch(`${wompiApi(b.wompiPublicKey)}/transactions/${encodeURIComponent(tr.id)}`, { headers: { Authorization: `Bearer ${this.crypto.decrypt(b.wompiPrivateKeyEnc)}` } });
    const v: any = r.ok ? (await r.json())?.data : null;
    if (!v || String(v.payment_link_id ?? '') !== linkId || v.status !== 'APPROVED') return { received: true };
    if (v.amount_in_cents !== Number(D(link.amount).mul(100).toDecimalPlaces(0).toString())) throw new BadRequestException('El valor pagado no coincide con el link');
    const [upd] = await this.db.update(paymentLinks).set({ status: 'PAID', transactionId: String(v.id), paidAt: new Date() })
      .where(and(eq(paymentLinks.id, link.id), eq(paymentLinks.status, 'ACTIVE'))).returning();
    if (upd && link.saleId) {
      try {
        await this.salesSvc.addPayment({ businessId: link.businessId, userId: link.createdById ?? '', sessionId: '', timezone: 'America/Bogota', roleKey: 'SYSTEM', permissions: new Set() } as RequestContext,
          link.saleId, { amount: m2(link.amount), method: (METHOD_MAP[v.payment_method_type] ?? 'OTHER') as any, reference: `Wompi ${v.id}` } as any);
      } catch (e) { this.logger.warn(`Pago del link ${link.id} no aplicado a la venta: ${(e as Error).message}`); }
    }
    return { received: true };
  }
}

@Controller('collect')
export class CollectController {
  constructor(private s: CollectService) {}
  @RequirePermissions('sales:read') @Get('sales/:saleId') options(@Ctx() ctx: RequestContext, @Param('saleId', ParseUUIDPipe) id: string) { return this.s.options(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('links') link(@Ctx() ctx: RequestContext, @Body() dto: LinkDto) { return this.s.createLink(ctx, dto); }
  @RequirePermissions('sales:read') @Get('links/:id/qr') qr(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { return this.s.qr(ctx.businessId, id, res); }
}

@Module({ imports: [SalesModule], controllers: [CollectController], providers: [CollectService], exports: [CollectService] })
export class CollectModule {}
