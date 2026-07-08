export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number];

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

export function getImageExtensionForMimeType(mimeType: string): string {
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
