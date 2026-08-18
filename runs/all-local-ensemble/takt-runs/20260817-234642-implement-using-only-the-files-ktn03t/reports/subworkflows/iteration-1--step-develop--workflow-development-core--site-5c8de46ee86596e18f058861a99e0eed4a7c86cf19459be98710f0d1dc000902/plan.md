# タスク計画

## 元の要求
Implement using only the files in `.takt/runs/20260817-145204-implement-using-only-the-files-d4ztqz/context/task`.
Primary spec: `.takt/runs/20260817-145204-implement-using-only-the-files-d4ztqz/context/task/order.md`.
Use report files in Report Directory as primary execution history.
Do not rely on previous response or conversation summary.

## 分析結果

### 目的
`takt add --pr <number>` と pipeline `--pr` 経路で、PR 本文・通常コメント・review thread コメント内の画像 URL を検出し、ローカルにダウンロードして `.takt/tasks/<slug>/attachments/` に配置し、`order.md` に既存 attachment 形式で追記する機能を実装する。あわせて元コメント本文内の画像参照を `[Image #N]` に置換し、pipeline 直実行時も attachment 付き task spec を使う経路を追加する。

### 分解した要件
| # | 要件 | 変更要否 | 種別 | 由来・導出根拠 | 備考 |
|---|------|----------|------|----------------|------|
| 1 | `add --pr` と pipeline `--pr` で PR 本文・通常コメント・review thread コメント内の画像 URL を検出する（Markdown 画像構文 `![alt](url)` と HTML `<img src="...">`） | 要 | 明示 | `order.md` 11, 25-31, 43-44 行 | 抽出対象は `PrReviewData` の body / comments / reviews |
| 2 | 検出した画像をローカルにダウンロードする | 要 | 明示 | `order.md` 12 行 | ダウンロード方式は GitHub 固有（`gh api` / 認証済み `gh`） |
| 3 | 対応形式を PNG/JPEG/GIF/WebP に限定し、Content-Type と magic bytes を検証する | 要 | 明示 | `order.md` 35-36 行 | 検証に合格しない画像は拒否 |
| 4 | サイズ上限を設ける | 要 | 明示 | `order.md` 37 行 | 上限値は設計判断（既定案: 10MB） |
| 5 | ダウンロードした画像を `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する | 要 | 明示 | `order.md` 13 行 | 既存 `prepareTaskSpecDirectory` / `promoteTaskAttachments` を利用 |
| 6 | `order.md` に既存 attachment 形式で追記する（`## 添付画像` 節） | 要 | 明示 | `order.md` 16-20 行 | 既存 `buildTaskOrderContent` を利用 |
| 7 | 元コメント本文内の画像参照を `[Image #N]` に置換または補足する | 要 | 明示 | `order.md` 22 行 | 「可能なら」の緩い限定付き |
| 8 | pipeline `--pr` 経路でも画像を参照できる（attachment 付き task spec を使う） | 要 | 明示 | `order.md` 23, 47 行 | `executeTask` へ `taskSpec` を渡す経路を追加 |
| 9 | GitHub attachment URL に限定し、外部 URL を無制限に取得しない | 要 | 明示 | `order.md` 38-39 行 | GitHub attachment URL 以外はスキップ |
| 10 | `gh api` または認証済み `gh` 経由の取得を優先する | 要 | 明示 | `order.md` 38 行 | private repository 画像対応 |

### 参照資料の調査結果（参照資料がある場合）
参照資料は `order.md`（プライマリスペック）。現行実装との主要な差異は以下。

- `fetchPrReviewComments`（`src/infra/github/pr.ts:421-458`）は `PrReviewData`（body / comments / reviews（thread コメント含む））を返すが、画像 URL の抽出・ダウンロードは行わない。
- `formatPrReviewAsTask`（`src/infra/git/format.ts:197-265`）は PR レビューをタスク本文へ整形するが、画像参照の置換は行わない。
- `saveTaskFile`（`src/features/tasks/add/index.ts:39-51`）は `SaveTaskOptions.attachments` で添付画像を既に受け取れる。`prepareTaskSpecDirectory`（`src/features/tasks/attachments.ts:266-282`）が `## 添付画像` 節の追記と `attachments/` へのコピーを担う。
- `selectAndExecuteTask`（`src/features/tasks/execute/selectAndExecute.ts:104-217`）は `SelectAndExecuteOptions.attachments` で添付画像を既に受け取れる。
- pipeline の `resolveTaskContent`（`src/features/pipeline/steps.ts:213-248`）は `TaskContent` を返すが attachments フィールドを持たない。`runWorkflow`（`src/features/pipeline/steps.ts:334-374`）は `executeTask` を taskSpec なしで呼ぶ。

