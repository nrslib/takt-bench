# テスト作成レポート

## 要件-テスト対応表

| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| REQ-IMG-01 | PR body / conversation comments / review summaries / review thread comments 内の Markdown 画像・HTML `<img>` を検出する | PR review data 変換 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| REQ-IMG-02 | GitHub attachment URL は `[Image #N]` に置換し、同じ URL は同じ placeholder に dedupe する | PR review data 変換 | `preparePrReviewTaskWithImageAttachments should replace GitHub Markdown and HTML image references with stable placeholders` | 作成 | |
| REQ-IMG-03 | GitHub attachment URL 以外の外部画像 URL は取得しない | PR review data 変換 / 外部送信禁止 | `preparePrReviewTaskWithImageAttachments should leave non-GitHub image URLs untouched and avoid downloading them` | 作成 | |
| REQ-IMG-04 | PNG/JPEG/GIF/WebP の magic bytes を判定する | shared image utility | `src/__tests__/imageMime.test.ts` | 作成 | |
| REQ-IMG-05 | Content-Type と magic bytes の一致を検証する | shared image utility | `image MIME validation should accept supported Content-Type headers when magic bytes match`, `should reject a supported Content-Type when magic bytes disagree` | 作成 | |
| REQ-IMG-06 | 画像サイズ上限は 10MiB とする | shared image utility | `image MIME validation should expose the shared PR image attachment size limit` | 作成 | |
| REQ-ATT-01 | ダウンロード済み画像を `TaskAttachment[]` に変換し、`image-1.png` 等の fileName を付ける | PR review data 変換 | `preparePrReviewTaskWithImageAttachments should replace GitHub Markdown and HTML image references with stable placeholders` | 作成 | |
| REQ-ADD-01 | `takt add --pr` で PR 画像添付を `.takt/tasks/<slug>/attachments/` に保存する | CLI / task 永続化 | `addTask should save PR image attachments into the task spec directory` | 作成 | |
| REQ-ADD-02 | `order.md` に `## 添付画像` と `- [Image #1]: \`attachments/image-1.png\`` を出力する | task spec 保存形式 | `addTask should save PR image attachments into the task spec directory` | 作成 | |
| REQ-ADD-03 | `takt add --pr` の既存 PR task metadata を維持する | CLI / task 永続化 | `addTask should create task from PR review comments with PR-specific task settings` | 既存更新 | |
| REQ-CLI-01 | `takt --pr` の interactive seed に PR 添付を渡す | CLI routing / interactive seed | `cli-routing-pr-resolve should pass PR image attachments to interactive mode seed` | 作成 | |
| REQ-CLI-02 | interactive mode selection cancel 時に PR 添付一時ファイル cleanup を呼ぶ | CLI routing / cleanup | `cli-routing-pr-resolve should cleanup PR image attachments when interactive mode selection is cancelled` | 作成 | |
| REQ-PIPE-01 | pipeline `--pr` で attachment 付き task spec を stage して `executeTask` に渡す | pipeline / task execution | `pipelineExecution should stage PR image attachments before workflow execution` | 作成 | |
| REQ-CLEAN-01 | `takt add --pr` の workflow 選択キャンセル時に cleanup を呼ぶ | CLI / cleanup | `addTask should not save PR task when workflow selection is cancelled` | 既存更新 | |

## 危険分岐テスト

| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| Content-Type と magic bytes 不一致 | `image/png` header だけを信用して JPEG data を受け入れる | `imageMime.test.ts` | |
| unsupported Content-Type | SVG 等を対応画像として扱う | `imageMime.test.ts` | |
| 外部 URL | `https://example.com/...` を無制限に取得する | `prReviewImageAttachments.test.ts` | |
| duplicate URL | 同一画像を複数回 download し、placeholder が分裂する | `prReviewImageAttachments.test.ts` | |
| 画像なし PR | attachment 処理が不要な PR で downloader を呼ぶ | `prReviewImageAttachments.test.ts` | |
| `takt add --pr` workflow cancel | 保存されないのに一時添付が残る | `addTask.test.ts` | |
| interactive mode selection cancel | interactive に入らないのに一時添付が残る | `cli-routing-pr-resolve.test.ts` | |
| pipeline `--pr` attachment あり | task text 直渡しのままで run context に画像が届かない | `pipelineExecution.test.ts` | |

