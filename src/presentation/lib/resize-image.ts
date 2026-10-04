const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const SKIP_RESIZE_UNDER_BYTES = 2 * 1024 * 1024;

export async function prepareForUpload(file: File): Promise<{ blob: Blob; mimeType: string }> {
  if (!file.type.startsWith('image/')) return { blob: file, mimeType: file.type };

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_SIDE / longest);
    const alreadySmall = scale === 1 && file.size <= SKIP_RESIZE_UNDER_BYTES;
    const supportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (alreadySmall && supportedType) return { blob: file, mimeType: file.type };

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', JPEG_QUALITY),
    );
    return { blob, mimeType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}
