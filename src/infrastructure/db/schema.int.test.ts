import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from './client';

describe('database schema', () => {
  it('has the ledger tables, RLS enabled, and the evidence bucket', async () => {
    const db = createDb();
    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = tables.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(['loans', 'payments', 'payment_evidence', 'payment_corrections']));

    const rls = await db.execute<{ relname: string; relrowsecurity: boolean }>(
      sql`select relname, relrowsecurity from pg_class where relname in ('loans','payments','payment_evidence','payment_corrections')`,
    );
    expect(rls.every((r) => r.relrowsecurity)).toBe(true);

    const bucket = await db.execute<{ id: string; public: boolean }>(sql`select id, public from storage.buckets where id = 'evidence'`);
    expect(bucket[0]).toMatchObject({ id: 'evidence', public: false });
  });
});
