import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { createServiceClient } from '@/infrastructure/supabase/service-client';
import { SupabaseFileStorage } from './supabase-file-storage';

const storage = new SupabaseFileStorage(createServiceClient());
const path = `${randomUUID()}/payments/${randomUUID()}/${randomUUID()}.png`;
// 1x1 transparent PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

afterAll(async () => {
  await storage.delete([path]);
});

describe('SupabaseFileStorage', () => {
  it('signs an upload, accepts a client upload, signs a read URL, and deletes', async () => {
    const signed = await storage.createSignedUploadUrl(path);
    expect(signed.token).toBeTruthy();

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const upload = await anon.storage.from('evidence').uploadToSignedUrl(path, signed.token, png, { contentType: 'image/png' });
    expect(upload.error).toBeNull();

    expect(await storage.exists(path)).toBe(true);

    const url = await storage.createSignedReadUrl(path, 60);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');

    await storage.delete([path]);
    expect(await storage.exists(path)).toBe(false);
  });

  it('rejects disallowed MIME at the bucket level', async () => {
    const badPath = `${randomUUID()}/payments/x/y.gif`;
    const signed = await storage.createSignedUploadUrl(badPath);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const upload = await anon.storage.from('evidence').uploadToSignedUrl(badPath, signed.token, png, { contentType: 'image/gif' });
    expect(upload.error).not.toBeNull();
  });
});
