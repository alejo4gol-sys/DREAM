/**
 * Fuentes de seguimiento de procesos.
 *
 * AUTO   = DREAMS consulta la fuente por sí solo y trae las actuaciones nuevas (hoy: Rama Judicial, CPNU).
 * MANUAL = la entidad no tiene una consulta pública que se pueda automatizar (captcha, inicio de sesión
 *          o no existe consulta). DREAMS guarda el número, abre la consulta oficial con un toque,
 *          recuerda revisarla cada N días y deja registrar las novedades para avisar al equipo.
 * Revisado: octubre de 2026. No se eluden captchas ni inicios de sesión.
 */
export interface SourceField { key: string; label: string; placeholder?: string; required?: boolean }
export interface ProcessSource {
  key: string; label: string; group: string; mode: 'AUTO' | 'MANUAL';
  refLabel: string; refPlaceholder: string; refHelp?: string;
  /** Validación del número (sobre el texto ya normalizado). */
  refPattern?: RegExp; digitsOnly?: boolean;
  extra?: SourceField[]; kinds: string[];
  consultUrl?: string; consultLabel?: string; how: string; note?: string;
}

export const KINDS: Record<string, string> = {
  TUTELA: 'Acción de tutela',
  DEMANDA: 'Demanda o proceso judicial',
  PENAL: 'Proceso penal',
  DENUNCIA: 'Denuncia o querella',
  QUEJA: 'Queja, reclamo o derecho de petición',
  ADMINISTRATIVO: 'Trámite o actuación administrativa',
  JURISDICCIONAL: 'Proceso ante superintendencia (función jurisdiccional)',
  NOTARIAL: 'Trámite notarial (escritura, sucesión, divorcio)',
  REGISTRO: 'Registro de instrumento público',
  CONCILIACION: 'Conciliación',
  PENSION: 'Pensión o prestación',
  OTRO: 'Otro',
};

