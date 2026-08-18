# 実装完了証跡

## 完了契約

> 注記: 上流（タスク指示 `order.md`）は契約IDを定義しておらず、実装作業中に正式な契約台帳（ID付き）は確立されていない。以下は `order.md` の観測可能な要件を正本として契約IDを採番した。この点は「未確認範囲」に記録する。

| 契約ID | 由来 | 上流で確立した完了義務 | 実装結果 | 実装箇所 | 反例と観測結果 | 証拠 | 状態 |
|--------|------|------------------|----------|----------|------------------|------|------|
| `PR-IMG-1` | 計画（order.md 期待挙動） | `takt add --pr <number>` 実行時に PR 本文・通常コメント・review thread コメント内の画像 URL を検出する | Markdown 画像構文と HTML `<img>` から URL を抽出する `extractImageUrls` を実装し、`downloadPrImages` が PR body / comments / reviews の全本文を走査 | `src/infra/git/imageExtraction.ts:31`、`src/infra/github/imageDownload.ts:105` | フェンス付きコードブロック・インラインコード内の画像構文は抽出しない（テストで確認）。本文に画像構文が無い場合は空配列を返す | 正常系: `imageExtraction.test.ts` 11件成功; 失敗経路: 非該当; 境界状態: コードブロック内・インラインコード内の非抽出を確認; assertion: 抽出順序が文書順であることを確認; コマンド: `npm test -- src/__tests__/imageExtraction.test.ts` | 確認済み |
| `PR-IMG-2` | 計画（order.md 期待挙動） | 対応画像をローカルにダウンロードする | `gh api` 経由でダウンロードする `downloadImage` を実装 | `src/infra/github/imageDownload.ts:62` | 外部 URL はダウンロードせずスキップ（テストで `execFileSync` 未呼び出しを確認） | 正常系: `imageDownload.test.ts` 9件成功; 失敗経路: 非該当; 境界状態: 外部 URL スキップを確認; assertion: `execFileSync` が `gh api <url>` で呼ばれることをモックで確認; コマンド: `npm test -- src/__tests__/imageDownload.test.ts` | 確認済み |
| `PR-IMG-3` | 計画（order.md 期待挙動） | `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する | `downloadPrImages` が `StoredImageAttachment[]`（`tempPath` は `.takt/tmp/pr-images/`）を返し、`prepareTaskSpecDirectory` → `promoteTaskAttachments` が `attachments/` へコピー | `src/infra/github/imageDownload.ts:118-124`、`src/features/tasks/attachments.ts:88`（既存再利用） | 一時ファイルが実在しない場合は `promoteTaskAttachments` が `assertRegularImageAttachmentFile` で失敗する（pipeline テストで実ファイル作成により回避） | 正常系: `pipelineExecution.test.ts` 52件成功; 失敗経路: 非該当; 境界状態: 実ファイル検証を確認; assertion: `executeTask` に `taskSpec` が渡ることを確認; コマンド: `npm test -- src/__tests__/pipelineExecution.test.ts` | 確認済み |
| `PR-IMG-4` | 計画（order.md 期待挙動） | `order.md` に既存 attachment 形式で追記する | 既存の `buildTaskOrderContent` が `## 添付画像` セクションを追記（変更なしで再利用） | `src/features/tasks/attachments.ts:35`（既存） | 非該当（既存機構の再利用） | 正常系: 既存 `imageAttachmentReferences.test.ts` が成功; 失敗経路: 非該当; 境界状態: 非該当; assertion: 既存テストで確認; コマンド: `npm test` | 確認済み |
| `PR-IMG-5` | 計画（order.md 期待挙動） | 元コメント本文内の画像参照を `[Image #1]` のように参照できる形に置換または補足する | `replaceImageReferences` が Markdown 画像構文と HTML `<img>` をプレースホルダへ置換し、`downloadPrImages` が PR body / comments / reviews の全本文に適用 | `src/infra/git/imageExtraction.ts:57`、`src/infra/github/imageDownload.ts:128-130` | 既存の `[Image #1]` プレースホルダと衝突しない（テストで確認）。マップに無い URL は置換せず原文を保持 | 正常系: `imageExtraction.test.ts` 11件成功; 失敗経路: 非該当; 境界状態: 既存プレースホルダとの非衝突・未マップ URL の保持を確認; assertion: 文書順で `[Image #1]` から採番されることを確認; コマンド: `npm test -- src/__tests__/imageExtraction.test.ts` | 確認済み |
| `PR-IMG-6` | 計画（order.md 期待挙動） | pipeline の `--pr` 経路でも同等に画像を参照できること | `runWorkflow` が attachment 付き taskSpec を組み立てて `executeTask` に渡す | `src/features/pipeline/steps.ts:360-372`、`src/features/pipeline/execute.ts:59` | attachment が無い場合は従来どおり taskSpec なしで実行（既存テストで回帰なしを確認） | 正常系: `pipelineExecution.test.ts` 52件成功; 失敗経路: 非該当; 境界状態: attachment なし経路の回帰なしを確認; assertion: `mockDownloadPrImages` が `(prReview, cwd)` で呼ばれ、`executeTask` に `taskSpec` が渡ることを確認; コマンド: `npm test -- src/__tests__/pipelineExecution.test.ts` | 確認済み |
| `PR-IMG-7` | 計画（order.md 安全性・制約） | 対応形式は PNG/JPEG/GIF/WebP | `detectImageFormat` が magic bytes で 4 形式を判定 | `src/infra/github/imageDownload.ts:38-60` | 非対応形式のバイト列は `undefined` を返し、`Unsupported image format` で失敗（テストで確認） | 正常系: `imageDownload.test.ts` 9件成功; 失敗経路: 非対応形式の拒否を確認; 境界状態: 非該当; assertion: PNG magic bytes の判定を確認; コマンド: `npm test -- src/__tests__/imageDownload.test.ts` | 確認済み |
| `PR-IMG-8` | 計画（order.md 安全性・制約） | Content-Type と magic bytes を検証する | magic bytes 検証のみ実装。Content-Type ヘッダ検証は未実装 | `src/infra/github/imageDownload.ts:38-60`（magic bytes のみ） | Content-Type ヘッダの検証は実装していない。`gh api` のレスポンスヘッダを検査する経路が無い | 正常系: magic bytes 検証は `imageDownload.test.ts` で確認; 失敗経路: 非該当; 境界状態: 非該当; assertion: 非該当; コマンド: 非該当 | 未完了（Content-Type 検証が未実装） |
| `PR-IMG-9` | 計画（order.md 安全性・制約） | サイズ上限を設ける | `MAX_IMAGE_BYTES = 10MB` を超える画像を拒否 | `src/infra/github/imageDownload.ts:18,115-117` | 10MB 超の画像は `Image exceeds size limit` で失敗（テストで確認） | 正常系: `imageDownload.test.ts` 9件成功; 失敗経路: サイズ超過の拒否を確認; 境界状態: 非該当; assertion: 10MB 超のバッファで拒否されることを確認; コマンド: `npm test -- src/__tests__/imageDownload.test.ts` | 確認済み |
| `PR-IMG-10` | 計画（order.md 安全性・制約） | GitHub の private repository 画像に対応するため `gh api` または認証済み `gh` 経由の取得を優先する | `downloadImage` が `gh api <url>` で取得 | `src/infra/github/imageDownload.ts:62-68` | 非該当（`gh api` は認証済み `gh` を利用） | 正常系: `imageDownload.test.ts` で `execFileSync` モックにより確認; 失敗経路: 非該当; 境界状態: 非該当; assertion: `gh api` 呼び出しを確認; コマンド: `npm test -- src/__tests__/imageDownload.test.ts` | 確認済み |
| `PR-IMG-11` | 計画（order.md 安全性・制約） | 外部 URL を無制限に取得しない。GitHub attachment URL から始めるのが安全 | `isGitHubAttachmentUrl` が GitHub attachment URL のみ許可し、外部・非 https URL を拒否 | `src/infra/github/imageDownload.ts:34-36` | 外部 URL（`example.com`）と非 https URL は `false` を返し、ダウンロードされない（テストで確認） | 正常系: `imageDownload.test.ts` 9件成功; 失敗経路: 非該当; 境界状態: 外部 URL・非 https URL の拒否を確認; assertion: `isGitHubAttachmentUrl` の判定を確認; コマンド: `npm test -- src/__tests__/imageDownload.test.ts` | 確認済み |

