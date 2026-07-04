# タスク完了サマリー

## タスク
README.md の仕様と `src/types.ts` の公開契約に従い、イベントソーシングの在庫管理ライブラリを実装する。`tests/` と `src/types.ts` を変更せず、`src/index.ts` の公開 API シグネチャを維持したまま、tests 配下 51 件が成功する状態にする。

## 結果
完了

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 変更 | `src/index.ts` | 公開 API 名を維持し、型定義と実装モジュールを re-export |
| 作成 | `src/domain.ts` | `initialState`、`evolve`、`decide` とドメイン不変条件を実装 |
| 作成 | `src/event-store.ts` | 楽観的並行性制御付き `InMemoryEventStore` を実装 |
| 作成 | `src/command-handler.ts` | load → replay → decide → append の `CommandHandler` を実装 |
| 作成 | `src/projection.ts` | イベントのみから在庫読み取りモデルを構築する `StockProjection` を実装 |

## 検証証跡
- `src/types.ts` と `tests/` に差分がないことを確認
- `src/index.ts` が README に列挙された公開 API を re-export していることを確認
- README のドメインルール、イベントストア仕様、プロジェクション仕様、アーキテクチャ要件を実コードで照合
- 前段検証証跡で `npm test` 成功（4 files, 51 tests）を確認
- 前段検証証跡で `npm run typecheck` 成功を確認
- この supervise ステップでは、役割境界に従いテスト・ビルドの再実行は行っていない