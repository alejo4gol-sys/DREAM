'use client';
import Link from 'next/link';
import { Shield, Lock } from 'lucide-react';

/** Datos de los documentos de cookies */
const POLICY_COOKIE = `
<div class="bg-white border-b border-sand-200 px-6 py-8">
  <div class="max-w-4xl mx-auto">
    <h1 className="text-3xl font-display font-bold text-[#111] mb-4">Política de Cookies</h1>
    <p className="text-sm text-sand-600 mb-6">Última actualización: 14 Octubre 2026. Última revisión: 10 Octubre 2026.</p>

    <div class="space-y-6">
      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">¿Qué son las cookies?</h2>
        <p class="text-sm text-[#4A453F]">
          Una cookie es un pequeño archivo que se almacena en tu navegador para recordar preferencias, configuración o acciones tomadas durante la visita a DreamS. Las cookies nos permiten mejorar tu experiencia de usuario y personalizar contenidos según tus gustos.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Cookies de navegación y funcionales</h2>
        <ul class="space-y-3 list-disc pl-5 text-sm text-[#4A453F] marker:text-sand-600">
          <li><strong>Cookies de navegación:</strong> Identifican tu navegador y te ayudan a navegar correctamente. No requieren consentimiento.</li>
          <li><strong>Cookies funcionales:</strong> Te permiten acceder a características especiales, como la capacidad de guardar el estado de formularios o mostrar información personalizada sobre ti.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Cookies analíticas y de rendimiento</h2>
        <p class="text-sm text-[#4A453F]">
          Estas cookies no te identifican, sino que nos ayudan a analizar cómo visitas DreamS. Te mostraremos contenidos relevantes según tu comportamiento.
        </p>
        <ul class="space-y-2 list-disc pl-5 text-sm text-[#4A453F] marker:text-sand-600">
          <li><strong>Cookies de Google Analytics:</strong> Recopilan datos para mejorar el sitio (Google tiene la privacidad por defecto).</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Cookies publicitarias</h2>
        <p class="text-sm text-[#4A453F]">
          Estas cookies nos permiten mostrar publicidad personalizada y anuncios de terceros. Si quieres dejar este paso, puedes desactivarlas en tu navegador.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Tu derecho a controlar las cookies</h2>
        <p class="text-sm text-[#4A453F] marker:text-sand-600">Tienes el derecho total sobre tus datos de navegación. Puedes:</p>
        <ul class="space-y-1 list-disc pl-5 text-sm text-[#4A453F]">
          <li><strong>Deshacer la aceptación:</strong> Recomiendo desactivar las cookies por defecto.</li>
          <li><strong>Contactarnos:</strong> Si tienes dudas sobre cómo gestionar tus cookies, envíales un correo a <a href="mailto:contacto@dreams.co" className="underline">contacto@dreams.co</a>.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Política de privacidad</h2>
        <p class="text-sm text-[#4A453F] marker:text-sand-600">
          Si quieres saber cómo usamos los datos que recogemos, lee nuestra política completa en <a href="/politica-de-datos" className="underline hover:text-sand-700">Política de privacidad</a>.
        </p>
      </section>
    </div>

    <footer class="mt-8 pt-6 border-t border-sand-200 text-center text-sm text-[#4A453F]">
      <Link href="/politica-de-datos" className="underline hover:text-[#111]">Política de privacidad</Link> ·
      <span>© 2026 DREAMS. Todos los derechos reservados.</span>
    </footer>
  </div>
</div>`;

/** Datos del formulario */
const FORM_COOKIE = {
  title: 'Política de cookies',
  link: '/politica-de-cookies',
  description: 'Usamos cookies para mejorar tu experiencia en DreamS. Tienes derecho a controlarlas o desactivarlas.',
};

/** Datos de consentimiento registrado */
const CONSENT_FORM = {
  title: 'Consentimiento en la web de DREAMS',
  link: '/terminos-y-condiciones',
  description: 'Aceptas los términos, condiciones y política de cookies de DreamS para continuar navegando.',
};

/** Datos de consentimiento registrado (2 checkboxes) */
const CONSENT_FORM_TWO = {
  title: 'Consentimiento en la web de DREAMS - Términos & Privacidad',
  terms: true, // acepta términos y condiciones
  privacy: true, // acepta política de privacidad
};

