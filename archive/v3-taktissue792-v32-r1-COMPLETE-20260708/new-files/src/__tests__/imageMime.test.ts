import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  validateImageDataMime,
} from '../shared/utils/imageMime.js';

const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegData = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
const gif87aData = Buffer.concat([Buffer.from('GIF87a'), Buffer.alloc(7, 0)]);
const gif89aData = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(7, 0)]);
const webpData = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x04, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

describe('validateImageDataMime', () => {
  it.each([
    ['PNG', pngData, 'image/png', { mimeType: 'image/png', extension: 'png' }],
    ['JPEG', jpegData, 'image/jpeg', { mimeType: 'image/jpeg', extension: 'jpg' }],
    ['GIF87a', gif87aData, 'image/gif', { mimeType: 'image/gif', extension: 'gif' }],
    ['GIF89a', gif89aData, 'image/gif', { mimeType: 'image/gif', extension: 'gif' }],
    ['WebP', webpData, 'image/webp', { mimeType: 'image/webp', extension: 'webp' }],
  ])('should accept %s only when Content-Type and magic bytes agree', (_label, data, contentType, expected) => {
    expect(validateImageDataMime(data, contentType)).toEqual(expected);
  });

  it('should normalize supported Content-Type values with parameters', () => {
    const result = validateImageDataMime(pngData, 'image/png; charset=binary');

    expect(result).toEqual({ mimeType: 'image/png', extension: 'png' });
  });

  it('should reject supported Content-Type when magic bytes indicate another image type', () => {
    expect(() => validateImageDataMime(pngData, 'image/jpeg')).toThrow(
      'Image Content-Type does not match image data: image/jpeg !== image/png',
    );
  });

  it('should reject supported Content-Type when magic bytes are not a supported image', () => {
    expect(() => validateImageDataMime(Buffer.from('not-image'), 'image/png')).toThrow(
      'Unsupported image data. Expected PNG, JPEG, GIF, or WebP magic bytes.',
    );
  });

  it('should reject incomplete PNG signatures even when the first four bytes match', () => {
    const incompletePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);

    expect(() => validateImageDataMime(incompletePng, 'image/png')).toThrow(
      'Unsupported image data. Expected PNG, JPEG, GIF, or WebP magic bytes.',
    );
  });

  it('should reject JPEG data without a segment marker after SOI', () => {
    const incompleteJpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

    expect(() => validateImageDataMime(incompleteJpeg, 'image/jpeg')).toThrow(
      'Unsupported image data. Expected PNG, JPEG, GIF, or WebP magic bytes.',
    );
  });

  it('should reject unsupported Content-Type even when magic bytes look like an image', () => {
    expect(() => validateImageDataMime(pngData, 'image/svg+xml')).toThrow(
      'Unsupported image Content-Type: image/svg+xml',
    );
  });
});

describe('MAX_IMAGE_ATTACHMENT_BYTES', () => {
  it('should match the existing 10 MiB inline image limit', () => {
    expect(MAX_IMAGE_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
