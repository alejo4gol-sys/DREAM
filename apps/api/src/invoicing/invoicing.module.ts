import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { and, desc, eq, gte, ilike, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { CryptoService } from '../common/crypto.service';
import { D, m2 } from '../common/money';
import { Db, InjectDb } from '../db/db';
import {
  businesses, customers, InvoiceSettings, invoiceFiles, invoiceResolutions, invoices, jobs, products, saleItems, sales,
} from '../db/schema';
import { InvoiceForPdf, InvoiceItem, invoiceTitle, renderInvoicePdf } from './invoice-pdf';
import {
  BuyerSnapshot, DOC_TYPES, DocType, FINAL_CONSUMER_ID, ID_TYPES, PAYMENT_MEANS, REGIMES, RESPONSIBILITIES, SellerSnapshot,
  bogotaParts, checkRequirements, computeCufe, nitDv, resolutionText, splitNit, warrantyUntil,
} from './invoice-rules';
import { FactusConfig, FactusError, factusBillPayload, factusConfigured, factusSendBill, factusTest } from './factus.client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

class ProviderDto {
  @IsIn(['FACTUS', 'NONE']) provider: 'FACTUS' | 'NONE';
  @IsOptional() @IsIn(['sandbox', 'production']) env?: 'sandbox' | 'production';
  @IsOptional() @IsString() @MaxLength(120) clientId?: string;
  /** Vacío = conservar el guardado. */
  @IsOptional() @IsString() @MaxLength(200) clientSecret?: string;
  @IsOptional() @IsString() @MaxLength(160) username?: string;
  @IsOptional() @IsString() @MaxLength(200) password?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) numberingRangeId?: number | null;
  @IsOptional() @IsBoolean() priceIncludesTax?: boolean;
  @IsOptional() @IsBoolean() autoSend?: boolean;
}
const HEX = /^#[0-9a-fA-F]{6}$/;

class TemplateDto {
  @IsOptional() @Matches(HEX) accentColor?: string;
  @IsOptional() @IsBoolean() showLogo?: boolean;
  @IsOptional() @IsString() @MaxLength(300) @Matches(/^(\/uploads\/[\w\-./]+)?$/) logoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(60) title?: string;
  @IsOptional() @IsString() @MaxLength(300) headerNote?: string;
  @IsOptional() @IsString() @MaxLength(600) footerNote?: string;
  @IsOptional() @IsString() @MaxLength(1500) terms?: string;
  @IsOptional() @IsString() @MaxLength(800) warrantyText?: string;
  @IsOptional() @IsString() @MaxLength(400) bankInfo?: string;
  @IsOptional() @IsBoolean() showSku?: boolean;
  @IsOptional() @IsBoolean() showReceivedBlock?: boolean;
}
class SettingsDto {
  @IsOptional() @IsIn(['NATURAL', 'JURIDICA']) personType?: 'NATURAL' | 'JURIDICA';
  @IsOptional() @IsIn(Object.keys(REGIMES)) regime?: 'RESPONSABLE_IVA' | 'NO_RESPONSABLE' | 'SIMPLE';
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsIn(Object.keys(RESPONSIBILITIES), { each: true }) responsibilities?: string[];
  @IsOptional() @Matches(/^(\d{4})?$/) ciiu?: string;
  @IsOptional() @IsIn(Object.keys(DOC_TYPES)) defaultDocType?: DocType;
  @IsOptional() @Matches(/^[A-Z0-9]{1,4}$/) internalPrefix?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) defaultWarrantyMonths?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) defaultDueDays?: number;
  @IsOptional() @IsIn(['OFF', 'MANUAL', 'SANDBOX', 'PROVIDER']) einvoiceMode?: 'OFF' | 'MANUAL' | 'SANDBOX' | 'PROVIDER';
  @IsOptional() @IsString() @MaxLength(80) providerName?: string;
  @IsOptional() @ValidateNested() @Type(() => TemplateDto) template?: TemplateDto;
  // Datos del vendedor (también se editan en Configuración)
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @Matches(/^[\d.\s]{5,15}(-\d)?$/) taxId?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
}
class ResolutionDto {
  @IsIn(['ELECTRONIC', 'CONTINGENCY']) kind: 'ELECTRONIC' | 'CONTINGENCY';
  @Matches(/^\d{6,20}$/) resolutionNumber: string;
  @Matches(DATE) resolutionDate: string;
  @IsOptional() @Matches(/^[A-Z0-9]{0,4}$/) prefix?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(999_999_999) fromNumber: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(999_999_999) toNumber: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(999_999_999) nextNumber?: number;
  @IsOptional() @Matches(DATE) validFrom?: string;
  @IsOptional() @Matches(DATE) validTo?: string;
  @IsOptional() @IsString() @Length(10, 120) technicalKey?: string;
  @IsOptional() @IsIn(['1', '2']) environment?: '1' | '2';
}
class ResolutionUpdateDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Matches(DATE) validTo?: string;
  @IsOptional() @IsString() @Length(10, 120) technicalKey?: string;
  @IsOptional() @IsIn(['1', '2']) environment?: '1' | '2';
}
class BuyerDto {
  @IsOptional() @IsBoolean() finalConsumer?: boolean;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsIn(Object.keys(ID_TYPES)) idType?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9.\-\s]{0,20}$/) idNumber?: string;
  @IsOptional() @Matches(/^\d?$/) dv?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsBoolean() saveToCustomer?: boolean;
}
class CreateInvoiceDto {
  @IsUUID() saleId: string;
  @IsIn(Object.keys(DOC_TYPES)) docType: DocType;
  @ValidateNested() @Type(() => BuyerDto) buyer: BuyerDto;
  @IsIn(['CONTADO', 'CREDITO']) paymentForm: 'CONTADO' | 'CREDITO';
  @IsOptional() @Matches(DATE) dueDate?: string;
  @IsOptional() @IsIn(Object.keys(PAYMENT_MEANS)) paymentMeans?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(120) warrantyMonths: number;
  @IsOptional() @IsString() @MaxLength(800) warrantyText?: string;
  @IsOptional() @IsString() @MaxLength(1500) notes?: string;
}
class CreditNoteDto { @IsString() @Length(5, 500) reason: string; }
class RegisterDianDto {
  @Matches(/^[a-fA-F0-9]{96}$/, { message: 'El CUFE tiene 96 caracteres (letras a-f y números).' }) cufe: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/) validatedAt?: string;
  @IsOptional() @IsString() @MaxLength(60) provider?: string;
}
class ListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['ISSUED', 'VOIDED']) status?: string;
  @IsOptional() @IsIn(['ACTIVE', 'EXPIRED']) warranty?: string;
  @IsOptional() @IsIn(['INVOICE', 'CREDIT_NOTE']) kind?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}