function CookiePolicy() {
  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#111]">
      <header className="border-b border-[#EDE4D3] bg-[#FBF9F5]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium underline" aria-label="DREAMS"><Logo /></Link>
          <nav className="flex gap-2 sm:gap-3">
            <Link className="text-xs text-sand-600 hover:text-[#111]" href="/registro">Ingresar</Link>
            <Link className="text-xs underline" href="#política">Política</Link>
          </nav>
        </div>
      </header>

      <main id="política" className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <article>
          <header className="mb-8">
            <p className="text-sm uppercase tracking-wide text-[#6B645A] mb-3">{CONSENT_FORM.two.title}</p>
            <h1 className="text-2xl sm:text-3xl font-semibold">¿Qué son las cookies y cómo funcionamos?</h1>
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-[#6B645A]">
              <Lock className="h-4 w-4" />
              <span>Última actualización: 14 Octubre 2026</span>
            </div>
          </header>

          <section>
            <h2 className="text-lg font-bold mb-3">Introducción</h2>
            <p>{CONSENT_FORM.description}</p>
            <p className="mt-3 text-sm text-[#6B645A]">DreamS utiliza cookies para mejorar tu experiencia y personalizar contenidos. Te damos derecho a controlar las que usamos o desactivarlas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Cookies funcionales</h2>
            <div class="bg-white border border-[#EDE4D3] rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-[#111] mb-2">Cookies de navegación</h3>
              <p className="text-sm text-[#4A453F] marker:text-sand-600"><strong>Cookies de navegación:</strong> Te ayudan a navegar correctamente. No requieren consentimiento.</p>
              <ul class="mt-2 space-y-1.5 text-xs list-disc pl-5 text-[#4A453F]">
                <li class="marker:text-sand-600"><strong>Cookies de navegador:</strong> Identifican tu navegador y te permiten usar DreamS.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Cookies funcionales</h2>
            <div class="bg-white border border-[#EDE4D3] rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-[#111] mb-2">Cookies de función especial</h3>
              <p className="text-sm text-[#4A453F] marker:text-sand-600"><strong>Cookies funcionales:</strong> Te permiten usar funciones especiales de DreamS, como guardar el estado de formularios o mostrar información personalizada sobre ti.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Cookies analíticas</h2>
            <div class="bg-white border border-[#EDE4D3] rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-[#111] mb-2">Cookies analíticas y de rendimiento</h3>
              <p className="text-sm text-[#4A453F] marker:text-sand-600"><strong>Cookies analíticas:</strong> No te identifican, sino que nos ayudan a analizar cómo visitas DreamS.</p>
              <ul class="mt-2 space-y-1.5 list-disc pl-5 text-sm text-[#4A453F]">
                <li class="marker:text-sand-600"><strong>Cookies de Google Analytics:</strong> Recogen datos para mejorar el sitio (Google tiene la privacidad por defecto).</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Cookies publicitarias</h2>
            <div class="bg-white border border-[#EDE4D3] rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-[#111] mb-2">Cookies publicitarias</h3>
              <p className="text-sm text-[#4A453F] marker:text-sand-600"><strong>Cookies publicitarias:</strong> Nos permiten mostrar publicidad personalizada y anuncios de terceros. Si quieres dejar este paso, desactiva las en tu navegador.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Tu derecho a control</h2>
            <div class="bg-white border border-[#EDE4D3] rounded-xl p-5 shadow-sm">
              <p className="text-sm text-[#4A453F] marker:text-sand-600">Tienes el derecho total sobre tus datos de navegación. Puedes:</p>
              <ul class="space-y-1.5 list-disc pl-5 text-sm text-[#4A453F]">
                <li>Desactivar las cookies por defecto</li>
                <li>Revisar tu historial de navegación para ver quécookies se han activado en DreamS</li>
                <li>Contactarnos directamente a <a href="mailto:contacto@dreams.co" className="underline hover:text-[#111]">contacto@dreams.co</a></li>
              </ul>
            </div>
          </section>

          <section className="mt-8 pt-6 border-t border-[#EDE4D3]">
            <h2 className="text-xl font-bold mb-3">Política de privacidad</h2>
            <p className="text-sm text-[#6B645A] marker:text-sand-600">¿Quieres saber cómo usamos tus datos? Lee nuestra política completa en <a href="/politica-de-datos" className="underline hover:text-[#111]">Política de privacidad</a>.</p>
            <Link href="/terminos-y-condiciones" className="inline-flex items-center gap-2 mt-3 text-sm font-medium underline hover:underline">Aceptamos también los términos y condiciones</Link>
          </section>
        </article>
      </main>

      <footer className="border-t border-[#EDE4D3] bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-between gap-3 text-sm text-[#6B645A]">
          <span>© 2026 DREAMS. Todos los derechos reservados.</span>
          <Link href="/terminos-y-condiciones" className="underline hover:text-[#111]">Política de cookies</Link> ·
          <Link href="/politica-de-datos" className="underline hover:text-[#111]">Política de privacidad</Link> ·
          <span>Términos y condiciones</span>
        </div>
      </footer>
    </div>
  );
}

export default CookiePolicy;
