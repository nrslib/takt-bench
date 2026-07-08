import type { PrReviewComment, PrReviewData } from '../git/types.js';
import {
  createPrReviewImageReferenceLimitMessage,
  MAX_PR_REVIEW_IMAGE_REFERENCES,
} from './prReviewAttachmentLimits.js';

export interface PrReviewImageReference {
  placeholder: string;
  url: string;
}

export interface ExtractedPrReviewImageReferences {
  prReview: PrReviewData;
  references: PrReviewImageReference[];
}

export interface PrReviewImageDownloadFailure {
  placeholder: string;
  reason: string;
}

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]\r\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*>/gi;
const HTML_IMAGE_SRC_PATTERN = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i;
const USER_ATTACHMENT_PATH_PREFIX = '/user-attachments/assets/';

function isGitHubHost(hostname: string): boolean {
  return hostname === 'github.com';
}

function isPrivateGitHubImageHost(hostname: string): boolean {
  return hostname === 'private-user-images.githubusercontent.com' || hostname === 'user-images.githubusercontent.com';
}

export function isGitHubPrImageAttachmentUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') {
    return false;
  }
  if (isPrivateGitHubImageHost(url.hostname)) {
    return true;
  }
  if (!isGitHubHost(url.hostname)) {
    return false;
  }
  if (url.pathname.startsWith(USER_ATTACHMENT_PATH_PREFIX)) {
    return true;
  }
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  return segments.length >= 4 && segments[2] === 'assets';
}

function getHtmlImageSrc(tag: string): string | null {
  const match = tag.match(HTML_IMAGE_SRC_PATTERN);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function replaceImageReferencesInText(
  text: string,
  getPlaceholder: (url: string) => string,
): string {
  const markdownReplaced = text.replace(MARKDOWN_IMAGE_PATTERN, (match, url: string) =>
    isGitHubPrImageAttachmentUrl(url) ? getPlaceholder(url) : match,
  );
  return markdownReplaced.replace(HTML_IMAGE_PATTERN, (match) => {
    const src = getHtmlImageSrc(match);
    return src && isGitHubPrImageAttachmentUrl(src) ? getPlaceholder(src) : match;
  });
}

function replaceCommentImages(
  comment: PrReviewComment,
  getPlaceholder: (url: string) => string,
): PrReviewComment {
  return {
    ...comment,
    body: replaceImageReferencesInText(comment.body, getPlaceholder),
  };
}

export function extractPrReviewImageReferences(prReview: PrReviewData): ExtractedPrReviewImageReferences {
  const references: PrReviewImageReference[] = [];
  const placeholderByUrl = new Map<string, string>();
  let nextImageNumber = 1;
  const getPlaceholder = (url: string): string => {
    const existing = placeholderByUrl.get(url);
    if (existing) {
      return existing;
    }
    const placeholder = `[Image #${nextImageNumber}]`;
    nextImageNumber += 1;
    if (references.length >= MAX_PR_REVIEW_IMAGE_REFERENCES) {
      return `${placeholder} download skipped: ${createPrReviewImageReferenceLimitMessage()}`;
    }
    placeholderByUrl.set(url, placeholder);
    references.push({ placeholder, url });
    return placeholder;
  };

  return {
    references,
    prReview: {
      ...prReview,
      body: replaceImageReferencesInText(prReview.body, getPlaceholder),
      comments: prReview.comments.map((comment) => replaceCommentImages(comment, getPlaceholder)),
      reviews: prReview.reviews.map((review) => replaceCommentImages(review, getPlaceholder)),
      files: [...prReview.files],
    },
  };
}

function replaceFailedPlaceholdersInText(
  text: string,
  replacementByPlaceholder: ReadonlyMap<string, string>,
): string {
  let replaced = text;
  for (const [placeholder, replacement] of replacementByPlaceholder) {
    replaced = replaced.split(placeholder).join(replacement);
  }
  return replaced;
}

function replaceFailedPlaceholdersInComment(
  comment: PrReviewComment,
  replacementByPlaceholder: ReadonlyMap<string, string>,
): PrReviewComment {
  return {
    ...comment,
    body: replaceFailedPlaceholdersInText(comment.body, replacementByPlaceholder),
  };
}

export function annotateFailedPrReviewImageReferences(
  prReview: PrReviewData,
  failures: readonly PrReviewImageDownloadFailure[],
): PrReviewData {
  if (failures.length === 0) {
    return prReview;
  }

  const replacementByPlaceholder = new Map(
    failures.map((failure) => [
      failure.placeholder,
      `${failure.placeholder} download failed: ${failure.reason}`,
    ]),
  );

  return {
    ...prReview,
    body: replaceFailedPlaceholdersInText(prReview.body, replacementByPlaceholder),
    comments: prReview.comments.map((comment) => replaceFailedPlaceholdersInComment(comment, replacementByPlaceholder)),
    reviews: prReview.reviews.map((review) => replaceFailedPlaceholdersInComment(review, replacementByPlaceholder)),
    files: [...prReview.files],
  };
}
