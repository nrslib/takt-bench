export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const SUPPORTED_IMAGE_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const);

export type SupportedImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number];

const IMAGE_EXTENSION_BY_MIME_TYPE = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
} satisfies Record<SupportedImageMimeType, string>);

export function isSupportedImageMimeType(mimeType: string): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMimeType);
}

export function getImageFileExtension(mimeType: string): string {
  if (!isSupportedImageMimeType(mimeType)) {
    throw new Error(`Unsupported image MIME type: ${mimeType}`);
  }
  return IMAGE_EXTENSION_BY_MIME_TYPE[mimeType];
}

export function inferImageMimeTypeFromFileName(fileName: string): SupportedImageMimeType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
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
  if (
    data.length >= 12
    && data.subarray(0, 4).equals(Buffer.from('RIFF'))
    && data.subarray(8, 12).equals(Buffer.from('WEBP'))
  ) {
    return 'image/webp';
  }
  return null;
}
