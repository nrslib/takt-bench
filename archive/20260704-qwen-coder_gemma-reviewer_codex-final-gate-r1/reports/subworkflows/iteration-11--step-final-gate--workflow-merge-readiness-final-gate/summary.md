# タスク完了サマリー

## タスク
README.md の仕様と src/types.ts の公開契約に従い、イベントソーシングの在庫管理ライブラリを実装する要求。tests/ 配下 51 件の成功、tests/ と src/types.ts の変更禁止、src/index.ts の公開 API シグネチャ維持、README のアーキテクチャ要件遵守が条件。

## 結果
未完了（REJECT）

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 作成 | `src/domain.ts` | `evolve` / `decide` とドメインルールを実装 |
| 作成 | `src/event-store.ts` | `InMemoryEventStore` を実装 |
| 作成 | `src/command-handler.ts` | load → replay → decide → append の `CommandHandler` を実装 |
| 作成 | `src/projection.ts` | `StockProjection` を実装。ただし予約数量管理に未充足あり |
| 変更 | `src/index.ts` | 公開 API の re-export と `initialState` の deep freeze を実装 |

## 検証証跡
- `fix.3.20260704T030907Z.md` に `npm test`: 51 tests passed (4 test files passed) の証跡あり。
- `fix.3.20260704T030907Z.md` に `npm run typecheck`: 型エラーなしの証跡あり。
- `src/types.ts` と `tests/` は差分なしと確認。
- 未使用 import の前段指摘は、`src/index.ts`, `src/command-handler.ts`, `src/event-store.ts` の現在コードで解消済み。
- 最終検証で `src/projection.ts` の予約数量が `reservationId` のみで管理されていることを確認。同じ `reservationId` を別商品で使うと `StockShipped` / `ReservationReleased` が別商品の予約数量を参照し得るため、README の Projection セマンティクスを満たさない。
- 未完了項目: `StockProjection` の予約数量を `productId` と `reservationId` の組で管理する修正が必要。