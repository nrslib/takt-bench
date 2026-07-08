# タスク計画

## 元の要求
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

## 分析結果

### 目的
`takt add --pr <number>`、非 pipeline の `takt --pr <number>`、pipeline の `takt --pipeline --pr <number>` で、PR 本文・通常コメント・review summary・review thread comment に含まれる GitHub 画像 URL を検出し、既存の task attachment 形式で `.takt/tasks/<slug>/attachments/` または実行用 task spec に配置できるようにする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | PR 本文から画像 URL を検出する | 明示 | `PrReviewData.body` は既に取得されている |
| 2 | 通常コメントから画像 URL を検出する | 明示 | `PrReviewData.comments[].body` は既に取得されている |
| 3 | review summary から画像 URL を検出する | 明示 | `PrReviewData.reviews[]` のうち `path` なしとして扱われる |
| 4 | review thread comment から画像 URL を検出する | 明示 | GraphQL reviewThreads の `comments.nodes[].body` は既に取得されている |
| 5 | Markdown image syntax を抽出対象にする | 明示 | `![alt](url)` |
| 6 | HTML `<img src="...">` を抽出対象にする | 明示 | single quote / double quote / 属性順の差分を扱う |
| 7 | GitHub attachment URL のみ取得対象にする | 明示 | 任意外部 URL の無制限取得を避ける |
| 8 | 画像を認証付きで取得する | 明示 | `gh auth token --hostname` を使った GitHub token 取得を優先する |
| 9 | PNG を対応形式にする | 明示 | Content-Type と magic bytes の両方を検証する |
| 10 | JPEG を対応形式にする | 明示 | `.jpg` / `.jpeg` は保存ファイル名では既存形式に合わせる |
| 11 | GIF を対応形式にする | 明示 | `GIF87a` / `GIF89a` を検証する |
| 12 | WebP を対応形式にする | 明示 | `RIFF....WEBP` を検証する |
| 13 | サイズ上限を設ける | 明示 | 既存 inline image と同じ 10 MiB を共通化する |
| 14 | `TaskAttachment[]` を生成する | 明示 | 既存 attachment 保存経路へ渡すため |
| 15 | `.takt/tasks/<slug>/attachments/` に保存する | 明示 | `saveTaskFile()` 経路では既存機構を利用する |
| 16 | `order.md` に `## 添付画像` と attachment 行を追記する | 明示 | 既存 `buildTaskOrderContent()` が対応済み |
| 17 | 元コメント本文内の画像参照を `[Image #N]` に置換する | 明示 | 「可能なら」に対し、task 化前の `PrReviewData` 正規化で実現する |
| 18 | pipeline の `--pr` 経路でも画像参照を使えるようにする | 明示 | pipeline は現状 `executeTask()` 直呼びで attachment 付き task spec を通らない |
| 19 | temp attachment を cleanup する | 暗黙 | 明示要件「ダウンロードする」から派生。保存・stage 後の一時ファイル漏れを防ぐ |
| 20 | 新規ロジックに単体テストを追加する | 明示 | 抽出、検証、配線を分けて検証する |
| 21 | `npm run build`、`npm run lint`、`npm test` が成功すること | 明示 | 実装後の検証コマンド |

### 参照資料の調査結果
明示的な「参照資料」セクションはなかった。参考実装方針に挙がっていた `src/infra/github/pr.ts` を確認した。

