# Prompt para generar la biblioteca de plantillas jurídicas de DREAMS

Copie todo lo que está entre las líneas `=====` y péguelo en su IA de derecho colombiano.
Pídale las plantillas **por lotes** (un área por mensaje). Por ejemplo: «Entrega el lote 1: Constitucional».
Luego, en DREAMS → **Plantillas y documentos** → **Importar**, pegue el JSON de cada lote.
Con un usuario administrador puede marcar «Cargarlas para todos los abogados de DREAMS».

=====

Actúa como abogado colombiano experto en litigio y en redacción de documentos. Vas a construir la biblioteca de plantillas de una plataforma para abogados independientes y firmas pequeñas en Colombia. Las plantillas se llenarán con los datos de cada caso.

## 1. Qué plantillas necesito

Incluye todos los documentos que un abogado litigante o consultor usa con frecuencia, organizados en estas áreas (usa exactamente estos códigos de área):

- `general`: poderes (general, especial, para conciliar, por mensaje de datos, de sustitución), revocatoria de poder, renuncia de poder, contrato de prestación de servicios profesionales (honorarios fijos, cuota litis, mixto, por etapas), propuesta de honorarios, paz y salvo, cuenta de cobro, autorización de tratamiento de datos del cliente, acuerdo de confidencialidad, memoriales genéricos (impulso procesal, solicitud de copias, acceso al expediente, cambio de dirección de notificaciones, aporte de documentos, desistimiento), solicitud de audiencia virtual y constancias.
- `constitucional`: acción de tutela (salud, petición, mínimo vital, debido proceso, educación, habeas data, estabilidad laboral reforzada, contra providencia judicial), impugnación del fallo, incidente de desacato, solicitud de medida provisional, solicitud de selección ante la Corte Constitucional, acción de cumplimiento, acción popular y acción de grupo, habeas corpus.
- `administrativo`: derecho de petición (de interés particular, de información y de documentos, a entidad privada), recursos de reposición y apelación, revocatoria directa, solicitud de conciliación prejudicial ante la Procuraduría, demandas de nulidad, de nulidad y restablecimiento del derecho, reparación directa y controversias contractuales, silencio administrativo.
- `civil`: demanda ejecutiva (pagaré, letra, factura, contrato), solicitud de medidas cautelares, demanda verbal y verbal sumaria, restitución de inmueble arrendado, pertenencia, divisoria, responsabilidad civil contractual y extracontractual, contestación de demanda, excepciones previas y de mérito, recurso de reposición, apelación, liquidación del crédito, solicitud de entrega de títulos, nulidades procesales, llamamiento en garantía, objeción al juramento estimatorio, transacción y contrato de arrendamiento.
- `familia`: divorcio de mutuo acuerdo (judicial y notarial), divorcio contencioso, cesación de efectos civiles, liquidación de sociedad conyugal o patrimonial, declaración de unión marital de hecho, alimentos (fijación, aumento, disminución, exoneración), custodia y visitas, regulación de visitas, permiso de salida del país, investigación e impugnación de paternidad, sucesión notarial y judicial, inventario y avalúos, adjudicación de apoyos (Ley 1996 de 2019), acuerdos de apoyo y directivas anticipadas, capitulaciones.
- `laboral`: reclamación administrativa, demanda ordinaria laboral de primera y única instancia, contestación, liquidación de prestaciones, despido sin justa causa, reintegro por fuero o estabilidad reforzada, acoso laboral (Ley 1010 de 2006), solicitud de conciliación ante el inspector de trabajo, carta de terminación, contrato de trabajo (fijo, indefinido, obra o labor), otrosí y paz y salvo laboral.
- `seguridad_social`: solicitud de pensión (vejez, invalidez, sobrevivientes), corrección de historia laboral, indemnización sustitutiva, solicitud de calificación de pérdida de capacidad laboral, recurso contra el dictamen, reclamaciones a la EPS y a la ARL, devolución de saldos.
- `penal`: denuncia penal, querella, solicitud de conciliación preprocesal, solicitud de audiencia (preclusión, control de garantías, libertad, sustitución de medida), memorial de víctima, incidente de reparación integral, poder para representar a víctima, recursos, solicitud de libertad por vencimiento de términos, redención de pena, permiso administrativo, prisión domiciliaria, vigilancia electrónica.
- `comercial`: constitución de SAS (estatutos básicos), actas de asamblea, contrato de compraventa mercantil, suministro, distribución, agencia, cesión de cuotas o acciones, pagaré con carta de instrucciones, cobro prejurídico, requerimiento de pago.
- `consumidor`: reclamo directo al proveedor por garantía, derecho de retracto, reversión del pago, demanda de protección al consumidor ante la SIC.
- `datos`: reclamo de habeas data ante la entidad, solicitud de supresión, queja ante la SIC.
- `tributario`: derecho de petición a la DIAN, recurso de reconsideración, solicitud de devolución, respuesta a requerimiento ordinario y especial.
- `notarial`: solicitudes ante notaría (sucesión, divorcio, corrección de registro civil, cambio de nombre, constitución de patrimonio de familia), registro de instrumentos y certificados.
- `policivo`: querella policiva (Ley 1801 de 2016), descargos, recurso de apelación ante la autoridad de policía.
- `insolvencia`: solicitud de negociación de deudas de persona natural no comerciante, objeciones, acuerdo de pago.
- `disciplinario`: queja disciplinaria, descargos, recursos.
- `propiedad_intelectual`: oposición a solicitud de marca, respuesta a requerimiento de la SIC, carta de cese y desista, licencia de uso de marca.

