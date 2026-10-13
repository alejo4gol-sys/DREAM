/**
 * Orientación jurídica general para personas (micro app «Tu Derecho»).
 * Es orientación, no asesoría: explica rutas posibles en lenguaje sencillo, dónde acudir gratis y qué documentos reunir.
 * Los términos se calculan con el motor de legal-terms cuando la persona da una fecha.
 */

export interface Question { key: string; text: string; help?: string; type: 'choice' | 'date'; options?: { v: string; label: string }[]; showIf?: Record<string, string[]>; optional?: boolean }
export interface Topic { key: string; label: string; hint: string; questions: Question[] }
export interface Route {
  title: string; what: string; where: string[]; docs?: string[]; urgent?: boolean; noLawyerNeeded?: boolean;
  ruleKey?: string; dateKey?: string; dateLabel?: string;
}
export interface Orientation { headline: string; routes: Route[]; emergency?: { text: string; lines: { label: string; phone: string }[] }; notes: string[] }

const YES_NO = [{ v: 'SI', label: 'Sí' }, { v: 'NO', label: 'No' }, { v: 'NS', label: 'No sé' }];
const when = (key: string, text: string, showIf?: Record<string, string[]>): Question => ({ key, text, type: 'date', optional: true, help: 'Si no recuerdas el día exacto, pon una fecha aproximada. Puedes dejarlo en blanco.', showIf });

