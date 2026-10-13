/**
 * Plantillas iniciales (borradores) para abogados. Son una base mínima y deben ser revisadas por un abogado:
 * la biblioteca completa se carga con «Importar plantillas» (JSON) desde la administración de DREAMS.
 *
 * Formato del cuerpo:
 *  - Párrafos separados por una línea en blanco.
 *  - «# Título» = título centrado en negrita; «## Subtítulo» = subtítulo en negrita.
 *  - **texto** = negrita.
 *  - {{campo}} = dato que se llena con el caso, el cliente, el abogado o a mano.
 */
export type TemplateInput = {
  code: string; area: string; category: string; title: string; description?: string; body: string;
  fields?: { key: string; label: string; help?: string }[]; keywords?: string[]; legalBasis?: string;
};

/** Datos que DREAMS llena solo (no hace falta declararlos en «fields»). */
export const AUTO_FIELDS: { key: string; label: string }[] = [
  { key: 'fecha', label: 'Fecha de hoy en letras (ej. 13 de octubre de 2026)' },
  { key: 'ciudad', label: 'Ciudad del abogado o del negocio' },
  { key: 'cliente_nombre', label: 'Nombre del cliente' },
  { key: 'cliente_documento', label: 'Documento del cliente' },
  { key: 'cliente_telefono', label: 'Teléfono del cliente' },
  { key: 'cliente_correo', label: 'Correo del cliente' },
  { key: 'cliente_ciudad', label: 'Ciudad del cliente' },
  { key: 'abogado_nombre', label: 'Nombre del abogado' },
  { key: 'abogado_tp', label: 'Tarjeta profesional' },
  { key: 'abogado_correo', label: 'Correo del abogado' },
  { key: 'abogado_telefono', label: 'Teléfono del abogado' },
  { key: 'abogado_direccion', label: 'Dirección de notificaciones del abogado' },
  { key: 'despacho', label: 'Despacho o entidad del caso' },
  { key: 'radicado', label: 'Radicado del caso' },
  { key: 'contraparte', label: 'Contraparte del caso' },
  { key: 'calidad_cliente', label: 'Calidad del cliente (demandante, accionante…)' },
  { key: 'tipo_proceso', label: 'Tipo de proceso o trámite' },
  { key: 'etapa', label: 'Etapa actual del caso' },
  { key: 'caso_titulo', label: 'Título del caso' },
  { key: 'caso_descripcion', label: 'Descripción del caso' },
];

