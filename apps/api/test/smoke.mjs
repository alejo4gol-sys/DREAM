// Prueba de humo end-to-end contra un API en ejecución: node test/smoke.mjs [baseUrl]
const BASE = process.argv[2] ?? 'http://localhost:4000/api';
let token = '', biz = '', cookie = '';
const ok = (c, m) => { if (!c) { console.error('✗', m); process.exitCode = 1; } else console.log('✓', m); };
async function call(method, path, body, extra = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...(token && { authorization: `Bearer ${token}` }), ...(biz && { 'x-business-id': biz }), ...(cookie && { cookie }), ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const ct = r.headers.get('content-type') ?? '';
  return { status: r.status, data: ct.includes('json') ? await r.json() : await r.arrayBuffer() };
}

let r = await call('POST', '/auth/login', { email: 'demo@dream.co', password: 'malo123x' });
ok(r.status === 401, 'login con contraseña incorrecta → 401');
r = await call('POST', '/auth/login', { email: 'demo@dream.co', password: 'Dream2026' });
ok(r.status === 200 && r.data.accessToken, 'login demo');
token = r.data.accessToken;
r = await call('GET', '/auth/me'); biz = r.data.businesses[0].businessId;
ok(r.data.businesses[0].roleKey === 'OWNER', 'me → propietario de ' + r.data.businesses[0].tradeName);
r = await call('POST', '/auth/refresh'); ok(r.status === 200 && r.data.accessToken, 'refresh rota el token'); token = r.data.accessToken;

r = await call('GET', '/dashboard?range=month');
ok(r.status === 200 && r.data.sales.month > 0, `dashboard: ventas del mes ${r.data.sales.month}, utilidad ${r.data.finance?.estimatedProfit}`);
r = await call('GET', '/products?pageSize=5'); ok(r.data.total >= 12, `productos: ${r.data.total}`);
const prod = r.data.items.find((p) => p.stock > 5);
r = await call('GET', '/customers'); ok(r.data.total >= 20, `clientes: ${r.data.total}, segmentos ${JSON.stringify(r.data.segmentCounts)}`);
const cust = r.data.items[0];

// Venta: descuenta inventario, actualiza cliente
r = await call('POST', '/sales', { customerId: cust.id, channel: 'WHATSAPP', paymentMethod: 'NEQUI', items: [{ productId: prod.id, quantity: 2 }], amountPaid: '0' });
ok(r.status === 201 && r.data.status === 'PENDING', `venta #${r.data.number} creada pendiente por ${r.data.total}`);
const sale = r.data;
r = await call('GET', `/products/${prod.id}`); ok(r.data.stock === prod.stock - 2, `inventario ${prod.stock} → ${r.data.stock}`);
r = await call('POST', '/sales', { channel: 'WHATSAPP', paymentMethod: 'CASH', items: [{ productId: prod.id, quantity: 99999 }] });
ok(r.status === 400, 'venta sin stock suficiente → 400: ' + r.data.message);
r = await call('POST', `/sales/${sale.id}/payments`, { amount: sale.total, method: 'NEQUI' });
ok(r.data.status === 'PAID', 'abono completa la venta');
r = await call('POST', `/sales/${sale.id}/cancel`); ok(r.data.status === 'CANCELLED', 'anular venta');
r = await call('GET', `/products/${prod.id}`); ok(r.data.stock === prod.stock, 'anulación devuelve inventario');

// Validación
r = await call('POST', '/products', { sku: 'X', name: 'x', costPrice: 'abc', salePrice: '1', hack: true });
ok(r.status === 400, 'validación rechaza datos inválidos y campos extra');

