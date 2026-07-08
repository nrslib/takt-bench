# タスク計画

## 元の要求

PR コメント内の画像をダウンロードして task attachments に配置する機能を実装する。

期待する挙動:
- `takt add --pr <number>` 実行時に、PR 本文・通常コメント・review thread コメント内の画像 URL を検出する
- 対応画像をローカルにダウンロードする
- `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する
- `order.md` に既存 attachment 形式で追記する
- 元コメント本文内の画像参照も、可能なら `[Image #1]` のように参照できる形に置換または補足する
- pipeline の `--pr` 経路でも同等に画像を参照できること
- 対象画像記法は Markdown image syntax と HTML `<img src="...">`
- 対応形式は PNG/JPEG/GIF/WebP
- Content-Type と magic bytes を検証する
- サイズ上限を設ける
- GitHub private repository 画像に対応するため、`gh api` または認証済み `gh` 経由の取得を優先する
- 外部 URL を無制限に取得しない
- 新規ロジックには単体テストを追加する
- `npm run build`、`npm run lint`、`npm test` が全て成功すること

## 分析結果

### 目的

PR 本文・通常コメント・review summary・review thread コメントに含まれる GitHub 添付画像を、既存 task attachment 形式へ変換し、`add --pr`、interactive `--pr`、pipeline `--pr` の全経路で `[Image #n]` と `attachments/image-n.ext` を参照できる状態にする。

Previous Response では「完全に機能している」と判断されていたが、現在のコードは未収束。URL 抽出・認証付きダウンロード・Content-Type/magic bytes/サイズ検証の core logic は存在する一方、pipeline staging、interactive attachment 重複、URL 抽出順、redirect allowlist、失敗時 cleanup、テスト mock 契約に修正が必要。

確認済みの対象テスト結果:
`npm test -- --run src/__tests__/prReviewImageAttachments.test.ts src/__tests__/pipelineExecution.test.ts src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts`

結果:
4 ファイル中 4 ファイル失敗、105 件中 11 件失敗。

### 分解した要件

| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | PR 本文から画像 URL を抽出する | 明示 | 実装はあるが、抽出順修正が必要。`src/features/tasks/prReviewImageAttachments.ts:144-155` |
| 2 | 通常コメントから画像 URL を抽出する | 明示 | Markdown と HTML の統合順序が必要。`src/features/tasks/prReviewImageAttachments.ts:54-64` |
| 3 | review summary から画像 URL を抽出する | 明示 | `reviews[].body` が対象。順序修正が必要。`src/features/tasks/prReviewImageAttachments.ts:147` |
| 4 | review thread コメントから画像 URL を抽出する | 明示 | PR 取得層で thread comments は `reviews` に含まれる。`src/infra/github/pr.ts:432`, `src/infra/github/pr.ts:445` |
| 5 | Markdown image syntax を対象にする | 明示 | 実装済み。`src/features/tasks/prReviewImageAttachments.ts:54` |
| 6 | HTML `<img src="...">` を対象にする | 明示 | 実装済み。`src/features/tasks/prReviewImageAttachments.ts:64` |
| 7 | GitHub attachment URL のみ取得する | 明示 | redirect 後 URL の許可が広すぎるため修正要。`src/features/tasks/prReviewImageAttachments.ts:101-103` |
| 8 | PNG を許可する | 明示 | 実装済み。`src/shared/utils/imageData.ts:4`, `src/shared/utils/imageData.ts:16` |
| 9 | JPEG を許可する | 明示 | 実装済み。`src/shared/utils/imageData.ts:4`, `src/shared/utils/imageData.ts:19` |
| 10 | GIF を許可する | 明示 | 実装済み。`src/shared/utils/imageData.ts:4`, `src/shared/utils/imageData.ts:22` |
| 11 | WebP を許可する | 明示 | 実装済み。`src/shared/utils/imageData.ts:4`, `src/shared/utils/imageData.ts:28` |
| 12 | Content-Type を検証する | 明示 | 実装済み。`src/shared/utils/imageData.ts:55-64` |
| 13 | magic bytes を検証する | 明示 | 実装済み。`src/shared/utils/imageData.ts:66-73` |
| 14 | サイズ上限を設ける | 明示 | 実装済み。`src/shared/utils/imageData.ts:7`, `src/shared/utils/imageData.ts:76-87` |
| 15 | 認証済み `gh` 経由で private repo 画像に対応する | 明示 | 実装済み。`src/features/tasks/prReviewImageAttachments.ts:84`, `src/features/tasks/prReviewImageAttachments.ts:89-95` |
| 16 | `TaskAttachment[]` に変換する | 明示 | 実装はあるが、契約外 `sourceUrl` を返しているため修正要。`src/shared/types/image-attachments.ts:1-5`, `src/features/tasks/prReviewImageAttachments.ts:199-204` |
| 17 | `.takt/tasks/<slug>/attachments/` に保存する | 明示 | `add --pr` は既存経路で可能。pipeline は未配線。`src/features/tasks/attachments.ts:138-153` |
| 18 | `order.md` に `## 添付画像` を追記する | 明示 | 既存処理あり。`src/features/tasks/attachments.ts:26-44` |
| 19 | 元本文中の画像参照を `[Image #n]` に置換する | 明示 | 実装はあるが、旧 `rewrittenTaskContent` 生成が残っているため整理要。`src/features/tasks/prReviewImageAttachments.ts:163-197`, `src/features/tasks/prReviewImageAttachments.ts:218-255` |
| 20 | `takt add --pr` で attachment を保存する | 明示 | 実装はあるが、テスト mock が旧契約で失敗中。`src/features/tasks/add/index.ts:199-226` |
| 21 | `takt --pr` interactive seed に attachments を渡す | 暗黙 | 実装済み。ただし空配列を渡すため一部テスト期待とずれる。`src/app/cli/routing.ts:190-195` |
| 22 | interactive execute path で attachment を重複させない | 暗黙 | 修正要。初期 attachments が result に含まれるのに再追加している。`src/app/cli/routing.ts:269-274`, `src/features/interactive/imageAttachments.ts:135-160` |
| 23 | pipeline `--pr` で attachment 付き task spec を使う | 明示 | 修正要。`TaskContent.attachments` は返るが `execute.ts` で使われていない。`src/features/pipeline/steps.ts:172-178`, `src/features/pipeline/execute.ts:33-52` |
| 24 | temp cleanup を失敗時にも行う | 暗黙 | 修正要。後続画像 validation 失敗時に `.takt/tmp/image-attachments` が残る。`src/features/tasks/prReviewImageAttachments.ts:157-161`, `src/features/tasks/prReviewImageAttachments.ts:206-215` |
| 25 | 新規ロジックに単体テストを追加する | 明示 | テストは存在するが失敗中 |
| 26 | `npm run build` が成功する | 明示 | 未確認。対象テスト失敗を先に解消する |
| 27 | `npm run lint` が成功する | 明示 | 未確認。対象テスト失敗を先に解消する |
| 28 | `npm test` が成功する | 明示 | 修正要。対象テストで 11 件失敗 |

暗黙要件の根拠:
- #21 は「`takt --pr` でも PR コメント本文が取得される」「元コメント本文内の画像参照も参照できる形にする」から直接導ける。
- #22 は、同じ attachment を重複保存・重複参照すると「同等に画像を参照できる」状態を壊すため。
- #24 は、形式・サイズ検証に失敗した画像をローカル成果物として残さないため。

### 参照資料の調査結果

参照先として明示された `src/infra/github/pr.ts` を確認した。

- `fetchPrReviewComments()` は `gh pr view` で PR 本文・通常コメント・review summary を取得する。`src/infra/github/pr.ts:421-430`
- review thread は GraphQL で取得し、thread comments を `reviews` に追加している。`src/infra/github/pr.ts:366-397`, `src/infra/github/pr.ts:432`, `src/infra/github/pr.ts:445`
- `PrReviewData` には `body`, `comments`, `reviews`, `files` が含まれる。`src/infra/git/types.ts:90-100`
- `formatPrReviewAsTask()` は PR task markdown の単一の整形責務を持つ。`src/infra/git/format.ts:197-260`

判断:
`src/infra/github/pr.ts` は PR データ取得の source of truth であり、画像ダウンロードや task attachment 生成を追加する場所ではない。Knowledge の「責務分離」「パブリック API はドメイン操作のみ」「インフラ層の詳細を公開 API から出さない」に照らし、画像 attachment 生成は `features/tasks` 側に置く。

### スコープ

変更対象:

- `src/features/tasks/prReviewImageAttachments.ts`
- `src/shared/utils/imageData.ts`
- `src/features/tasks/add/index.ts`
- `src/app/cli/routing-inputs.ts`
- `src/app/cli/routing.ts`
- `src/features/pipeline/execute.ts`
- 必要に応じて `src/features/pipeline/steps.ts`
- `src/__tests__/prReviewImageAttachments.test.ts`
- `src/__tests__/imageData.test.ts`
- `src/__tests__/addTask.test.ts`
- `src/__tests__/cli-routing-pr-resolve.test.ts`
- `src/__tests__/pipelineExecution.test.ts`

参照すべき既存実装:

- task attachment 保存: `src/features/tasks/attachments.ts:138-153`
- task spec staging: `src/features/tasks/execute/taskSpecContext.ts:56-85`
- direct execute での staging 実装: `src/features/tasks/execute/selectAndExecute.ts:113-119`, `src/features/tasks/execute/selectAndExecute.ts:143-155`
- interactive 初期 attachments の保持: `src/features/interactive/imageAttachments.ts:135-160`
- PR task formatting: `src/infra/git/format.ts:197-260`

### 検討したアプローチ

| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/infra/github/pr.ts` に画像ダウンロード処理を追加する | 不採用 | PR 取得層に attachment 生成・画像検証・ファイル IO が混ざる |
| `src/features/tasks/prReviewImageAttachments.ts` に PR 画像 attachment 操作を集約する | 採用 | PR 取得後の `PrReviewData` を task attachment へ変換する責務として自然 |
| Markdown と HTML img を別々に全走査してから結合する | 不採用 | 現在の失敗通り、本文上の出現順が崩れる |
| Markdown と HTML img を同一 scanner で document order に抽出する | 採用 | `[Image #n]` と `image-n.ext` の順序が本文出現順と一致する |
| helper が整形済み task markdown を返す | 不採用 | `formatPrReviewAsTask()` と責務が重複する |
| helper が `rewrittenPrReview` と `attachments` を返す | 採用 | 現在の方向性を維持し、PR task formatter を一度だけ使う |
| pipeline で `TaskContent.attachments` を無視する | 不採用 | `--pr` pipeline で画像参照できない |
| pipeline で `prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` を使う | 採用 | 既存 direct execution の attachment 実行経路と整合する |

### 実装アプローチ

1. `preparePrReviewImageAttachments()` の責務を整理する。
   - 旧 `rewrittenTaskContent` 生成ブロック `src/features/tasks/prReviewImageAttachments.ts:163-197` を削除する。
   - 戻り値は `rewrittenPrReview`, `attachments`, `cleanupAttachments` に統一する。
   - `TaskAttachment` 返却値から契約外の `sourceUrl` を除く。

2. URL 抽出順を修正する。
   - Markdown image と HTML img を同一の出現順で抽出する。
   - 同じ URL は最初の出現位置で dedupe する。
   - 現在の失敗 `Conversation image [Image #3]` を `[Image #2]` に直す。

3. URL allowlist を厳密化する。
   - 入力 URL と redirect 後 URL の両方に `isGitHubImageAttachmentUrl()` を適用する。
   - 現在の `responseUrl.startsWith('https://github.com')` は削除する。
   - `https://github.com.evil.example/...` を拒否するテストを通す。

4. temp directory と cleanup を修正する。
   - `createTempImageDir()` は固定 `.takt/tmp/image-attachments` ではなく一意なディレクトリを返す。
   - 画像 URL が 0 件の場合は不要な temp dir を作らないか、cleanup で空の親も残らないようにする。
   - 複数画像の途中で validation に失敗した場合、作成済み temp dir を必ず削除する。

5. `add --pr` 経路を新契約に合わせる。
   - `preparePrReviewImageAttachments()` の mock を含め、`taskContent` 旧契約を `rewrittenPrReview` に更新する。
   - `formatPrReviewAsTask(imageAttachmentsResult.rewrittenPrReview)` を一度だけ呼ぶ。

6. `takt --pr` interactive 経路の attachment 重複を解消する。
   - `src/app/cli/routing.ts:269-274` の二重代入を修正し、`result.attachments` があればそれだけを渡す。
   - `result.attachments` がない場合のみ、必要なら `prAttachments` を fallback として渡す。

7. pipeline `--pr` の attachment staging を実装する。
   - `runPipeline()` で `taskContent.attachments` が空でない場合、`prepareTaskSpecDirectory(cwd, taskContent.task, taskContent.attachments)` を呼ぶ。
   - `generateExecutionReportDir()` で report dir を決める。
   - `stageTaskSpecForExecution(cwd, context.execCwd, preparedSpec.taskDirRelative, reportDirName)` を呼ぶ。
   - `runWorkflow()` には `stagedSpec.taskPrompt` と `reportDirName` を渡す。
   - `finally` で `cleanupStagedTaskSpec()`, `cleanupPreparedTaskSpec()`, `taskContent.cleanupAttachments()` を必ず呼ぶ。
   - 既存 `selectAndExecuteTask()` の実装 `src/features/tasks/execute/selectAndExecute.ts:113-119` と同じ構造を踏襲する。

8. テストを現在の契約へ揃える。
   - `addTask.test.ts:331` の旧 `taskContent` mock を `rewrittenPrReview` に変更する。
   - `cli-routing-pr-resolve.test.ts` の期待値は、空配列 attachments を seed に含めるかどうかを実装と統一する。
   - `cli-routing-pr-resolve.test.ts:383-410` の重複防止テストを通す。
   - `pipelineExecution.test.ts:388-461` の staging 期待を通す。
   - `prReviewImageAttachments.test.ts:114-166`, `:248-278` の順序・redirect・cleanup を通す。

9. 検証する。
   - まず対象テストを再実行する。
   - その後 `npm run build`、`npm run lint`、`npm test` を実行する。

### 到達経路・起動条件

| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、pipeline mode の `--pr <number>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/execute.ts`、必要に応じて `src/features/pipeline/steps.ts` |
| 起動条件 | PR 入力が指定され、PR 本文・通常コメント・review summary・review thread コメントに GitHub attachment URL が含まれること |
| 認証条件 | `gh auth token` が取得できること |
| URL 条件 | `https://github.com/user-attachments/assets/...` または `https://github.com/{owner}/{repo}/assets/...` |
| 未対応項目 | 現在の pipeline execution は attachments を stage していない。現在の interactive execute path は PR attachments を二重追加し得る |

## Disputed Findings

### F-0001

- findingId: F-0001
- reason: Finding の「core image downloading logic is missing」は現在のコードとは一致しない。PR コメント画像の URL 抽出・認証付き fetch・Content-Type/magic bytes/サイズ検証・`TaskAttachment[]` 生成は `src/features/tasks/prReviewImageAttachments.ts` と `src/shared/utils/imageData.ts` に実装済み。`src/infra/github/pr.ts` は PR 取得責務に限定する設計が妥当。ただし、実装は未収束であり、pipeline staging、interactive 重複、URL 順序、redirect allowlist、cleanup、テスト契約の修正は必要。
- evidence:
  - `src/features/tasks/prReviewImageAttachments.ts:50` 画像 URL 抽出関数
  - `src/features/tasks/prReviewImageAttachments.ts:54` Markdown image syntax 抽出
  - `src/features/tasks/prReviewImageAttachments.ts:64` HTML img 抽出
  - `src/features/tasks/prReviewImageAttachments.ts:76` 画像ダウンロード関数
  - `src/features/tasks/prReviewImageAttachments.ts:84` `gh auth token` による認証情報取得
  - `src/features/tasks/prReviewImageAttachments.ts:89-95` 認証付き fetch
  - `src/features/tasks/prReviewImageAttachments.ts:107-113` Content-Type、Content-Length、magic bytes 検証への接続
  - `src/shared/utils/imageData.ts:55-73` Content-Type と magic bytes の検証
  - `src/shared/utils/imageData.ts:76-87` サイズ上限検証
  - `src/features/tasks/prReviewImageAttachments.ts:199-204` `TaskAttachment[]` 生成
  - `src/features/tasks/add/index.ts:199-226` `add --pr` 経路への配線
  - `src/app/cli/routing-inputs.ts:71-81` `takt --pr` 経路への配線
  - `src/features/pipeline/steps.ts:163-178` pipeline PR 入力解決への配線

## 実装ガイドライン

- PR 取得層 `src/infra/github/pr.ts` には画像ダウンロード処理を追加しない。`fetchPrReviewComments()` は `PrReviewData` を返す責務に留める。
- PR 画像 attachment 操作は `src/features/tasks/prReviewImageAttachments.ts` に集約する。呼び出し元が個別に fetch・検証・copy を行う構造にしない。
- PR task markdown の生成は `formatPrReviewAsTask()` に任せる。helper 内で PR body/comments/reviews を task markdown へ手動連結しない。
- `TaskAttachment` は `StoredImageAttachment` 契約、つまり `placeholder`, `tempPath`, `fileName` のみを外へ返す。
- document order を保つため、Markdown と HTML img を別々に抽出して結合しない。
- redirect 後 URL の許可は明示 allowlist のみとし、host 文字列の前方一致で許可しない。
- pipeline の staging は `selectAndExecuteTask()` の既存実装を参照する。具体的には `prepareTaskSpecDirectory()`、`stageTaskSpecForExecution()`、`cleanupStagedTaskSpec()`、`cleanupPreparedTaskSpec()` を使う。
- cleanup は成功時・失敗時・早期 return 時で漏れないように `try/finally` に寄せる。
- 空 attachments は可能なら `undefined` として扱い、空配列を seed/options に広げるかどうかをテストと実装で統一する。
- テスト mock は新契約 `rewrittenPrReview` に統一し、旧 `taskContent` 契約を残さない。
- 検証は、対象テストの再実行後に `npm run build`、`npm run lint`、`npm test` の順に行う。

## スコープ外

| 項目 | 除外理由 |
|------|---------|
| GitHub 以外の外部画像 URL 取得 | 安全性制約で GitHub attachment URL から始める指定のため |
| SVG など画像形式の追加 | 対応形式は PNG/JPEG/GIF/WebP と明示されているため |
| 画像以外の添付ファイル対応 | ユーザー要求が PR コメント内の画像に限定されているため |
| `src/infra/github/pr.ts` への画像ダウンロード処理追加 | PR 取得責務を超え、Knowledge の責務分離に反するため |
| 既存 PR 取得 GraphQL pagination の再設計 | 今回の要求は取得済み `PrReviewData` からの画像 attachment 化であり、PR 取得仕様の変更ではないため |

## 確認事項

なし。