export const STARTER_TEMPLATES: TemplateInput[] = [
  {
    code: 'DREAMS-TUTELA-01', area: 'constitucional', category: 'Tutela',
    title: 'Acción de tutela (general)',
    description: 'Borrador base de acción de tutela. Ajuste derechos, hechos y pruebas. Revise antes de radicar.',
    keywords: ['tutela', 'derecho fundamental', 'salud', 'eps', 'petición', 'debido proceso', 'mínimo vital'],
    legalBasis: 'Constitución Política art. 86; Decreto 2591 de 1991; Decreto 1069 de 2015 (reparto, modificado por el Decreto 333 de 2021).',
    fields: [
      { key: 'juez', label: 'Juez al que se dirige', help: 'Ej. Juez Civil Municipal de Cali (Reparto)' },
      { key: 'accionado', label: 'Entidad o persona accionada' },
      { key: 'derechos', label: 'Derechos fundamentales vulnerados', help: 'Ej. salud, vida digna y seguridad social' },
      { key: 'hechos', label: 'Hechos (uno por párrafo)' },
      { key: 'pretensiones', label: 'Lo que se le pide al juez' },
      { key: 'pruebas', label: 'Pruebas que se anexan' },
    ],
    body: `Señor(a)
{{juez}}
E. S. D.

**Referencia:** Acción de tutela
**Accionante:** {{cliente_nombre}}
**Accionado:** {{accionado}}

{{cliente_nombre}}, identificado(a) con {{cliente_documento}}, actuando en nombre propio / por medio de apoderado, interpongo ACCIÓN DE TUTELA contra {{accionado}}, para que se protejan mis derechos fundamentales a {{derechos}}, con fundamento en los siguientes:

## HECHOS

{{hechos}}

## DERECHOS FUNDAMENTALES VULNERADOS

Considero vulnerados los derechos fundamentales a {{derechos}}, consagrados en la Constitución Política.

## PRETENSIONES

{{pretensiones}}

## PROCEDENCIA

La acción es procedente porque no cuento con otro medio de defensa judicial idóneo y eficaz, o porque se busca evitar un perjuicio irremediable (art. 86 C.P. y art. 6 del Decreto 2591 de 1991). Se cumple el requisito de inmediatez.

## JURAMENTO

Bajo la gravedad del juramento manifiesto que no he presentado otra acción de tutela por los mismos hechos y derechos.

## PRUEBAS

{{pruebas}}

## NOTIFICACIONES

Accionante: {{cliente_ciudad}} · Teléfono {{cliente_telefono}} · Correo {{cliente_correo}}.

Atentamente,


{{cliente_nombre}}
{{cliente_documento}}`,
  },
  {
    code: 'DREAMS-PETICION-01', area: 'administrativo', category: 'Derecho de petición',
    title: 'Derecho de petición (interés particular)',
    description: 'Petición respetuosa ante entidad pública o privada. Término general de respuesta: 15 días hábiles.',
    keywords: ['petición', 'derecho de petición', 'solicitud', 'información', 'copias', 'entidad'],
    legalBasis: 'Constitución Política art. 23; Ley 1437 de 2011 arts. 13 y ss., sustituidos por la Ley 1755 de 2015.',
    fields: [
      { key: 'entidad', label: 'Entidad o empresa destinataria' },
      { key: 'hechos', label: 'Hechos o contexto' },
      { key: 'peticiones', label: 'Lo que se solicita (numerado)' },
      { key: 'anexos', label: 'Anexos' },
    ],
    body: `{{ciudad}}, {{fecha}}

Señores
{{entidad}}
Ciudad

**Asunto:** Derecho de petición

{{cliente_nombre}}, identificado(a) con {{cliente_documento}}, en ejercicio del derecho fundamental de petición consagrado en el artículo 23 de la Constitución Política y regulado por la Ley 1755 de 2015, respetuosamente presento la siguiente petición:

## HECHOS

{{hechos}}

## PETICIONES

{{peticiones}}

## ANEXOS

{{anexos}}

## NOTIFICACIONES

Recibiré respuesta en {{cliente_correo}} o en el teléfono {{cliente_telefono}}.

Atentamente,


{{cliente_nombre}}
{{cliente_documento}}`,
  },
  {
    code: 'DREAMS-PODER-01', area: 'general', category: 'Poder',
    title: 'Poder especial',
    description: 'Poder especial para actuar en un proceso o trámite. Puede conferirse por mensaje de datos.',
    keywords: ['poder', 'apoderado', 'representación', 'mandato', 'demanda'],
    legalBasis: 'Código General del Proceso (Ley 1564 de 2012) arts. 73 a 77; Ley 2213 de 2022 art. 5.',
    fields: [
      { key: 'destinatario', label: 'Despacho o entidad a la que se dirige' },
      { key: 'objeto', label: 'Para qué se otorga el poder', help: 'Ej. presentar demanda ejecutiva contra …' },
    ],
    body: `Señor(a)
{{destinatario}}
E. S. D.

**Referencia:** {{tipo_proceso}}
**Radicado:** {{radicado}}

{{cliente_nombre}}, mayor de edad, identificado(a) con {{cliente_documento}}, por medio del presente escrito confiero PODER ESPECIAL, amplio y suficiente a {{abogado_nombre}}, abogado(a) titulado(a) con tarjeta profesional No. {{abogado_tp}}, correo electrónico {{abogado_correo}}, inscrito en el Registro Nacional de Abogados, para que en mi nombre y representación {{objeto}}.

Mi apoderado(a) queda facultado(a) para recibir, conciliar, transigir, desistir, sustituir, reasumir, presentar recursos y, en general, realizar todas las actuaciones necesarias para el cumplimiento de este mandato, en los términos del artículo 77 del Código General del Proceso.

Atentamente,


{{cliente_nombre}}
{{cliente_documento}}

Acepto,


{{abogado_nombre}}
T.P. {{abogado_tp}}`,
  },
  {
    code: 'DREAMS-CONTRATO-HONORARIOS-01', area: 'general', category: 'Contratos',
    title: 'Contrato de prestación de servicios profesionales de abogado',
    description: 'Contrato de honorarios abogado–cliente. Ajuste objeto, valor y forma de pago.',
    keywords: ['contrato', 'honorarios', 'prestación de servicios', 'cuota litis', 'mandato'],
    legalBasis: 'Código Civil (mandato, arts. 2142 y ss.); Ley 1123 de 2007 (Código Disciplinario del Abogado).',
    fields: [
      { key: 'objeto', label: 'Objeto del contrato' },
      { key: 'valor', label: 'Valor de los honorarios', help: 'En números y letras' },
      { key: 'forma_pago', label: 'Forma de pago' },
    ],
    body: `# CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES

Entre los suscritos, {{cliente_nombre}}, identificado(a) con {{cliente_documento}}, quien en adelante se denominará EL CLIENTE, y {{abogado_nombre}}, abogado(a) con tarjeta profesional No. {{abogado_tp}}, quien en adelante se denominará EL ABOGADO, se celebra el presente contrato, que se regirá por las siguientes cláusulas:

**PRIMERA. Objeto.** EL ABOGADO se obliga a prestar sus servicios profesionales para {{objeto}}.

**SEGUNDA. Honorarios.** EL CLIENTE pagará a EL ABOGADO la suma de {{valor}}, así: {{forma_pago}}.

**TERCERA. Gastos.** Los gastos del proceso o trámite (copias, notificaciones, pólizas, peritajes, aranceles y similares) son a cargo de EL CLIENTE y no hacen parte de los honorarios.

**CUARTA. Obligaciones de EL ABOGADO.** Actuar con diligencia, lealtad y reserva profesional, e informar oportunamente a EL CLIENTE el estado del asunto.

**QUINTA. Obligaciones de EL CLIENTE.** Suministrar información veraz y los documentos requeridos, y pagar los honorarios y gastos en los plazos acordados.

**SEXTA. Naturaleza.** Las obligaciones de EL ABOGADO son de medio y no de resultado.

**SÉPTIMA. Terminación.** El contrato termina por cumplimiento del objeto, por mutuo acuerdo o por revocatoria del poder, caso en el cual se reconocerán los honorarios causados hasta ese momento.

**OCTAVA. Datos personales.** EL CLIENTE autoriza el tratamiento de sus datos personales para la ejecución de este contrato, conforme a la Ley 1581 de 2012.

Para constancia se firma en {{ciudad}}, el {{fecha}}.


EL CLIENTE
{{cliente_nombre}}
{{cliente_documento}}


EL ABOGADO
{{abogado_nombre}}
T.P. {{abogado_tp}}`,
  },
  {
    code: 'DREAMS-MEMORIAL-IMPULSO-01', area: 'general', category: 'Memorial',
    title: 'Memorial de impulso procesal',
    description: 'Solicitud al despacho para que dé trámite a una actuación pendiente.',
    keywords: ['memorial', 'impulso', 'solicitud', 'despacho', 'trámite', 'proceso'],
    legalBasis: 'Código General del Proceso (Ley 1564 de 2012) arts. 42 y 120; Ley 2213 de 2022.',
    fields: [
      { key: 'solicitud', label: 'Lo que se solicita al despacho' },
    ],
    body: `Señor(a) Juez
{{despacho}}
E. S. D.

**Referencia:** {{tipo_proceso}}
**Demandante / Accionante:** {{cliente_nombre}}
**Demandado / Accionado:** {{contraparte}}
**Radicado:** {{radicado}}

{{abogado_nombre}}, en calidad de apoderado(a) de la parte {{calidad_cliente}}, respetuosamente me dirijo a su despacho para solicitar: {{solicitud}}.

Lo anterior, en atención a que el proceso se encuentra en la etapa de {{etapa}} y está pendiente la actuación referida.

Recibo notificaciones en {{abogado_correo}} y en {{abogado_direccion}}.

Atentamente,


{{abogado_nombre}}
T.P. {{abogado_tp}}`,
  },
  {
    code: 'DREAMS-PAZYSALVO-01', area: 'general', category: 'Honorarios',
    title: 'Paz y salvo de honorarios',
    description: 'Constancia de que el cliente pagó los honorarios pactados.',
    keywords: ['paz y salvo', 'honorarios', 'pago', 'constancia'],
    legalBasis: '',
    fields: [{ key: 'valor', label: 'Valor pagado' }],
    body: `# PAZ Y SALVO

{{abogado_nombre}}, abogado(a) con tarjeta profesional No. {{abogado_tp}}, hace constar que {{cliente_nombre}}, identificado(a) con {{cliente_documento}}, se encuentra a paz y salvo por concepto de honorarios profesionales correspondientes a «{{caso_titulo}}», por valor total de {{valor}}.

Se expide en {{ciudad}}, el {{fecha}}.


{{abogado_nombre}}
T.P. {{abogado_tp}}`,
  },
];
