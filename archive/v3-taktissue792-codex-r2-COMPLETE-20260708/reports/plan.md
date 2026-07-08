# タスク計画

## 元の要求
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

## 分析結果

### 目的
`takt add --pr <number>`、`takt --pr <number>`、pipeline の `--pr` 経路で、PR 本文・通常コメント・review thread コメントに貼られた GitHub 画像を検出し、ローカル task attachment として `.takt/tasks/<slug>/attachments/` または実行用 task spec context に配置し、本文中では `[Image #N]` として参照可能にする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | PR 本文内の画像 URL を検出する | 明示 | `PrReviewData.body` が対象 |
| 2 | 通常コメント内の画像 URL を検出する | 明示 | `PrReviewData.comments[].body` が対象 |
| 3 | review summary 内の画像 URL を検出する | 明示 | `PrReviewData.reviews[]` のうち `path` なしも対象 |
| 4 | review thread コメント内の画像 URL を検出する | 明示 | `PrReviewData.reviews[]` のうち `threadState` / `path` ありも対象 |
| 5 | Markdown image syntax を検出する | 明示 | `![alt](https://...)` |
| 6 | HTML `<img src="...">` を検出する | 明示 | quoted/unquoted src を対象にする |
| 7 | GitHub attachment URL のみ取得する | 明示 | 外部 URL を無制限に取得しない |
| 8 | 画像を認証付きでダウンロードする | 明示 | private repository 画像対応。`gh auth token` で取得した認証情報を使う方針 |
| 9 | PNG/JPEG/GIF/WebP のみ許可する | 明示 | Content-Type と magic bytes の両方で検証 |
| 10 | サイズ上限を設ける | 明示 | streaming 中または受信後に上限検証 |
| 11 | `TaskAttachment[]` を作る | 暗黙 | 既存 task attachment 仕組みへ渡すため |
| 12 | `.takt/tasks/<slug>/attachments/image-N.ext` に保存する | 明示 | `saveTaskFile()` 経路 |
| 13 | `order.md` に既存形式の添付画像セクションを追加する | 明示 | 既存 `buildTaskOrderContent()` を使う |
| 14 | 元コメント本文内の画像参照を `[Image #N]` に置換する | 明示 | 「可能なら」に対して、PR task 化前の `PrReviewData` コピーを置換する |
| 15 | pipeline `--pr` 経路でも画像参照可能にする | 明示 | direct `executeTask()` に task spec を渡す配線が必要 |
| 16 | 新規ロジックに単体テストを追加する | 明示 | 抽出・URL allowlist・検証・置換・配線 |
| 17 | `npm run build`、`npm run lint`、`npm test` を成功させる | 明示 | 後続実装ステップで実行 |

### 参照資料の調査結果
参照資料として指定された `src/infra/github/pr.ts` を確認した。現状は `gh pr view` で `number,title,body,url,headRefName,baseRefName,comments,reviews,files` を取得し、GraphQL で review thread comments を取得して `PrReviewData` にまとめている。review thread の `body` は取得済みであり、画像 URL 抽出に必要な本文情報は既に揃っている。

現在との差分は、`PrReviewData` を task text に変換する前後で画像 URL を抽出・ダウンロードする処理が存在しない点。`formatPrReviewAsTask()` は provider-neutral な文字列化関数であり、GitHub 画像取得や IO を混ぜるべきではない。

### スコープ
- PR review data 取得後の画像抽出・ダウンロード・置換。
- `takt add --pr` の `saveTaskFile()` への attachment 配線。
- `takt --pr` の interactive seed への attachment 配線と cleanup。
- pipeline `--pr` の task spec 作成・stage・実行配線。
- 既存 inline image の magic bytes 判定を shared utility 化。
- 対象テストの追加・更新。

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `formatPrReviewAsTask()` 内で画像抽出とダウンロードを行う | 不採用 | formatter は provider-neutral で IO を持たない責務。GitHub 固有処理を混ぜると責務違反 |
| `src/infra/github/pr.ts` に attachment 作成まで含める | 不採用 | `TaskAttachment` は task feature の概念で、GitHub infra に task 保存知識を持たせると層が逆流する |
| `src/features/tasks/prReviewImageAttachments.ts` を追加する | 採用 | `PrReviewData` から task attachment を作る feature 境界として自然。GitHub URL allowlist と task attachment 変換を集約できる |
| 外部 URL も allowlist なしで取得する | 不採用 | 明示制約に反する |
| `gh api <attachment-url>` だけで取得する | 不採用 | `gh api --help` 上は GitHub API v3 endpoint / graphql 用。attachment URL は通常 API endpoint ではないため、`gh auth token` + Node HTTPS を使う方が明確 |
| pipeline では plain task string に attachment パスだけ追記する | 不採用 | 画像ファイルが run context に配置されず、provider が参照できない |
| pipeline でも既存 task spec staging を使う | 採用 | `selectAndExecuteTask()` の attachment 付き direct 実行と同じ構造を再利用できる |

