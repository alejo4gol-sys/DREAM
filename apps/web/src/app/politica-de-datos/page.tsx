import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
import { LEGAL_ENTITY as E } from '@/lib/legal-entity';

export const metadata: Metadata = { title: { absolute: 'Política de tratamiento de datos personales — DREAMS' }, description: 'Cómo DREAMS recolecta, usa y protege los datos personales, conforme a la Ley 1581 de 2012.' };

export default function DataPolicy() {
  return <LegalPage title="Política de tratamiento de datos personales" updated={E.updated}>
    <p>Esta política explica cómo se tratan los datos personales en la plataforma DREAMS, en cumplimiento de la Ley Estatutaria 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto Único 1074 de 2015) y demás normas que los modifiquen o complementen.</p>

    <h2>1. Responsable del tratamiento</h2>
    <ul>
      <li>Nombre: {E.name}</li><li>NIT: {E.nit}</li><li>Domicilio: {E.address}, {E.city}</li><li>Correo para asuntos de datos personales: {E.email}</li><li>Teléfono: {E.phone}</li>
    </ul>

    <h2>2. Dos calidades distintas</h2>
    <p><b>Como responsable</b>, DREAMS trata los datos de las personas que crean una cuenta (propietarios y miembros de los negocios), de quienes usan la micro app «¿Qué hago?» y de quienes dejan reseñas en el directorio.</p>
    <p><b>Como encargado</b>, DREAMS trata por cuenta de cada negocio los datos de sus clientes, proveedores y empleados que el negocio registra en la plataforma. En ese caso el responsable es el negocio, que debe contar con la autorización de sus titulares y atender sus solicitudes; DREAMS solo los trata para prestar el servicio al negocio y siguiendo sus instrucciones.</p>

    <h2>3. Datos que tratamos</h2>
    <ul>
      <li>Identificación y contacto: nombre, documento o NIT, teléfono, correo, ciudad y dirección.</li>
      <li>Datos de la cuenta y de seguridad: contraseña cifrada, registros de acceso, dirección IP y dispositivo.</li>
      <li>Información del negocio: productos, ventas, gastos, facturas, clientes, inventario y configuración.</li>
      <li>Información financiera que el negocio decida conectar: movimientos bancarios mediante proveedores autorizados. DREAMS nunca pide ni guarda la contraseña de su banco.</li>
      <li>Reseñas y opiniones: nombre que la persona decide mostrar, calificación y comentario.</li>
    </ul>
    <p>No solicitamos datos sensibles. Si una persona los incluye voluntariamente (por ejemplo, al describir un caso en «¿Qué hago?»), se tratarán solo para la finalidad para la que los entregó y no está obligada a suministrarlos.</p>

    <h2>4. Finalidades</h2>
    <ul>
      <li>Crear y administrar la cuenta, autenticar a los usuarios y proteger la plataforma.</li>
      <li>Prestar las funciones contratadas: ventas, inventario, facturación, página web, catálogo, cobros, reportes y avisos.</li>
      <li>Cobrar los planes de suscripción y aplicar beneficios del programa de referidos.</li>
      <li>Enviar avisos del servicio por la plataforma, correo o WhatsApp, cuando el usuario los active.</li>
      <li>Publicar en el directorio la ficha del negocio que lo autorice, y las reseñas que las personas dejen.</li>
      <li>Publicar opiniones de usuarios en la página de DREAMS solo con su autorización expresa.</li>
      <li>Atender solicitudes, peticiones, quejas y reclamos, y cumplir obligaciones legales.</li>
      <li>Elaborar estadísticas agregadas y anónimas para mejorar el servicio.</li>
    </ul>

    <h2>5. Derechos de los titulares</h2>
    <p>Como titular usted puede: conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización; ser informado sobre el uso de sus datos; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización o pedir la supresión cuando no exista un deber legal o contractual de conservarlos; y acceder gratuitamente a sus datos.</p>

    <h2>6. Cómo ejercer sus derechos</h2>
    <p>Escriba a {E.email} indicando su nombre, documento, la solicitud y un medio de respuesta.</p>
    <ul>
      <li><b>Consultas:</b> se responden en máximo diez (10) días hábiles, prorrogables por cinco (5) días hábiles más, informando el motivo.</li>
      <li><b>Reclamos</b> (corrección, actualización, supresión o incumplimiento): se responden en máximo quince (15) días hábiles, prorrogables por ocho (8) días hábiles más, informando el motivo.</li>
    </ul>
    <p>Si sus datos fueron registrados por un negocio que usa DREAMS (por ejemplo, como cliente de una tienda), puede dirigirse directamente a ese negocio; si nos escribe, le trasladaremos la solicitud.</p>

    <h2>7. Seguridad</h2>
    <p>Usamos conexiones cifradas, contraseñas almacenadas con algoritmos de cifrado, credenciales de terceros cifradas, verificación en dos pasos opcional, permisos por rol, registros de actividad y copias de seguridad. Ningún sistema es infalible; si conocemos un incidente que afecte sus datos, informaremos a los afectados y a la autoridad cuando corresponda.</p>

    <h2>8. Transferencia y transmisión</h2>
    <p>Para operar, DREAMS puede usar proveedores de infraestructura en la nube, pasarelas de pago, mensajería y facturación electrónica, que pueden estar ubicados fuera de Colombia. Con ellos se exigen condiciones de seguridad y confidencialidad, en los términos de la ley.</p>

    <h2>9. Menores de edad</h2>
    <p>La plataforma está dirigida a personas mayores de edad. Si un negocio registra datos de menores, debe hacerlo con la autorización de su representante y respetando su interés superior.</p>

    <h2>10. Vigencia</h2>
    <p>Esta política rige desde su publicación. Los datos se conservan mientras la cuenta esté activa y durante el tiempo necesario para cumplir obligaciones legales, contables o contractuales. Los cambios importantes se informarán en la plataforma.</p>
  </LegalPage>;
}
