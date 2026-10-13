import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config';

/**
 * Cifrado de datos sensibles en reposo (AES-256-GCM): secretos 2FA, números de cuenta,
 * tokens de bancos y redes sociales. Formato: v1:<iv>:<tag>:<ciphertext> (base64url).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const key = Buffer.from(config.encryptionKey, 'base64');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY debe ser de 32 bytes en base64');
    this.key = key;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join(':');
  }

  decrypt(payload: string): string {
    const [v, iv, tag, data] = payload.split(':');
    if (v !== 'v1') throw new Error('Formato de cifrado desconocido');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }

  /** Token aleatorio opaco (refresh, recuperación). */
  randomToken(bytes = 32) {
    return randomBytes(bytes).toString('base64url');
  }

  /** Hash para guardar tokens (nunca se guardan en claro). */
  sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