確認した現在実装:
- `src/infra/github/pr.ts:108` で `gh pr view` は `number,title,body,url,headRefName,baseRefName,comments,reviews,files` を取得している。
- `src/infra/github/pr.ts:127` 以降の GraphQL query は review thread comment の `body` を取得している。
- `src/infra/github/pr.ts:421` の `fetchPrReviewComments()` は PR body、通常コメント、review summary、review thread comment を `PrReviewData` に集約している。
- `src/infra/git/format.ts:197` の `formatPrReviewAsTask()` は `PrReviewData` を task markdown に変換している。
- `src/features/tasks/attachments.ts:26` の `buildTaskOrderContent()` は attachment が渡された場合に `## 添付画像` と `- [Image #N]: \`attachments/image-N.ext\`` を追記する。
- `src/features/tasks/attachments.ts:79` の `promoteTaskAttachments()` は attachment temp file を `.takt/tasks/<slug>/attachments/` にコピーする。
- `src/features/tasks/add/index.ts:39` の `saveTaskFile()` は `attachments` を受け取れる。
- `src/features/tasks/add/index.ts:199` の `takt add --pr` 経路は現状 `attachments` を渡していない。
- `src/app/cli/routing-inputs.ts:50` の `resolvePrInput()` は PR を `initialInput` 文字列にするだけで attachment を返していない。
- `src/app/cli/routing.ts:179` の `interactiveSeed` は `attachments` を含めていない。
- `src/features/pipeline/steps.ts:229` の `runWorkflow()` は `executeTask()` を直接呼ぶため、`selectAndExecuteTask()` の attachment 付き task spec 経路を通らない。
- `src/features/interactive/inlineImagePaste.ts:9` に既存の 10 MiB 上限がある。
- `src/features/interactive/inlineImagePaste.ts:45` に既存の magic bytes 判定があるが、private 関数のため PR 画像取得から再利用できない。

主要な差異:
- PR コメント本文の取得は既に十分だが、画像 URL 抽出・ダウンロード・`TaskAttachment[]` 生成・本文置換がない。
- task attachment の保存機構はあるが、`--pr` 系呼び出し元から attachment が配線されていない。
- pipeline は attachment 付き task spec を作る既存 helper を経由しないため、別途 stage 処理が必要。

### スコープ
影響範囲:
- PR レビュー task 化前の画像 URL 抽出・本文正規化。
- GitHub attachment URL の安全なダウンロード。
- `takt add --pr` の保存時 attachment 配線。
- 非 pipeline `takt --pr` の interactive seed attachment 配線。
- pipeline `--pr` の task spec 準備・実行 prompt 配線。
- 画像形式・サイズ・Content-Type・magic bytes の単体テスト。
- PR 経路の wiring test。

変更不要:
- `PrReviewData` の PR 本文・コメント取得フィールド追加は不要。対象本文は既に取得済み。
- `order.md` の attachment section 形式は既存 `buildTaskOrderContent()` で満たしているため変更不要。
- `.takt/tasks/<slug>/attachments/` へのコピー処理は既存 `promoteTaskAttachments()` で満たしているため変更不要。
- GitLab PR/MR 添付画像対応は今回の明示要件外。

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `PrReviewData` に `attachments?: TaskAttachment[]` を追加する | 不採用 | `PrReviewData` は provider-neutral な infra/git 型であり、task 層の attachment 型を混ぜると公開 API の抽象度が崩れる |
| `fetchPrReviewComments()` 内で画像ダウンロードまで行う | 不採用 | PR データ取得と task attachment 作成の責務が混ざる。GitHub provider の取得関数が temp file lifecycle を持ってしまう |
| PR fetch 後、task 機能側で `PrReviewData` を正規化して attachments を作る | 採用 | 指示の「PR 取得後の `PrReviewData` から画像 URL を抽出する」に合い、既存保存経路へ `TaskAttachment[]` を渡せる |
| 画像 magic bytes 判定を新規モジュールに重複実装する | 不採用 | 既存 inline image と同じ PNG/JPEG/GIF/WebP 判定があるため、共通化した方が仕様差分を作らない |
| 既存 `inlineImagePaste.ts` の private 関数を export して infra から import する | 不採用 | infra/github から features/interactive へ依存する形になり、依存方向が悪い |
| `src/shared/utils/imageMime.ts` のような shared utility に切り出す | 採用 | interactive paste と PR attachment download の両方から使える。責務は画像 MIME 判定に限定できる |
| pipeline で `selectAndExecuteTask()` を呼ぶように変える | 不採用 | pipeline の既存 git/commit/push 制御と task list 非経由の実行構造を大きく変える |
| pipeline に attachment 用 task spec prepare/stage を追加する | 採用 | 既存 pipeline 構造を保ったまま、attachment 付き prompt を `executeTask()` に渡せる |

