問題を、裁定済み8 familyだけについて現行コードと一次資料を照合し、次の実装ステップがそのまま使える依存順つき計画へ落とす作業と理解しました。まずタスク正本、Knowledge／Policy全文、Report Directoryの現行裁定と必要な履歴、対象コード・テストを読み直します。このステップでは編集しません。
一次資料では、履歴上の `persists`／`reopened` はなく、レビュー履歴ファイルも各レポート1件だけでした。そのため過去履歴から対象を追加せず、裁定8 familyを固定します。次に、各familyの正本・入口・所有者・失敗経路と、既存テスト分類を現行コードで照合しています。
現行コードの照合が完了しました。根本原因は裁定どおりで、同一原因の追加対象はありません。特に、同じcleanup関数の既存利用箇所は検索できましたが、裁定の契約経路はpipelineの一時task specに限定されているため、他の既存経路へ修正を広げません。また、`SEC-001`の件数・累積容量制限は明示的に計画外とします。
## 調査結果

裁定済み8 familyは、現行コードでも未解決です。追加の actionable family、環境依存で保留する事項、タスク全体の再計画が必要な競合はありません。このステップではソースを編集していません。

## 実装計画

1. `shared-image-boundary-ownership`
   - 対象: `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1`
   - [githubAttachmentUrl.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/githubAttachmentUrl.ts:1) を `src/infra/github/attachmentUrl.ts` へ移し、[prImageDownload.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/github/prImageDownload.ts:1) と [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:1) の現行利用側を移行する。
   - 旧sharedファイルや互換re-exportは残さない。
   - [imageAttachmentStore.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageAttachmentStore.ts:23) の `pasted` エラー表現と `interactive` ログ分類を、画像attachment一般の名前へ変更する。
   - shared全体の再編、他provider対応、公開API追加は行わない。

2. `github-auth-host-binding`
   - 対象: `CODE-NEW-prImageDownload-L39`
   - GitHub境界内で許可ホスト `github.com` を単一の定数として所有し、URL検証と `gh auth token --hostname github.com` の両方で使う。
   - `GH_HOST` がEnterpriseを指すテスト環境でも、github.com用トークンだけがAuthorizationへ渡る決定的テストを追加する。
   - GitHub Enterprise URLは許可対象へ加えない。

3. `image-signature-validation`
   - 対象: `ARCH-NEW-src-shared-utils-imageMimeType-L17`、`AI-NEW-IMAGE-MAGIC-16`、`CODE-NEW-imageMimeType-L17`
   - [imageMimeType.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageMimeType.ts:16) でPNGの8バイト署名 `89 50 4E 47 0D 0A 1A 0A` を完全比較する。
   - 正常な8バイト署名、4バイトだけのprefix、8バイト途中不一致を検証する。
   - PR downloaderとinline pasteを通る正常fixtureを正式署名へ更新する。検索で確認した `inlineImagePaste`、`lineEditor`、`instructMode`、`interactive-mode`、`conversationLoop-resume`、`retrySlashCommand` の正常入力も対象とする。
   - WebP判定強化や実デコーダ検証は追加しない。

4. `markdown-image-semantics`
   - 対象: `CODE-NEW-prReviewAttachments-L22`
   - [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:21) 内で、コードフェンス、inline code、HTMLコメントの範囲を識別し、その範囲を画像正規表現の走査対象から除外する。
   - 元文字列のindexを保持したまま通常のMarkdown画像とHTML `<img>` だけを既存のplaceholder処理へ渡す。
   - 3種類の除外コンテキストが原文保持・downloadなしとなる回帰テストを追加する。通常画像、HTML画像、重複URLの既存契約は維持する。
   - Markdown全般のparser、renderer、本文正規化は追加しない。

5. `pr-body-image-routing`
   - 対象: `AI-NEW-TASKS-PR-BODY-194`、`ARCH-NEW-src-features-tasks-add-index-L194`
   - [add/index.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/add/index.ts:194) の早期終了条件へ、trim後のPR本文が空であることを加える。
   - `reviews: []`、`comments: []` でも本文画像があれば整形・準備・保存へ進むテストを追加する。
   - 既存の「コメントなし」テストは本文も空白だけのケースへ変更し、実質的な本文・コメントがないPRを引き続き拒否する。

6. `pipeline-cleanup-result-preservation`
   - 対象: `ARCH-NEW-src-features-pipeline-steps-L411`
   - [pipeline/steps.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/pipeline/steps.ts:371) の一時task spec削除だけをbest-effort化し、cleanup失敗をpipeline用loggerへ記録する。
   - workflowが`false`を返した後にcleanupが失敗しても`false`を維持するテストと、`executeTask`例外後のcleanup失敗でも元例外を維持するテストを追加する。
   - transaction、rollback、再試行や、他の既存cleanup利用側の変更は行わない。

7. `pr-image-owner-failure-tests`
   - 対象: `TEST-NEW-pr-image-cleanup-L301`
   - [addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts:301) に、PR画像準備後のtask保存を実attachment sourceエラーで失敗させるテストを追加する。元例外、cleanup 1回、既存tasks永続状態の不変を確認する。
   - [cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:370) に、PR source attachmentを持つ実行処理が例外終了するケースを追加し、元例外とsource cleanup 1回を確認する。
   - OS削除障害の網羅や新しいcleanup運用契約は追加しない。

8. `pr-image-production-dataflow-test`
   - 対象: `TEST-NEW-pr-image-dataflow-L29`
   - `src/__tests__/pr-image-dataflow.integration.test.ts` を追加する。
   - GitHub画像取得とagent実行だけを置換し、実際の以下の経路を結合する。
     - `formatPrReviewAsTask`
     - `preparePrReviewAttachments`
     - 実image store
     - `saveTaskFile`によるtask保存
     - `runWorkflow`の実task spec生成・resolver
     - `stageTaskSpecForExecution`によるrun context配置
   - `.takt/tasks/.../attachments/image-1.png`、保存済み`order.md`の`[Image #1]`、run context側の書換済み参照と画像ファイルを観測する。
   - [test-classification.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/test-classification.mjs:344) の軽量IT一覧へ明示登録する。完全なWorkflowEngine、実GitHub資格情報、Git、child processは使わない。

## 依存順

`shared境界移動 → hostname結合 → PNG署名 → Markdown解釈 → add入口 → pipeline cleanup → 所有者失敗テスト → production dataflow IT` の順で実施します。境界移動時は全利用側の更新と旧ファイル削除を同じ修正単位にします。

## 完了ゲート

- 対象unit・ITを個別実行
- 変更した既存heavy ITを対象指定で実行
- `npm test -- src/__tests__/releaseVerificationWiring.test.ts`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:it`
- `npm run test:e2e:mock`

実private GitHub通信は受入条件ではなく、決定的なhostname・Authorizationテストで代替します。`SEC-001`の件数・累積容量制限は裁定済み`overreach`のため、実装・テストとも追加しません。