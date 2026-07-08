import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  getImageFileExtension,
  inferImageMimeTypeFromMagicBytes,
} from '../shared/utils/imageData.js';

describe('imageData utilities', () => {
  it.each([
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['image/gif', Buffer.from('GIF89a')],
    ['image/webp', Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])],
  ])('should infer %s from magic bytes', (mimeType, bytes) => {
    expect(inferImageMimeTypeFromMagicBytes(bytes)).toBe(mimeType);
  });

  it('should return null for unsupported image data', () => {
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('not an image'))).toBeNull();
  });

  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
  ])('should map %s to a task attachment extension', (mimeType, extension) => {
    expect(getImageFileExtension(mimeType)).toBe(extension);
  });

  it('should share the same 10 MiB image size limit across attachment sources', () => {
    expect(MAX_IMAGE_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
