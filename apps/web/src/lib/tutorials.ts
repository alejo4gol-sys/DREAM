/**
 * Tutoriales de cada sección del menú lateral. Se muestran solos la primera vez que la persona
 * entra a la sección y se pueden volver a ver con el botón «?» del menú o «Tutorial» arriba.
 */
import { HELP_BRAND } from './help-brand';

export type TutorialStep = { title: string; body: string; tips?: string[] };
export type Tutorial = { key: string; title: string; intro: string; steps: TutorialStep[] };

export const TUTORIALS: Record<string, Tutorial> = {
  '/venta-rapida': { key: 'venta-rapida', title: 'Venta rápida', intro: 'Vende en 3 toques desde el celular.', steps: [
    { title: '1. Toca los productos', body: 'Cada toque suma una unidad. Usa el «−» para quitar. Puedes buscar por nombre o con el lector de código de barras.' },
    { title: '2. Elige cómo pagó', body: 'Efectivo, Nequi, Daviplata, transferencia o Bre-B, tarjeta, o «Fiado» si paga después.' },
    { title: '3. Confirma', body: 'Si eliges un cliente mayorista se aplican sus precios. Al confirmar se descuenta el inventario y, si quedó saldo, puedes enviarle el cobro por WhatsApp.', tips: ['Instala DREAMS en tu celular: en Chrome toca ⋮ → «Instalar app»; en iPhone, Compartir → «Agregar a inicio».'] },
  ] },
  '/catalogo': { key: 'catalogo', title: 'Catálogo para compartir', intro: 'Tu catálogo listo en segundos, siempre con los precios al día.', steps: [
    { title: 'PDF para WhatsApp', body: 'Elige precios al público o de una lista mayorista, una categoría y el diseño. Descárgalo o toca «Compartir PDF» desde el celular.' },
    { title: 'Diseño en Canva', body: 'Descarga el Excel y úsalo en «Crear en lote» de Canva con la plantilla que más te guste.' },
    { title: 'Catálogo sincronizado', body: 'Copia el enlace del catálogo y agrégalo como fuente de datos en el Administrador de ventas de Meta: tu catálogo de WhatsApp, Instagram y Facebook se actualiza solo.' },
  ] },
  '/paquetes': { key: 'paquetes', title: 'Paquetes y membresías', intro: 'Cobra por adelantado y fideliza a tus clientes.', steps: [
    { title: 'Crea el paquete', body: 'Paquete: un número de sesiones con fecha de vencimiento. Membresía: acceso por un tiempo (por ejemplo, un mes).' },
    { title: 'Véndelo', body: 'Regístralo en un cobro o venta con el cliente: queda activo en su cuenta al instante.' },
    { title: 'Registra cada visita', body: 'En «Clientes» toca «Registrar visita». Verás cuántas sesiones le quedan y cuáles vencen pronto.' },
  ] },
  '/mayoristas': { key: 'mayoristas', title: 'Ventas al por mayor', intro: 'Precios especiales, pedido mínimo, cupo y cartera.', steps: [
    { title: 'Crea una lista de precios', body: 'Ponle un descuento general (por ejemplo 20 %) y, si quieres, precios especiales y cantidad mínima por producto.', tips: ['DREAMS te avisa si un precio queda por debajo del costo.'] },
    { title: 'Asigna clientes', body: 'Agrega el cliente mayorista con su lista, su cupo de crédito y el plazo para pagar. En cada venta se aplican sus precios solos.' },
    { title: 'Controla la cartera', body: 'Ves cuánto debe cada cliente, cuánto está vencido según su plazo y el cupo disponible.' },
  ] },
  '/dashboard': { key: 'dashboard', title: 'Dashboard', intro: 'Tu negocio de un vistazo, cada vez que entras.', steps: [
    { title: 'Cómo va tu negocio', body: 'Arriba ves las ventas, la utilidad estimada, los gastos y el saldo disponible del período que elijas.', tips: ['Cambia entre Hoy, Esta semana, Este mes, Últimos 3 meses o Este año.', 'Las flechas comparan con el período anterior.'] },
    { title: 'Gráficos', body: 'Mira cómo se mueven tus ventas día a día, por qué canal llegan (Instagram, WhatsApp, página web…) y cuáles son tus productos más vendidos.' },
    { title: 'Alertas para actuar', body: 'Los productos con inventario bajo y las cuentas por cobrar aparecen aquí para que no se te pasen.', tips: ['Toca «Ver inventario» o «Ver clientes» para ir directo.'] },
  ] },
  '/ventas': { key: 'ventas', title: 'Ventas', intro: 'Registra cada venta y el resto se actualiza solo.', steps: [
    { title: 'Registrar una venta', body: 'Toca «Registrar venta», elige el cliente, los productos, el método de pago y el canal por donde llegó.', tips: ['El inventario, los ingresos, las cuentas por cobrar y la utilidad se actualizan automáticamente.'] },
    { title: 'Ventas a crédito o con abono', body: 'Si el cliente paga una parte, escribe lo que pagó: el resto queda como cuenta por cobrar. Luego registras los abonos desde la venta.' },
    { title: 'Buscar, imprimir y devolver', body: 'Filtra por Pagadas, Pendientes o Anuladas. Dentro de cada venta puedes imprimir el comprobante, anularla o registrar una devolución.' },
  ] },
  '/facturas': { key: 'facturas', title: 'Facturas', intro: 'Expide, descarga y guarda tus facturas con tu logo.', steps: [
    { title: 'Facturar una venta', body: 'Abre una venta o un cobro y toca «Facturar». Elige el tipo de documento, los datos del comprador (o consumidor final), la forma de pago y la garantía.', tips: ['Si no eres responsable de IVA y no estás obligado a facturar electrónicamente, puedes expedir un comprobante de venta.'] },
    { title: 'Tu diseño y tus datos', body: 'En «Ajustes de facturación» pones tu NIT, régimen, responsabilidades, logo, color, datos de pago, condiciones de garantía y la numeración que te autorizó la DIAN.' },
    { title: 'Factura electrónica', body: 'Si estás habilitado ante la DIAN, DREAMS reserva el número y arma la factura. La expides en la solución gratuita de la DIAN o con tu proveedor y registras aquí el CUFE y los archivos (XML y PDF).' },
    { title: 'Garantías y respaldo', body: 'Las facturas no se borran ni se editan: quedan guardadas con todos sus datos. En «Garantías vigentes» buscas por cliente, cédula, celular o producto cuando alguien hace un reclamo.', tips: ['Para corregir una factura, anúlala con nota crédito y expide una nueva.'] },
  ] },
  '/productos': { key: 'productos', title: 'Productos', intro: 'Tu catálogo: precios, costos, fotos y opciones.', steps: [
    { title: 'Crear un producto o servicio', body: 'Toca «Crear producto». Pon nombre, precio de venta, precio de compra (costo), stock mínimo, foto y descripción.', tips: ['El costo permite calcular tu utilidad real.', 'La descripción también la usa tu Asistente IA para responder dudas.'] },
    { title: 'Opciones y variantes', body: 'Agrega tallas, colores, sabores o extras con precio adicional. Para servicios con cita puedes configurar una agenda con días y horarios.' },
    { title: 'Categorías', body: 'Organiza tu catálogo con «Categorías». Así tus clientes filtran más fácil en tu página web.' },
  ] },
  '/comparar-precios': { key: 'comparar-precios', title: 'Precios del mercado', intro: 'Compara tus precios con ofertas de otros vendedores en Colombia.', steps: [
    { title: 'Busca cualquier producto', body: 'Escribe el nombre del producto y verás publicaciones con precio, vendedor y enlace.' },
    { title: 'Compáralo con tu catálogo', body: 'Elige uno de tus productos para ver si estás por encima o por debajo del mercado.', tips: ['Úsalo como referencia: revisa siempre que sea el mismo producto y estado.'] },
  ] },
  '/mi-tienda': { key: 'mi-tienda', title: 'Mi página web', intro: 'Crea tu propia página para vender en línea, a tu gusto.', steps: [
    { title: 'Elige una plantilla', body: 'En «Plantillas» escoge la que va con tu tipo de negocio. Organiza secciones, colores y forma de comprar; luego cambias todo lo que quieras.' },
    { title: 'Secciones y diseño', body: 'En «Secciones» ordenas, ocultas o agregas portada, catálogo, quiénes somos, galería, preguntas frecuentes, contacto y más. En «Diseño» cambias colores, letras y botones.', tips: ['A la derecha ves la vista previa en vivo, en computador o celular.'] },
    { title: 'Pagos y entregas', body: 'Activa tus medios de pago (Nequi, Daviplata, Bre-B, transferencia, link de pago, contra entrega…) con tus datos y QR. En «Entregas» defines domicilio, recogida y devoluciones.' },
    { title: 'Publica y comparte', body: 'Toca «Publicar página» y copia tu enlace en «Enlace y SEO». Ahí también eliges cómo se ve al compartirlo en WhatsApp.' },
  ] },
  '/pedidos-web': { key: 'pedidos-web', title: 'Pedidos y envíos', intro: 'Los pedidos que llegan desde tu página web.', steps: [
    { title: 'Confirma el pedido', body: 'Al confirmar, el inventario queda reservado para ese cliente. Si no puedes atenderlo, cancélalo y el stock se libera.' },
    { title: 'Pago y envío', body: 'Registra el pago cuando lo recibas. Agenda la recogida con la transportadora y guarda la guía; para pedidos que se recogen, márcalo «Listo para recoger».' },
    { title: 'Entrega y venta', body: 'Al marcarlo entregado se registra la venta automáticamente. Usa «Avisar por WhatsApp» para mantener informado al cliente.', tips: ['En «Carritos sin terminar» ves quién dejó productos sin comprar y autorizó que le escribieras.'] },
  ] },
  '/devoluciones': { key: 'devoluciones', title: 'Devoluciones', intro: 'Cambios y devoluciones de tus clientes, en orden.', steps: [
    { title: 'Llegan solas o las registras', body: 'Tus clientes las solicitan desde tu página web con su número de pedido y celular. También puedes registrar devoluciones de ventas en el local con «Registrar devolución».' },
    { title: 'Aprueba o rechaza', body: 'Revisa el motivo. Si la rechazas, escribe por qué: el cliente lo verá al consultar.' },
    { title: 'Recibe y resuelve', body: 'Cuando llegue el producto, marca lo que está en buen estado para que vuelva al inventario. Luego registra el reembolso o el cambio.', tips: ['Los reembolsos se restan de tus ventas en Contabilidad.'] },
  ] },
  '/inventario': { key: 'inventario', title: 'Inventario', intro: 'Cuánto tienes de cada producto y por qué cambió.', steps: [
    { title: 'Existencias', body: 'Ves el stock de cada producto y cuáles están por debajo del mínimo.' },
    { title: 'Movimientos (kárdex)', body: 'Cada entrada y salida queda registrada: compras, ventas, anulaciones, pedidos web, devoluciones y ajustes.' },
    { title: 'Ajustes', body: 'Si cuentas físicamente y no coincide, haz un ajuste con una nota del motivo (daño, pérdida, conteo).' },
  ] },
  '/clientes': { key: 'clientes', title: 'Clientes', intro: 'Tu lista de clientes y su historial.', steps: [
    { title: 'Ficha de cada cliente', body: 'Teléfono, ciudad, redes, canal por el que llegó, total gastado y última compra.' },
    { title: 'Segmentos', body: 'Filtra por Nuevos, Frecuentes, Inactivos y Alto valor para saber a quién escribirle.' },
    { title: 'Recompra y promociones', body: 'Desde la ficha puedes recordar una recompra por WhatsApp. Envía promociones solo a quienes lo autorizaron.' },
  ] },
  '/proveedores': { key: 'proveedores', title: 'Proveedores', intro: 'A quién le compras y cuánto le debes.', steps: [
    { title: 'Registra proveedores', body: 'Nombre, empresa, NIT, contacto y productos que te venden.' },
    { title: 'Compras de mercancía', body: 'Al registrar una compra entra el inventario y, si quedó saldo pendiente, aparece en Cuentas por pagar.' },
  ] },
  '/bancos': { key: 'bancos', title: 'Bancos', intro: 'Tus cuentas y movimientos, conectados con tus ventas.', steps: [
    { title: 'Agrega tus cuentas', body: 'Crea cada cuenta bancaria o billetera. Nunca te pedimos la clave del banco.' },
    { title: 'Carga los movimientos', body: 'Regístralos a mano o importa el extracto en CSV que descargas de tu banco.' },
    { title: 'Concilia', body: 'DREAMS te sugiere qué venta corresponde a cada ingreso. Acepta o rechaza; revisa los «Sin identificar».' },
  ] },
  '/finanzas': { key: 'finanzas', title: 'Finanzas', intro: 'Lo que entra y sale fuera de las ventas.', steps: [
    { title: 'Gastos', body: 'Registra arriendo, servicios, nómina, transporte, publicidad, comisiones y más. Si aún no lo pagas, déjalo pendiente.' },
    { title: 'Otros ingresos', body: 'Dinero que no viene de ventas: envíos cobrados, intereses, aportes.' },
    { title: 'Por cobrar y por pagar', body: 'Ve quién te debe y a quién le debes, y marca los pagos cuando ocurran.' },
  ] },
  '/contabilidad': { key: 'contabilidad', title: 'Contabilidad', intro: '¿Estoy ganando y en qué se va el dinero?', steps: [
    { title: 'Estado de resultados', body: 'Ventas, devoluciones, costo de lo vendido, gastos y utilidad neta del período.' },
    { title: 'Flujo de caja', body: 'El dinero que realmente entró y salió, día a día o mes a mes.' },
    { title: 'Ten en cuenta', body: 'Es contabilidad gerencial para tomar decisiones. No reemplaza la contabilidad formal ni a tu contador.' },
  ] },
  '/redes': { key: 'redes', title: 'Redes sociales', intro: 'Qué canal te trae ventas y clientes.', steps: [
    { title: 'Ventas por canal', body: 'Compara cuánto vendes por Instagram, Facebook, WhatsApp, TikTok, página web y tienda física.' },
    { title: 'Tus redes', body: 'Guarda los enlaces de las redes del negocio para mostrarlos en tu página web y abrirlos rápido.' },
    { title: 'Integraciones', body: 'La conexión directa con cada red requiere apps aprobadas por Meta, TikTok o Google. Aquí ves qué se necesita para cada una.' },
  ] },
  '/publicidad': { key: 'publicidad', title: 'Publicidad', intro: 'Crea anuncios y mide si venden.', steps: [
    { title: 'Crea la pieza', body: 'Elige un producto, el formato y el texto. Descarga la imagen y copia el texto listo para publicar.' },
    { title: 'Usa el enlace rastreable', body: 'Pon el enlace que genera DREAMS en tu anuncio: así sabes qué pedidos llegaron por esa campaña.', tips: ['También puedes crear un cupón para la campaña en Mi página web → Cupones.'] },
    { title: 'Mide el resultado', body: 'En «Resultados de campañas» registra cuánto invertiste y verás ventas, pedidos y retorno de cada campaña.' },
  ] },
  '/reportes': { key: 'reportes', title: 'Reportes', intro: 'Descarga tu información cuando la necesites.', steps: [
    { title: 'Elige el reporte y el período', body: 'Ventas, gastos, ingresos, utilidades, inventario, clientes, proveedores, bancos, conciliaciones y más, en las fechas que quieras.' },
    { title: 'Descarga', body: 'En PDF para compartir, Excel para trabajar o CSV para otro programa (por ejemplo, el de tu contador).' },
  ] },
  '/asistente': { key: 'asistente', title: 'Asistente IA', intro: 'Pregunta en tus palabras.', steps: [
    { title: 'Sobre tu negocio', body: 'Pregunta cuánto vendiste, tu producto más vendido, tu margen, qué se está agotando o cuánto te falta para la meta.' },
    { title: 'Respuesta para un cliente', body: 'Pega la pregunta de un cliente y te prepara una respuesta lista para copiar o enviar por WhatsApp.' },
    { title: 'Enséñale', body: 'En «Lo que sabe tu asistente» escribe cómo se usan tus servicios, cuidados y garantías. Entre más le enseñes, mejor responde.' },
  ] },
  '/configuracion': { key: 'configuracion', title: 'Configuración', intro: 'Tu negocio, tu equipo y tu seguridad.', steps: [
    { title: 'Negocio', body: 'Datos, logo, colores de tu marca y meta de ventas mensual.' },
    { title: 'Usuarios y roles', body: 'Invita a tu equipo con un rol: Administrador, Vendedor, Contador o Empleado. Cada uno ve solo lo que le corresponde.' },
    { title: 'Seguridad y notificaciones', body: 'Activa la verificación en dos pasos, revisa tus sesiones abiertas y elige qué avisos quieres recibir.' },
  ] },
};

