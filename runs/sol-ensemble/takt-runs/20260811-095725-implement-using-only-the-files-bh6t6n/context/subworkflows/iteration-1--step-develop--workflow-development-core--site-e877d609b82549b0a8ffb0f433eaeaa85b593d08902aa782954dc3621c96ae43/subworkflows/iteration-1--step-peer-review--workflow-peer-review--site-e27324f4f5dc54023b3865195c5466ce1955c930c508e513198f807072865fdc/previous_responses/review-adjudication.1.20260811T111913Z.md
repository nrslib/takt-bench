問題は、最新レビューレポートに提出された指摘だけを、要求・現行コード・実行証跡と照合し、後工程へ渡す修正対象の正本に裁定することです。まず指定された Policy／Knowledge を全文確認し、task 配下と Report Directory の対象レポートを特定します。その後、各 finding ID を一意に分類して family と受入条件を確定します。今回は読み取り専用で進め、ファイルは編集しません。
指定ソースの確認が完了しました。適用する中心基準は、提出済み finding の事実性とタスクへの直接関係を分離すること、確認済みの欠陥は最小内部修正として保持すること、テストは実際に通る境界で分類することです。次に、要求と5件の最新レビューを全文で突き合わせます。
提出された finding は12件です。現時点で、PR本文のみを `add --pr` が早期終了で落とす問題、PNG署名の部分一致、GitHubトークンの対象ホスト未指定、コードブロック内の画像例の誤取得、pipeline一時task specのcleanup例外による結果上書きは、現行コード上の具体的経路を確認できています。残りは、要求された制限を超える提案か、直接関係するテスト／責務境界の欠陥かを、既存テストと呼び出し側まで確認して切り分けます。
裁定の境界は確定しました。総件数・累積容量の新設要求だけは、現行実装が1画像10 MiB制限とGitHub URL制限を持ち、元要求がPR全体の総量契約を定めていないうえ、裁定ポリシーが確認済み欠陥を超える資源上限を明示的に禁じているため、修正対象から除外します。その他は、重複を統合すると8つの独立した修正 family が残ります。最終出力前に、finding ID の一意性と判断箇所を再確認します。
## 裁定結果

**修正対象あり**です。提出された12件を、8つの actionable family、3件の duplicate、1件の overreach に確定しました。再計画が必要な競合・未解決前提はありません。

### Finding別裁定

| finding ID | 出典 | disposition | 統合先／根拠 |
|---|---|---|---|
| `AI-NEW-TASKS-PR-BODY-194` | ai-antipattern-review | `actionable` | `F1-pr-body-routing` |
| `ARCH-NEW-src-features-tasks-add-index-L194` | architecture-review | `duplicate` | `F1-pr-body-routing` |
| `ARCH-NEW-src-shared-utils-imageMimeType-L17` | architecture-review | `actionable` | `F2-image-signature-validation` |
| `AI-NEW-IMAGE-MAGIC-16` | ai-antipattern-review | `duplicate` | `F2-image-signature-validation`。PNG欠陥を統合。WebPを14バイトに限定する提案は必要性未立証のため受入条件に含めない |
| `CODE-NEW-imageMimeType-L17` | coding-review | `duplicate` | `F2-image-signature-validation` |
| `ARCH-NEW-src-features-pipeline-steps-L411` | architecture-review | `actionable` | `F3-pipeline-cleanup-result-preservation` |
| `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1` | architecture-review | `actionable` | `F4-shared-boundary-ownership` |
| `CODE-NEW-prImageDownload-L39` | coding-review | `actionable` | `F5-github-auth-host-binding` |
| `CODE-NEW-prReviewAttachments-L22` | coding-review | `actionable` | `F6-markdown-image-semantics` |
| `SEC-001` | security-review | `overreach` | 1画像10 MiB制限とGitHub URL制限は存在する。要求はPR全体の件数・累積容量契約を定めておらず、裁定ポリシーも確認済み欠陥を超える資源上限の追加を禁止している |
| `TEST-NEW-pr-image-dataflow-L29` | testing-review | `actionable` | `F7-pr-image-production-dataflow-test` |
| `TEST-NEW-pr-image-cleanup-L301` | testing-review | `actionable` | `F8-pr-image-owner-failure-tests` |

## 修正対象 family

### F1-pr-body-routing

- 不変条件: PR本文の画像は、コメント件数にかかわらず全PR入口から画像準備処理へ到達する。
- 証拠: [add/index.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/add/index.ts:194) は `reviews` と `comments` が空だと、本文を整形・抽出する前に終了する。一方、[format.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/git/format.ts:197) はPR本文を出力する。
- 受入条件: 本文にGitHub画像があり `reviews: []`、`comments: []` のPRでも、`takt add --pr` が画像を保存し、`order.md` に参照を出力する。
- 修正境界: 本文を考慮した早期終了判定と回帰テストのみ。完全に空のPRをどう扱うかという既存挙動の不要な変更は除外する。

