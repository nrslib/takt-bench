import type { PrImageReference, PrReviewComment, PrReviewData } from './types.js';

export interface ExtractedPrImageReferences {
  prReview: PrReviewData;
  references: PrImageReference[];
}

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]\r\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;

export type PrImageAttachmentUrlMatcher = (url: string) => boolean;

function resolvePlaceholder(
  url: string,
  references: PrImageReference[],
  placeholderByUrl: Map<string, string>,
  isImageAttachmentUrl: PrImageAttachmentUrlMatcher,
): string | undefined {
  if (!isImageAttachmentUrl(url)) {
    return undefined;
  }

  const existing = placeholderByUrl.get(url);
  if (existing !== undefined) {
    return existing;
  }

  const placeholder = `[Image #${references.length + 1}]`;
  references.push({ url, placeholder });
  placeholderByUrl.set(url, placeholder);
  return placeholder;
}

function replaceImageReferences(
  body: string,
  references: PrImageReference[],
  placeholderByUrl: Map<string, string>,
  isImageAttachmentUrl: PrImageAttachmentUrlMatcher,
): string {
  const markdownReplaced = body.replace(MARKDOWN_IMAGE_PATTERN, (match, url: string) =>
    resolvePlaceholder(url, references, placeholderByUrl, isImageAttachmentUrl) ?? match,
  );
  return markdownReplaced.replace(HTML_IMAGE_PATTERN, (match, doubleQuoted: string | undefined, singleQuoted: string | undefined, unquoted: string | undefined) => {
    const url = doubleQuoted ?? singleQuoted ?? unquoted;
    if (url === undefined) {
      return match;
    }
    return resolvePlaceholder(url, references, placeholderByUrl, isImageAttachmentUrl) ?? match;
  });
}

function replaceReviewCommentImages(
  comment: PrReviewComment,
  references: PrImageReference[],
  placeholderByUrl: Map<string, string>,
  isImageAttachmentUrl: PrImageAttachmentUrlMatcher,
): PrReviewComment {
  return {
    ...comment,
    body: replaceImageReferences(comment.body, references, placeholderByUrl, isImageAttachmentUrl),
  };
}

export function extractPrImageReferences(
  prReview: PrReviewData,
  isImageAttachmentUrl: PrImageAttachmentUrlMatcher,
): ExtractedPrImageReferences {
  const references: PrImageReference[] = [];
  const placeholderByUrl = new Map<string, string>();

  return {
    prReview: {
      ...prReview,
      body: replaceImageReferences(prReview.body, references, placeholderByUrl, isImageAttachmentUrl),
      comments: prReview.comments.map((comment) => replaceReviewCommentImages(comment, references, placeholderByUrl, isImageAttachmentUrl)),
      reviews: prReview.reviews.map((review) => replaceReviewCommentImages(review, references, placeholderByUrl, isImageAttachmentUrl)),
    },
    references,
  };
}

export function hasPrImageReferences(
  prReview: PrReviewData,
  isImageAttachmentUrl: PrImageAttachmentUrlMatcher,
): boolean {
  return extractPrImageReferences(prReview, isImageAttachmentUrl).references.length > 0;
}
