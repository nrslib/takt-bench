# タスク計画

## 元の要求
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

背景:
現状、`takt add --pr` や `takt --pr` では PR 本文・通常コメント・review thread の本文は取得されるが、コメント内に貼られた PNG などの画像はローカルの `attachments/` に保存されない。

期待する挙動:
- `takt add --pr <number>` 実行時に、PR 本文・通常コメント・review thread コメント内の画像 URL を検出する
- 対応画像をローカルにダウンロードする
- `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する
- `order.md` に既存 attachment 形式で追記する
- 元コメント本文内の画像参照も、可能なら `[Image #1]` のように参照できる形に置換または補足する
- pipeline の `--pr` 経路でも同等に画像を参照できること

対象記法:
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
PR本文・通常コメント・review summary・review thread コメントに含まれるGitHub画像URLを安全に取得し、既存の `TaskAttachment[]` 保存機構へ渡すことで、`order.md` と `.takt/tasks/<slug>/attachments/` に画像を配置する。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | PR本文内の画像URLを検出する | 明示 | `PrReviewData.body` が対象 |
| 2 | 通常コメント内の画像URLを検出する | 明示 | `PrReviewData.comments[].body` が対象 |
| 3 | review summary内の画像URLを検出する | 明示 | `PrReviewData.reviews[]` のうち `path` なしが対象 |
| 4 | review thread コメント内の画像URLを検出する | 明示 | GraphQL取得済みの `PrReviewData.reviews[]` のうち `threadState` ありも対象 |
| 5 | Markdown画像記法を抽出する | 明示 | `![alt](url)` |
| 6 | HTML img記法を抽出する | 明示 | `<img src="url">` |
| 7 | GitHub attachment URLのみ取得対象にする | 明示 | 外部URLの無制限取得は禁止 |
| 8 | PNG/JPEG/GIF/WebPのみ保存する | 明示 | Content-Type と magic bytes の両方で判定 |
| 9 | サイズ上限を設ける | 明示 | 既存の画像添付仕様に合わせ、10MiBを採用する |
| 10 | ダウンロード画像を `TaskAttachment[]` に変換する | 明示 | 既存 `TaskAttachment = StoredImageAttachment` を利用 |
| 11 | `takt add --pr` で `saveTaskFile()` に attachments を渡す | 明示 | 現状は未配線 |
| 12 | `order.md` に `## 添付画像` と相対パスを追記する | 明示 | 既存機構を利用するため新規形式は作らない |
| 13 | 元コメント本文の画像参照を `[Image #N]` に置換する | 明示 | 画像と本文の対応を維持する |
| 14 | `takt --pr` の対話経路でも画像を参照可能にする | 明示 | `InteractiveSeedInput.attachments` に配線 |
| 15 | pipeline `--pr` でも画像を参照可能にする | 明示 | direct execution用の task spec staging が必要 |
| 16 | 一時ファイルを不要後に削除する | 暗黙 | ダウンロード処理が一時ファイルを作るため |
| 17 | 同一URLは重複ダウンロードしない | 暗黙 | `image-1.png` などの安定した対応関係を保つため |
| 18 | 既存のPR取得・整形・保存契約を要求外で変更しない | 暗黙 | スコープ規律と既存テスト維持のため |

### 参照資料の調査結果
タスク内で明示された既存実装参照は `src/infra/github/pr.ts`。

確認した主要箇所:
- `src/infra/github/pr.ts:421` の `fetchPrReviewComments()` は `gh pr view` と GraphQL reviewThreads から `PrReviewData` を作るが、画像URL抽出・ダウンロードはない。
- `src/infra/github/pr.ts:434` で通常コメント本文をそのまま `comments` に入れている。
- `src/infra/github/pr.ts:439` から review summary と thread comments を `reviews` に集約している。
- `src/infra/git/format.ts:197` の `formatPrReviewAsTask()` は `PrReviewData` を task本文へ変換するが、画像参照の置換はない。
- `src/features/tasks/attachments.ts:26` の `buildTaskOrderContent()` は attachment が渡されれば `## 添付画像` を追記できる。
- `src/features/tasks/attachments.ts:79` の `promoteTaskAttachments()` は attachment を `.takt/tasks/<slug>/attachments/` へコピーできる。
- `src/features/tasks/add/index.ts:213` の `takt add --pr` 保存経路は `attachments` を渡していない。
- `src/app/cli/routing-inputs.ts:50` の `resolvePrInput()` は `initialInput` とブランチ情報のみ返しており、attachment を返さない。
- `src/features/pipeline/steps.ts:18` の `TaskContent` は attachment を持たない。
- `src/features/tasks/execute/selectAndExecute.ts:113` には direct executionで attachment付き task spec を準備する既存パターンがある。
- `src/features/tasks/execute/taskSpecContext.ts:56` の `stageTaskSpecForExecution()` は task spec と attachments を run context にコピーできる。
- `docs/cli-reference.ja.md:237` に既存画像添付の対応形式と10MiB上限が記載されている。

`gh api --help` も確認済み。出力上、`gh api` の endpoint は GitHub API v3 path または `graphql` と説明されていたため、`github.com/user-attachments/assets/...` のようなWeb asset URL取得に直接使う前提は置かない。認証は `gh auth token` でトークンを取得し、Node標準の `fetch` に `Authorization` を付ける設計にする。

### スコープ
影響範囲:
- PR画像抽出・ダウンロード・検証の新規モジュール
- PR review data から task input を作る集約モジュール
- `takt add --pr`
- `takt --pr` 対話経路
- pipeline `--pr`
- 既存 attachment 保存・staging 経路の呼び出し追加
- 単体テストと既存PR経路テスト

変更不要:
- `order.md` の attachment 表示形式は既存の `src/features/tasks/attachments.ts:34` から `:44` を使うため変更不要。
- providerへの画像渡し形式は既存の attachment provider 経路を使うため変更不要。
- GitHub PR本文・コメント・review thread の取得自体は `src/infra/github/pr.ts:421` 以降で既に取得済みのため、取得フィールド追加は不要。
- GitLab MR画像対応は今回の明示要求外。

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `fetchPrReviewComments()` 内で画像ダウンロードまで行う | 不採用 | 現在の `GitProvider.fetchPrReviewComments()` は同期API。画像取得を `fetch` で行うと非同期化が広範囲に波及する。PR取得責務と一時ファイル副作用も混ざる。 |
| `PrReviewData` に `attachments` を追加する | 不採用 | 汎用git型に一時ファイル所有権を混ぜると cleanup 責務が不明瞭になる。 |
| `formatPrReviewAsTask()` に attachment 処理を入れる | 不採用 | provider-neutral formatting にネットワーク・ファイルIOが入り、責務分離に反する。 |
| PR task入力作成用モジュールで画像解決後に `formatPrReviewAsTask()` を呼ぶ | 採用 | PR取得後のデータ正規化、本文置換、attachment配線を1つの操作として集約でき、既存formatterと保存機構を再利用できる。 |
| pipelineで `executeTask()` に直接 attachments を追加する | 不採用 | `ExecuteTaskOptions` には attachment 概念がなく、既存の task spec staging 経路と重複する。 |
| pipelineで `prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` を使う | 採用 | `selectAndExecuteTask()` と同じ既存パターンで、run contextから画像参照できる。 |

### 実装アプローチ
1. `src/features/tasks/prReviewImageAttachments.ts` を追加する。
   - `resolvePrReviewImageAttachments(prReview, options)` を実装する。
   - 入力 `PrReviewData` を直接変更せず、本文を置換した clone と attachments を返す。
   - 返り値は `{ prReview, attachments, cleanupAttachments }`。
   - Markdown image と HTML img を抽出する。
   - 許可URLは `https://github.com/user-attachments/assets/...` と `https://github.com/{owner}/{repo}/assets/...` から始める。
   - 許可外URLは取得せず、本文も変更しない。
   - 許可URLで取得失敗・形式不一致・サイズ超過があれば fail fast。
   - 同一URLは最初の出現順で1つの attachment にまとめ、本文中の複数箇所を同じ `[Image #N]` に置換する。
   - 一時ディレクトリは `os.tmpdir()` 配下に private mode で作成し、保存ファイルは `image-1.png` などにする。
   - `Content-Type` は `image/png`, `image/jpeg`, `image/gif`, `image/webp` のみ許可する。
   - magic bytes は PNG/JPEG/GIF/WebP をそれぞれ検証し、Content-Type と一致させる。
   - `Content-Length` があれば取得前に上限確認し、取得後も Buffer長で再確認する。

2. `src/features/tasks/prReviewTaskInput.ts` を追加する。
   - `buildPrReviewTaskInput(prReview, cwd)` を実装する。
   - 内部で `resolvePrReviewImageAttachments()` を呼び、置換済み `PrReviewData` を `formatPrReviewAsTask()` に渡す。
   - 戻り値は `{ taskContent, prBranch, prBaseBranch, attachments, cleanupAttachments }`。
   - PR関連3経路が同じ正規化処理を直接重複実装しないようにする。

3. `src/features/tasks/add/index.ts` を更新する。
   - PR取得後に `buildPrReviewTaskInput()` を呼ぶ。
   - 現在の no review comments 判定は、`reviews/comments` が空かつ attachments も空の場合のみエラーにする。
   - `saveTaskFile(cwd, taskContent, { ..., attachments })` に配線する。
   - 保存成功・失敗に関わらず `cleanupAttachments()` を finally で呼ぶ。

4. `src/app/cli/routing-inputs.ts` と `src/app/cli/routing.ts` を更新する。
   - `resolvePrInput()` の戻り値に `attachments` と `cleanupAttachments` を追加する。
   - `interactiveSeed` に `attachments` を含める。
   - `interactiveMode` / `quietMode` / `personaMode` が既存の `InteractiveSeedInput.attachments` を使えるため、対話モード内部の大きな変更は不要。
   - dispatch後の finally で interactive result cleanup と PR画像一時ファイル cleanup の両方を行う。

5. `src/features/pipeline/steps.ts` と `src/features/pipeline/execute.ts` を更新する。
   - `TaskContent` に `attachments?: TaskAttachment[]` と `cleanupAttachments?: () => void` を追加する。
   - `resolveTaskContent()` を async 化する。
   - PR経路で `buildPrReviewTaskInput()` を使う。
   - `runWorkflow()` に attachments を渡せるようにする。
   - attachments がある場合は `prepareTaskSpecDirectory(projectCwd, task, attachments)` で準備し、`stageTaskSpecForExecution(projectCwd, execCwd, taskDirRelative, reportDirName)` で run context へコピーする。
   - `executeTask()` には staged task prompt を渡す。
   - pipelineでは task list へ保存しないため、準備用 `.takt/tasks/<slug>` は finally で削除する。run context 側はレポート参照のため削除しない。

6. テストを追加・更新する。
   - 新規 `src/__tests__/prReviewImageAttachments.test.ts` を追加。
   - `src/__tests__/addTask.test.ts` に `add --pr` attachment保存のテストを追加。
   - `src/__tests__/cli-routing-pr-resolve.test.ts` に PR初期attachments配線のテストを追加。
   - `src/__tests__/pipelineExecution.test.ts` に pipeline `--pr` attachment staging のテストを追加。
   - 既存の `github-pr.test.ts` / `git-format.test.ts` は必要に応じて本文置換後のformatter入力を確認する程度に留める。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、`takt --pipeline --pr <number>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | PR取得後、PR本文・通常コメント・review summary・review thread コメントに許可済みGitHub attachment URLが含まれること。画像取得には `gh auth token` で取得できる認証情報を使う。 |
| 未対応項目 | GitLab MR画像、GitHub以外の外部画像URL、旧形式URLの網羅対応はスコープ外。 |

## 実装ガイドライン
- 既存の attachment 保存形式は変更しない。`src/features/tasks/attachments.ts:26` の `buildTaskOrderContent()` と `src/features/tasks/attachments.ts:79` の `promoteTaskAttachments()` を使う。
- direct executionでattachment付きtask specを使う既存パターンは `src/features/tasks/execute/selectAndExecute.ts:113` から `:119` を参照する。
- run contextへのstagingは `src/features/tasks/execute/taskSpecContext.ts:56` の `stageTaskSpecForExecution()` を使う。
- PR本文整形は `formatPrReviewAsTask()` を残し、画像置換済み `PrReviewData` を渡す。formatterにネットワークIOやファイルIOを入れない。
- `PrReviewData` は汎用gitデータとして維持し、一時ファイル所有権を型に混ぜない。
- 画像抽出・ダウンロード・検証は1モジュールに集約し、各入口で正規表現やfetch処理を重複実装しない。
- `options?.x ?? fallback` で失敗を隠さない。認証取得、fetch失敗、Content-Type不一致、magic bytes不一致、サイズ超過は明示エラーにする。
- 外部URLを「念のため」取得対象に広げない。今回許可するGitHub attachment URL以外は無視する。
- 後方互換用の旧URLマッピングは追加しない。明示要求にないため。
- 一時ファイル cleanup は成功時だけでなく失敗時にも実行する。
- `fetch` のテストは依存注入で行い、実ネットワークに依存しない。
- `gh auth token` のテストも依存注入または child_process mock で行い、実認証状態に依存しない。
- pipelineの no-attachment 経路は既存挙動を変えない。attachment があるときだけ task spec staging を追加する。
- 画像がPR本文にだけ存在し、review/commentが空の場合は、attachmentがあるため保存対象にする。画像もない場合は既存の「review commentsなし」エラーを維持する。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| GitLab MR内画像の取得 | 要求はGitHub private repository画像とGitHub attachment URLが中心で、既存対象例もGitHub URLのみ。 |
| 任意外部URL画像の取得 | 外部URLを無制限に取得しないという制約に反する。 |
| `user-images.githubusercontent.com` など旧URL形式の網羅対応 | 明示要求にない後方互換対応。 |
| attachment表示形式の変更 | 既存形式で追記する要求のため。 |
| provider画像入力方式の変更 | 既存 attachment provider 経路があるため不要。 |

## 確認事項
- ユーザーに確認が必要な事項はなし。