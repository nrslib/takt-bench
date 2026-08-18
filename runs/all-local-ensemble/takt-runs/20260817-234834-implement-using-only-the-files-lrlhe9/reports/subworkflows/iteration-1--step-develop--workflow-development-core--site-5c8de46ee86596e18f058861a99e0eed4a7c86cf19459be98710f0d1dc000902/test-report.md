# テスト作成レポート

## 完了契約-テスト対応表
| 契約ID | 由来 | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|------|----------------|-----------|--------|------|--------------|
| `IMG-1` | 計画 | PR 本文・通常コメント・review thread コメント内の画像 URL を Markdown 画像構文と HTML `<img>` から抽出する | 実行時（`extractImageUrls`） | `src/__tests__/imageExtraction.test.ts` "should extract Markdown image URLs from a body" / "should extract HTML img src URLs from a body" / "should extract both Markdown and HTML image URLs in document order" | 作成 | なし |
| `IMG-1` | 計画 | コードフェンス・インラインコード内の画像構文は抽出しない | 実行時（`extractImageUrls`） | `src/__tests__/imageExtraction.test.ts` "should not extract image URLs inside fenced code blocks" / "should not extract image URLs inside inline code spans" | 作成 | なし |
| `IMG-2` | 計画 | 検出した画像をダウンロードし、Content-Type と magic bytes を検証し、サイズ上限を適用する（PNG/JPEG/GIF/WebP） | 実行時（`downloadPrImages`） | `src/__tests__/imageDownload.test.ts` "should download GitHub attachment images and return stored attachments with replaced bodies" / "should reject a downloaded image whose magic bytes do not match a supported format" / "should reject a downloaded image that exceeds the size limit" | 作成 | なし |
| `IMG-4` | 計画 | 元コメント本文内の画像参照を `[Image #N]` に置換する | 実行時（`replaceImageReferences`） | `src/__tests__/imageExtraction.test.ts` "should replace Markdown image syntax with the mapped placeholder" / "should replace HTML img tags with the mapped placeholder" | 作成 | なし |
| `IMG-5` | 計画 | pipeline `--pr` 経路で画像をダウンロードし、attachment 付き task spec を `executeTask` へ渡す | CLI（pipeline `--pr`） | `src/__tests__/pipelineExecution.test.ts` "should download PR images and pass a task spec to task execution" | 作成 | なし |
| `IMG-6` | 計画 | GitHub attachment URL に限定し、外部 URL を取得しない | 実行時（`isGitHubAttachmentUrl`） | `src/__tests__/imageDownload.test.ts` "should accept GitHub user-attachments asset URLs" / "should accept GitHub org/repo asset URLs" / "should reject external non-GitHub URLs" / "should reject non-https GitHub URLs" | 作成 | なし |
| `IMG-3` | 計画 | ダウンロードした画像を `.takt/tasks/<slug>/attachments/` に保存し、`order.md` に既存 attachment 形式で追記する | 実行時（`prepareTaskSpecDirectory` / `buildTaskOrderContent`） | 既存 `src/__tests__/imageAttachments.test.ts` / `src/__tests__/imageAttachmentReferences.test.ts` | 既存 | 既存機構（`prepareTaskSpecDirectory` / `buildTaskOrderContent` / `promoteTaskAttachments`）は既存テストでカバー済みのため新規テスト不要 |
| `SCN-IMG-1-P1` | 計画 | PR 本文と通常コメント内の Markdown 画像構文と HTML `<img>` から画像 URL を抽出する | 実行時（`extractImageUrls`） | `src/__tests__/imageExtraction.test.ts` "should extract both Markdown and HTML image URLs in document order" | 作成 | なし |
| `SCN-IMG-1-N1` | 計画 | コードフェンス内の画像構文は抽出しない | 実行時（`extractImageUrls`） | `src/__tests__/imageExtraction.test.ts` "should not extract image URLs inside fenced code blocks" | 作成 | なし |
| `SCN-IMG-3-P1` | 計画 | 検出順に `[Image #N]` プレースホルダと `image-N.png` ファイル名を採番し重複しない | 実行時（`replaceImageReferences` / `downloadPrImages`） | `src/__tests__/imageExtraction.test.ts` "should assign placeholders in document order without collision" / `src/__tests__/imageDownload.test.ts` "should replace image references in all comment bodies with placeholders" | 作成 | なし |
| `SCN-IMG-3-N1` | 計画 | 本文に既存の `[Image #N]` プレースホルダがあっても採番が衝突しない | 実行時（`replaceImageReferences`） | `src/__tests__/imageExtraction.test.ts` "should not collide with an existing [Image #1] placeholder in the body" | 作成 | なし |

