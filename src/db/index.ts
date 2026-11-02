import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const isPostgresConfigured = (): boolean => {
  const host = (process.env.SQL_HOST || '').trim();
  return Boolean(host && !host.startsWith('YOUR_'));
};

export const createPool = () => {
  if (!global._postgresPool) {
    const configured = isPostgresConfigured();
    global._postgresPool = new Pool({
      host: configured ? process.env.SQL_HOST : '127.0.0.1',
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD || '',
      database: process.env.SQL_DB_NAME || 'postgres',
      max: 10,
      connectionTimeoutMillis: configured ? 15000 : 1200,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