### 実装アプローチ
1. 画像 MIME 判定を shared 化する。
   - `src/shared/utils/imageMime.ts` を追加する。
   - `MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024` を定義する。
   - Content-Type 正規化、magic bytes 判定、Content-Type と magic bytes の一致検証、拡張子解決を持たせる。
   - `src/features/interactive/inlineImagePaste.ts` は既存 private 判定を shared helper 利用へ置き換える。

2. GitHub attachment download を infra/github に追加する。
   - `src/infra/github/attachmentDownload.ts` を追加する。
   - 許可 URL は GitHub attachment 系に限定する。
     - `https://github.com/user-attachments/assets/...`
     - `https://github.com/<owner>/<repo>/assets/...`
     - `https://private-user-images.githubusercontent.com/...`
     - `https://user-images.githubusercontent.com/...`
   - 任意外部 URL は取得しない。
   - `gh auth token --hostname <hostname>` を使って token を取得する。`gh auth token --help` で `--hostname` が存在することは確認済み。
   - redirect は自動追従に任せず、各 redirect 先も allowlist を通す。
   - `Content-Length` が上限超過なら読み込み前に失敗する。
   - body 読み込み後も byte length 上限を検証する。
   - Content-Type と magic bytes の両方を検証する。
   - 戻り値は `{ data: Buffer; mimeType: string; extension: string }` のような provider-neutral な画像データにする。

3. PR review image attachment preparation を task 側に追加する。
   - `src/features/tasks/prReviewImageAttachments.ts` を追加する。
   - 入力: `PrReviewData`, `cwd`。
   - 出力: `{ prReview: PrReviewData; attachments: TaskAttachment[]; cleanupAttachments: () => void }`。
   - `PrReviewData.body`、`comments[].body`、`reviews[].body` を走査する。
   - Markdown image syntax と HTML img src を抽出する。
   - allowlist 外 URL は本文を変更せず、ダウンロードもしない。
   - allowlist 内 URL は初出順に `[Image #N]` を割り当てる。
   - 同一 URL は同じ placeholder に dedupe する。
   - Markdown image / HTML img tag は `[Image #N]` に置換する。
   - temp directory は `os.tmpdir()` 配下に private mode で作り、保存ファイルは `image-1.png` などにする。
   - cleanup 関数で temp directory を削除する。

4. `takt add --pr` に配線する。
   - `src/features/tasks/add/index.ts` の PR branch で、fetch 後に `preparePrReviewImageAttachments()` を呼ぶ。
   - 正規化済み `prReview` を `formatPrReviewAsTask()` に渡す。
   - `saveTaskFile()` に `attachments` を渡す。
   - `try/finally` で `cleanupAttachments()` を呼ぶ。
   - PR にレビューコメントがない場合の既存エラー挙動は変えない。

5. 非 pipeline `takt --pr` に配線する。
   - `src/app/cli/routing-inputs.ts` の `resolvePrInput()` 戻り値に `attachments?: TaskAttachment[]` と `cleanupAttachments?: () => void` を追加する。
   - `src/app/cli/routing.ts` で PR result の attachments を保持する。
   - `interactiveSeed` に `{ attachments }` を含める。
   - `dispatchConversationAction()` 後の finally で、既存 `cleanupInteractiveResultAttachments(result)` に加えて PR 由来 temp cleanup を呼ぶ。
   - `createSessionImageAttachmentStore(initialInput?.attachments)` は既に initial attachments を受け取れるため、assistant / quiet / persona への配線は最小変更で済む。

6. pipeline `--pr` に配線する。
   - `src/features/pipeline/steps.ts` の `TaskContent` に `attachments?: TaskAttachment[]` と `cleanupAttachments?: () => void` を追加する。
   - `resolveTaskContent()` の PR branch で attachment preparation を行う。
   - `runPipeline()` から `runWorkflow()` に attachments を渡す。
   - `runWorkflow()` は attachments がある場合、`prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` で task spec を作り、`executeTask()` には `stagedSpec.taskPrompt` を渡す。
   - prepared temp task spec は cleanup するが、run context に stage した task spec は実行レポートとして残す。これは `selectAndExecuteTask()` の挙動と合わせる。
   - pipeline の PR temp attachment cleanup は `runPipeline()` の finally で行う。

