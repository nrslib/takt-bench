import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PrReviewComment, PrReviewData } from '../../infra/git/index.js';
import {
  downloadGitHubImageAttachment,
  isAllowedGitHubAttachmentUrl,
} from '../../infra/github/attachmentDownload.js';
import type { TaskAttachment } from './attachments.js';

export interface PreparePrReviewImageAttachmentsOptions {
  cwd: string;
}

export interface PreparedPrReviewImageAttachments {
  prReview: PrReviewData;
  attachments: TaskAttachment[];
  cleanupAttachments: () => void;
}

interface ImageReferenceMatch {
  start: number;
  end: number;
  raw: string;
  url: string;
}

interface TempAttachmentWorkspace {
  root: string;
  attachmentsDir: string;
}

class PrImageDownloadError extends Error {
  constructor(url: string, cause: unknown) {
    super(`Failed to download PR image attachment: ${url}`, { cause });
    this.name = 'PrImageDownloadError';
  }
}

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const TEMP_DIRECTORY_PREFIX = 'takt-pr-review-images-';

function findMarkdownImageReferences(text: string): ImageReferenceMatch[] {
  const pattern = /!\[[^\]\r\n]*\]\((https:\/\/[^)\s]+)\)/g;
  return [...text.matchAll(pattern)].map((match) => {
    if (match.index === undefined || match[1] === undefined) {
      throw new Error('Markdown image match is missing required captures.');
    }
    return {
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      url: match[1],
    };
  });
}

function findHtmlImageReferences(text: string): ImageReferenceMatch[] {
  const pattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(https:\/\/.*?)\1[^>]*\/?>/gi;
  return [...text.matchAll(pattern)].map((match) => {
    if (match.index === undefined || match[2] === undefined) {
      throw new Error('HTML image match is missing required captures.');
    }
    return {
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      url: match[2],
    };
  });
}

function findImageReferences(text: string): ImageReferenceMatch[] {
  return [
    ...findMarkdownImageReferences(text),
    ...findHtmlImageReferences(text),
  ].sort((left, right) => left.start - right.start || left.end - right.end);
}

function ensurePrivateDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  fs.chmodSync(directoryPath, PRIVATE_DIRECTORY_MODE);
}

function removeTempAttachmentWorkspace(workspace: TempAttachmentWorkspace | undefined): void {
  if (workspace !== undefined) {
    fs.rmSync(workspace.root, { recursive: true, force: true });
  }
}

function createTempAttachmentWorkspace(): TempAttachmentWorkspace {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_DIRECTORY_PREFIX));
  try {
    fs.chmodSync(tempRoot, PRIVATE_DIRECTORY_MODE);
    const attachmentDir = path.join(tempRoot, 'attachments');
    ensurePrivateDirectory(attachmentDir);
    return { root: tempRoot, attachmentsDir: attachmentDir };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function replaceImageReferences(
  text: string,
  registerAttachment: (url: string) => Promise<string>,
): Promise<string> {
  const matches = findImageReferences(text);
  if (matches.length === 0) {
    return text;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }

    parts.push(text.slice(cursor, match.start));
    if (isAllowedGitHubAttachmentUrl(match.url)) {
      try {
        parts.push(await registerAttachment(match.url));
      } catch (error) {
        if (!(error instanceof PrImageDownloadError)) {
          throw error;
        }
        parts.push(match.raw);
      }
    } else {
      parts.push(match.raw);
    }
    cursor = match.end;
  }
  parts.push(text.slice(cursor));
  return parts.join('');
}

function createCommentWithBody(comment: PrReviewComment, body: string): PrReviewComment {
  return {
    ...comment,
    body,
  };
}

export async function preparePrReviewImageAttachments(
  prReview: PrReviewData,
  options: PreparePrReviewImageAttachmentsOptions,
): Promise<PreparedPrReviewImageAttachments> {
  const placeholderByUrl = new Map<string, string>();
  let attachments: TaskAttachment[] = [];
  let workspace: TempAttachmentWorkspace | undefined;
  let cleaned = false;

  const registerAttachment = async (url: string): Promise<string> => {
    const existing = placeholderByUrl.get(url);
    if (existing !== undefined) {
      return existing;
    }

    let downloaded: Awaited<ReturnType<typeof downloadGitHubImageAttachment>>;
    try {
      downloaded = await downloadGitHubImageAttachment(url, { cwd: options.cwd });
    } catch (error) {
      throw new PrImageDownloadError(url, error);
    }
    if (workspace === undefined) {
      workspace = createTempAttachmentWorkspace();
    }

    const index = attachments.length + 1;
    const fileName = `image-${index}.${downloaded.extension}`;
    const tempPath = path.join(workspace.attachmentsDir, fileName);
    fs.writeFileSync(tempPath, downloaded.data, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
    const attachment: TaskAttachment = {
      placeholder: `[Image #${index}]`,
      tempPath,
      fileName,
    };
    attachments = [...attachments, attachment];
    placeholderByUrl.set(url, attachment.placeholder);
    return attachment.placeholder;
  };

  const cleanupAttachments = (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    removeTempAttachmentWorkspace(workspace);
  };

  try {
    const normalizedBody = await replaceImageReferences(prReview.body, registerAttachment);
    let normalizedComments: PrReviewComment[] = [];
    for (const comment of prReview.comments) {
      const normalizedComment = createCommentWithBody(
        comment,
        await replaceImageReferences(comment.body, registerAttachment),
      );
      normalizedComments = [...normalizedComments, normalizedComment];
    }
    let normalizedReviews: PrReviewComment[] = [];
    for (const review of prReview.reviews) {
      const normalizedReview = createCommentWithBody(
        review,
        await replaceImageReferences(review.body, registerAttachment),
      );
      normalizedReviews = [...normalizedReviews, normalizedReview];
    }

    return {
      prReview: {
        ...prReview,
        body: normalizedBody,
        comments: normalizedComments,
        reviews: normalizedReviews,
      },
      attachments: [...attachments],
      cleanupAttachments,
    };
  } catch (error) {
    cleanupAttachments();
    throw error;
  }
}