### F2-image-signature-validation

- 不変条件: Content-Typeと対応形式の正式な識別signatureが一致するデータだけを保存する。
- 証拠: [imageMimeType.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageMimeType.ts:16) はPNGを先頭4バイトだけで受理し、[github-pr-image-download.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/github-pr-image-download.test.ts:14) も4バイトを正常fixtureにしている。
- 受入条件: PNGの8バイト署名を検証し、4バイトprefixや途中不一致を拒否する。PR取得とinline pasteの正常fixtureも有効な署名へ更新する。
- 修正境界: 実デコーダによる画像全体の妥当性検証や、根拠未確定のWebP 14バイト固定は除外する。

### F3-pipeline-cleanup-result-preservation

- 不変条件: 一時task specのcleanup失敗は、workflowの元の戻り値・例外を上書きしない。
- 証拠: [steps.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/pipeline/steps.ts:411) の `finally` は、例外を投げ得る `cleanupPreparedTaskSpec()` を直接呼ぶ。
- 受入条件: workflowの`false`または実行例外とcleanup失敗が連続しても、元のworkflow結果・例外が維持される。
- 修正境界: cleanupの最小best-effort化と回帰テストのみ。transaction、rollback、再試行保証は追加しない。

### F4-shared-boundary-ownership

- 不変条件: 汎用shared層はGitHub固有規則やinteractive固有の観測名を所有しない。
- 証拠: [githubAttachmentUrl.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/githubAttachmentUrl.ts:1) がGitHub固有規則を保持し、[imageAttachmentStore.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageAttachmentStore.ts:23) は汎用化後も `pasted` エラーと `interactive` ログ分類を残している。
- 受入条件: GitHub URL規則はGitHub境界の内部所有となり、共有storeのエラー・ログは画像添付一般の意味になる。
- 修正境界: 今回追加・移動したURL判定とstore命名のみ。shared全体の再編成や公開API拡張は除外する。

### F5-github-auth-host-binding

- 不変条件: 認証トークンを取得したホストとHTTP送信先を一致させる。
- 証拠: [prImageDownload.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/github/prImageDownload.ts:38) は `gh auth token` のホストを指定せず、許可URLは `github.com` 固定である。ローカルの `gh auth token --help` でも、未指定時はdefault hostを選ぶ契約を確認した。
- 受入条件: `github.com`向け取得では同ホスト用トークンを明示的に選択し、Enterpriseがdefault hostでも別ホストの資格情報をAuthorizationへ渡さない。
- 修正境界: 現在許可される `github.com` 境界への明示的な結び付けのみ。GitHub Enterprise URL対応の新設は除外する。

### F6-markdown-image-semantics

- 不変条件: Markdown上で実際に画像として解釈される参照だけを取得・置換する。
- 証拠: [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:21) は本文全体へ正規表現を適用するため、コードフェンス、inline code、HTMLコメント内の例示も一致する。
- 受入条件: 通常のMarkdown画像とHTML `<img>` は処理し、コードフェンス、inline code、HTMLコメント内の記法は原文のまま残して取得しない。
- 修正境界: 対象画像構文の意味判定だけ。Markdown全般の変換器やレンダラーの新設は要求しない。

### F7-pr-image-production-dataflow-test

- 不変条件: 抽出、store、task保存／task spec staging間の本番配線を、内部モックの組み合わせだけで証明した扱いにしない。
- 証拠: [addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts:301) は準備済みattachmentを返し、[pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/pipelineExecution.test.ts:1345) は画像準備、task spec生成、resolverをすべてモックする。
- 受入条件: 外部GitHub取得とagent境界のみを置換し、実store・保存／stagingを通して画像ファイル、書換済み`order.md`、実行コンテキスト参照を観測する分類済み軽量ITがある。
- 修正境界: 実GitHub資格情報を使うE2Eや全workflow engine実行は除外する。

### F8-pr-image-owner-failure-tests

- 不変条件: PR画像の各所有者は、後続処理が例外終了しても一時画像を1回解放し、元例外を維持する。
- 証拠: 実装には [add/index.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/add/index.ts:207) と [routing.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:120) の `finally` があるが、PR画像準備後の保存・実行例外を直接検証するテストがない。
- 受入条件: addの保存失敗とPR routingの実行または保存失敗について、cleanupが1回呼ばれ、元例外と永続状態が保持される。
- 修正境界: 既存所有者の代表的な例外経路テストのみ。OS削除障害の網羅や新しいcleanup保証は除外する。

## 後工程への指示

- 修正計画へ渡すのは上記8 familyのみ。
- `SEC-001` の件数・累積容量制限は、要求変更などの新しい証拠がない限り除外する。
- 再計画は不要。
- この裁定ステップでは編集および実行ゲートの再実行は行っていない。