### 実装アプローチ
1. `src/shared/utils/imageMime.ts` を追加し、PNG/JPEG/GIF/WebP の magic bytes 判定と MIME から拡張子への変換を提供する。
2. `src/features/interactive/inlineImagePaste.ts` の private な magic bytes 判定を shared utility へ置き換える。
3. `src/features/tasks/prReviewImageAttachments.ts` を追加する。
   - `preparePrReviewImageAttachments(prReview, cwd)` のような関数を提供する。
   - PR body/comments/reviews の本文を走査する。
   - Markdown image と HTML img を検出する。
   - GitHub attachment URL のみ許可する。
   - 同一 URL は重複ダウンロードせず同じ placeholder を使う。
   - ダウンロード後に Content-Type、magic bytes、サイズ上限を検証する。
   - `image-1.png` / `[Image #1]` の形式で `TaskAttachment[]` を作る。
   - 元の画像記法は `PrReviewData` のコピー上で `[Image #N]` に置換する。
   - 一時ディレクトリ cleanup 関数を返す。
4. `src/features/tasks/add/index.ts` の `add --pr` 分岐で、取得した `PrReviewData` を上記関数に通してから `formatPrReviewAsTask()` する。
   - `saveTaskFile(cwd, taskContent, { ..., attachments })` に配線する。
   - cleanup は `finally` で実行する。
   - 現在の「review/comments が空なら task を作らない」判定は、画像 attachment がある場合は作成できるようにする。
5. `src/app/cli/routing-inputs.ts` の `resolvePrInput()` の戻り値に `attachments` と cleanup を含める。
6. `src/app/cli/routing.ts` で `interactiveSeed` に PR attachment を渡し、dispatch 完了後に cleanup する。
7. `src/features/pipeline/steps.ts` の `TaskContent` に `attachments?: TaskAttachment[]` を追加する。
8. pipeline `--pr` の `resolveTaskContent()` で PR attachment を生成し、`runWorkflow()` に渡す。
9. `runWorkflow()` で attachments がある場合は `prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` を使い、`executeTask()` へ staged task prompt と `reportDirName` を渡す。
   - transient な `.takt/tasks/<slug>` は cleanup する。
   - run context 側は既存 `selectAndExecuteTask(skipTaskList: true)` と同様に残す。
10. テストを追加・更新する。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、`takt --pipeline --pr <number>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | `gh` CLI が利用可能で、PR 取得可能で、画像 URL が許可された GitHub attachment URL であること |
| 未対応項目 | なし |

## 実装ガイドライン
- `formatPrReviewAsTask()` は IO なし・provider-neutral のまま維持する。
- GitHub attachment URL 取得、allowlist、ダウンロード、置換、`TaskAttachment[]` 化は 1 モジュールに集約する。
- `TaskAttachment` 保存形式は既存の `buildTaskOrderContent()` / `prepareTaskSpecDirectory()` に任せる。
- 既存の placeholder 命名は `createImageAttachmentStore()` と同じ `[Image #N]` / `image-N.ext` に揃える。
- Content-Type だけで画像種別を信頼しない。magic bytes と一致する場合のみ許可する。
- magic bytes 判定をコピーせず shared utility に切り出す。
- 取得対象 URL は GitHub attachment 系 allowlist に限定する。
- redirect を追う場合も redirect 先を allowlist 検証する。
- ダウンロード失敗・検証失敗は明示エラーにする。画像なしで黙って続行しない。
- 一時ファイル cleanup は、`saveTaskFile()` または staging が完了した後に行う。
- pipeline では plain string ではなく task spec を使い、run context に `order.md` と `attachments/` を配置する。
- `addTask.test.ts` は `formatPrReviewAsTask()` が mock されているため、PR data が置換済みで渡されることと、保存後の `order.md` / `attachments` を確認する形にする。
- `pipelineExecution.test.ts` は `executeTask()` mock の呼び出し引数と run context の配置を確認する。
- 新規抽出・検証テストは network を使わず、download 関数を注入または mock できる設計にする。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| 任意外部 URL の画像取得 | 明示制約が「外部 URL を無制限に取得しない」「GitHub attachment URL から始める」ため |
| SVG/PDF/動画などの添付対応 | 対応形式は PNG/JPEG/GIF/WebP と明示されているため |
| Issue コメント画像対応 | 要求は PR コメント内画像であり、issue 経路は明示されていないため |
| GitLab PR/MR 画像対応 | 参照資料と要求が GitHub PR 前提のため |

## 確認事項
なし。