export const TOPICS: Topic[] = [
  { key: 'SALUD', label: 'Salud o EPS', hint: 'Medicamentos, citas, cirugías, incapacidades', questions: [
    { key: 'que', text: '¿Qué pasó?', type: 'choice', options: [
      { v: 'NIEGA', label: 'Me niegan o demoran un medicamento, cita, cirugía o tratamiento' }, { v: 'INCAPACIDAD', label: 'No me pagan una incapacidad' },
      { v: 'MALA', label: 'Recibí mala atención o un error médico' }, { v: 'OTRO', label: 'Otra cosa' }] },
    { key: 'riesgo', text: '¿Tu vida o tu salud corren riesgo si esperas?', type: 'choice', options: YES_NO, showIf: { que: ['NIEGA'] } },
    { key: 'publico', text: '¿Te atendieron en un hospital público?', type: 'choice', options: YES_NO, showIf: { que: ['MALA'] } },
    when('fecha', '¿Cuándo ocurrió la mala atención?', { que: ['MALA'] }),
  ] },
  { key: 'TRABAJO', label: 'Trabajo', hint: 'Despidos, salarios, liquidación, pensión', questions: [
    { key: 'que', text: '¿Qué pasó?', type: 'choice', options: [
      { v: 'DESPIDO', label: 'Me despidieron' }, { v: 'NO_PAGAN', label: 'No me pagan salario, prestaciones o liquidación' },
      { v: 'ACOSO', label: 'Acoso o maltrato en el trabajo' }, { v: 'ACCIDENTE', label: 'Accidente o enfermedad por el trabajo' }, { v: 'PENSION', label: 'Pensión' }] },
    { key: 'publico', text: '¿Trabajabas para una entidad pública?', type: 'choice', options: YES_NO },
    when('fecha', '¿Cuándo terminó tu trabajo o cuándo debieron pagarte?', { que: ['DESPIDO', 'NO_PAGAN'] }),
  ] },
  { key: 'FAMILIA', label: 'Familia', hint: 'Cuota de alimentos, custodia, divorcio, violencia', questions: [
    { key: 'que', text: '¿Sobre qué es?', type: 'choice', options: [
      { v: 'VIOLENCIA', label: 'Violencia en mi hogar' }, { v: 'ALIMENTOS', label: 'Cuota de alimentos para hijos' }, { v: 'CUSTODIA', label: 'Custodia o visitas' },
      { v: 'DIVORCIO', label: 'Divorcio, separación o unión libre' }, { v: 'PATERNIDAD', label: 'Reconocimiento de un hijo' }] },
    { key: 'acuerdo', text: '¿La otra persona está de acuerdo?', type: 'choice', options: YES_NO, showIf: { que: ['DIVORCIO'] } },
  ] },
  { key: 'VIVIENDA', label: 'Vivienda y servicios', hint: 'Arriendo, servicios públicos, vecinos, tierras', questions: [
    { key: 'que', text: '¿Qué pasó?', type: 'choice', options: [
      { v: 'INQUILINO', label: 'Vivo en arriendo y tengo problemas con el dueño' }, { v: 'DUENO', label: 'Soy dueño: no me pagan el arriendo o quiero recuperar el inmueble' },
      { v: 'SERVICIOS', label: 'Cobros de agua, luz, gas o internet' }, { v: 'VECINOS', label: 'Problemas con vecinos o el conjunto' }, { v: 'TIERRA', label: 'Una tierra o casa que poseo o me quitaron' }] },
    when('fecha', '¿Cuándo hiciste el reclamo a la empresa?', { que: ['SERVICIOS'] }),
  ] },
  { key: 'DEUDAS', label: 'Deudas y cobros', hint: 'Me deben, debo, me reportaron', questions: [
    { key: 'que', text: '¿Cuál es tu caso?', type: 'choice', options: [
      { v: 'ME_DEBEN', label: 'Me deben plata' }, { v: 'DEBO', label: 'Debo y no puedo pagar' }, { v: 'REPORTADO', label: 'Me reportaron en centrales de riesgo' }] },
    { key: 'titulo', text: '¿Tienes algún documento de la deuda?', type: 'choice', showIf: { que: ['ME_DEBEN'] }, options: [
      { v: 'TITULO', label: 'Pagaré, letra, cheque o factura' }, { v: 'DOC', label: 'Contrato u otro documento firmado' }, { v: 'NADA', label: 'No, fue de palabra' }] },
    when('fecha', '¿Cuándo debían pagarte?', { que: ['ME_DEBEN'] }),
  ] },
  { key: 'VICTIMA', label: 'Fui víctima de un delito', hint: 'Robo, estafa, lesiones, amenazas', questions: [
    { key: 'que', text: '¿Qué pasó?', type: 'choice', options: [
      { v: 'HURTO', label: 'Me robaron' }, { v: 'ESTAFA', label: 'Me estafaron' }, { v: 'LESIONES', label: 'Me golpearon o lesionaron' },
      { v: 'INJURIA', label: 'Me insultaron o difamaron' }, { v: 'AMENAZAS', label: 'Me amenazaron' }, { v: 'SEXUAL', label: 'Violencia sexual' }, { v: 'OTRO', label: 'Otro delito' }] },
    when('fecha', '¿Cuándo ocurrió?'),
  ] },
  { key: 'PENAL_DEFENSA', label: 'Me investigan o acusan', hint: 'Citaciones de Fiscalía, capturas, denuncias', questions: [
    { key: 'que', text: '¿Qué está pasando?', type: 'choice', options: [
      { v: 'CAPTURA', label: 'Capturaron a un familiar o a mí' }, { v: 'CITACION', label: 'Me citaron a la Fiscalía o a una audiencia' }, { v: 'DENUNCIA', label: 'Supe que me denunciaron' }] },
  ] },
  { key: 'ESTADO', label: 'Una entidad pública', hint: 'No responde, decisión, daño, multa', questions: [
    { key: 'que', text: '¿Qué pasó con la entidad?', type: 'choice', options: [
      { v: 'NO_RESPONDE', label: 'No responde una petición que hice' }, { v: 'DECISION', label: 'Tomó una decisión que me perjudica' },
      { v: 'DANO', label: 'Me causó un daño (accidente, obra, falla)' }, { v: 'MULTA', label: 'Me puso un comparendo o multa' }] },
    when('fecha', '¿En qué fecha radicaste la petición?', { que: ['NO_RESPONDE'] }),
    when('fechaNotif', '¿Cuándo te notificaron la decisión?', { que: ['DECISION'] }),
    when('fechaDano', '¿Cuándo ocurrió el daño?', { que: ['DANO'] }),
  ] },
  { key: 'CONSUMIDOR', label: 'Compras y bancos', hint: 'Garantías, compras por internet, bancos', questions: [
    { key: 'que', text: '¿Qué pasó?', type: 'choice', options: [
      { v: 'GARANTIA', label: 'Un producto salió malo y no me responden la garantía' }, { v: 'RETRACTO', label: 'Compré por internet o teléfono y me arrepentí' },
      { v: 'BANCO', label: 'Problema con un banco o entidad financiera' }, { v: 'COBRO', label: 'Me cobran algo que no autoricé' }] },
  ] },
  { key: 'HERENCIA', label: 'Herencias', hint: 'Bienes de un familiar que murió', questions: [
    { key: 'acuerdo', text: '¿Todos los herederos están de acuerdo en cómo repartir?', type: 'choice', options: YES_NO },
  ] },
  { key: 'OTRO', label: 'Otro tema', hint: 'Cuéntanos y te orientamos', questions: [] },
];

