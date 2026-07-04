# タスク完了サマリー

## タスク
README.md の仕様と `src/types.ts` の公開契約に従い、イベントソーシングの在庫管理ライブラリを実装する。`tests/` と `src/types.ts` は変更せず、`src/index.ts` の公開 API を維持したうえで、全 51 件のテストが成功する状態にする。

## 結果
完了

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 作成 | `src/domain.ts` | `initialState`, `evolve`, `decide` とドメイン不変条件を実装 |
| 作成 | `src/event-store.ts` | 楽観的並行性制御付き `InMemoryEventStore` を実装 |
| 作成 | `src/command-handler.ts` | `EventStore` ポートを使うコマンド処理オーケストレーションを実装 |
| 作成 | `src/projection.ts` | イベントから在庫読み取りモデルを構築する `StockProjection` を実装 |
| 変更 | `src/index.ts` | 公開 API 名を維持し、新規実装モジュールから re-export する構成に変更 |

## 検証証跡
- `bench-run.log:49680-49710` に `Test Files 4 passed (4)` / `Tests 51 passed (51)` を確認。
- `merge-readiness-review.md:13` に `npm test` 51 passed / `npm run typecheck` 成功を確認。
- `merge-readiness-review.md:11-15` に要求充足、変更禁止対象の差分なし、スコープクリープなし、`initialState` 深い凍結と `getStock` コピー返却の確認を確認。