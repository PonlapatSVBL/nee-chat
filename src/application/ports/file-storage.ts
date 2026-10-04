export interface SignedUpload {
  readonly url: string;
  readonly token: string;
}

export interface FileStorage {
  createSignedUploadUrl(path: string): Promise<SignedUpload>;
  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string>;
  delete(paths: readonly string[]): Promise<void>;
  exists(path: string): Promise<boolean>;
}