## 検証境界（外部境界または環境依存境界を持つ契約のみ）
| 契約ID | モックで確認した範囲 | 実連携範囲 | テスト環境 / HOME / 設定の分離 | 未確認理由 |
|--------|----------------------|------------|--------------------------------|------------|
| `IMG-2` | `node:child_process` の `execFileSync` をモックし、`gh api` 経由のダウンロード応答（PNG バイト列・不正バイト列・上限超過バイト列）を制御して検証 | `gh` CLI 実連携は未確認 | `imageDownload.test.ts` は `node:child_process` をモックし、実 filesystem（`node:fs`）で一時ディレクトリを作成・検証・cleanup | 実 `gh` CLI 連携は本ステップでは検証しない（test-first のため） |
| `IMG-5` | `fetchPrReviewComments` / `downloadPrImages` / `executeTask` をモックし、pipeline `--pr` 経路の配線を検証 | `gh` CLI 実連携は未確認 | `pipelineExecution.test.ts` は `../infra/git/index.js` / `../infra/github/imageDownload.js` / `../features/tasks/index.js` をモック | 実 `gh` CLI 連携は本ステップでは検証しない（test-first のため） |

## 危険分岐・識別テスト
| 契約ID | 分岐 | 失敗させたい誤実装 | 拒否する入力 / 状態とassertion | テスト | 未カバー理由 |
|--------|------|--------------------|--------------------------------|--------|--------------|
| `IMG-1` | コードフェンス・インラインコード内の画像構文 | コードフェンス内の URL も抽出してしまう誤実装 | フェンス・インラインコードで囲まれた画像構文を入力し、抽出結果が空配列であることを検証 | `src/__tests__/imageExtraction.test.ts` "should not extract image URLs inside fenced code blocks" / "should not extract image URLs inside inline code spans" | なし |
| `IMG-2` | magic bytes 不一致 | 検証なしでダウンロードを受け入れる誤実装 | 非画像バイト列を入力し、`/unsupported image format/i` で例外を検証 | `src/__tests__/imageDownload.test.ts` "should reject a downloaded image whose magic bytes do not match a supported format" | なし |
| `IMG-2` | サイズ上限超過 | 上限を超える画像を受け入れる誤実装 | 上限（10MB）を超えるバイト列を入力し、`/size limit/i` で例外を検証 | `src/__tests__/imageDownload.test.ts` "should reject a downloaded image that exceeds the size limit" | なし |
| `IMG-6` | 外部 URL・非 https URL | 外部 URL を無制限に取得する誤実装 | 外部 URL・非 https URL を入力し、`isGitHubAttachmentUrl` が false を返し、`execFileSync` が呼ばれないことを検証 | `src/__tests__/imageDownload.test.ts` "should reject external non-GitHub URLs" / "should reject non-https GitHub URLs" / "should skip external non-GitHub URLs without downloading them" | なし |
| `SCN-IMG-3-N1` | 既存 `[Image #1]` との採番衝突 | 既存プレースホルダと衝突する番号を採番する誤実装 | 本文に既存 `[Image #1]` を含め、新規 URL が `[Image #2]` に置換されることを検証 | `src/__tests__/imageExtraction.test.ts` "should not collide with an existing [Image #1] placeholder in the body" | なし |

## 影響経路テスト（該当する契約のみ）
| 契約ID | 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|--------|------|----------|----------|--------------|--------|--------------|
| `IMG-5` | pipeline `--pr` → `fetchPrReviewComments` → `downloadPrImages` → `executeTask`（taskSpec 経由） | `resolveTaskContent`（`src/features/pipeline/steps.ts`） | `executeTask`（`src/features/tasks/execute/taskExecution.ts`） | 添付画像が task spec 経由で参照される | `src/__tests__/pipelineExecution.test.ts` "should download PR images and pass a task spec to task execution" | なし |
| `IMG-2` | 抽出 URL → `gh api` ダウンロード → 検証 → 一時ファイル保存 → `StoredImageAttachment[]` | `downloadPrImages`（新規 `src/infra/github/imageDownload.ts`） | `prepareTaskSpecDirectory` / `promoteTaskAttachments` | 有効な画像のみ保存され、無効形式・上限超過は拒否される | `src/__tests__/imageDownload.test.ts` downloadPrImages 群 | なし |

