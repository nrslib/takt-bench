# タスク計画

## 元の要求
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

背景:
現状、`takt add --pr` や `takt --pr` では PR 本文・通常コメント・review thread の本文は取得されるが、コメント内に貼られた PNG などの画像はローカルの `attachments/` に保存されない。

既存の task attachment 仕組みはあるため、PR コメント中の画像 URL を抽出して `TaskAttachment[]` として渡せば、`.takt/tasks/<slug>/attachments/` 配下に配置できるはず。

期待する挙動:
- `takt add --pr <number>` 実行時に、PR 本文・通常コメント・review thread コメント内の画像 URL を検出する
- 対応画像をローカルにダウンロードする
- `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する
- `order.md` に既存 attachment 形式で追記する

```md
## 添付画像

- [Image #1]: `attachments/image-1.png`
```

- 元コメント本文内の画像参照も、可能なら `[Image #1]` のように参照できる形に置換または補足する
- pipeline の `--pr` 経路でも同等に画像を参照できること

対象とする画像記法の例:
```md
![screenshot](https://github.com/user-attachments/assets/...)
![image](https://github.com/org/repo/assets/...)
<img src="https://github.com/user-attachments/assets/..." />
```

安全性・制約:
- 対応形式はまず PNG/JPEG/GIF/WebP
- Content-Type と magic bytes を検証する
- サイズ上限を設ける
- GitHub の private repository 画像に対応するため、`gh api` または認証済み `gh` 経由の取得を優先する
- 外部 URL を無制限に取得しない。GitHub attachment URL から始めるのが安全

参考（実装方針案）:
- PR 取得後の `PrReviewData` から画像 URL を抽出する（PR body / conversation comments / review summaries / review thread comments）
- Markdown image syntax と HTML `<img src="...">` を対象にする
- ダウンロードした画像を `TaskAttachment[]` に変換する
- `saveTaskFile()` / `prepareTaskSpecDirectory()` に渡す
- pipeline 直実行時も attachment 付き task spec を使う経路を追加する
- PR 取得の既存実装は `src/infra/github/pr.ts` にある

品質要件:
- 既存のテスト規約に従い、新規ロジックには単体テストを追加する
- `npm run build`、`npm run lint`、`npm test` が全て成功すること

## 分析結果

### 目的
PR 本文・通常コメント・review summary・review thread comment に貼られた GitHub attachment 画像を、安全に取得して既存の task attachment 形式へ変換し、`takt add --pr`、`takt --pr`、pipeline `--pr` の各経路で画像を参照できる状態にする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | PR body から Markdown 画像 URL を抽出する | 明示 | `PrReviewData.body` が対象 |
| 2 | conversation comments から Markdown 画像 URL を抽出する | 明示 | `PrReviewData.comments[].body` が対象 |
| 3 | review summaries から Markdown 画像 URL を抽出する | 明示 | `PrReviewData.reviews[]` のうち `threadState` なし・`path` なしの body が対象 |
| 4 | review thread comments から Markdown 画像 URL を抽出する | 明示 | `PrReviewData.reviews[].body` 全体を走査すれば thread comment も含められる |
| 5 | HTML `<img src="...">` から画像 URL を抽出する | 明示 | Markdown image と別条件 |
| 6 | 抽出対象 URL を GitHub attachment 系に限定する | 明示 | 外部 URL の無制限取得を避ける |
| 7 | 画像を認証済み `gh` 経由の token を使って取得する | 明示 | `gh api` は GitHub API endpoint 用で attachment asset URL には直接適さないため、`gh auth token` + Node `https` が現実的 |
| 8 | Content-Type が PNG/JPEG/GIF/WebP のいずれかであることを検証する | 明示 | `image/png`, `image/jpeg`, `image/gif`, `image/webp` |
| 9 | magic bytes が PNG/JPEG/GIF/WebP のいずれかであることを検証する | 明示 | 既存 inline image の判定ロジックを共有化する |
| 10 | Content-Type と magic bytes の種類が一致することを検証する | 暗黙 | 明示要求「Content-Type と magic bytes を検証する」から直接導出 |
| 11 | 画像サイズ上限を設ける | 明示 | 既存 inline/clipboard image と同じ 10MiB を使うのが自然 |
| 12 | ダウンロード画像を `TaskAttachment[]` に変換する | 明示 | `placeholder`, `tempPath`, `fileName` が必要 |
| 13 | `takt add --pr` 保存時に attachments を渡す | 明示 | 既存 `saveTaskFile()` は attachments を受け取れる |
| 14 | `order.md` に `## 添付画像` と attachment 行を出す | 明示 | 既存 `buildTaskOrderContent()` を再利用する |
| 15 | `.takt/tasks/<slug>/attachments/` に画像ファイルを配置する | 明示 | 既存 `promoteTaskAttachments()` を再利用する |
| 16 | 元コメント本文内の画像記法を `[Image #N]` へ置換する | 明示 | 「可能なら」に対して実装可能 |
| 17 | pipeline `--pr` でも attachment 付き task spec を使う | 明示 | 現状 pipeline は `executeTask` に task text を直渡ししているため配線追加が必要 |
| 18 | `takt --pr` interactive seed に PR attachment を渡す | 暗黙 | 利用者向け `takt --pr` 経路でも画像参照可能にするため |
| 19 | 一時保存した画像を成功・失敗・キャンセル時に cleanup する | 暗黙 | ダウンロード実装で temp file を作るため直接必要 |
| 20 | 新規ロジックに単体テストを追加する | 明示 | 抽出、検証、配線を対象にする |
| 21 | `npm run build`、`npm run lint`、`npm test` を成功させる | 明示 | 実装後の検証 |

### 参照資料の調査結果（参照資料がある場合）
タスク指示書に独立した「参照資料」セクションは存在しない。実装方針案で明示された `src/infra/github/pr.ts` を参照対象として確認した。

- `src/infra/github/pr.ts:421` の `fetchPrReviewComments()` は `gh pr view --json number,title,body,url,headRefName,baseRefName,comments,reviews,files` で PR 本文・通常コメント・review summary を取得し、GraphQL で review thread comments を追加して `PrReviewData` を返している。
- `src/infra/github/pr.ts:434` で conversation comments を `{ author, body }` に変換している。
- `src/infra/github/pr.ts:439` で review body を reviews に追加し、`src/infra/github/pr.ts:445` で thread review comments を reviews に追加している。
- `src/features/tasks/add/index.ts:199` で PR review data を `formatPrReviewAsTask(prReview)` に変換しているが、`src/features/tasks/add/index.ts:213` の `saveTaskFile()` 呼び出しには attachments が渡されていない。
- `src/features/tasks/add/index.ts:39` の `saveTaskFile()` は `attachments` を受け取り、`prepareTaskSpecDirectory()` に渡せる。
- `src/features/tasks/attachments.ts:28` の `buildTaskOrderContent()` は attachments がある場合に `## 添付画像` と `- [Image #N]: \`attachments/image-N.ext\`` を追記する。
- `src/features/tasks/attachments.ts:79` の `promoteTaskAttachments()` は tempPath から `.takt/tasks/<slug>/attachments/` へコピーする。
- `src/features/pipeline/steps.ts:144` の `resolveTaskContent()` は pipeline `--pr` で task text と PR branch/base branch だけを返している。
- `src/features/pipeline/steps.ts:229` の `runWorkflow()` は `executeTask()` へ task text を直渡ししており、attachment 付き task spec を作っていない。
- `src/features/tasks/execute/selectAndExecute.ts:113` には attachments がある場合に `prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` を使う既存パターンがある。
- `src/features/tasks/execute/taskSpecContext.ts:56` の `stageTaskSpecForExecution()` は `attachments/` パスを run context 側へ書き換え、画像を run context にコピーする。
- `src/features/interactive/inlineImagePaste.ts:45` 以降に PNG/JPEG/GIF/WebP の magic bytes 判定があるが private 関数である。
- `src/features/interactive/inlineImagePaste.ts:9` で既存画像上限は 10MiB。
- `gh api --help` の確認結果では、`gh api` の endpoint argument は GitHub API v3 path または `graphql` 用であり、`https://github.com/user-attachments/assets/...` のような asset URL の直接取得には適さない。

Knowledge 原本 `.takt/runs/20260707-113925-pr-task-attachments-takt-add-p/context/knowledge/plan.1.20260707T113925Z.md` も確認した。今回の設計では、1モジュール1責務、読み取り/書き込み責務の分離、境界での正規化、操作の一覧性、巨大化した `utils` への安易な追加禁止を適用する。

### スコープ
影響範囲は以下。

- PR review data から attachment 付き task へ変換する新規 feature 層モジュール
- 画像 MIME / magic bytes / サイズ上限の shared utility
- `takt add --pr` の保存配線
- `takt --pr` interactive seed と execute/save_task 配線
- pipeline `--pr` の `TaskContent`、`resolveTaskContent()`、`runWorkflow()`、`runPipeline()` 配線
- 新規単体テストと既存 PR/pipeline/add/routing テストの追加・更新

既存の `TaskAttachment` 保存機構自体は変更不要。`order.md` 追記と `attachments/` へのコピーは既存実装を使う。

### 検討したアプローチ（設計判断がある場合）
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `fetchPrReviewComments()` が `PrReviewData` と一緒に attachments も返す | 不採用 | Git provider 層に task attachment 保存形式と temp file 管理を持ち込むため責務が混ざる |
| `formatPrReviewAsTask()` に画像抽出・ダウンロードを入れる | 不採用 | format 関数に IO と GitHub 認証取得が入り、読み取り/書き込み責務が分離できない |
| `PrReviewData` から `taskContent + TaskAttachment[]` を作る feature 層モジュールを追加する | 採用 | 既存 `formatPrReviewAsTask()` と attachment 保存機構を組み合わせられ、責務が明確 |
| `gh api <asset-url>` で画像を取得する | 不採用 | ローカル `gh api --help` 上、endpoint は GitHub API path / graphql 用で asset URL に適さない |
| `gh auth token` で token を取得し、Node `https` で allowlist URL だけ取得する | 採用 | 認証済み `gh` 経由の取得を満たしつつ、URL allowlist・redirect・size cap・Content-Type 検証を実装しやすい |
| pipeline を `selectAndExecuteTask()` 経由に全面変更する | 不採用 | pipeline の既存実行・git 操作・Slack 通知の流れに不要な影響が出る |
| pipeline `runWorkflow()` 内で `prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` だけ再利用する | 採用 | 既存 attachment staging パターンを局所的に再利用できる |

### 実装アプローチ
1. 画像判定 shared utility を追加する。
   - 例: `src/shared/utils/imageMime.ts`
   - `SUPPORTED_IMAGE_MIME_TYPES`
   - `MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024`
   - `inferImageMimeTypeFromMagicBytes(data: Buffer): SupportedImageMimeType | null`
   - `extensionForImageMimeType(mimeType): 'png' | 'jpg' | 'gif' | 'webp'`
   - `assertSupportedImageContentType(contentType, data)` のような検証関数
   - 既存 `inlineImagePaste.ts` は private magic bytes 実装を削除し、この shared utility を使う。

2. PR review image attachment 準備モジュールを追加する。
   - 推奨ファイル: `src/features/tasks/prReviewImageAttachments.ts`
   - 入力: `cwd`, `PrReviewData`
   - 出力: `{ taskContent: string; attachments: TaskAttachment[]; cleanupAttachments: () => void }`
   - 内部で `formatPrReviewAsTask()` を呼ぶ前、または `PrReviewData` の body/comment/review body を置換してから format する。
   - Markdown image syntax と HTML `<img src="...">` を抽出対象にする。
   - GitHub attachment URL allowlist に合う URL だけダウンロードする。
   - URL 単位で dedupe し、検出順に `[Image #1]`, `image-1.ext` を割り当てる。
   - 画像記法全体を `[Image #N]` に置換する。
   - temp dir は `os.tmpdir()` 配下に private directory として作成し、cleanup 関数で削除する。

3. ダウンロード実装を feature モジュール内の小さい関数か同階層の専用モジュールへ分ける。
   - `gh auth token` を `execFileSync` で取得する。
   - Node `https` で GET する。
   - 初期 URL は allowlist 必須。
   - redirect は HTTPS のみ、回数上限付き。
   - GitHub 系ホスト以外へ token を転送しない。
   - `Content-Length` が上限超過なら読まずに失敗。
   - 読み込み中も累積 byte 数が上限を超えたら失敗。
   - Content-Type と magic bytes の両方を検証し、不一致なら失敗。

4. `takt add --pr` に配線する。
   - `src/features/tasks/add/index.ts:199` の `formatPrReviewAsTask(prReview)` を新規 helper 呼び出しへ置換する。
   - `src/features/tasks/add/index.ts:213` の `saveTaskFile()` に `attachments` を渡す。
   - `saveTaskFile()` 成功後、または途中失敗時に helper の cleanup を呼ぶ。
   - PR に review/comment がない場合の既存挙動は維持する。

5. `takt --pr` interactive に配線する。
   - `src/app/cli/routing-inputs.ts:53` の `resolvePrInput()` の戻り値へ `attachments` と cleanup を追加する。
   - `src/app/cli/routing.ts:179` の `interactiveSeed` に `attachments` を含める。
   - `execute` action では既存 `result.attachments` を `selectOptions.attachments` に入れる処理をそのまま活かす。
   - `save_task` action では既存 `result.attachments` を `saveTaskFromInteractive()` に渡す処理を活かす。
   - workflow 選択や interactive mode 選択でキャンセルされた場合も PR temp dir を cleanup する。

6. pipeline `--pr` に配線する。
   - `src/features/pipeline/steps.ts` の `TaskContent` に `attachments?: TaskAttachment[]` と cleanup 情報を追加する。
   - `resolveTaskContent()` は async 化し、PR の場合だけ helper を使う。
   - `src/features/pipeline/execute.ts:40` は `await resolveTaskContent(options)` に変更する。
   - `runWorkflow()` は attachments がある場合、`prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` を使って staged prompt を `executeTask()` に渡す。
   - staged spec 用に `generateExecutionReportDir()` で reportDirName を作り、`executeTask()` に同じ `reportDirName` を渡す。
   - pipeline 直実行では queue task を残さないため、transient `.takt/tasks/<slug>` は実行後に cleanup する。

7. テストを追加・更新する。
   - 新規 extractor/prepare module test
   - shared MIME utility test
   - `inlineImagePaste.test.ts` の既存期待を維持
   - `addTask.test.ts`
   - `cli-routing-pr-resolve.test.ts`
   - `pipelineExecution.test.ts`

8. 検証する。
   - `npm run build`
   - `npm run lint`
   - `npm test`

### 到達経路・起動条件（利用者向け機能の追加/変更がある場合）
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、`takt --pipeline --pr <number> --workflow <workflow>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | PR review data の本文中に allowlist 対象の GitHub attachment URL が含まれること。`gh` CLI が認証済みで `gh auth token` が取得できること。画像が PNG/JPEG/GIF/WebP で Content-Type と magic bytes が一致すること。画像サイズが上限以内であること |
| 未対応項目 | なし。GitHub attachment URL 以外の任意外部 URL 取得は意図的に対象外 |

## 実装ガイドライン（設計が必要な場合のみ）
- `src/infra/github/pr.ts` に attachment 保存や temp file 管理を入れない。PR review data の取得責務に留める。
- `src/infra/git/format.ts` の `formatPrReviewAsTask()` にダウンロード IO を入れない。format は pure な文字列化として維持する。
- `src/features/tasks/prReviewImageAttachments.ts` は「PR review data から taskContent と TaskAttachment[] を作る」責務に限定する。
- magic bytes 判定は既存 `inlineImagePaste.ts` から shared utility へ移し、コピー実装を作らない。
- `utils/` の肥大化を避けるため、shared utility は画像 MIME 判定のような横断的で小さい責務に限定する。
- URL allowlist は開始 URL に必ず適用する。ユーザーコメントに含まれる任意の `https://...` は取得しない。
- redirect 先に GitHub token を無条件転送しない。ホストが GitHub 系でない場合は token を落とす。
- Content-Type のみ、拡張子のみ、URL path のみで画像種別を信用しない。
- `TaskAttachment.fileName` は magic bytes から決めた MIME に基づき `image-N.ext` とする。
- duplicate URL は同じ placeholder を使い、重複ダウンロードを避ける。
- 一時ディレクトリ cleanup は成功・失敗・キャンセルの全経路で漏らさない。
- pipeline 側は `selectAndExecuteTask()` に全面移行せず、既存 `runWorkflow()` の中で task spec staging だけを再利用する。
- `system-enqueue-effect.ts` の `enqueue_task mode: from_pr` は PR コメント本文を task 化していないため、今回の変更対象に含めない。
- GitLab provider の MR コメント画像取得は今回の GitHub attachment URL 要件から外す。

## スコープ外（項目がある場合のみ）
| 項目 | 除外理由 |
|------|---------|
| 任意外部 URL の画像取得 | 明示制約「外部 URL を無制限に取得しない。GitHub attachment URL から始める」に反するため |
| GitLab MR attachment 対応 | 要求は GitHub PR コメント内画像であり、参照実装も `src/infra/github/pr.ts` のため |
| `enqueue_task mode: from_pr` で PR コメント画像を自動添付 | この effect は PR branch/base を使って payload task を保存するもので、PR コメント本文を task 化していないため |
| docs 更新 | 要求・品質要件に明示されていないため。必要なら後続で別途扱う |
| 既存 attachment 保存機構の作り直し | `saveTaskFile()` / `prepareTaskSpecDirectory()` / `promoteTaskAttachments()` が既に要件を満たすため |

## 確認事項（あれば）
- なし。