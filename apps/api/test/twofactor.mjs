// Prueba del flujo 2FA, registro y límites del plan: node test/twofactor.mjs [baseUrl]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { authenticator } = require('otplib');
const BASE = process.argv[2] ?? 'http://localhost:4000/api';
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const j = async (method, path, body, token, biz) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...(biz && { 'x-business-id': biz }) }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

const email = `dueno${Date.now()}@prueba.co`;
let r = await j('POST', '/auth/register', { fullName: 'Dueño Prueba', email, password: 'corta', acceptPolicy: true });
ok(r.status === 400, 'contraseña débil rechazada');
r = await j('POST', '/auth/register', { fullName: 'Dueño Prueba', email, password: 'Clave12345', acceptPolicy: true });
ok(r.status === 201, 'registro');
let token = r.data.accessToken;
r = await j('POST', '/businesses', { tradeName: 'Negocio Prueba', taxId: '900123456-1', city: 'Cali' }, token);
ok(r.status === 201, 'crear negocio');
const biz = r.data.id;
r = await j('POST', '/auth/2fa/setup', null, token);
ok(!!r.data.secret && r.data.qrDataUrl?.startsWith('data:image/png'), 'QR 2FA generado');
const secret = r.data.secret;
r = await j('POST', '/auth/2fa/enable', { code: '000000' }, token);
ok(r.status === 400, 'código incorrecto rechazado');
r = await j('POST', '/auth/2fa/enable', { code: authenticator.generate(secret) }, token);
ok(r.status === 200, '2FA activado');
r = await j('POST', '/auth/login', { email, password: 'Clave12345' });
ok(r.data.twoFactorRequired === true, 'login pide segundo factor');
r = await j('POST', '/auth/login/2fa', { challengeToken: r.data.challengeToken, code: authenticator.generate(secret) });
ok(!!r.data.accessToken, 'login con código TOTP');
token = r.data.accessToken;
r = await j('POST', '/businesses/current/members', { email: `vend${Date.now()}@prueba.co`, fullName: 'Vendedora', roleKey: 'SELLER' }, token, biz);
ok(r.status === 403, 'plan Gratuito (1 usuario) bloquea agregar miembros: ' + r.data.message);
r = await j('GET', '/businesses/current/plan', null, token, biz);
ok(r.data.code === 'FREE', `plan ${r.data.name}, uso ${JSON.stringify(r.data.usage)}`);
for (let i = 0; i < 6; i++) await j('POST', '/auth/login', { email, password: 'Incorrecta1' });
r = await j('POST', '/auth/login', { email, password: 'Clave12345' });
ok(r.status === 403 || r.status === 429, `bloqueo tras intentos fallidos (${r.status})`);
