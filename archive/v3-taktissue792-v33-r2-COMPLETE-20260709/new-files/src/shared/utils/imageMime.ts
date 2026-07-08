export type SupportedImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_EXTENSIONS: Record<SupportedImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isSupportedImageMimeType(mimeType: string): mimeType is SupportedImageMimeType {
  return Object.prototype.hasOwnProperty.call(IMAGE_MIME_EXTENSIONS, mimeType);
}

export function normalizeImageContentType(contentType: string): SupportedImageMimeType {
  const mimeType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (!mimeType || !isSupportedImageMimeType(mimeType)) {
    throw new Error(`Unsupported image content-type: ${contentType}`);
  }
  return mimeType;
}

export function extensionForImageMimeType(mimeType: string, label: string): string {
  if (!isSupportedImageMimeType(mimeType)) {
    throw new Error(`Unsupported ${label} type: ${mimeType}`);
  }
  return IMAGE_MIME_EXTENSIONS[mimeType];
}

export function inferMimeTypeFromMagicBytes(data: Buffer): SupportedImageMimeType | null {
  if (data.length >= PNG_SIGNATURE.length && data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (data.subarray(0, 6).equals(Buffer.from('GIF87a')) || data.subarray(0, 6).equals(Buffer.from('GIF89a'))) {
    return 'image/gif';
  }
  if (data.length >= 12 && data.subarray(0, 4).equals(Buffer.from('RIFF')) && data.subarray(8, 12).equals(Buffer.from('WEBP'))) {
    return 'image/webp';
  }
  return null;
}

export function assertImageMagicBytesMatch(
  data: Buffer,
  expectedMimeType: SupportedImageMimeType,
  label: string,
): void {
  const detectedMimeType = inferMimeTypeFromMagicBytes(data);
  if (detectedMimeType === null) {
    throw new Error(`Unsupported ${label} magic bytes. Expected PNG, JPEG, GIF, or WebP data.`);
  }
  if (detectedMimeType !== expectedMimeType) {
    throw new Error(`${label} magic bytes do not match content-type: ${detectedMimeType} !== ${expectedMimeType}`);
  }
}
