# タスク計画

## 元の要求
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

期待する挙動:
- `takt add --pr <number>` 実行時に、PR 本文・通常コメント・review thread コメント内の画像 URL を検出する
- 対応画像をローカルにダウンロードする
- `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する
- `order.md` に既存 attachment 形式で追記する
- 元コメント本文内の画像参照も、可能なら `[Image #1]` のように参照できる形に置換または補足する
- pipeline の `--pr` 経路でも同等に画像を参照できること
- 対象記法は Markdown image syntax と HTML `<img src="...">`
- 対応形式は PNG/JPEG/GIF/WebP
- Content-Type と magic bytes を検証する
- サイズ上限を設ける
- GitHub private repository 画像に対応するため、`gh api` または認証済み `gh` 経由の取得を優先する
- 外部 URL を無制限に取得しない。GitHub attachment URL から始める
- 新規ロジックには単体テストを追加し、`npm run build`、`npm run lint`、`npm test` を成功させる

## 分析結果

### 目的
PR 由来の task 作成・pipeline 実行で、PR 本文・通常コメント・review summary・review thread comment 内の GitHub 画像 attachment を安全に取得し、既存の `TaskAttachment[]` 経路へ流して `order.md` と `attachments/` に保存・参照できるようにする。

### 分解した要件
| # | 要件 | 種別 | 変更判定・根拠 |
|---|------|------|----------------|
| 1 | PR 本文から画像 URL を検出する | 明示 | 変更要。PR 本文は `PrReviewData.body` に入り、`formatPrReviewAsTask()` が `### PR Description` として出力するが、画像抽出処理はない。根拠: `src/infra/github/pr.ts:447-456`, `src/infra/git/format.ts:202-205` |
| 2 | 通常コメントから画像 URL を検出する | 明示 | 変更要。通常コメントは `PrReviewData.comments` に入るが、画像抽出処理はない。根拠: `src/infra/github/pr.ts:434-437`, `src/infra/git/format.ts:248` |
| 3 | review summary から画像 URL を検出する | 明示 | 変更要。`data.reviews` の body は `PrReviewData.reviews` に入るが、画像抽出処理はない。根拠: `src/infra/github/pr.ts:439-445`, `src/infra/git/format.ts:214-246` |
| 4 | review thread コメントから画像 URL を検出する | 明示 | 変更要。GraphQL review thread comments は `PrReviewData.reviews` に統合済みだが、画像抽出処理はない。根拠: `src/infra/github/pr.ts:366-397`, `src/infra/github/pr.ts:445` |
| 5 | Markdown image syntax `![alt](url)` を対象にする | 明示 | 変更要。現在は本文をそのまま task text に入れるだけ。 |
| 6 | HTML `<img src="...">` を対象にする | 明示 | 変更要。現在は HTML img を解釈する処理がない。 |
| 7 | GitHub attachment URL のみを取得対象にする | 明示 | 変更要。新規安全境界が必要。外部 URL は取得しない。 |
| 8 | PNG/JPEG/GIF/WebP を対応形式にする | 明示 | 変更要。既存 attachment filename validator は拡張子を許可しているが、ダウンロード画像の MIME 判定はない。根拠: `src/shared/utils/imageAttachmentReferences.ts:8`, `src/shared/utils/imageAttachmentReferences.ts:24-30` |
| 9 | Content-Type を検証する | 明示 | 変更要。現行の task attachment promotion はファイル実体のみ検証し、Content-Type は扱わない。根拠: `src/features/tasks/attachments.ts:90-97` |
| 10 | magic bytes を検証する | 明示 | 変更要。magic bytes 判定は inline paste 内に private 実装として存在するが再利用不可。根拠: `src/features/interactive/inlineImagePaste.ts:45-58` |
| 11 | サイズ上限を設ける | 明示 | 変更要。inline image は 10 MiB 上限を持つが、PR 画像 download 用上限は未実装。根拠: `src/features/interactive/inlineImagePaste.ts:6-7`, `src/features/interactive/inlineImagePaste.ts:71-89` |
| 12 | `.takt/tasks/<slug>/attachments/` に保存する | 明示 | 変更不要。`TaskAttachment[]` を渡せば `promoteTaskAttachments()` が保存する。根拠: `src/features/tasks/attachments.ts:79-98` |
| 13 | `order.md` に `## 添付画像` と attachment 行を追記する | 明示 | 変更不要。`buildTaskOrderContent()` が既存形式で追記する。根拠: `src/features/tasks/attachments.ts:34-44` |
| 14 | 元コメント本文内の画像参照を `[Image #N]` へ置換または補足する | 明示 | 変更要。`formatPrReviewAsTask()` 前に `PrReviewData` の body/comment body/review body を置換したコピーを作る。 |
| 15 | `takt add --pr` で attachments を保存に渡す | 明示 | 変更要。現状は `saveTaskFile()` に attachments を渡していない。根拠: `src/features/tasks/add/index.ts:199-213` |
| 16 | pipeline `--pr` でも画像を参照できる | 明示 | 変更要。`TaskContent` に attachments がなく、`runWorkflow()` も task 文字列のみを渡す。根拠: `src/features/pipeline/steps.ts:18-23`, `src/features/pipeline/steps.ts:144-160`, `src/features/pipeline/steps.ts:229-261` |
| 17 | ダウンロード一時ファイルを後始末する | 暗黙 | 変更要。明示要件「ローカルにダウンロードする」から、一時保存の cleanup が必要。既存 interactive attachment は cleanup owner を持つ。根拠: `src/features/interactive/imageAttachments.ts:63-90`, `src/features/interactive/imageAttachments.ts:113-124` |
| 18 | 新規ロジックに単体テストを追加する | 明示 | 変更要。抽出・検証・配線のテストを追加する。 |
| 19 | `npm run build`、`npm run lint`、`npm test` を成功させる | 明示 | 実装後に検証要。 |

### 参照資料の調査結果
タスク指示の参照実装として `src/infra/github/pr.ts` を確認した。

- `fetchPrReviewComments()` は `gh pr view` で PR body・通常コメント・review summary・files を取得し、GraphQL で review thread comments を追加して `PrReviewData` を返す。根拠: `src/infra/github/pr.ts:421-457`
- review thread comments は `fetchPrReviewThreads()` から `mapReviewThreadComments()` 経由で `PrReviewComment[]` へ変換される。根拠: `src/infra/github/pr.ts:349-397`
- 現行の `PrReviewData` 型は attachments を持たない。根拠: `src/infra/git/types.ts:90-99`
- 既存 task attachment は `TaskAttachment` が `StoredImageAttachment` の alias であり、`placeholder`、`tempPath`、`fileName` を持つ。根拠: `src/features/tasks/attachments.ts:14`, `src/shared/types/image-attachments.ts:1-5`
- `saveTaskFile()` は `attachments` が渡された場合だけ `prepareTaskSpecDirectory()` を差し替える。根拠: `src/features/tasks/add/index.ts:39-48`
- `selectAndExecuteTask()` は attachments 付き direct execution の既存パターンを持つ。根拠: `src/features/tasks/execute/selectAndExecute.ts:109-118`

参照資料の意図は、PR 取得済みデータのどの本文フィールドを走査すべきかを示すものと判断した。画像取得処理を `src/infra/github/pr.ts` に直接追加する案は採用しない。同ファイルは 547 行あり、PR 取得、GraphQL pagination、PR 作成、merge/close まで含んでいるため、画像抽出・download・temp file 管理を追加すると責務が増える。

`gh api --help` も確認した。`gh api` の endpoint は GitHub API v3 path または `graphql` と説明されており、`https://github.com/user-attachments/assets/...` のような attachment URL を直接扱う前提ではない。private 画像対応は `gh auth token --hostname github.com` で認証情報を取得し、Node `fetch` に Authorization header を付ける方式を計画する。

Knowledge / Policy として以下を反映する:
- 1ファイル 300 行超は分割を検討し、複数責務同居を避ける。
- 入力解釈、検証、実行、副作用を分離する。
- 外部入力は境界で正規化する。
- 配線漏れを避けるため、新規 attachments パラメータの呼び出し元を全件更新する。
- 後方互換コード、任意外部 URL 対応、不要な provider 抽象追加はしない。

### スコープ
影響範囲:
- PR review data の画像抽出・本文置換
- GitHub attachment URL の allowlist 判定
- 認証付き画像 download
- MIME / magic bytes / size validation
- 一時 attachment store と cleanup
- `takt add --pr` の保存配線
- pipeline `--pr` の task spec / attachments 配線
- 単体テスト・既存テスト更新

主な対象ファイル候補:
- `src/features/tasks/prReviewImageAttachments.ts` 新規
- `src/infra/github/attachmentDownload.ts` 新規
- `src/shared/utils/imageMime.ts` 新規
- `src/features/tasks/add/index.ts`
- `src/features/pipeline/steps.ts`
- `src/features/pipeline/execute.ts`
- `src/features/interactive/inlineImagePaste.ts`
- `src/features/interactive/imageAttachments.ts`
- `src/__tests__/addTask.test.ts`
- `src/__tests__/pipelineExecution.test.ts` または `src/__tests__/pipeline-steps.test.ts`
- `src/__tests__/github-pr.test.ts` または新規 `src/__tests__/prReviewImageAttachments.test.ts`

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/infra/github/pr.ts` の `fetchPrReviewComments()` 内で画像 download まで行う | 不採用 | PR 取得と画像 download / temp file 管理が混ざる。既に 547 行で責務が多い。system step など PR data だけ欲しい経路にも副作用が入る。 |
| `PrReviewData` 型に `attachments?: TaskAttachment[]` を追加して provider が返す | 不採用 | GitProvider 全実装・大量のモック更新が必要。GitLab など非対象 provider へ不要な契約を広げる。 |
| `formatPrReviewAsTask()` 後の task 文字列から画像を抽出する | 不採用 | 実装は簡単だが、PR body / comment body / review body のどこから来た画像かを失いやすく、元コメント本文の置換としては粗い。 |
| `PrReviewData` の body/comment body/review body を走査し、置換済みコピーと attachments を返す | 採用 | 参照方針案に合う。`formatPrReviewAsTask()` の既存構造を壊さず、元コメント本文内の画像参照を `[Image #N]` に置換できる。 |
| `gh api` で attachment URL を直接取得する | 不採用 | ローカル `gh api --help` では API endpoint / graphql が対象で、`github.com/user-attachments` URL 直接取得の根拠がない。 |
| `gh auth token` + Node `fetch` で allowlisted GitHub attachment URL を取得する | 採用 | `gh` の認証情報を使い、任意外部 URL 取得を避けられる。Content-Type / Content-Length / body size / magic bytes を Node 側で検証できる。 |
| 画像 MIME 判定を新規処理内に重複実装する | 不採用 | inline image paste に同種の magic bytes 判定が既にある。shared utility 化して DRY にする。 |
| 既存 interactive image attachment store をそのまま利用する | 採用 | `StoredImageAttachment` と `image-N.ext` 採番を既に実装済み。tasks 配下から interactive への依存は既存にもあるため、今回の temp store 用途では許容できる。根拠: `src/features/tasks/resume/index.ts:21-22`, `src/features/tasks/list/taskInstructionActions.ts:18-21` |

### 実装アプローチ
1. `src/shared/utils/imageMime.ts` を追加する。
   - `SUPPORTED_IMAGE_MIME_TYPES`
   - `inferImageMimeTypeFromMagicBytes(data: Buffer): string | null`
   - `extensionForImageMimeType(mimeType: string): 'png' | 'jpg' | 'gif' | 'webp'`
   - 既存 `inlineImagePaste.ts` の private magic bytes 判定をこの shared 関数へ置き換える。
   - 既存 `imageAttachments.ts` の MIME→拡張子も shared 関数へ置き換える。
   - 既存エラーメッセージの観測可能契約は不要に変えない。caller 側で現行文言を維持する。

2. `src/infra/github/attachmentDownload.ts` を追加する。
   - URL allowlist:
     - `https://github.com/user-attachments/assets/...`
     - `https://github.com/<owner>/<repo>/assets/...`
     - `https://user-images.githubusercontent.com/...`
     - `https://private-user-images.githubusercontent.com/...`
   - 上記以外は「取得対象外」として扱い、download しない。
   - allowlisted URL で取得した結果は以下を検証する。
     - `Content-Type` が `image/png`、`image/jpeg`、`image/gif`、`image/webp` のいずれか
     - `Content-Length` が存在し上限超過なら body 読み込み前に reject
     - body 読み込み後の byte length が上限以下
     - magic bytes から推定した MIME が Content-Type と一致
   - サイズ上限は既存 inline image と同じ 10 MiB に合わせる。
   - `gh auth token --hostname github.com` を `execFileSync` で取得し、`fetch` に `Authorization: Bearer <token>` を付ける。
   - token はログ出力しない。
   - timeout は `AbortSignal.timeout(...)` を使う。

3. `src/features/tasks/prReviewImageAttachments.ts` を追加する。
   - `resolvePrReviewImageAttachments(prReview: PrReviewData, cwd: string)` のような関数を用意する。
   - 戻り値は `{ prReview: PrReviewData; attachments: TaskAttachment[]; cleanup: () => void }`。
   - `PrReviewData` の以下を走査する。
     - `body`
     - `comments[].body`
     - `reviews[].body`
   - Markdown image syntax と HTML `<img src="...">` を抽出する。
   - allowlisted GitHub URL は download し、`createSessionImageAttachmentStore().saveImage(data, mimeType)` で `TaskAttachment` にする。
   - 画像記法は `[Image #N]` に置換する。
   - 同じ URL が複数回出る場合は同じ placeholder を再利用する。これは重複 download を避け、本文内参照を安定させるため。
   - allowlist 外 URL は download せず、本文も変更しない。
   - allowlisted URL の download / validation 失敗は fail fast。安全性要件を満たせない画像を黙ってスキップしない。

4. `takt add --pr` を更新する。
   - `src/features/tasks/add/index.ts` の PR 分岐で `fetchPrReviewComments()` 後、`formatPrReviewAsTask()` 前に `resolvePrReviewImageAttachments()` を呼ぶ。
   - 置換済み `prReview` を `formatPrReviewAsTask()` に渡す。
   - `saveTaskFile()` に `attachments` を渡す。
   - cleanup は `try/finally` で実行する。
   - 現行の「reviews/comments が空なら task を作らない」判定は、画像 attachment がある PR body の場合だけ通す。これにより既存挙動を大きく変えず、明示要求の PR body 画像には対応する。

5. pipeline `--pr` を更新する。
   - `TaskContent` に `attachments?: TaskAttachment[]` を追加する。
   - `resolveTaskContent()` の PR 分岐で `resolvePrReviewImageAttachments()` を呼び、置換済み task と attachments を返す。
   - `execute.ts` から `runWorkflow()` へ `taskContent.attachments` を渡す。
   - `runWorkflow()` は attachments がある場合、既存 `selectAndExecuteTask()` と同様に `prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` を使って run context の `order.md` と `attachments/` を用意し、`executeTask()` へ task spec 参照を渡す。
   - pipeline では task list に積まないため、準備した `.takt/tasks/...` の一時 task spec は実行後に cleanup する。
   - 既存 `traceTaskContext` は維持する。

6. テストを追加・更新する。
   - `prReviewImageAttachments` の単体テスト:
     - PR body / comments / reviews を走査する
     - Markdown image を `[Image #N]` に置換する
     - HTML img を `[Image #N]` に置換する
     - allowlist 外 URL は取得しない
     - 同一 URL は同一 placeholder へ置換する
     - Content-Type mismatch を reject する
     - magic bytes mismatch を reject する
     - サイズ超過を reject する
   - `addTask.test.ts`:
     - `--pr` で画像付き PR から `.takt/tasks/<slug>/attachments/image-1.png` が作られる
     - `order.md` に `## 添付画像` と `- [Image #1]: \`attachments/image-1.png\`` が入る
     - 本文の画像記法が `[Image #1]` に置換される
   - `pipelineExecution.test.ts` または `pipeline-steps.test.ts`:
     - pipeline `--pr` で attachments 付き task spec が run context に stage され、`executeTask()` に task spec 参照が渡る
   - 既存 `saveTaskFile.test.ts` は attachment 保存機構の根拠として維持し、必要なら新規期待を追加する。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、および pipeline mode の `takt --pr <number>` / `takt --pipeline --pr <number>` 相当の既存 CLI 経路 |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | PR 取得が成功し、本文・通常コメント・review summary・review thread comment 内に allowlisted GitHub attachment URL を含む Markdown image または HTML img が存在すること |
| 認証条件 | GitHub private image 対応のため、`gh auth token --hostname github.com` が成功すること |
| URL条件 | GitHub attachment URL allowlist に一致すること。外部 URL は取得しない |
| 未対応項目 | 任意外部画像 URL、GitLab attachment URL、Markdown image / HTML img 以外の独自記法は未対応 |

## 実装ガイドライン
- `src/infra/github/pr.ts` へ画像処理を追加しない。PR 取得責務と画像 attachment 化責務を分ける。
- `GitProvider` interface へ今回不要なメソッドを追加しない。GitLab provider や既存モックへ不要な契約変更を広げない。
- `PrReviewData` は直接 mutate せず、置換済みコピーを作る。
- `TaskAttachment` は `StoredImageAttachment` と同じ構造なので、下位層では shared type を使い、feature 層で `TaskAttachment` として渡す。
- `saveTaskFile()` への attachments 配線は `takt add --pr` の PR 分岐で必ず行う。根拠: `src/features/tasks/add/index.ts:39-48`
- pipeline 側は `TaskContent.attachments` を追加したら、`resolveTaskContent()`、`execute.ts`、`runWorkflow()` まで全て配線する。配線漏れ防止のため `rg "TaskContent"` と `rg "runWorkflow\\("` で呼び出し元を確認する。
- 画像 download 失敗、Content-Type mismatch、magic bytes mismatch、サイズ超過は fail fast にする。安全性要件を満たせない画像を黙って除外しない。
- allowlist 外 URL は安全境界外なので fetch しない。本文も置換しない。
- cleanup は成功・失敗の両方で実行する。`saveTaskFile()` または pipeline staging が attachment をコピーする前に temp file を消さない。
- MIME / magic bytes 判定は shared utility に寄せ、inline paste と PR download で同じ判定を使う。
- 既存の `order.md` attachment section 形式は変えない。根拠: `src/features/tasks/attachments.ts:34-44`
- 既存の task attachment promotion の validation を弱めない。根拠: `src/features/tasks/attachments.ts:90-97`
- PR body に画像だけがあり comments/reviews が空の場合は task 作成を許可する。それ以外の comments/reviews 空 PR を一律作成する変更は避ける。
- エラーメッセージや UI 文言は新機能に必要なものだけ追加し、既存文言の不要な変更はしない。
- テストダブルは download 関数の呼び出し URL、MIME、body bytes、cleanup の副作用を検証する。単に「呼ばれた」だけのテストにしない。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| 任意外部 URL の画像取得 | 明示制約「外部 URL を無制限に取得しない」に反するため |
| GitLab MR 画像 attachment 対応 | 要求は GitHub PR コメント画像と `gh` 認証を前提にしているため |
| Markdown image / HTML img 以外の記法対応 | 明示された対象記法に含まれないため |
| 画像のリサイズ・変換・最適化 | 要求にないため |
| attachment section の形式変更 | 既存形式で追記する要求のため |
| `GitProvider` 公開契約の拡張 | 今回の要求達成に不要で、provider 全体へ影響が広がるため |
| 既存 PR 取得処理の大規模リファクタリング | 画像 attachment 対応に直接必要な範囲を超えるため |

## 確認事項
なし。