# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| R1 | PR body 内の画像 URL を検出し、`[Image #N]` に置換する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R2 | 通常コメント内の画像 URL を検出し、attachment 化する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R3 | review summary 内の画像 URL を検出し、attachment 化する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R4 | review thread comment 相当の `reviews[].body` 内画像を検出する | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R5 | Markdown image syntax `![alt](url)` を対象にする | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R6 | HTML `<img src="...">` を対象にする | PR review data 正規化 | `prReviewImageAttachments.test.ts` | 作成 |  |
| R7 | GitHub attachment URL のみ取得対象にする | GitHub attachment downloader | `github-attachmentDownload.test.ts` | 作成 |  |
| R8 | PNG/JPEG/GIF/WebP のみ対応する | MIME utility / downloader | `imageMime.test.ts`, `github-attachmentDownload.test.ts` | 作成 |  |
| R9 | Content-Type を検証する | GitHub attachment downloader | `github-attachmentDownload.test.ts` | 作成 |  |
| R10 | magic bytes を検証する | MIME utility / downloader | `imageMime.test.ts`, `github-attachmentDownload.test.ts` | 作成 |  |
| R11 | サイズ上限を設ける | GitHub attachment downloader | `github-attachmentDownload.test.ts` | 作成 |  |
| R12 | `.takt/tasks/<slug>/attachments/` に保存する | `takt add --pr` 保存経路 | `addTask.test.ts` | 作成 |  |
| R13 | `order.md` に `## 添付画像` と attachment 行を追記する | `takt add --pr` 保存経路 | `addTask.test.ts` | 作成 |  |
| R14 | 元コメント本文の画像参照を `[Image #N]` へ置換する | PR review data 正規化 | `prReviewImageAttachments.test.ts`, `addTask.test.ts` | 作成 |  |
| R15 | `takt add --pr` が attachments を `saveTaskFile()` へ渡す | CLI add PR 経路 | `addTask.test.ts` | 作成 |  |
| R16 | pipeline `--pr` でも attachments 付き task spec を参照できる | pipeline PR 実行経路 | `pipelineExecution.test.ts` | 作成 |  |
| R17 | 一時 attachment store を cleanup する | PR review image resolver | `prReviewImageAttachments.test.ts`, `addTask.test.ts`, `pipelineExecution.test.ts` | 作成 |  |
| R18 | 新規ロジックに単体テストを追加する | 単体テスト | `imageMime.test.ts`, `github-attachmentDownload.test.ts`, `prReviewImageAttachments.test.ts` | 作成 |  |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| allowlist 外 URL | 外部 URL を fetch してしまう | `github-attachmentDownload.test.ts`, `prReviewImageAttachments.test.ts` |  |
| Content-Type 不一致 | `image/png` と宣言しつつ JPEG bytes を受け入れる | `github-attachmentDownload.test.ts` |  |
| unsupported MIME | SVG などを attachment として扱う | `github-attachmentDownload.test.ts`, `imageMime.test.ts` |  |
| magic bytes 不明 | 拡張子や Content-Type だけで通す | `imageMime.test.ts` |  |
| サイズ超過 | `Content-Length` 超過でも body を読む | `github-attachmentDownload.test.ts` |  |
| 同一 URL 重複 | 同じ画像を複数 download して placeholder がずれる | `prReviewImageAttachments.test.ts` |  |
| download 失敗 | allowlisted URL の失敗を黙ってスキップする | `prReviewImageAttachments.test.ts` |  |
| cleanup 漏れ | 成功・失敗時に一時ファイル owner を残す | `prReviewImageAttachments.test.ts`, `addTask.test.ts`, `pipelineExecution.test.ts` |  |
| PR body 画像のみ | comments/reviews 空判定で task 作成を拒否する | `addTask.test.ts` |  |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | `resolvePrReviewImageAttachments()` | `formatPrReviewAsTask()` / `saveTaskFile()` | 置換済み PR data を format し、attachments を保存する | `addTask.test.ts` |  |
| pipeline `--pr` | `resolveTaskContent()` | `runWorkflow()` / `executeTask()` | attachments 付き task spec を run context に stage して実行する | `pipelineExecution.test.ts` |  |
| GitHub image download | `downloadGitHubAttachmentImage()` | PR image resolver | 認証付き fetch、MIME/size/magic bytes 検証済み bytes を返す | `github-attachmentDownload.test.ts` |  |
| MIME 判定共有 | `imageMime` utility | downloader / inline paste 側の予定利用 | PNG/JPEG/GIF/WebP の判定と拡張子を一元化する | `imageMime.test.ts` | inline paste 側の差し替え保持テストは実装ステップで対象差分に合わせて追加確認する |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 外部 URL を無制限に取得する | `fetch` と `gh auth token` が呼ばれないことを確認 | `github-attachmentDownload.test.ts` |  |
| unsupported MIME に fallback 拡張子を割り当てる | `extensionForImageMimeType('image/svg+xml')` が throw することを確認 | `imageMime.test.ts` |  |
| Content-Type と magic bytes の不一致を受け入れる | downloader が reject することを確認 | `github-attachmentDownload.test.ts` |  |
| PR review data を直接 mutate する | 元の `prReview.body` が URL を保持することを確認 | `prReviewImageAttachments.test.ts` |  |
| allowlisted download 失敗を黙って除外する | resolver が reject することを確認 | `prReviewImageAttachments.test.ts` |  |
| pipeline で文字列 task のまま実行する | `executeTask.task` が `Primary spec:` と `context/task/order.md` を含むことを確認 | `pipelineExecution.test.ts` |  |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/imageMime.test.ts` | 単体 | 4 | 画像 MIME magic bytes 判定、拡張子変換、unsupported MIME reject |
| `src/__tests__/github-attachmentDownload.test.ts` | 単体 | 6 | GitHub attachment URL allowlist、認証付き fetch、Content-Type / magic bytes / size 検証 |
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 4 | PR review data の画像抽出・置換・重複 URL 再利用・cleanup |
| `src/__tests__/addTask.test.ts` | 統合 | 1 新規、1 既存更新 | `takt add --pr` の resolver 呼び出し、attachment 保存、`order.md` 追記 |
| `src/__tests__/pipelineExecution.test.ts` | 統合 | 1 | pipeline `--pr` の attachment staging と `executeTask` 伝搬 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `npm run build` / `npm run lint` 成功 | write_tests 段階では未実装 import が残るため、失敗が前提 | implement 後に必ず実行 |
| inline paste 既存処理が shared MIME utility を使い続けること | 今回はプロダクションコード変更禁止のため、差し替え後の実装形に依存する保持テストは確定しない | implement 後、`inlineImagePaste.test.ts` 既存ケースが通ることと必要な追加テストを確認 |
| 実 GitHub private image の実通信 | unit test では外部通信を禁止し、fetch / gh を mock したため | 必要なら E2E または手動で `gh` 認証済み環境を確認 |
| GitLab / 任意外部 URL | スコープ外。要求が GitHub attachment URL から開始する方針のため | 追加要件が出た場合に別途設計 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

実行コマンド:

`npm test -- imageMime.test.ts github-attachmentDownload.test.ts prReviewImageAttachments.test.ts addTask.test.ts pipelineExecution.test.ts`

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 66 | 既存テストの大半は通過 |
| Fail / Import Error（想定内） | 6 | 未実装モジュール 3 件、現行実装の未配線 3 件 |
| Error（要対応） | 0 | 実装後も残る既存 import パスミスは確認されていない |

## 備考
- プロダクションコードは変更していない。
- 既存の task attachment 保存機構自体は `saveTaskFile.test.ts` と `selectAndExecute-skipTaskList.test.ts` に既存カバレッジがあるため、今回の新規テストでは PR 画像からその機構へ渡る契約を重点的に固定した。
- `findings-ledger.json` の open / resolved / waived / conflict は空であり、参照すべき既存 finding ID はなかった。