/** Secciones propias de los negocios de servicios y versiones adaptadas de las comunes. */
export const SERVICE_TUTORIALS: Record<string, Tutorial> = {
  '/plantillas': { key: 'plantillas', title: 'Plantillas y documentos', intro: 'Poderes, tutelas, peticiones y contratos que se llenan con los datos del caso.', steps: [
    { title: 'Elige una plantilla', body: 'Búscala por nombre o área. En cada caso verás las plantillas sugeridas según el área, la categoría y la descripción.' },
    { title: 'Completa y revisa', body: 'Los datos del cliente, del despacho, del radicado y los tuyos se llenan solos. Escribe lo que falte, revisa el borrador y guárdalo en el caso.' },
    { title: 'Descarga en Word o PDF', body: 'Desde el documento guardado descárgalo para firmar o radicar.', tips: ['Puedes crear tus propias plantillas o importar una biblioteca completa en formato JSON.'] },
  ] },
  '/dashboard': { key: 'dashboard-servicios', title: 'Inicio', intro: 'Tu día y tu negocio de servicios de un vistazo.', steps: [
    { title: 'Lo de hoy', body: 'Arriba ves tus ingresos del mes, lo que tienes activo y las citas de hoy. Si cobras por horas, también las horas trabajadas.' },
    { title: 'Lo que vence', body: 'La lista de próximos 7 días te muestra lo que tiene fecha cerca: entregas prometidas, términos o vencimientos. Lo vencido aparece en rojo.' },
    { title: 'Listos para entregar', body: 'Avisa al cliente por WhatsApp con un toque cuando su trabajo esté listo. El mensaje lleva su código de seguimiento.' },
  ] },
  '/agenda': { key: 'agenda', title: 'Agenda', intro: 'Tus citas, audiencias, visitas o sesiones de la semana.', steps: [
    { title: 'Agenda en segundos', body: 'Toca «Agendar», elige el cliente, el servicio, la hora y si es presencial, virtual o a domicilio. Puedes asignarla a alguien de tu equipo.', tips: ['Si se cruza con otra cita del mismo responsable, DREAMS te avisa.'] },
    { title: 'Reservas desde tu página', body: 'Si un servicio es reservable en tu página web, tus clientes eligen fecha y hora y la cita aparece aquí sola (con el ícono de globo).' },
    { title: 'Confirma y recuerda', body: 'Marca cada cita como confirmada, atendida o no asistió. Con «Recordar» envías un recordatorio por WhatsApp listo para mandar.' },
  ] },
  '/trabajos': { key: 'trabajos', title: 'Casos y órdenes', intro: 'Todo lo que atiendes para cada cliente, de principio a fin.', steps: [
    { title: 'Registra lo que llega', body: 'Crea un registro por cada caso, equipo recibido o trabajo. Los campos se adaptan a tu tipo de servicio (por ejemplo radicado y despacho, o marca, modelo e IMEI).' },
    { title: 'Muévelo por estados', body: 'En el tablero ves cada uno en su columna. Dentro, cambia el estado con un toque: el cliente ve el avance con su código de seguimiento.' },
    { title: 'Cotiza, registra y cobra', body: 'Agrega los conceptos y envía la cotización por WhatsApp. Anota novedades y horas trabajadas en la bitácora. Al terminar, toca «Cobrar»: queda en Cobros, desde donde expides la factura.', tips: ['Marca una nota como «visible para el cliente» para que la vea en su seguimiento.'] },
  ] },
  '/solicitudes': { key: 'solicitudes', title: `Clientes de ${HELP_BRAND.name}`, intro: `Personas que buscan abogado te llegan desde la micro app gratuita ${HELP_BRAND.name}.`, steps: [
    { title: 'Completa tu perfil público', body: 'Pon tu nombre, tarjeta profesional, temas que atiendes y dónde atiendes. Cuando verifiquemos tu tarjeta empezarás a recibir solicitudes.' },
    { title: 'Envía tu propuesta', body: 'Lee el caso (sin datos personales de la persona), escribe tus honorarios, qué harías y en cuánto tiempo. Cada caso recibe máximo 5 propuestas y tiene un plazo.', tips: ['Las propuestas no pueden prometer resultados.', 'Usa la Calculadora de honorarios para fijar el valor.'] },
    { title: 'Si te eligen', body: 'Verás el nombre y el celular de la persona. Con un toque creas el cliente y el caso en DREAMS para empezar a trabajar.' },
    { title: `Comparte ${HELP_BRAND.name}`, body: 'En «Mi perfil público» está el enlace de la micro app para tus redes o un QR en tu oficina.' },
  ] },
  '/procesos': { key: 'procesos', title: 'Seguimiento de procesos', intro: 'Todas las actuaciones de tus procesos sin entrar a cada página.', steps: [
    { title: 'Vigila un proceso', body: 'Elige dónde está: Rama Judicial (automático), Fiscalía, notaría, registro, superintendencias, Colpensiones u otra entidad. Escribe el número y, si quieres, únelo al caso.' },
    { title: 'Rama Judicial: automático', body: 'Consultamos la Consulta Nacional Unificada varias veces al día. Cada actuación nueva te llega como aviso, con fecha y anotación.', tips: ['Los procesos con reserva no muestran actuaciones.'] },
    { title: 'Demás entidades: recordatorio', body: 'Como piden captcha o usuario, te llevamos a su consulta oficial con un toque y te recordamos revisarla cada cierto número de días. Registra la novedad y tu equipo queda avisado.' },
    { title: 'Avisos por WhatsApp', body: 'En la pestaña «Avisos por WhatsApp» registra tu celular y autoriza los avisos. Incluidos desde el plan Emprendedor.' },
  ] },
  '/terminos': { key: 'terminos', title: 'Términos y vencimientos', intro: 'Que no se te pase ninguna caducidad ni prescripción.', steps: [
    { title: 'Calcula el término', body: 'Elige el área y la acción o medio de control (nulidad y restablecimiento, reparación directa, ejecutivo, laboral, querella, prescripción penal…) y escribe la fecha desde la que corre.', tips: ['DREAMS cuenta meses y años con el calendario, excluye festivos en los términos de días y corre el vencimiento al siguiente día hábil.', 'Agrega suspensiones (conciliación) o interrupciones (reclamo laboral, imputación).'] },
    { title: 'Guárdalo y vigílalo', body: 'Ponle un nombre, asócialo a un caso y guárdalo. El semáforo te muestra lo vencido, lo que vence en 7 días y en 30 días.', tips: ['Recibes avisos a los 30, 15, 7, 3 y 1 día, y el día del vencimiento.'] },
    { title: 'Verifica antes de presentar', body: 'Cada término trae la autoridad competente, los requisitos previos y una lista de verificación. Cuando radiques, márcalo como presentado.' },
    { title: 'Consulta la guía', body: 'En «Guía de términos» tienes la diferencia entre caducidad y prescripción, los términos por área, la regla práctica para escoger el medio de control y la conciliación prejudicial.' },
  ] },
  '/honorarios': { key: 'honorarios', title: 'Calculadora de honorarios', intro: 'Calcula cuánto cobrar y arma una propuesta lista para enviar.', steps: [
    { title: 'Cuéntanos el caso', body: 'Escribe el asunto, elige el cliente y la tabla de referencia. Para abogados viene la tabla de tarifas 2026 (CONALBOS); también hay tablas de contadores, arquitectos, salud, belleza, celulares, electricistas y clases.' },
    { title: 'Elige el trámite y la cuantía', body: 'Escoge la especialidad y el tipo de proceso o servicio, o búscalo por nombre. Si depende de la cuantía, escribe el valor: DREAMS la clasifica (mínima, menor o mayor) y calcula solo.', tips: ['Puedes sumar varios conceptos: proceso, medidas cautelares, segunda instancia…', 'Toca «Cómo se calculó» para ver la fórmula paso a paso.'] },
    { title: 'Ajusta y define el pago', body: 'Sube o baja el valor por complejidad o urgencia, agrega descuento, IVA, gastos del proceso, anticipo y cuotas. Si cobras por resultado, agrega el porcentaje.' },
    { title: 'Envía y conviértelo en caso', body: 'Mándala por WhatsApp, imprímela o guárdala en PDF. Con «Crear caso» queda como cotización con todos los conceptos, lista para aprobar y cobrar.', tips: ['En «Mi tarifa por hora» calculas cuánto cobrar por hora según lo que quieres ganar.'] },
  ] },
  '/servicios': { key: 'servicios', title: 'Servicios', intro: 'Lo que ofreces y cuánto cuesta.', steps: [
    { title: 'Crea tus servicios', body: 'Nombre, precio y cómo se cobra: precio fijo, por hora, por sesión o mensual. La descripción la ven tus clientes en tu página y la usa tu Asistente IA.' },
    { title: 'Reservas en línea', body: 'Activa «Se puede reservar en mi página web», elige días, horario y duración. Puedes pedir un anticipo.' },
    { title: 'Repuestos y materiales', body: 'Si usas repuestos o insumos, créalos en su pestaña: esos sí manejan inventario y se descuentan cuando cobras.' },
  ] },
  '/ventas': { key: 'cobros', title: 'Cobros', intro: 'Todo lo que has cobrado y lo que te deben.', steps: [
    { title: 'Cobros desde tus casos u órdenes', body: 'Cuando cobras desde un caso u orden, el cobro aparece aquí con sus conceptos. También puedes registrar un cobro directo con «Nueva venta».' },
    { title: 'Anticipos y saldos', body: 'Si el cliente paga una parte, el resto queda como cuenta por cobrar. Registra los abonos dentro de cada cobro.' },
    { title: 'Comprobante', body: 'Imprime o comparte el comprobante de cada cobro.' },
  ] },
  '/pedidos-web': { key: 'reservas-web', title: 'Reservas web', intro: 'Lo que tus clientes reservan y pagan en tu página.', steps: [
    { title: 'Confirma la reserva', body: 'Cada reserva trae el servicio, la fecha y la hora elegidas, y ya está en tu Agenda.' },
    { title: 'Registra el pago', body: 'Si el cliente pagó un anticipo o el total por Nequi, transferencia o link de pago, márcalo como pagado.' },
    { title: 'Cierra el ciclo', body: 'Al marcarla como atendida/entregada, el cobro queda registrado en tus ingresos.' },
  ] },
};
export const tutorialsFor = (model?: string | null): Record<string, Tutorial> => model === 'SERVICES' ? { ...TUTORIALS, ...SERVICE_TUTORIALS } : TUTORIALS;

export const tutorialFor = (pathname: string, model?: string | null) => {
  const all = tutorialsFor(model);
  const key = Object.keys(all).find((h) => pathname === h || pathname.startsWith(h + '/'));
  return key ? all[key] : null;
};
