import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StoredImageAttachment } from '../types/image-attachments.js';
import { debugLog } from './debug.js';
import { extensionForImageMimeType, isSupportedImageMimeType } from './imageMime.js';

export type ImageAttachment = StoredImageAttachment;

export interface ImageAttachmentStore {
  saveImage(data: Buffer, mimeType: string): Promise<ImageAttachment>;
  listAttachments(): ImageAttachment[];
  cleanup(): void;
}

export interface ImageAttachmentStoreOptions {
  tmpRoot: string;
  sessionId: string;
  initialAttachments?: readonly ImageAttachment[];
}

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

function copyImageAttachment(attachment: ImageAttachment): ImageAttachment {
  return Object.freeze({
    placeholder: attachment.placeholder,
    tempPath: attachment.tempPath,
    fileName: attachment.fileName,
  });
}

function extensionForMimeType(mimeType: string): string {
  if (!isSupportedImageMimeType(mimeType)) {
    throw new Error(`Unsupported pasted image type: ${mimeType}`);
  }
  return extensionForImageMimeType(mimeType);
}

function ensurePrivateDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  fs.chmodSync(directoryPath, PRIVATE_DIRECTORY_MODE);
}

function validateImageAttachmentSessionId(sessionId: string): void {
  if (sessionId.length === 0) {
    throw new Error('Image attachment sessionId is required.');
  }
  if (
    sessionId === '.'
    || sessionId === '..'
    || sessionId.includes('/')
    || sessionId.includes('\\')
    || path.isAbsolute(sessionId)
    || path.win32.isAbsolute(sessionId)
  ) {
    throw new Error('Image attachment sessionId must be a single path segment.');
  }
}

export function cleanupImageAttachmentStore(attachmentStore: ImageAttachmentStore): void {
  try {
    attachmentStore.cleanup();
  } catch (error) {
    debugLog('image-attachments', 'Failed to cleanup image attachment store', error instanceof Error ? error.message : String(error));
  }
}

export function createImageAttachmentStore(
  options: ImageAttachmentStoreOptions,
): ImageAttachmentStore {
  if (options.tmpRoot.length === 0) {
    throw new Error('Image attachment tmpRoot is required.');
  }
  validateImageAttachmentSessionId(options.sessionId);

  let attachments: readonly ImageAttachment[] = options.initialAttachments
    ? options.initialAttachments.map(copyImageAttachment)
    : [];
  const sessionDir = path.join(options.tmpRoot, 'takt', options.sessionId);
  const attachmentDir = path.join(sessionDir, 'attachments');

  return {
    async saveImage(data: Buffer, mimeType: string): Promise<ImageAttachment> {
      const index = attachments.length + 1;
      const fileName = `image-${index}.${extensionForMimeType(mimeType)}`;
      const tempPath = path.join(attachmentDir, fileName);
      const attachment = copyImageAttachment({
        placeholder: `[Image #${index}]`,
        tempPath,
        fileName,
      });

      ensurePrivateDirectory(sessionDir);
      ensurePrivateDirectory(attachmentDir);
      fs.writeFileSync(tempPath, data, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
      attachments = [...attachments, attachment];
      return copyImageAttachment(attachment);
    },

    listAttachments(): ImageAttachment[] {
      return attachments.map(copyImageAttachment);
    },

    cleanup(): void {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    },
  };
}

export function createSessionImageAttachmentStore(
  initialAttachments?: readonly ImageAttachment[],
): ImageAttachmentStore {
  return createImageAttachmentStore({
    tmpRoot: os.tmpdir(),
    sessionId: randomUUID(),
    ...(initialAttachments ? { initialAttachments } : {}),
  });
}
