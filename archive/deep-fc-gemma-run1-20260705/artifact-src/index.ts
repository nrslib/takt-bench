/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
import type { ProductState } from './types.js';

export const initialState: ProductState = Object.freeze({
  exists: false,
  name: '',
  onHand: 0,
  reservations: Object.freeze({}),
});

export * from './types.js';

export * from './domain.js';

export * from './event-store.js';

export * from './command-handler.js';

export * from './projection.js';
