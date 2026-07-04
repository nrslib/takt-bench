# タスク完了サマリー

## タスク
README.md の仕様と `src/types.ts` の公開契約に従い、イベントソーシングの在庫管理ライブラリを実装する要求でした。`tests/` と `src/types.ts` は変更せず、`src/index.ts` の公開 API を維持し、全 51 テスト成功と README のアーキテクチャ要件充足が完了条件でした。

## 結果
未完了（REJECT）

最終検証で、前回指摘した公開状態の不変性に関する未充足が継続していることを確認しました。`persists` が 2 件あるため、マージ承認できません。

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 変更 | `src/index.ts` | 公開 API を各実装モジュールから re-export する形に変更 |
| 作成 | `src/domain.ts` | `initialState`、`evolve`、`decide` とドメインルールを実装 |
| 作成 | `src/event-store.ts` | `InMemoryEventStore` と楽観的並行性制御を実装 |
| 作成 | `src/command-handler.ts` | load → replay → decide → append のコマンド処理を実装 |
| 作成 | `src/projection.ts` | イベントから在庫読み取りモデルを構築する `StockProjection` を実装 |

## 検証証跡
- `npm test`: 4 test files / 51 tests passed の実行証跡を確認。
- `npm run typecheck`: `tsc --noEmit` 実行、エラー出力なしの証跡を確認。
- `tests/` と `src/types.ts` に差分がないことを確認。
- `src/domain.ts:13-18` の `initialState` が公開可変状態のままであることを確認。
- `src/projection.ts:65-67` の `getStock()` が内部読み取りモデル参照をそのまま返していることを確認。

## 未完了項目
| # | 項目 | 理由 |
|---|------|------|
| 1 | `initialState` の実行時不変性 | 公開された初期状態定数が freeze されず、利用側から変更可能 |
| 2 | `StockProjection.getStock()` の防御的コピー | 内部読み取りモデルの参照をそのまま返しており、呼び出し側から内部状態を変更可能 |