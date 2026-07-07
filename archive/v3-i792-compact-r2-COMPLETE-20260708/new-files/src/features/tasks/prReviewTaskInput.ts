import { formatPrReviewAsTask } from '../../infra/git/index.js';
import type { PrReviewData } from '../../infra/git/index.js';
import type { TaskAttachment } from './attachments.js';
import {
  resolvePrReviewImageAttachments,
  type ResolvePrReviewImageAttachmentsOptions,
} from './prReviewImageAttachments.js';

export interface PrReviewTaskInput {
  taskContent: string;
  prBranch: string;
  prBaseBranch?: string;
  attachments: TaskAttachment[];
  cleanupAttachments: () => void;
}

export async function buildPrReviewTaskInput(
  prReview: PrReviewData,
  cwd?: string,
  options?: Omit<ResolvePrReviewImageAttachmentsOptions, 'cwd'>,
): Promise<PrReviewTaskInput> {
  const resolved = await resolvePrReviewImageAttachments(prReview, {
    cwd,
    ...(options?.getGithubToken ? { getGithubToken: options.getGithubToken } : {}),
    ...(options?.downloadImage ? { downloadImage: options.downloadImage } : {}),
  });

  return {
    taskContent: formatPrReviewAsTask(resolved.prReview),
    prBranch: resolved.prReview.headRefName,
    prBaseBranch: resolved.prReview.baseRefName,
    attachments: resolved.attachments,
    cleanupAttachments: resolved.cleanupAttachments,
  };
}
