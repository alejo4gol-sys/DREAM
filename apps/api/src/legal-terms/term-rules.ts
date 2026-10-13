/**
 * Catálogo de términos de caducidad y prescripción en Colombia para abogados.
 * Contenido basado en la «Guía práctica sobre prescripción, caducidad y autoridades competentes en Colombia»
 * aportada por la usuaria (generada con Ariel, IA Legal), complementado con la norma que fija cada término.
 * Es una guía general: el cómputo concreto exige revisar hechos, pretensión y norma especial vigente.
 */

export type Area = 'CONTENCIOSO' | 'CONSTITUCIONAL' | 'CIVIL' | 'COMERCIAL' | 'LABORAL' | 'PENAL';
export type Phenomenon = 'CADUCIDAD' | 'PRESCRIPCION' | 'INMEDIATEZ' | 'SIN_TERMINO' | 'MIENTRAS_SUBSISTA' | 'PROCEDIBILIDAD';
export type Unit = 'YEARS' | 'MONTHS' | 'BUSINESS_DAYS';

export interface TermRule {
  key: string;
  area: Area;
  name: string;
  norm: string;
  phenomenon: Phenomenon;
  /** Duración del término; null cuando no hay término fijo. */
  term: { n: number; unit: Unit } | null;
  /** Qué fecha debe escribir la persona para iniciar el cómputo. */
  startLabel: string;
  /** El término corre desde el día siguiente al evento. */
  nextDay: boolean;
  /** Si vence en día inhábil se extiende al siguiente día hábil (art. 62 Ley 4 de 1913). */
  extendToBusinessDay: boolean;
  /** Término ante jueces: la vacancia judicial cuenta como tiempo inhábil. */
  judicial?: boolean;
  /** Meses que se suman antes del término (p. ej. plazos de liquidación del contrato). */
  offsetMonths?: { n: number; label: string };
  suspension?: { label: string; help: string; maxMonths?: number };
  interruption?: { mode: 'RESTART' | 'PENAL_HALF'; label: string; help: string };
  penal?: boolean;
  summary: string;
  authority: string;
  prerequisites: string[];
  notes: string[];
}

const CONCILIACION_CA = { label: 'Solicitud de conciliación extrajudicial (Ministerio Público)', help: 'La solicitud suspende el término hasta el acuerdo, la constancia de no acuerdo o el vencimiento del término legal del trámite. Escribe la fecha de radicación y la de la constancia o acta.', maxMonths: 3 };
const CONCILIACION_CIVIL = { label: 'Solicitud de conciliación extrajudicial', help: 'La solicitud de conciliación suspende la prescripción o la caducidad hasta el acuerdo, la constancia o el vencimiento del término legal del trámite (Ley 2220 de 2022).', maxMonths: 3 };

