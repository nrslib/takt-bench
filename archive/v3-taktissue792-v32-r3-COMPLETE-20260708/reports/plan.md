# タスク計画

## 元の要求
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

背景:
- 現状、`takt add --pr` や `takt --pr` では PR 本文・通常コメント・review thread の本文は取得されるが、コメント内に貼られた PNG などの画像はローカルの `attachments/` に保存されない。
- 既存の task attachment 仕組みはあるため、PR コメント中の画像 URL を抽出して `TaskAttachment[]` として渡せば、`.takt/tasks/<slug>/attachments/` 配下に配置できるはず。

期待する挙動:
- `takt add --pr <number>` 実行時に、PR 本文・通常コメント・review thread コメント内の画像 URL を検出する
- 対応画像をローカルにダウンロードする
- `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する
- `order.md` に既存 attachment 形式で追記する
- 元コメント本文内の画像参照も、可能なら `[Image #1]` のように参照できる形に置換または補足する
- pipeline の `--pr` 経路でも同等に画像を参照できること

対象画像記法:
- `![screenshot](https://github.com/user-attachments/assets/...)`
- `![image](https://github.com/org/repo/assets/...)`
- `<img src="https://github.com/user-attachments/assets/..." />`

安全性・制約:
- 対応形式はまず PNG/JPEG/GIF/WebP
- Content-Type と magic bytes を検証する
- サイズ上限を設ける
- GitHub の private repository 画像に対応するため、`gh api` または認証済み `gh` 経由の取得を優先する
- 外部 URL を無制限に取得しない。GitHub attachment URL から始めるのが安全

品質要件:
- 既存のテスト規約に従い、新規ロジックには単体テストを追加する
- `npm run build`、`npm run lint`、`npm test` が全て成功すること

## 分析結果

### 目的
PR 取得経路で本文中の GitHub attachment 画像 URL を安全に抽出・取得し、既存の `TaskAttachment[]` として task spec に渡すことで、保存済み task と pipeline 直実行の両方から画像を参照できるようにする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | PR 本文から画像 URL を抽出する | 明示 | `PrReviewData.body` が対象 |
| 2 | 通常 conversation comment から画像 URL を抽出する | 明示 | `PrReviewData.comments[].body` が対象 |
| 3 | review summary から画像 URL を抽出する | 明示 | `PrReviewData.reviews[].body` のうち `path` なしも対象 |
| 4 | review thread comment から画像 URL を抽出する | 明示 | `PrReviewData.reviews[].body` のうち `threadState` ありも対象 |
| 5 | Markdown image syntax を検出する | 明示 | `![alt](url)` |
| 6 | HTML `<img src="...">` を検出する | 明示 | quoted `src` を対象 |
| 7 | GitHub attachment URL のみ初期取得対象にする | 明示 | 外部 URL 無制限取得を避ける |
| 8 | 対応画像をダウンロードする | 明示 | PNG/JPEG/GIF/WebP |
| 9 | Content-Type を検証する | 明示 | 許可 MIME のみ |
| 10 | magic bytes を検証する | 明示 | MIME と実データの一致を確認 |
| 11 | サイズ上限を設ける | 明示 | 既存 inline image の 10MB 方針を再利用するのが妥当 |
| 12 | private repository 画像に対応する | 明示 | `gh auth token` による認証済み HTTPS 取得を計画 |
| 13 | `TaskAttachment[]` を生成する | 暗黙 | 既存 task attachment 機構へ渡すため |
| 14 | `order.md` に既存 attachment 形式で追記する | 明示 | 既存 `buildTaskOrderContent()` で対応済み、配線が必要 |
| 15 | 元本文中の画像参照を `[Image #n]` に置換する | 明示 | `formatPrReviewAsTask()` 前に `PrReviewData` の本文を置換 |
| 16 | `takt add --pr` で attachment を保存する | 明示 | `saveTaskFile()` に attachments を渡す |
| 17 | `takt --pr` の interactive seed に attachment を渡す | 明示 | sourceContext 内 placeholder を AI 呼び出し時に解決するため |
| 18 | pipeline `--pr` で attachment 付き task spec を使う | 明示 | `executeTask()` 直渡しではなく task spec staging が必要 |
| 19 | 新規ロジックに単体テストを追加する | 明示 | 抽出・検証・配線を分けて検証 |
| 20 | `npm run build` / `npm run lint` / `npm test` を通す | 明示 | 後続ステップで実行 |

### 参照資料の調査結果
タスク指示内に「参照資料」セクションとして指定されたファイル・ディレクトリはなかった。したがって、実ソースコードと Knowledge Source を根拠に調査した。

確認した主要な現行実装:
- 既存 attachment 保存処理は `src/features/tasks/attachments.ts:26` の `buildTaskOrderContent()` が `## 添付画像` と attachment 行を生成し、`src/features/tasks/attachments.ts:79` の `promoteTaskAttachments()` が temp file を task dir 配下へコピーする。
- `saveTaskFile()` は `src/features/tasks/add/index.ts:39` で `attachments?: TaskAttachment[]` を受け取り、`src/features/tasks/add/index.ts:45` で `prepareTaskSpecDirectory()` へ渡せる。
- `takt add --pr` は `src/features/tasks/add/index.ts:173` から PR 取得を行うが、`src/features/tasks/add/index.ts:213` の `saveTaskFile()` 呼び出しに attachments を渡していない。
- `takt --pr` は `src/app/cli/routing-inputs.ts:50` の `resolvePrInput()` で `initialInput` 文字列だけを返し、attachments を返していない。
- pipeline `--pr` は `src/features/pipeline/steps.ts:144` の `resolveTaskContent()` が task 文字列だけを返し、`src/features/pipeline/steps.ts:229` の `runWorkflow()` が `executeTask()` に直接渡している。
- PR データ構造は `src/infra/git/types.ts:90` の `PrReviewData` に body/comments/reviews/files を持つ。
- PR task 文字列化は `src/infra/git/format.ts:197` の `formatPrReviewAsTask()` が担い、PR body、review summaries、active/outdated/resolved review threads、conversation comments を出力している。
- GitHub PR 取得実装は `src/infra/github/pr.ts:421` の `fetchPrReviewComments()` が `gh pr view` と GraphQL reviewThreads から `PrReviewData` を組み立てている。
- magic bytes 判定は pasted inline image 用に `src/features/interactive/inlineImagePaste.ts:45` にあるが、PR attachment 用には存在しない。
- `src/infra/github/pr.ts` は 547 行あり、画像抽出・ダウンロードまで追加すると責務過多になる。

### スコープ
影響範囲:
- PR 画像 URL 抽出・本文置換の新規 task feature モジュール
- GitHub attachment 画像ダウンロードの新規 infra モジュール
- 画像 MIME / magic bytes 判定の shared utility
- `takt add --pr` 経路
- `takt --pr` interactive seed 経路
- pipeline `--pr` 経路
- 既存 attachment 保存 / task spec staging との配線
- 単体テスト

変更不要または最小変更:
- `src/features/tasks/attachments.ts` の `order.md` 追記・ファイル昇格処理は既に要件を満たしているため、基本的に変更不要。
- `PrReviewData` 自体に attachment フィールドを足す必要はない。PR の本文置換済みコピーと `TaskAttachment[]` を別に返せばよい。
- `GitProvider` interface に GitHub 専用 downloader を追加しない。GitLab provider へ no-op 実装を強制する必要が生じるため。

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/infra/github/pr.ts` に抽出・ダウンロード処理を直接追加する | 不採用 | 既に 547 行で PR 取得と GraphQL thread 取得を持つ。画像保存まで入れると 1 モジュール複数責務になる |
| `GitProvider` interface に `downloadPrAttachments()` を追加する | 不採用 | GitHub attachment URL 専用要件であり、GitLab provider に不要な実装を強いる |
| `formatPrReviewAsTask()` の中で URL 抽出・ダウンロードする | 不採用 | provider-neutral formatter に IO と GitHub 認証が混入する |
| PR データを置換済みコピーへ変換し、attachments と一緒に呼び出し元へ返す | 採用 | formatter は純粋な文字列化のまま維持でき、既存 attachment 保存契約に接続しやすい |
| 画像 MIME 判定を新規 shared utility に切り出す | 採用 | 既存 inline image と PR image の PNG/JPEG/GIF/WebP 判定を重複させずに済む |
| `gh api` のみで画像取得する | 不採用寄り | ローカル `gh api --help` 上、endpoint は GitHub API v3 または GraphQL 用。`github.com/user-attachments/...` の任意 URL 取得には確証がない |
| `gh auth token` + Node 標準 `https` で取得する | 採用 | 認証済み `gh` を利用しつつ、GitHub attachment URL の binary 取得に対応しやすい |

### 実装アプローチ
1. `src/shared/utils/imageMime.ts` を追加する。
   - `SUPPORTED_IMAGE_MIME_TYPES`
   - `MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024`
   - `inferImageMimeTypeFromMagicBytes(data: Buffer): ImageMimeType | null`
   - `extensionForImageMimeType(mimeType: ImageMimeType): 'png' | 'jpg' | 'gif' | 'webp'`
   - `parseImageContentType(header: string | undefined): ImageMimeType`
   - `assertImageMimeMatchesBytes(contentTypeMime, data)`
   - 既存 `inlineImagePaste.ts` と `imageAttachments.ts` の private 判定をこの shared utility へ寄せる。

2. `src/infra/github/attachmentDownloads.ts` を追加する。
   - 初期 URL を GitHub attachment allowlist で検証する。
   - `gh auth token` で token を取得する。
   - Node 標準 `https` で GET し、`Authorization: Bearer <token>` を付ける。
   - redirect は HTTPS かつ回数上限付きで追跡する。
   - 読み込み中に byte count を監視し、上限超過で中断する。
   - response の Content-Type と magic bytes を検証し、MIME から拡張子を決める。
   - 不許可 URL、非対応 MIME、Content-Type/magic mismatch、サイズ超過は fail fast。

3. `src/features/tasks/prReviewImageAttachments.ts` を追加する。
   - `PrReviewData` から body/comment/review body を走査する。
   - Markdown image と HTML img を検出する。
   - URL を出現順に dedupe する。
   - ダウンロード結果を `TaskAttachment[]` に変換する。
   - 対応する本文の画像記法を `[Image #n]` に置換した `PrReviewData` コピーを返す。
   - 戻り値は `{ prReview, attachments, cleanupAttachments }` のようにし、呼び出し元が保存・実行後に temp cleanup できるようにする。
   - 途中で失敗した場合は作成済み temp file/dir を cleanup してから例外を投げる。

4. `src/features/tasks/add/index.ts` の PR 経路を更新する。
   - `provider.fetchPrReviewComments()` 後、`formatPrReviewAsTask()` 前に画像解決を行う。
   - `formatPrReviewAsTask(resolved.prReview)` を使う。
   - `saveTaskFile(cwd, taskContent, { ..., attachments: resolved.attachments })` にする。
   - try/finally で `cleanupAttachments` を呼ぶ。
   - 現在 `src/features/tasks/add/index.ts:194` は reviews/comments が両方空なら拒否しているが、要件上 PR body も対象なので、body が存在する場合は拒否しない判定に変更する。

5. `src/app/cli/routing-inputs.ts` と `src/app/cli/routing.ts` を更新する。
   - `resolvePrInput()` の戻り値に `attachments` と `cleanupAttachments` を追加する。
   - `routing.ts` の `interactiveSeed` に `attachments` を含める。
   - `src/features/interactive/interactive.ts:187` の `InteractiveSeedInput.attachments` は既に存在する。
   - `src/features/interactive/conversationLoop.ts:140` と `src/features/interactive/quietMode.ts:61` は initial attachments を session attachment store に渡しているため、sourceContext 内 `[Image #n]` は `resolvePromptImageAttachments()` で解決できる。
   - `routing.ts` 側で PR attachment の cleanup を finally で実行する。既存 interactive result cleanup だけでは、initial attachment の元 temp dir までは削除されない可能性があるため。

6. pipeline `--pr` を更新する。
   - `src/features/pipeline/steps.ts:18` の `TaskContent` に `attachments?: TaskAttachment[]` を追加する。
   - `resolveTaskContent()` は async 化を検討する。画像ダウンロードは async になるため、`src/features/pipeline/execute.ts:40` の呼び出しも `await resolveTaskContent(options)` に変える。
   - `runWorkflow()` に `attachments` を渡す。
   - attachments がある場合、`prepareTaskSpecDirectory(projectCwd, task, attachments)` と `stageTaskSpecForExecution(projectCwd, execCwd, preparedSpec.taskDirRelative, reportDirName)` を使って `executeTask()` へ `stagedSpec.taskPrompt` を渡す。
   - 準備用 `.takt/tasks/...` は pipeline 直実行では永続 task ではないため、staging 後または workflow 終了後に cleanup する。run context 側の staged task は実行レポートとして残す。

7. エラー処理。
   - `takt add --pr`: 画像処理失敗時は task を作成せず、既存の PR fetch failure と同様に terminal error を出す。
   - `takt --pr`: 画像処理失敗時は起動前にエラー終了する。
   - pipeline `--pr`: 画像処理失敗時は `EXIT_ISSUE_FETCH_FAILED` 相当の既存 fetch failure 経路へ寄せる。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、`takt --pipeline --pr <number> --workflow <workflow>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | `--pr` が指定され、PR body/comments/reviews/review thread comments に許可済み GitHub attachment URL が含まれること |
| 認証条件 | GitHub provider で `gh auth status` が成功し、`gh auth token` で token が取得できること |
| URL 条件 | 初期 URL は GitHub attachment allowlist に一致する HTTPS URL のみ |
| 未対応項目 | GitLab MR attachment URL の取得は今回の要求外。任意外部 URL の取得も対象外 |

## 実装ガイドライン
- 既存 attachment 保存契約を再利用すること。`order.md` 追記や `attachments/` コピーを再実装しない。根拠: `src/features/tasks/attachments.ts:26`、`src/features/tasks/attachments.ts:79`。
- PR 本文置換は `formatPrReviewAsTask()` の前に行うこと。formatter に IO や GitHub 固有処理を入れない。根拠: `src/infra/git/format.ts:197` は provider-neutral formatter。
- `src/infra/github/pr.ts` へ画像処理を詰め込まないこと。既に 547 行あり、PR 取得と GraphQL pagination の責務を持っている。
- `GitProvider` interface に GitHub attachment 専用メソッドを追加しないこと。GitLab provider に不要な no-op を作るのは公開 API の責務拡大になる。
- `options?.attachments ?? []` のような、値の流れを隠す fallback を多用しないこと。attachments がある場合だけ明示的に渡す。
- ダウンロード失敗を黙って skip しないこと。許可済み画像 URL を検出したのに取得・検証できない場合は fail fast とする。
- 同じ URL は重複ダウンロードせず、最初に割り当てた placeholder を再利用すること。
- Content-Type だけ、または拡張子だけで判定しないこと。Content-Type と magic bytes の両方を検証する。
- redirect は無制限に追跡しないこと。HTTPS と回数上限を設ける。
- private temp file は `0o600`、temp dir は `0o700` の既存 image attachment store 方針に合わせること。根拠: `src/features/interactive/imageAttachments.ts:30`。
- `takt --pr` 経路では initial attachments の cleanup を忘れないこと。`InteractiveSeedInput.attachments` は既にあるが、既存 store cleanup は新 session dir を消すだけで、外部から渡された temp dir を必ず消すとは限らない。
- pipeline `--pr` では attachment がある場合のみ task spec staging を使うこと。attachment なしの既存実行経路は不要に変えない。
- `src/features/tasks/add/index.ts:194` の「reviews/comments が空なら拒否」は PR body を考慮するよう更新すること。PR body 内画像という明示要件に直接関係する。

## テスト計画
| テスト対象 | 追加・更新内容 |
|-----------|----------------|
| 新規 PR image extraction テスト | Markdown image、HTML img、複数 body source、dedupe、placeholder 置換を検証 |
| 新規 download validation テスト | 許可 URL、非許可 URL、Content-Type mismatch、magic bytes mismatch、サイズ超過、PNG/JPEG/GIF/WebP を検証 |
| `src/__tests__/addTask.test.ts` | `takt add --pr` で画像付き PR comment/body から task dir attachments と `## 添付画像` が作られること |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | `resolvePrInput()` から interactive seed へ attachments が渡ること |
| `src/__tests__/pipelineExecution.test.ts` | pipeline `--pr` で attachments 付き task spec prompt が `executeTask()` に渡ること |
| 既存 attachment tests | `saveTaskFile.test.ts` の既存期待は維持する |

後続ステップで実行すべき検証コマンド:
- `npm run build`
- `npm run lint`
- `npm test`

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| GitLab MR attachment URL の取得 | 要求は GitHub attachment URL を安全な開始点としているため |
| 任意外部画像 URL の取得 | 「外部 URL を無制限に取得しない」という制約に反するため |
| 画像以外の添付ファイル対応 | 対応形式は PNG/JPEG/GIF/WebP と明示されているため |
| `order.md` attachment 形式の変更 | 既存形式を使う要求であり、現在の実装が満たしているため |
| GitHub provider 以外への public API 拡張 | 今回の要件達成に不要で、不要な provider 実装を増やすため |

## 確認事項
なし。