import {
  type DownloadedGithubAttachmentImage,
} from '../../infra/github/attachmentImageDownloader.js';
import {
  formatSafeGithubAttachmentUrlForError,
  isAllowedGithubAttachmentUrl,
} from '../../infra/github/attachmentImageUrlPolicy.js';
import {
  getImageExtensionForMimeType,
  inferImageMimeTypeFromMagicBytes,
} from '../../shared/utils/imageMime.js';

export interface ValidatedPrReviewImage {
  mimeType: string;
  extension: string;
}

function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0]!.trim().toLowerCase();
}

export function validatePrReviewImageDownload(
  downloaded: DownloadedGithubAttachmentImage,
  sourceUrl: string,
  maxBytes: number,
): ValidatedPrReviewImage {
  if (!isAllowedGithubAttachmentUrl(downloaded.finalUrl)) {
    throw new Error(
      `PR image redirect URL is not an allowed GitHub attachment URL: ${
        formatSafeGithubAttachmentUrlForError(downloaded.finalUrl)
      }`,
    );
  }
  if (downloaded.body.length > maxBytes) {
    throw new Error(
      `PR image exceeds the ${maxBytes} byte limit: ${formatSafeGithubAttachmentUrlForError(sourceUrl)}`,
    );
  }

  const contentType = normalizeContentType(downloaded.contentType);
  const dataMimeType = inferImageMimeTypeFromMagicBytes(downloaded.body);
  if (!dataMimeType) {
    throw new Error('Unsupported PR image type. Expected PNG, JPEG, GIF, or WebP data.');
  }
  if (contentType !== dataMimeType) {
    throw new Error(`Content-Type ${contentType} does not match image data ${dataMimeType}`);
  }

  return {
    mimeType: dataMimeType,
    extension: getImageExtensionForMimeType(dataMimeType),
  };
}
