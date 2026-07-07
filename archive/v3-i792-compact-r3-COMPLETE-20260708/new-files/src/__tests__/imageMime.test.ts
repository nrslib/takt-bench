import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_IMAGE_MIME_TYPES,
  extensionForImageMimeType,
  inferImageMimeTypeFromMagicBytes,
} from '../shared/utils/imageMime.js';

describe('image MIME utilities', () => {
  it('should infer supported image MIME types from magic bytes', () => {
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('GIF89a'))).toBe('image/gif');
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('RIFF0000WEBP'))).toBe('image/webp');
  });

  it('should return null for unknown or incomplete image signatures', () => {
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBeNull();
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('GIF8'))).toBeNull();
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('RIFFWEBP'))).toBeNull();
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from('not an image'))).toBeNull();
  });

  it('should map supported MIME types to task attachment file extensions', () => {
    expect(SUPPORTED_IMAGE_MIME_TYPES).toEqual(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
    expect(extensionForImageMimeType('image/png')).toBe('png');
    expect(extensionForImageMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForImageMimeType('image/gif')).toBe('gif');
    expect(extensionForImageMimeType('image/webp')).toBe('webp');
  });

  it('should reject unsupported MIME types instead of assigning a fallback extension', () => {
    expect(() => extensionForImageMimeType('image/svg+xml')).toThrow('Unsupported image MIME type: image/svg+xml');
  });
});
