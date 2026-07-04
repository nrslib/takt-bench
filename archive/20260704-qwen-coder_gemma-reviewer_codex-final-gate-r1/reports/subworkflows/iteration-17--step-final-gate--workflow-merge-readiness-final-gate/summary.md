# タスク完了サマリー

## タスク
README.md の仕様と `src/types.ts` の公開契約に従い、イベントソーシングの在庫管理ライブラリを実装する。`tests/` と `src/types.ts` を変更せず、`src/index.ts` の公開 API シグネチャと README のアーキテクチャ要件を守る。

## 結果
完了

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 作成 | `src/domain.ts` | `evolve` / `decide` とドメイン不変条件を実装 |
| 作成 | `src/event-store.ts` | 楽観的並行性制御付きの `InMemoryEventStore` を実装 |
| 作成 | `src/command-handler.ts` | load → replay → decide → append のオーケストレーションを実装 |
| 作成 | `src/projection.ts` | イベントから在庫読み取りモデルを構築する `StockProjection` を実装 |
| 変更 | `src/index.ts` | 公開 API の re-export と `initialState` を実装 |

## 検証証跡
- `reports/coding-review.md`: `npm test` 51/51 件成功を確認
- `reports/coding-review.md`: 型チェック合格を確認
- 実コード確認: `src/projection.ts` の予約管理が商品別になり、前段 finding の予約スコープ不整合が解消済み
- 差分確認: `tests/` と `src/types.ts` に変更なし、削除差分なし