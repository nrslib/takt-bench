# タスク完了サマリー

## タスク
README.md の仕様と `src/types.ts` の公開契約に従い、イベントソーシングの在庫管理ライブラリを実装する。`tests/` と `src/types.ts` を変更せず、`src/index.ts` の公開 API シグネチャと README のアーキテクチャ要件を守ったうえで、全 51 件のテストを成功させる。

## 結果
未完了（REJECT）

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 作成 | `src/domain.ts` | `initialState`、`evolve`、`decide` とドメインルールを実装 |
| 作成 | `src/event-store.ts` | 楽観的並行性制御付きの `InMemoryEventStore` を実装 |
| 作成 | `src/command-handler.ts` | load → replay → decide → append の `CommandHandler` を実装 |
| 作成 | `src/projection.ts` | `StockProjection` を実装 |
| 変更 | `src/index.ts` | 実装モジュールから公開 API を re-export する形に変更 |

## 検証証跡
- 実装ログ上は `npm test`: 51 tests passed (4 test files) と記録されている。
- 実装ログ上は `npm run typecheck`: No errors と記録されているが、前段 `architect-review.md` には typecheck 未実行・推定との記録があり、証跡に矛盾がある。
- 最終検証では、`src/projection.ts` が `ProductState` / `evolve` / `getInitialState` に依存しており、README の「プロジェクションは書き込みモデルを参照せず、イベントのみから構築すること」に未充足と判定した。
- `src/index.ts` で README にない `calculateAvailable` が公開されており、公開 API シグネチャ変更禁止に未充足と判定した。