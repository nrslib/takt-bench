# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| R1 | PR 本文内の Markdown 画像記法から URL を抽出する | GitHub PR review 画像抽出 helper | `github-pr-review-image-attachments.test.ts` / `should extract Markdown and HTML image URLs in source order` | 作成 | |
| R2 | PR 通常コメント内の Markdown 画像記法から URL を抽出し、本文を placeholder 化する | `PrReviewData.comments[].body` → attachment resolver | `github-pr-review-image-attachments.test.ts` / `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | 作成 | |
| R3 | review summary / review thread コメント内の Markdown 画像記法を処理する | `PrReviewData.reviews[].body` → attachment resolver | `github-pr-review-image-attachments.test.ts` / `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | 作成 | |
| R4 | PR 本文内の HTML `<img src="...">` から URL を抽出する | GitHub PR review 画像抽出 helper | `github-pr-review-image-attachments.test.ts` / `should extract Markdown and HTML image URLs in source order` | 作成 | |
| R5 | PR 通常コメント内の HTML `<img src="...">` を placeholder 化する | `PrReviewData.comments[].body` → attachment resolver | `github-pr-review-image-attachments.test.ts` / `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | 作成 | |
| R6 | review summary / review thread コメント内の HTML 画像も同じ helper の対象にできる | 共通抽出 helper | `github-pr-review-image-attachments.test.ts` / `should extract Markdown and HTML image URLs in source order` | 作成 | |
| R7 | 許可対象 URL をローカル一時ファイルへダウンロードする | attachment resolver → fetch dependency → temp file | `github-pr-review-image-attachments.test.ts` / `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | 作成 | |
| R8 | ダウンロード対象を GitHub attachment URL に限定する | URL allowlist | `github-pr-review-image-attachments.test.ts` / `should allow only GitHub attachment URL shapes from PR text` | 作成 | |
| R9 | private repository 画像取得のため認証済み GitHub 経路を使う | `getAuthToken` → fetch Authorization header | `github-pr-review-image-attachments.test.ts` / `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | 作成 | |
| R10 | PNG/JPEG/GIF/WebP を対応形式として扱う | MIME / magic bytes / fileName extension | `github-pr-review-image-attachments.test.ts`, `imageData.test.ts` | 作成 | |
| R11 | Content-Type を検証する | download response validation | `github-pr-review-image-attachments.test.ts` / `should reject unsupported Content-Type before saving an attachment` | 作成 | |
| R12 | magic bytes を検証する | shared image data utility / resolver | `imageData.test.ts`, `github-pr-review-image-attachments.test.ts` | 作成 | |
| R13 | Content-Type と magic bytes の不一致を拒否する | download response validation | `github-pr-review-image-attachments.test.ts` / `should reject Content-Type and magic byte mismatches` | 作成 | |
| R14 | サイズ上限を設ける | Content-Length validation | `github-pr-review-image-attachments.test.ts` / `should reject images above the configured byte limit from Content-Length` | 作成 | |
| R15 | `.takt/tasks/<slug>/attachments/` に `image-1.png` などで保存する | `takt add --pr` → `saveTaskFile()` → task attachment promotion | `addTask.test.ts` / `should save PR image attachments and format placeholder-updated PR content` | 作成 | |
| R16 | `order.md` に既存 attachment 形式で追記する | `buildTaskOrderContent()` 経由の保存結果 | `addTask.test.ts` / `should save PR image attachments and format placeholder-updated PR content` | 作成 | |
| R17 | 元コメント本文の画像参照を `[Image #N]` で参照可能にする | resolver が返す placeholder 化済み `PrReviewData` | `github-pr-review-image-attachments.test.ts`, `addTask.test.ts`, `cli-routing-pr-resolve.test.ts` | 作成 | |
| R18 | pipeline `--pr` 経路でも画像を参照できる | `resolveTaskContent()` → `runWorkflow()` → task spec staging → `executeTask()` | `pipelineExecution.test.ts` / `should stage PR image attachments before pipeline task execution` | 作成 | |
| R19 | 新規ロジックに unit test を追加する | 抽出・allowlist・download validation・shared image data | `github-pr-review-image-attachments.test.ts`, `imageData.test.ts` | 作成 | |
| R20 | `npm run build`、`npm run lint`、`npm test` が成功する | 後続 implement/fix フェーズ | 未作成 | 未作成 | write_tests フェーズでは実装前のため、成功確認は後続フェーズで行う |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| 外部 URL | `https://example.com/...` や `private-user-images.githubusercontent.com` を PR 本文から直接取得する | `should allow only GitHub attachment URL shapes from PR text` | |
| 重複 URL | 同一画像 URL を複数回 download し、placeholder が分裂する | `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | |
| 認証欠落 | private repo 画像で Authorization header なしの fetch を行う | `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | |
| token 取得失敗 | `gh auth token` 相当の失敗後に fetch へ進む | `should fail fast when GitHub authentication token cannot be resolved` | |
| Content-Type 不正 | `text/plain` などを画像として保存する | `should reject unsupported Content-Type before saving an attachment` | |
| magic bytes 不一致 | `Content-Type: image/png` だが JPEG bytes のファイルを保存する | `should reject Content-Type and magic byte mismatches` | |
| サイズ超過 | 上限超過の画像を body 読み込み・保存まで進める | `should reject images above the configured byte limit from Content-Length` | |
| PR 本文のみ | comments/reviews が空だと PR body 画像も無視して task 作成しない | `addTask.test.ts` / `should save PR image attachments and format placeholder-updated PR content` | |
| 完全空 PR | body/comments/reviews がすべて空でも task を作成する | `addTask.test.ts` / `should not create a PR task when PR has no body or review comments` | |
| pipeline staging 漏れ | attachments があるのに通常 task 文字列を直接 `executeTask()` へ渡す | `pipelineExecution.test.ts` / `should stage PR image attachments before pipeline task execution` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | `resolvePrReviewImageAttachments()` | `saveTaskFile()` / `prepareTaskSpecDirectory()` | placeholder 化済み本文と `TaskAttachment[]` が保存され、`order.md` と `attachments/` に反映される | `addTask.test.ts` / `should save PR image attachments and format placeholder-updated PR content` | |
| 通常 `takt --pr` | `resolvePrInput()` | `selectAndExecuteTask()` | PR source context の画像添付が interactive 結果に埋もれず実行オプションへ渡る | `cli-routing-pr-resolve.test.ts` / `should pass PR image attachments from source context to task execution` | |
| pipeline `--pr` | `resolveTaskContent()` | `runWorkflow()` / `executeTask()` | attachment 付き task spec が一時 staging され、実行 prompt が staged `order.md` を参照する | `pipelineExecution.test.ts` / `should stage PR image attachments before pipeline task execution` | |
| shared image validation | `imageData` utility | inline paste / PR image resolver | PNG/JPEG/GIF/WebP の magic bytes と 10 MiB 上限を共有する | `imageData.test.ts` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 外部 URL を無制限に取得する | allowlist の boolean 結果と fetch 呼び出し回数 | `should allow only GitHub attachment URL shapes from PR text`, `should download allowed PR images, replace references with placeholders, and deduplicate repeated URLs` | |
| unsupported MIME を保存する | Promise rejection と temp attachment 非生成 | `should reject unsupported Content-Type before saving an attachment` | |
| MIME と実データが不一致の画像を保存する | Promise rejection | `should reject Content-Type and magic byte mismatches` | |
| token なしで private 画像取得へ進む | `fetch` が呼ばれないことを mock call で確認 | `should fail fast when GitHub authentication token cannot be resolved` | |
| pipeline で attachment path が run context に置換されない | `executeTask` 実行直前の staged `order.md` を読み、`.takt/runs/.../context/task/attachments/image-1.png` を確認 | `should stage PR image attachments before pipeline task execution` | |
| staged attachment を実行後に残す | `executePipeline()` 後に staged order / attachment path が消えていることを確認 | `should stage PR image attachments before pipeline task execution` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/github-pr-review-image-attachments.test.ts` | 単体 | 8 | PR review 本文からの画像抽出、GitHub URL allowlist、認証 fetch、placeholder 化、dedupe、MIME/magic/size validation、cleanup |
| `src/__tests__/imageData.test.ts` | 単体 | 4 | 共有画像 utility の magic bytes 判定、拡張子変換、10 MiB 上限 |
| `src/__tests__/addTask.test.ts` | 統合寄り単体 | 既存 + 1 追加 / 1 更新 | `takt add --pr` で PR 画像添付を task attachment 保存経路へ渡す契約 |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 統合寄り単体 | 既存 + 1 追加 / 1 更新 | 通常 `takt --pr` の PR 画像添付を interactive 実行へ伝搬する契約 |
| `src/__tests__/pipelineExecution.test.ts` | 統合寄り単体 | 既存 + 1 追加 | pipeline `--pr` の attachment staging と cleanup 契約 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| 実 GitHub private attachment のライブ取得 | 認証状態・ネットワーク・GitHub 側 URL 期限に依存し、write_tests で deterministic に固定すると不安定になるため | 実装後に手元または E2E 環境で `gh auth token` ありの手動確認 |
| redirect 後 URL の詳細挙動 | 計画では初期 URL allowlist を GitHub attachment URL に限定し、redirect 後の扱いは fetch 実装境界の責務としているため | 実装時に redirect 後も Content-Type/magic/size を必ず検証することをレビューで確認 |
| body stream 読み取り途中でのサイズ超過 | 今回は Content-Length 境界を固定した。stream chunk 超過は実装詳細に寄りやすく、後続実装の reader 形状確定後に追加する方が正確 | 実装で streaming reader を入れる場合、Content-Length 欠落時の累積サイズ超過テストを追加 |
| interactive paste 既存経路の回帰 | `imageData.test.ts` で共有 utility 契約は固定したが、inline paste 側の import 差し替え後の既存テスト更新は実装フェーズで行う方が差分が明確 | 実装後に `inlineImagePaste.test.ts` を再実行し、必要なら shared utility 経由の回帰を追加 |
| `npm run build` / `npm run lint` / full `npm test` 成功 | 実装前のため未実装 import が残る状態で成功しない | implement/fix フェーズで全件実行 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

実行コマンド:

```bash
npm run test:unit -- src/__tests__/github-pr-review-image-attachments.test.ts src/__tests__/imageData.test.ts src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts
```

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 87 | 既存テストの多くは通過 |
| Fail / Import Error（想定内） | 8 | 未実装の `src/infra/github/prReviewImageAttachments.ts`、`src/shared/utils/imageData.ts`、および未配線 production 経路に起因 |
| Error（要対応） | 0 | テスト側の既存 import パスミスや、実装後も残ると判断できるエラーは確認されていない |

## 備考
- このフェーズではプロダクションコードを変更していない。
- `coding` スキルの参照先 `/Users/m_naruse/work/git/takt/builtins/ja/...` はこの環境では存在しなかったため、今回のプロンプトで提示された Knowledge / Policy 原本と `reports/plan.md` を根拠にした。
- 指定された Report Directory では `reports/plan.md` と `reports/findings-ledger.json` のみを参照対象とし、他のレポートディレクトリは参照していない。