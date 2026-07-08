import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  validateImageAttachmentData,
} from '../shared/utils/imageAttachmentData.js';

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const gifBytes = Buffer.from('GIF89a', 'ascii');
const webpBytes = Buffer.from('RIFF\x08\x00\x00\x00WEBPVP8 ', 'binary');

describe('validateImageAttachmentData', () => {
  it('Given supported image bytes and matching Content-Type, When validated, Then returns the attachment MIME and extension', () => {
    expect(validateImageAttachmentData({
      data: pngBytes,
      contentType: 'image/png; charset=binary',
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    })).toEqual({ mimeType: 'image/png', extension: '.png' });

    expect(validateImageAttachmentData({
      data: jpegBytes,
      contentType: 'image/jpeg',
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    })).toEqual({ mimeType: 'image/jpeg', extension: '.jpg' });

    expect(validateImageAttachmentData({
      data: gifBytes,
      contentType: 'image/gif',
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    })).toEqual({ mimeType: 'image/gif', extension: '.gif' });

    expect(validateImageAttachmentData({
      data: webpBytes,
      contentType: 'image/webp',
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    })).toEqual({ mimeType: 'image/webp', extension: '.webp' });
  });

  it('Given Content-Type and magic bytes disagree, When validated, Then rejects the image', () => {
    expect(() => validateImageAttachmentData({
      data: pngBytes,
      contentType: 'image/jpeg',
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    })).toThrow(/Content-Type.*magic bytes/i);
  });

  it('Given unsupported image bytes, When validated, Then rejects the image even if Content-Type is allowed', () => {
    expect(() => validateImageAttachmentData({
      data: Buffer.from('<svg></svg>'),
      contentType: 'image/png',
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    })).toThrow(/Unsupported image attachment/i);
  });

  it('Given only a four-byte PNG prefix, When validated, Then rejects the incomplete PNG signature', () => {
    expect(() => validateImageAttachmentData({
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]),
      contentType: 'image/png',
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    })).toThrow(/Unsupported image attachment/i);
  });

  it('Given data larger than the configured limit, When validated, Then rejects before attachment creation', () => {
    expect(() => validateImageAttachmentData({
      data: Buffer.alloc(4),
      contentType: 'image/png',
      maxBytes: 3,
    })).toThrow(/exceeds.*limit/i);
  });
});