## 連続実行・所有権・並行性（該当する場合）
| 契約ID | 実行シーケンスまたは交差 | 実際の上位入口 | 観測する不変条件 | テスト | 未カバー理由 |
|--------|--------------------------|----------------|------------------|--------|--------------|
| `IMG-2` | 一時ファイルの作成 → 検証 → 保存 → cleanup | `downloadPrImages`（新規 `src/infra/github/imageDownload.ts`） | 一時ファイルが呼び出し元の cleanup 対象として返され、テスト後は削除される | `src/__tests__/imageDownload.test.ts`（`afterEach` で一時ルートを削除） | なし |

## 否定契約
| 契約ID | 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------|----------------|----------|--------|--------------|
| `IMG-6` | 外部 URL を無制限に取得する | `execFileSync` が呼ばれないこと、`attachments` が空であること、本文が未変更であることを検証 | `src/__tests__/imageDownload.test.ts` "should skip external non-GitHub URLs without downloading them" | なし |
| `IMG-2` | 無効形式・上限超過の画像を受け入れる | 例外が投げられることを検証 | `src/__tests__/imageDownload.test.ts` "should reject a downloaded image whose magic bytes do not match a supported format" / "should reject a downloaded image that exceeds the size limit" | なし |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/imageExtraction.test.ts` | 単体 | 11 | `extractImageUrls`（Markdown/HTML 抽出、コードフェンス・インラインコード非抽出、文書順）と `replaceImageReferences`（プレースホルダ置換、採番衝突回避、未マップ URL 保持） |
| `src/__tests__/imageDownload.test.ts` | 統合（light IT） | 9 | `isGitHubAttachmentUrl`（GitHub URL 受容・外部/非 https 拒否）と `downloadPrImages`（ダウンロード・保存・本文置換、magic bytes 検証、サイズ上限、外部 URL スキップ、全コメント種別の置換） |
| `src/__tests__/pipelineExecution.test.ts` | 単体（既存ファイルへ追加） | 1（追加） | pipeline `--pr` 経路で `downloadPrImages` が呼ばれ、`executeTask` へ taskSpec が渡る配線 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `IMG-3`（`attachments/` 配置・`order.md` 追記） | 既存機構（`prepareTaskSpecDirectory` / `buildTaskOrderContent` / `promoteTaskAttachments`）は既存テスト（`imageAttachments.test.ts` / `imageAttachmentReferences.test.ts`）でカバー済みのため新規テスト不要 | 実装ステップで `downloadPrImages` の出力が `TaskAttachment[]` として既存機構へ渡る配線を確認 |
| 実 `gh` CLI 連携（private repository 画像のダウンロード） | test-first のため実連携は検証しない | 実装後の手動確認または E2E で確認 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | 新規テストは未実装モジュール起因で失敗 |
| Fail / Import Error（想定内） | 3 | `imageExtraction.test.ts`（`imageExtraction.js` 未実装）、`imageDownload.test.ts`（`imageDownload.js` 未実装）、`pipelineExecution.test.ts` の IMG-5 テスト（`downloadPrImages` 未配線） |
| Error（要対応） | 0 | なし |

## 備考（判断がある場合のみ）
- **test-first の確認**: 新規テストはすべて未実装のプロダクションコード（`src/infra/git/imageExtraction.ts` / `src/infra/github/imageDownload.ts` / pipeline の `downloadPrImages` 配線）を理由に失敗することを確認した。テストファイル自体の構文・設定・fixture の欠陥ではない。
- **テスト分類**: `imageDownload.test.ts` は実 filesystem（`node:fs` をモックせず使用）をまたぐため、`scripts/test-classification.mjs` の `fileSystemIntegrationTestFiles` に追加し light IT として分類した。`imageExtraction.test.ts` は純粋な単体テスト。分類契約テスト（`releaseVerificationWiring.test.ts`）は 17/17 成功。
- **IMG-5 の契約**: 計画の実装アプローチ（`prepareTaskSpecDirectory` + `resolveTaskSpecForExecution` で task spec を生成し `executeTask` へ渡す）に合わせ、`executeTask` の `taskSpec` フィールドが定義されることを検証するテストとした。
- **セルフスキャン**: 今回の編集で未使用 import・依存方向の違反はなし。`npm install` による `package-lock.json` の意図しない変更は revert 済み。`npm run build` 成功。
- **既存テストへの影響**: `pipelineExecution.test.ts` に IMG-5 テストを追加したが、既存 51 テストはすべてパス（追加テストのみ想定内失敗）。