// Finanzas
r = await call('POST', '/expenses', { category: 'ADVERTISING', description: 'Pauta prueba', amount: '50000', date: new Date().toISOString() });
ok(r.status === 201, 'gasto creado');
r = await call('GET', '/accounting/income-statement'); ok(typeof r.data.netProfit === 'number', `estado de resultados: neta ${r.data.netProfit}, margen ${r.data.netMargin}%`);
r = await call('GET', '/accounting/cash-flow'); ok(r.data.inflows > 0, `flujo de caja: +${r.data.inflows} −${r.data.outflows}`);
r = await call('GET', '/accounting/receivables'); ok(r.status === 200, `cuentas por cobrar: ${r.data.total}`);
r = await call('GET', '/accounting/payables'); ok(r.data.total > 0, `cuentas por pagar: ${r.data.total}`);

// Bancos + conciliación
r = await call('GET', '/bank-accounts'); const acct = r.data.items[0];
r = await call('POST', `/bank-accounts/${acct.id}/sync`); ok(r.status === 201, `sandbox: ${r.data.inserted} movimientos simulados nuevos (${r.data.skipped ?? 0} ya existían)`);
r = await call('GET', '/reconciliations/suggestions'); ok(r.data.length > 0, `sugerencias: ${r.data.length} — "${r.data[0]?.question}"`);
if (r.data[0]) { const x = await call('POST', `/reconciliations/${r.data[0].id}/accept`); ok(x.data.status === 'ACCEPTED', 'conciliación aceptada'); }
r = await call('POST', '/bank-transactions/import', { bankAccountId: acct.id, csv: 'fecha;descripcion;valor\n05/10/2026;Pago cliente;120.000\n06/10/2026;Comisión;-8.500' });
ok(r.data.inserted + r.data.skipped === 2, 'importación CSV de extracto (sin duplicados)');

// Reportes
for (const [t, f] of [['sales', 'csv'], ['profit', 'pdf'], ['inventory', 'xlsx']]) {
  r = await call('GET', `/reports/${t}?format=${f}`); ok(r.status === 200 && r.data.byteLength > 200, `reporte ${t}.${f} (${r.data.byteLength} bytes)`);
}
// Asistente
for (const q of ['¿Cuánto vendí este mes?', '¿Cuál fue mi producto más vendido?', '¿Qué canal genera más ventas?', '¿Cuánto necesito vender para alcanzar 15 millones?', '¿Estoy gastando más que el mes pasado?']) {
  r = await call('POST', '/assistant/ask', { question: q }); ok(r.data.intent !== 'unknown', `${q} → ${r.data.answer}`);
}
r = await call('GET', '/notifications'); ok(r.data.items.length > 0, `notificaciones: ${r.data.unread} sin leer`);
r = await call('GET', '/audit-logs'); ok(r.data.length > 0, `auditoría: ${r.data.length} registros`);

// Permisos: vendedor no ve finanzas
r = await call('POST', '/businesses/current/members', { email: 'vendedor@dream.co', fullName: 'Vendedor Prueba', roleKey: 'SELLER' });
ok(r.status === 201 || r.status === 409, 'miembro vendedor creado (o ya existía)');
// Aislamiento: otro negocio
const other = await call('GET', '/products', null, { 'x-business-id': '00000000-0000-4000-8000-000000000000' });
ok(other.status === 403, 'acceso a negocio ajeno → 403');
r = await call('POST', '/auth/logout'); ok(r.status === 200, 'logout');
r = await call('POST', '/auth/refresh'); ok(r.status === 401, 'refresh tras logout → 401');

// Subconsultas correlacionadas (regresión): deuda por proveedor y conteos
token = (await call('POST', '/auth/login', { email: 'demo@dream.co', password: 'Dream2026' })).data.accessToken;
r = await call('GET', '/suppliers');
const andina = r.data.items.find((s) => s.name === 'Importadora Andina');
ok(andina && Number(andina.debt) === 660000, `deuda Importadora Andina = ${andina?.debt} (esperado 660000)`);
ok(r.data.items.every((s) => s.productsCount === 6), 'cada proveedor tiene 6 productos');
r = await call('GET', '/categories'); ok(r.data.reduce((a, c) => a + c.products, 0) >= 12, 'conteo de productos por categoría');
r = await call('GET', '/bank-accounts'); ok(r.data.items[0].unmatched > 0, `movimientos sin conciliar: ${r.data.items[0].unmatched}`);
