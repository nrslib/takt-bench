import { describe, expect, it } from 'vitest';
import {
  extensionForSupportedImageMimeType,
  inferSupportedImageMimeTypeFromMagicBytes,
  normalizeImageContentType,
} from '../shared/utils/imageMime.js';

describe('imageMime utilities', () => {
  it.each([
    ['PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png'],
    ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    ['GIF87a', Buffer.from('GIF87a'), 'image/gif'],
    ['GIF89a', Buffer.from('GIF89a'), 'image/gif'],
    ['WebP', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]), 'image/webp'],
  ])('should infer %s from magic bytes', (_label, data, expectedMimeType) => {
    expect(inferSupportedImageMimeTypeFromMagicBytes(data)).toBe(expectedMimeType);
  });

  it('should reject unsupported image magic bytes', () => {
    expect(inferSupportedImageMimeTypeFromMagicBytes(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('should normalize supported content-types with parameters', () => {
    expect(normalizeImageContentType('image/png; charset=binary')).toBe('image/png');
    expect(normalizeImageContentType(' IMAGE/JPEG ')).toBe('image/jpeg');
  });

  it('should reject unsupported content-types', () => {
    expect(normalizeImageContentType('image/svg+xml')).toBeNull();
    expect(normalizeImageContentType('application/octet-stream')).toBeNull();
  });

  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
  ])('should map %s to an attachment extension', (mimeType, expectedExtension) => {
    expect(extensionForSupportedImageMimeType(mimeType)).toBe(expectedExtension);
  });
});
