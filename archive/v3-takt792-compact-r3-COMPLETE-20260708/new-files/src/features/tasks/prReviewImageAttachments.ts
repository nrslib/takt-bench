import type { GitProvider, PrReviewComment, PrReviewData } from '../../infra/git/types.js';
import {
  cleanupImageAttachmentStore,
  createSessionImageAttachmentStore,
  type ImageAttachmentStore,
} from '../../shared/utils/imageAttachmentStore.js';
import type { TaskAttachment } from './attachments.js';

interface PrReviewImageAttachmentResult {
  prReview: PrReviewData;
  attachments: TaskAttachment[];
  cleanup: () => void;
}

interface ImageReferenceMatch {
  start: number;
  end: number;
  url: string;
}

interface ImageResolutionContext {
  cwd: string;
  provider: GitProvider;
  store: ImageAttachmentStore;
  attachmentByUrl: Map<string, TaskAttachment>;
}

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]\r\n]*\]\((https?:\/\/[^)\s]+)\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'<>]+))[^>]*>/gi;

function requireMatchIndex(match: RegExpMatchArray): number {
  if (match.index === undefined) {
    throw new Error('Image reference match index is missing.');
  }
  return match.index;
}

function createIdempotentCleanup(store: ImageAttachmentStore): () => void {
  let cleaned = false;
  return () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    cleanupImageAttachmentStore(store);
  };
}

function findMarkdownImageReferences(text: string): ImageReferenceMatch[] {
  return [...text.matchAll(MARKDOWN_IMAGE_PATTERN)].map((match) => ({
    start: requireMatchIndex(match),
    end: requireMatchIndex(match) + match[0].length,
    url: match[1]!,
  }));
}

function findHtmlImageReferences(text: string): ImageReferenceMatch[] {
  return [...text.matchAll(HTML_IMAGE_PATTERN)].map((match) => ({
    start: requireMatchIndex(match),
    end: requireMatchIndex(match) + match[0].length,
    url: (match[1] ?? match[2] ?? match[3])!,
  }));
}

function findImageReferences(text: string): ImageReferenceMatch[] {
  return [
    ...findMarkdownImageReferences(text),
    ...findHtmlImageReferences(text),
  ].sort((left, right) => left.start - right.start);
}

async function resolveImagePlaceholder(url: string, context: ImageResolutionContext): Promise<string | undefined> {
  if (!context.provider.isPrReviewImageAttachmentUrl(url)) {
    return undefined;
  }

  const existing = context.attachmentByUrl.get(url);
  if (existing) {
    return existing.placeholder;
  }

  const downloaded = await context.provider.downloadPrReviewImageAttachment(url, context.cwd);
  const attachment = await context.store.saveImage(downloaded.data, downloaded.mimeType);
  context.attachmentByUrl.set(url, attachment);
  return attachment.placeholder;
}

async function replaceImageReferences(text: string, context: ImageResolutionContext): Promise<string> {
  const matches = findImageReferences(text);
  if (matches.length === 0) {
    return text;
  }

  let cursor = 0;
  const parts: string[] = [];
  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    parts.push(text.slice(cursor, match.start));
    const placeholder = await resolveImagePlaceholder(match.url, context);
    parts.push(placeholder ?? text.slice(match.start, match.end));
    cursor = match.end;
  }
  parts.push(text.slice(cursor));
  return parts.join('');
}

async function replaceCommentBody(
  comment: PrReviewComment,
  context: ImageResolutionContext,
): Promise<PrReviewComment> {
  return {
    ...comment,
    body: await replaceImageReferences(comment.body, context),
  };
}

async function replaceCommentBodies(
  comments: readonly PrReviewComment[],
  context: ImageResolutionContext,
): Promise<PrReviewComment[]> {
  let replacedComments: PrReviewComment[] = [];
  for (const comment of comments) {
    replacedComments = [...replacedComments, await replaceCommentBody(comment, context)];
  }
  return replacedComments;
}

export async function resolvePrReviewImageAttachments(
  prReview: PrReviewData,
  cwd: string,
  provider: GitProvider,
): Promise<PrReviewImageAttachmentResult> {
  const store = createSessionImageAttachmentStore();
  const cleanup = createIdempotentCleanup(store);
  const context: ImageResolutionContext = {
    cwd,
    provider,
    store,
    attachmentByUrl: new Map(),
  };

  try {
    const body = await replaceImageReferences(prReview.body, context);
    const comments = await replaceCommentBodies(prReview.comments, context);
    const reviews = await replaceCommentBodies(prReview.reviews, context);

    return {
      prReview: {
        ...prReview,
        body,
        comments,
        reviews,
      },
      attachments: store.listAttachments(),
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