export const SOURCES: ProcessSource[] = [
  {
    key: 'RAMA_JUDICIAL', group: 'Rama Judicial', mode: 'AUTO',
    label: 'Rama Judicial — juzgados, tribunales y altas cortes',
    refLabel: 'Número de radicación (23 dígitos)', refPlaceholder: '76001-31-03-005-2026-00123-00', digitsOnly: true, refPattern: /^\d{23}$/,
    refHelp: 'Departamento, ciudad, entidad, especialidad, despacho, año, consecutivo y recurso. Escríbelo con o sin guiones.',
    kinds: ['TUTELA', 'DEMANDA', 'PENAL', 'JURISDICCIONAL', 'OTRO'],
    consultUrl: 'https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion', consultLabel: 'Consulta de Procesos Nacional Unificada',
    how: 'Automático: DREAMS consulta la Rama Judicial varias veces al día y te avisa cada actuación nueva.',
    note: 'Cubre los despachos que publican en la Consulta Nacional Unificada (Justicia XXI y TYBA). Los procesos con reserva no muestran actuaciones.',
  },
  {
    key: 'SAMAI', group: 'Rama Judicial', mode: 'MANUAL',
    label: 'Contencioso administrativo — SAMAI (Consejo de Estado y tribunales)',
    refLabel: 'Número de radicación (23 dígitos)', refPlaceholder: '76001-23-33-000-2026-00123-00', digitsOnly: true, refPattern: /^\d{23}$/,
    kinds: ['DEMANDA', 'TUTELA', 'CONCILIACION', 'OTRO'],
    consultUrl: 'https://samai.consejodeestado.gov.co/Vistas/Casos/procesos.aspx', consultLabel: 'SAMAI',
    how: 'Recordatorio: SAMAI pide verificación «No soy un robot» para ver las actuaciones.',
    note: 'Si el radicado también aparece en la Consulta Nacional Unificada, regístralo como «Rama Judicial» para vigilarlo automáticamente.',
  },
  {
    key: 'CORTE_CONSTITUCIONAL', group: 'Rama Judicial', mode: 'MANUAL',
    label: 'Corte Constitucional — tutela en revisión',
    refLabel: 'Número de expediente', refPlaceholder: 'T-1234567', refPattern: /^[A-Z]{1,3}-?\d{3,9}$/i,
    kinds: ['TUTELA', 'OTRO'],
    consultUrl: 'https://www.corteconstitucional.gov.co/secretaria/consulta-y-tramite-de-procesos/tutela', consultLabel: 'Consulta de tutelas de la Corte',
    how: 'Recordatorio: la Corte no ofrece una consulta automatizable.',
  },
  {
    key: 'FISCALIA', group: 'Penal', mode: 'MANUAL',
    label: 'Fiscalía — denuncia o noticia criminal (SPOA)',
    refLabel: 'Número único de noticia criminal (NUNC)', refPlaceholder: '760016000193202612345', digitsOnly: true, refPattern: /^\d{21,23}$/,
    refHelp: 'Son 21 dígitos. Llega por correo unos días después de denunciar (el número de la denuncia en línea no sirve para consultar).',
    kinds: ['DENUNCIA', 'PENAL', 'OTRO'],
    consultUrl: 'https://www.fiscalia.gov.co/colombia/servicios-de-informacion-al-ciudadano/consultas/', consultLabel: 'Consulte su denuncia (Fiscalía)',
    how: 'Recordatorio: la consulta de la Fiscalía pide un código de verificación.',
    note: 'Cuando el caso llegue a un juez (audiencias), regístralo también con el radicado de la Rama Judicial.',
  },
  {
    key: 'SNR_REGISTRO', group: 'Notariado y registro', mode: 'MANUAL',
    label: 'Superintendencia de Notariado y Registro — turno de registro (ORIP)',
    refLabel: 'Número de turno', refPlaceholder: '2026-12345', refPattern: /^[\w-]{3,30}$/,
    extra: [{ key: 'circulo', label: 'Círculo registral (oficina de registro)', placeholder: 'Ej. Buga (373)', required: true }],
    kinds: ['REGISTRO', 'NOTARIAL', 'OTRO'],
    consultUrl: 'https://estadotramiteciud.supernotariado.gov.co/Portal/EstadoTramiteCiud/', consultLabel: 'Estado del trámite de registro (SNR)',
    how: 'Recordatorio con enlace a la consulta oficial del turno.',
    note: 'Sirve para seguir escrituras (compraventas, sucesiones, hipotecas) cuando ya se radicaron para registro.',
  },
  {
    key: 'NOTARIA', group: 'Notariado y registro', mode: 'MANUAL',
    label: 'Notaría — escritura, sucesión, divorcio u otro trámite',
    refLabel: 'Número de radicado o de escritura', refPlaceholder: 'Radicado 2026-0456', refPattern: /^.{2,40}$/,
    extra: [{ key: 'notaria', label: 'Notaría', placeholder: 'Ej. Notaría Segunda de Buga', required: true }, { key: 'contacto', label: 'Teléfono o correo de la notaría', placeholder: 'Opcional' }],
    kinds: ['NOTARIAL', 'OTRO'],
    how: 'Recordatorio: no existe una consulta pública centralizada de trámites notariales; se pregunta directamente a la notaría.',
    note: 'Cuando la escritura pase a registro, agrega el turno de la oficina de registro (SNR) para seguirlo.',
  },
  {
    key: 'SIC', group: 'Superintendencias', mode: 'MANUAL',
    label: 'Superintendencia de Industria y Comercio',
    refLabel: 'Número de radicado', refPlaceholder: '26-123456', refPattern: /^[\w-]{3,30}$/,
    kinds: ['JURISDICCIONAL', 'QUEJA', 'ADMINISTRATIVO', 'OTRO'],
    consultUrl: 'https://consultatramites.sic.gov.co/consulta-externa', consultLabel: 'Consulta de trámites SIC',
    how: 'Recordatorio con enlace a la consulta de trámites de la SIC.',
    note: 'Las acciones de protección al consumidor se consultan sin usuario; competencia desleal y propiedad industrial requieren acceso al «Sitio Partes».',
  },
  {
    key: 'SUPERSOCIEDADES', group: 'Superintendencias', mode: 'MANUAL',
    label: 'Superintendencia de Sociedades — Baranda Virtual (insolvencia y otros)',
    refLabel: 'Número de radicado o expediente', refPlaceholder: '2026-01-123456', refPattern: /^[\w-]{3,30}$/,
    extra: [{ key: 'nit', label: 'NIT de la sociedad (sin dígito de verificación)', placeholder: '900123456', required: true }],
    kinds: ['JURISDICCIONAL', 'ADMINISTRATIVO', 'OTRO'],
    consultUrl: 'https://www.supersociedades.gov.co/', consultLabel: 'Baranda Virtual (Supersociedades)',
    how: 'Recordatorio: Baranda Virtual pide verificación «No soy un robot».',
  },
  {
    key: 'SUPERFINANCIERA', group: 'Superintendencias', mode: 'MANUAL',
    label: 'Superintendencia Financiera — proceso jurisdiccional o queja',
    refLabel: 'Número de radicado', refPlaceholder: '2026123456', refPattern: /^[\w-]{3,30}$/,
    kinds: ['JURISDICCIONAL', 'QUEJA', 'OTRO'],
    consultUrl: 'https://www.superfinanciera.gov.co/formulesuqueja/faces/consulta/jurisdiccional.xhtml', consultLabel: 'Consulta tu proceso judicial (SFC)',
    how: 'Recordatorio: la consulta pide la identificación del demandante y un captcha.',
  },
  {
    key: 'SUPERSALUD', group: 'Superintendencias', mode: 'MANUAL',
    label: 'Superintendencia de Salud — PQRD o función jurisdiccional',
    refLabel: 'Número de radicado', refPlaceholder: 'PQR-2026-1234567', refPattern: /^[\w-]{3,30}$/,
    kinds: ['QUEJA', 'JURISDICCIONAL', 'OTRO'],
    consultUrl: 'https://pqrdsuperargo.supersalud.gov.co/api/busqueda', consultLabel: 'Seguimiento de PQRD (Supersalud)',
    how: 'Recordatorio con enlace a la consulta de la Supersalud.',
  },
  {
    key: 'SUPERSERVICIOS', group: 'Superintendencias', mode: 'MANUAL',
    label: 'Superintendencia de Servicios Públicos',
    refLabel: 'Número de radicado', refPlaceholder: '20268700123456', refPattern: /^[\w-]{3,30}$/,
    kinds: ['QUEJA', 'ADMINISTRATIVO', 'OTRO'],
    consultUrl: 'https://www.superservicios.gov.co/Atencion-y-servicios-a-la-ciudadania/consulta-estado-de-tramite', consultLabel: 'Consulta de estado de trámite',
    how: 'Recordatorio con enlace a la consulta de la Superservicios.',
  },
  {
    key: 'COLPENSIONES', group: 'Otras entidades', mode: 'MANUAL',
    label: 'Colpensiones — solicitud de pensión o prestación',
    refLabel: 'Número de radicado', refPlaceholder: '2026_1234567', refPattern: /^[\w-]{3,30}$/,
    kinds: ['PENSION', 'QUEJA', 'OTRO'],
    consultUrl: 'https://sede.colpensiones.gov.co/tramite/updInfo/39/', consultLabel: 'Consulta de radicado (Colpensiones)',
    how: 'Recordatorio: la consulta pide documento del afiliado y captcha.',
  },
  {
    key: 'PROCURADURIA', group: 'Otras entidades', mode: 'MANUAL',
    label: 'Procuraduría — conciliación extrajudicial u otro trámite',
    refLabel: 'Número de radicado', refPlaceholder: 'E-2026-123456', refPattern: /^[\w-]{3,30}$/,
    kinds: ['CONCILIACION', 'QUEJA', 'OTRO'],
    how: 'Recordatorio: la Procuraduría no tiene consulta pública del estado; el seguimiento es con el procurador asignado o por correo.',
  },
  {
    key: 'OTRA', group: 'Otras entidades', mode: 'MANUAL',
    label: 'Otra entidad (alcaldía, inspección, comisaría, DIAN…)',
    refLabel: 'Número de radicado', refPlaceholder: 'Radicado', refPattern: /^.{2,40}$/,
    extra: [{ key: 'entidad', label: 'Entidad', placeholder: 'Ej. Secretaría de Tránsito de Cali', required: true }, { key: 'url', label: 'Enlace de consulta (opcional)', placeholder: 'https://…' }],
    kinds: Object.keys(KINDS),
    how: 'Recordatorio y registro manual de novedades.',
  },
];

export const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

/** Normaliza y valida el número según la fuente. Devuelve null si no es válido. */
export function normalizeReference(source: ProcessSource, raw: string) {
  const v = source.digitsOnly ? raw.replace(/\D/g, '') : raw.trim().replace(/\s+/g, ' ');
  if (source.refPattern && !source.refPattern.test(v)) return null;
  return v;
}

/** Radicado de 23 dígitos con guiones: 76001-31-03-005-2026-00123-00 */
export function formatRadicado(r: string) {
  if (!/^\d{23}$/.test(r)) return r;
  return `${r.slice(0, 5)}-${r.slice(5, 7)}-${r.slice(7, 9)}-${r.slice(9, 12)}-${r.slice(12, 16)}-${r.slice(16, 21)}-${r.slice(21)}`;
}
