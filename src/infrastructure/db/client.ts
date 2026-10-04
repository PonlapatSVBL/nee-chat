import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { __neechatSql?: postgres.Sql };

export function createDb(url: string = process.env.DATABASE_URL ?? '') {
  if (!url) throw new Error('DATABASE_URL is not set');
  // prepare:false is required for Supabase's transaction pooler (port 6543).
  const sql = globalForDb.__neechatSql ?? postgres(url, { prepare: false, max: 10 });
  if (process.env.NODE_ENV !== 'production') globalForDb.__neechatSql = sql;
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbExecutor = Db | Tx;
