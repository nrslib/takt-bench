export * from './types.js';
export { initialState, evolve, decide } from './domain/product.js';
export { InMemoryEventStore } from './infra/in-memory-event-store.js';
export { CommandHandler } from './app/command-handler.js';
export { StockProjection } from './read/stock-projection.js';