主な差分は、画像 URL 抽出・ダウンロード・検証の新規実装と、`add --pr` / pipeline `--pr` への添付画像配線。

### スコープ
- 新規: 画像 URL 抽出・置換（provider 中立）、画像ダウンロード・検証（GitHub 固有）
- 変更: `src/features/tasks/add/index.ts` の `--pr` 経路、`src/features/pipeline/steps.ts` / `execute.ts` の `--pr` 経路
- テスト: 新規ロジックの単体テスト、配線の統合テスト

### 検討したアプローチ（設計判断がある場合）
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| 画像 URL 抽出・置換を provider 中立な新規モジュール `src/infra/git/imageExtraction.ts` に置く | 採 | `PrReviewData` は provider 中立型（`src/infra/git/types.ts:120-130`）であり、抽出は `formatPrReviewAsTask` と同じ中立層に属する |
| ダウンロード・検証を GitHub 固有の新規モジュール `src/infra/github/imageDownload.ts` に置く | 採 | `gh api` / 認証済み `gh` 経由の取得と GitHub attachment URL 制限は GitHub 固有であり、既存 `pr.ts` と同じ層に属する |
| ダウンロードを `GitProvider` インターフェースへ追加する | 否 | GitLabProvider の更新まで波及し、要求（GitHub 固有）に結びつかない拡張になる |
| 画像参照の置換を `PrReviewData` の各 body に対して行ってから `formatPrReviewAsTask` を呼ぶ | 採 | 整形後のタスク本文に `[Image #N]` が自然に埋め込まれる |
| pipeline 直実行では `prepareTaskSpecDirectory` + `resolveTaskSpecForExecution` で task spec を生成し `executeTask` へ渡す | 採 | `selectAndExecuteTask` と同じ添付画像経路を pipeline でも使う（`order.md` 47 行の意図） |
| サイズ上限の値 | 設計判断 | `order.md` は値未指定。既定案 10MB を採用し、定数として定義する |
| ダウンロードの同期/非同期 | 設計判断 | 既存 `pr.ts` が `execFileSync` を使うため同期で統一する |

### 実装アプローチ
1. 新規 `src/infra/git/imageExtraction.ts`（provider 中立）: `extractImageUrls(body)` で Markdown 画像構文と HTML `<img>` から URL を抽出。`replaceImageReferences(body, urlToPlaceholder)` で画像構文を `[Image #N]` に置換。コードフェンス内は対象外。
2. 新規 `src/infra/github/imageDownload.ts`（GitHub 固有）: `downloadPrImages(prReview, cwd)` で全 body から URL 抽出 → GitHub attachment URL のみ取得 → `gh api` / 認証済み `gh` でダウンロード → Content-Type / magic bytes / サイズ検証 → 一時ファイル保存 → `StoredImageAttachment[]` と置換済み `PrReviewData` を返す。
3. `src/features/tasks/add/index.ts` の `--pr` 経路: `fetchPrReviewComments` 後に `downloadPrImages` を呼び、置換済み `PrReviewData` を `formatPrReviewAsTask` へ渡し、`attachments` を `saveTaskFile` のオプションへ追加。
4. `src/features/pipeline/steps.ts`: `TaskContent` に `attachments?` を追加。`resolveTaskContent` の `--pr` 経路で `downloadPrImages` を呼び attachments を返す。`runWorkflow` に attachments を渡し、`prepareTaskSpecDirectory` + `resolveTaskSpecForExecution` で task spec を生成して `executeTask` へ渡す（実行後に cleanup）。
5. `src/features/pipeline/execute.ts`: `runWorkflow` 呼び出しへ `taskContent.attachments` を渡す。
6. 単体・統合テストを追加し、`npm run build`、`npm run lint`、`npm test` で検証。

