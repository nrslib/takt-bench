import type { StoredImageAttachment } from '../../shared/types/image-attachments.js';
import { formatPrReviewAsTask } from '../../infra/git/index.js';
import type { GitProvider, PrReviewData } from '../../infra/git/types.js';

export interface PrReviewTaskInput {
  taskContent: string;
  attachments: StoredImageAttachment[];
  cleanupAttachments: () => void;
  prReviewTitle: string;
  prBranch: string;
  prBaseBranch?: string;
}

export interface ResolvedPrReviewTaskAttachments {
  prReview: PrReviewData;
  attachments: StoredImageAttachment[];
  cleanupAttachments: () => void;
}

export async function resolvePrReviewTaskAttachments(
  prReview: PrReviewData,
  provider: GitProvider,
  cwd?: string,
): Promise<ResolvedPrReviewTaskAttachments> {
  return provider.resolvePrReviewAttachments
    ? await provider.resolvePrReviewAttachments(prReview, cwd)
    : {
      prReview,
      attachments: [],
      cleanupAttachments: () => undefined,
    };
}

export function formatPrReviewTaskInput(resolution: ResolvedPrReviewTaskAttachments): PrReviewTaskInput {
  return {
    taskContent: formatPrReviewAsTask(resolution.prReview),
    attachments: resolution.attachments,
    cleanupAttachments: resolution.cleanupAttachments,
    prReviewTitle: resolution.prReview.title,
    prBranch: resolution.prReview.headRefName,
    prBaseBranch: resolution.prReview.baseRefName,
  };
}

export async function buildPrReviewTaskInput(
  prReview: PrReviewData,
  provider: GitProvider,
  cwd?: string,
): Promise<PrReviewTaskInput> {
  return formatPrReviewTaskInput(await resolvePrReviewTaskAttachments(prReview, provider, cwd));
}
