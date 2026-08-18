まず指定された正本（`context/task/order.md`）、全文の Knowledge / Policy、レポート履歴を読み、要求・制約・既存実装の差分を確認します。今回は plan ステップのため、ソースやテストは変更しません。
要求は、PR 本文・通常コメント・review thread の画像を一つの attachment 契約へ収束させ、`add --pr` と pipeline の両入口から保存・参照まで到達させる変更です。次に、既存の PR 取得、attachment 保存、pipeline 直実行、テストの実在経路をコードで追跡します。
既存経路を確認しました。重要な境界は、GitHub の PR 取得結果を共通の `PrReviewData.attachments` に集約し、既存の `buildTaskOrderContent` / `prepareTaskSpecDirectory` / run-context staging を再利用することです。なお system-step の PR 取得も同じ provider を使うため、画像取得を明示 opt-in にして既存経路へ副作用を持ち込まない設計にします。
## 計画

PR 取得結果を `PrReviewData.attachments` に集約し、既存の task attachment 機構へ接続します。`add --pr`、通常の `--pr`、pipeline の `--pr` が同じ attachment 経路を利用します。

レポート履歴は空でした。指定された `order.md`、Knowledge、Policy は全文確認済みです。ソースコードは未変更です。

### 変更契約

| 契約 | 根拠 | 完了証拠 |
|---|---|---|
| PR 本文・通常コメント・review summary・review thread から対象画像を抽出し、検証済み attachment にする | `order.md:11-12`, `25-45` | GitHub attachment 抽出・検証テスト |
| `add --pr` で `.takt/tasks/<slug>/attachments/` と `order.md` を生成する | `order.md:7`, `13-22`, `46` | `addTask.test.ts` |
| 元本文を `[Image #N]` で参照可能にする | `order.md:22` | formatter テスト、task spec テスト |
| pipeline の `--pr` でも run context へ画像を渡す | `order.md:23`, `47` | pipeline 実行引数・task spec テスト |
| PNG/JPEG/GIF/WebP、Content-Type、magic bytes、サイズ上限、GitHub URL 制限を守る | `order.md:35-39` | attachment downloader の単体テスト |
| build / lint / unit test を成功させる | `order.md:50-53` | 各コマンドの実行結果 |

### 実装方針

1. `src/infra/git/types.ts:107-141`

   `PrReviewAttachment` と、attachment 取得を opt-in にする `FetchPrReviewOptions` を追加します。

   `PrReviewData` には以下を任意で追加します。

   - `attachments`
   - `cleanupAttachments`
   
   既存の system-step や GitLab 経路は既定値を `includeAttachments: false` とし、不要な一時ファイルを生成しません。

2. 新規 `src/infra/github/pr-attachments.ts`

   GitHub 固有の画像抽出・取得責務を分離します。

   - Markdown の `![alt](https://github.com/...)`
   - HTML の `<img src="https://github.com/...">`
   - GitHub の許可された attachment URL のみ対象
   - URL を抽出順に重複排除
   - `gh api --include` または認証済み `gh` 経由でバイナリ取得
   - Content-Type と magic bytes の一致を検証
   - PNG/JPEG/GIF/WebP 以外を拒否
   - 既存の画像 attachment と同等の 10 MiB 上限を適用
   - private repository 対応のため `fetch` で直接外部取得しない
   - 一時ディレクトリ・ファイルを private 属性で作成
   -取得失敗や検証不一致時は未検証データを渡さずエラーにする
   - cleanup は冪等に実行できるようにする

3. `src/infra/github/pr.ts:421-457`

   `fetchPrReviewComments()` に `includeAttachments` を追加し、以下の順で本文を抽出対象にします。

   1. PR body
   2. 通常コメント
   3. review summary
   4. review thread comments

   `includeAttachments: true` の場合だけ downloader を呼び、`PrReviewData` に attachment を設定します。

4. `src/infra/git/format.ts:148-260`

   `PrReviewAttachment.sourceUrl` と placeholder の対応を使い、画像構文全体または URL を `[Image #N]` に置換します。

   画像なしの既存 `PrReviewData` は従来どおり出力します。attachment のパス追記は既存の `buildTaskOrderContent()` に委ねます。

5. `src/features/tasks/add/index.ts:180-213`

   `fetchPrReviewComments(..., { includeAttachments: true })` を使用し、`saveTaskFile()` に attachment を渡します。

   cleanup は以下を含む全経路で実行します。

   - 保存成功
   - 保存失敗
   - workflow 選択キャンセル
   - PR に通常コメントがなく、画像だけがある場合
   - 既存の「コメントも対象画像もない PR は作成しない」動作

   PR body に対象画像がある場合は、コメントがなくても task を作成できるようにします。本文だけで対象画像がない場合は、既存の拒否動作を維持します。

