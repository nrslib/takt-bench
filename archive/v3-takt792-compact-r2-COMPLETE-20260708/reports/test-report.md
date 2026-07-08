# テスト作成レポート

## 要件-テスト対応表

| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| R1 | PR本文内の画像URLを検出し、本文を `[Image #N]` に置換する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R2 | 通常コメント内の画像URLを検出し、本文を `[Image #N]` に置換する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R3 | review summary 内の画像URLを検出する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R4 | review thread コメント内の画像URLを検出する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R5 | Markdown画像記法 `![alt](url)` を抽出する | 画像抽出 helper | `prReviewImageAttachments.test.ts` | 作成 |  |
| R6 | HTML `<img src="...">` を抽出する | 画像抽出 helper | `prReviewImageAttachments.test.ts` | 作成 |  |
| R7 | GitHub attachment URL 以外を取得しない | ダウンロード境界 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R8 | PNG/JPEG/GIF/WebP のみ保存し、Content-Type と magic bytes を検証する | ダウンロード検証 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R9 | 10MiB超の画像を拒否する | ダウンロード検証 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R10 | ダウンロード画像を `TaskAttachment[]` として返す | PR task input builder | `prReviewImageAttachments.test.ts`, `prReviewTaskInput.test.ts` | 作成 |  |
| R11 | `takt add --pr` が attachments を保存経路へ渡す | CLI add / 永続化境界 | `addTask.test.ts` | 作成 |  |
| R12 | `order.md` に既存形式の `## 添付画像` と `attachments/image-1.png` を追記する | task spec 保存 | `addTask.test.ts` | 作成 |  |
| R13 | 元本文内の画像参照を `[Image #N]` として参照可能にする | formatter 入力 / order.md | `prReviewImageAttachments.test.ts`, `addTask.test.ts` | 作成 |  |
| R14 | `takt --pr` 対話経路でも attachments を参照可能にする | routing / interactive seed | `cli-routing-pr-resolve.test.ts` | 作成 |  |
| R15 | pipeline `--pr` でも attachment 付き task spec を使う | pipeline / run context staging | `pipelineExecution.test.ts` | 作成 |  |
| R16 | 一時ファイル cleanup を成功・キャンセル系で呼ぶ | cleanup 副作用 | `prReviewImageAttachments.test.ts`, `addTask.test.ts`, `cli-routing-pr-resolve.test.ts`, `pipelineExecution.test.ts` | 作成 |  |
| R17 | 同一URLは重複ダウンロードせず同じ placeholder にする | 画像抽出 helper | `prReviewImageAttachments.test.ts` | 作成 |  |
| R18 | 既存PR取得・整形・保存契約を要求外で変えない | add/routing/pipeline 既存PR経路 | `addTask.test.ts`, `cli-routing-pr-resolve.test.ts`, `pipelineExecution.test.ts` | 既存 + 更新 |  |

## 危険分岐テスト

| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| GitHub以外URL | 任意外部URLを取得する実装 | `許可外URLは取得せず、元の本文も変更しない` |  |
| Content-Type不一致 | Content-Typeだけ、または magic bytes だけで通す実装 | `Content-Typeとmagic bytesが一致しない画像は保存しない` |  |
| 対応外形式 | SVGなどを保存する実装 | `対応外Content-Typeの画像は保存しない` |  |
| サイズ超過 | Content-Length / Buffer長の上限を見ない実装 | `10MiBを超える画像は保存しない` |  |
| 重複URL | 同一URLを複数ファイルとして保存する実装 | `PR本文・通常コメント・review summary・review thread...` |  |
| 画像のみPR | comments/reviews が空という理由だけで task 作成を拒否する実装 | `should save PR image attachments and allow image-only PR body when adding with --pr` |  |
| cleanup漏れ | 保存後・対話後・pipeline後に一時ファイルを残す実装 | add/routing/pipeline の cleanup 期待 |  |

## 横断経路テスト

| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | `buildPrReviewTaskInput()` | `saveTaskFile()` / task spec保存 | attachments が `order.md` と `attachments/` に保存される | `addTask.test.ts` |  |
| `takt --pr` | `resolvePrInput()` | `interactiveMode()` | `sourceContext` と `attachments` が seed に入る | `cli-routing-pr-resolve.test.ts` |  |
| pipeline `--pr` | `resolveTaskContent()` | `runWorkflow()` / `executeTask()` | attachment 付き task spec が run context に stage される | `pipelineExecution.test.ts` |  |
| PR正規化 | `resolvePrReviewImageAttachments()` | `formatPrReviewAsTask()` | 置換済み `PrReviewData` だけを formatter に渡す | `prReviewTaskInput.test.ts` |  |

## 否定契約

| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 外部URLの無制限取得 | downloader が呼ばれないこと、本文が変更されないこと | `prReviewImageAttachments.test.ts` |  |
| 不正画像の保存 | reject し、作業ディレクトリにファイルが残らないこと | `prReviewImageAttachments.test.ts` |  |
| 元 `PrReviewData` の破壊的変更 | original body が保持され、formatter に original を渡さないこと | `prReviewTaskInput.test.ts` |  |
| PR画像があるのに add 経路で破棄すること | `order.md` と attachment 実ファイルを読む | `addTask.test.ts` |  |
| pipeline に生 task 文字列だけを渡すこと | `executeTask.task` が staged task spec prompt であること | `pipelineExecution.test.ts` |  |

## 作成テスト

| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 5 | 画像抽出、allowlist、形式検証、サイズ上限、dedupe、cleanup |
| `src/__tests__/prReviewTaskInput.test.ts` | 単体 | 2 | PR画像正規化結果を task input へ集約する契約 |
| `src/__tests__/addTask.test.ts` | 統合寄り | 1追加 + 既存PR系更新 | `takt add --pr` の attachment 保存と画像のみPR |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 統合寄り | 1追加 + 既存PR系更新 | `takt --pr` の interactive seed attachments 配線 |
| `src/__tests__/pipelineExecution.test.ts` | 統合寄り | 1追加 | pipeline `--pr` の task spec staging |

## 未カバー項目

| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| 実GitHub private attachment の実取得 | 実装前テストではネットワーク・認証状態に依存させないため、依存注入の契約だけ固定した | 実装時に `gh auth token` / Authorization header の実装をレビュー |
| `gh auth token` コマンド失敗時の具体エラー文言 | 計画では fail fast が契約で、文言は未確定のため固定しない | 実装後にエラー分類・表示文言が決まれば追加可能 |
| GitLab MR画像 | スコープ外 | なし |
| GitHub以外の外部画像URL | 明示的に禁止対象 | なし |

## 実行結果（参考）

実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 85 | 対象テスト実行内の既存通過分 |
| Fail / Import Error（想定内） | 10 | 未実装モジュール2件、未配線期待失敗8件 |
| Error（要対応） | 0 | 既存パスミスやテストヘルパー不備は確認されず |

追加確認:
- `npm run build`: 成功
- `npm run lint`: 成功
- `git diff --check`: 成功
- 対象テスト実行コマンド: `npm test -- src/__tests__/prReviewImageAttachments.test.ts src/__tests__/prReviewTaskInput.test.ts src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts`

## 備考

- プロダクションコードは変更していない。
- `git status` では未追跡の `.takt/workflows/` が見えていたが、今回の作業では参照・変更していない。
- 新規テストは実装予定の `src/features/tasks/prReviewImageAttachments.ts` と `src/features/tasks/prReviewTaskInput.ts` を前提にしているため、次ステップの実装でこれらのモジュールと `add` / routing / pipeline への配線が必要。