import { describe, expect, it } from 'vitest';
import {
  getImageExtensionForMimeType,
  inferImageMimeTypeFromMagicBytes,
} from '../shared/utils/imageMime.js';

describe('image MIME helpers', () => {
  it.each([
    ['PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]), 'image/png'],
    ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    ['GIF87a', Buffer.from('GIF87a'), 'image/gif'],
    ['GIF89a', Buffer.from('GIF89a'), 'image/gif'],
    ['WebP', Buffer.from([...Buffer.from('RIFF'), 0x00, 0x00, 0x00, 0x00, ...Buffer.from('WEBP')]), 'image/webp'],
  ])('detects %s from magic bytes', (_name, bytes, expectedMimeType) => {
    expect(inferImageMimeTypeFromMagicBytes(bytes)).toBe(expectedMimeType);
  });

  it('returns null for unsupported magic bytes', () => {
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
  ])('maps supported MIME type %s to its task attachment extension', (mimeType, expectedExtension) => {
    expect(getImageExtensionForMimeType(mimeType)).toBe(expectedExtension);
  });

  it('rejects unsupported MIME types instead of guessing an extension', () => {
    expect(() => getImageExtensionForMimeType('image/svg+xml')).toThrow(
      'Unsupported image MIME type: image/svg+xml',
    );
  });
});
