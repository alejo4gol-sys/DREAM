'use client';
import { ArrowUpRight, BarChart3, Clock3, Search, Tags, TrendingDown, TrendingUp } from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

export default function PriceComparisonPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ownId, setOwnId] = useState('');

  const globalSource = result?.sources?.find((source: any) => source.id === 'google-shopping');
  const marketSearchLinks = result?.query ? buildMarketSearchLinks(result.query) : [];
  const selectedOwn = useMemo(() => result?.ownProducts?.find((p: any) => p.id === ownId), [result, ownId]);
  const difference = selectedOwn && result?.summary?.average !== null && result?.summary?.average !== undefined
    ? Number(selectedOwn.salePrice) - Number(result.summary.average) : null;
  const search = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) { setError('Escribe al menos dos caracteres para buscar.'); return; }
    setBusy(true); setError(''); setResult(null); setOwnId('');
    try {
      const response = await api<any>(`/market-prices/search?query=${encodeURIComponent(q)}`);
      setResult(response);
      setOwnId(response.ownProducts?.[0]?.id ?? '');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Precios del mercado" subtitle="Busca cualquier producto en ofertas disponibles en Colombia, aunque no lo vendas en tu tienda." />
      <Card>
        <form onSubmit={search} className="flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100}
              placeholder="Ej.: AirPods, harina de trigo, llantas para moto…" aria-label="Producto para comparar" />
          </label>
          <button className="btn-primary min-w-36" type="submit" disabled={busy || query.trim().length < 2}>
            {busy ? <><Spinner /> Consultando…</> : <><Search className="h-4 w-4" /> Comparar precios</>}
          </button>
        </form>
        <p className="text-xs text-ink-muted mt-3">La búsqueda es independiente de tu inventario. Los resultados aparecen aquí mismo y se consultan para el mercado colombiano.</p>
      </Card>

      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      {globalSource && globalSource.state !== 'connected' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">La búsqueda global todavía no está conectada</p>
        <p className="mt-1">{globalSource.message || 'Configura SERPAPI_API_KEY en el archivo .env de DREAMS y reinicia los servicios para consultar ofertas.'}</p>
      </div>}

      {!result && !busy && !error && <div className="mt-5"><Empty icon={<Tags className="h-5 w-5" />} title="Busca un producto para comparar"
        description="Escribe cualquier producto. DREAMS buscará ofertas del mercado; si coincide con un artículo de tu catálogo, también podrás comparar tu precio." /></div>}

      {result && <div className="space-y-5 mt-5">
        {result.summary ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric icon={<Tags className="h-4 w-4" />} label="Publicaciones comparables" value={result.summary.count} />
          <Metric icon={<TrendingDown className="h-4 w-4" />} label="Precio más bajo" value={money(result.summary.lowest)} />
          <Metric icon={<BarChart3 className="h-4 w-4" />} label="Promedio del mercado" value={money(result.summary.average)} />
          <Metric icon={<TrendingUp className="h-4 w-4" />} label="Precio más alto" value={money(result.summary.highest)} />
        </div> : <Card><p className="text-sm font-medium">{globalSource?.state === 'connected' ? 'No se encontraron precios en pesos colombianos para esta búsqueda.' : 'Todavía no se puede calcular el promedio del mercado.'}</p>
          <p className="text-xs text-ink-muted mt-1">{globalSource?.state === 'connected' ? 'Prueba con el nombre de la marca y el modelo exactos.' : 'Activa la búsqueda global con SERPAPI_API_KEY en el archivo .env de DREAMS y reinicia los servicios.'}</p></Card>}

        {!!result.ownProducts?.length && <Card title="Compáralo con tu catálogo" actions={<select className="input h-9 max-w-full" value={ownId} onChange={(e) => setOwnId(e.target.value)} aria-label="Producto propio">
          {result.ownProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
        </select>}>
          {selectedOwn && <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>Tu precio: <b>{money(selectedOwn.salePrice)}</b></span>
            {result.summary?.average !== null && result.summary?.average !== undefined && <span>Promedio encontrado: <b>{money(result.summary.average)}</b></span>}
            {difference !== null && <Badge tone={difference > 0 ? 'warn' : difference < 0 ? 'ok' : 'muted'}>
              {difference > 0 ? `Tu precio está ${money(difference)} por encima` : difference < 0 ? `Tu precio está ${money(Math.abs(difference))} por debajo` : 'Tu precio coincide con el promedio'}
            </Badge>}
          </div>}
        </Card>}

        <Card title={`Resultados para “${result.query}”`} actions={<span className="text-xs text-ink-muted inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Consultado {new Date(result.checkedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}>
          {result.offers.length ? <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {result.offers.map((offer: any, index: number) => <article key={`${offer.source}-${index}`} className="rounded-xl border border-line p-3 flex gap-3 min-w-0">
              {offer.image ? <img src={offer.image} alt="" className="h-16 w-16 object-contain rounded-lg bg-sand-50 shrink-0" /> : <div className="h-16 w-16 rounded-lg bg-sand-50 flex items-center justify-center shrink-0"><Tags className="h-5 w-5 text-ink-faint" /></div>}
              <div className="min-w-0 flex-1"><div className="flex gap-2 items-center justify-between"><Badge>{offer.source}</Badge><span className="text-sm font-semibold whitespace-nowrap">{money(offer.price, offer.currency)}</span></div>
                <p className="text-xs mt-2 line-clamp-2">{offer.title}</p>
                <p className="text-[11px] text-ink-muted mt-1">{[offer.condition, offer.location, offer.currency !== 'COP' ? 'No convertido a COP' : null].filter(Boolean).join(' · ') || 'Precio publicado'}</p>
                {offer.url && <a href={offer.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink underline underline-offset-2 hover:text-ink-muted">
                  Ver precio original <ArrowUpRight className="h-3.5 w-3.5" />
                </a>}
              </div>
            </article>)}
          </div> : <Empty icon={<Search className="h-5 w-5" />} title="No encontramos publicaciones"
            description={globalSource?.state === 'connected' ? 'No hay ofertas visibles para ese término en este momento. Prueba con otra forma de escribir el producto.' : 'La búsqueda global no está conectada. Configura SERPAPI_API_KEY en el archivo .env de DREAMS y reinicia los servicios para consultar productos.'} />}
          <p className="text-[11px] text-ink-muted mt-4">{result.note} Los nombres similares pueden corresponder a referencias o condiciones diferentes; verifica modelo, tamaño, estado y presentación antes de ajustar tu precio.</p>
        </Card>

        <Card title={`Buscar “${result.query}” en más tiendas`} className="overflow-hidden">
          <p className="text-xs text-ink-muted mb-3">Abre la búsqueda del producto directamente en cada sitio. Si una tienda no entrega resultados aquí, podrás revisar sus ofertas desde su propia página.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {marketSearchLinks.map((source) => <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer"
              className="rounded-xl border border-line p-3 flex items-center justify-between gap-2 text-sm font-medium hover:border-ink-muted hover:bg-sand-50 transition-colors">
              <span>{source.name}</span><ArrowUpRight className="h-4 w-4 text-ink-muted shrink-0" />
            </a>)}
          </div>
          <p className="text-[11px] text-ink-muted mt-3">Los precios pueden variar por ciudad, disponibilidad, envío, impuestos o importación. Confirma el precio vigente en el sitio de cada publicación antes de comprar.</p>
        </Card>
      </div>}
    </div>
  );
}

function buildMarketSearchLinks(query: string) {
  const encoded = encodeURIComponent(query.trim());
  const slug = encoded.replace(/%20/g, '-');
  const googleSiteSearch = (domain: string) => `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
  return [
    { name: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${encoded}&gl=co&hl=es` },
    { name: 'Mercado Libre', url: `https://listado.mercadolibre.com.co/${slug}` },
    { name: 'Facebook Marketplace', url: `https://www.facebook.com/marketplace/search/?query=${encoded}` },
    { name: 'Amazon', url: `https://www.amazon.com/s?k=${encoded}` },
    { name: 'eBay', url: `https://www.ebay.com/sch/i.html?_nkw=${encoded}` },
    { name: 'Falabella', url: `https://www.falabella.com.co/falabella-co/search?Ntt=${encoded}` },
    { name: 'Éxito', url: `https://www.exito.com/search?query=${encoded}&_q=${encoded}&map=ft` },
    { name: 'Alkosto', url: `https://www.alkosto.com/search?text=${encoded}` },
    { name: 'Ktronix', url: `https://www.ktronix.com/search?text=${encoded}` },
    { name: 'Homecenter', url: `https://www.homecenter.com.co/homecenter-co/search?Ntt=${encoded}` },
    { name: 'Jumbo', url: `https://www.tiendasjumbo.co/search?query=${encoded}&_q=${encoded}&map=ft` },
    { name: 'Carulla', url: `https://www.carulla.com/search?query=${encoded}&_q=${encoded}&map=ft` },
    { name: 'TuCarro', url: googleSiteSearch('vehiculos.tucarro.com.co') },
  ];
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div className="card p-4"><div className="flex items-center gap-2 text-ink-muted">{icon}<span className="text-xs">{label}</span></div><p className="text-xl font-semibold mt-3">{value}</p></div>;
}
