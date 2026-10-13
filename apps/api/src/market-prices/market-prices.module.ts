import { BadRequestException, Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength } from 'class-validator';
import { and, ilike, or, eq } from 'drizzle-orm';
import { Ctx, RequestContext, RequirePermissions } from '../common/auth.guard';
import { Db, InjectDb } from '../db/db';
import { products } from '../db/schema';
import { config } from '../config';

class MarketSearchQuery {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString() @Length(2, 100) @MaxLength(100)
  query: string;
}

type Offer = { source: string; title: string; price: number; currency: string; condition?: string; image?: string; location?: string; url?: string };
type SourceStatus = { id: string; name: string; state: 'connected' | 'aggregated' | 'setup' | 'permission'; message: string };

@Injectable()
class MarketPricesService {
  private ebayToken: { value: string; expiresAt: number } | null = null;
  constructor(@InjectDb() private db: Db) {}

  async search(businessId: string, query: string) {
    const q = query.trim().replace(/\s+/g, ' ');
    if (q.length < 2 || q.length > 100) throw new BadRequestException('Escribe entre 2 y 100 caracteres para buscar');
    const globalSearchEnabled = Boolean(config.marketSerpApiKey);
    const [catalog, googleShopping, mercadoLibre, ebay, amazon] = await Promise.all([
      this.db.select({ id: products.id, name: products.name, sku: products.sku, barcode: products.barcode,
        salePrice: products.salePrice, costPrice: products.costPrice, imageUrl: products.imageUrl })
        .from(products).where(and(eq(products.businessId, businessId), eq(products.isActive, true), or(
          ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`), ilike(products.barcode, `%${q}%`),
        ))).limit(8),
      globalSearchEnabled ? this.searchGoogleShopping(q) : Promise.resolve({ offers: [], state: 'setup' as const, message: 'Falta conectar la búsqueda global.' }),
      this.searchMercadoLibre(q),
      this.searchEbay(q),
      config.marketSerpApiKey ? this.searchAmazon(q) : Promise.resolve({ offers: [], state: 'setup' as const, message: 'Amazon necesita SERPAPI_API_KEY para consultar ofertas.' }),
    ]);
    const hasAggregatedCoverage = globalSearchEnabled && googleShopping.state === 'connected';
    const offers = [...googleShopping.offers, ...mercadoLibre.offers, ...ebay.offers, ...amazon.offers];
    const localOffers = offers.filter((o) => o.currency === 'COP' && Number.isFinite(o.price) && o.price > 0);
    const average = localOffers.length ? Math.round(localOffers.reduce((sum, o) => sum + o.price, 0) / localOffers.length) : null;
    return {
      query: q,
      checkedAt: new Date().toISOString(),
      summary: localOffers.length ? { currency: 'COP', count: localOffers.length,
        lowest: Math.min(...localOffers.map((o) => o.price)), average,
        highest: Math.max(...localOffers.map((o) => o.price)) } : null,
      ownProducts: catalog,
      offers: offers.sort((a, b) => a.currency === b.currency ? a.price - b.price : a.currency.localeCompare(b.currency)),
      sources: [
        { id: 'google-shopping', name: 'Búsqueda global · Google Shopping', state: config.marketSerpApiKey ? googleShopping.state : 'setup',
          message: config.marketSerpApiKey ? googleShopping.message : 'Agrega SERPAPI_API_KEY al servidor para buscar cualquier producto, aunque no esté en tu catálogo.' },
        { id: 'mercadolibre', name: 'Mercado Libre Colombia', state: config.marketMercadoLibreToken ? mercadoLibre.state : hasAggregatedCoverage ? 'aggregated' : 'setup',
          message: config.marketMercadoLibreToken ? mercadoLibre.message : hasAggregatedCoverage ? 'Cobertura indirecta: puede aparecer en resultados de Google Shopping. Activa el conector directo con MERCADOLIBRE_ACCESS_TOKEN.' : 'Agrega el token oficial de la aplicación en el servidor.' },
        { id: 'ebay', name: 'eBay', state: ebay.state,
          message: ebay.message },
        { id: 'facebook', name: 'Facebook Marketplace', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, solo si Google Shopping incluye ofertas indexadas. Meta no ofrece una conexión pública general para buscar sus publicaciones.' : 'No hay una fuente pública general conectada; se requiere un acuerdo o acceso autorizado.' },
        { id: 'tucarro', name: 'TuCarro', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, si sus ofertas aparecen en Google Shopping; conexión directa no disponible en DREAMS.' : 'Pendiente de un acceso de datos autorizado por la plataforma.' },
        { id: 'amazon', name: 'Amazon.com · ofertas internacionales', state: amazon.state, message: amazon.message },
        { id: 'falabella', name: 'Falabella', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, si Google Shopping encuentra ofertas. La API oficial disponible es de vendedor y requiere credenciales de Seller Center.' : 'La API disponible está orientada a vendedores; se necesita acceso de Seller Center.' },
        { id: 'exito', name: 'Éxito', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, si Google Shopping encuentra ofertas. Su API requiere credenciales de vendedor.' : 'Se necesita acceso y credenciales de vendedor de Éxito.' },
        { id: 'alkosto', name: 'Alkosto', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, si Google Shopping encuentra ofertas; conexión directa no disponible en DREAMS.' : 'Pendiente de un acceso de datos autorizado por la plataforma.' },
        { id: 'ktronix', name: 'Ktronix', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, si Google Shopping encuentra ofertas; conexión directa no disponible en DREAMS.' : 'Pendiente de un acceso de datos autorizado por la plataforma.' },
        { id: 'homecenter', name: 'Homecenter', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, si Google Shopping encuentra ofertas; conexión directa no disponible en DREAMS.' : 'Pendiente de un acceso de datos autorizado por la plataforma.' },
        { id: 'jumbo', name: 'Jumbo y Carulla', state: hasAggregatedCoverage ? 'aggregated' : 'permission', message: hasAggregatedCoverage ? 'Cobertura indirecta, si Google Shopping encuentra ofertas; conexión directa no disponible en DREAMS.' : 'Pendiente de un acceso de datos autorizado por la plataforma.' },
      ] satisfies SourceStatus[],
      note: 'Los valores reflejan publicaciones visibles al momento de la consulta. El promedio COP excluye monedas extranjeras y no incluye envío, impuestos ni importación.',
    };
  }

  private async searchGoogleShopping(query: string): Promise<{ offers: Offer[]; state: SourceStatus['state']; message: string }> {
    try {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_shopping');
      url.searchParams.set('q', query);
      url.searchParams.set('gl', 'co');
      url.searchParams.set('hl', 'es');
      url.searchParams.set('api_key', config.marketSerpApiKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return { offers: [], state: 'setup', message: response.status === 401 || response.status === 403
        ? 'La clave de búsqueda global no es válida o no tiene consultas disponibles.' : 'La búsqueda global no respondió; intenta de nuevo.' };
      const body = await response.json() as any;
      if (body.error) return { offers: [], state: 'setup', message: String(body.error).slice(0, 180) };
      const offers: Offer[] = (body.shopping_results ?? []).flatMap((item: any) => {
        const price = Number(item.extracted_price);
        if (!item.title || !Number.isFinite(price) || price <= 0) return [];
        return [{ source: String(item.source ?? 'Google Shopping').slice(0, 80), title: String(item.title).slice(0, 240), price,
          currency: 'COP', condition: item.second_hand_condition ? String(item.second_hand_condition).slice(0, 40) : undefined,
          image: typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
          location: typeof item.delivery === 'string' ? item.delivery.slice(0, 80) : undefined,
          url: this.safeExternalUrl(item.product_link) }];
      });
      return { offers, state: 'connected', message: `${offers.length} ofertas globales consultadas para Colombia.` };
    } catch {
      return { offers: [], state: 'setup', message: 'No se pudo consultar la búsqueda global en este momento.' };
    }
  }

  private async searchAmazon(query: string): Promise<{ offers: Offer[]; state: SourceStatus['state']; message: string }> {
    try {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'amazon');
      url.searchParams.set('k', query);
      url.searchParams.set('amazon_domain', 'amazon.com');
      url.searchParams.set('shipping_location', 'CO');
      url.searchParams.set('language', 'es_US');
      url.searchParams.set('api_key', config.marketSerpApiKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return { offers: [], state: 'setup', message: response.status === 401 || response.status === 403
        ? 'SerpApi no autorizó la búsqueda de Amazon o se agotaron las consultas.' : 'Amazon no respondió; intenta de nuevo.' };
      const body = await response.json() as any;
      if (body.error) return { offers: [], state: 'setup', message: String(body.error).slice(0, 180) };
      const offers: Offer[] = (body.organic_results ?? []).flatMap((item: any) => {
        const price = Number(item.extracted_price);
        if (!item.title || !Number.isFinite(price) || price <= 0) return [];
        return [{ source: 'Amazon.com', title: String(item.title).slice(0, 240), price, currency: 'USD',
          condition: Array.isArray(item.delivery) && item.delivery.length ? String(item.delivery[0]).slice(0, 80) : undefined,
          image: typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
          location: 'Oferta internacional · consulta de envío a Colombia',
          url: this.safeExternalUrl(item.link_clean ?? item.link) }];
      });
      return { offers, state: 'connected', message: `${offers.length} ofertas de Amazon.com consultadas; precios en USD, sin convertir a COP.` };
    } catch {
      return { offers: [], state: 'setup', message: 'No se pudo consultar Amazon en este momento.' };
    }
  }

  private async searchMercadoLibre(query: string): Promise<{ offers: Offer[]; state: SourceStatus['state']; message: string }> {
    if (!config.marketMercadoLibreToken) return { offers: [], state: 'setup', message: 'Falta conectar la fuente.' };
    try {
      const url = new URL('https://api.mercadolibre.com/sites/MCO/search');
      url.searchParams.set('q', query); url.searchParams.set('limit', '20'); url.searchParams.set('sort', 'price_asc');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${config.marketMercadoLibreToken}` }, signal: AbortSignal.timeout(9000) });
      if (!response.ok) return { offers: [], state: 'setup', message: response.status === 401 || response.status === 403 ? 'El token necesita autorización o renovación.' : 'La fuente no respondió; intenta de nuevo.' };
      const body = await response.json() as any;
      const offers: Offer[] = (body.results ?? []).flatMap((item: any) => {
        const price = Number(item.price);
        if (!item.title || !Number.isFinite(price) || price <= 0) return [];
        return [{ source: 'Mercado Libre', title: String(item.title).slice(0, 240), price, currency: String(item.currency_id ?? 'COP'),
          condition: item.condition === 'new' ? 'Nuevo' : item.condition === 'used' ? 'Usado' : undefined,
          image: typeof item.thumbnail === 'string' ? item.thumbnail.replace(/^http:/, 'https:') : undefined,
          location: item.seller_address?.city?.name ? String(item.seller_address.city.name).slice(0, 80) : undefined,
          url: this.safeExternalUrl(item.permalink) }];
      });
      return { offers, state: 'connected', message: `${offers.length} publicaciones consultadas.` };
    } catch {
      return { offers: [], state: 'setup', message: 'No se pudo consultar Mercado Libre en este momento.' };
    }
  }

  private async getEbayToken() {
    if (this.ebayToken && this.ebayToken.expiresAt > Date.now() + 30_000) return this.ebayToken.value;
    const basic = Buffer.from(`${config.marketEbayClientId}:${config.marketEbayClientSecret}`).toString('base64');
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }), signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error('eBay no autorizó la conexión');
    const result = await response.json() as any;
    this.ebayToken = { value: String(result.access_token), expiresAt: Date.now() + Number(result.expires_in ?? 3600) * 1000 };
    return this.ebayToken.value;
  }

  private async searchEbay(query: string): Promise<{ offers: Offer[]; state: SourceStatus['state']; message: string }> {
    if (!config.marketEbayClientId || !config.marketEbayClientSecret) {
      if (config.marketSerpApiKey) return this.searchEbayViaSerpApi(query);
      return { offers: [], state: 'setup', message: 'Conecta las credenciales de eBay o SERPAPI_API_KEY.' };
    }
    try {
      const token = await this.getEbayToken();
      const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
      url.searchParams.set('q', query); url.searchParams.set('limit', '15');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }, signal: AbortSignal.timeout(9000) });
      if (!response.ok) return { offers: [], state: 'setup', message: 'La cuenta no tiene habilitada la búsqueda de eBay.' };
      const body = await response.json() as any;
      const offers: Offer[] = (body.itemSummaries ?? []).flatMap((item: any) => {
        const price = Number(item.price?.value);
        if (!item.title || !Number.isFinite(price) || price <= 0) return [];
        return [{ source: 'eBay', title: String(item.title).slice(0, 240), price,
          currency: String(item.price?.currency ?? 'USD'), condition: item.condition ? String(item.condition).slice(0, 80) : undefined,
          image: typeof item.image?.imageUrl === 'string' ? item.image.imageUrl : undefined,
          location: item.itemLocation?.city ? String(item.itemLocation.city).slice(0, 80) : 'Estados Unidos',
          url: this.safeExternalUrl(item.itemWebUrl) }];
      });
      return { offers, state: 'connected', message: `${offers.length} publicaciones consultadas en eBay Estados Unidos.` };
    } catch {
      return { offers: [], state: 'setup', message: 'No se pudo consultar eBay en este momento.' };
    }
  }

  private async searchEbayViaSerpApi(query: string): Promise<{ offers: Offer[]; state: SourceStatus['state']; message: string }> {
    try {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'ebay');
      url.searchParams.set('_nkw', query);
      url.searchParams.set('ebay_domain', 'ebay.com');
      url.searchParams.set('LH_PrefLoc', 'Worldwide');
      url.searchParams.set('_ipg', '25');
      url.searchParams.set('api_key', config.marketSerpApiKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return { offers: [], state: 'setup', message: response.status === 401 || response.status === 403
        ? 'SerpApi no autorizó la búsqueda de eBay o se agotaron las consultas.' : 'eBay no respondió; intenta de nuevo.' };
      const body = await response.json() as any;
      if (body.error) return { offers: [], state: 'setup', message: String(body.error).slice(0, 180) };
      const offers: Offer[] = (body.organic_results ?? []).flatMap((item: any) => {
        const price = Number(item.price?.from?.extracted ?? item.price?.extracted);
        if (!item.title || !Number.isFinite(price) || price <= 0) return [];
        return [{ source: 'eBay', title: String(item.title).slice(0, 240), price, currency: 'USD',
          condition: typeof item.condition === 'string' ? item.condition.slice(0, 80) : undefined,
          image: typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
          location: typeof item.location === 'string' ? item.location.replace(/^Located in /i, '').slice(0, 80) : 'Oferta internacional',
          url: this.safeExternalUrl(item.link) }];
      });
      return { offers, state: 'connected', message: `${offers.length} ofertas internacionales de eBay consultadas por SerpApi; precios en USD.` };
    } catch {
      return { offers: [], state: 'setup', message: 'No se pudo consultar eBay en este momento.' };
    }
  }

  private safeExternalUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }
}

@Controller('market-prices')
class MarketPricesController {
  constructor(private service: MarketPricesService) {}
  @Get('search') @RequirePermissions('products:read')
  search(@Ctx() ctx: RequestContext, @Query() q: MarketSearchQuery) { return this.service.search(ctx.businessId, q.query); }
}

@Module({ controllers: [MarketPricesController], providers: [MarketPricesService] })
export class MarketPricesModule {}
