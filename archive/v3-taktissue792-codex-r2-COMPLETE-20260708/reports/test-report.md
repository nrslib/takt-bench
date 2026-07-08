# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| PRIMG-01 | `PrReviewData.body` の Markdown/HTML 画像 URL を検出し、本文を `[Image #N]` に置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-02 | `PrReviewData.comments[].body` の画像 URL を検出し、通常コメント本文を置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-03 | `PrReviewData.reviews[]` の review summary 本文の画像 URL を検出し、本文を置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-04 | `PrReviewData.reviews[]` の review thread コメント本文の画像 URL を検出し、本文を置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-05 | Markdown image syntax `![alt](url)` を検出する | Markdown 解析 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-06 | HTML `<img src="...">` / single quote / unquoted src を検出する | HTML img 解析 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-07 | GitHub attachment URL のみを取得対象にし、外部 URL は downloader に渡さない | URL allowlist | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-08 | 認証付き取得に必要な downloader 境界へ `cwd` と `maxBytes` を渡す | 画像ダウンロード adapter 境界 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | `gh auth token` 自体の呼び出しはプロダクション実装前で未作成のため、後続実装で downloader 単体テスト追加が必要 |
| PRIMG-09 | PNG/JPEG/GIF/WebP の magic bytes を判定する | shared utility | `src/__tests__/imageMime.test.ts` | 作成 | |
| PRIMG-10 | MIME type から `png` / `jpg` / `gif` / `webp` の attachment 拡張子を決定し、未知 MIME を拒否する | shared utility | `src/__tests__/imageMime.test.ts` | 作成 | |
| PRIMG-11 | Content-Type と magic bytes が不一致の場合に明示エラーにする | 画像検証 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-12 | 許可形式外の画像データを拒否する | 画像検証 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-13 | サイズ上限超過を拒否する | 画像検証 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-14 | redirect 先が GitHub attachment allowlist 外なら拒否する | redirect 検証 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-15 | 同一 URL は重複ダウンロードせず同じ placeholder を使う | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-16 | `TaskAttachment[]` を `[Image #N]` / `image-N.ext` / `tempPath` 付きで返す | task attachment 生成 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| PRIMG-17 | `takt add --pr` で置換済み PR data を `formatPrReviewAsTask()` に渡す | CLI add PR 経路 | `src/__tests__/addTask.test.ts` | 作成 | |
| PRIMG-18 | `takt add --pr` で `.takt/tasks/<slug>/order.md` に `## 添付画像` と `attachments/image-1.png` を保存する | 永続化境界 | `src/__tests__/addTask.test.ts` | 作成 | |
| PRIMG-19 | `takt add --pr` の保存失敗時に PR 画像一時ファイル cleanup を呼ぶ | エラー時 cleanup | `src/__tests__/addTask.test.ts` | 作成 | |
| PRIMG-20 | `takt --pr` の interactive seed に PR 画像 attachments を渡す | CLI routing → interactive | `src/__tests__/cli-routing-pr-resolve.test.ts` | 作成 | |
| PRIMG-21 | `takt --pr` の execute 確定時に PR 画像 attachments を `selectAndExecuteTask()` へ渡す | CLI routing → task execution | `src/__tests__/cli-routing-pr-resolve.test.ts` | 作成 | |
| PRIMG-22 | `takt --pr` の save_task 確定時に PR 画像 attachments を `saveTaskFromInteractive()` へ渡す | CLI routing → task save | `src/__tests__/cli-routing-pr-resolve.test.ts` | 作成 | |
| PRIMG-23 | pipeline `--pr` で attachment 付き task spec を run context に stage し、`executeTask()` へ task spec prompt と `reportDirName` を渡す | pipeline PR → execution | `src/__tests__/pipelineExecution.test.ts` | 作成 | |
| PRIMG-24 | staged `order.md` 内の attachment path は run context 相対に書き換え、元の `tempPath` を残さない | pipeline staging | `src/__tests__/pipelineExecution.test.ts` | 作成 | |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| Content-Type だけを信用する | `image/png` ヘッダだが JPEG bytes の画像を通す | `src/__tests__/prReviewImageAttachments.test.ts` | |
| magic bytes 判定漏れ | SVG/任意バイナリを画像として保存する | `src/__tests__/imageMime.test.ts`, `src/__tests__/prReviewImageAttachments.test.ts` | |
| 外部 URL 取得 | `https://example.com/...` を downloader に渡す | `src/__tests__/prReviewImageAttachments.test.ts` | |
| redirect allowlist 漏れ | GitHub URL から外部 URL へ redirect した画像を保存する | `src/__tests__/prReviewImageAttachments.test.ts` | |
| サイズ上限漏れ | 上限超過画像を temp file / attachment として作る | `src/__tests__/prReviewImageAttachments.test.ts` | |
| 重複 URL の二重取得 | 同一画像を `image-1.png` と `image-2.png` に重複保存する | `src/__tests__/prReviewImageAttachments.test.ts` | |
| formatter 前の置換漏れ | 元 URL のまま `formatPrReviewAsTask()` に渡す | `src/__tests__/addTask.test.ts`, `src/__tests__/pipelineExecution.test.ts` | |
| cleanup 漏れ | 保存失敗時に一時画像を残す | `src/__tests__/addTask.test.ts` | |
| pipeline plain string 実行 | attachment 付き PR task を task spec 化せず、画像が実行 context に存在しない | `src/__tests__/pipelineExecution.test.ts` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | `preparePrReviewImageAttachments()` | `saveTaskFile()` / `buildTaskOrderContent()` | 置換済み PR text と `TaskAttachment[]` が保存され、`order.md` と `attachments/` が作られる | `src/__tests__/addTask.test.ts` | |
| `takt --pr` interactive execute | `resolvePrInput()` | `interactiveMode()` / `selectAndExecuteTask()` | seed attachments が interactive に渡り、確定タスク実行にも attachment が残る | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| `takt --pr` interactive save_task | `resolvePrInput()` | `saveTaskFromInteractive()` | PR preset settings と PR image attachments が同時に渡る | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| pipeline `--pr` | `resolveTaskContent()` | `runWorkflow()` / `executeTask()` | attachment 付き task spec が run context に stage され、`executeTask.task` は spec instruction になる | `src/__tests__/pipelineExecution.test.ts` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 外部 URL を取得する | downloader mock が外部 URL で呼ばれないことを検証 | `src/__tests__/prReviewImageAttachments.test.ts` | |
| unsupported MIME を拡張子推測で保存する | `getImageExtensionForMimeType('image/svg+xml')` が throw することを検証 | `src/__tests__/imageMime.test.ts` | |
| Content-Type / magic bytes 不一致を通す | 不一致入力で reject することを検証 | `src/__tests__/prReviewImageAttachments.test.ts` | |
| pipeline 実行 prompt に元 `tempPath` を露出する | staged `order.md` に `tempPath` が含まれないことを検証 | `src/__tests__/pipelineExecution.test.ts` | |
| PR attachment 付き task を plain string のまま実行する | `executeTask.task` が元 task text と一致せず task spec instruction であることを検証 | `src/__tests__/pipelineExecution.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/imageMime.test.ts` | 単体 | 4 | 画像 magic bytes 判定、MIME→拡張子、未知 MIME 拒否 |
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 5 | PR review data 内画像抽出、URL allowlist、置換、attachment 生成、検証エラー |
| `src/__tests__/addTask.test.ts` | 統合 | 2 新規 + 1 既存更新 | `takt add --pr` の attachment 保存、置換済み PR data format、cleanup |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 統合 | 2 新規 + 1 既存更新 | `takt --pr` の interactive seed / execute / save_task attachment 伝搬 |
| `src/__tests__/pipelineExecution.test.ts` | 統合 | 1 | pipeline `--pr` の attachment 付き task spec staging |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `gh auth token` を使った実ダウンロード処理 | プロダクション downloader が未実装で、今回のテストでは downloader 注入境界までを固定したため | 実装時に `downloadGithubAttachmentImage()` 等の単体テストで `gh auth token` 呼び出し、Authorization header、取得失敗時のエラー分類を確認 |
| HTTP redirect の段階的追跡処理 | 現時点では downloader 返却の `finalUrl` 検証契約のみ固定したため | 実装時に redirect を追う責務を置くモジュールで、各 redirect 先の allowlist 検証を追加確認 |
| streaming 中のサイズ上限打ち切り | 現時点では受信後 bytes の上限契約を固定したため | 実装時に downloader が streaming する場合、上限超過時に途中で失敗するテストを追加 |
| full `npm run build` / `npm run lint` / `npm test` 成功 | 実装前で未実装 import があるため成功しない | implement ステップ完了後に実行 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

実行コマンド:

```bash
npm run test:unit -- src/__tests__/imageMime.test.ts src/__tests__/prReviewImageAttachments.test.ts src/__tests__/addTask.test.ts src/__tests__/pipelineExecution.test.ts src/__tests__/cli-routing-pr-resolve.test.ts
```

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 88 | 対象ファイル内の既存テストは通過 |
| Fail / Import Error（想定内） | 9 | 未実装の `shared/utils/imageMime.js`、`features/tasks/prReviewImageAttachments.js`、および未配線 PR attachment 経路起因 |
| Error（要対応） | 0 | テスト側の構文エラー、既存 import パスミス、`git diff --check` 違反は確認されていない |

## 備考（判断がある場合のみ）
- `formatPrReviewAsTask()` は計画どおり IO なし・provider-neutral のままにする前提で、画像取得と置換は `preparePrReviewImageAttachments()` 境界に固定した。
- PR 画像付き pipeline は 3 モジュール以上を横断するため、単体テストだけでなく run context staging まで見る統合テストを追加した。
- 既存 attachment 保存形式そのものは `saveTaskFile.test.ts` に既存カバレッジがあるため、新規テストでは PR 経路からその保存形式へ到達することを重点的に固定した。