const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const SKIP_RESIZE_UNDER_BYTES = 2 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Some pickers hand over files with an empty `type`; fall back to the extension. */
function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[ext] ?? '';
}

export async function prepareForUpload(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const type = resolveMimeType(file);
  if (!type.startsWith('image/')) return { blob: file, mimeType: type };

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_SIDE / longest);
    const alreadySmall = scale === 1 && file.size <= SKIP_RESIZE_UNDER_BYTES;
    const supportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(type);
    if (alreadySmall && supportedType) return { blob: file, mimeType: type };

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    // JPEG has no alpha: paint white first so transparent PNGs don't turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', JPEG_QUALITY),
    );
    return { blob, mimeType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}
