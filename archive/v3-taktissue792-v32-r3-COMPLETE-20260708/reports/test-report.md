# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| PRIMG-01 | PR body / conversation comment / review summary / review thread comment から画像 URL を出現順に抽出する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-02 | Markdown image syntax `![alt](url)` を `[Image #n]` に置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-03 | HTML `<img src="...">` を `[Image #n]` に置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-04 | 同一 URL は重複ダウンロードせず、同じ placeholder を再利用する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-05 | PNG/JPEG/GIF/WebP の magic bytes を判定する | shared MIME utility | `src/__tests__/imageMime.test.ts` | 作成 | |
| PRIMG-06 | Content-Type を正規化し、未指定・非対応 MIME を拒否する | shared MIME utility | `src/__tests__/imageMime.test.ts` | 作成 | |
| PRIMG-07 | Content-Type と magic bytes の不一致を拒否する | shared MIME utility / download validation | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownloads.test.ts` | 作成 | |
| PRIMG-08 | GitHub attachment URL allowlist のみ取得対象にする | GitHub attachment downloader | `src/__tests__/githubAttachmentDownloads.test.ts` | 作成 | |
| PRIMG-09 | 外部 URL は token 取得・network access 前に拒否する | GitHub attachment downloader | `src/__tests__/githubAttachmentDownloads.test.ts` | 作成 | |
| PRIMG-10 | gh 認証 token を使って GitHub attachment を取得する | GitHub attachment downloader | `src/__tests__/githubAttachmentDownloads.test.ts` | 作成 | |
| PRIMG-11 | サイズ上限を超える画像を拒否する | GitHub attachment downloader | `src/__tests__/githubAttachmentDownloads.test.ts` | 作成 | |
| PRIMG-12 | `TaskAttachment[]` として `[Image #n]`, `image-n.ext`, `tempPath` を返す | PR review data 正規化 / downloader | `src/__tests__/prReviewImageAttachments.test.ts`, `src/__tests__/githubAttachmentDownloads.test.ts` | 作成 | |
| PRIMG-13 | `takt add --pr` が画像 attachment を `.takt/tasks/<slug>/attachments/` に保存し、`order.md` に `## 添付画像` を追記する | CLI `add --pr` / 永続化 | `src/__tests__/addTask.test.ts` | 作成 | |
| PRIMG-14 | PR body のみの PR でも画像付き task を保存できる | CLI `add --pr` | `src/__tests__/addTask.test.ts` | 作成 | |
| PRIMG-15 | `takt --pr` が interactive seed に attachments を渡し、cleanup する | CLI routing / interactive seed | `src/__tests__/cli-routing-pr-resolve.test.ts` | 作成 | |
| PRIMG-16 | pipeline `--pr` が attachment 付き task spec を staging し、run context の `order.md` と `attachments/` を `executeTask` へ渡す | pipeline / task spec staging / workflow execution | `src/__tests__/pipelineExecution.test.ts` | 作成 | |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| Content-Type 欠落 | MIME 未確認のまま保存する | `src/__tests__/imageMime.test.ts` | |
| 非対応 MIME | SVG などを誤って許可する | `src/__tests__/imageMime.test.ts` | |
| Content-Type / bytes 不一致 | `image/png` と宣言された JPEG を保存する | `src/__tests__/imageMime.test.ts`, `src/__tests__/githubAttachmentDownloads.test.ts` | |
| 外部 URL | `example.com` などを取得してしまう | `src/__tests__/githubAttachmentDownloads.test.ts` | |
| token 取得順序 | 外部 URL でも gh token を取得してしまう | `src/__tests__/githubAttachmentDownloads.test.ts` | |
| サイズ上限 | 10MB 超の画像を受け入れる | `src/__tests__/githubAttachmentDownloads.test.ts` | |
| 重複 URL | 同一画像を複数回ダウンロードし、placeholder がずれる | `src/__tests__/prReviewImageAttachments.test.ts` | |
| 本文置換漏れ | attachment は保存されるが元本文が URL のまま残る | `src/__tests__/prReviewImageAttachments.test.ts` | |
| `add --pr` 配線漏れ | resolver はあるが `saveTaskFile()` に attachments が渡らない | `src/__tests__/addTask.test.ts` | |
| interactive seed 配線漏れ | `takt --pr` の sourceContext だけ渡り、attachments が渡らない | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| pipeline staging 漏れ | pipeline が attachment 付き task を `executeTask()` に直渡しする | `src/__tests__/pipelineExecution.test.ts` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | PR image resolver | `saveTaskFile()` / `prepareTaskSpecDirectory()` | `.takt/tasks/<slug>/attachments/image-1.png` と `order.md` の attachment 行が作られる | `src/__tests__/addTask.test.ts` | |
| `takt --pr` | PR image resolver | `interactiveMode()` seed | `sourceContext` と同時に `attachments` が seed に渡り、終了後 cleanup される | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| pipeline `--pr` | PR image resolver | `executeTask()` | attachment 付き task spec が run context に staging され、prompt は `Primary spec` を参照する | `src/__tests__/pipelineExecution.test.ts` | |
| PR review data 正規化 | `resolvePrReviewImageAttachments()` | `formatPrReviewAsTask()` | 置換済み `PrReviewData` が formatter に渡る | `src/__tests__/addTask.test.ts`, `src/__tests__/pipelineExecution.test.ts` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 外部 URL を取得する | `getAuthToken` と `fetchBinary` が呼ばれないことを確認 | `src/__tests__/githubAttachmentDownloads.test.ts` | |
| 非対応 MIME を保存する | `parseImageContentType()` が例外を投げることを確認 | `src/__tests__/imageMime.test.ts` | |
| magic bytes 不一致の画像を保存する | downloader が reject し、tempRoot 配下に `image-1.png` が残らないことを確認 | `src/__tests__/githubAttachmentDownloads.test.ts` | |
| PR body 画像を comments/reviews 空判定で捨てる | body 画像のみの PR task が保存されることを確認 | `src/__tests__/addTask.test.ts` | |
| pipeline で attachment なしの文字列直渡しにする | `executeTask` の task が `Primary spec` を含み、run context の attachment を読めることを確認 | `src/__tests__/pipelineExecution.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/imageMime.test.ts` | 単体 | 6 | 対応 MIME、拡張子、Content-Type 正規化、不一致拒否 |
| `src/__tests__/githubAttachmentDownloads.test.ts` | 単体 | 5 | GitHub URL allowlist、認証ヘッダ、保存形式、不一致拒否、サイズ上限 |
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 3 | PR review data 全ソースからの抽出、HTML/Markdown 置換、dedupe、画像なし |
| `src/__tests__/addTask.test.ts` | 統合 | 1 追加 / 1 更新 | `add --pr` の attachment 保存と PR body のみ許可 |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 統合 | 1 追加 | `takt --pr` の interactive seed attachments 伝搬と cleanup |
| `src/__tests__/pipelineExecution.test.ts` | 統合 | 1 追加 | pipeline `--pr` の attachment task spec staging |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| redirect の HTTPS / 回数上限 | HTTP 実装詳細に寄るため、今回のテストでは downloader の外部取得 seam と maxBytes 伝搬までを固定した | 実装時に redirect 追跡関数を追加する場合、その関数の単体テストを追加する |
| private repository 実画像への実通信 | CI とローカル認証状態に依存し、単体テストとして安定しない | `gh auth token` 利用と Authorization header 伝搬は単体テスト済み。実通信は手動または E2E 対象 |
| GitLab MR attachment | 今回の計画でスコープ外 | 追加要件が出た場合に GitLab provider 側で別途計画する |
| 任意外部画像 URL | 安全制約によりスコープ外 | 取得対象を拡張する場合は allowlist と SSRF 対策を再設計する |
| 画像以外の添付ファイル | 対応形式が PNG/JPEG/GIF/WebP に限定されているため | 対応形式を増やす場合は MIME / magic bytes / 拡張子テストを追加する |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

実行コマンド:

`npm test -- src/__tests__/imageMime.test.ts src/__tests__/githubAttachmentDownloads.test.ts src/__tests__/prReviewImageAttachments.test.ts src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts`

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 90 | 既存テスト部分は実行継続し、既存の通過分を確認 |
| Fail / Import Error（想定内） | 6 | 未実装モジュール `shared/utils/imageMime.js`, `infra/github/attachmentDownloads.js`, `features/tasks/prReviewImageAttachments.js` と未配線の入口テスト起因 |
| Error（要対応） | 0 | 実装後も残ることが明確な import パスミスや構文エラーは確認されていない |

## 備考
- 変更はテストファイルのみ。
- プロダクションコードは作成・変更していない。
- `git add`、`git commit`、`git push` は実行していない。