import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrReviewData } from '../infra/git/index.js';
import {
  MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES,
  extractPrReviewImageReferences,
  isAllowedGitHubAttachmentUrl,
  resolvePrReviewImageAttachments,
} from '../infra/github/prReviewImageAttachments.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
const GIF_BYTES = Buffer.from('GIF89a');
const WEBP_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46,
  0x04, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);

const tempRoots = new Set<string>();

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-image-attachments-test-'));
  tempRoots.add(root);
  return root;
}

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 42,
    title: 'Review screenshots',
    body: '',
    url: 'https://github.com/org/repo/pull/42',
    headRefName: 'feature/screenshots',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: ['src/app.ts'],
    ...overrides,
  };
}

function imageResponse(data: Buffer, contentType: string, contentLength?: number): Response {
  return new Response(data, {
    status: 200,
    headers: {
      'content-type': contentType,
      ...(contentLength !== undefined ? { 'content-length': String(contentLength) } : {}),
    },
  });
}

describe('GitHub PR review image reference extraction', () => {
  it('should extract Markdown and HTML image URLs in source order', () => {
    const markdownUrl = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111';
    const htmlUrl = 'https://github.com/org/repo/assets/22222222';

    const references = extractPrReviewImageReferences([
      `Before ![screenshot](${markdownUrl})`,
      `<img alt="diagram" src='${htmlUrl}' width="320" />`,
    ].join('\n'));

    expect(references).toEqual([
      expect.objectContaining({
        url: markdownUrl,
        originalText: `![screenshot](${markdownUrl})`,
      }),
      expect.objectContaining({
        url: htmlUrl,
        originalText: `<img alt="diagram" src='${htmlUrl}' width="320" />`,
      }),
    ]);
  });

  it('should keep source order when HTML appears before Markdown', () => {
    const htmlUrl = 'https://github.com/org/repo/assets/11111111';
    const markdownUrl = 'https://github.com/user-attachments/assets/22222222';

    const references = extractPrReviewImageReferences([
      `<img src="${htmlUrl}" />`,
      `After ![screenshot](${markdownUrl})`,
    ].join('\n'));

    expect(references.map((reference) => reference.url)).toEqual([htmlUrl, markdownUrl]);
  });

  it('should allow only GitHub attachment URL shapes from PR text', () => {
    expect(isAllowedGitHubAttachmentUrl('https://github.com/user-attachments/assets/abc')).toBe(true);
    expect(isAllowedGitHubAttachmentUrl('https://github.com/org/repo/assets/123456')).toBe(true);
    expect(isAllowedGitHubAttachmentUrl('http://github.com/user-attachments/assets/abc')).toBe(false);
    expect(isAllowedGitHubAttachmentUrl('https://example.com/image.png')).toBe(false);
    expect(isAllowedGitHubAttachmentUrl('https://private-user-images.githubusercontent.com/abc')).toBe(false);
    expect(isAllowedGitHubAttachmentUrl('https://github.com/org/repo/issues/1')).toBe(false);
  });
});

