export const SUPPORTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

export type SupportedImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number];

export type SupportedImageExtension = 'png' | 'jpg' | 'gif' | 'webp';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87A_SIGNATURE = Buffer.from('GIF87a');
const GIF89A_SIGNATURE = Buffer.from('GIF89a');
const RIFF_SIGNATURE = Buffer.from('RIFF');
const WEBP_SIGNATURE = Buffer.from('WEBP');

export function isSupportedImageMimeType(mimeType: string): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMimeType);
}

function startsWithSignature(data: Buffer, signature: Buffer): boolean {
  return data.length >= signature.length && data.subarray(0, signature.length).equals(signature);
}

export function inferImageMimeTypeFromMagicBytes(data: Buffer): SupportedImageMimeType | null {
  if (startsWithSignature(data, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWithSignature(data, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (startsWithSignature(data, GIF87A_SIGNATURE) || startsWithSignature(data, GIF89A_SIGNATURE)) {
    return 'image/gif';
  }
  if (
    data.length >= 12
    && data.subarray(0, 4).equals(RIFF_SIGNATURE)
    && data.subarray(8, 12).equals(WEBP_SIGNATURE)
  ) {
    return 'image/webp';
  }
  return null;
}

export function extensionForImageMimeType(mimeType: string): SupportedImageExtension {
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