type Snapshot = Omit<InvoiceForPdf, 'integrityHash'>;
const toNum = (v: unknown) => Number(v ?? 0);

@Injectable()
export class InvoicingService {
  constructor(@InjectDb() private db: Db, private crypto: CryptoService) {}

  private async business(businessId: string) {
    const b = await this.db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
    if (!b) throw new NotFoundException('Negocio no encontrado');
    return b;
  }

  private sellerOf(b: Awaited<ReturnType<InvoicingService['business']>>): SellerSnapshot {
    const s: InvoiceSettings = b.invoiceSettings ?? {};
    const nit = b.taxId ? splitNit(b.taxId) : null;
    return {
      tradeName: b.tradeName, legalName: b.legalName, nit: nit?.number || null, dv: nit?.dv || null, personType: s.personType, regime: s.regime,
      responsibilities: s.responsibilities ?? [], address: b.address, city: b.city, phone: b.phone, email: b.email, ciiu: s.ciiu ?? null,
      logoUrl: s.template?.logoUrl || b.logoUrl,
    };
  }

  private publicResolution(r: typeof invoiceResolutions.$inferSelect) {
    const { technicalKeyEnc, ...rest } = r;
    return { ...rest, hasTechnicalKey: !!technicalKeyEnc, remaining: Math.max(0, r.toNumber - r.nextNumber + 1) };
  }

  async settings(businessId: string) {
    const b = await this.business(businessId);
    const s: InvoiceSettings = b.invoiceSettings ?? {};
    const res = await this.db.select().from(invoiceResolutions).where(eq(invoiceResolutions.businessId, businessId)).orderBy(desc(invoiceResolutions.createdAt));
    const seller = this.sellerOf(b);
    const active = (k: string) => res.find((r) => r.kind === k && r.active) ?? null;
    const readiness = (Object.keys(DOC_TYPES) as DocType[]).map((t) => {
      const r = t === 'INTERNAL' ? null : active(t);
      const check = checkRequirements(t, seller, { name: 'x', idType: '13', idNumber: '1', finalConsumer: true }, {
        itemCount: 1, paymentForm: 'CONTADO', ivaTotal: 0, now: new Date(), resolution: r ? { validFrom: r.validFrom, validTo: r.validTo, toNumber: r.toNumber, nextNumber: r.nextNumber } : null,
      });
      if (t === 'ELECTRONIC' && (s.einvoiceMode ?? 'OFF') === 'OFF') check.errors.push('Activa la facturación electrónica y elige cómo la vas a validar ante la DIAN.');
      return { docType: t, label: DOC_TYPES[t].label, ready: check.errors.length === 0, errors: check.errors, warnings: check.warnings };
    });
    return {
      personType: s.personType ?? 'NATURAL', regime: s.regime ?? null, responsibilities: s.responsibilities ?? [], ciiu: s.ciiu ?? '',
      defaultDocType: s.defaultDocType ?? 'INTERNAL', internalPrefix: s.internalPrefix ?? 'CV', defaultWarrantyMonths: s.defaultWarrantyMonths ?? (b.businessModel === 'SERVICES' ? 3 : 12),
      defaultDueDays: s.defaultDueDays ?? 30, einvoiceMode: s.einvoiceMode ?? 'OFF', providerName: s.providerName ?? '',
      template: { accentColor: '#1F2937', showLogo: true, showSku: true, showReceivedBlock: false, ...(s.template ?? {}) },
      seller: { ...seller, taxIdRaw: b.taxId, tradeName: b.tradeName, businessLogoUrl: b.logoUrl, businessModel: b.businessModel },
      resolutions: res.map((r) => this.publicResolution(r)), readiness,
      catalogs: { idTypes: ID_TYPES, regimes: REGIMES, responsibilities: RESPONSIBILITIES, paymentMeans: Object.fromEntries(Object.entries(PAYMENT_MEANS).map(([k, v]) => [k, v.label])), docTypes: DOC_TYPES },
    };
  }

