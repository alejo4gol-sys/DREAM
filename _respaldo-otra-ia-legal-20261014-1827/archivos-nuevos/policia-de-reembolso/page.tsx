'use client';
import Link from 'next/link';
import { Reorder, Calculator } from 'lucide-react';

/** Datos de la política */
const POLICY_REEMBOLSO = `
<div class="bg-white border-b border-sand-200 px-6 py-8">
  <div class="max-w-4xl mx-auto">
    <h1 className="text-3xl font-display font-bold text-[#111] mb-4">Política de Reembolso</h1>
    <p className="text-sm text-sand-600 mb-6">Última actualización: 14 Octubre 2026. Última revisión: 10 Octubre 2026.</p>

    <div class="space-y-6">
      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">¿Cuándo podemos devolver un servicio?</h2>
        <ul class="list-disc pl-5 space-y-1.5 text-sm text-[#4A453F] marker:text-sand-600">
          <li>No se pueden devolver los servicios una vez que el negocio haya recibido la factura o comprobante.</li>
          <li>La devolución debe solicitarse antes de las 17:00 UTC del día siguiente al vencimiento.</li>
          <li>Para efectos de reembolso, se entiende como "vencimiento" que ha pasado exactamente un año desde el día en que se realizó la entrega o servicio.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Metros cuadrados de negocio</h2>
        <p class="text-sm text-[#4A453F] marker:text-sand-600">El área del negocio está medida en metros cuadrados válidos y contiguos. No se cuenta el suelo vacío ni espacios con ventanas.</p>
        <ul class="list-disc pl-5 space-y-1.5 text-sm text-[#4A453F] marker:text-sand-600">
          <li>Aquí incluimos:</li>
          <li class="marker:text-sand-600"><strong>Cubierta</strong>: techos, mampostería, pisos de agua.</li>
          <li class="marker:text-sand-600"><strong>Servicios</strong>: garajes, estacionamientos, baños, cocinas.</li>
          <li class="marker:text-sand-600"><strong>Aterrizaje</strong>: espacios en plazas comerciales o zonas privadas.</li>
          <li class="marker:text-sand-600"><strong>Habitaciones</strong>: locales donde se realizan actividades de venta.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Materiales y materiales de consumo</h2>
        <p class="text-sm text-[#4A453F] marker:text-sand-600">El negocio puede devolver el material usado solo si tiene la documentación completa. Los materiales deben estar en su estado original, sin desperdicios ni daños.</p>
        <ul class="list-disc pl-5 space-y-1.5 text-sm text-[#4A453F] marker:text-sand-600">
          <li class="marker:text-sand-600"><strong>Apariencia original</strong>: El material debe parecerse a la entrega.</li>
          <li class="marker:text-sand-600"><strong>Inventario</strong>: Los insumos deben estar en stock completo.</li>
          <li class="marker:text-sand-600"><strong>Servicio de preparación</strong>: La preparación debe ser por nuestra cuenta (solo servicios).</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Tecnología y software</h2>
        <p class="text-sm text-[#4A453F] marker:text-sand-600">El negocio puede devolver cualquier parte de la tecnología, siempre que no afecte la capacidad del cliente para usar el servicio.</p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Servicios incluidos</h2>
        <ul class="list-disc pl-5 space-y-1.5 text-sm text-[#4A453F] marker:text-sand-600">
          <li>Ahorro en la factura</li>
          <li>Bono de bienvenida (hasta 25% sobre el primer mes)</li>
          <li>Asesoría gratuita de implementación inicial</li>
        </ul>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-[#111] mb-3">Notas importantes</h2>
        <p class="text-sm text-[#4A453F] marker:text-sand-600">Si has hecho un pedido mayor (más de 5.000 USD) o la devención no se ha realizado en el sitio web oficial, envíanos un correo y nosotros te enviaremos una nota formal.</p>
      </section>

      <footer class="mt-8 pt-6 border-t border-sand-200 text-center text-sm text-[#4A453F]">
        <Link href="/terminos-y-condiciones" className="underline hover:text-[#111]">Términos y condiciones</Link> ·
        <span>© 2026 DREAMS. Todos los derechos reservados.</span>
      </footer>
    </div>
  </div>
</div>`;

