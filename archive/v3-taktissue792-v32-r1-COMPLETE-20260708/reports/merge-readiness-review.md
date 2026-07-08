# Merge Readiness Review

## 結果: APPROVE

## サマリー
PR コメント画像添付の抽出、検証、保存、`order.md` 反映、`add --pr` と pipeline `--pr` の配線は、実装・テスト・ドキュメント・検証結果の範囲でマージ可能な状態です。観測したマージブロッカーはありません。

## 保守前提のマージ品質チェック
| # | 観点 | 状態 | 根拠（ファイル:行 / テスト / 実行証跡） | コメント |
|---|------|------|---------------------------------------|----------|
| 1 | 要求充足 | 充足 | `src/features/tasks/prReviewImageAttachments.ts:194`, `src/features/tasks/add/index.ts:200`, `src/features/pipeline/steps.ts:150` | PR body / 通常コメント / review thread と add / pipeline 経路を確認 |
| 2 | 既存契約・既存フローへの影響 | 問題なし | `src/features/tasks/attachments.ts:26`, `src/app/cli/routing-inputs.ts:52` | 既存 `TaskAttachment` と task spec 配置経路に接続 |
| 3 | テスト・検証 | 十分 | `npm run build` 成功、`npm run lint` 成功、`npm test` 成功 | `npm test`: 4 shard すべて成功、各 shard `125 passed` |
| 4 | 要求外変更・スコープクリープ | 問題なし | `README.md:262`, `docs/cli-reference.md:240`, `docs/cli-reference.ja.md:239` | 仕様変更に対応する利用者向け説明のみ |
| 5 | 保守可能性・将来変更容易性 | 問題なし | `src/infra/github/attachmentDownload.ts:45`, `src/shared/utils/imageMime.ts:1` | allowlist、サイズ上限、mime 判定が分離されている |
| 6 | 明白なセキュリティ・データ保護・運用リスク | 問題なし | `src/infra/github/attachmentDownload.ts:145`, `src/infra/github/attachmentDownload.ts:180`, `src/shared/utils/imageMime.ts:80` | redirect 再検証、stream 上限、Content-Type/magic bytes 検証あり |

## 横断監査証跡
| # | 変更カテゴリ | 抽出した項目 | 確認した検索語・ファイル | 判定 | コメント |
|---|--------------|--------------|--------------------------|------|----------|
| 1 | helper / adapter / entrypoint / 出力契約 / cleanup | `preparePrReviewImageAttachments`, `downloadGitHubImageAttachment`, `validateImageDataMime`, `TaskAttachment`, `cleanupAttachments` | `rg "preparePrReviewImageAttachments\|downloadGitHubImageAttachment\|validateImageDataMime\|TaskAttachment\|cleanupAttachments"` / `src/features/tasks/add/index.ts`, `src/features/pipeline/steps.ts`, `src/features/pipeline/execute.ts`, `src/app/cli/routing.ts`, `src/app/cli/routing-inputs.ts`, `src/features/tasks/attachments.ts` | 問題なし | add、routing、pipeline、保存、表示、cleanup 経路を確認 |