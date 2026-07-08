export type SupportedImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_EXTENSIONS: Record<SupportedImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>(Object.keys(IMAGE_MIME_EXTENSIONS));

export function isSupportedImageMimeType(mimeType: string): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.has(mimeType);
}

export function normalizeImageContentType(contentType: string): SupportedImageMimeType | null {
  const mimeType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (!mimeType || !isSupportedImageMimeType(mimeType)) {
    return null;
  }
  return mimeType;
}

export function inferImageMimeTypeFromMagicBytes(data: Buffer): SupportedImageMimeType | null {
  if (data.length >= 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
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

export function extensionForImageMimeType(mimeType: string): string {
  if (!isSupportedImageMimeType(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  return IMAGE_MIME_EXTENSIONS[mimeType];
}
