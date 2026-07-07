/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
export * from './types.js';

export { initialState, evolve, decide } from './domain.js';
export { InMemoryEventStore } from './event-store.js';
export { CommandHandler } from './command-handler.js';
export { StockProjection } from './projection.js';