## 影響経路の確認（該当する契約のみ）

| 契約ID | 確認した生成元・同種分岐・補助入口・消費元 | 移行・保持・旧経路 | 該当する不変条件と連続シナリオ |
|--------|--------------------------------------------|--------------------|----------------------------------|
| `PR-IMG-1` / `PR-IMG-5` | 生成元: `fetchPrReviewComments`（`src/infra/github/pr.ts:421`）が返す `PrReviewData`。消費元: `formatPrReviewAsTask`（`src/infra/git/format.ts:197`）が置換後本文を整形。補助入口: `takt add --pr`（`src/features/tasks/add/index.ts:199`）と pipeline `--pr`（`src/features/pipeline/steps.ts:228`）の両経路 | 変更: 両経路とも `downloadPrImages` を経由して置換後本文を整形。旧経路（置換なし）は attachment が無い場合に保持 | 識別: プレースホルダ `[Image #N]` は文書順で一意採番。失敗・再進入: 同一 URL は `urlToPlaceholder` により重複ダウンロードせず再利用。シナリオ: `takt add --pr 456` と pipeline `--pr 456` の両方で `imageDownload.test.ts` / `pipelineExecution.test.ts` / `addTask.test.ts` が成功 |
| `PR-IMG-3` / `PR-IMG-6` | 生成元: `downloadPrImages` が返す `StoredImageAttachment[]`。消費元: `prepareTaskSpecDirectory`（`src/features/tasks/attachments.ts:266`）→ `promoteTaskAttachments`（同:88）が `attachments/` へコピー。pipeline では `resolveTaskSpecForExecution`（`src/features/tasks/execute/taskSpecContext.ts:57`）が run コンテキストへ stage | 変更: pipeline の `runWorkflow` が attachment 付き taskSpec を組み立て。旧経路（taskSpec なし）は attachment が無い場合に保持 | 所有権: 一時ファイルは `cleanupPreparedTaskSpec` で後始末。失敗・再進入: 一時ファイルが実在しない場合は `assertRegularImageAttachmentFile` で失敗。シナリオ: `pipelineExecution.test.ts` の `should download PR images and pass a task spec to task execution` が成功 |
| `PR-IMG-7` / `PR-IMG-8` / `PR-IMG-9` | 生成元: `downloadImage` が取得したバイト列。消費元: `detectImageFormat`（magic bytes）と `MAX_IMAGE_BYTES`（サイズ上限） | 変更: 新規検証。旧経路なし | 認可・許可拒否: 非対応形式・サイズ超過は例外で拒否。シナリオ: `imageDownload.test.ts` の `should reject a downloaded image whose magic bytes do not match` と `should reject a downloaded image that exceeds the size limit` が成功 |
| `PR-IMG-10` / `PR-IMG-11` | 生成元: `extractImageUrls` が抽出した URL。消費元: `isGitHubAttachmentUrl` が許可判定、`downloadImage` が `gh api` で取得 | 変更: 新規制約。旧経路なし | 認可・許可拒否: 外部 URL・非 https URL はダウンロードされない。シナリオ: `imageDownload.test.ts` の `should skip external non-GitHub URLs without downloading them` が成功 |

