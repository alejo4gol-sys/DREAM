import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

/**
 * Almacén de rate limiting en Redis: el límite se comparte entre todas las instancias del API.
 * Ventana fija por clave; bloqueo opcional.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private redis: Redis;
  constructor(url: string) {
    this.redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const k = `throttle:${throttlerName}:${key}`;
    const blockKey = `${k}:blocked`;
    const blockedTtl = await this.redis.pttl(blockKey);
    if (blockedTtl > 0) {
      return { totalHits: limit + 1, timeToExpire: Math.ceil(blockedTtl / 1000), isBlocked: true, timeToBlockExpire: Math.ceil(blockedTtl / 1000) };
    }
    const [[, hits], [, pttl]] = (await this.redis.multi().incr(k).pttl(k).exec()) as [[null, number], [null, number]];
    if (pttl < 0) await this.redis.pexpire(k, ttl);
    const timeToExpire = Math.ceil((pttl < 0 ? ttl : pttl) / 1000);
    if (hits > limit && blockDuration > 0) {
      await this.redis.set(blockKey, '1', 'PX', blockDuration);
      return { totalHits: hits, timeToExpire, isBlocked: true, timeToBlockExpire: Math.ceil(blockDuration / 1000) };
    }
    return { totalHits: hits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
  }
}