### 完了契約
| 契約ID | 要求・維持事項 | 由来 | 成立する振る舞い | 拒否すべき誤実装 | 実装箇所 | 完了証拠 |
|--------|----------------|------|------------------|--------------------|----------|----------|
| `IMG-1` | `add --pr` と pipeline `--pr` で PR 本文・通常コメント・review thread コメント内の画像 URL を検出する（Markdown 画像構文と HTML `<img>`） | 要件1 | 全コメント種別の body から画像 URL が抽出される | 一部のコメント種別だけ抽出、または抽出しない | 新規 `src/infra/git/imageExtraction.ts` | 単体テスト（SCN-IMG-1-P1/N1） |
| `IMG-2` | 検出した画像をダウンロードし、Content-Type と magic bytes を検証し、サイズ上限を適用する（PNG/JPEG/GIF/WebP） | 要件2,3,4 | 有効な画像のみダウンロードされ、無効形式・上限超過は拒否される | 検証なしでダウンロード、または無効形式・上限超過を受け入れる | 新規 `src/infra/github/imageDownload.ts` | 単体テスト |
| `IMG-3` | ダウンロードした画像を `.takt/tasks/<slug>/attachments/` に `image-N.png` として保存し、`order.md` に既存 attachment 形式で追記する | 要件5,6 | 添付画像がタスクディレクトリに配置され、`order.md` に `## 添付画像` 節が追記される | 添付画像が保存されない、または形式が異なる | `src/features/tasks/attachments.ts`（既存 `prepareTaskSpecDirectory`） | 統合テスト（SCN-IMG-3-P1/N1） |
| `IMG-4` | 元コメント本文内の画像参照を `[Image #N]` に置換または補足する | 要件7 | 本文の画像構文が `[Image #N]` に置換される | 生 URL のまま残る、または参照されない | 新規 `src/infra/git/imageExtraction.ts` | 単体テスト |
| `IMG-5` | pipeline `--pr` 経路でも画像を参照できる（attachment 付き task spec を使う） | 要件8 | pipeline `--pr` 実行時に添付画像が task spec 経由で参照される | pipeline が添付画像を扱わない | `src/features/pipeline/steps.ts` / `execute.ts` | 統合テスト |
| `IMG-6` | GitHub attachment URL に限定し、`gh api` または認証済み `gh` 経由で取得する | 要件9,10 | GitHub attachment URL のみ取得され、外部 URL は取得されない | 外部 URL を無制限に取得する | 新規 `src/infra/github/imageDownload.ts` | 単体テスト |

### 要求シナリオ（条件付き）

発動条件: 完了契約に「構造化入力」（同じ字面が位置・文脈で対象/非対象になる分類・変換）または「識別子生成」（既存本文・保存済みデータ・同一処理内の生成物と名前空間を共有する識別子・連番）を含む場合のみ書く。該当がなければ「対象外 — 該当する完了契約なし」と1行記載する。

IMG-1 は構造化入力（画像構文がコードフェンス内か否かで対象/非対象が変わる）、IMG-3/IMG-4 は識別子生成（`[Image #N]` / `image-N.png` の採番が既存本文と名前空間を共有する）に該当する。