7. 既存 helper の重複を避ける。
   - `selectAndExecuteTask()` の attachment prepare/stage と pipeline の新規処理が重複しすぎる場合は、`src/features/tasks/execute/taskSpecContext.ts` に小さな helper を追加する。
   - helper は「attachment 付き task spec を prepared spec に保存し、run context に stage する」責務に限定する。
   - pipeline 固有の git/branch 処理は helper に入れない。

8. テストを追加・更新する。
   - 新規 `prReviewImageAttachments` test:
     - PR body の Markdown image を placeholder に置換する。
     - 通常コメントの HTML img を placeholder に置換する。
     - review thread comment 相当の `reviews[].body` を置換する。
     - 同一 URL は同じ placeholder を使う。
     - allowlist 外 URL は取得しない。
   - 新規 `attachmentDownload` test:
     - Content-Type と magic bytes が一致する PNG/JPEG/GIF/WebP を受け入れる。
     - Content-Type mismatch を拒否する。
     - magic bytes 不一致を拒否する。
     - `Content-Length` 上限超過を拒否する。
     - redirect 先が allowlist 外なら拒否する。
   - `addTask.test.ts`:
     - `takt add --pr` で `order.md` に `## 添付画像` と `attachments/image-1.png` が含まれること。
   - `cli-routing-pr-resolve.test.ts`:
     - `resolvePrInput()` 由来 attachments が `interactiveSeed` に渡ること。
   - `pipelineExecution.test.ts`:
     - pipeline `--pr` で attachment 付き task spec prompt が `executeTask()` に渡ること。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、`takt --pipeline --pr <number>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts` |
| 起動条件 | PR fetch 成功、`gh` CLI 認証利用可能、コメント本文内に allowlist 対象の GitHub image URL があること |
| 未対応項目 | GitLab attachment URL、任意外部 image URL、SVG 等の非 PNG/JPEG/GIF/WebP は今回の対象外 |

## 実装ガイドライン
- `PrReviewData` / `GitProvider` に task attachment 型を追加しない。provider-neutral な型に feature/task 層の詳細を混ぜない。
- PR コメント取得処理そのものは `src/infra/github/pr.ts` に残し、画像 attachment 作成は PR fetch 後の task preparation として実装する。
- Markdown/HTML 抽出、ダウンロード、本文置換、temp file cleanup を 1 関数に詰め込まない。抽出・取得・正規化・cleanup の責務を分ける。
- 任意外部 URL を fetch しない。allowlist 判定を通った GitHub attachment URL のみ取得する。
- redirect 先も allowlist 判定する。最初の URL だけ安全確認して終わらせない。
- Content-Type だけで画像種別を信用しない。magic bytes と一致させる。
- magic bytes だけで画像種別を信用しない。Content-Type も supported image type であることを要求する。
- temp file は保存・stage 後に必ず cleanup する。`takt --pr` の interactive 経路では、対話が終わるまで temp file を残し、finally で削除する。
- `options?.attachments ?? []` のようなフォールバックで配線漏れを隠さない。attachments を渡す必要がある呼び出し元を明示的に更新する。
- pipeline の既存 git/branch/commit/push 制御は変えない。attachment 付き task spec の準備だけを追加する。
- 既存 `buildTaskOrderContent()` の attachment section 形式を変更しない。
- `order.md` の文言 `## 添付画像` と `- [Image #N]: \`attachments/image-N.ext\`` は既存形式に合わせる。
- 既存 inline paste の 10 MiB 上限と対応 MIME 種別と差分を作らない。共通 helper に切り出して利用する。
- 後方互換用の legacy URL 変換や未要求の provider 拡張は追加しない。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| GitLab MR コメント内画像の取得 | 要求は GitHub private repository 画像と GitHub attachment URL が対象 |
| 任意外部画像 URL の取得 | 安全性制約で「外部 URL を無制限に取得しない」と指定されている |
| SVG / BMP / TIFF 等の対応 | 対応形式はまず PNG/JPEG/GIF/WebP と明示されている |
| `order.md` attachment section の形式変更 | 既存形式が要求を満たしている |
| `GitProvider` 公開 API の attachment 対応 | task attachment は task 保存・実行側の関心であり、provider API に混ぜない |

## 確認事項
なし。