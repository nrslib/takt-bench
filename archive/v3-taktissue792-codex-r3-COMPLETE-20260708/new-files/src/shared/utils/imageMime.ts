export type SupportedImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export type SupportedImageExtension = 'png' | 'jpg' | 'gif' | 'webp';

const SUPPORTED_IMAGE_CONTENT_TYPES = new Set<SupportedImageMimeType>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

export function inferSupportedImageMimeTypeFromMagicBytes(data: Buffer): SupportedImageMimeType | null {
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

export function normalizeImageContentType(contentType: string): SupportedImageMimeType | null {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return SUPPORTED_IMAGE_CONTENT_TYPES.has(normalized as SupportedImageMimeType)
    ? normalized as SupportedImageMimeType
    : null;
}

export function extensionForSupportedImageMimeType(mimeType: string): SupportedImageExtension {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error(`Unsupported image MIME type: ${mimeType}`);
  }
}
