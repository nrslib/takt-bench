import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  validateImageAttachmentData,
} from '../shared/utils/imageAttachmentData.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_BYTES = Buffer.from('GIF89a', 'ascii');
const WEBP_BYTES = Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'binary');

describe('validateImageAttachmentData', () => {
  it.each([
    ['image/png', PNG_BYTES, 'png'],
    ['image/jpeg', JPEG_BYTES, 'jpg'],
    ['image/gif', GIF_BYTES, 'gif'],
    ['image/webp', WEBP_BYTES, 'webp'],
  ])('should accept %s when content type matches magic bytes', (contentType, data, fileExtension) => {
    const result = validateImageAttachmentData({ contentType, data });

    expect(result).toEqual({
      mimeType: contentType,
      fileExtension,
    });
  });

  it('should reject supported content type when magic bytes indicate a different image type', () => {
    expect(() => validateImageAttachmentData({
      contentType: 'image/png',
      data: JPEG_BYTES,
    })).toThrow('Image content type does not match magic bytes.');
  });

  it('should reject PNG data when only the first four signature bytes match', () => {
    const spoofedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);

    expect(() => validateImageAttachmentData({
      contentType: 'image/png',
      data: spoofedPng,
    })).toThrow('Image content type does not match magic bytes.');
  });

  it('should reject unsupported content types before trusting file data', () => {
    expect(() => validateImageAttachmentData({
      contentType: 'image/svg+xml',
      data: Buffer.from('<svg></svg>'),
    })).toThrow('Unsupported image content type: image/svg+xml');
  });

  it('should reject image data over the attachment size limit', () => {
    const oversized = Buffer.concat([
      PNG_BYTES,
      Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES - PNG_BYTES.length + 1),
    ]);

    expect(() => validateImageAttachmentData({
      contentType: 'image/png',
      data: oversized,
    })).toThrow(`Image attachment exceeds ${MAX_IMAGE_ATTACHMENT_BYTES} bytes.`);
  });
});
