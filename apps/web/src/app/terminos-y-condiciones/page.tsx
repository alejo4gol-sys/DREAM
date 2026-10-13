import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';
import { LEGAL_ENTITY as E } from '@/lib/legal-entity';

export const metadata: Metadata = { title: { absolute: 'Términos y condiciones — DREAMS' }, description: 'Condiciones de uso de la plataforma DREAMS para negocios.' };

export default function Terms() {
  return <LegalPage title="Términos y condiciones de uso" updated={E.updated}>
    <p>Estos términos regulan el uso de DREAMS, plataforma en línea operada por {E.name} (NIT {E.nit}), con domicilio en {E.city}. Al crear una cuenta usted declara que los leyó y los acepta. Si actúa en nombre de un negocio, declara que tiene facultades para obligarlo.</p>

    <h2>1. El servicio</h2>
    <p>DREAMS es un software en la nube para administrar un negocio: ventas, inventario, clientes, proveedores, página web, catálogos, cobros, contabilidad gerencial, reportes, avisos y herramientas para profesionales. Algunas funciones dependen de servicios de terceros (bancos, pasarelas de pago, Meta/WhatsApp, proveedores de facturación electrónica, Rama Judicial y otras entidades) y solo funcionan cuando esos terceros lo permiten y el usuario los conecta.</p>

    <h2>2. Cuenta y seguridad</h2>
    <ul>
      <li>Debe ser mayor de edad y entregar información veraz.</li>
      <li>Es responsable de guardar su contraseña, de los usuarios que cree y de los permisos que les asigne.</li>
      <li>Avísenos de inmediato si sospecha un uso no autorizado.</li>
    </ul>

    <h2>3. Planes, pagos y cancelación</h2>
    <ul>
      <li>El plan Gratis no tiene costo. Los planes pagos se cobran por mes anticipado al precio publicado en la página, a través de la pasarela de pagos.</li>
      <li>Puede cambiar de plan desde Configuración o solicitar su cancelación en cualquier momento; la cancelación evita los cobros siguientes y conserva el plan hasta el final del periodo pagado.</li>
      <li>Si un pago no se realiza, la cuenta vuelve al plan Gratis y se mantienen sus datos dentro de los límites de ese plan.</li>
      <li>Cuando aplique el Estatuto del Consumidor (Ley 1480 de 2011), se respetarán los derechos que este reconoce, incluido el derecho de retracto en los casos y plazos que la ley establece.</li>
    </ul>

    <h2>4. Programa «Invita y gana» (referidos)</h2>
    <ul>
      <li>Cada negocio tiene un enlace y un código para invitar a otros negocios.</li>
      <li>El negocio que invita gana <b>quince (15) días</b> por cada negocio invitado que se registre con su enlace o código y <b>pague por primera vez un plan</b>. No se gana nada por registros que permanezcan en el plan Gratis.</li>
      <li>Si quien invita está en el plan Gratis, recibe 15 días del plan Emprendedor; si ya tiene un plan pago, se suman 15 días a su periodo actual.</li>
      <li>Los días no son canjeables por dinero, no son transferibles y cada negocio invitado genera el beneficio una sola vez.</li>
      <li>Se pueden anular los beneficios obtenidos con cuentas falsas, autoinvitaciones o cualquier abuso, y modificar o terminar el programa informándolo en la plataforma, sin afectar los días ya ganados de buena fe.</li>
    </ul>

    <h2>5. Información del negocio y de sus clientes</h2>
    <p>Usted es el dueño de la información que registra. Respecto de los datos personales de sus clientes, proveedores y empleados, usted es el responsable del tratamiento y DREAMS actúa como encargado (ver la <Link href="/politica-de-datos" className="underline">política de tratamiento de datos</Link>). Usted debe contar con las autorizaciones necesarias, por ejemplo para enviar promociones.</p>

    <h2>6. Contabilidad, facturación y documentos</h2>
    <ul>
      <li>La contabilidad de DREAMS es gerencial y no reemplaza la contabilidad financiera ni la asesoría de un contador público cuando la ley la exige.</li>
      <li>La facturación electrónica requiere que el negocio esté habilitado ante la DIAN y contrate el proveedor tecnológico. El negocio es responsable de la información de sus facturas.</li>
      <li>Las plantillas de documentos para abogados y otros profesionales son borradores de apoyo: el profesional responde por revisarlas, adaptarlas y usarlas.</li>
      <li>La orientación de «¿Qué hago?» es general y no constituye asesoría jurídica.</li>
    </ul>

    <h2>7. Directorio, reseñas y opiniones</h2>
    <ul>
      <li>Los negocios que publiquen su página pueden aparecer en el directorio «Negocios en DREAMS»; pueden ocultarse o quitar el mapa en cualquier momento.</li>
      <li>Las reseñas deben basarse en experiencias reales, sin lenguaje ofensivo, datos personales de terceros ni publicidad. El negocio puede responderlas y reportarlas; DREAMS puede retirar las que incumplan estas reglas, pero no las borra por ser negativas.</li>
      <li>Las opiniones sobre DREAMS que se muestran en la página principal se publican solo con autorización expresa de su autor.</li>
    </ul>

    <h2>8. Uso aceptable</h2>
    <p>No está permitido usar DREAMS para actividades ilegales, vender productos prohibidos, enviar mensajes no autorizados, suplantar a otros, vulnerar la seguridad de la plataforma ni extraer datos de manera automatizada. El incumplimiento puede llevar a suspender la cuenta.</p>

    <h2>9. Disponibilidad y responsabilidad</h2>
    <p>Trabajamos para que la plataforma esté disponible y segura, con copias de seguridad periódicas, pero pueden presentarse interrupciones por mantenimiento o por causas ajenas. DREAMS no responde por fallas de los servicios de terceros ni por decisiones del negocio basadas en la información de la plataforma. En lo permitido por la ley, la responsabilidad se limita al valor pagado por el servicio en los tres (3) meses anteriores al hecho.</p>

    <h2>10. Terminación</h2>
    <p>Puede solicitar el cierre de su cuenta cuando quiera. Antes de hacerlo puede descargar sus reportes. Después del cierre, los datos se conservan solo el tiempo que exija la ley y luego se eliminan o anonimizan.</p>

    <h2>11. Cambios, ley aplicable y contacto</h2>
    <p>Estos términos pueden actualizarse; los cambios importantes se avisarán en la plataforma con anticipación. Se rigen por las leyes de la República de Colombia. Para cualquier inquietud escriba a {E.email}.</p>
  </LegalPage>;
}
