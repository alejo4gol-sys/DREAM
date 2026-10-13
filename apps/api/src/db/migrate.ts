import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from './db';

export async function runMigrations() {
  const pool = createPool();
  try {
    await migrate(createDb(pool), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => console.log('✔ Migraciones aplicadas'))
    .catch((e) => { console.error(e); process.exit(1); });
}