export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));

const FREE: Route = {
  title: 'Ayuda gratuita', noLawyerNeeded: true,
  what: 'Si no puedes pagar un abogado, hay lugares que orientan y acompañan sin costo.',
  where: ['Consultorios jurídicos de universidades', 'Defensoría del Pueblo', 'Personería de tu municipio', 'Casas de Justicia', 'Conciliadores en equidad de tu barrio'],
};

export const DEPARTMENTS = ['Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
  'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
  'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'];

/** Construye la orientación según el tema y las respuestas. */
export function orient(topic: string, a: Record<string, string>): Orientation {
  const r: Route[] = [];
  const notes: string[] = [];
  let emergency: Orientation['emergency'];
  let headline = 'Estas son las rutas que podrían servirte:';
  switch (topic) {
    case 'SALUD':
      if (a.que === 'NIEGA') {
        if (a.riesgo === 'SI') r.push({ title: 'Acción de tutela', urgent: true, noLawyerNeeded: true, what: 'Si tu salud o tu vida están en riesgo, puedes pedirle a un juez que ordene a la EPS entregar el servicio. La puedes presentar tú mismo, sin abogado, y el juez debe decidir en 10 días.', where: ['Cualquier juzgado (oficina de reparto) o en línea en la página de la Rama Judicial', 'La Personería o la Defensoría te ayudan a escribirla'], docs: ['Orden o fórmula médica', 'Respuesta o negación de la EPS (o el número de radicado)', 'Historia clínica', 'Copia de tu cédula'] });
        r.push({ title: 'Reclamo o derecho de petición a la EPS', noLawyerNeeded: true, what: 'Pide por escrito el servicio. La EPS debe responderte; si no lo hace o te lo niega, puedes ir a la tutela.', where: ['Oficina de atención al usuario de la EPS', 'Canales virtuales de la EPS'], docs: ['Orden médica', 'Cédula'] });
        r.push({ title: 'Queja ante la Superintendencia de Salud', noLawyerNeeded: true, what: 'La Supersalud vigila a las EPS y puede intervenir cuando no te atienden.', where: ['Línea y página web de la Supersalud'] });
      } else if (a.que === 'INCAPACIDAD') {
        r.push({ title: 'Reclamación escrita', noLawyerNeeded: true, what: 'Pide por escrito el pago a la EPS o a tu empleador (según quién deba pagar los días). Guarda la constancia.', where: ['EPS', 'Empleador'], docs: ['Certificado de incapacidad', 'Desprendibles de pago'] });
        r.push({ title: 'Tutela o demanda laboral', what: 'Si no te pagan y dependes de ese dinero para vivir, puede proceder la tutela; si no, una reclamación laboral.', where: ['Juez (tutela)', 'Juez laboral'] });
      } else if (a.que === 'MALA') {
        if (a.publico === 'SI') r.push({ title: 'Demanda de reparación directa contra el Estado', what: 'Si un hospital público te causó un daño, puedes pedir una indemnización. Necesitas abogado y hay un plazo de 2 años.', where: ['Juez administrativo (primero se intenta conciliar ante la Procuraduría)'], docs: ['Historia clínica completa', 'Pruebas del daño y gastos'], ruleKey: 'CA_REPARACION', dateKey: 'fecha', dateLabel: 'para presentar la demanda' });
        else r.push({ title: 'Reclamación y demanda de responsabilidad médica', what: 'Puedes reclamar a la clínica y, si no responde, demandar la indemnización. Requiere abogado y estudio de la historia clínica.', where: ['Centro de conciliación', 'Juez civil'], docs: ['Historia clínica completa', 'Facturas y pruebas del daño'] });
        r.push({ title: 'Queja ante el Tribunal de Ética Médica o la Supersalud', noLawyerNeeded: true, what: 'Para que se investigue la conducta del médico o de la institución.', where: ['Tribunal de Ética Médica de tu departamento', 'Supersalud'] });
      } else r.push({ title: 'Derecho de petición a la EPS', noLawyerNeeded: true, what: 'Escribe a la EPS explicando qué necesitas. Si no responde o la respuesta afecta tu salud, puedes acudir a la tutela.', where: ['EPS', 'Supersalud'] });
      break;
    case 'TRABAJO':
      if (a.que === 'DESPIDO' || a.que === 'NO_PAGAN') {
        r.push({ title: 'Reclamación escrita al empleador', noLawyerNeeded: true, what: 'Pide por escrito lo que te deben (salarios, prestaciones, liquidación o indemnización). Esta reclamación también interrumpe el plazo para demandar.', where: ['Envíala a tu empleador y guarda la copia con fecha de recibido'], docs: ['Contrato o pruebas del trabajo', 'Desprendibles de pago', 'Carta de despido si existe'] });
        r.push({ title: 'Conciliación ante el inspector de trabajo', noLawyerNeeded: true, what: 'Es gratuita: el Ministerio del Trabajo cita a tu empleador para intentar un acuerdo.', where: ['Inspección del Trabajo de tu municipio'] });
        r.push({ title: 'Demanda laboral', what: 'Si no hay acuerdo, un juez laboral puede ordenar el pago. Por lo general tienes 3 años desde que te debían pagar.', where: ['Juez laboral'], ruleKey: 'LAB_GENERAL', dateKey: 'fecha', dateLabel: 'para reclamar judicialmente' });
        if (a.publico === 'SI') notes.push('Si eras empleado público y la entidad tomó una decisión por escrito (una resolución), el plazo para demandarla puede ser de solo 4 meses desde la notificación. Consulta pronto.');
      } else if (a.que === 'ACOSO') {
        r.push({ title: 'Queja por acoso laboral', noLawyerNeeded: true, what: 'Puedes presentar la queja ante el comité de convivencia de la empresa o ante el inspector de trabajo (Ley 1010 de 2006).', where: ['Comité de convivencia laboral', 'Inspección del Trabajo', 'Personería (si trabajas en el Estado)'], docs: ['Mensajes, correos, testigos'] });
      } else if (a.que === 'ACCIDENTE') {
        r.push({ title: 'Reporte a la ARL y calificación', noLawyerNeeded: true, what: 'El accidente o la enfermedad deben reportarse a la ARL para que te atiendan y te paguen lo que corresponda.', where: ['ARL', 'EPS'], docs: ['Reporte del accidente', 'Historia clínica'] });
        r.push({ title: 'Reclamación laboral', what: 'Si la empresa no te afilió o no reportó, puedes reclamar la responsabilidad del empleador.', where: ['Juez laboral'] });
      } else {
        r.push({ title: 'Solicitud a Colpensiones o a tu fondo de pensiones', noLawyerNeeded: true, what: 'Pide por escrito el reconocimiento o la revisión de tu pensión. Si la niegan, se puede reclamar ante el juez.', where: ['Colpensiones o tu fondo privado'], docs: ['Historia laboral', 'Cédula'] });
      }
      break;
    case 'FAMILIA':
      if (a.que === 'VIOLENCIA') {
        headline = 'Tu seguridad es lo primero.';
        emergency = { text: 'Si estás en peligro ahora, llama de inmediato.', lines: [{ label: 'Emergencias (Policía)', phone: '123' }, { label: 'Orientación a mujeres víctimas de violencia', phone: '155' }, { label: 'ICBF — niños, niñas y adolescentes', phone: '141' }] };
        r.push({ title: 'Medida de protección en la Comisaría de Familia', urgent: true, noLawyerNeeded: true, what: 'La Comisaría puede ordenar de inmediato que el agresor salga de la casa o no se te acerque.', where: ['Comisaría de Familia de tu municipio (atiende sin abogado)'] });
        r.push({ title: 'Denuncia penal', noLawyerNeeded: true, what: 'La violencia intrafamiliar es un delito: la Fiscalía debe investigar aunque no presentes querella.', where: ['Fiscalía', 'Policía', 'Centros de atención a víctimas'] });
      } else if (a.que === 'ALIMENTOS' || a.que === 'CUSTODIA') {
        r.push({ title: 'Conciliación gratuita', noLawyerNeeded: true, what: 'Primero se intenta un acuerdo sobre la cuota, la custodia o las visitas. Si se firma, es obligatorio cumplirlo.', where: ['Comisaría de Familia', 'ICBF', 'Consultorio jurídico', 'Centro de conciliación'], docs: ['Registros civiles de los hijos', 'Pruebas de gastos e ingresos'] });
        r.push({ title: 'Demanda ante el juez de familia', what: 'Si no hay acuerdo o no se cumple, el juez fija la cuota o decide la custodia.', where: ['Juez de familia'] });
      } else if (a.que === 'DIVORCIO') {
        if (a.acuerdo === 'SI') r.push({ title: 'Divorcio o liquidación ante notaría', what: 'Si están de acuerdo, se puede hacer en notaría, que es más rápido. Se necesita abogado.', where: ['Notaría'], docs: ['Registro civil de matrimonio', 'Registros civiles de los hijos', 'Acuerdo sobre bienes, hijos y cuota'] });
        else r.push({ title: 'Proceso de divorcio ante el juez de familia', what: 'Si no hay acuerdo, se demanda ante el juez por alguna de las causales legales.', where: ['Juez de familia'] });
      } else {
        r.push({ title: 'Reconocimiento de paternidad', noLawyerNeeded: true, what: 'El padre puede reconocer al hijo voluntariamente; si no, se puede pedir la prueba de ADN y el reconocimiento ante el ICBF o el juez.', where: ['ICBF', 'Notaría', 'Juez de familia'] });
      }
      break;
    case 'VIVIENDA':
      if (a.que === 'SERVICIOS') {
        r.push({ title: 'Reclamo a la empresa de servicios', noLawyerNeeded: true, what: 'Reclama por escrito el cobro. La empresa debe responder en 15 días hábiles; si no responde, se entiende que te dieron la razón (silencio positivo).', where: ['Oficina de atención de la empresa'], docs: ['Facturas', 'Fotos del contador'], ruleKey: 'PETICION_RESPUESTA', dateKey: 'fecha', dateLabel: 'para que la empresa te responda' });
        r.push({ title: 'Recursos y Superservicios', noLawyerNeeded: true, what: 'Si la respuesta no te sirve, interpón los recursos de reposición y apelación dentro del plazo que te indiquen; la apelación la decide la Superintendencia de Servicios Públicos.', where: ['Empresa de servicios', 'Superservicios'] });
      } else if (a.que === 'DUENO') {
        r.push({ title: 'Proceso de restitución del inmueble', what: 'El juez ordena la entrega del inmueble cuando el arrendatario no paga. No requiere conciliación previa.', where: ['Juez civil municipal'], docs: ['Contrato de arrendamiento', 'Pruebas de lo que debe'] });
      } else if (a.que === 'INQUILINO') {
        r.push({ title: 'Conciliación con el arrendador', noLawyerNeeded: true, what: 'Intenta un acuerdo (reparaciones, depósito, entrega). Es gratis con conciliadores en equidad o consultorios jurídicos.', where: ['Conciliador en equidad', 'Consultorio jurídico', 'Casa de Justicia'] });
      } else if (a.que === 'VECINOS') {
        r.push({ title: 'Administración y comité de convivencia', noLawyerNeeded: true, what: 'En conjuntos, primero ante la administración y el comité de convivencia.', where: ['Administración del conjunto'] });
        r.push({ title: 'Inspección de Policía o conciliador en equidad', noLawyerNeeded: true, what: 'Para ruido, linderos o daños entre vecinos, la Inspección de Policía puede intervenir (Código Nacional de Policía).', where: ['Inspección de Policía', 'Conciliador en equidad'] });
      } else {
        r.push({ title: 'Querella policiva o proceso de pertenencia', what: 'Si te perturban la posesión, puedes acudir a la Inspección de Policía. Si llevas años como poseedor, un abogado puede estudiar si procede la pertenencia.', where: ['Inspección de Policía', 'Juez civil'], docs: ['Pruebas de la posesión (recibos, testigos, fotos)', 'Certificado de tradición'] });
      }
      break;
    case 'DEUDAS':
      if (a.que === 'ME_DEBEN') {
        r.push({ title: 'Cobro amistoso por escrito', noLawyerNeeded: true, what: 'Envía una carta de cobro con el valor y una fecha límite. Muchas deudas se arreglan aquí.', where: ['Envíala por correo certificado o WhatsApp y guarda la constancia'] });
        if (a.titulo === 'TITULO') r.push({ title: 'Proceso ejecutivo', what: 'Con un pagaré, letra, cheque o factura puedes pedir al juez que ordene el pago y el embargo de bienes.', where: ['Juez civil'], docs: ['El título original'], ruleKey: 'COM_CAMBIARIA_DIRECTA', dateKey: 'fecha', dateLabel: 'para cobrar judicialmente el título' });
        else if (a.titulo === 'DOC') r.push({ title: 'Proceso ejecutivo o declarativo', what: 'Si el documento contiene una obligación clara y exigible, puedes cobrarla ante el juez.', where: ['Juez civil'], docs: ['Contrato o documento firmado'], ruleKey: 'CIVIL_EJECUTIVA', dateKey: 'fecha', dateLabel: 'para cobrarla por proceso ejecutivo' });
        else r.push({ title: 'Proceso monitorio', what: 'Para deudas de mínima cuantía sin documento, el juez requiere al deudor para que pague o explique por qué no debe.', where: ['Juez civil municipal'], docs: ['Mensajes, testigos, transferencias'] });
      } else if (a.que === 'DEBO') {
        r.push({ title: 'Negociación de deudas (insolvencia de persona natural)', what: 'Si no eres comerciante y no puedes pagar varias deudas, puedes pedir un acuerdo de pago con todos tus acreedores con la ayuda de un conciliador.', where: ['Centros de conciliación autorizados', 'Notarías'], docs: ['Lista de deudas', 'Ingresos y gastos'] });
      } else {
        r.push({ title: 'Reclamo por habeas data', noLawyerNeeded: true, what: 'Si el reporte es incorrecto, ya pagaste o no te avisaron antes de reportarte, reclama por escrito a la entidad que te reportó y a la central de riesgo.', where: ['Entidad que te reportó', 'Datacrédito o TransUnion', 'Superintendencia de Industria y Comercio o Financiera'], docs: ['Paz y salvo', 'Comprobantes de pago'] });
      }
      break;
    case 'VICTIMA':
      if (a.que === 'SEXUAL') {
        headline = 'No estás sola ni solo. Tu salud y tu seguridad son lo primero.';
        emergency = { text: 'Acude a urgencias lo antes posible (idealmente en las primeras 72 horas) y pide atención integral.', lines: [{ label: 'Emergencias', phone: '123' }, { label: 'Línea mujeres', phone: '155' }, { label: 'ICBF (si es menor de edad)', phone: '141' }] };
        r.push({ title: 'Denuncia penal', urgent: true, noLawyerNeeded: true, what: 'La Fiscalía debe investigar de oficio. Tienes derecho a que no te revictimicen y a un abogado de víctimas.', where: ['Fiscalía (CAIVAS)', 'Policía', 'Centros de atención a víctimas'] });
      } else {
        const querellable = ['INJURIA', 'LESIONES', 'HURTO', 'ESTAFA'].includes(a.que);
        r.push({ title: querellable ? 'Querella o denuncia penal' : 'Denuncia penal', noLawyerNeeded: true,
          what: querellable ? 'Algunos delitos (como injuria, calumnia, lesiones leves, y hurtos o estafas de menor cuantía) solo se investigan si la víctima presenta querella, y hay que hacerlo dentro de los 6 meses siguientes. Suele exigirse conciliación antes.' : 'Cuenta lo ocurrido a la Fiscalía para que investigue.',
          where: ['Fiscalía', 'Policía', 'Denuncia en línea (A Denunciar) para algunos delitos'], docs: ['Pruebas: fotos, mensajes, facturas, testigos, dictamen médico si hubo lesiones'],
          ...(querellable ? { ruleKey: 'PENAL_QUERELLA', dateKey: 'fecha', dateLabel: 'para presentar la querella' } : {}) });
        r.push({ title: 'Abogado de víctimas', what: 'Como víctima puedes tener un abogado que te represente y pida la reparación de los daños.', where: ['Abogado particular', 'Defensoría del Pueblo (representación de víctimas)'] });
        if (a.que === 'AMENAZAS') notes.push('Si temes por tu vida, pide medidas de protección a la Policía y a la Fiscalía y llama al 123 en una emergencia.');
      }
      break;
    case 'PENAL_DEFENSA':
      headline = 'Tienes derecho a un abogado defensor desde el primer momento.';
      r.push({ title: 'Busca un abogado defensor ya', urgent: a.que === 'CAPTURA', what: a.que === 'CAPTURA' ? 'Después de una captura, la persona debe ser llevada ante un juez de control de garantías dentro de las 36 horas siguientes. Necesita defensor en esa audiencia.' : 'No vayas a una diligencia sin abogado. Tienes derecho a guardar silencio y a no declarar contra ti mismo ni contra tu familia cercana.', where: ['Abogado penalista particular', 'Defensoría Pública (si no puedes pagar)'] });
      notes.push('No publiques en redes ni hables del caso con la otra parte. Guarda toda citación, documento o prueba.');
      break;
    case 'ESTADO':
      if (a.que === 'NO_RESPONDE') {
        r.push({ title: 'Plazo de respuesta del derecho de petición', noLawyerNeeded: true, what: 'Las entidades deben responder en 15 días hábiles por regla general.', where: ['La entidad'], ruleKey: 'PETICION_RESPUESTA', dateKey: 'fecha', dateLabel: 'para que la entidad te responda' });
        r.push({ title: 'Acción de tutela por falta de respuesta', noLawyerNeeded: true, what: 'Si la entidad no responde de fondo, puedes presentar tutela por violación del derecho de petición, sin abogado.', where: ['Cualquier juzgado', 'Personería o Defensoría te ayudan'], docs: ['Copia de tu petición con fecha de radicado'] });
      } else if (a.que === 'DECISION') {
        r.push({ title: 'Recursos contra la decisión', urgent: true, noLawyerNeeded: true, what: 'Puedes pedir que la revisen (reposición) o que la decida el superior (apelación). El plazo es corto: 10 días hábiles desde la notificación.', where: ['La misma entidad'], ruleKey: 'RECURSOS_CPACA', dateKey: 'fechaNotif', dateLabel: 'para presentar los recursos' });
        r.push({ title: 'Demanda de nulidad y restablecimiento del derecho', what: 'Después de los recursos, puedes demandar la decisión ante el juez administrativo. Hay un plazo de 4 meses y se necesita abogado.', where: ['Juez administrativo (primero conciliación ante la Procuraduría)'], ruleKey: 'CA_NRD', dateKey: 'fechaNotif', dateLabel: 'para demandar (se cuenta desde la decisión final)' });
      } else if (a.que === 'DANO') {
        r.push({ title: 'Reparación directa', what: 'Si el Estado te causó un daño, puedes pedir indemnización. Hay un plazo de 2 años y se necesita abogado.', where: ['Juez administrativo (primero conciliación ante la Procuraduría)'], docs: ['Fotos, testigos, facturas, historia clínica si hubo lesiones'], ruleKey: 'CA_REPARACION', dateKey: 'fechaDano', dateLabel: 'para presentar la demanda' });
      } else {
        r.push({ title: 'Impugnar el comparendo o la multa', noLawyerNeeded: true, what: 'Acude al organismo de tránsito o a la Inspección de Policía dentro del plazo que indica el comparendo para presentar tus descargos y pruebas.', where: ['Secretaría de Tránsito', 'Inspección de Policía'], docs: ['Comparendo', 'Fotos, videos o testigos'] });
      }
      break;
    case 'CONSUMIDOR':
      if (a.que === 'GARANTIA') {
        r.push({ title: 'Reclamo directo al vendedor', noLawyerNeeded: true, what: 'Pide por escrito la reparación, el cambio o la devolución del dinero. La garantía legal es de un año para productos nuevos si no te dijeron otro término.', where: ['Tienda o fabricante'], docs: ['Factura', 'Fotos del daño'] });
        r.push({ title: 'Demanda ante la Superintendencia de Industria y Comercio', noLawyerNeeded: true, what: 'Si no te responden, la SIC puede ordenar que cumplan la garantía. Para montos pequeños no necesitas abogado.', where: ['SIC (en línea)'] });
      } else if (a.que === 'RETRACTO') {
        r.push({ title: 'Derecho de retracto', noLawyerNeeded: true, what: 'En compras por internet, teléfono o catálogo puedes arrepentirte dentro de los 5 días hábiles siguientes a la entrega y pedir la devolución del dinero.', where: ['El vendedor', 'SIC si no responde'], docs: ['Factura o comprobante', 'Fecha de entrega'] });
      } else if (a.que === 'BANCO') {
        r.push({ title: 'Defensor del consumidor financiero', noLawyerNeeded: true, what: 'Cada banco tiene un defensor gratuito. Si no resuelve, puedes acudir a la Superintendencia Financiera.', where: ['Defensor del consumidor financiero del banco', 'Superintendencia Financiera'] });
      } else {
        r.push({ title: 'Reclamo y reversión del pago', noLawyerNeeded: true, what: 'Reclama a la empresa y a tu banco. En compras con tarjeta por internet puedes pedir la reversión del pago en ciertos casos.', where: ['Empresa', 'Tu banco', 'SIC'] });
      }
      break;
    case 'HERENCIA':
      if (a.acuerdo === 'SI') r.push({ title: 'Sucesión ante notaría', what: 'Si todos los herederos están de acuerdo, la sucesión se hace en notaría, con abogado. Es más rápida.', where: ['Notaría'], docs: ['Registro civil de defunción', 'Registros civiles de los herederos', 'Certificados de tradición de los bienes'] });
      else r.push({ title: 'Sucesión ante el juez', what: 'Si no hay acuerdo, el proceso se tramita ante el juez de familia o civil, con abogado.', where: ['Juez'], docs: ['Registro civil de defunción', 'Pruebas del parentesco', 'Documentos de los bienes'] });
      break;
    default:
      headline = 'Te recomendamos empezar por una orientación personalizada:';
      r.push({ title: 'Orientación con un abogado', what: 'Cuéntale tu caso a un abogado para que revise si hay un plazo corriendo y qué camino conviene.', where: ['Abogados de DREAMS (al final puedes pedir propuestas)', 'Consultorios jurídicos'] });
  }
  r.push(FREE);
  return { headline, routes: r, emergency, notes };
}

/** Oculta datos que identifiquen a la persona antes de mostrar el relato a los abogados. */
export function scrub(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo oculto]')
    .replace(/(\+?57[\s-]?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, '[teléfono oculto]')
    .replace(/\b\d{1,3}(?:[.\s]?\d{3}){2,3}\b/g, '[número oculto]')
    .replace(/\b\d{7,12}\b/g, '[número oculto]')
    .replace(/\b(calle|carrera|cra|cr|cl|av|avenida|diagonal|transversal|dg|tv)\.?\s*\d+[^,.\n]{0,25}/gi, '[dirección oculta]');
}

export const CONSENT_TEXT = 'Autorizo el tratamiento de mis datos personales, incluidos los datos sensibles que yo decida compartir, para que abogados verificados registrados en DREAMS analicen mi caso y me envíen propuestas de servicios. Mis datos de contacto solo se compartirán con el abogado que yo elija. Puedo consultar, corregir o retirar mi autorización en cualquier momento (Ley 1581 de 2012).';
