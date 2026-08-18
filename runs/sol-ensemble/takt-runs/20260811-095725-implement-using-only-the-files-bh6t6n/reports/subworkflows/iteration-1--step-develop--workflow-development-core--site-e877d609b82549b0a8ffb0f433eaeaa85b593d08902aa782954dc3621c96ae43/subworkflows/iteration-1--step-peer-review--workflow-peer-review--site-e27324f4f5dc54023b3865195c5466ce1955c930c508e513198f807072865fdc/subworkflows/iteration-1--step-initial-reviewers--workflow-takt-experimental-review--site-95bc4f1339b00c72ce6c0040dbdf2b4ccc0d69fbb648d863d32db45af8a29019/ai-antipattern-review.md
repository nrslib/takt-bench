# AI生成コードレビュー

## 結果: REJECT

## サマリー

`add --pr` のPR本文画像が到達不能になる配線漏れと、不完全な画像signatureを正常扱いする見かけ上のmagic bytes検証を確認した。

## 検証した項目

| 観点 | 結果 | 備考 |
|------|------|------|
| 仮定の妥当性 | ❌ | 「レビューコメントがなければ処理不要」「既存の部分signature判定で十分」という仮定が要件と不一致 |
| API/ライブラリの実在 | ✅ | `URL.canParse`、Fetch API、ReadableStream、既存task attachment APIの実在と利用経路を確認 |
| コンテキスト適合 | ❌ | 対話CLI・pipelineと`add --pr`でPR本文の扱いが不一致。テストも旧挙動を固定 |
| スコープ | ❌ | 明示されたPR本文対応とmagic bytes検証が未達 |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 実private repositoryとの認証通信 | `src/infra/github/prImageDownload.ts:117` | no_issue_after_verification | 実資格情報を使う通信は未確認だが、URL制限、認証ヘッダー、エラー時のtoken非露出は決定的テストで確認され、現在コードから別の欠陥は確定できない |
| attachment一時領域のcleanup | `src/features/tasks/prReviewAttachments.ts:38` | no_issue_after_verification | add、対話CLI、pipelineの成功・取消・失敗経路と所有者callbackを走査し、今回の契約に関する解放漏れは確認されなかった |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `pr-image-entrypoint-parity` | PR本文・通常コメント・review summary・threadを全PR入口で同じ画像抽出処理へ到達させる | `src/infra/git/format.ts:197`、`src/features/tasks/prReviewAttachments.ts:38` | add、`resolvePrInput`、pipelineの3入口を確認 | addだけがコメントなしで準備前に終了。対話CLI・pipelineは同状態でも継続 | `addTask.test.ts:345`が旧挙動を固定し、他2入口のテストはコメントなし成功を期待 | なし | `AI-NEW-TASKS-PR-BODY-194` |
| `image-magic-validation` | Content-Typeと各形式の完全な識別signatureが一致した画像だけを受理する | `src/shared/utils/imageMimeType.ts:16`、`src/infra/github/prImageDownload.ts:100` | PRダウンロードとinline pasteの全参照を確認 | MIME不一致、未知形式、サイズ超過は拒否するが、PNG/WebPの切り詰めたsignatureを受理 | `github-pr-image-download.test.ts:14`を含む複数fixtureが4バイトの疑似PNGを使用。WebPも12バイトの疑似値を正常扱い | なし | `AI-NEW-IMAGE-MAGIC-16` |
| `attachment-lifecycle` | 一時画像とpipeline一時task specを全終了経路で解放する | shared store、PR準備処理、task spec準備処理 | add保存、interactive実行・保存、pipeline run contextを確認 | 取消、後続取得失敗、workflow失敗、cleanup失敗時の元エラー維持を確認 | add、routing、pipeline、PR準備テストを確認 | 実OS障害による削除失敗 | 問題なし |
| `github-download-boundary` | GitHub attachment URLだけを認証付きで取得し、サイズとMIMEを検証する | URL判定、token取得、fetch、Content-Length、stream readerを確認 | attachment storeまでの経路を確認 | HTTP失敗、上限超過、cancel失敗、token非露出を確認 | 新規ダウンロードテスト17ケースを確認 | 実GitHub通信 | magic判定以外は問題なし |
| `shared-store-refactor` | interactive固有実装を共有所有者へ移し、旧利用側を維持する | shared store定義とinteractive再exportを確認 | conversation、quiet、passthrough、exec、PR準備の参照を検索 | cleanup所有権を確認 | 既存image attachmentテストを確認 | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | `AI-NEW-TASKS-PR-BODY-194` | `pr-image-entrypoint-parity` | 配線忘れ・旧契約残存 | `src/features/tasks/add/index.ts:194`、`src/__tests__/addTask.test.ts:345` | `reviews`と`comments`が空だと、PR本文を`formatPrReviewAsTask`や`preparePrReviewAttachments`へ渡す前に終了する。したがって、本文だけに画像がある`add --pr`は要求されたattachmentを生成できない。対話CLIとpipelineは同じ状態でも処理を継続しており、入口間でも不整合 | コメント有無だけを根拠にした早期終了を除去し、`reviews: []`、`comments: []`、本文にGitHub画像があるケースで画像保存と`order.md`参照を検証する |
| 2 | `AI-NEW-IMAGE-MAGIC-16` | `image-magic-validation` | 見かけ上の検証・テストダブル不一致 | `src/shared/utils/imageMimeType.ts:16`、`src/__tests__/github-pr-image-download.test.ts:14` | PNGを先頭4バイトだけ、WebPを`RIFF....WEBP`の12バイトだけで受理する。直接実行でも不正な8バイト列をPNG、`RIFF0000WEBP`をWebPと判定した。テスト自身も切り詰めた疑似画像を正常fixtureにしており、明示要件のmagic bytes検証を証明していない。PNG signatureは8バイト、WebP識別パターンは`RIFF`＋4バイト＋`WEBPVP`まで必要 | PNGの8バイトsignatureとWebPの14バイトパターンを照合する。完全なsignatureの正常テストに加え、現在受理される4バイトPNG・12バイトWebPを拒否するテストを追加し、inline画像を含む既存fixtureも正しいsignatureへ更新する |

## 継続指摘（persists）

| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| - | なし | - | - | - | - | - |

## 解消済み（resolved）

| finding_id | 解消根拠 |
|------------|----------|
| なし | 本レビューは初回実行 |

## 再開指摘（reopened）

| # | finding_id | family_tag | 解消根拠（前回） | 再発根拠 | 問題 | 修正案 |
|---|------------|------------|----------------|---------|------|--------|
| - | なし | - | - | - | - | - |

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 初回レビューのため再走査欄は非適用。指定17ファイル、base `7d623634f205`からの累積差分、変更契約の全参照を確認 | `src/features/tasks/add/index.ts:194`、`src/shared/utils/imageMimeType.ts:16` |

## REJECT判定条件

- `new`が2件存在するためREJECT。