function ReembolsoPolicy() {
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
            <p className="text-sm uppercase tracking-wide text-[#6B645A] mb-3">{POLICY_REEMBOLSO.title}</p>
            <h1 className="text-2xl sm:text-3xl font-semibold">{POLICY_REEMBOLSO.title} · Reembolsos</h1>
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-[#6B645A]">
              <Reorder className="h-4 w-4" />
              <Calculator className="h-4 w-4" />
              <span>Última actualización: 14 Octubre 2026</span>
            </div>
          </header>

          <section>
            <h2 className="text-lg font-bold mb-3">¿Cuándo podemos devolver el servicio?</h2>
            <p className="text-sm text-[#4A453F] marker:text-sand-600">No podemos reembolsar si la devolución no se solicita antes de las 17:00 UTC del día siguiente al vencimiento.</p>
            <ul class="mt-3 space-y-2 list-disc pl-5 text-sm text-[#4A453F] marker:text-sand-600">
              <li>No se pueden devolver los servicios una vez que el negocio haya recibido la factura o comprobante.</li>
              <li>La devolución debe solicitarse antes de las 17:00 UTC del día siguiente al vencimiento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Metros cuadrados de negocio</h2>
            <p class="text-sm text-[#4A453F] marker:text-sand-600">El área del negocio está medida en metros cuadrados válidos y contiguos.</p>
            <ul class="mt-3 space-y-1.5 list-disc pl-5 text-sm text-[#4A453F] marker:text-sand-600">
              <li>Aquí incluimos:</li>
              <li class="marker:text-sand-600"><strong>Cubierta</strong>: techos, mampostería, pisos de agua.</li>
              <li class="marker:text-sand-600"><strong>Servicios</strong>: garajes, estacionamientos, baños, cocinas.</li>
              <li>Aterrizaje: espacios en plazas comerciales o zonas privadas.</li>
              <li>Habitaciones: locales donde se realizan actividades de venta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Materiales y materiales de consumo</h2>
            <p class="text-sm text-[#4A453F] marker:text-sand-600">El negocio puede devolver el material usado solo si tiene la documentación completa.</p>
            <ul class="mt-3 space-y-1.5 list-disc pl-5 text-sm text-[#4A453F] marker:text-sand-600">
              <li class="marker:text-sand-600"><strong>Apariencia original</strong>: El material debe parecerse a la entrega.</li>
              <li><strong>Inventario</strong>: Los insumos deben estar en stock completo.</li>
              <li><strong>Servicio de preparación</strong>: La preparación debe ser por nuestra cuenta (solo servicios).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Tecnología y software</h2>
            <p class="text-sm text-[#4A453F] marker:text-sand-600">El negocio puede devolver cualquier parte de la tecnología, siempre que no afecte la capacidad del cliente para usar el servicio.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Servicios incluidos</h2>
            <ul class="mt-3 space-y-1.5 list-disc pl-5 text-sm text-[#4A453F] marker:text-sand-600">
              <li>Ahorro en la factura (hasta 25% sobre el primer mes)</li>
              <li>Bono de bienvenida (hasta 25% sobre el primer mes)</li>
              <li>Asesoría gratuita de implementación inicial</li>
            </ul>
          </section>

          <section className="mt-8 pt-6 border-t border-[#EDE4D3]">
            <h2 className="text-xl font-bold mb-3">Política de términos y condiciones</h2>
            <p class="text-sm text-[#6B645A] marker:text-sand-600">¿Quieres saber cómo usamos los datos? Lee nuestra política completa en <a href="/politica-de-datos" className="underline hover:text-[#111]">Política de privacidad</a>.</p>
            <Link href="/terminos-y-condiciones" className="inline-flex items-center gap-2 mt-3 text-sm font-medium underline hover:underline">Términos y condiciones · Reembolsos · Política de cookies</Link>
          </section>
        </article>
      </main>

      <footer className="border-t border-[#EDE4D3] bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-between gap-3 text-sm text-[#6B645A]">
          <span>© 2026 DREAMS. Todos los derechos reservados.</span>
          <Link href="/terminos-y-condiciones" className="underline hover:text-[#111]">Términos y condiciones · Reembolsos</Link> ·
          <Link href="/politica-de-datos" className="underline hover:text-[#111]">Política de privacidad · Cookies</Link> ·
          <span>Tu negocio es parte del sistema, no el servicio.</span>
        </div>
      </footer>
    </div>
  );
}

export default ReembolsoPolicy;
