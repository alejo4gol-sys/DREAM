# Avisos por WhatsApp — cómo activarlos

DREAMS envía los avisos con la **API oficial de WhatsApp Business (Cloud API de Meta)**. No se usan
aplicaciones no oficiales ni WhatsApp Web, porque Meta bloquea esos números.

## Qué se necesita (una sola vez, lo hace la administración de DREAMS)

1. **Portafolio comercial de Meta** (business.facebook.com) a nombre de la empresa que opera DREAMS,
   con la **verificación del negocio** (RUT / certificado de existencia). Sin verificar solo se puede
   escribir a 250 personas al día.
2. **App de Meta** (developers.facebook.com → Crear app → tipo «Negocios») con el producto **WhatsApp**.
3. **Número de teléfono** exclusivo para DREAMS (no puede estar usado en la app de WhatsApp del celular).
   Se agrega en el WhatsApp Manager, se verifica por SMS o llamada y se registra. El nombre visible
   («DREAMS») lo aprueba Meta.
4. **Token permanente**: Configuración del negocio → Usuarios del sistema → crear uno (administrador),
   asignarle la app y la cuenta de WhatsApp, y generar un token sin vencimiento con los permisos
   `whatsapp_business_messaging` y `whatsapp_business_management`.
5. **Plantillas** (WhatsApp Manager → Plantillas de mensajes), categoría **Utilidad**, idioma
   **Español (Colombia) – es_CO**, parámetros **con nombre**, y un botón de tipo URL
   `https://SU-DOMINIO/{{1}}` (DREAMS completa el final del enlace):

   | Nombre | Texto |
   |---|---|
   | `dreams_novedad_proceso` | Hola {{nombre}}, hay una novedad en el proceso {{proceso}}: {{novedad}}. Revisa el detalle en DREAMS. — Botón «Ver proceso» |
   | `dreams_termino_por_vencer` | Hola {{nombre}}, el término {{termino}} vence el {{fecha}}. Revisa el caso en DREAMS. — Botón «Ver término» |
   | `dreams_recordatorio_proceso` | Hola {{nombre}}, te recordamos revisar el estado del proceso {{proceso}} en {{entidad}}. — Botón «Abrir proceso» |

   Pie sugerido: «Responde STOP para dejar de recibir avisos». No agregues promociones: si el texto
   promociona algo, Meta lo cambia a categoría Marketing (más costosa).
6. **Webhook** (App → WhatsApp → Configuración): URL `https://SU-DOMINIO-API/api/whatsapp/webhook`,
   token de verificación = el valor de `WHATSAPP_VERIFY_TOKEN`, suscribir el campo `messages`.
   Con él DREAMS sabe si el mensaje se entregó o se leyó, y si la persona respondió STOP.

## Variables en el servidor

```
WHATSAPP_TOKEN=<token permanente del usuario del sistema>
WHATSAPP_PHONE_NUMBER_ID=<identificador del número (no es el número)>
WHATSAPP_APP_SECRET=<clave secreta de la app, para verificar la firma del webhook>
WHATSAPP_VERIFY_TOKEN=<una palabra secreta que tú inventas>
APP_PUBLIC_URL=https://SU-DOMINIO
```

## Costos (referencia octubre de 2026)

Meta cobra por mensaje de plantilla entregado. Un mensaje de **Utilidad** a un número de Colombia cuesta
cerca de **USD 0,0008**, y es gratis si la persona escribió al número en las últimas 24 horas.
Verifica la tarifa vigente en la página de precios de WhatsApp Business antes de fijar precios.

## Quién recibe avisos

- Solo usuarios que registraron su celular y **autorizaron** los avisos en DREAMS → Seguimiento de
  procesos → Avisos por WhatsApp (se guarda el texto, la fecha y la IP de la autorización — Ley 1581).
- Solo negocios con plan **Emprendedor, Negocio o Empresa** y la suscripción activa.
- Responder **STOP** o «BAJA» retira la autorización.
