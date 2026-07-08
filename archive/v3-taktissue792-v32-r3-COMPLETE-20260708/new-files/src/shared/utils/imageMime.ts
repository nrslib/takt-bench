export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export type ImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number];

const SUPPORTED_IMAGE_MIME_TYPE_SET = new Set<string>(SUPPORTED_IMAGE_MIME_TYPES);

export function isSupportedImageMimeType(value: string): value is ImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPE_SET.has(value);
}

export function parseImageContentType(header: string | undefined): ImageMimeType {
  if (header === undefined) {
    throw new Error('Image Content-Type is required.');
  }
  const mimeType = header.split(';')[0]!.trim().toLowerCase();
  if (!isSupportedImageMimeType(mimeType)) {
    throw new Error(`Unsupported image Content-Type: ${mimeType}`);
  }
  return mimeType;
}

export function inferImageMimeTypeFromMagicBytes(data: Buffer): ImageMimeType | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
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

export function extensionForImageMimeType(mimeType: ImageMimeType): 'png' | 'jpg' | 'gif' | 'webp' {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
  }
}

export function assertImageMimeMatchesBytes(contentTypeMime: ImageMimeType, data: Buffer): void {
  const bytesMimeType = inferImageMimeTypeFromMagicBytes(data);
  if (bytesMimeType === null) {
    throw new Error('Unsupported image data. Expected PNG, JPEG, GIF, or WebP.');
  }
  if (contentTypeMime !== bytesMimeType) {
    throw new Error(`Image Content-Type does not match image data: ${contentTypeMime} !== ${bytesMimeType}`);
  }
}