Si identificas otros documentos de uso frecuente en la práctica colombiana, agrégalos en el área que corresponda.

## 2. Formato obligatorio de la respuesta

Responde **solo con un bloque JSON válido**, sin texto antes ni después, con esta estructura:

```json
{
  "templates": [
    {
      "code": "CONST-TUTELA-SALUD-01",
      "area": "constitucional",
      "category": "Tutela",
      "title": "Acción de tutela por negación de servicios de salud",
      "description": "Para cuando la EPS niega o demora un medicamento, procedimiento o tratamiento ordenado por el médico tratante.",
      "body": "Señor(a)\n{{juez}}\nE. S. D.\n\n**Referencia:** Acción de tutela\n**Accionante:** {{cliente_nombre}}\n**Accionada:** {{eps}}\n\n{{cliente_nombre}}, identificado(a) con {{cliente_documento}}, ...\n\n## HECHOS\n\n{{hechos}}\n\n## PRETENSIONES\n\n{{pretensiones}}",
      "fields": [
        { "key": "juez", "label": "Juez al que se dirige", "help": "Ej. Juez Civil Municipal de Cali (Reparto)" },
        { "key": "eps", "label": "EPS accionada" },
        { "key": "hechos", "label": "Hechos (uno por párrafo)" },
        { "key": "pretensiones", "label": "Pretensiones" }
      ],
      "keywords": ["tutela", "salud", "eps", "medicamento", "tratamiento"],
      "legalBasis": "Constitución Política art. 86; Decreto 2591 de 1991; Ley 1751 de 2015."
    }
  ]
}
```

Reglas de cada campo:

- `code`: único, en MAYÚSCULAS, con el formato `AREA-TEMA-NN`. No lo repitas entre lotes.
- `area`: uno de los códigos de la sección 1.
- `category`: categoría corta (Tutela, Poder, Demanda, Contestación, Recurso, Memorial, Contrato, Petición, Solicitud, Denuncia…).
- `body`: el texto completo del documento.
  - Separa los párrafos con una línea en blanco (`\n\n`).
  - Usa `# ` para el título centrado del documento y `## ` para los subtítulos (HECHOS, PRETENSIONES, FUNDAMENTOS DE DERECHO, PRUEBAS, ANEXOS, NOTIFICACIONES…).
  - Usa `**texto**` para la negrita.
  - Escapa correctamente las comillas y los saltos de línea dentro del JSON.
- Datos variables: escríbelos entre dobles llaves. Estos datos los llena la plataforma sola; úsalos con el nombre exacto:
  - `{{fecha}}`, `{{ciudad}}`.
  - Cliente: `{{cliente_nombre}}`, `{{cliente_documento}}`, `{{cliente_telefono}}`, `{{cliente_correo}}`, `{{cliente_ciudad}}`.
  - Abogado: `{{abogado_nombre}}`, `{{abogado_tp}}`, `{{abogado_correo}}`, `{{abogado_telefono}}`, `{{abogado_direccion}}`.
  - Caso: `{{despacho}}`, `{{radicado}}`, `{{contraparte}}`, `{{calidad_cliente}}`, `{{tipo_proceso}}`, `{{etapa}}`, `{{caso_titulo}}`, `{{caso_descripcion}}`.
  - Para cualquier otro dato, crea una llave en minúsculas con guion bajo (por ejemplo `{{valor_pretensiones}}`) y descríbela en `fields`.
- `fields`: todas las llaves propias que no estén en la lista anterior, con una etiqueta clara y, si ayuda, un ejemplo en `help`.
- `keywords`: de 4 a 10 palabras con las que un abogado buscaría la plantilla (sirven para sugerirla según el caso).
- `legalBasis`: las normas que fundamentan el documento.

## 3. Calidad jurídica

- Usa la normativa colombiana **vigente**: Constitución, CGP (Ley 1564 de 2012), CPACA (Ley 1437 de 2011 y Ley 2080 de 2021), Ley 2213 de 2022, CPT y SS, Ley 906 de 2004, Código Civil, Código de Comercio, Ley 1480 de 2011, Ley 1581 de 2012, Ley 1801 de 2016, Ley 1996 de 2019, Ley 2220 de 2022 (conciliación) y demás que apliquen.
- No inventes artículos, sentencias ni radicados. Si no estás seguro de un número de artículo, cita la ley sin el artículo.
- Incluye los requisitos formales que exige la ley para cada escrito (por ejemplo, el juramento en la tutela, el juramento estimatorio y el requisito de procedibilidad cuando apliquen, la dirección electrónica de notificaciones según la Ley 2213 de 2022 y el envío simultáneo a la contraparte).
- Redacción clara, formal y sin relleno. Deja en llaves lo que dependa del caso; no escribas hechos de ejemplo dentro del cuerpo.
- Cuando un documento tenga variantes importantes (por ejemplo, divorcio notarial frente a judicial), haz plantillas separadas.

## 4. Entrega por lotes

Entrega un área por respuesta, con todas sus plantillas. Al final de cada lote no agregues comentarios: solo el JSON. Empieza por el lote que te indique.

=====

## Después de importar

- Revise cada plantilla antes de usarla con clientes: la IA puede equivocarse.
- Las plantillas importadas por la administración aparecen para todos los abogados. Cada abogado puede **Personalizar** una plantilla (se crea su propia copia) o crear las suyas.
- Si un lote no se importa, el sistema indica cuál plantilla tiene el error (normalmente comillas sin escapar). Pídale a la IA: «Corrige el JSON del lote anterior para que sea válido».
