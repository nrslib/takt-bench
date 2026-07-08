import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { GitProvider, PrImageAttachmentDownload, PrReviewComment, PrReviewData } from '../../infra/git/index.js';
import { extensionForImageMimeType } from '../../shared/utils/imageMime.js';
import type { TaskAttachment } from './attachments.js';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export interface DownloadPrReviewImageAttachmentOptions {
  url: string;
}

export type DownloadPrReviewImageAttachment =
  (options: DownloadPrReviewImageAttachmentOptions) => Promise<PrImageAttachmentDownload>;

export interface ResolvePrReviewImageAttachmentsOptions {
  isSupportedImageUrl?: (url: string) => boolean;
  downloadImage?: DownloadPrReviewImageAttachment;
}

export interface ResolvedPrReviewImageAttachments {
  prReview: PrReviewData;
  attachments: TaskAttachment[];
  cleanupAttachments?: () => void;
}

export function createProviderPrReviewImageAttachmentOptions(
  provider: GitProvider,
  cwd: string,
): ResolvePrReviewImageAttachmentsOptions {
  return {
    isSupportedImageUrl: (url: string) => provider.isSupportedPrImageAttachmentUrl(url),
    downloadImage: (options: DownloadPrReviewImageAttachmentOptions) => provider.downloadPrImageAttachment({
      url: options.url,
      cwd,
    }),
  };
}

interface ImageMarkupMatch {
  url: string;
}

function createImageMarkupPattern(): RegExp {
  return /!\[[^\]]*]\((https:\/\/[^\s)]+)\)|<img\b[^>]*\bsrc\s*=\s*(['"])(https:\/\/[^'"]+)\2[^>]*>/gi;
}

function collectImageMarkupMatches(text: string): ImageMarkupMatch[] {
  const pattern = createImageMarkupPattern();
  return [...text.matchAll(pattern)].flatMap((match): ImageMarkupMatch[] => {
    const url = match[1] ?? match[3];
    return url ? [{ url }] : [];
  });
}

function replaceImageMarkup(text: string, attachmentByUrl: ReadonlyMap<string, TaskAttachment>): string {
  return text.replace(createImageMarkupPattern(), (markup: string, markdownUrl: string | undefined, _quote: string | undefined, htmlUrl: string | undefined) => {
    const url = markdownUrl ?? htmlUrl;
    if (url === undefined) {
      return markup;
    }
    const attachment = attachmentByUrl.get(url);
    return attachment ? attachment.placeholder : markup;
  });
}

function collectPrReviewImageUrls(prReview: PrReviewData): string[] {
  const urls: string[] = [];
  const seenUrls = new Set<string>();
  const collect = (text: string) => {
    for (const match of collectImageMarkupMatches(text)) {
      if (!seenUrls.has(match.url)) {
        seenUrls.add(match.url);
        urls.push(match.url);
      }
    }
  };

  collect(prReview.body);
  for (const comment of prReview.comments) {
    collect(comment.body);
  }
  for (const review of prReview.reviews) {
    collect(review.body);
  }
  return urls;
}

function filterSupportedImageUrls(
  urls: string[],
  isSupportedImageUrl: ((url: string) => boolean) | undefined,
): string[] {
  if (isSupportedImageUrl === undefined) {
    return urls;
  }
  return urls.filter((url) => isSupportedImageUrl(url));
}

function replaceCommentImages(
  comment: PrReviewComment,
  attachmentByUrl: ReadonlyMap<string, TaskAttachment>,
): PrReviewComment {
  return {
    ...comment,
    body: replaceImageMarkup(comment.body, attachmentByUrl),
  };
}

function replacePrReviewImages(
  prReview: PrReviewData,
  attachmentByUrl: ReadonlyMap<string, TaskAttachment>,
): PrReviewData {
  return {
    ...prReview,
    body: replaceImageMarkup(prReview.body, attachmentByUrl),
    comments: prReview.comments.map((comment) => replaceCommentImages(comment, attachmentByUrl)),
    reviews: prReview.reviews.map((review) => replaceCommentImages(review, attachmentByUrl)),
  };
}

function createCleanupTempRoot(tempRoot: string): () => void {
  let cleaned = false;
  return () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  };
}

function ensurePrivateDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  fs.chmodSync(directoryPath, PRIVATE_DIRECTORY_MODE);
}

function createTaskAttachment(
  downloaded: PrImageAttachmentDownload,
  tempRoot: string,
  imageNumber: number,
): TaskAttachment {
  const fileName = `image-${imageNumber}.${extensionForImageMimeType(downloaded.contentType)}`;
  const attachmentDir = path.join(tempRoot, 'attachments');
  const tempPath = path.join(attachmentDir, fileName);
  ensurePrivateDirectory(tempRoot);
  ensurePrivateDirectory(attachmentDir);
  fs.writeFileSync(tempPath, downloaded.data, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
  return {
    placeholder: `[Image #${imageNumber}]`,
    tempPath,
    fileName,
  };
}

export async function resolvePrReviewImageAttachments(
  prReview: PrReviewData,
  options: ResolvePrReviewImageAttachmentsOptions,
): Promise<ResolvedPrReviewImageAttachments> {
  const imageUrls = filterSupportedImageUrls(
    collectPrReviewImageUrls(prReview),
    options.isSupportedImageUrl,
  );
  if (imageUrls.length === 0) {
    return {
      prReview,
      attachments: [],
    };
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-images-'));
  const cleanupAttachments = createCleanupTempRoot(tempRoot);
  if (options.downloadImage === undefined) {
    cleanupAttachments();
    throw new Error('downloadImage is required to download PR image attachments.');
  }
  const downloadImage = options.downloadImage;
  const attachmentByUrl = new Map<string, TaskAttachment>();
  const attachments: TaskAttachment[] = [];

  try {
    for (const [index, url] of imageUrls.entries()) {
      const downloaded = await downloadImage({ url });
      const attachment = createTaskAttachment(downloaded, tempRoot, index + 1);
      attachmentByUrl.set(url, attachment);
      attachments.push(attachment);
    }

    return {
      prReview: replacePrReviewImages(prReview, attachmentByUrl),
      attachments,
      cleanupAttachments,
    };
  } catch (error) {
    cleanupAttachments();
    throw error;
  }
}
