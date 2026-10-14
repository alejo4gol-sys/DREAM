'use client';
import Link from 'next/link';
import { Shield, Lock } from 'lucide-react';

/** Datos del formulario */
const FORM_TERMS = {
  title: 'Términos y condiciones',
  link: '/terminos-y-condiciones',
  description: 'Acepto los términos de DREAMS para mi cuenta y servicio.',
};

const FORM_PRIVACY = {
  title: 'Política de privacidad',
  link: '/politica-de-datos',
  description: 'Acepto la política de privacidad de DREAMS. Me comprometo a proteger tus datos personales.',
};

/** Datos de los documentos legales */
const LEGAL_TERMS = `TÉRminos Y CONDICIONES DE USUARIO DE DREAMS

Última revisión: Octubre 2026. Última actualización: Octubre 14, 2026.

1. INTRODUCCIÓN
La aplicación DREAMS es un servicio en la nube que permite a los pequeños negocios colombianos automatizar ventas, gestionar inventario y recibir pagos. Al registrarte como usuario, aceptas cumplir con las condiciones establecidas en estos documentos.`;

const LEGAL_PRIVACY = `POLÍTICA DE PRIVACIDAD DE DREAMS

Última actualización: Octubre 2026. Última revisión: Octubre 14, 2026.

1. RESPONSABLE DEL TRATAMIENTO
El Responsable del tratamiento es la empresa DreamS que utiliza este servicio.`;

