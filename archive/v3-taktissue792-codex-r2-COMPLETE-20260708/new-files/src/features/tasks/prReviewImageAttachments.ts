import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PrReviewData } from '../../infra/git/index.js';
import {
  downloadGithubAttachmentImage,
  type DownloadedGithubAttachmentImage,
  type GithubAttachmentImageDownloadOptions,
} from '../../infra/github/attachmentImageDownloader.js';
import type { TaskAttachment } from './attachments.js';
import {
  collectAllowedPrReviewImageUrls,
  copyPrReviewWithReplacedImageReferences,
} from './prReviewImageReferences.js';
import { validatePrReviewImageDownload } from './prReviewImageValidation.js';

export const MAX_PR_REVIEW_IMAGE_BYTES = 10 * 1024 * 1024;

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export type PrReviewImageDownloader = (
  url: string,
  options: GithubAttachmentImageDownloadOptions,
) => Promise<DownloadedGithubAttachmentImage>;

export interface PreparePrReviewImageAttachmentsOptions {
  cwd?: string;
  downloadImage?: PrReviewImageDownloader;
  maxBytes?: number;
}

export interface PreparedPrReviewImageAttachments {
  prReview: PrReviewData;
  attachments: TaskAttachment[];
  cleanup: () => void;
}

function ensurePrivateDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  fs.chmodSync(directoryPath, PRIVATE_DIRECTORY_MODE);
}

function createNoopPreparedPrReviewImageAttachments(prReview: PrReviewData): PreparedPrReviewImageAttachments {
  return {
    prReview,
    attachments: [],
    cleanup: () => undefined,
  };
}

export async function preparePrReviewImageAttachments(
  prReview: PrReviewData,
  options: PreparePrReviewImageAttachmentsOptions,
): Promise<PreparedPrReviewImageAttachments> {
  const urls = collectAllowedPrReviewImageUrls(prReview);
  if (urls.length === 0) {
    return createNoopPreparedPrReviewImageAttachments(prReview);
  }

  const maxBytes = options.maxBytes ?? MAX_PR_REVIEW_IMAGE_BYTES;
  const downloadImage = options.downloadImage ?? downloadGithubAttachmentImage;
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-images-'));
  const attachmentDir = path.join(sessionDir, 'attachments');
  const cleanup = (): void => {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  };

  const attachments: TaskAttachment[] = [];
  const placeholderByUrl = new Map<string, string>();
  try {
    ensurePrivateDirectory(sessionDir);
    ensurePrivateDirectory(attachmentDir);

    for (const url of urls) {
      const downloaded = await downloadImage(url, { cwd: options.cwd, maxBytes });
      const { extension } = validatePrReviewImageDownload(downloaded, url, maxBytes);
      const index = attachments.length + 1;
      const placeholder = `[Image #${index}]`;
      const fileName = `image-${index}.${extension}`;
      const tempPath = path.join(attachmentDir, fileName);
      fs.writeFileSync(tempPath, downloaded.body, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
      const attachment = { placeholder, tempPath, fileName };
      attachments.push(attachment);
      placeholderByUrl.set(url, placeholder);
    }

    return {
      prReview: copyPrReviewWithReplacedImageReferences(prReview, placeholderByUrl),
      attachments,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
