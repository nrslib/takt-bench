# タスク完了サマリー

## タスク
README.md の仕様と `src/types.ts` の公開契約に従い、イベントソーシングの在庫管理ライブラリを実装する。`tests/` と `src/types.ts` を変更せず、`src/index.ts` の公開 API シグネチャと README のアーキテクチャ要件を維持したまま、tests 配下の全 51 件を成功させる。

## 結果
完了

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 変更 | `src/index.ts` | 公開 API 入口として `types`、domain、event store、command handler、projection を re-export する構成に整理 |
| 作成 | `src/domain.ts` | `initialState`、`evolve`、`decide` とドメイン不変条件の実装 |
| 作成 | `src/event-store.ts` | `EventStore` ポートの in-memory 実装と楽観的並行性制御 |
| 作成 | `src/command-handler.ts` | `load → replay → decide → append` のコマンド処理 |
| 作成 | `src/projection.ts` | イベントのみから在庫読み取りモデルを構築する projection |

## 検証証跡
- 前段レビュー証跡で `npm test` 成功、4 test files / 51 tests passed を確認。
- 前段レビュー証跡で `npm run typecheck` 成功を確認。
- `README.md`、`src/types.ts`、`tests/` に差分がないことを確認。
- `src/index.ts` の公開 API は README 記載の API に対応し、追加実装は `domain` / `event-store` / `command-handler` / `projection` に分割済み。
- supervisor-validation で前段 finding はすべて resolved 妥当、new / persists は 0 件と判定。