## 横断経路テスト

| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | `preparePrReviewTaskWithImageAttachments` | `saveTaskFile` / `prepareTaskSpecDirectory` | attachment が `order.md` と `attachments/` に保存される | `addTask should save PR image attachments into the task spec directory` | |
| `takt --pr` interactive | PR review attachment helper | `interactiveMode` seed | `sourceContext` と `attachments` が同時に渡る | `cli-routing-pr-resolve should pass PR image attachments to interactive mode seed` | |
| pipeline `--pr` | PR review attachment helper | `prepareTaskSpecDirectory` / `stageTaskSpecForExecution` / `executeTask` | staged prompt が実行され、reportDirName が stage と execute で揃う | `pipelineExecution should stage PR image attachments before workflow execution` | |

## 否定契約

| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 任意外部 URL の画像取得 | downloader 呼び出し回数と URL を検証 | `preparePrReviewTaskWithImageAttachments should leave non-GitHub image URLs untouched and avoid downloading them` | |
| Content-Type のみで画像を信用する | magic bytes mismatch で throw を期待 | `imageMime.test.ts` | |
| unsupported image type の保存 | unsupported Content-Type で throw を期待 | `imageMime.test.ts` | |
| PR コメントなし既存挙動の破壊 | `addTask` で attachment helper が呼ばれないことを検証 | `addTask should not create a PR task when PR has no review comments` | |
| pipeline で attachment を無視して task text を直渡しする | `executeTask.task` が staged prompt になることを検証 | `pipelineExecution.test.ts` | |

## 作成テスト

| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/imageMime.test.ts` | 単体 | 6 | 画像 MIME / magic bytes / extension / size limit の shared utility 契約 |
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 3 | PR review data から taskContent と `TaskAttachment[]` を生成する契約 |
| `src/__tests__/addTask.test.ts` | 統合 | 2追加、既存3更新 | `takt add --pr` 保存経路、`order.md`、attachments 配置、cleanup |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 統合 | 2追加、既存1更新 | `takt --pr` interactive seed への attachments 伝搬と cleanup |
| `src/__tests__/pipelineExecution.test.ts` | 統合 | 1追加 | pipeline `--pr` の task spec staging と executeTask 伝搬 |

## 未カバー項目

| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `gh auth token` を使った認証済み取得 | 実装前で downloader の内部境界が未確定のため、今回のテストでは helper への URL 伝搬と shared validation を固定した | 実装時に downloader 専用テストで `gh auth token` 呼び出し、token 非漏洩、エラー伝播を確認 |
| redirect 回数上限 / token 転送制御 | HTTP 実装詳細に依存するため、現時点では安定した public contract として固定していない | downloader 実装後に redirect 先 host ごとの Authorization header 有無をテスト |
| Content-Length 超過 / 読み込み中の上限超過 | downloader 実装の stream 処理に依存するため、shared constant のみ固定した | downloader 実装後に Content-Length 事前拒否と累積 byte 超過拒否をテスト |
| 実ネットワークを使った GitHub private attachment 取得 | 単体テストでは外部ネットワークを使わない方針のため未作成 | 必要なら mock provider または gh CLI を使う E2E で別途確認 |

## 実行結果（参考）

実装前のためテスト失敗・import エラーは想定内。

実行コマンド:

```bash
npm run test:unit -- src/__tests__/imageMime.test.ts src/__tests__/prReviewImageAttachments.test.ts src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts
```

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 87 tests | 既存テストは多くが通過 |
| Fail / Import Error（想定内） | 2 failed suites + 7 failed tests | `imageMime.js`、`prReviewImageAttachments.js` 未実装、および既存入口が helper 未配線 |
| Error（要対応） | 0 | 実装後も残る既存 import パスミスや構文エラーは確認されていない |

## 備考

- プロダクションコードは変更していない。
- 追加したテストは、実装予定の契約として `preparePrReviewTaskWithImageAttachments({ cwd, prReview, downloadImageAttachment? })` と `shared/utils/imageMime.js` の公開関数を前提にしている。
- 既存の dirty files である `.takt/config.yaml`、`package-lock.json`、`.takt/workflows/` は今回の作業対象外であり、変更していない。