function RegisterModal() {
  const legalTerms = `TÉRminos Y CONDICIONES DE USUARIO DE DREAMS

Última revisión: Octubre 2026. Última actualización: Octubre 14, 2026.

1. INTRODUCCIÓN
La aplicación DREAMS es un servicio en la nube que permite a los pequeños negocios colombianos automatizar ventas, gestionar inventario y recibir pagos. Al registrarte como usuario, aceptas cumplir con las condiciones establecidas en estos documentos.`;

const LEGAL_PRIVACY = `POLÍTICA DE PRIVACIDAD DE DREAMS

Última actualización: Octubre 2026. Última revisión: Octubre 14, 2026.

1. RESPONSABLE DEL TRATAMIENTO
El Responsable del tratamiento es la empresa DreamS que utiliza este servicio.`;

return (
  <div className="w-full max-w-3xl mx-auto">
    <h2 className="text-xl font-semibold text-[#111] mb-6 flex items-center gap-2">
      <Shield className="h-5 w-5" /> Registro de cuenta
    </h2>

    <form className="space-y-4" onSubmit={(e: any) => {
      e.preventDefault();
    }}>
      {/* Nombre completo */}
      <div>
        <label className="block text-sm font-medium mb-1">Nombre completo</label>
        <input type="text" required />
      </div>

      {/* Correo electrónico */}
      <div>
        <label className="block text-sm font-medium mb-1">Correo electrónico</label>
        <input type="email" required />
      </div>

      {/* Teléfono (opcional) */}
      <div>
        <label className="block text-sm font-medium mb-1">Teléfono</label>
        <input type="tel" />
      </div>

      {/* Contraseña */}
      <div>
        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input type="password" required />
      </div>

      {/* Checkbox Términos y Condiciones */}
      <div>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={FORM_TERMS.terms} onChange={() => {}} />
          <span>Acepto los términos y condiciones de DREAMS para mi cuenta y servicio.</span>
        </label>
      </div>

      {/* Checkbox Política de Privacidad */}
      <div>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={FORM_PRIVACY.privacy} onChange={() => {}} />
          <span>Acepto la política de privacidad de DREAMS. Me comprometo a proteger tus datos personales.</span>
        </label>
      </div>

      {/* Enlace para aceptar cookies (opcional) */}
      {FORM_PRIVACY.privacy && (
        <div className="pt-2">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={FORM_PRIVACY.cookies} onChange={() => {}} />
            <span>Acepto que las páginas de cookies y analytics recopilen datos de mi navegación por DREAMS para mejorar tu experiencia. Puedes desactivar o borrar cualquier cookie en tu navegador.</span>
          </label>
        </div>
      )}

      <button className="btn-primary w-full h-11 mt-4">Crear cuenta</button>

      <p className="text-xs text-center text-[#6B645A]">
        Si aceptas los términos, te comprometes a cumplir todos los requisitos. La violación afecta tu uso del servicio.
        <br />
        <Link href="/terminos-y-condiciones" className="underline hover:text-[#111] mt-2 block text-sm">Ver términos y condiciones</Link>
      </p>

      {/* Enlaces legales */}
      <footer className="text-xs text-[#6B645A] border-t border-sand-200 pt-4 mt-6">
        <div className="flex flex-wrap justify-between gap-4">
          <a href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#111]">Términos y condiciones</a>
          <a href="/politica-de-datos" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#111]">Política de privacidad</a>
          <a href="/policia-de-cookies" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#111]">Cookies y funcionalidades</a>
        </div>
      </footer>
    </form>

    {/* Modal de documentos legales (se abre en el modal de creación) */}
    <Modal open onClose={() => {}} title="Documentos del servicio">
      <div className="space-y-4">
        <p>{legalTerms}</p>
        <Link href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="block text-sm font-medium underline hover:text-[#111]">Ver Términos y condiciones</Link>
        <Link href="/politica-de-datos" target="_blank" rel="noopener noreferrer" className="block text-sm font-medium underline hover:text-[#111]">Ver Política de privacidad</Link>
      </div>

      {/* Modal secundario para políticas */}
      <Modal open onClose={() => {}} title="Documentos de política">
        <div className="space-y-4">
          <p>{LEGAL_TERMS}</p>
          <button className="btn-secondary w-full">Cerrar</button>
        </div>

        <Modal open onClose={() => {}} title="Política de privacidad">
          <div className="space-y-4">
            <p>{LEGAL_PRIVACY}</p>
            <button className="btn-secondary w-full">Cerrar</button>
          </div>
        </Modal>

        <Modal open onClose={() => {}} title="Cookies y funcionalidades">
          <div className="space-y-4">
            <p>DreamS utiliza cookies para mejorar tu experiencia.</p>
            <Link href="/policia-de-cookies" target="_blank" rel="noopener noreferrer" className="block text-sm font-medium underline hover:text-[#111]">Ver política de cookies</Link>
            <button className="btn-secondary w-full">Cerrar</button>
          </div>
        </Modal>

        <Modal open onClose={() => {}} title="Enlaces legales principales">
          <div className="space-y-2">
            <a href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="block text-sm underline hover:text-[#111]">Términos y condiciones</a>
            <a href="/politica-de-datos" target="_blank" rel="noopener noreferrer" className="block text-sm underline hover:text-[#111]">Política de privacidad</a>
            {FORM_PRIVACY.cookies && (
              <a href="/policia-de-cookies" target="_blank" rel="noopener noreferrer" className="block text-sm underline hover:text-[#111]">Cookies y funcionalidades</a>
            )}
          </div>
          <button className="btn-secondary w-full">Cerrar</button>
        </Modal>
      </div>

      {/* Enlaces rápidos */}
      <footer className="mt-6 border-t border-sand-200 pt-4">
        <Link href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="block text-sm underline hover:text-[#111] mb-3">Ver Términos y condiciones</Link>
        <Link href="/politica-de-datos" target="_blank" rel="noopener noreferrer" className="block text-sm underline hover:text-[#111] mb-2">Política de privacidad</Link>
        {FORM_PRIVACY.cookies && (
          <Link href="/policia-de-cookies" target="_blank" rel="noopener noreferrer" className="block text-sm font-medium underline hover:text-[#111]">Cookies y funcionalidades</Link>
        )}
        <div className="flex gap-2 justify-between mt-4">
          <button onClick={() => {}} disabled className="text-xs text-sand-600 cursor-not-allowed">Volver al registro</button>
          <button className="btn-secondary w-full h-9" onClick={() => {}}>Cerrar sesión</button>
        </div>
      </footer>
    </Modal>

    {/* Enlaces rápidos en la página de login */}
    <footer className="mt-6 pt-4 border-t border-sand-200">
      <div className="flex gap-4">
        <Link href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-[#111] flex items-center gap-1.5">
          Términos y condiciones
        </Link>
        <Link href="/politica-de-datos" target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-[#111] flex items-center gap-1.5">
          Política de privacidad
        </Link>
        {FORM_PRIVACY.cookies && (
          <Link href="/policia-de-cookies" target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline decoration-sand-400 hover:text-[#111] flex items-center gap-1.5">
            Cookies y funcionalidades
          </Link>
        )}
      </div>
    </footer>
  </div>
);
}

export default RegisterModal;
