まずタスク指示書と、その「参照資料」に指定された内容を最優先で確認します。続いて Knowledge／Policy の正本を末尾まで読み、現行コードとテストの実経路を照合して、変更契約と検証方法を整理します。
タスク指示書には「参照資料」セクションはなく、要件資料は `context/task/order.md` の1件だけでした。実装方針案に挙げられたリポジトリ内コードは要件の正本ではなく、現状確認の証拠として扱います。また、実装計画に関する作業のため `coding` スキルを適用し、指定の設計・アンチパターン規律も確認します。
Knowledge／Policy は正本を末尾まで確認しました。今回適用されるのは、外部入力を境界で検証すること、取得・正規化・保存の責務を分けること、`--pr` の各入口から attachment 消費まで配線を追うこと、既存の非画像契約を維持することです。デザイン参照はないため、デザイン計画ポリシーは非適用です。これから実コード上の生成元・伝播・保存・実行消費を確認します。
## 調査結果

要件の正本は `context/task/order.md` のみです。「参照資料」セクションはなく、Report Directory に過去レポートはありません。作業ツリーにも既存差分はありません。

現状は以下です。

- `src/infra/git/format.ts:197` は PR 本文・通常コメント・レビュー本文を文字列化するだけで、画像記法を処理しない。
- `src/features/tasks/add/index.ts:212` は `takt add --pr` で attachment を渡していない。
- `src/app/cli/routing-inputs.ts:50` と `src/app/cli/routing.ts:118` は `takt --pr` の初期入力へ attachment を渡していない。
- `src/features/pipeline/steps.ts:213` と `src/features/pipeline/steps.ts:334` は pipeline の PR 入力を通常文字列として直接実行している。
- 一方、`src/features/tasks/attachments.ts:35` には attachment 一覧を `order.md` へ追加する処理、同ファイル `:88` には画像を保存する処理が既にある。
- `src/features/tasks/execute/taskSpecContext.ts:28` は保存済みの `attachments/...` を run context の `.takt/runs/.../context/task/attachments/...` へ書き換え、同ファイル `:80` で実ファイルをコピーしている。
- `src/features/interactive/inlineImagePaste.ts:45` には PNG/JPEG/GIF/WebP の magic bytes 判定、`:9` には既存の10 MiB上限がある。

## 完了契約

| ID | 完了条件 | 由来 |
|---|---|---|
| C-01 | PR 本文、通常コメント、review summary、review thread comment にある Markdown画像とHTML `<img>` を検出し、対応する画像参照を `[Image #N]` に置換する | `order.md`「期待する挙動」「対象とする画像記法」 |
| C-02 | HTTPSのGitHub attachment URLだけを認証付きで取得し、PNG/JPEG/GIF/WebPについて Content-Type、magic bytes、サイズ上限を検証する | `order.md`「安全性・制約」 |
| C-03 | `takt add --pr` が画像を `.takt/tasks/<slug>/attachments/image-N.<ext>` に保存し、既存形式の「添付画像」節を `order.md` に追加する | `order.md`「期待する挙動」 |
| C-04 | 対話型 `takt --pr` で画像が初期コンテキスト、直接実行、`save_task` の各経路へ維持される | `order.md`「pipeline の --pr 経路でも同等」と通常 `--pr` の明示要求から直接導出 |
| C-05 | pipeline の `--pr` 実行が attachment 付き task spec を作り、run context の `context/task/attachments` から画像を参照できる | `order.md`「pipeline の --pr 経路でも同等」 |
| C-06 | 非画像のPR本文・コメント、レビュー分類、PR番号・branch/base branch、既存の「レビューコメントなし」判定は変更しない。また一時画像は成功・取消・失敗の全経路で解放する | 変更対象外の既存契約と、新規一時ファイル副作用に不可欠な後片付け |
| C-07 | 新規ロジックの単体テストを追加し、指定された品質ゲートを通す | `order.md`「品質要件」 |

## 設計

PR取得結果を既存の `formatPrReviewAsTask()` で文字列化した直後に、画像準備処理を1回だけ通します。個々の `PrReviewData` フィールドを別々に加工せず、最終的な整形済み文字列を対象にすることで、PR本文・レビュー分類・通常コメントの全経路を同じ規則で処理します。

新規責務は次のように分離します。

- `src/shared/utils/imageFormat.ts`
  - magic bytesから対応MIMEを判定する共通処理。
  - `inlineImagePaste.ts` の既存判定もここへ移し、ダウンロード画像と貼り付け画像で判定規則を共有する。
