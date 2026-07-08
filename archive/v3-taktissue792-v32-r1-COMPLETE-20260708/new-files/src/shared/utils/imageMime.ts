export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type SupportedImageMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp';

export interface ValidatedImageMime {
  mimeType: SupportedImageMimeType;
  extension: string;
}

const SUPPORTED_IMAGE_MIME_TYPES = new Map<SupportedImageMimeType, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF_MINIMUM_HEADER_BYTES = 13;
const RIFF_HEADER_BYTES = 12;

export function normalizeImageContentType(contentType: string): SupportedImageMimeType {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  if (
    normalized === 'image/png'
    || normalized === 'image/jpeg'
    || normalized === 'image/gif'
    || normalized === 'image/webp'
  ) {
    return normalized;
  }
  throw new Error(`Unsupported image Content-Type: ${contentType}`);
}

export function inferImageMimeTypeFromMagicBytes(data: Buffer): SupportedImageMimeType | null {
  if (data.length >= PNG_SIGNATURE.length && data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (
    data.length >= 4
    && data[0] === 0xff
    && data[1] === 0xd8
    && data[2] === 0xff
    && data[3] !== undefined
    && data[3] >= 0xc0
    && data[3] <= 0xfe
    && data[3] !== 0xd8
    && data[3] !== 0xd9
  ) {
    return 'image/jpeg';
  }
  if (
    data.length >= GIF_MINIMUM_HEADER_BYTES
    && (data.subarray(0, 6).equals(Buffer.from('GIF87a')) || data.subarray(0, 6).equals(Buffer.from('GIF89a')))
  ) {
    return 'image/gif';
  }
  if (
    data.length >= RIFF_HEADER_BYTES
    && data.subarray(0, 4).equals(Buffer.from('RIFF'))
    && data.subarray(8, 12).equals(Buffer.from('WEBP'))
    && data.readUInt32LE(4) <= data.length - 8
  ) {
    return 'image/webp';
  }
  return null;
}

export function extensionForImageMimeType(mimeType: SupportedImageMimeType): string {
  const extension = SUPPORTED_IMAGE_MIME_TYPES.get(mimeType);
  if (extension === undefined) {
    throw new Error(`Unsupported image MIME type: ${mimeType}`);
  }
  return extension;
}

export function validateImageDataMime(data: Buffer, contentType: string): ValidatedImageMime {
  const contentMimeType = normalizeImageContentType(contentType);
  const dataMimeType = inferImageMimeTypeFromMagicBytes(data);
  if (dataMimeType === null) {
    throw new Error('Unsupported image data. Expected PNG, JPEG, GIF, or WebP magic bytes.');
  }
  if (dataMimeType !== contentMimeType) {
    throw new Error(`Image Content-Type does not match image data: ${contentMimeType} !== ${dataMimeType}`);
  }
  return {
    mimeType: dataMimeType,
    extension: extensionForImageMimeType(dataMimeType),
  };
}
