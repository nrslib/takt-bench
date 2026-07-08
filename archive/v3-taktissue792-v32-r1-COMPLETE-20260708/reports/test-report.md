# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| R1 | PR 本文内の画像参照が `[Image #N]` に置換される | PR review 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| R2 | 通常コメント内の画像参照が `[Image #N]` に置換される | PR review 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| R3 | review summary / review comment 相当の `reviews[].body` が置換対象になる | PR review 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| R4 | review thread comment 相当の `reviews[].body` が置換対象になる | PR review 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| R5 | Markdown image syntax `![alt](url)` を抽出する | PR review 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| R6 | HTML `<img src="...">` と single quote の `src` を抽出する | PR review 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| R7 | GitHub attachment URL のみ取得対象にする | GitHub attachment download | `src/__tests__/githubAttachmentDownload.test.ts` | 作成 | |
| R8 | GitHub attachment は認証付き request で取得する | GitHub attachment download | `src/__tests__/githubAttachmentDownload.test.ts` | 作成 | |
| R9 | PNG は Content-Type と magic bytes が一致する場合のみ受け入れる | MIME 検証 / download | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownload.test.ts` | 作成 | |
| R10 | JPEG は Content-Type と magic bytes が一致する場合のみ受け入れ、保存拡張子は `jpg` になる | MIME 検証 / download | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownload.test.ts` | 作成 | |
| R11 | GIF87a / GIF89a を対応形式として受け入れる | MIME 検証 / download | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownload.test.ts` | 作成 | |
| R12 | WebP を対応形式として受け入れる | MIME 検証 / download | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownload.test.ts` | 作成 | |
| R13 | 画像サイズ上限は既存 inline image と同じ 10 MiB で、Content-Length と body の両方を検証する | MIME 検証 / download | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownload.test.ts` | 作成 | |
| R14 | ダウンロード画像から `TaskAttachment[]` を生成する | PR review 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| R15 | `takt add --pr` で `.takt/tasks/<slug>/attachments/` に画像を保存する | CLI task 保存 / 永続化 | `src/__tests__/addTaskPrImageAttachments.test.ts` | 作成 | |
| R16 | `order.md` に `## 添付画像` と `- [Image #N]: \`attachments/image-N.ext\`` を追記する | CLI task 保存 / 永続化 | `src/__tests__/addTaskPrImageAttachments.test.ts` | 作成 | |
| R17 | 元コメント本文内の画像参照を `[Image #N]` に置換した task text を downstream に渡す | PR review 正規化 / format | `src/__tests__/prReviewImageAttachments.test.ts`, `src/__tests__/addTaskPrImageAttachments.test.ts` | 作成 | |
| R18 | pipeline `--pr` でも attachment 付き task spec prompt を `executeTask()` に渡す | pipeline 実行時 / task spec staging | `src/__tests__/pipelineExecution.test.ts` | 作成 | |
| R19 | ダウンロード用 temp attachment は cleanup される | PR review 正規化 / routing / pipeline | `src/__tests__/prReviewImageAttachments.test.ts`, `src/__tests__/cli-routing-pr-resolve.test.ts`, `src/__tests__/pipelineExecution.test.ts` | 作成 | |
| R20 | 新規ロジックに単体テストを追加する | 単体テスト | `imageMime`, `githubAttachmentDownload`, `prReviewImageAttachments` 系テスト | 作成 | |
| R21 | `npm run build`、`npm run lint`、`npm test` が実装後に成功する | 検証コマンド | `npm test -- --run ...` | 一部実行 | write_tests 段階では未実装 import により失敗が想定内。build/lint は実装後の確認対象 |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| Content-Type と magic bytes の不一致 | Content-Type だけ、または magic bytes だけを信用する実装 | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownload.test.ts` | |
| allowlist 外 URL | 任意外部 URL を fetch する実装 | `src/__tests__/githubAttachmentDownload.test.ts`, `src/__tests__/prReviewImageAttachments.test.ts` | |
| redirect 先 URL | 最初の URL だけ検証し、redirect 先を無制限に取得する実装 | `src/__tests__/githubAttachmentDownload.test.ts` | |
| Content-Length 上限超過 | oversized body を読み込んでから失敗する、または許可する実装 | `src/__tests__/githubAttachmentDownload.test.ts` | |
| 実 body 上限超過 | Content-Length がない oversized response を許可する実装 | `src/__tests__/githubAttachmentDownload.test.ts` | |
| 同一 URL の重複 | 同じ画像を複数 download し、placeholder が揺れる実装 | `src/__tests__/prReviewImageAttachments.test.ts` | |
| single-quoted HTML src | double quote の `<img>` しか拾わない実装 | `src/__tests__/prReviewImageAttachments.test.ts` | |
| temp cleanup | 保存・実行後に temp attachment を残す実装 | `src/__tests__/prReviewImageAttachments.test.ts`, `src/__tests__/cli-routing-pr-resolve.test.ts`, `src/__tests__/pipelineExecution.test.ts` | |
| cwd 伝搬 | PR attachment download に project cwd が渡らない実装 | `src/__tests__/cli-routing-pr-resolve.test.ts`, `src/__tests__/addTaskPrImageAttachments.test.ts`, `src/__tests__/pipelineExecution.test.ts` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | `preparePrReviewImageAttachments()` | `saveTaskFile()` / `buildTaskOrderContent()` / `promoteTaskAttachments()` | 正規化済み本文と `TaskAttachment[]` が task directory に保存される | `src/__tests__/addTaskPrImageAttachments.test.ts` | |
| 非 pipeline `takt --pr` | `resolvePrInput()` | `interactiveMode()` seed / cleanup finally | PR 由来 attachment が interactive seed に渡り、処理後 cleanup される | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| pipeline `--pr` | `resolveTaskContent()` | `prepareTaskSpecDirectory()` / `stageTaskSpecForExecution()` / `executeTask()` | attachment 付き task spec が run context に stage され、prompt が `order.md` 参照になる | `src/__tests__/pipelineExecution.test.ts` | |
| MIME 共通化 | `validateImageDataMime()` | inline image / PR attachment download 予定 | 対応形式と 10 MiB 上限が共通契約になる | `src/__tests__/imageMime.test.ts` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 外部 URL を取得する | fetch / download mock が呼ばれないことを確認 | `src/__tests__/githubAttachmentDownload.test.ts`, `src/__tests__/prReviewImageAttachments.test.ts` | |
| GitHub の issue / pull URL を attachment として扱う | `isAllowedGitHubAttachmentUrl()` が false を返すことを確認 | `src/__tests__/githubAttachmentDownload.test.ts` | |
| redirect で allowlist 外へ逃がす | redirect response 後に 2 回目の fetch が行われないことを確認 | `src/__tests__/githubAttachmentDownload.test.ts` | |
| MIME mismatch を許可する | reject されることを確認 | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownload.test.ts` | |
| PR attachment なしで pipeline が通常 task text を直接実行する | `executeTask()` の `task` が `Primary spec:` と run context `order.md` 参照を含むことを確認 | `src/__tests__/pipelineExecution.test.ts` | |
| PR attachment temp file を cleanup しない | cleanup callback が呼ばれること、または tempPath が消えることを確認 | `src/__tests__/prReviewImageAttachments.test.ts`, `src/__tests__/cli-routing-pr-resolve.test.ts`, `src/__tests__/pipelineExecution.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/imageMime.test.ts` | 単体 | 6 | 画像 MIME 判定、Content-Type 正規化、magic bytes mismatch、10 MiB 定数 |
| `src/__tests__/githubAttachmentDownload.test.ts` | 単体 | 12 | GitHub attachment URL allowlist、認証 fetch、redirect、サイズ、MIME 検証 |
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 5 | PR review data の画像抽出・置換・dedupe・allowlist 外非取得・cleanup |
| `src/__tests__/addTaskPrImageAttachments.test.ts` | 統合 | 1 | `takt add --pr` から task directory / attachment 保存まで |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 統合 | 既存 + 1 追加 | 非 pipeline `takt --pr` の interactive seed attachment 配線 |
| `src/__tests__/pipelineExecution.test.ts` | 統合 | 既存 + 1 追加 | pipeline `--pr` の attachment 付き task spec staging |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| live GitHub private repository 画像の実取得 | テストで実ネットワーク・実 `gh` 認証に依存させないため。安全性要件に合わせ unit mock で契約を固定した | 実装後、手動または別途 E2E 環境で private repo の画像取得を確認 |
| `npm run build` / `npm run lint` の成功 | write_tests 段階では未実装モジュール import があるため、実装前に成功させる対象ではない | implement 後に `npm run build`, `npm run lint`, `npm test` を実行 |
| GitLab / 任意外部画像 / SVG | 今回のスコープ外。計画でも除外対象 | 追加要件が出た場合に別タスクで検討 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

実行コマンド:

```bash
npm test -- --run src/__tests__/imageMime.test.ts src/__tests__/githubAttachmentDownload.test.ts src/__tests__/prReviewImageAttachments.test.ts src/__tests__/addTaskPrImageAttachments.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts
```

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 72 | 既存テストおよび追加対象周辺の通過分 |
| Fail / Import Error（想定内） | 7 | 未実装モジュール `imageMime`, `attachmentDownload`, `prReviewImageAttachments` と、未配線の `addTask --pr` / routing / pipeline 契約 |
| Error（要対応） | 0 | テスト側の参照ミスは修正済み。残りは実装前の赤テスト |

## 備考（判断がある場合のみ）
- プロダクションコードは変更していない。
- 追加・更新したファイルはすべて `src/__tests__/` 配下のテストファイルのみ。
- 既存 `order.md` attachment section の文言は変更せず、既存形式 `## 添付画像` と `- [Image #N]: \`attachments/image-N.ext\`` を契約として固定した。