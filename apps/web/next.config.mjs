/** @type {import('next').NextConfig} */
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

export default {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // El navegador habla solo con el frontend (mismo origen); Next reenvía /api y /uploads al backend.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      // Ninguna página puede mostrarse dentro de otro sitio, salvo la vista previa del editor de la página web (mismo origen).
      { source: '/((?!tienda/__vista-previa).*)', headers: [...securityHeaders, { key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/tienda/__vista-previa', headers: [...securityHeaders, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};