export const TERM_RULES: TermRule[] = [
  // ───────────── Contencioso administrativo ─────────────
  {
    key: 'CA_NULIDAD', area: 'CONTENCIOSO', name: 'Nulidad simple', norm: 'Art. 137 y 164 num. 1 CPACA (Ley 1437 de 2011)', phenomenon: 'SIN_TERMINO', term: null,
    startLabel: 'Fecha de publicación del acto general', nextDay: false, extendToBusinessDay: false,
    summary: 'Nulidad de actos administrativos de carácter general. Como regla puede ejercerse en cualquier tiempo, salvo excepciones legales (actos electorales, precontractuales, reformas constitucionales).',
    authority: 'Consejo de Estado si el acto general es de autoridad nacional; tribunales y jueces administrativos en los demás casos, según la autoridad que lo expidió.',
    prerequisites: ['Por regla general no requiere agotar vía administrativa ni conciliación prejudicial.'],
    notes: ['Generalmente no caduca, salvo excepciones expresas.'],
  },
  {
    key: 'CA_NRD', area: 'CONTENCIOSO', name: 'Nulidad y restablecimiento del derecho', norm: 'Art. 138 y 164 num. 2 lit. d CPACA', phenomenon: 'CADUCIDAD', term: { n: 4, unit: 'MONTHS' },
    startLabel: 'Fecha de notificación, comunicación, publicación o ejecución del acto', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CA,
    summary: 'Contra actos administrativos particulares que lesionan un derecho subjetivo. 4 meses desde el día siguiente a la notificación, comunicación, publicación o ejecución del acto.',
    authority: 'Juzgados o tribunales administrativos según cuantía, territorio y autoridad que expidió el acto. El Consejo de Estado conoce ciertos asuntos de autoridad nacional o en segunda instancia.',
    prerequisites: ['Agotar el recurso administrativo obligatorio cuando proceda.', 'En asuntos conciliables, conciliación extrajudicial ante el Ministerio Público (requisito de procedibilidad).'],
    notes: ['Si el daño proviene directamente de un acto administrativo particular, normalmente corresponde este medio de control; no puede usarse reparación directa para eludir su caducidad.'],
  },
  {
    key: 'CA_REPARACION', area: 'CONTENCIOSO', name: 'Reparación directa', norm: 'Art. 140 y 164 num. 2 lit. i CPACA', phenomenon: 'CADUCIDAD', term: { n: 2, unit: 'YEARS' },
    startLabel: 'Fecha del hecho dañoso (o del conocimiento del daño, si fue posterior y se acredita que no pudo conocerse antes)', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CA,
    summary: 'Indemnización por daños antijurídicos causados por hechos, omisiones, operaciones administrativas u ocupación de inmuebles imputables al Estado. 2 años.',
    authority: 'Juez o tribunal administrativo según cuantía y territorio. El Consejo de Estado conoce en segunda instancia y ciertos asuntos de competencia originaria.',
    prerequisites: ['Conciliación extrajudicial ante el Ministerio Público cuando el asunto sea conciliable.', 'No se exige agotar recursos administrativos.'],
    notes: ['Si el daño proviene de un hecho, omisión u operación administrativa, normalmente corresponde reparación directa.'],
  },
  {
    key: 'CA_CONTRACTUAL', area: 'CONTENCIOSO', name: 'Controversias contractuales (regla general)', norm: 'Art. 141 y 164 num. 2 lit. j CPACA', phenomenon: 'CADUCIDAD', term: { n: 2, unit: 'YEARS' },
    startLabel: 'Fecha de los motivos de hecho o de derecho que sirven de fundamento (según el tipo de contrato)', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CA,
    summary: 'Existencia, nulidad, incumplimiento, revisión, indemnización, nulidad de actos contractuales y liquidación judicial de contratos estatales. 2 años, con reglas especiales según el contrato y su liquidación.',
    authority: 'Juzgados, tribunales administrativos y Consejo de Estado según cuantía, territorio, entidad e instancia; tribunal de arbitramento si hay cláusula compromisoria válida.',
    prerequisites: ['Conciliación extrajudicial cuando la controversia sea conciliable.', 'Revisar si el contrato debía liquidarse (usa las reglas de liquidación).'],
    notes: ['Si el daño proviene de un contrato estatal, normalmente corresponde controversias contractuales.'],
  },
  {
    key: 'CA_CONTRACTUAL_LIQ', area: 'CONTENCIOSO', name: 'Controversias contractuales — contrato liquidado', norm: 'Art. 164 num. 2 lit. j CPACA', phenomenon: 'CADUCIDAD', term: { n: 2, unit: 'YEARS' },
    startLabel: 'Fecha de firma del acta de liquidación bilateral (o ejecutoria del acto de liquidación unilateral)', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CA,
    summary: 'Como regla, los 2 años se cuentan desde el día siguiente a la firma del acta de liquidación.',
    authority: 'Jurisdicción contencioso-administrativa; eventualmente tribunal de arbitramento si existe cláusula compromisoria válida.',
    prerequisites: ['Revisar contrato, acta de liquidación, liquidación unilateral y fechas legales de liquidación.', 'Conciliación extrajudicial cuando sea conciliable.'],
    notes: [],
  },
  {
    key: 'CA_CONTRACTUAL_SIN_LIQ', area: 'CONTENCIOSO', name: 'Controversias contractuales — contrato no liquidado', norm: 'Art. 164 num. 2 lit. j CPACA; art. 11 Ley 1150 de 2007', phenomenon: 'CADUCIDAD', term: { n: 2, unit: 'YEARS' },
    startLabel: 'Fecha de terminación o vencimiento del plazo de ejecución del contrato', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CA,
    offsetMonths: { n: 6, label: '4 meses para liquidación bilateral + 2 meses para liquidación unilateral' },
    summary: 'El cómputo inicia después del término de liquidación bilateral (4 meses) y del término legal de liquidación unilateral (2 meses); luego corren 2 años para demandar.',
    authority: 'Juez o tribunal administrativo; puede pedirse la liquidación judicial mediante controversias contractuales.',
    prerequisites: ['Verificar si el contrato fijó otro término de liquidación (ajusta los meses).', 'Verificar si hubo liquidación unilateral y si se presentó conciliación prejudicial.'],
    notes: ['Si el contrato fijó un plazo de liquidación distinto, cambia los meses previos antes de calcular.'],
  },
  {
    key: 'CA_PRECONTRACTUAL', area: 'CONTENCIOSO', name: 'Nulidad de actos precontractuales', norm: 'Art. 141 y 164 num. 2 lit. c CPACA', phenomenon: 'CADUCIDAD', term: { n: 4, unit: 'MONTHS' },
    startLabel: 'Fecha de notificación, publicación, comunicación o ejecución del acto', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CA,
    summary: 'Actos previos a la celebración del contrato, mediante nulidad o nulidad y restablecimiento. 4 meses.',
    authority: 'Juez o tribunal administrativo según competencia.',
    prerequisites: ['Elegir correctamente el medio de control: no procede reparación directa para reemplazar la nulidad y restablecimiento cuando el daño proviene de un acto.'],
    notes: [],
  },
  {
    key: 'CA_ELECTORAL', area: 'CONTENCIOSO', name: 'Nulidad electoral', norm: 'Art. 139 y 164 num. 2 lit. a CPACA', phenomenon: 'CADUCIDAD', term: { n: 30, unit: 'BUSINESS_DAYS' },
    startLabel: 'Fecha de publicación o declaración del acto de elección, nombramiento o llamamiento', nextDay: true, extendToBusinessDay: true,
    summary: '30 días desde la publicación del acto de elección, nombramiento o llamamiento, con reglas particulares según el tipo de elección.',
    authority: 'Consejo de Estado en elecciones nacionales; tribunales administrativos en los demás eventos.',
    prerequisites: ['No requiere conciliación prejudicial.', 'Observar legitimación, demanda en forma y reglas especiales electorales.'],
    notes: ['Los plazos de días en la ley se cuentan en días hábiles (art. 62 Ley 4 de 1913).'],
  },
  {
    key: 'CA_REPETICION', area: 'CONTENCIOSO', name: 'Repetición', norm: 'Art. 142 y 164 num. 2 lit. l CPACA', phenomenon: 'CADUCIDAD', term: { n: 2, unit: 'YEARS' },
    startLabel: 'Fecha del pago total (o del vencimiento del plazo para pagar la condena)', nextDay: true, extendToBusinessDay: true,
    summary: 'La entidad busca recuperar lo pagado por condena, conciliación u otra forma de reparación cuando el agente actuó con dolo o culpa grave. 2 años.',
    authority: 'Jurisdicción de lo contencioso administrativo.',
    prerequisites: ['Acreditar el pago, la condena o el acuerdo, y la conducta dolosa o gravemente culposa del agente.'],
    notes: [],
  },

  {
    key: 'PETICION_RESPUESTA', area: 'CONTENCIOSO', name: 'Plazo para responder un derecho de petición', norm: 'Art. 14 CPACA (sustituido por la Ley 1755 de 2015)', phenomenon: 'PROCEDIBILIDAD', term: { n: 15, unit: 'BUSINESS_DAYS' },
    startLabel: 'Fecha de radicación de la petición', nextDay: true, extendToBusinessDay: true, judicial: false,
    summary: 'Por regla general la autoridad debe responder dentro de los 15 días hábiles siguientes a la recepción (10 días para documentos e información y 30 para consultas). Si no responde, puede acudirse a la tutela.',
    authority: 'La entidad o particular a quien se dirigió la petición.', prerequisites: [], notes: ['Para solicitudes de documentos el plazo es de 10 días y para consultas de 30 días.'],
  },
  {
    key: 'RECURSOS_CPACA', area: 'CONTENCIOSO', name: 'Recursos contra un acto administrativo (reposición y apelación)', norm: 'Art. 76 CPACA', phenomenon: 'CADUCIDAD', term: { n: 10, unit: 'BUSINESS_DAYS' },
    startLabel: 'Fecha de la notificación personal (o de la desfijación del aviso)', nextDay: true, extendToBusinessDay: true, judicial: false,
    summary: 'Los recursos deben interponerse por escrito dentro de los 10 días siguientes a la notificación. Cuando la apelación es obligatoria, no interponerla impide luego demandar.',
    authority: 'Ante el funcionario que dictó la decisión (reposición) o su superior (apelación).', prerequisites: [], notes: [],
  },

  // ───────────── Constitucional ─────────────
  {
    key: 'TUTELA', area: 'CONSTITUCIONAL', name: 'Acción de tutela', norm: 'Art. 86 Constitución; Decreto 2591 de 1991', phenomenon: 'INMEDIATEZ', term: null,
    startLabel: 'Fecha de la vulneración o amenaza del derecho', nextDay: false, extendToBusinessDay: false,
    summary: 'No tiene término de caducidad fijo, pero debe presentarse en un plazo razonable (inmediatez). Puede ejercerse en todo momento y lugar.',
    authority: 'Cualquier juez de la República, según las reglas de reparto. Las decisiones pueden impugnarse y ser seleccionadas para revisión por la Corte Constitucional.',
    prerequisites: ['Subsidiariedad: que no exista otro medio judicial idóneo y eficaz, salvo como mecanismo transitorio ante perjuicio irremediable.', 'No es obligatorio agotar recursos administrativos.', 'Identificar accionante y accionado, hechos, derechos vulnerados, pretensión y pruebas.'],
    notes: ['No debe usarse para sustituir procesos ordinarios, corregir negligencias procesales ni revivir términos vencidos.', 'DREAMS muestra el tiempo transcurrido para que valores la inmediatez.'],
  },
  {
    key: 'POPULAR', area: 'CONSTITUCIONAL', name: 'Acción popular', norm: 'Art. 88 Constitución; Ley 472 de 1998', phenomenon: 'MIENTRAS_SUBSISTA', term: null,
    startLabel: 'Fecha desde la que existe la amenaza o vulneración', nextDay: false, extendToBusinessDay: false,
    summary: 'Protege derechos e intereses colectivos. Puede promoverse mientras subsista la amenaza o vulneración.',
    authority: 'Jurisdicción contencioso-administrativa si proviene de una entidad pública o particular con función administrativa; jurisdicción ordinaria civil en los demás casos (jueces administrativos y civiles del circuito en primera instancia).',
    prerequisites: ['No es necesario agotar recursos administrativos.', 'Identificar el derecho colectivo, hechos, pretensiones, responsable si es posible, pruebas y direcciones.'],
    notes: ['Puede presentarse directamente; la Defensoría del Pueblo puede ayudar a elaborarla.'],
  },
  {
    key: 'GRUPO', area: 'CONSTITUCIONAL', name: 'Acción de grupo', norm: 'Art. 88 Constitución; arts. 46 a 69 Ley 472 de 1998', phenomenon: 'CADUCIDAD', term: { n: 2, unit: 'YEARS' },
    startLabel: 'Fecha en que se causó el daño o cesó la acción vulnerante', nextDay: true, extendToBusinessDay: true,
    summary: 'Indemnización de perjuicios individuales de un grupo (como regla, al menos 20 personas) con condiciones uniformes respecto de una misma causa. 2 años.',
    authority: 'Jueces administrativos si el origen es de entidades públicas o particulares con función administrativa; jueces civiles del circuito en los demás casos.',
    prerequisites: ['Demanda por abogado.', 'Identificar integrantes o criterios para identificarlos, hechos, perjuicios, demandado, pretensiones y pruebas.', 'La conciliación previa debe analizarse según la Ley 472 y la Ley 2220 de 2022; no asumir que siempre es requisito.'],
    notes: [],
  },
  {
    key: 'CUMPLIMIENTO', area: 'CONSTITUCIONAL', name: 'Acción de cumplimiento', norm: 'Art. 87 Constitución; Ley 393 de 1997', phenomenon: 'SIN_TERMINO', term: null,
    startLabel: 'Fecha de la solicitud de cumplimiento', nextDay: false, extendToBusinessDay: false,
    summary: 'Hacer efectivo el cumplimiento de una norma con fuerza de ley o de un acto administrativo. Puede ejercerse en cualquier tiempo mientras subsista el incumplimiento.',
    authority: 'Juez administrativo en primera instancia; Consejo de Estado en segunda instancia en los eventos legales.',
    prerequisites: ['Constituir en renuencia: pedir el cumplimiento y esperar la negativa o 10 días sin respuesta (usa «Renuencia — acción de cumplimiento»).', 'No procede para normas que establecen gastos ni si existe otro medio judicial idóneo.'],
    notes: ['No tiene finalidad indemnizatoria ni revive términos vencidos.'],
  },
  {
    key: 'CUMPLIMIENTO_RENUENCIA', area: 'CONSTITUCIONAL', name: 'Renuencia — acción de cumplimiento', norm: 'Art. 8 Ley 393 de 1997', phenomenon: 'PROCEDIBILIDAD', term: { n: 10, unit: 'BUSINESS_DAYS' },
    startLabel: 'Fecha de radicación de la solicitud de cumplimiento', nextDay: true, extendToBusinessDay: true,
    summary: 'La autoridad tiene 10 días para responder. Si se niega o no contesta, queda constituida en renuencia y puedes demandar desde el día siguiente.',
    authority: 'Se dirige a la autoridad o particular obligado.',
    prerequisites: [], notes: ['Puede omitirse si su agotamiento genera un perjuicio irremediable, que debe explicarse y probarse.'],
  },
  {
    key: 'INCONST_FORMA', area: 'CONSTITUCIONAL', name: 'Inconstitucionalidad por vicios de forma / actos legislativos', norm: 'Arts. 241 y 242 num. 3 Constitución; Decreto 2067 de 1991', phenomenon: 'CADUCIDAD', term: { n: 1, unit: 'YEARS' },
    startLabel: 'Fecha de publicación o promulgación', nextDay: true, extendToBusinessDay: true,
    summary: 'Las acciones por vicios de forma y contra actos legislativos caducan en 1 año desde la publicación. Por razones de fondo contra leyes no hay término ordinario.',
    authority: 'Corte Constitucional.',
    prerequisites: ['Norma acusada transcrita, normas constitucionales infringidas, concepto de violación y competencia de la Corte.', 'Cargos claros, ciertos, específicos, pertinentes y suficientes.', 'Ciudadano colombiano en ejercicio de sus derechos políticos.'],
    notes: [],
  },

  // ───────────── Civil ─────────────
  {
    key: 'CIVIL_EJECUTIVA', area: 'CIVIL', name: 'Acción ejecutiva civil', norm: 'Art. 2536 Código Civil (mod. Ley 791 de 2002)', phenomenon: 'PRESCRIPCION', term: { n: 5, unit: 'YEARS' },
    startLabel: 'Fecha en que la obligación se hizo exigible', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CIVIL,
    interruption: { mode: 'RESTART', label: 'Interrupción (reconocimiento del deudor o demanda notificada a tiempo, art. 94 CGP)', help: 'Desde la interrupción vuelve a correr el término completo.' },
    summary: 'Prescribe en 5 años desde que la obligación es exigible. Vencida, la acción ejecutiva se convierte en ordinaria por el lapso restante.',
    authority: 'Juez civil municipal o del circuito, según cuantía y competencia.',
    prerequisites: ['La prescripción debe alegarse por acción o excepción; no la declara el juez de oficio.'],
    notes: ['Cuantía: mínima hasta 40 SMMLV, menor de 40 a 150, mayor más de 150 (art. 25 CGP).'],
  },
  {
    key: 'CIVIL_ORDINARIA', area: 'CIVIL', name: 'Acción ordinaria civil (declarativo)', norm: 'Art. 2536 Código Civil (mod. Ley 791 de 2002)', phenomenon: 'PRESCRIPCION', term: { n: 10, unit: 'YEARS' },
    startLabel: 'Fecha en que la obligación se hizo exigible', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CIVIL,
    interruption: { mode: 'RESTART', label: 'Interrupción (reconocimiento del deudor o demanda notificada a tiempo, art. 94 CGP)', help: 'Desde la interrupción vuelve a correr el término completo.' },
    summary: 'Regla general de 10 años, salvo término especial. En responsabilidad civil, acciones posesorias, familia, sucesiones, deslinde, división y pertenencia revisa la norma especial.',
    authority: 'Juez civil municipal o del circuito, según cuantía, naturaleza y territorio.',
    prerequisites: ['Conciliación extrajudicial como requisito de procedibilidad en asuntos conciliables (salvo divisorios, expropiación, monitorios, citación de indeterminados, restitución de inmueble arrendado, títulos valores o cuando se pidan medidas cautelares).'],
    notes: ['No asumas automáticamente 10 años en responsabilidad civil: existen términos especiales.'],
  },

  // ───────────── Comercial ─────────────
  {
    key: 'COM_SOCIOS', area: 'COMERCIAL', name: 'Acciones entre asociados por razón de la sociedad', norm: 'Art. 256 Código de Comercio', phenomenon: 'PRESCRIPCION', term: { n: 5, unit: 'YEARS' },
    startLabel: 'Fecha de disolución de la sociedad', nextDay: true, extendToBusinessDay: true,
    summary: '5 años desde la disolución de la sociedad.', authority: 'Juez civil o Superintendencia de Sociedades en conflictos societarios atribuidos por la ley; tribunal de arbitramento si hay pacto.',
    prerequisites: [], notes: [],
  },
  {
    key: 'COM_LIQUIDADORES', area: 'COMERCIAL', name: 'Acciones contra liquidadores', norm: 'Art. 256 Código de Comercio', phenomenon: 'PRESCRIPCION', term: { n: 5, unit: 'YEARS' },
    startLabel: 'Fecha de aprobación de la cuenta final de liquidación', nextDay: true, extendToBusinessDay: true,
    summary: '5 años desde la aprobación de la cuenta final de liquidación.', authority: 'Juez civil o Superintendencia de Sociedades según competencia.', prerequisites: [], notes: [],
  },
  {
    key: 'COM_LEY222', area: 'COMERCIAL', name: 'Infracciones del Libro II C. de Co. y Ley 222 de 1995', norm: 'Art. 235 Ley 222 de 1995', phenomenon: 'PRESCRIPCION', term: { n: 5, unit: 'YEARS' },
    startLabel: 'Fecha de la infracción', nextDay: true, extendToBusinessDay: true,
    summary: 'Regla general de 5 años, salvo disposición especial.', authority: 'Juez civil o Superintendencia de Sociedades.', prerequisites: [], notes: [],
  },
  {
    key: 'COM_SEGURO_ORD', area: 'COMERCIAL', name: 'Contrato de seguro — prescripción ordinaria', norm: 'Art. 1081 Código de Comercio', phenomenon: 'PRESCRIPCION', term: { n: 2, unit: 'YEARS' },
    startLabel: 'Fecha en que el interesado conoció o debió conocer el hecho que da base a la acción', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CIVIL,
    summary: '2 años desde que el interesado conoció o debió conocer el hecho.', authority: 'Juez civil competente o Superintendencia Financiera en funciones jurisdiccionales.', prerequisites: [],
    notes: ['Calcula también la extraordinaria (5 años desde el nacimiento del derecho) y toma la que venza primero.'],
  },
  {
    key: 'COM_SEGURO_EXT', area: 'COMERCIAL', name: 'Contrato de seguro — prescripción extraordinaria', norm: 'Art. 1081 Código de Comercio', phenomenon: 'PRESCRIPCION', term: { n: 5, unit: 'YEARS' },
    startLabel: 'Fecha del nacimiento del derecho (siniestro)', nextDay: true, extendToBusinessDay: true, suspension: CONCILIACION_CIVIL,
    summary: '5 años desde el nacimiento del derecho, corre contra toda clase de personas.', authority: 'Juez civil competente o Superintendencia Financiera en funciones jurisdiccionales.', prerequisites: [], notes: [],
  },
  {
    key: 'COM_CAMBIARIA_DIRECTA', area: 'COMERCIAL', name: 'Títulos valores — acción cambiaria directa', norm: 'Art. 789 Código de Comercio', phenomenon: 'PRESCRIPCION', term: { n: 3, unit: 'YEARS' },
    startLabel: 'Fecha de vencimiento del título', nextDay: false, extendToBusinessDay: true,
    interruption: { mode: 'RESTART', label: 'Interrupción (demanda notificada a tiempo, art. 94 CGP)', help: 'Desde la interrupción vuelve a correr el término.' },
    summary: 'La acción cambiaria directa prescribe en 3 años a partir del vencimiento. Las demás acciones cambiarias tienen reglas especiales: revisa el título concreto.',
    authority: 'Juez civil municipal o del circuito según cuantía.', prerequisites: [], notes: [],
  },

  // ───────────── Laboral ─────────────
  {
    key: 'LAB_GENERAL', area: 'LABORAL', name: 'Acreencias laborales (salarios, prestaciones, indemnizaciones)', norm: 'Art. 488 CST y art. 151 CPTSS', phenomenon: 'PRESCRIPCION', term: { n: 3, unit: 'YEARS' },
    startLabel: 'Fecha en que la obligación se hizo exigible', nextDay: true, extendToBusinessDay: true,
    interruption: { mode: 'RESTART', label: 'Reclamo escrito del trabajador recibido por el empleador', help: 'Interrumpe por una sola vez y por un lapso igual (3 años desde el reclamo), solo respecto del derecho concreta y claramente determinado.' },
    summary: '3 años desde que cada obligación se hace exigible. El reclamo escrito interrumpe por una sola vez.',
    authority: 'Juez laboral del circuito (o municipal donde exista y le corresponda).',
    prerequisites: ['La conciliación extrajudicial laboral no es, por regla general, requisito de procedibilidad.'],
    notes: ['Calcula un término por cada obligación (cada salario o prestación tiene su propia fecha de exigibilidad).'],
  },
  {
    key: 'LAB_PUBLICO', area: 'LABORAL', name: 'Acreencias laborales de servidores públicos', norm: 'Art. 41 Decreto 3135 de 1968; art. 102 Decreto 1848 de 1969', phenomenon: 'PRESCRIPCION', term: { n: 3, unit: 'YEARS' },
    startLabel: 'Fecha en que la obligación se hizo exigible', nextDay: true, extendToBusinessDay: true,
    interruption: { mode: 'RESTART', label: 'Reclamo escrito ante la entidad', help: 'Interrumpe por una sola vez y por un lapso igual.' },
    summary: 'Regla general de 3 años, sin perjuicio de términos especiales.',
    authority: 'Juez administrativo si es relación legal y reglamentaria; juez laboral en los asuntos de su competencia.',
    prerequisites: ['Si se demanda un acto administrativo, revisa también la caducidad de la nulidad y restablecimiento.'], notes: [],
  },
  {
    key: 'LAB_MESADAS', area: 'LABORAL', name: 'Mesadas pensionales causadas', norm: 'Art. 488 CST y art. 151 CPTSS', phenomenon: 'PRESCRIPCION', term: { n: 3, unit: 'YEARS' },
    startLabel: 'Fecha en que se causó la mesada', nextDay: true, extendToBusinessDay: true,
    interruption: { mode: 'RESTART', label: 'Reclamación escrita ante la entidad', help: 'Interrumpe por una sola vez y por un lapso igual.' },
    summary: 'Debe distinguirse el derecho pensional (protección especial) de las mesadas causadas, que pueden prescribir.',
    authority: 'Juez laboral o administrativo, según el régimen y el vínculo.', prerequisites: [], notes: [],
  },

  // ───────────── Penal ─────────────
  {
    key: 'PENAL_ACCION', area: 'PENAL', name: 'Prescripción de la acción penal', norm: 'Arts. 83 y 84 Código Penal; art. 292 Ley 906 de 2004', phenomenon: 'PRESCRIPCION', term: null, penal: true,
    startLabel: 'Fecha de consumación (instantáneos), del último acto (permanentes o tentados) o del cese del deber de actuar (omisivos)', nextDay: false, extendToBusinessDay: false,
    interruption: { mode: 'PENAL_HALF', label: 'Formulación de imputación', help: 'Interrumpe la prescripción; vuelve a correr un término igual a la mitad del inicial, que no puede ser inferior a 3 años.' },
    summary: 'Término igual al máximo de la pena privativa de la libertad, nunca inferior a 5 ni superior a 20 años, salvo excepciones (30 años o imprescriptibilidad).',
    authority: 'Fiscalía General de la Nación (investiga y acusa); juez de control de garantías; juez penal municipal o del circuito según el delito; Tribunal Superior y Corte Suprema en lo de su competencia.',
    prerequisites: ['Verificar si el delito es querellable (caducidad de la querella de 6 meses).'],
    notes: ['Genocidio, lesa humanidad, crímenes de guerra y determinadas conductas sexuales contra menores son imprescriptibles.', 'Si la conducta la cometió un servidor público en ejercicio de sus funciones, el término se aumenta en una tercera parte (art. 83 C.P.).'],
  },
  {
    key: 'PENAL_QUERELLA', area: 'PENAL', name: 'Caducidad de la querella', norm: 'Arts. 73 y 74 Ley 906 de 2004', phenomenon: 'CADUCIDAD', term: { n: 6, unit: 'MONTHS' },
    startLabel: 'Fecha de comisión de la conducta (o desde que desapareció la fuerza mayor o caso fortuito que impidió conocerla)', nextDay: true, extendToBusinessDay: true,
    summary: 'La querella debe presentarse dentro de los 6 meses siguientes a la comisión de la conducta.',
    authority: 'Fiscalía General de la Nación o Policía Judicial; conoce el juez penal competente.',
    prerequisites: ['En algunos delitos querellables es obligatoria la conciliación para continuar la actuación.', 'No se requiere querella en flagrancia, víctimas menores de edad, inimputables o ciertos casos de violencia contra la mujer.'],
    notes: ['La caducidad de la querella es distinta de la prescripción de la acción penal.'],
  },
];