6. `src/app/cli/routing-inputs.ts:50-70`、`src/app/cli/routing.ts:118-337`

   通常の `takt --pr` でも attachment を取得します。

   - `InteractiveSeedInput.attachments` に初期 attachment を渡す
   - assistant / quiet / persona の会話中も `[Image #N]` を解決可能にする
   - execute / save_task の両方へ attachment を伝播する
   - モードキャンセル、dispatch 失敗、通常終了を含めて cleanup する
   - 既存のユーザー貼り付け画像は保持し、PR 画像の後続番号を使う

7. `src/features/pipeline/steps.ts:213-229,334-374`

   pipeline の PR 取得結果に attachment を保持し、`runWorkflow()` へ渡します。

   attachment がある場合は既存の以下を再利用します。

   - `prepareTaskSpecDirectory()`
   - `resolveTaskSpecForExecution()`
   - `stageTaskSpecForExecution()`

   これにより、pipeline でも `order.md` の添付画像節と `.takt/runs/.../context/task/attachments/` が生成されます。pipeline 用の一時 task spec は実行後に削除し、run context は既存の実行成果物として保持します。

### Contract family

同一 family は「GitHub PR 画像を、検証済み attachment として各実行入口の終端 consumer まで届ける契約」です。

`GitHub PR provider / PrReviewData 定義`  
→ `gh pr view・GraphQL が本文を生成`  
→ `画像構文抽出・GitHub URL allowlist・重複排除・Content-Type/magic bytes/サイズ検証`  
→ `一時ファイルを PrReviewAttachment に変換`  
→ `formatPrReviewAsTask`、`saveTaskFile`、pipeline の task spec へ転送  
→ `promoteTaskAttachments` / `stageTaskSpecForExecution`  
→ task の `order.md` と run context の画像ファイル  
→ agent が `[Image #N]` を参照

- `participates`: GitHub PR 取得、PR formatter、`add --pr`、通常 `--pr`、pipeline `--pr`
- `preserved`: `src/features/tasks/attachments.ts` の既存保存・manifest・symlink 検証、system-step の PR metadata 取得、GitLab の既存 PR/MR 取得、issue/task 経路
- `outside`: PR 作成・merge、非 PR の画像取得、外部 URL の一般ダウンロード

### 要求シナリオ

- 対象例: PR body の Markdown、通常コメントの repository asset、review summary の HTML `<img>`、thread comment の同一 URLを含む。
  - 同一 URL は一つの attachment に集約する。
  - `[Image #1]` から順番に採番する。
  - `order.md` と run context の両方から参照できる。

- 非対象例: code fence 内の画像記法、inline code、通常リンク、閉じていない Markdown、`https://example.com/...` などの外部 URL。
  - ダウンロードせず、許可されていない URL を外部取得しない。

- 識別子衝突例: PR 画像と会話中に貼られた画像が同時に存在する。
  - PR 画像を先に採番し、ユーザー画像は次の番号から採番する。
  - 同一 URL の重複ではファイル・placeholder を増やさない。
  - 既存 attachment 保存機構の destination collision 検証は維持する。

### テスト計画

- `src/__tests__/github-pr-attachments.test.ts`
  - Markdown / HTML 抽出
  - code fence・外部 URL・不正構文の除外
  - URL 重複排除
  - Content-Type / magic bytes / サイズ上限
  - `gh api` 呼び出しと cleanup

- `src/__tests__/github-pr.test.ts`
  - PR body、comments、reviews、thread comments 全体からの取得
  - `includeAttachments` 未指定時は既存経路を維持

- `src/__tests__/git-format.test.ts`
  -画像 URL の placeholder 置換
  - attachment なしの既存出力保持

- `src/__tests__/addTask.test.ts`
  - attachment の task directory 配置
  - `order.md` の `## 添付画像`
  - PR body の画像だけで task を作成
  - cleanup

- `src/__tests__/cli-routing-pr-resolve.test.ts`
  - interactive seed への attachment 伝播
  - execute / save_task への伝播
  - cancel / 失敗時の cleanup

- `src/__tests__/pipelineExecution.test.ts` または `pipeline-steps.test.ts`
  - pipeline の `executeTask()` に attachment 付き task spec と `reportDirName` が渡ること
  - staged order と run context 参照の維持

既存の `src/features/tasks/attachments.ts:35-53,266-280`、`src/features/tasks/execute/taskSpecContext.ts:57-104` は変更せず、直接テストで既存契約を利用します。

### 検証コマンド

実装後に以下を実行します。

```bash
npm run build
npm run lint
npm test
npm run test:it
npm run test:e2e:mock
```

Plan ステップでは編集・テスト実行は行っていません。