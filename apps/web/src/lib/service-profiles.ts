/**
 * Perfiles de negocios de SERVICIOS. Cada perfil adapta nombres, estados y campos de la interfaz
 * (un abogado ve «Casos» con radicado y despacho; un técnico ve «Órdenes» con marca, modelo e IMEI).
 */
export type JobStatus = 'QUOTE' | 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type ProfileField = { key: string; label: string; placeholder?: string; type?: 'text' | 'area' | 'select'; options?: string[]; wide?: boolean };
export type ServiceProfile = {
  key: string; label: string; examples: string;
  job: { singular: string; plural: string; nav: string; newLabel: string; titlePlaceholder: string };
  statuses: Record<JobStatus, string>;
  quote: string; dueLabel: string; appointment: string; appointments: string; customer: string; categories: string[];
  fields: ProfileField[]; warrantyDays: number; showWarranty: boolean; hours: boolean; partsLabel: string | null;
  trackingLabel: string;
};

const BASE_STATUSES: Record<JobStatus, string> = { QUOTE: 'Cotización', OPEN: 'Recibido', IN_PROGRESS: 'En proceso', WAITING: 'En espera', READY: 'Listo', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };

export const SERVICE_PROFILES: Record<string, ServiceProfile> = {
  LEGAL: {
    key: 'LEGAL', label: 'Abogados y servicios legales', examples: 'Firmas, abogados independientes, conciliadores, tramitadores.',
    job: { singular: 'Caso', plural: 'Casos', nav: 'Casos', newLabel: 'Nuevo caso', titlePlaceholder: 'Ej. Tutela por salud contra EPS' },
    statuses: { QUOTE: 'Consulta / propuesta', OPEN: 'Abierto', IN_PROGRESS: 'En trámite', WAITING: 'En espera', READY: 'Decisión / resultado', DELIVERED: 'Cerrado', CANCELLED: 'Archivado' },
    quote: 'Propuesta de honorarios', dueLabel: 'Próximo vencimiento o término', appointment: 'Cita o audiencia', appointments: 'Citas y audiencias', customer: 'Cliente', hours: true, showWarranty: false, warrantyDays: 0, partsLabel: null,
    trackingLabel: 'Consulta tu caso',
    categories: ['Tutela', 'Derecho de petición', 'Proceso ejecutivo', 'Penal', 'Familia', 'Laboral', 'Civil', 'Contratos', 'Sucesiones', 'Administrativo', 'Consulta'],
    fields: [
      { key: 'area', label: 'Área del derecho', type: 'select', options: ['Civil', 'Penal', 'Familia', 'Laboral', 'Seguridad social', 'Comercial', 'Administrativo', 'Constitucional', 'Tributario', 'Otro'] },
      { key: 'process', label: 'Tipo de proceso o trámite', placeholder: 'Ej. Proceso ejecutivo singular' },
      { key: 'filing', label: 'Radicado', placeholder: 'Ej. 76001-31-03-005-2026-00123-00' },
      { key: 'court', label: 'Despacho o entidad', placeholder: 'Ej. Juzgado 5 Civil del Circuito de Cali' },
      { key: 'counterpart', label: 'Contraparte', placeholder: 'Nombre de la contraparte' },
      { key: 'role', label: 'Calidad del cliente', type: 'select', options: ['Demandante', 'Demandado', 'Accionante', 'Accionado', 'Víctima', 'Indiciado / procesado', 'Peticionario', 'Solicitante', 'Otro'] },
      { key: 'stage', label: 'Etapa actual', placeholder: 'Ej. Notificación del mandamiento de pago', wide: true },
    ],
  },
  TECH_REPAIR: {
    key: 'TECH_REPAIR', label: 'Reparación técnica', examples: 'Celulares, computadores, electrodomésticos, relojes, consolas.',
    job: { singular: 'Orden de servicio', plural: 'Órdenes de servicio', nav: 'Órdenes de servicio', newLabel: 'Recibir equipo', titlePlaceholder: 'Ej. iPhone 11 · pantalla rota' },
    statuses: { QUOTE: 'Diagnóstico y cotización', OPEN: 'Recibido', IN_PROGRESS: 'En reparación', WAITING: 'Esperando repuesto o aprobación', READY: 'Listo para entregar', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' },
    quote: 'Cotización', dueLabel: 'Fecha prometida de entrega', appointment: 'Cita', appointments: 'Citas', customer: 'Cliente', hours: false, showWarranty: true, warrantyDays: 90, partsLabel: 'Repuestos',
    trackingLabel: 'Estado de mi reparación',
    categories: ['Pantalla', 'Batería', 'Pin de carga', 'Humedad', 'Software', 'Cámara', 'Audio', 'Placa', 'Otro'],
    fields: [
      { key: 'device', label: 'Tipo de equipo', type: 'select', options: ['Celular', 'Tablet', 'Computador portátil', 'Computador de escritorio', 'Reloj inteligente', 'Consola', 'Electrodoméstico', 'Otro'] },
      { key: 'brand', label: 'Marca', placeholder: 'Ej. Samsung' },
      { key: 'model', label: 'Modelo', placeholder: 'Ej. Galaxy A52' },
      { key: 'serial', label: 'IMEI o número de serie', placeholder: 'Para identificar el equipo' },
      { key: 'issue', label: 'Falla que reporta el cliente', type: 'area', wide: true },
      { key: 'condition', label: 'Estado físico al recibir', placeholder: 'Rayones, golpes, piezas faltantes…', wide: true },
      { key: 'accessories', label: 'Accesorios recibidos', placeholder: 'Cargador, estuche, SIM…' },
      { key: 'diagnosis', label: 'Diagnóstico técnico', type: 'area', wide: true },
    ],
  },
  BEAUTY: {
    key: 'BEAUTY', label: 'Belleza y estética', examples: 'Peluquerías, barberías, uñas, spa, estética.',
    job: { singular: 'Servicio', plural: 'Servicios realizados', nav: 'Fichas de clientes', newLabel: 'Nueva ficha', titlePlaceholder: 'Ej. Color y corte · Laura' },
    statuses: { ...BASE_STATUSES, OPEN: 'Agendado', IN_PROGRESS: 'En atención', READY: 'Terminado', DELIVERED: 'Pagado y cerrado' },
    quote: 'Presupuesto', dueLabel: 'Fecha del servicio', appointment: 'Cita', appointments: 'Citas', customer: 'Cliente', hours: false, showWarranty: false, warrantyDays: 0, partsLabel: 'Productos e insumos',
    trackingLabel: 'Consulta tu servicio',
    categories: ['Corte', 'Color', 'Tratamiento', 'Uñas', 'Depilación', 'Facial', 'Masaje', 'Maquillaje', 'Otro'],
    fields: [
      { key: 'professional', label: 'Profesional que atiende' },
      { key: 'products', label: 'Productos o fórmula usada', type: 'area', wide: true },
      { key: 'allergies', label: 'Alergias o cuidados especiales', wide: true },
      { key: 'next', label: 'Recomendación para la próxima visita', wide: true },
    ],
  },
  HEALTH: {
    key: 'HEALTH', label: 'Salud y bienestar', examples: 'Consultorios, terapeutas, nutricionistas, entrenadores.',
    job: { singular: 'Plan de atención', plural: 'Planes de atención', nav: 'Planes de atención', newLabel: 'Nuevo plan', titlePlaceholder: 'Ej. Plan de 8 sesiones de fisioterapia' },
    statuses: { ...BASE_STATUSES, OPEN: 'Activo', IN_PROGRESS: 'En curso', READY: 'Completado', DELIVERED: 'Cerrado' },
    quote: 'Presupuesto', dueLabel: 'Próxima revisión', appointment: 'Sesión', appointments: 'Sesiones', customer: 'Paciente o cliente', hours: false, showWarranty: false, warrantyDays: 0, partsLabel: 'Insumos',
    trackingLabel: 'Consulta tu plan',
    categories: ['Valoración', 'Terapia', 'Control', 'Plan nutricional', 'Entrenamiento', 'Otro'],
    fields: [
      { key: 'goal', label: 'Objetivo', wide: true },
      { key: 'sessions', label: 'Número de sesiones' },
      { key: 'notes', label: 'Observaciones (no incluyas diagnósticos sensibles si no es necesario)', type: 'area', wide: true },
    ],
  },
  HOME: {
    key: 'HOME', label: 'Servicios para el hogar', examples: 'Plomería, electricidad, aseo, mudanzas, jardinería, pintura.',
    job: { singular: 'Orden de trabajo', plural: 'Órdenes de trabajo', nav: 'Órdenes de trabajo', newLabel: 'Nueva orden', titlePlaceholder: 'Ej. Arreglo de fuga en cocina' },
    statuses: { ...BASE_STATUSES, OPEN: 'Programado', IN_PROGRESS: 'En ejecución', WAITING: 'En espera de materiales', READY: 'Terminado', DELIVERED: 'Entregado y recibido' },
    quote: 'Cotización', dueLabel: 'Fecha de la visita', appointment: 'Visita', appointments: 'Visitas', customer: 'Cliente', hours: true, showWarranty: true, warrantyDays: 30, partsLabel: 'Materiales',
    trackingLabel: 'Consulta tu servicio',
    categories: ['Plomería', 'Electricidad', 'Pintura', 'Aseo', 'Carpintería', 'Mudanza', 'Jardinería', 'Otro'],
    fields: [
      { key: 'address', label: 'Dirección del servicio', wide: true },
      { key: 'issue', label: 'Qué hay que hacer', type: 'area', wide: true },
      { key: 'access', label: 'Indicaciones de acceso', placeholder: 'Portería, horario, mascotas…', wide: true },
    ],
  },
  CONSULTING: {
    key: 'CONSULTING', label: 'Consultoría y servicios profesionales', examples: 'Contadores, diseñadores, agencias, arquitectos, programadores.',
    job: { singular: 'Proyecto', plural: 'Proyectos', nav: 'Proyectos', newLabel: 'Nuevo proyecto', titlePlaceholder: 'Ej. Declaración de renta 2026' },
    statuses: { ...BASE_STATUSES, QUOTE: 'Propuesta', OPEN: 'Por iniciar', IN_PROGRESS: 'En desarrollo', WAITING: 'Esperando al cliente', READY: 'Entregado para revisión', DELIVERED: 'Terminado' },
    quote: 'Propuesta', dueLabel: 'Fecha de entrega', appointment: 'Reunión', appointments: 'Reuniones', customer: 'Cliente', hours: true, showWarranty: false, warrantyDays: 0, partsLabel: null,
    trackingLabel: 'Consulta tu proyecto',
    categories: ['Contabilidad', 'Impuestos', 'Diseño', 'Marketing', 'Desarrollo', 'Asesoría', 'Otro'],
    fields: [
      { key: 'scope', label: 'Alcance', type: 'area', wide: true },
      { key: 'deliverables', label: 'Entregables', type: 'area', wide: true },
      { key: 'contact', label: 'Contacto del cliente' },
    ],
  },
  EDUCATION: {
    key: 'EDUCATION', label: 'Educación y clases', examples: 'Clases particulares, idiomas, música, cursos.',
    job: { singular: 'Inscripción', plural: 'Inscripciones', nav: 'Inscripciones', newLabel: 'Nueva inscripción', titlePlaceholder: 'Ej. Inglés intermedio · 12 clases' },
    statuses: { ...BASE_STATUSES, QUOTE: 'Interesado', OPEN: 'Inscrito', IN_PROGRESS: 'En clases', WAITING: 'En pausa', READY: 'Finalizado', DELIVERED: 'Certificado / cerrado' },
    quote: 'Propuesta', dueLabel: 'Fecha de finalización', appointment: 'Clase', appointments: 'Clases', customer: 'Estudiante', hours: true, showWarranty: false, warrantyDays: 0, partsLabel: 'Materiales',
    trackingLabel: 'Consulta tu inscripción',
    categories: ['Idiomas', 'Música', 'Refuerzo escolar', 'Curso', 'Taller', 'Otro'],
    fields: [{ key: 'level', label: 'Nivel' }, { key: 'schedule', label: 'Horario acordado' }, { key: 'progress', label: 'Avance', type: 'area', wide: true }],
  },
  OTHER: {
    key: 'OTHER', label: 'Otro servicio', examples: 'Cualquier negocio que presta servicios.',
    job: { singular: 'Trabajo', plural: 'Trabajos', nav: 'Trabajos', newLabel: 'Nuevo trabajo', titlePlaceholder: 'Describe el trabajo' },
    statuses: BASE_STATUSES, quote: 'Cotización', dueLabel: 'Fecha de entrega', appointment: 'Cita', appointments: 'Citas', customer: 'Cliente', hours: true, showWarranty: true, warrantyDays: 0, partsLabel: 'Materiales',
    trackingLabel: 'Consulta tu servicio', categories: ['General', 'Otro'],
    fields: [{ key: 'notes', label: 'Detalles', type: 'area', wide: true }],
  },
};

export const profileFor = (key?: string | null) => SERVICE_PROFILES[key ?? ''] ?? SERVICE_PROFILES.OTHER;
export const STATUS_ORDER: JobStatus[] = ['QUOTE', 'OPEN', 'IN_PROGRESS', 'WAITING', 'READY', 'DELIVERED', 'CANCELLED'];
export const STATUS_TONE: Record<JobStatus, 'warn' | 'ink' | 'muted' | 'ok' | 'bad' | 'sand'> = {
  QUOTE: 'sand', OPEN: 'muted', IN_PROGRESS: 'ink', WAITING: 'warn', READY: 'ok', DELIVERED: 'muted', CANCELLED: 'bad',
};
export const PRIORITY: Record<string, string> = { LOW: 'Baja', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' };
export const ITEM_KINDS: Record<string, string> = { SERVICE: 'Servicio / mano de obra', PART: 'Repuesto o material', FEE: 'Honorarios', EXPENSE: 'Gasto reembolsable' };
export const PRICING_UNITS: Record<string, string> = { FIXED: 'Precio fijo', HOUR: 'Por hora', SESSION: 'Por sesión', MONTH: 'Mensual' };
export const APPT_STATUS: Record<string, { label: string; tone: 'warn' | 'ink' | 'muted' | 'ok' | 'bad' | 'sand' }> = {
  SCHEDULED: { label: 'Agendada', tone: 'sand' }, CONFIRMED: { label: 'Confirmada', tone: 'ink' }, DONE: { label: 'Atendida', tone: 'ok' },
  CANCELLED: { label: 'Cancelada', tone: 'muted' }, NO_SHOW: { label: 'No asistió', tone: 'bad' },
};
export const MODALITY: Record<string, string> = { IN_PERSON: 'Presencial', VIRTUAL: 'Virtual', AT_HOME: 'A domicilio' };
