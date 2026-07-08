import type { TaskAttachment } from './attachments.js';
import { formatPrReviewAsTask } from '../../infra/git/index.js';
import type { GitProvider, PrReviewData } from '../../infra/git/index.js';
import { extractPrImageReferences } from '../../infra/git/prImageReferences.js';

export interface BuildPrReviewTaskInputOptions {
  gitProvider: Pick<GitProvider, 'isPrImageAttachmentUrl' | 'downloadPrImageAttachments'>;
  cwd?: string;
  tmpRoot?: string;
}

export interface PrReviewTaskInput {
  taskContent: string;
  attachments?: TaskAttachment[];
  cleanupAttachments?: () => void;
}

export async function buildPrReviewTaskInput(
  prReview: PrReviewData,
  options: BuildPrReviewTaskInputOptions,
): Promise<PrReviewTaskInput> {
  const extracted = extractPrImageReferences(prReview, options.gitProvider.isPrImageAttachmentUrl.bind(options.gitProvider));
  if (extracted.references.length === 0) {
    return {
      taskContent: formatPrReviewAsTask(extracted.prReview),
    };
  }

  const downloaded = await options.gitProvider.downloadPrImageAttachments(extracted.references, {
    cwd: options.cwd,
    tmpRoot: options.tmpRoot,
  });
  try {
    return {
      taskContent: formatPrReviewAsTask(extracted.prReview),
      attachments: downloaded.attachments,
      cleanupAttachments: downloaded.cleanupAttachments,
    };
  } catch (error) {
    downloaded.cleanupAttachments();
    throw error;
  }
}
