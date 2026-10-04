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

  it('has select-only owner policies and a size/MIME-limited evidence bucket', async () => {
    const db = createDb();
    const policies = await db.execute<{ tablename: string; policyname: string; cmd: string }>(
      sql`select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename in ('loans','payments','payment_evidence','payment_corrections')`,
    );
    expect(new Set(policies.map((p) => p.tablename))).toEqual(
      new Set(['loans', 'payments', 'payment_evidence', 'payment_corrections']),
    );
    expect(policies.every((p) => p.cmd === 'SELECT')).toBe(true);

    const bucket = await db.execute<{ file_size_limit: string | number; allowed_mime_types: string[] }>(
      sql`select file_size_limit, allowed_mime_types from storage.buckets where id = 'evidence'`,
    );
    expect(Number(bucket[0]?.file_size_limit)).toBe(5242880);
    expect(bucket[0]?.allowed_mime_types).toEqual(
      expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    );
  });
});