- `src/infra/github/prImageDownload.ts`
  - GitHub attachment URLのallowlist、`gh auth token` を利用した認証付きHTTPS取得、リダイレクト・タイムアウト・Content-Length／実受信量の上限、Content-Typeとmagic bytesの一致を所有する。
  - URLは `https://github.com/user-attachments/assets/...` と `https://github.com/<owner>/<repo>/assets/...` に限定する。外部画像記法は本文へ残し、取得しない。
- `src/features/tasks/prReviewAttachments.ts`
  - Markdown画像とHTML `<img>` を出現順に抽出する。
  - 同一URLは1回だけ取得し、全出現箇所を同じ placeholder に置換する。
  - 既存の画像attachment storeへ保存し、`taskContent`、`TaskAttachment[]`、一括cleanup関数を返す。
  - 途中失敗時も内部で一時領域を解放し、検証失敗を握りつぶさない。

10 MiB上限は既存のインライン画像契約に合わせます。これは要件上の「サイズ上限」に対する設計判断であり、設定項目の追加は行いません。

契約置換は発生しません。既存のPR文字列契約へ attachment を追加する変更であり、legacy aliasやfallbackも追加しません。

## 実装手順

1. `imageFormat.ts` に対応画像のMIME判定を集約し、`inlineImagePaste.ts` を同じ判定へ移行する。
2. GitHub画像ダウンロード境界を追加する。
   - URLを構文解析してallowlistを検証。
   - 認証トークンをログや例外へ出さずにHTTPヘッダーへ設定。
   - ヘッダー上限とストリーム実測上限の両方を検証。
   - Content-Typeとmagic bytesが一致しなければ即時失敗。
3. PR task準備モジュールを追加する。
   - `formatPrReviewAsTask()` の出力からMarkdown／HTML画像を抽出。
   - 画像を順次ダウンロードして `image-1.png` 等へ保存。
   - 本文を `[Image #N]` へ置換し、cleanup所有権を返す。
4. `src/features/tasks/add/index.ts` を変更する。
   - PRレビュー取得と既存の「コメントなし」確認後に画像を準備。
   - `saveTaskFile(..., { attachments })` へ配線。
   - workflow選択取消、保存失敗、成功を覆う単一の `try/finally` で一時画像を解放。
5. `src/app/cli/routing-inputs.ts` と `src/app/cli/routing.ts` を変更する。
   - `resolvePrInput()` が加工済み本文、attachment、cleanupを返す。
   - `InteractiveSeedInput.attachments` へ初期画像を渡す。
   - 既存の `result.attachments` 配線により `execute`／`save_task` へ伝播させる。
   - workflow選択取消や対話モード取消を含む全体を単一のリソース所有境界で解放する。各return直前へcleanupを散在させない。
6. `src/features/pipeline/steps.ts` と `src/features/pipeline/execute.ts` を変更する。
   - `resolveTaskContent()` を非同期化し、attachmentとcleanupを返す。
   - PR attachmentがある場合は `prepareTaskSpecDirectory()`、`resolveTaskSpecForExecution()`、`reportDirName` を使って `executeTask()` へ渡す。
   - workflowの成否にかかわらず、transientな `.takt/tasks/<slug>` とダウンロード元一時領域をそれぞれ所有者側で解放する。
   - 通常のissue／直接task pipelineは従来どおり文字列を直接実行する。

## テスト計画

- `src/__tests__/prReviewAttachments.test.ts`
  - PR本文、通常コメント、review summary、各thread分類に含まれるMarkdown／HTML画像。
  - 出現順のplaceholder、同一URLの重複排除、外部URLの非取得。
  - 途中失敗時のcleanup。
- `src/__tests__/github-pr-image-download.test.ts`
  - 4形式のContent-Typeとmagic bytes一致。
  - MIME不一致、未知magic、Content-Length超過、ストリーム超過、HTTP失敗。
  - GitHub以外、HTTP、認証情報付きURLの拒否。
  - `gh auth token` の利用と、トークン非露出。
- `src/__tests__/addTask.test.ts`
  - `takt add --pr` が `.takt/tasks/.../attachments/image-1.png` と「添付画像」節を保存すること。
- `src/__tests__/cli-routing-pr-resolve.test.ts`
  - 初期attachmentが対話モードへ渡り、execute／save_taskへ維持されること。
  - 取消・例外時もcleanupされること。
- pipeline向け軽量IT
  - attachment付きPRがtask specを経由し、`executeTask` 呼び出し時に `order.md` と画像が存在すること。
  - 終了後にtransient task specが削除されること。
- 既存の `git-format.test.ts` で非画像PRの整形結果が維持されることを確認する。

実装後は対象テストに加え、IT分類変更の確認として `npm test -- src/__tests__/releaseVerificationWiring.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、CLI変更に対して `npm run test:e2e:mock` を実行します。