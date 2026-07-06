/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
export * from './types.js';

export { evolve, initialState } from './domain/inventory-aggregate.js';
export { InMemoryEventStore } from './domain/event-store.js';
export { decide } from './domain/command-decider.js';
export * from './services/inventory-service.js';






