import { describe, expect, it } from 'vitest';
import {
  assertImageMimeMatchesBytes,
  extensionForImageMimeType,
  inferImageMimeTypeFromMagicBytes,
  parseImageContentType,
} from '../shared/utils/imageMime.js';

const PNG_DATA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_DATA = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_DATA = Buffer.from('GIF89a');
const WEBP_DATA = Buffer.from([
  0x52, 0x49, 0x46, 0x46,
  0x18, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);

describe('image MIME utilities', () => {
  it('Given supported image magic bytes, When inferring MIME type, Then PNG JPEG GIF and WebP are recognized', () => {
    expect(inferImageMimeTypeFromMagicBytes(PNG_DATA)).toBe('image/png');
    expect(inferImageMimeTypeFromMagicBytes(JPEG_DATA)).toBe('image/jpeg');
    expect(inferImageMimeTypeFromMagicBytes(GIF_DATA)).toBe('image/gif');
    expect(inferImageMimeTypeFromMagicBytes(WEBP_DATA)).toBe('image/webp');
  });

  it('Given only the first four PNG signature bytes, When inferring MIME type, Then it rejects the incomplete signature', () => {
    expect(inferImageMimeTypeFromMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(() => assertImageMimeMatchesBytes('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toThrow(
      'Unsupported image data. Expected PNG, JPEG, GIF, or WebP.',
    );
  });

  it('Given a Content-Type with parameters, When parsing image content type, Then the normalized MIME type is returned', () => {
    expect(parseImageContentType('image/png; charset=binary')).toBe('image/png');
    expect(parseImageContentType(' IMAGE/JPEG ')).toBe('image/jpeg');
  });

  it('Given supported MIME types, When resolving file extensions, Then task attachment file names can use stable extensions', () => {
    expect(extensionForImageMimeType('image/png')).toBe('png');
    expect(extensionForImageMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForImageMimeType('image/gif')).toBe('gif');
    expect(extensionForImageMimeType('image/webp')).toBe('webp');
  });

  it('Given unsupported or missing Content-Type, When parsing image content type, Then it fails before image persistence', () => {
    expect(() => parseImageContentType(undefined)).toThrow('Image Content-Type is required.');
    expect(() => parseImageContentType('image/svg+xml')).toThrow('Unsupported image Content-Type: image/svg+xml');
  });

  it('Given a declared MIME type that does not match magic bytes, When validating the image, Then it rejects the data', () => {
    expect(() => assertImageMimeMatchesBytes('image/png', JPEG_DATA)).toThrow(
      'Image Content-Type does not match image data: image/png !== image/jpeg',
    );
  });

  it('Given unknown image bytes, When validating the image, Then it rejects unsupported data even with an allowed Content-Type', () => {
    expect(() => assertImageMimeMatchesBytes('image/png', Buffer.from('not an image'))).toThrow(
      'Unsupported image data. Expected PNG, JPEG, GIF, or WebP.',
    );
  });
});