export const AREAS: Record<Area, string> = {
  CONTENCIOSO: 'Contencioso administrativo', CONSTITUCIONAL: 'Constitucional', CIVIL: 'Civil', COMERCIAL: 'Comercial y societario', LABORAL: 'Laboral', PENAL: 'Penal y querellas',
};
export const PHENOMENA: Record<Phenomenon, { label: string; help: string }> = {
  CADUCIDAD: { label: 'Caducidad', help: 'Vencimiento de un término legal, generalmente perentorio, para ejercer la acción. Configurada, el juez rechaza la demanda o declara que no puede prosperar. No depende de la voluntad de las partes.' },
  PRESCRIPCION: { label: 'Prescripción', help: 'Extingue la posibilidad de exigir judicialmente un derecho por el tiempo y la inactividad del titular. Por regla general debe alegarse; en civil, como excepción, o se entiende renunciada.' },
  INMEDIATEZ: { label: 'Inmediatez', help: 'Sin término fijo: debe ejercerse en un plazo razonable.' },
  SIN_TERMINO: { label: 'Sin término general', help: 'Puede ejercerse en cualquier tiempo, salvo excepciones.' },
  MIENTRAS_SUBSISTA: { label: 'Mientras subsista', help: 'Puede ejercerse mientras subsista la amenaza o vulneración.' },
  PROCEDIBILIDAD: { label: 'Requisito previo', help: 'Plazo que debe cumplirse antes de poder demandar.' },
};

