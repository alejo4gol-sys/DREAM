// Prueba de la paleta de marca: node test/brand.mjs
const B = process.argv[2] ?? 'http://localhost:4000/api'; let t, biz;
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const j = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(t && { authorization: 'Bearer ' + t }), ...(biz && { 'x-business-id': biz }) }, body: b && JSON.stringify(b) }); return { s: r.status, d: await r.json() }; };
const email = `marca${Date.now()}@prueba.co`;
let r = await j('POST', '/auth/register', { fullName: 'Marca Prueba', email, password: 'Clave12345', acceptPolicy: true }); t = r.d.accessToken;
r = await j('POST', '/businesses', { tradeName: 'Tienda Rosa', brandColors: { primary: '#DB2777', accent: '#F9A8D4', paletteId: 'rosa' } });
ok(r.s === 201 && r.d.brandColors.primary === '#DB2777', 'crear negocio con paleta');
biz = r.d.id;
r = await j('GET', '/auth/me'); ok(r.d.businesses[0].brandColors?.accent === '#F9A8D4', 'la sesión trae la paleta del negocio');
r = await j('PATCH', '/businesses/current', { brandColors: { primary: 'rojo', accent: '#FFFFFF' } }); ok(r.s === 400, 'rechaza colores inválidos: ' + JSON.stringify(r.d.message));
r = await j('PATCH', '/businesses/current', { brandColors: { primary: '#123456', accent: '#ABCDEF', paletteId: 'custom' } }); ok(r.s === 200 && r.d.brandColors.primary === '#123456', 'cambiar a paleta personalizada');
