import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { config } from '../config';

export type Db = NodePgDatabase<typeof schema>;
/** Transacción o conexión: ambos exponen la misma API de consultas. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const DB = Symbol('DB');
export const InjectDb = () => Inject(DB);

export function createPool() {
  const p = new Pool({ connectionString: config.databaseUrl, max: Number(process.env.DB_POOL_MAX ?? 10) });
  // Un cliente inactivo que pierde la conexión no debe tumbar el proceso; el pool lo reemplaza.
  p.on('error', (e) => console.error('[db] error en conexión inactiva:', e.message));
  return p;
}

export function createDb(pool: Pool): Db {
  return drizzle(pool, { schema, casing: 'snake_case' });
}

let pool: Pool | undefined;

@Global()
@Module({
  providers: [{ provide: DB, useFactory: () => createDb((pool = createPool())) }],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await pool?.end();
  }
}