```gherkin
Scenario: [SCN-IMG-1-P1] PR 本文と通常コメント内の Markdown 画像構文と HTML <img> から画像 URL を抽出する
  Given PR 本文に `![screenshot](https://github.com/user-attachments/assets/abc123)` と通常コメントに `<img src="https://github.com/org/repo/assets/def456" />` が含まれる
  When 画像 URL を抽出する
  Then `https://github.com/user-attachments/assets/abc123` と `https://github.com/org/repo/assets/def456` の両方が検出される

Scenario: [SCN-IMG-1-N1] コードフェンス内の画像構文は抽出しない
  Given PR 本文にコードフェンス ``` で囲まれた `![screenshot](https://github.com/user-attachments/assets/abc123)` が含まれる
  When 画像 URL を抽出する
  Then コードフェンス内の URL は検出されない

Scenario: [SCN-IMG-3-P1] 検出順に [Image #N] プレースホルダと image-N.png ファイル名を採番する
  Given 2つの画像 URL が本文とコメントから検出される
  When 添付画像を生成する
  Then 1つ目は `[Image #1]` / `image-1.png`、2つ目は `[Image #2]` / `image-2.png` となり重複しない

Scenario: [SCN-IMG-3-N1] 本文に既存の [Image #N] プレースホルダがあっても採番が衝突しない
  Given 本文に既に `[Image #1]` という文字列が含まれ、新たに画像 URL が検出される
  When 添付画像を生成する
  Then 新規プレースホルダは既存の `[Image #1]` と衝突しない番号になる
```

### 影響経路（該当する契約のみ）
| 契約ID | 定義・生成 | 変換・保存・復元 | 消費・出力・補助入口 | 状態・所有権 | 現行利用側の移行 | 明示された支援 |
|--------|------------|------------------|---------------------|-------------|------------------|------------------|
| `IMG-1` | `PrReviewData`（`src/infra/git/types.ts:120-130`）→ `fetchPrReviewComments`（`src/infra/github/pr.ts:421-458`） | 画像 URL 抽出（新規 `imageExtraction.ts`） | ダウンロード関数（新規 `imageDownload.ts`） | なし | なし（新規） | なし |
| `IMG-2` | 抽出された URL | Content-Type / magic bytes / サイズ検証、一時ファイル保存 | `StoredImageAttachment[]` → `TaskAttachment[]` | 一時ファイルの所有権（呼び出し元が cleanup） | なし（新規） | なし |
| `IMG-3` | `TaskAttachment[]` | `prepareTaskSpecDirectory`（`src/features/tasks/attachments.ts:266-282`）→ `buildTaskOrderContent` + `promoteTaskAttachments` | `.takt/tasks/<slug>/order.md` + `attachments/` | タスクディレクトリ | なし（既存機構を利用） | なし |
| `IMG-4` | 抽出された URL → プレースホルダ | `replaceImageReferences`（新規 `imageExtraction.ts`） | `formatPrReviewAsTask` の入力 | なし | なし（新規） | なし |
| `IMG-5` | `resolveTaskContent`（`src/features/pipeline/steps.ts:213-248`） | `prepareTaskSpecDirectory` + `resolveTaskSpecForExecution` | `executeTask`（`src/features/tasks/execute/taskExecution.ts:46-49`） | 一時 task spec ディレクトリ | なし（新規） | なし |
| `IMG-6` | 抽出された URL | GitHub attachment URL 判定 | `gh api` / 認証済み `gh` 経由の取得 | なし | なし（新規） | なし |

### 到達経路・起動条件（利用者向け機能の追加/変更がある場合）
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`（add コマンド）、`takt --pr <number>`（pipeline モード） |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts` の `--pr` 経路、`src/features/pipeline/steps.ts`（`resolveTaskContent` / `runWorkflow`）、`src/features/pipeline/execute.ts`（`runWorkflow` 呼び出し） |
| 起動条件 | `--pr` オプションの指定。PR 取得後に画像 URL が検出された場合のみダウンロードが走る |
| 未対応項目 | なし |

## 実装ガイドライン（設計が必要な場合のみ）
- 参照すべき既存実装パターン:
  - 添付画像の保存・`order.md` 追記: `src/features/tasks/attachments.ts:266-282`（`prepareTaskSpecDirectory`）、`src/features/tasks/attachments.ts:35-54`（`buildTaskOrderContent`）
  - 添付画像の受け渡し: `src/features/tasks/add/index.ts:39-51`（`saveTaskFile` の `attachments`）、`src/features/tasks/execute/selectAndExecute.ts:125-136`（`prepareTaskSpecDirectory` + `resolveTaskSpecForExecution`）
  - `gh` CLI 呼び出し: `src/infra/github/pr.ts:424-428`（`execFileSync` パターン）
  - プレースホルダ・ファイル名検証: `src/shared/utils/imageAttachmentReferences.ts:20-39`（`validateImageAttachmentFileName` / `validateStoredImageAttachment`）
- 変更の影響範囲:
  - 新規 `src/infra/git/imageExtraction.ts`、新規 `src/infra/github/imageDownload.ts`
  - `src/features/tasks/add/index.ts` の `--pr` 経路（`downloadPrImages` 呼び出し、`saveTaskFile` へ `attachments` 追加）
  - `src/features/pipeline/steps.ts`（`TaskContent.attachments`、`resolveTaskContent`、`runWorkflow`）
  - `src/features/pipeline/execute.ts`（`runWorkflow` へ attachments を渡す）
- アンチパターン:
  - 外部 URL を無制限に取得しない（GitHub attachment URL に限定）
  - Content-Type / magic bytes / サイズ検証を省略しない
  - 画像参照を生 URL のまま残さない（`[Image #N]` へ置換）
  - 一時ファイル・一時 task spec ディレクトリの cleanup を忘れない
- 利用者向け機能の到達経路: `takt add --pr <number>` と `takt --pr <number>` の両方で画像が添付されること。`add` 経路は `saveTaskFile` の attachments、pipeline 経路は `executeTask` の taskSpec 経由。

## スコープ外（項目がある場合のみ）
| 項目 | 除外理由 |
|------|---------|
| `GitProvider` インターフェースへのダウンロード追加 | GitLabProvider まで波及し、要求（GitHub 固有）に結びつかない |
| 既存 add / pipeline フローのリファクタリング | 要求に結びつかない変更 |
| 画像以外の添付ファイル（動画等） | `order.md` は PNG/JPEG/GIF/WebP に限定 |

## 確認事項（あれば）
- サイズ上限の具体的な値は `order.md` に未指定のため、設計判断として既定案（10MB）を採用する。変更が必要な場合は実装時に定数として分離する。
- ダウンロードの同期/非同期は既存 `pr.ts` の `execFileSync` パターンに合わせて同期を採用する。非同期が必要な場合は実装時に判断する。