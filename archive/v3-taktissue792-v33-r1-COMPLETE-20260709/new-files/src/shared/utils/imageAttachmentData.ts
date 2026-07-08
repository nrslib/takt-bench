export const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type SupportedImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export interface ValidatedImageAttachmentData {
  mimeType: SupportedImageMimeType;
  fileExtension: string;
}

interface ImageTypeSpec {
  mimeType: SupportedImageMimeType;
  fileExtension: string;
  matches: (data: Buffer) => boolean;
}

const GIF87A_BYTES = Buffer.from('GIF87a');
const GIF89A_BYTES = Buffer.from('GIF89a');
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RIFF_BYTES = Buffer.from('RIFF');
const WEBP_BYTES = Buffer.from('WEBP');

const IMAGE_TYPE_SPECS: readonly ImageTypeSpec[] = [
  {
    mimeType: 'image/png',
    fileExtension: 'png',
    matches: (data) => data.subarray(0, 8).equals(PNG_BYTES),
  },
  {
    mimeType: 'image/jpeg',
    fileExtension: 'jpg',
    matches: (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  },
  {
    mimeType: 'image/gif',
    fileExtension: 'gif',
    matches: (data) => data.subarray(0, 6).equals(GIF87A_BYTES) || data.subarray(0, 6).equals(GIF89A_BYTES),
  },
  {
    mimeType: 'image/webp',
    fileExtension: 'webp',
    matches: (data) =>
      data.length >= 12
      && data.subarray(0, 4).equals(RIFF_BYTES)
      && data.subarray(8, 12).equals(WEBP_BYTES),
  },
];

function normalizeContentType(contentType: string): string {
  return contentType.split(';', 1)[0]!.trim().toLowerCase();
}

function getSpecForContentType(contentType: string): ImageTypeSpec {
  const normalized = normalizeContentType(contentType);
  const spec = IMAGE_TYPE_SPECS.find((candidate) => candidate.mimeType === normalized);
  if (!spec) {
    throw new Error(`Unsupported image content type: ${normalized}`);
  }
  return spec;
}

export function inferImageMimeTypeFromMagicBytes(data: Buffer): SupportedImageMimeType | null {
  return IMAGE_TYPE_SPECS.find((spec) => spec.matches(data))?.mimeType ?? null;
}

export function fileExtensionForImageMimeType(mimeType: string): string {
  return getSpecForContentType(mimeType).fileExtension;
}

export function validateSupportedImageContentType(contentType: string): SupportedImageMimeType {
  return getSpecForContentType(contentType).mimeType;
}

export function validateImageAttachmentData(params: {
  contentType: string;
  data: Buffer;
}): ValidatedImageAttachmentData {
  if (params.data.length > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`Image attachment exceeds ${MAX_IMAGE_ATTACHMENT_BYTES} bytes.`);
  }

  const contentTypeSpec = getSpecForContentType(params.contentType);
  const magicMimeType = inferImageMimeTypeFromMagicBytes(params.data);
  if (magicMimeType !== contentTypeSpec.mimeType) {
    throw new Error('Image content type does not match magic bytes.');
  }

  return {
    mimeType: contentTypeSpec.mimeType,
    fileExtension: contentTypeSpec.fileExtension,
  };
}
