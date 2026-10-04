import type { SupabaseClient } from '@supabase/supabase-js';
import type { FileStorage, SignedUpload } from '@/application/ports/file-storage';

export class SupabaseFileStorage implements FileStorage {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string = 'evidence',
  ) {}

  async createSignedUploadUrl(path: string): Promise<SignedUpload> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`createSignedUploadUrl failed: ${error?.message ?? 'no data'}`);
    return { url: data.signedUrl, token: data.token };
  }

  async createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw new Error(`createSignedUrl failed: ${error?.message ?? 'no data'}`);
    return data.signedUrl;
  }

  async delete(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(this.bucket).remove([...paths]);
    if (error) throw new Error(`remove failed: ${error.message}`);
  }

  async exists(path: string): Promise<boolean> {
    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '' : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    const { data, error } = await this.client.storage.from(this.bucket).list(dir, { search: name, limit: 1 });
    if (error) throw new Error(`list failed: ${error.message}`);
    return (data ?? []).some((f) => f.name === name);
  }
}
