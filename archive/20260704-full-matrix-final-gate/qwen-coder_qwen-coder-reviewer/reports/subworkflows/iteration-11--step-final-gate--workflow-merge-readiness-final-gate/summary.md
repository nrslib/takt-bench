# タスク完了サマリー

## タスク
README.md の仕様と `src/types.ts` の公開契約に従って、イベントソーシングの在庫管理ライブラリを実装する。`tests/` と `src/types.ts` を変更せず、`src/index.ts` の公開 API シグネチャと README のアーキテクチャ要件を守ったうえで、`tests/` 配下の 51 件を成功させる。

## 結果
未完了（REJECT）

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 変更 | `src/index.ts` | README の公開 API を各実装モジュールから re-export する構成を確認 |
| 作成 | `src/domain.ts` | `initialState` / `evolve` / `decide` の実装を確認。ただし公開 `initialState` が未 freeze で REJECT |
| 作成 | `src/event-store.ts` | `InMemoryEventStore` の実装を確認 |
| 作成 | `src/command-handler.ts` | `EventStore` ポート依存の `CommandHandler` 実装を確認 |
| 作成 | `src/projection.ts` | イベントのみから読み取りモデルを構築する `StockProjection` 実装を確認。ただし不要な `Map#set` が残存し REJECT |

## 検証証跡
- `bench-run.log` に `npm test` の 4 files / 51 tests passed が記録されていることを確認。
- `bench-run.log` に `npm run typecheck` 成功、および `npx tsc --noEmit --noUnusedLocals` 成功が記録されていることを確認。
- `src/types.ts` と `tests/` が変更されていないことを確認。
- `src/index.ts` の公開 API は README の対象 API を re-export していることを確認。
- `src/domain.ts:12` の公開 `initialState` が未 freeze で、ネストした `reservations` も可変のため、公開状態の不変性要件に未適合。
- `src/projection.ts:31` に同一 `state` を再度 `Map#set` する不要コードが残っているため未完了。