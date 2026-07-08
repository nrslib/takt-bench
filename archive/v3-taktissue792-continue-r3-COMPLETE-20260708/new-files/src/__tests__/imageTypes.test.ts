import { describe, expect, it } from 'vitest';
import {
  extensionForImageMimeType,
  inferImageMimeTypeFromMagicBytes,
  MAX_IMAGE_ATTACHMENT_BYTES,
} from '../shared/utils/imageTypes.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF_BYTES = Buffer.from('GIF89a');
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

describe('image type utilities', () => {
  it('Given supported image data, When inferring MIME type, Then magic bytes determine the exact supported type', () => {
    expect(inferImageMimeTypeFromMagicBytes(PNG_BYTES)).toBe('image/png');
    expect(inferImageMimeTypeFromMagicBytes(JPEG_BYTES)).toBe('image/jpeg');
    expect(inferImageMimeTypeFromMagicBytes(GIF_BYTES)).toBe('image/gif');
    expect(inferImageMimeTypeFromMagicBytes(WEBP_BYTES)).toBe('image/webp');
  });

  it('Given unsupported image data, When inferring MIME type, Then no fallback type is returned', () => {
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('Given supported image MIME types, When resolving file extensions, Then existing attachment names stay stable', () => {
    expect(extensionForImageMimeType('image/png')).toBe('png');
    expect(extensionForImageMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForImageMimeType('image/gif')).toBe('gif');
    expect(extensionForImageMimeType('image/webp')).toBe('webp');
  });

  it('Given an unsupported MIME type, When resolving a file extension, Then the caller gets a hard failure', () => {
    expect(() => extensionForImageMimeType('image/svg+xml')).toThrow('Unsupported image type: image/svg+xml');
  });

  it('Given image attachments, When enforcing size, Then the shared limit matches the inline image limit', () => {
    expect(MAX_IMAGE_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
