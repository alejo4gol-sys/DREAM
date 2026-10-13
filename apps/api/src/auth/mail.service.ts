import { Injectable, Logger } from '@nestjs/common';

/**
 * Envío de correos. En desarrollo se imprime en consola.
 * Producción: implementar con un proveedor transaccional (Amazon SES, Postmark, SendGrid)
 * usando sus credenciales en variables de entorno.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  async send(to: string, subject: string, text: string) {
    this.logger.log(`\n──── Correo (modo desarrollo) ────\nPara: ${to}\nAsunto: ${subject}\n\n${text}\n─────────────────────────────────`);
  }
}
