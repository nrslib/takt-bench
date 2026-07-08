export const MAX_PR_REVIEW_IMAGE_REFERENCES = 10;
export const MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;

export function createPrReviewImageReferenceLimitMessage(): string {
  return `PR image attachment limit exceeded: maximum ${MAX_PR_REVIEW_IMAGE_REFERENCES} images.`;
}

export function createPrReviewImageTotalBytesLimitMessage(): string {
  return `PR image attachment total size exceeds ${MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES} bytes.`;
}
