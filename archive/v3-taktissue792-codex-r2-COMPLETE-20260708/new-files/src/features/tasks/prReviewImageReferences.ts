import type { PrReviewData } from '../../infra/git/index.js';
import { isAllowedGithubAttachmentUrl } from '../../infra/github/attachmentImageUrlPolicy.js';

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^)]+["'])?\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;

interface ImageReference {
  raw: string;
  url: string;
}

function collectImageReferences(text: string): ImageReference[] {
  const references: ImageReference[] = [];
  for (const match of text.matchAll(MARKDOWN_IMAGE_PATTERN)) {
    const raw = match[0];
    const url = match[1];
    if (url !== undefined) {
      references.push({ raw, url });
    }
  }
  for (const match of text.matchAll(HTML_IMAGE_PATTERN)) {
    const raw = match[0];
    const url = match[1] ?? match[2] ?? match[3];
    if (url !== undefined) {
      references.push({ raw, url });
    }
  }
  return references;
}

function replaceImageReferences(text: string, placeholderByUrl: ReadonlyMap<string, string>): string {
  let replaced = text;
  for (const reference of collectImageReferences(text)) {
    const placeholder = placeholderByUrl.get(reference.url);
    if (placeholder !== undefined) {
      replaced = replaced.split(reference.raw).join(placeholder);
    }
  }
  return replaced;
}

export function collectAllowedPrReviewImageUrls(prReview: PrReviewData): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const collect = (text: string): void => {
    for (const reference of collectImageReferences(text)) {
      if (!isAllowedGithubAttachmentUrl(reference.url) || seen.has(reference.url)) {
        continue;
      }
      seen.add(reference.url);
      urls.push(reference.url);
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

export function copyPrReviewWithReplacedImageReferences(
  prReview: PrReviewData,
  placeholderByUrl: ReadonlyMap<string, string>,
): PrReviewData {
  return {
    ...prReview,
    body: replaceImageReferences(prReview.body, placeholderByUrl),
    comments: prReview.comments.map((comment) => ({
      ...comment,
      body: replaceImageReferences(comment.body, placeholderByUrl),
    })),
    reviews: prReview.reviews.map((review) => ({
      ...review,
      body: replaceImageReferences(review.body, placeholderByUrl),
    })),
  };
}