export const GUIDE = {
  title: 'Guía práctica sobre prescripción, caducidad y autoridades competentes en Colombia',
  credit: 'Contenido aportado por la usuaria (guía generada con Ariel, IA Legal — arielapp.co) y organizado en DREAMS.',
  fundamentals: [
    { name: 'Caducidad', text: PHENOMENA.CADUCIDAD.help + ' El Consejo de Estado la describe como un límite objetivo para acudir oportunamente ante los jueces.' },
    { name: 'Prescripción extintiva', text: PHENOMENA.PRESCRIPCION.help },
    { name: 'Suspensión', text: 'El término deja de correr temporalmente y continúa después con el tiempo restante. Ejemplo: solicitud de conciliación prejudicial en asuntos contencioso-administrativos conciliables.' },
    { name: 'Interrupción', text: 'El término vuelve a comenzar según la regla especial aplicable. Ejemplos: reclamación escrita laboral o formulación de imputación en materia penal.' },
  ],
  warning: 'El término no siempre se cuenta desde la fecha del hecho: puede iniciar desde la notificación de un acto, la exigibilidad de una obligación, la liquidación contractual, el conocimiento del daño o la formulación de imputación.',
  practicalRule: [
    'Si el daño proviene directamente de un acto administrativo particular → nulidad y restablecimiento del derecho.',
    'Si proviene de un hecho, omisión u operación administrativa → reparación directa.',
    'Si proviene de un contrato estatal → controversias contractuales.',
    'Los medios de control tienen términos diferentes y no se puede usar uno para eludir la caducidad del otro.',
  ],
  conciliationCA: 'En asuntos conciliables, la conciliación extrajudicial ante el Ministerio Público es requisito de procedibilidad para nulidad y restablecimiento, reparación directa y controversias contractuales. Suspende la caducidad hasta el acuerdo, la constancia de no acuerdo o el vencimiento del término legal. Revisa las excepciones: asuntos no conciliables, algunas materias tributarias, solicitud de medidas cautelares y casos en que la ley permite acudir directamente.',
  conciliationCivil: 'En civil la conciliación extrajudicial es, por regla general, requisito de procedibilidad para procesos declarativos conciliables. Excepciones: divisorios, expropiación, monitorios, citación de indeterminados, restitución de inmueble arrendado, títulos valores y cuando se pidan medidas cautelares. Se adelanta ante centros de conciliación, notarios, Defensoría del Pueblo, Ministerio Público y, subsidiariamente, personeros o jueces civiles o promiscuos municipales.',
  cuantias: 'Mínima cuantía: hasta 40 SMMLV · Menor: más de 40 y hasta 150 SMMLV · Mayor: más de 150 SMMLV (art. 25 CGP). Los jueces civiles municipales conocen mínima y determinados asuntos de menor cuantía; los del circuito, mayor cuantía.',
  commercialAuthorities: ['Juez civil municipal o del circuito, según cuantía y naturaleza.', 'Superintendencia de Sociedades, en conflictos societarios atribuidos por la ley.', 'Superintendencia de Industria y Comercio, en competencia desleal, propiedad industrial y protección al consumidor.', 'Tribunal de arbitramento, si hay cláusula compromisoria o compromiso válido.'],
  laborAuthorities: ['Jueces laborales del circuito: la generalidad de procesos ordinarios.', 'Jueces laborales municipales, donde existan.', 'Jueces administrativos: servidores públicos con relación legal y reglamentaria.', 'Ministerio del Trabajo: inspección, vigilancia y sanción; no declara derechos económicos en controversia.'],
  checklist: [
    'Fecha exacta del hecho.', 'Fecha de conocimiento del daño, si fue posterior.', 'Fecha de notificación, publicación o comunicación del acto administrativo.',
    'Fecha de exigibilidad de la obligación.', 'Fecha de terminación o liquidación del contrato estatal.',
    'Si hubo reclamación escrita, conciliación, demanda, imputación u otro acto que suspenda o interrumpa el término.',
    'Naturaleza de las partes: particulares, entidad pública, servidor público, menor de edad, aforado o régimen especial.',
    'Cuantía del asunto: mínima, menor o mayor.', 'Territorio: domicilio del demandado, lugar de los hechos o de cumplimiento.',
    'Existencia de fuero especial o cláusula compromisoria.', 'Si el delito es de oficio o querellable.',
    'Requisito previo: conciliación, renuencia, recurso administrativo obligatorio o reclamación administrativa.',
    'Medio de control o acción correcta (una acción equivocada puede llevar al rechazo por caducidad).',
    'Pruebas de la fecha de inicio: notificaciones, constancias, contratos, historias laborales, denuncias, actas y documentos de conciliación.',
  ],
  conclusion: 'En contencioso administrativo predominan términos de caducidad; en civil, comercial y laboral, de prescripción; en constitucional hay reglas especiales (tutela sin término fijo, acción popular mientras subsista la amenaza, acción de grupo de dos años, inconstitucionalidad con caducidad para actos legislativos y vicios de forma). Esta guía es general: el vencimiento concreto exige calcular con calendario, notificación, suspensiones, interrupciones y normas vigentes.',
};