  async saveSettings(businessId: string, dto: SettingsDto) {
    const b = await this.business(businessId);
    const { legalName, taxId, address, city, phone, email, template, ...rest } = dto;
    const next: InvoiceSettings = { ...(b.invoiceSettings ?? {}) };
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) (next as any)[k] = v;
    if (template) next.template = { ...(next.template ?? {}), ...template };
    if (next.regime === 'SIMPLE' && !(next.responsibilities ?? []).includes('O-47')) next.responsibilities = [...(next.responsibilities ?? []), 'O-47'];
    const biz: Record<string, unknown> = { invoiceSettings: next };
    if (legalName !== undefined) biz.legalName = legalName.trim() || null;
    if (taxId !== undefined) {
      const n = splitNit(taxId);
      if (n.number && /-\d$/.test(taxId.trim()) && nitDv(n.number) !== n.dv) throw new BadRequestException(`El dígito de verificación del NIT no corresponde: para ${n.number} es ${nitDv(n.number)}.`);
      biz.taxId = n.number ? `${n.number}-${n.dv}` : null;
    }
    if (address !== undefined) biz.address = address.trim() || null;
    if (city !== undefined) biz.city = city.trim() || null;
    if (phone !== undefined) biz.phone = phone.trim() || null;
    if (email !== undefined) biz.email = email.trim() || null;
    await this.db.update(businesses).set(biz).where(eq(businesses.id, businessId));
    return this.settings(businessId);
  }

  async addResolution(businessId: string, dto: ResolutionDto) {
    if (dto.toNumber < dto.fromNumber) throw new BadRequestException('El número final debe ser mayor o igual al inicial.');
    const next = dto.nextNumber ?? dto.fromNumber;
    if (next < dto.fromNumber || next > dto.toNumber) throw new BadRequestException('El próximo número debe estar dentro del rango autorizado.');
    if (dto.validFrom && dto.validTo && dto.validTo < dto.validFrom) throw new BadRequestException('La vigencia final es anterior a la inicial.');
    if (dto.kind === 'ELECTRONIC' && !dto.technicalKey) throw new BadRequestException('La clave técnica es obligatoria para la numeración electrónica (la ves en el portal de la DIAN junto a la resolución).');
    await this.db.transaction(async (tx) => {
      await tx.update(invoiceResolutions).set({ active: false }).where(and(eq(invoiceResolutions.businessId, businessId), eq(invoiceResolutions.kind, dto.kind)));
      await tx.insert(invoiceResolutions).values({
        businessId, kind: dto.kind, resolutionNumber: dto.resolutionNumber, resolutionDate: dto.resolutionDate, prefix: dto.prefix || null,
        fromNumber: dto.fromNumber, toNumber: dto.toNumber, nextNumber: next, validFrom: dto.validFrom ?? dto.resolutionDate, validTo: dto.validTo ?? null,
        technicalKeyEnc: dto.technicalKey ? this.crypto.encrypt(dto.technicalKey.trim()) : null, environment: dto.environment ?? '1', active: true,
      });
    });
    return this.settings(businessId);
  }

  async updateResolution(businessId: string, id: string, dto: ResolutionUpdateDto) {
    const [r] = await this.db.select().from(invoiceResolutions).where(and(eq(invoiceResolutions.id, id), eq(invoiceResolutions.businessId, businessId)));
    if (!r) throw new NotFoundException('Numeración no encontrada');
    await this.db.transaction(async (tx) => {
      if (dto.active) await tx.update(invoiceResolutions).set({ active: false }).where(and(eq(invoiceResolutions.businessId, businessId), eq(invoiceResolutions.kind, r.kind)));
      await tx.update(invoiceResolutions).set({
        ...(dto.active !== undefined ? { active: dto.active } : {}), ...(dto.validTo ? { validTo: dto.validTo } : {}), ...(dto.environment ? { environment: dto.environment } : {}),
        ...(dto.technicalKey ? { technicalKeyEnc: this.crypto.encrypt(dto.technicalKey.trim()) } : {}),
      }).where(eq(invoiceResolutions.id, id));
    });
    return this.settings(businessId);
  }

  private async loadSale(businessId: string, saleId: string) {
    const s = await this.db.query.sales.findFirst({ where: and(eq(sales.id, saleId), eq(sales.businessId, businessId)), with: { items: true, customer: true } });
    if (!s) throw new NotFoundException('Venta no encontrada');
    const ids = s.items.map((i) => i.productId);
    const prods = ids.length ? await this.db.select({ id: products.id, sku: products.sku, isService: products.isService }).from(products).where(inArray(products.id, ids)) : [];
    const job = await this.db.query.jobs.findFirst({ where: and(eq(jobs.saleId, saleId), eq(jobs.businessId, businessId)), columns: { warrantyDays: true, number: true, title: true } });
    return { sale: s, prods: new Map(prods.map((p) => [p.id, p])), job };
  }

  private itemsOf(sale: Awaited<ReturnType<InvoicingService['loadSale']>>['sale'], prods: Map<string, { sku: string; isService: boolean }>) {
    const items: InvoiceItem[] = sale.items.map((i) => {
      const gross = D(i.unitPrice).mul(i.quantity);
      const base = gross.minus(i.discount);
      return {
        code: prods.get(i.productId)?.sku ?? null, description: i.description, quantity: i.quantity, unit: prods.get(i.productId)?.isService ? 'Servicio' : 'Unidad',
        unitPrice: toNum(i.unitPrice), discount: toNum(i.discount), taxRate: toNum(i.taxRate), tax: toNum(i.lineTax), base: Number(base.toDecimalPlaces(2)), total: toNum(i.lineTotal),
      };
    });
    const byRate = new Map<number, { rate: number; base: number; tax: number }>();
    for (const it of items) {
      const g = byRate.get(it.taxRate) ?? { rate: it.taxRate, base: 0, tax: 0 };
      g.base = Number(D(g.base).plus(it.base)); g.tax = Number(D(g.tax).plus(it.tax));
      byRate.set(it.taxRate, g);
    }
    return { items, taxes: [...byRate.values()].sort((a, b) => b.rate - a.rate) };
  }

  /** Datos sugeridos para facturar una venta, más los requisitos que faltan por tipo de documento. */
  async prepare(businessId: string, saleId: string) {
    const st = await this.settings(businessId);
    const { sale, prods, job } = await this.loadSale(businessId, saleId);
    const existing = await this.db.select({ id: invoices.id, fullNumber: invoices.fullNumber, docType: invoices.docType, status: invoices.status, kind: invoices.kind })
      .from(invoices).where(and(eq(invoices.businessId, businessId), eq(invoices.saleId, saleId))).orderBy(desc(invoices.createdAt));
    const c = sale.customer;
    const cNit = c?.taxId ? splitNit(c.taxId) : null;
    const isNit = !!c?.taxId && /-\d$/.test(c.taxId.trim());
    const { items, taxes } = this.itemsOf(sale, prods);
    const warrantyMonths = job ? Math.round((job.warrantyDays ?? 0) / 30) : st.defaultWarrantyMonths;
    const due = new Date(); due.setDate(due.getDate() + st.defaultDueDays);
    return {
      sale: { id: sale.id, number: sale.number, date: sale.date, status: sale.status, total: sale.total, amountPaid: sale.amountPaid, paymentMethod: sale.paymentMethod, cancelled: sale.status === 'CANCELLED' },
      existing, items, taxes, settings: { defaultDocType: st.defaultDocType, einvoiceMode: st.einvoiceMode, regime: st.regime }, readiness: st.readiness,
      defaults: {
        docType: st.defaultDocType,
        buyer: c ? { finalConsumer: !c.taxId, name: c.name, idType: isNit ? '31' : '13', idNumber: cNit?.number ?? '', dv: isNit ? cNit?.dv ?? '' : '', address: '', city: c.city ?? '', email: c.email ?? '', phone: c.phone ?? '' }
          : { finalConsumer: true, name: '', idType: '13', idNumber: '', dv: '', address: '', city: '', email: '', phone: '' },
        paymentForm: sale.status === 'PAID' ? 'CONTADO' : 'CREDITO', dueDate: sale.status === 'PAID' ? null : due.toISOString().slice(0, 10),
        paymentMeans: sale.paymentMethod, warrantyMonths, warrantyText: job ? `Garantía del servicio de la orden #${job.number}.` : '',
      },
    };
  }

  private hash(snap: Snapshot) {
    return createHash('sha256').update(JSON.stringify(snap)).digest('hex');
  }

  async create(ctx: RequestContext, dto: CreateInvoiceDto) {
    const b = await this.business(ctx.businessId);
    const st: InvoiceSettings = b.invoiceSettings ?? {};
    const seller = this.sellerOf(b);
    const { sale, prods } = await this.loadSale(ctx.businessId, dto.saleId);
    if (sale.status === 'CANCELLED') throw new BadRequestException('La venta está anulada: no se puede facturar.');
    const { items, taxes } = this.itemsOf(sale, prods);
    const finalConsumer = !!dto.buyer.finalConsumer || !dto.buyer.idNumber?.trim();
    const idNumber = finalConsumer ? FINAL_CONSUMER_ID : dto.buyer.idNumber!.replace(/[^\dA-Za-z]/g, '');
    const buyer: BuyerSnapshot = {
      finalConsumer, name: finalConsumer ? (dto.buyer.name?.trim() || 'Consumidor final') : (dto.buyer.name ?? '').trim(),
      idType: finalConsumer ? '13' : dto.buyer.idType ?? '13', idNumber,
      dv: !finalConsumer && dto.buyer.idType === '31' ? (dto.buyer.dv || nitDv(idNumber)) : null,
      address: dto.buyer.address?.trim() || null, city: dto.buyer.city?.trim() || null, email: dto.buyer.email?.trim() || null, phone: dto.buyer.phone?.trim() || null,
    };
    const dueDate = dto.paymentForm === 'CREDITO' && dto.dueDate ? new Date(`${dto.dueDate}T12:00:00-05:00`) : null;
    if (dto.docType === 'ELECTRONIC' && (st.einvoiceMode ?? 'OFF') === 'OFF') throw new BadRequestException('La facturación electrónica no está activa. Configúrala en Facturación → Ajustes.');

    const created = await this.db.transaction(async (tx) => {
      await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, ctx.businessId)).for('update');
      const [dup] = await tx.select({ n: invoices.fullNumber }).from(invoices)
        .where(and(eq(invoices.businessId, ctx.businessId), eq(invoices.saleId, sale.id), eq(invoices.kind, 'INVOICE'), eq(invoices.status, 'ISSUED'))).limit(1);
      if (dup) throw new ConflictException(`Esta venta ya tiene la factura ${dup.n}. Si necesitas corregirla, anúlala con una nota crédito y expide una nueva.`);
      let resolution: typeof invoiceResolutions.$inferSelect | undefined;
      let prefix: string | null; let number: number;
      if (dto.docType === 'INTERNAL') {
        prefix = st.internalPrefix ?? 'CV';
        const [r] = await tx.select({ n: sql<number>`coalesce(max(${invoices.number}), 0)::int + 1` }).from(invoices)
          .where(and(eq(invoices.businessId, ctx.businessId), eq(invoices.docType, 'INTERNAL'), eq(invoices.kind, 'INVOICE'), eq(invoices.prefix, prefix)));
        number = r.n;
      } else {
        [resolution] = await tx.select().from(invoiceResolutions)
          .where(and(eq(invoiceResolutions.businessId, ctx.businessId), eq(invoiceResolutions.kind, dto.docType), eq(invoiceResolutions.active, true))).for('update').limit(1);
        prefix = resolution?.prefix ?? null; number = resolution?.nextNumber ?? 0;
      }
      const now = new Date();
      const ivaTotal = taxes.reduce((a, x) => a + x.tax, 0);
      const check = checkRequirements(dto.docType, seller, buyer, {
        itemCount: items.length, paymentForm: dto.paymentForm, dueDate, ivaTotal, now,
        resolution: resolution ? { validFrom: resolution.validFrom, validTo: resolution.validTo, toNumber: resolution.toNumber, nextNumber: resolution.nextNumber } : null,
      });
      if (check.errors.length) throw new BadRequestException(check.errors.join(' · '));
      if (resolution) await tx.update(invoiceResolutions).set({ nextNumber: resolution.nextNumber + 1 }).where(eq(invoiceResolutions.id, resolution.id));
      const fullNumber = `${prefix ?? ''}${number}`;
      const total = toNum(sale.total);
      const template = { ...(st.template ?? {}) };
      const wMonths = dto.warrantyMonths ?? 0;
      const snap: Snapshot = {
        kind: 'INVOICE', docType: dto.docType, fullNumber, issuedAt: now, dueDate, paymentForm: dto.paymentForm, paymentMeans: dto.paymentForm === 'CONTADO' ? (dto.paymentMeans ?? sale.paymentMethod) : null,
        seller, buyer, items, taxes, subtotal: toNum(sale.subtotal) - toNum(sale.discountTotal), discountTotal: toNum(sale.discountTotal), taxTotal: toNum(sale.taxTotal), total,
        amountPaid: toNum(sale.amountPaid), notes: dto.notes?.trim() || null, warrantyMonths: wMonths, warrantyUntil: warrantyUntil(now, wMonths),
        warrantyText: dto.warrantyText?.trim() || template.warrantyText || null, template,
        resolutionText: resolution ? resolutionText(resolution, dto.docType === 'ELECTRONIC') : null, status: 'ISSUED', dianStatus: dto.docType === 'ELECTRONIC' ? 'PENDING' : 'NOT_APPLICABLE',
      };
      let cufe: string | null = null; let dianStatus = snap.dianStatus; let dianMessage: string | null = null; let provider: string | null = null; let env: string | null = null;
      if (dto.docType === 'ELECTRONIC') {
        const mode = st.einvoiceMode ?? 'OFF';
        if (mode === 'SANDBOX') {
          const p = bogotaParts(now);
          const key = resolution?.technicalKeyEnc ? this.crypto.decrypt(resolution.technicalKeyEnc) : 'SIMULACION';
          cufe = computeCufe({ number: fullNumber, date: p.date, time: p.time, subtotal: snap.subtotal, iva: snap.taxTotal, total, sellerNit: seller.nit ?? '', buyerId: buyer.idNumber, technicalKey: key, environment: '2' });
          dianStatus = 'SIMULATED'; env = '2'; provider = 'Simulación DREAMS (sin envío a la DIAN)';
          dianMessage = 'Modo de pruebas: el CUFE se calculó con el algoritmo de la DIAN, pero la factura NO se envió ni fue validada. No tiene validez fiscal.';
        } else if (mode === 'MANUAL') {
          provider = st.providerName || 'Facturación gratuita DIAN';
          dianMessage = `Expídela con el mismo número (${fullNumber}) en ${provider} y registra aquí el CUFE y los archivos que te entregue la DIAN.`;
        } else if (mode === 'PROVIDER') {
          provider = st.providerName || 'Proveedor tecnológico';
          dianMessage = factusConfigured(b.einvoiceProvider) ? 'Lista para enviar a la DIAN por medio de Factus.'
            : 'El envío automático a la DIAN requiere conectar un proveedor tecnológico autorizado (Facturación → Ajustes → Proveedor). Mientras tanto, registra aquí el CUFE que te entregue tu proveedor.';
        }
      }
      const full = { ...snap, cufe, dianStatus, dianEnvironment: env, dianProvider: provider };
      const integrityHash = this.hash(full);
      const [inv] = await tx.insert(invoices).values({
        businessId: ctx.businessId, saleId: sale.id, customerId: sale.customerId, kind: 'INVOICE', docType: dto.docType, resolutionId: resolution?.id ?? null,
        prefix, number, fullNumber, issuedAt: now, dueDate, paymentForm: dto.paymentForm, paymentMeans: snap.paymentMeans, seller, buyer, items, taxes,
        subtotal: m2(snap.subtotal), discountTotal: m2(snap.discountTotal), taxTotal: m2(snap.taxTotal), total: m2(total), amountPaid: m2(snap.amountPaid),
        notes: snap.notes, warrantyMonths: wMonths, warrantyUntil: snap.warrantyUntil, warrantyText: snap.warrantyText, template, resolutionText: snap.resolutionText,
        status: 'ISSUED', dianStatus, cufe, dianEnvironment: env, dianMessage, dianProvider: provider, integrityHash, createdById: ctx.userId,
      }).returning({ id: invoices.id });
      await tx.update(sales).set({ einvoiceStatus: dto.docType === 'ELECTRONIC' ? dianStatus : dto.docType, einvoiceRef: fullNumber }).where(eq(sales.id, sale.id));
      if (dto.buyer.saveToCustomer && sale.customerId && !finalConsumer) {
        await tx.update(customers).set({
          taxId: buyer.idType === '31' ? `${buyer.idNumber}-${buyer.dv}` : buyer.idNumber, ...(buyer.email ? { email: buyer.email } : {}), ...(buyer.city ? { city: buyer.city } : {}),
        }).where(and(eq(customers.id, sale.customerId), eq(customers.businessId, ctx.businessId)));
      }
      return { id: inv.id, warnings: check.warnings };
    });
    const prov = b.einvoiceProvider ?? {};
    if (dto.docType === 'ELECTRONIC' && (st.einvoiceMode ?? 'OFF') === 'PROVIDER' && factusConfigured(prov) && prov.autoSend !== false) {
      await this.sendToProvider(ctx.businessId, created.id).catch(() => null); // el error queda guardado en la factura
    }
    return { ...(await this.get(ctx.businessId, created.id)), warnings: created.warnings };
  }

  async creditNote(ctx: RequestContext, id: string, dto: CreditNoteDto) {
    const inv = await this.get(ctx.businessId, id);
    if (inv.kind !== 'INVOICE') throw new BadRequestException('Solo se pueden anular facturas.');
    if (inv.status === 'VOIDED') throw new BadRequestException('Esta factura ya está anulada.');
    const b = await this.business(ctx.businessId);
    const st: InvoiceSettings = b.invoiceSettings ?? {};
    const result = await this.db.transaction(async (tx) => {
      await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, ctx.businessId)).for('update');
      const prefix = 'NC';
      const [r] = await tx.select({ n: sql<number>`coalesce(max(${invoices.number}), 0)::int + 1` }).from(invoices)
        .where(and(eq(invoices.businessId, ctx.businessId), eq(invoices.kind, 'CREDIT_NOTE'), eq(invoices.prefix, prefix)));
      const fullNumber = `${prefix}${r.n}`;
      const now = new Date();
      let cufe: string | null = null; let dianStatus = inv.docType === 'ELECTRONIC' ? 'PENDING' : 'NOT_APPLICABLE'; let env: string | null = null; let dianMessage: string | null = null;
      if (inv.docType === 'ELECTRONIC') {
        if (inv.dianStatus === 'SIMULATED' || st.einvoiceMode === 'SANDBOX') {
          const p = bogotaParts(now);
          cufe = computeCufe({ number: fullNumber, date: p.date, time: p.time, subtotal: inv.subtotal, iva: inv.taxTotal, total: inv.total, sellerNit: (inv.seller as SellerSnapshot).nit ?? '', buyerId: (inv.buyer as BuyerSnapshot).idNumber, technicalKey: 'SIMULACION', environment: '2' });
          dianStatus = 'SIMULATED'; env = '2'; dianMessage = 'Nota crédito simulada: no se envió a la DIAN.';
        } else dianMessage = 'Expide la nota crédito electrónica en tu proveedor o en la solución gratuita de la DIAN y registra aquí su CUDE.';
      }
      const snap = {
        kind: 'CREDIT_NOTE', docType: inv.docType, fullNumber, issuedAt: now, paymentForm: inv.paymentForm, seller: inv.seller, buyer: inv.buyer, items: inv.items, taxes: inv.taxes,
        subtotal: inv.subtotal, discountTotal: inv.discountTotal, taxTotal: inv.taxTotal, total: inv.total, relatedNumber: inv.fullNumber, voidReason: dto.reason, cufe, dianStatus,
      };
      const [nc] = await tx.insert(invoices).values({
        businessId: ctx.businessId, saleId: inv.saleId, customerId: inv.customerId, kind: 'CREDIT_NOTE', docType: inv.docType, prefix, number: r.n, fullNumber, issuedAt: now,
        paymentForm: inv.paymentForm, seller: inv.seller, buyer: inv.buyer, items: inv.items, taxes: inv.taxes, subtotal: m2(inv.subtotal), discountTotal: m2(inv.discountTotal),
        taxTotal: m2(inv.taxTotal), total: m2(inv.total), amountPaid: '0', template: inv.template, voidReason: dto.reason.trim(), relatedInvoiceId: inv.id, status: 'ISSUED',
        dianStatus, cufe, dianEnvironment: env, dianMessage, dianProvider: inv.dianProvider, integrityHash: createHash('sha256').update(JSON.stringify(snap)).digest('hex'), createdById: ctx.userId,
      }).returning({ id: invoices.id });
      await tx.update(invoices).set({ status: 'VOIDED', voidedAt: now, voidReason: `${dto.reason.trim()} (nota crédito ${fullNumber})`, relatedInvoiceId: nc.id })
        .where(and(eq(invoices.id, inv.id), eq(invoices.businessId, ctx.businessId)));
      if (inv.saleId) await tx.update(sales).set({ einvoiceStatus: 'VOIDED', einvoiceRef: fullNumber }).where(eq(sales.id, inv.saleId));
      return nc.id;
    });
    return this.get(ctx.businessId, result);
  }

  async registerDian(ctx: RequestContext, id: string, dto: RegisterDianDto) {
    const inv = await this.get(ctx.businessId, id);
    if (inv.docType !== 'ELECTRONIC') throw new BadRequestException('Este documento no es electrónico.');
    if (inv.dianStatus === 'ACCEPTED') throw new BadRequestException('Esta factura ya tiene registrada la validación de la DIAN.');
    const validatedAt = dto.validatedAt ? new Date(dto.validatedAt.length === 10 ? `${dto.validatedAt}T12:00:00-05:00` : `${dto.validatedAt}:00-05:00`) : new Date();
    await this.db.update(invoices).set({
      cufe: dto.cufe.toLowerCase(), dianStatus: 'ACCEPTED', dianEnvironment: '1', dianValidatedAt: validatedAt, dianProvider: dto.provider?.trim() || inv.dianProvider || 'Facturación gratuita DIAN',
      dianMessage: 'Validación registrada manualmente con el CUFE entregado por la DIAN.',
    }).where(and(eq(invoices.id, id), eq(invoices.businessId, ctx.businessId)));
    if (inv.saleId && inv.kind === 'INVOICE') await this.db.update(sales).set({ einvoiceStatus: 'ACCEPTED' }).where(eq(sales.id, inv.saleId));
    return this.get(ctx.businessId, id);
  }

  async addFile(ctx: RequestContext, id: string, file?: Express.Multer.File) {
    const inv = await this.get(ctx.businessId, id);
    if (!file) throw new BadRequestException('Adjunta el archivo PDF, XML o ZIP de la DIAN.');
    const head = file.buffer.subarray(0, 64).toString('latin1').trimStart();
    const kind = head.startsWith('%PDF-') ? 'PDF' : head.startsWith('<') ? 'XML' : file.buffer.subarray(0, 2).toString('latin1') === 'PK' ? 'ZIP' : null;
    if (!kind) throw new BadRequestException('Formato no permitido. Usa PDF, XML o ZIP.');
    if (inv.files.length >= 6) throw new BadRequestException('Esta factura ya tiene el máximo de archivos (6).');
    const mime = kind === 'PDF' ? 'application/pdf' : kind === 'XML' ? 'application/xml' : 'application/zip';
    const filename = (file.originalname || `${inv.fullNumber}.${kind.toLowerCase()}`).replace(/[^\w.\-]+/g, '_').slice(0, 150);
    await this.db.insert(invoiceFiles).values({ invoiceId: id, businessId: ctx.businessId, kind, filename, mime, size: file.size, content: file.buffer });
    return this.get(ctx.businessId, id);
  }

  async file(businessId: string, id: string, fileId: string) {
    const [f] = await this.db.select().from(invoiceFiles).where(and(eq(invoiceFiles.id, fileId), eq(invoiceFiles.invoiceId, id), eq(invoiceFiles.businessId, businessId)));
    if (!f) throw new NotFoundException('Archivo no encontrado');
    return f;
  }

  async list(businessId: string, q: ListQuery) {
    const term = q.q?.trim();
    const now = new Date();
    const conds = [eq(invoices.businessId, businessId)];
    if (term) conds.push(or(ilike(invoices.fullNumber, `%${term}%`), sql`${invoices.buyer}->>'name' ilike ${'%' + term + '%'}`, sql`${invoices.buyer}->>'idNumber' ilike ${'%' + term + '%'}`,
      sql`${invoices.buyer}->>'phone' ilike ${'%' + term + '%'}`, sql`${invoices.items}::text ilike ${'%' + term + '%'}`)!);
    if (q.status) conds.push(eq(invoices.status, q.status));
    if (q.kind) conds.push(eq(invoices.kind, q.kind));
    if (q.customerId) conds.push(eq(invoices.customerId, q.customerId));
    if (q.warranty === 'ACTIVE') conds.push(isNotNull(invoices.warrantyUntil), gte(invoices.warrantyUntil, now), eq(invoices.status, 'ISSUED'));
    if (q.warranty === 'EXPIRED') conds.push(isNotNull(invoices.warrantyUntil), lt(invoices.warrantyUntil, now));
    if (q.from) conds.push(gte(invoices.issuedAt, new Date(`${q.from}T00:00:00-05:00`)));
    if (q.to) conds.push(lt(invoices.issuedAt, new Date(new Date(`${q.to}T00:00:00-05:00`).getTime() + 86400_000)));
    const rows = await this.db.select({
      id: invoices.id, kind: invoices.kind, docType: invoices.docType, fullNumber: invoices.fullNumber, issuedAt: invoices.issuedAt, total: invoices.total, status: invoices.status,
      dianStatus: invoices.dianStatus, buyer: invoices.buyer, warrantyUntil: invoices.warrantyUntil, saleId: invoices.saleId, saleNumber: sales.number, paymentForm: invoices.paymentForm,
    }).from(invoices).leftJoin(sales, eq(sales.id, invoices.saleId)).where(and(...conds)).orderBy(desc(invoices.issuedAt)).limit(200);
    const [sum] = await this.db.select({
      count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(case when ${invoices.kind} = 'INVOICE' and ${invoices.status} = 'ISSUED' then ${invoices.total} else 0 end), 0)`,
      pendingDian: sql<number>`count(*) filter (where ${invoices.dianStatus} = 'PENDING')::int`,
      activeWarranty: sql<number>`count(*) filter (where ${invoices.warrantyUntil} >= now() and ${invoices.status} = 'ISSUED')::int`,
    }).from(invoices).where(eq(invoices.businessId, businessId));
    return { items: rows.map((r) => ({ ...r, buyerName: (r.buyer as BuyerSnapshot).name, buyerId: (r.buyer as BuyerSnapshot).idNumber, buyer: undefined })), summary: sum };
  }

  async get(businessId: string, id: string) {
    const [inv] = await this.db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.businessId, businessId)));
    if (!inv) throw new NotFoundException('Factura no encontrada');
    const files = await this.db.select({ id: invoiceFiles.id, kind: invoiceFiles.kind, filename: invoiceFiles.filename, size: invoiceFiles.size, createdAt: invoiceFiles.createdAt })
      .from(invoiceFiles).where(eq(invoiceFiles.invoiceId, id));
    const related = inv.relatedInvoiceId ? await this.db.select({ id: invoices.id, fullNumber: invoices.fullNumber, kind: invoices.kind }).from(invoices)
      .where(and(eq(invoices.id, inv.relatedInvoiceId), eq(invoices.businessId, businessId))).then((r) => r[0] ?? null) : null;
    const sale = inv.saleId ? await this.db.select({ id: sales.id, number: sales.number, status: sales.status }).from(sales).where(eq(sales.id, inv.saleId)).then((r) => r[0] ?? null) : null;
    const nums = { subtotal: toNum(inv.subtotal), discountTotal: toNum(inv.discountTotal), taxTotal: toNum(inv.taxTotal), total: toNum(inv.total), amountPaid: toNum(inv.amountPaid) };
    return {
      ...inv, ...nums, files, related, sale, title: invoiceTitle({ kind: inv.kind, docType: inv.docType as DocType, template: inv.template as any }),
      warrantyActive: !!inv.warrantyUntil && inv.warrantyUntil >= new Date() && inv.status === 'ISSUED',
    };
  }

  async pdf(businessId: string, id: string) {
    const inv = await this.get(businessId, id);
    const buf = await renderInvoicePdf({
      ...(inv as any), docType: inv.docType as DocType, seller: inv.seller as SellerSnapshot, buyer: inv.buyer as BuyerSnapshot, items: inv.items as InvoiceItem[],
      taxes: inv.taxes as any, template: (inv.template ?? {}) as any, relatedNumber: inv.related?.fullNumber ?? null,
    });
    return { buf, filename: `${inv.kind === 'CREDIT_NOTE' ? 'nota-credito' : 'factura'}-${inv.fullNumber}.pdf` };
  }

  // ---------- Proveedor tecnológico (Factus) ----------
  private factusCfg(p: Record<string, any>): FactusConfig {
    return { env: p.env === 'production' ? 'production' : 'sandbox', clientId: p.clientId, clientSecret: this.crypto.decrypt(p.clientSecretEnc), username: p.username,
      password: this.crypto.decrypt(p.passwordEnc), numberingRangeId: p.numberingRangeId ?? null, priceIncludesTax: !!p.priceIncludesTax };
  }

  async provider(businessId: string) {
    const b = await this.business(businessId);
    const p = b.einvoiceProvider ?? {};
    return {
      provider: p.provider ?? 'NONE', env: p.env ?? 'sandbox', clientId: p.clientId ?? '', username: p.username ?? '', hasSecret: !!p.clientSecretEnc, hasPassword: !!p.passwordEnc,
      numberingRangeId: p.numberingRangeId ?? null, priceIncludesTax: !!p.priceIncludesTax, autoSend: p.autoSend !== false, configured: factusConfigured(p),
      lastTest: p.lastTest ?? null, mode: (b.invoiceSettings ?? {}).einvoiceMode ?? 'OFF',
    };
  }

  async saveProvider(businessId: string, dto: ProviderDto) {
    const b = await this.business(businessId);
    const cur = b.einvoiceProvider ?? {};
    const next: Record<string, any> = dto.provider === 'NONE' ? {} : {
      ...cur, provider: 'FACTUS', env: dto.env ?? cur.env ?? 'sandbox', clientId: dto.clientId?.trim() ?? cur.clientId, username: dto.username?.trim() ?? cur.username,
      numberingRangeId: dto.numberingRangeId === undefined ? cur.numberingRangeId ?? null : dto.numberingRangeId,
      priceIncludesTax: dto.priceIncludesTax ?? cur.priceIncludesTax ?? false, autoSend: dto.autoSend ?? cur.autoSend ?? true,
      ...(dto.clientSecret?.trim() ? { clientSecretEnc: this.crypto.encrypt(dto.clientSecret.trim()) } : {}),
      ...(dto.password ? { passwordEnc: this.crypto.encrypt(dto.password) } : {}),
    };
    if (dto.provider !== 'NONE' && (dto.env && dto.env !== cur.env)) delete next.lastTest;
    await this.db.update(businesses).set({ einvoiceProvider: next }).where(eq(businesses.id, businessId));
    if (dto.provider === 'FACTUS') {
      const s: InvoiceSettings = b.invoiceSettings ?? {};
      await this.db.update(businesses).set({ invoiceSettings: { ...s, einvoiceMode: 'PROVIDER', providerName: `Factus${next.env === 'production' ? '' : ' (pruebas)'}` } }).where(eq(businesses.id, businessId));
    }
    return this.provider(businessId);
  }

  async testProvider(businessId: string) {
    const b = await this.business(businessId);
    const p = b.einvoiceProvider ?? {};
    if (!factusConfigured(p)) throw new BadRequestException('Completa las credenciales de Factus y guárdalas.');
    let lastTest: Record<string, any>;
    try {
      const r = await factusTest(this.factusCfg(p));
      lastTest = { at: new Date().toISOString(), ok: true, message: 'Conexión exitosa con Factus.', ranges: r.ranges };
    } catch (e: any) {
      lastTest = { at: new Date().toISOString(), ok: false, message: e?.message ?? 'Error' };
    }
    await this.db.update(businesses).set({ einvoiceProvider: { ...p, lastTest } }).where(eq(businesses.id, businessId));
    return lastTest;
  }

  /** Envía una factura electrónica al proveedor y guarda el resultado (CUFE, QR, enlace público o el error). */
  async sendToProvider(businessId: string, id: string) {
    const b = await this.business(businessId);
    const p = b.einvoiceProvider ?? {};
    if (!factusConfigured(p)) throw new BadRequestException('Conecta tu proveedor de facturación electrónica en Facturación → Ajustes.');
    const [inv] = await this.db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.businessId, businessId)));
    if (!inv) throw new NotFoundException('Factura no encontrada');
    if (inv.docType !== 'ELECTRONIC' || inv.kind !== 'INVOICE') throw new BadRequestException('Solo las facturas electrónicas se envían al proveedor.');
    if (inv.status !== 'ISSUED') throw new BadRequestException('La factura está anulada.');
    if (inv.dianStatus === 'ACCEPTED') throw new BadRequestException('Esta factura ya fue validada por la DIAN.');
    const cfg = this.factusCfg(p);
    const buyer = inv.buyer as BuyerSnapshot;
    const items = (inv.items as InvoiceItem[]).map((i) => ({ code: i.code, description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount), taxRate: Number(i.taxRate) }));
    const payload = factusBillPayload({
      referenceCode: `DREAMS-${inv.fullNumber}-${inv.id.slice(0, 6)}`, numberingRangeId: cfg.numberingRangeId, observation: inv.notes,
      paymentForm: inv.paymentForm as 'CONTADO' | 'CREDITO', paymentMeans: inv.paymentMeans, dueDate: inv.dueDate, total: Number(inv.total), buyer, items, priceIncludesTax: cfg.priceIncludesTax,
    });
    const sandbox = cfg.env !== 'production';
    const provider = `Factus${sandbox ? ' (pruebas)' : ''}`;
    try {
      const r = await factusSendBill(cfg, payload);
      const notes: string[] = [];
      if (r.total != null && Math.abs(r.total - Number(inv.total)) > 1) notes.push(`Atención: Factus calculó un total de $${r.total.toLocaleString('es-CO')} y DREAMS de $${Number(inv.total).toLocaleString('es-CO')}. Revisa la opción «precios con IVA incluido» en Ajustes.`);
      if (r.number && r.number !== inv.fullNumber) notes.push(`La DIAN la registró con el número ${r.number}. Para que coincidan, usa en DREAMS la misma resolución y prefijo que en Factus.`);
      const dianStatus = sandbox ? 'SIMULATED' : (r.cufe ? 'ACCEPTED' : 'PENDING');
      const msg = sandbox ? 'Validada en el ambiente de PRUEBAS de Factus: no tiene validez fiscal.' : r.cufe ? 'Validada por la DIAN a través de Factus.' : 'Enviada a Factus; la DIAN aún no confirma.';
      await this.db.update(invoices).set({
        dianStatus, cufe: r.cufe, dianEnvironment: sandbox ? '2' : '1', dianValidatedAt: r.cufe ? new Date() : null, dianProvider: provider,
        dianMessage: [msg, ...notes].join(' '), dianData: { provider: 'FACTUS', number: r.number, qr: r.qr, publicUrl: r.publicUrl, total: r.total, sentAt: new Date().toISOString(), response: r.raw },
      }).where(eq(invoices.id, id));
      if (inv.saleId) await this.db.update(sales).set({ einvoiceStatus: dianStatus }).where(eq(sales.id, inv.saleId));
    } catch (e: any) {
      const rejected = e instanceof FactusError && (e.status === 422 || e.status === 400);
      await this.db.update(invoices).set({
        dianStatus: rejected ? 'REJECTED' : 'PENDING', dianProvider: provider,
        dianMessage: `${rejected ? 'Factus/DIAN rechazó la factura' : 'No se pudo enviar'}: ${e?.message ?? 'error'}. Corrige los datos y usa «Reenviar a la DIAN».`,
        dianData: { provider: 'FACTUS', error: e?.message, status: e?.status, details: e?.details ?? null, sentAt: new Date().toISOString() },
      }).where(eq(invoices.id, id));
      if (inv.saleId) await this.db.update(sales).set({ einvoiceStatus: rejected ? 'REJECTED' : 'PENDING' }).where(eq(sales.id, inv.saleId));
    }
    return this.get(businessId, id);
  }

  async bySale(businessId: string, saleId: string) {
    return this.db.select({ id: invoices.id, fullNumber: invoices.fullNumber, kind: invoices.kind, docType: invoices.docType, status: invoices.status, dianStatus: invoices.dianStatus, issuedAt: invoices.issuedAt })
      .from(invoices).where(and(eq(invoices.businessId, businessId), eq(invoices.saleId, saleId))).orderBy(desc(invoices.issuedAt));
  }
}

@Controller()
export class InvoicingController {
  constructor(private s: InvoicingService) {}
  @RequirePermissions('sales:read') @Get('invoicing/settings') settings(@Ctx() ctx: RequestContext) { return this.s.settings(ctx.businessId); }
  @RequirePermissions('business:manage') @Put('invoicing/settings') save(@Ctx() ctx: RequestContext, @Body() dto: SettingsDto) { return this.s.saveSettings(ctx.businessId, dto); }
  @RequirePermissions('business:manage') @Post('invoicing/resolutions') addRes(@Ctx() ctx: RequestContext, @Body() dto: ResolutionDto) { return this.s.addResolution(ctx.businessId, dto); }
  @RequirePermissions('business:manage') @Patch('invoicing/resolutions/:id') updRes(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolutionUpdateDto) { return this.s.updateResolution(ctx.businessId, id, dto); }

  @RequirePermissions('sales:read') @Get('invoices') list(@Ctx() ctx: RequestContext, @Query() q: ListQuery) { return this.s.list(ctx.businessId, q); }
  @RequirePermissions('sales:read') @Get('invoices/prepare/:saleId') prepare(@Ctx() ctx: RequestContext, @Param('saleId', ParseUUIDPipe) saleId: string) { return this.s.prepare(ctx.businessId, saleId); }
  @RequirePermissions('sales:read') @Get('invoices/by-sale/:saleId') bySale(@Ctx() ctx: RequestContext, @Param('saleId', ParseUUIDPipe) saleId: string) { return this.s.bySale(ctx.businessId, saleId); }
  @RequirePermissions('sales:read') @Get('invoices/:id') get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('invoices') create(@Ctx() ctx: RequestContext, @Body() dto: CreateInvoiceDto) { return this.s.create(ctx, dto); }
  @RequirePermissions('sales:cancel') @Post('invoices/:id/credit-note') credit(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreditNoteDto) { return this.s.creditNote(ctx, id, dto); }
  @RequirePermissions('business:manage') @Get('invoicing/provider') provider(@Ctx() ctx: RequestContext) { return this.s.provider(ctx.businessId); }
  @RequirePermissions('business:manage') @Put('invoicing/provider') saveProvider(@Ctx() ctx: RequestContext, @Body() dto: ProviderDto) { return this.s.saveProvider(ctx.businessId, dto); }
  @RequirePermissions('business:manage') @Post('invoicing/provider/test') testProvider(@Ctx() ctx: RequestContext) { return this.s.testProvider(ctx.businessId); }
  @RequirePermissions('sales:create') @Post('invoices/:id/send') send(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) { return this.s.sendToProvider(ctx.businessId, id); }
  @RequirePermissions('sales:create') @Post('invoices/:id/dian') dian(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterDianDto) { return this.s.registerDian(ctx, id, dto); }

  @RequirePermissions('sales:create') @Post('invoices/:id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  addFile(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) { return this.s.addFile(ctx, id, file); }

  @RequirePermissions('sales:read') @Get('invoices/:id/files/:fileId')
  async getFile(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string, @Res() res: Response) {
    const f = await this.s.file(ctx.businessId, id, fileId);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${f.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(f.content);
  }

  @RequirePermissions('sales:read') @Get('invoices/:id/pdf')
  async pdf(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { buf, filename } = await this.s.pdf(ctx.businessId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buf);
  }
}

@Module({ controllers: [InvoicingController], providers: [InvoicingService], exports: [InvoicingService] })
export class InvoicingModule {}
