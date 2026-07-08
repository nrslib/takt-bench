export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type SupportedImageAttachmentMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp';

export interface ImageAttachmentDataValidationInput {
  data: Buffer;
  contentType: string;
  maxBytes: number;
}

export interface ImageAttachmentDataInfo {
  mimeType: SupportedImageAttachmentMimeType;
  extension: string;
}

const MIME_TYPE_TO_EXTENSION: Record<SupportedImageAttachmentMimeType, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const SUPPORTED_IMAGE_MIME_TYPES = new Set<SupportedImageAttachmentMimeType>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function normalizeImageContentType(contentType: string): string {
  const mediaType = contentType.split(';', 1)[0];
  if (mediaType === undefined) {
    throw new Error('Image attachment Content-Type is required.');
  }
  return mediaType.trim().toLowerCase();
}

export function isSupportedImageAttachmentMimeType(value: string): value is SupportedImageAttachmentMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.has(value as SupportedImageAttachmentMimeType);
}

export function inferImageMimeTypeFromMagicBytes(data: Buffer): SupportedImageAttachmentMimeType | undefined {
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
  return undefined;
}

export function inferImageMimeTypeFromFileName(fileName: string): SupportedImageAttachmentMimeType | undefined {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return undefined;
}

export function getImageAttachmentFileExtension(mimeType: SupportedImageAttachmentMimeType): string {
  return MIME_TYPE_TO_EXTENSION[mimeType];
}

export function validateImageAttachmentData(input: ImageAttachmentDataValidationInput): ImageAttachmentDataInfo {
  if (input.data.length > input.maxBytes) {
    throw new Error(`Image attachment exceeds the ${input.maxBytes} byte limit.`);
  }

  const normalizedContentType = normalizeImageContentType(input.contentType);
  if (!isSupportedImageAttachmentMimeType(normalizedContentType)) {
    throw new Error(`Unsupported image attachment Content-Type: ${input.contentType}`);
  }

  const magicMimeType = inferImageMimeTypeFromMagicBytes(input.data);
  if (magicMimeType === undefined) {
    throw new Error('Unsupported image attachment data. Expected PNG, JPEG, GIF, or WebP data.');
  }
  if (magicMimeType !== normalizedContentType) {
    throw new Error(`Image attachment Content-Type does not match magic bytes: ${normalizedContentType} !== ${magicMimeType}`);
  }

  return {
    mimeType: magicMimeType,
    extension: getImageAttachmentFileExtension(magicMimeType),
  };
}
