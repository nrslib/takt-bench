export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number];

export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const SUPPORTED_IMAGE_MIME_TYPE_SET = new Set<string>(SUPPORTED_IMAGE_MIME_TYPES);

const IMAGE_MIME_EXTENSIONS: Record<SupportedImageMimeType, 'png' | 'jpg' | 'gif' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function normalizeContentType(contentType: string): string {
  return contentType.split(';', 1)[0]!.trim().toLowerCase();
}

export function isSupportedImageMimeType(value: string): value is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPE_SET.has(value);
}

export function extensionForImageMimeType(mimeType: SupportedImageMimeType): 'png' | 'jpg' | 'gif' | 'webp' {
  return IMAGE_MIME_EXTENSIONS[mimeType];
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

export function assertSupportedImageContentType(
  contentType: string | undefined,
  data: Buffer,
): SupportedImageMimeType {
  if (!contentType) {
    throw new Error('Image Content-Type is required.');
  }

  const normalizedContentType = normalizeContentType(contentType);
  if (!isSupportedImageMimeType(normalizedContentType)) {
    throw new Error(`Unsupported image Content-Type: ${normalizedContentType}`);
  }

  const magicMimeType = inferImageMimeTypeFromMagicBytes(data);
  if (!magicMimeType) {
    throw new Error('Unsupported image data. Expected PNG, JPEG, GIF, or WebP data.');
  }
  if (normalizedContentType !== magicMimeType) {
    throw new Error(`Image Content-Type does not match image data: ${normalizedContentType} !== ${magicMimeType}`);
  }

  return magicMimeType;
}
