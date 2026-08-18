問題を「最新レビューレポートに提出された各 finding を、要求・現行コード・実行証跡と照合し、修正権限を分離して一意に裁定すること」と整理しました。まず指定された Policy／Knowledge を EOF まで読み、次に task と最新レポート群を特定し、最後に対象 family の範囲だけコードを水平比較して裁定集合を確定します。ファイル編集やテスト再実行は行いません。
Policy と Knowledge は全行を確認しました。今回適用する中心基準は、PR 画像取得という同一契約 family の「直接受入条件違反」「差分起因退行」「必須 consumer migration」「採用済み family の未訪問 consumer」のみを修正権限にすることです。一般的な堅牢化や隣接リファクタリングは、技術的に妥当でも別契約なら修正集合から除外します。
最新提出物では finding は4件で、いずれも AI アンチパターンレビュー由来です。ここまでの照合では、`replaceSegmentImageUrls` の2回呼出しは Markdown と HTML という別記法を処理しており、`determineWorkflow` の例外経路には明示的な cleanup があります。一方、placeholder 文法の重複については既存の共通 validator も含め、同じ意味契約かどうかを追加で水平比較しています。
## 裁定結果: 修正対象あり

提出された4件を一意に裁定しました。

| finding ID | disposition | 根拠 |
|---|---|---|
| `AI-NEW-routing-L144` | `false_positive` | 実体は [prReviewImageAttachments.ts:144](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/github/prReviewImageAttachments.ts:144)。2回の呼出しは Markdown と HTML の異なる画像記法を処理し、入力も2回目は1回目の結果である。同一引数・冗長分岐という主張は不成立。 |
| `AI-NEW-tasks-add-L215` | `no_issue_after_verification` | [add/index.ts:212](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/tasks/add/index.ts:212) で `determineWorkflow` の例外・取消時に cleanup、保存処理には `finally` がある。対応テストも例外・取消・保存失敗を直接検証している。 |
| `AI-NEW-pipeline-test` | `no_issue_after_verification` | [pipelineExecution.test.ts:1573](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/pipelineExecution.test.ts:1573) が成功・失敗・throw時の cleanup を検証。非対応 provider の fallback は [git-factory.test.ts:337](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/git-factory.test.ts:337)、実 filesystem 経路は統合テストで検証済み。 |
| `AI-NEW-image-attach-L35` | `actionable` → `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | reviewer の `direct_acceptance_criterion_violation` は不成立だが、今回差分が既存の共通文法とは異なる parser を追加したため、`remediation_regression` として採用する。 |

### 修正対象 family

`PRIMG-PLACEHOLDER-GRAMMAR-OWNER`

- 権限根拠: `remediation_regression`
- Reason Absent: 以前のレビューは生成結果と cleanup を確認したが、既存の共通所有者と新規 consumer の文法を水平比較していなかった。
- 破損した不変条件: `[Image #N]` の正規文法と番号解釈が単一の正本を持つこと。
- 証拠:
  - 正本は [imageAttachmentReferences.ts:5](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/shared/utils/imageAttachmentReferences.ts:5) で正の整数・先頭ゼロなしを定義。
  - [prReviewImageAttachments.ts:87](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/github/prReviewImageAttachments.ts:87) と [imageAttachments.ts:37](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/interactive/imageAttachments.ts:37) は独自に `0` や先頭ゼロも受理する別文法を再構築している。

bounded horizontal comparison で [retryTaskSpecAttachments.ts:51](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/tasks/retryTaskSpecAttachments.ts:51) に同じ再構築を確認しました。

- Follow-up ID: `ADJ-FOLLOWUP-retry-placeholder-grammar`
- disposition: `duplicate` → `PRIMG-PLACEHOLDER-GRAMMAR-OWNER`
- Authorization Basis: `accepted_family_unvisited_consumer`
- Reason Absent: reviewer の比較対象が GitHub producer と interactive consumer に限定され、retry terminal consumer が未訪問だったため。

受入条件は、共通所有者を通じて正規 placeholder を一貫して解釈しつつ、PRの空き番号選択・interactive/retryの後続採番という既存挙動を維持することです。Markdown／HTML画像抽出、URL検証、download、cleanup、provider capability、無効形式への互換対応、周辺リファクタリングは修正範囲から除外します。

再計画は不要です。環境要因による未確認事項もありません。次工程はこの1 family の修正計画・remediationです。