describe('resolvePrReviewImageAttachments', () => {
  it('should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs', async () => {
    const pngUrl = 'https://github.com/user-attachments/assets/png-image';
    const jpegUrl = 'https://github.com/org/repo/assets/jpeg-image';
    const tmpRoot = createTempRoot();
    const fetchImage = vi.fn(async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer ghp_test_token');
      expect(headers.get('accept')).toContain('image/');
      if (String(url) === pngUrl) return imageResponse(PNG_BYTES, 'image/png', PNG_BYTES.length);
      if (String(url) === jpegUrl) return imageResponse(JPEG_BYTES, 'image/jpeg', JPEG_BYTES.length);
      throw new Error(`Unexpected fetch URL: ${String(url)}`);
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Body screenshot ![screen](${pngUrl})`,
      comments: [{ author: 'alice', body: `<img src="${pngUrl}" /> and ![detail](${jpegUrl})` }],
      reviews: [{ author: 'bob', body: `External image stays: ![x](https://example.com/image.png)` }],
    }), {
      cwd: '/repo',
      tmpRoot,
      fetch: fetchImage,
      getAuthToken: () => 'ghp_test_token',
    });

    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(result.attachments).toEqual([
      expect.objectContaining({ placeholder: '[Image #1]', fileName: 'image-1.png' }),
      expect.objectContaining({ placeholder: '[Image #2]', fileName: 'image-2.jpg' }),
    ]);
    expect(result.prReview.body).toBe('Body screenshot [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('[Image #1] and [Image #2]');
    expect(result.prReview.reviews[0]?.body).toContain('![x](https://example.com/image.png)');
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(PNG_BYTES);
    expect(fs.readFileSync(result.attachments[1]!.tempPath)).toEqual(JPEG_BYTES);

    result.cleanup();

    expect(fs.existsSync(result.attachments[0]!.tempPath)).toBe(false);
    expect(fs.existsSync(result.attachments[1]!.tempPath)).toBe(false);
  });

  it.each([
    ['image/gif', GIF_BYTES, 'image-1.gif'],
    ['image/webp', WEBP_BYTES, 'image-1.webp'],
  ])('should preserve supported %s attachments with matching file extensions', async (contentType, bytes, fileName) => {
    const imageUrl = `https://github.com/user-attachments/assets/${fileName}`;
    const tmpRoot = createTempRoot();

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `![image](${imageUrl})`,
    }), {
      cwd: '/repo',
      tmpRoot,
      fetch: vi.fn(async () => imageResponse(bytes, contentType, bytes.length)),
      getAuthToken: () => 'ghp_test_token',
    });

    expect(result.attachments).toEqual([
      expect.objectContaining({ placeholder: '[Image #1]', fileName }),
    ]);
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(bytes);

    result.cleanup();
  });

  it('should reject unsupported Content-Type before saving an attachment', async () => {
    const tmpRoot = createTempRoot();

    await expect(resolvePrReviewImageAttachments(createPrReview({
      body: '![text](https://github.com/user-attachments/assets/text-file)',
    }), {
      cwd: '/repo',
      tmpRoot,
      fetch: vi.fn(async () => imageResponse(PNG_BYTES, 'text/plain', PNG_BYTES.length)),
      getAuthToken: () => 'ghp_test_token',
    })).rejects.toThrow('Unsupported PR image Content-Type');
  });

  it('should reject Content-Type and magic byte mismatches', async () => {
    const tmpRoot = createTempRoot();

    await expect(resolvePrReviewImageAttachments(createPrReview({
      body: '![mismatch](https://github.com/user-attachments/assets/mismatch)',
    }), {
      cwd: '/repo',
      tmpRoot,
      fetch: vi.fn(async () => imageResponse(JPEG_BYTES, 'image/png', JPEG_BYTES.length)),
      getAuthToken: () => 'ghp_test_token',
    })).rejects.toThrow('PR image Content-Type does not match image data');
  });

  it('should reject images above the configured byte limit from Content-Length', async () => {
    const tmpRoot = createTempRoot();

    await expect(resolvePrReviewImageAttachments(createPrReview({
      body: '![large](https://github.com/user-attachments/assets/large)',
    }), {
      cwd: '/repo',
      tmpRoot,
      fetch: vi.fn(async () => imageResponse(PNG_BYTES, 'image/png', MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES + 1)),
      getAuthToken: () => 'ghp_test_token',
    })).rejects.toThrow(`PR image exceeds the ${MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES} byte limit`);
  });

  it('should fail fast when GitHub authentication token cannot be resolved', async () => {
    const tmpRoot = createTempRoot();
    const fetchImage = vi.fn();

    await expect(resolvePrReviewImageAttachments(createPrReview({
      body: '![private](https://github.com/user-attachments/assets/private)',
    }), {
      cwd: '/repo',
      tmpRoot,
      fetch: fetchImage,
      getAuthToken: () => {
        throw new Error('gh auth token failed');
      },
    })).rejects.toThrow('gh auth token failed');
    expect(fetchImage).not.toHaveBeenCalled();
  });
});