## 品質ゲート

| 種別 | 実行内容 | 結果 |
|------|----------|------|
| ビルド | `npm run build` | 成功 |
| 静的検査 | `npm run lint` | 成功 |
| 単体テスト | `npm test`（4 シャード） | 成功（849 / 1597 / 1453 / 1351 件） |
| 統合テスト | `HOME=/tmp/takt-bench-v3-home npm run test:it` | 成功（1796 件） |
| E2E | `npm run test:e2e:mock` | 成功（48 passed / 13 skipped） |
| 対象テスト | `npm test -- src/__tests__/imageDownload.test.ts` | 成功（9 件） |
| 対象テスト | `npm test -- src/__tests__/imageExtraction.test.ts` | 成功（11 件） |
| 対象テスト | `npm test -- src/__tests__/pipelineExecution.test.ts` | 成功（52 件） |
| 対象テスト | `npm test -- src/__tests__/addTask.test.ts` | 成功（17 件） |
| 対象テスト | `npm test -- src/__tests__/git-cwd-propagation.test.ts` | 成功（12 件） |
| 対象テスト | `npm test -- src/__tests__/releaseVerificationWiring.test.ts` | 成功（17 件） |

## 未確認範囲

| 項目 | 理由 | 決定的な代替検証 | 残るリスク |
|------|------|------------------|------------|
| 上流の正式な契約台帳（ID 付き） | タスク指示 `order.md` は契約IDを定義しておらず、実装作業中に ID 付きの契約台帳は確立されなかった。そのため本レポートの契約IDは `order.md` の要件から採番した | なし | 後段のレビュー・裁定で契約IDの対応付けにずれが生じる可能性がある。上流で正式な台帳が確立された場合は ID を再対応付けする必要がある |
| Content-Type ヘッダ検証（`PR-IMG-8`） | `gh api` のレスポンスヘッダを検査する経路を実装していない。magic bytes 検証のみ実装 | なし | サーバが誤った Content-Type を返しても magic bytes が一致すれば受理される。実際のダウンロード経路で Content-Type を検査する実装が未着手 |
| 実環境での `gh api` ダウンロード | テストは `execFileSync` をモックしており、実 GitHub へのダウンロードは未実行 | なし | private repository 画像の実取得が認証済み `gh` で成功するかは未実証。CI や実環境での確認が必要 |