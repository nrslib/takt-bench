import { describe, expect, it } from 'vitest';
import {
  assertSupportedImageContentType,
  extensionForImageMimeType,
  inferImageMimeTypeFromMagicBytes,
  MAX_IMAGE_ATTACHMENT_BYTES,
} from '../shared/utils/imageMime.js';

describe('image MIME validation', () => {
  it('should infer supported image MIME types from magic bytes', () => {
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('GIF89a'))).toBe('image/gif');
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('RIFFxxxxWEBP'))).toBe('image/webp');
  });

  it('should resolve attachment file extensions from verified MIME types', () => {
    expect(extensionForImageMimeType('image/png')).toBe('png');
    expect(extensionForImageMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForImageMimeType('image/gif')).toBe('gif');
    expect(extensionForImageMimeType('image/webp')).toBe('webp');
  });

  it('should accept supported Content-Type headers when magic bytes match', () => {
    const mimeType = assertSupportedImageContentType(
      'image/png; charset=binary',
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );

    expect(mimeType).toBe('image/png');
  });

  it('should reject a supported Content-Type when magic bytes disagree', () => {
    expect(() =>
      assertSupportedImageContentType('image/png', Buffer.from([0xff, 0xd8, 0xff])),
    ).toThrow('Image Content-Type does not match image data: image/png !== image/jpeg');
  });

  it('should reject unsupported Content-Type headers before accepting image data', () => {
    expect(() =>
      assertSupportedImageContentType('image/svg+xml', Buffer.from('<svg></svg>')),
    ).toThrow('Unsupported image Content-Type: image/svg+xml');
  });

  it('should expose the shared PR image attachment size limit', () => {
    expect(MAX_IMAGE_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
