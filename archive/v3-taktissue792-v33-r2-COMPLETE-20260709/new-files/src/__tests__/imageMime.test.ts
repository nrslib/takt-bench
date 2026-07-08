import { describe, expect, it } from 'vitest';
import {
  assertImageMagicBytesMatch,
  inferMimeTypeFromMagicBytes,
} from '../shared/utils/imageMime.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('imageMime', () => {
  it('should detect PNG only when the full 8-byte signature matches', () => {
    const truncatedSignatureMatch = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);

    expect(inferMimeTypeFromMagicBytes(Buffer.concat([PNG_SIGNATURE, Buffer.from('payload')]))).toBe('image/png');
    expect(inferMimeTypeFromMagicBytes(truncatedSignatureMatch)).toBeNull();
    expect(() => assertImageMagicBytesMatch(truncatedSignatureMatch, 'image/png', 'PR image attachment'))
      .toThrow('Unsupported PR image attachment magic bytes');
  });
});
