# タスク計画

## 元の要求
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

## 分析結果

### 目的
`takt add --pr <number>`、通常の `takt --pr <number>`、pipeline の `--pr` 経路で、PR 本文・通常コメント・review thread コメント内に貼られた GitHub 画像 URL を検出し、安全にローカルへ保存したうえで、既存の task attachment 形式として task spec に含める。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | PR 本文内の Markdown 画像記法 `![...](...)` から画像 URL を検出する | 明示 | `PrReviewData.body` が対象 |
| 2 | PR 通常コメント内の Markdown 画像記法 `![...](...)` から画像 URL を検出する | 明示 | `PrReviewData.comments[].body` が対象 |
| 3 | review summary / review thread コメント内の Markdown 画像記法 `![...](...)` から画像 URL を検出する | 明示 | `PrReviewData.reviews[].body` が対象 |
| 4 | PR 本文内の HTML `<img src="...">` から画像 URL を検出する | 明示 | 属性順や quote の違いは unit test で固定する |
| 5 | PR 通常コメント内の HTML `<img src="...">` から画像 URL を検出する | 明示 | 同上 |
| 6 | review summary / review thread コメント内の HTML `<img src="...">` から画像 URL を検出する | 明示 | 同上 |
| 7 | 対象 URL をローカル一時ファイルへダウンロードする | 明示 | 既存 attachment 保存へ渡す前段の処理 |
| 8 | ダウンロード対象を GitHub attachment URL に限定する | 明示 | 外部 URL を無制限に取得しない制約 |
| 9 | private repository 画像取得のため認証済み GitHub 経路を使う | 明示 | `gh auth token` から得た token を使う方針 |
| 10 | 対応形式を PNG に限定せず PNG/JPEG/GIF/WebP にする | 明示 | MIME と拡張子生成に反映 |
| 11 | Content-Type を検証する | 明示 | response header の image MIME を確認 |
| 12 | magic bytes を検証する | 明示 | 実データから MIME を推定 |
| 13 | Content-Type と magic bytes の不一致を拒否する | 暗黙 | 明示要件 11・12 から直接導出 |
| 14 | サイズ上限を設ける | 明示 | 既存 inline image と同じ 10 MiB を使う方針 |
| 15 | `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する | 明示 | 既存 `TaskAttachment[]` 保存経路を利用 |
| 16 | `order.md` に既存 attachment 形式で追記する | 明示 | 既存 `buildTaskOrderContent()` は要件形式を満たすため再利用 |
| 17 | 元コメント本文内の画像参照を `[Image #N]` で参照できる形にする | 明示 | `formatPrReviewAsTask()` 前に body を置換する |
| 18 | pipeline の `--pr` 経路でも画像を参照できる | 明示 | 直接 `executeTask()` している現状に staging を追加 |
| 19 | 新規ロジックに unit test を追加する | 明示 | 抽出・URL allowlist・ダウンロード検証・配線を対象 |
| 20 | `npm run build`、`npm run lint`、`npm test` が成功する | 明示 | 後続 implement/fix フェーズで実行 |

### 参照資料の調査結果
タスク指示書の実装方針案で明示された `src/infra/github/pr.ts` を確認した。

- `gh pr view --json number,title,body,url,headRefName,baseRefName,comments,reviews,files` で PR 本文・通常コメント・review summary を取得している。根拠: `src/infra/github/pr.ts:108-124`, `src/infra/github/pr.ts:421-430`
- GraphQL `reviewThreads` で review thread comments の `body` を取得している。根拠: `src/infra/github/pr.ts:127-174`
- review thread comment は `PrReviewComment` の `body` として map される。根拠: `src/infra/github/pr.ts:346-363`
- `fetchPrReviewComments()` は `PrReviewData` として PR 本文、通常コメント、review summary/thread comments、変更ファイルを返す。根拠: `src/infra/github/pr.ts:447-456`
- 現在の実装との差異は、取得済みの本文から画像 URL を抽出・ダウンロード・placeholder 化する処理が存在しない点。

既存 attachment 実装も確認した。

- `TaskAttachment` は `StoredImageAttachment` の alias。根拠: `src/features/tasks/attachments.ts:14`
- `buildTaskOrderContent()` は attachments がある場合に `## 添付画像` と `- [Image #N]: \`attachments/image-N.ext\`` を追記する。根拠: `src/features/tasks/attachments.ts:26-44`
- `promoteTaskAttachments()` は attachment temp file を `.takt/tasks/<slug>/attachments/` へ copy する。根拠: `src/features/tasks/attachments.ts:79-98`
- `prepareTaskSpecDirectory()` は order.md 書き込み前に attachment promotion を実行する。根拠: `src/features/tasks/attachments.ts:138-153`

### スコープ
影響範囲は以下。

- PR review 画像抽出・置換・ダウンロードの新規モジュール
- 画像 MIME/magic bytes/サイズ上限の共通検証ユーティリティ
- `takt add --pr` の PR 取得後処理と `saveTaskFile()` への attachments 渡し
- 通常 `takt --pr` の `resolvePrInput()` 戻り値と `app/cli/routing.ts` 配線
- pipeline `--pr` の `TaskContent`、`resolveTaskContent()`、`runWorkflow()` の task spec staging
- 関連 unit tests

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `PrReviewData` に `attachments?: TaskAttachment[]` を直接追加する | 不採用 | `PrReviewData` は `src/infra/git/types.ts` の provider 非依存型であり、task feature の attachment 型を infra/git に混ぜると層の責務が崩れる |
| `GitProvider` に `fetchPrReviewAttachments()` を追加する | 不採用 | GitHub 固有機能を GitLab 実装にも空配線させることになり、Knowledge の「パブリック API はドメイン操作のみ」「不要な配線を増やさない」に反する |
| PR 取得時点の `src/infra/github/pr.ts` に画像処理を埋め込む | 不採用 | 同ファイルは既に 547 行で、PR 取得・GraphQL pagination の責務を持つ。画像抽出/HTTP download/検証を同居させると 1 ファイル複数責務になる |
| GitHub PR 画像処理を専用モジュールへ分離し、CLI/pipeline から PR fetch 後に呼ぶ | 採用 | 既存 PR fetch の責務を保ちつつ、GitHub attachment URL の安全処理を集約できる |
| `gh api <asset-url>` で直接ダウンロードする | 不採用 | asset URL は API endpoint とは限らず、unit test もしづらい。`gh auth token` で token を取り Node `fetch` へ注入する方が境界とテストが明確 |
| Node `fetch` を injectable dependency として使う | 採用 | Content-Length、stream size cap、Content-Type、redirect 後データ検証を単体テストしやすい |
| pipeline は `executeTask()` に attachments 引数を追加する | 不採用 | 既存の attachment 参照は task spec staging によって local path を prompt に反映する設計。`executeTask()` の契約を広げるより `runWorkflow()` 内で既存 staging を使う方が影響範囲が狭い |
| pipeline は `selectAndExecuteTask()` を呼ぶように差し替える | 不採用 | pipeline は branch/worktree/commit/push の独自 context を持つため、既存実行制御を大きく置き換える必要がある |

### 実装アプローチ
1. 画像 MIME 判定を共通化する。
   - `src/features/interactive/inlineImagePaste.ts:45-59` の magic bytes 判定と `src/features/interactive/inlineImagePaste.ts:8-10` の 10 MiB 上限を、`src/shared/utils/imageData.ts` のような小さな shared module へ移す。
   - inline paste 側は新 shared module を import する。
   - MIME から attachment file extension を返す関数も shared 化するか、PR 画像モジュール内で同じ mapping を持つ。重複を避けるため shared 化を推奨。

2. GitHub PR 画像処理モジュールを追加する。
   - 候補ファイル: `src/infra/github/prReviewImageAttachments.ts`
   - export 例:
     - `resolvePrReviewImageAttachments(prReview, options): Promise<{ prReview: PrReviewData; attachments: StoredImageAttachment[]; cleanup: () => void }>`
     - `extractPrReviewImageReferences(text): ImageReference[]`
     - `isAllowedGitHubAttachmentUrl(url): boolean`
   - `StoredImageAttachment` は `src/shared/types/image-attachments.ts` の型を使う。`TaskAttachment` はその alias なので feature 側へそのまま渡せる。
   - URL allowlist は初期対応として以下に限定する。
     - `https://github.com/user-attachments/assets/...`
     - `https://github.com/<owner>/<repo>/assets/...`
     - 必要なら GitHub redirect 後の `https://private-user-images.githubusercontent.com/...` は fetch の redirect 先として許可するが、本文から直接抽出する初期 URL は GitHub attachment URL に限定する。
   - 外部 URL は取得しない。抽出対象の画像記法が外部 URL の場合は本文を変更しない。
   - 同一 URL が複数回出た場合は同一 placeholder を再利用し、重複 download を避ける。
   - attachment fileName は検出順で `image-1.png`, `image-2.jpg`, `image-3.gif`, `image-4.webp` とする。
   - Markdown/HTML 画像記法全体を placeholder へ置換する。例: `![screenshot](url)` -> `[Image #1]`、`<img src="url" />` -> `[Image #1]`。
   - `PrReviewData` と各 `PrReviewComment` は破壊せずコピーして返す。

3. ダウンロード処理を実装する。
   - `gh auth token` を `execFileSync('gh', ['auth', 'token'], { cwd, encoding: 'utf-8' })` で取得する。
   - fetch dependency を注入可能にする。
   - request header に `Authorization: Bearer <token>` と GitHub 向け Accept/User-Agent を付ける。
   - response が 2xx でない場合は明確な error にする。
   - `Content-Length` が 10 MiB 超なら body 読み取り前に拒否する。
   - body は stream で読み、累積サイズが 10 MiB 超になった時点で拒否する。
   - `Content-Type` は `image/png`, `image/jpeg`, `image/gif`, `image/webp` のみ許可する。
   - magic bytes から推定した MIME が未対応または Content-Type と不一致なら拒否する。
   - 一時保存先は `os.tmpdir()/takt/pr-attachments/<randomUUID>/attachments/` のような private directory にし、保存後の `tempPath` を attachment に入れる。
   - 呼び出し側が task spec へ promote した後、finally で一時ディレクトリを cleanup できるようにする。

4. `takt add --pr` に配線する。
   - `src/features/tasks/add/index.ts:181-187` の PR fetch 後に画像処理を呼ぶ。
   - `src/features/tasks/add/index.ts:199` の `formatPrReviewAsTask(prReview)` は、placeholder 化済みの `prReview` を使う。
   - `src/features/tasks/add/index.ts:213` の `saveTaskFile()` に `attachments` を渡す。
   - 現在 `src/features/tasks/add/index.ts:194-196` は comments/reviews が空だと error にする。PR body 画像も対象要件なので、少なくとも `prReview.body` または attachments がある場合は task 作成へ進める条件に見直す。

5. 通常 `takt --pr` に配線する。
   - `src/app/cli/routing-inputs.ts:50-70` の `resolvePrInput()` 戻り値に `attachments?: TaskAttachment[]` を追加する。
   - `formatPrReviewAsTask()` は placeholder 化済みの `PrReviewData` を使う。
   - `src/app/cli/routing.ts:111-118` で `selectOptions.attachments = prResult.attachments` を設定する。
   - `dispatchConversationAction()` 内で `result.attachments` を上書きしないように、PR 由来 attachments と interactive result attachments の統合順序を明確にする。PR 由来は source context の一部なので、confirmed task 実行時に引き継ぐ必要がある。

6. pipeline `--pr` に配線する。
   - `src/features/pipeline/steps.ts:18-23` の `TaskContent` に `attachments?: TaskAttachment[]` を追加する。
   - `src/features/pipeline/steps.ts:144-160` の PR fetch 後に画像処理を呼び、placeholder 化済み task と attachments を返す。
   - `src/features/pipeline/execute.ts:59` の `runWorkflow()` 呼び出しで `taskContent.attachments` を渡す。
   - `src/features/pipeline/steps.ts:229-264` の `runWorkflow()` で attachments がある場合だけ:
     - `prepareTaskSpecDirectory(projectCwd, task, attachments)` を呼ぶ
     - `generateExecutionReportDir(execCwd, task)` で report dir 名を決める
     - `stageTaskSpecForExecution(projectCwd, execCwd, preparedSpec.taskDirRelative, reportDirName)` を呼ぶ
     - `executeTask()` へ `stagedSpec.taskPrompt` を渡す
     - finally で `cleanupStagedTaskSpec()` と `cleanupPreparedTaskSpec()` を呼ぶ
   - この実装は `src/features/tasks/execute/selectAndExecute.ts:113-119` の既存 pattern を参照する。

7. テストを追加・更新する。
   - `src/__tests__/github-pr-review-image-attachments.test.ts` のような新規 test で、抽出・置換・URL allowlist・MIME/magic/size を検証する。
   - `src/__tests__/addTask.test.ts:280-288` 周辺に、PR image attachment が `order.md` と `attachments/` に保存される test を追加する。
   - `src/__tests__/pipelineExecution.test.ts:300-320` 周辺に、PR image attachment ありの pipeline が staged task prompt を `executeTask()` に渡す test を追加する。
   - `src/__tests__/git-cwd-propagation.test.ts` または `src/__tests__/cli-routing-pr-resolve.test.ts` に、`resolvePrInput()` の cwd と attachment 戻り値の配線 test を追加する。
   - inline paste の既存 test は shared magic bytes 抽出後も通るように import だけ更新する。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、通常実行の `takt --pr <number>`、pipeline 実行の `takt --pipeline --pr <number>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`, `src/app/cli/routing-inputs.ts`, `src/app/cli/routing.ts`, `src/features/pipeline/steps.ts`, `src/features/pipeline/execute.ts` |
| 起動条件 | `--pr` が指定され、PR 本文・通常コメント・review summary・review thread comment のいずれかに allowlist 対象の GitHub attachment URL が含まれること |
| 起動条件 | `gh` CLI が利用可能で、`gh auth token` が取得できること |
| 起動条件 | 対象画像が PNG/JPEG/GIF/WebP のいずれかで、Content-Type と magic bytes が一致し、サイズ上限内であること |
| 未対応項目 | 外部画像 URL の取得、GitLab MR 画像 attachment 対応、GitHub attachment 以外の任意 URL 対応 |

## 実装ガイドライン
- `src/infra/github/pr.ts` へ画像 download 処理を追加しない。同ファイルは既に PR 取得・GraphQL pagination の責務を持ち 547 行あるため、画像処理は別モジュールに分離する。
- `PrReviewData` の generic contract に task attachment を直接混ぜない。`StoredImageAttachment` は shared type として扱い、feature 層で `TaskAttachment` alias として渡す。
- `GitProvider` interface に GitHub 固有 attachment API を追加しない。GitLab 側への空実装や未使用配線を作らない。
- 画像 URL 抽出は Markdown と HTML の両方を扱うが、Markdown 全体 parser の導入は不要。対象記法を限定した parser/helper と unit test で十分。
- HTML `<img>` は `src` 属性のみを見る。script/style や任意 HTML sanitize へ拡張しない。
- 外部 URL は取得しない。今回の安全要件により GitHub attachment URL の allowlist から開始する。
- ダウンロード失敗、unsupported MIME、Content-Type/magic mismatch、サイズ超過は明確に失敗させる。黙って attachment を欠落させない。
- `TaskAttachment` の fileName は `validateImageAttachmentFileName()` の制約を満たす単一 path segment にする。根拠: `src/shared/utils/imageAttachmentReferences.ts:20-29`
- 一時ファイルは通常ファイルとして保存する。既存 promotion は symlink と directory を拒否する。根拠: `src/features/tasks/attachments.ts:71-98`
- pipeline の cleanup は `selectAndExecuteTask()` と同じく、prepared spec と staged spec の両方を finally で片付ける。
- PR body だけに画像がある場合も要件対象なので、`takt add --pr` の「review/comment が空なら作成しない」判定をそのまま維持しない。
- 既存未追跡 `.takt/workflows/` は今回の実装対象外。触らない。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| 外部任意 URL の画像 download | 安全性制約で「外部 URL を無制限に取得しない」「GitHub attachment URL から始める」と指定されているため |
| GitLab MR の画像 attachment 対応 | ユーザー要求と参照実装が GitHub PR / `gh` 前提のため |
| Provider への native image input 送信 | 既存 task attachment は prompt 内の local path 参照として扱う設計で、今回の要求は task attachments への配置 |
| docs 更新 | 品質要件に docs 更新は含まれていないため。ただし後続判断で CLI reference 更新が必要と判断された場合は別途扱う |

## 確認事項
なし。