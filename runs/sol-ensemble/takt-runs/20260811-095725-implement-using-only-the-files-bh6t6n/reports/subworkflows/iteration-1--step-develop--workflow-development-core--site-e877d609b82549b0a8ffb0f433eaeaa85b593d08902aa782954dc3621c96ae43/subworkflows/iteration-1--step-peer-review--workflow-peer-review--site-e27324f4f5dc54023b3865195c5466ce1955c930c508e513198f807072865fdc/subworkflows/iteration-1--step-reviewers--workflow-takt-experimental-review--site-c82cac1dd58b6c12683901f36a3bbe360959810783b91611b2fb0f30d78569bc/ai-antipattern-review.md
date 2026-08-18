# AI生成コードレビュー

## 結果: REJECT

## サマリー

初回指摘2件は解消済みだが、Markdown literal判定に入力サイズの二乗時間を要する過剰実装を新たに確認した。

## 検証した項目

| 観点 | 結果 | 備考 |
|------|------|------|
| 仮定の妥当性 | ❌ | 「行ごとの本文prefix再走査でも実用上問題ない」という暗黙の仮定が実測結果と不一致 |
| API/ライブラリの実在 | ✅ | `URL.canParse`、Fetch API、ReadableStream、`gh auth token --hostname`、既存attachment APIを確認 |
| コンテキスト適合 | ❌ | 画像がないPRにも二乗時間のMarkdown解析を課し、add・対話CLI・pipelineの全PR入口へ影響する |
| スコープ | ❌ | literal除外の修正が約500行の独自Markdown解析へ膨張し、要求達成に不要なprefix再解析を導入している |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 実private repositoryとの認証通信 | `src/infra/github/prImageDownload.ts:120` | no_issue_after_verification | 実GitHub通信は未確認だが、URL拒否、`github.com`用token選択、Authorization伝播、MIME・サイズ・token非露出を決定的テストで確認し、現在コードから別の欠陥は確定できない |
| WebP署名判定の追加強化 | `src/shared/utils/imageMimeType.ts:26` | overreach | 裁定された受入条件はPNGの正式8バイト署名であり、WebPの追加バイト検証は元要求・裁定の修正境界に含まれない |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `markdown-literal-scan-complexity` | PR本文を入力サイズに対して線形に走査し、画像がない本文へ不要な反復解析を課さない | `src/features/tasks/prReviewAttachments.ts:152-178,193-215,435-482` | `preparePrReviewAttachments`からadd、対話CLI、pipelineの3入口へ到達 | 画像0件の正常経路でも全文literal解析を実行。入力倍増ごとに約4倍の処理時間を確認 | 既存28件は構文結果を検証するが計算量の退行を検出しない | なし | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` |
| `pr-image-entrypoint-parity` | PR本文・review・commentのいずれかがあれば画像準備へ到達し、すべて空なら拒否する | `src/features/tasks/add/index.ts:194-205` | task保存、attachment参照、production dataflowを確認 | 本文画像のみ、本文テキストのみ、全入力空を確認 | `addTask.test.ts`、`pr-image-dataflow.integration.test.ts` | なし | 問題なし |
| `image-magic-validation` | PNGは正式な8バイト署名だけを受理する | `src/shared/utils/imageMimeType.ts:16-29` | PR downloaderとinline pasteの両consumerを確認 | 4バイトprefix、途中不一致、MIME不一致を拒否 | `github-pr-image-download.test.ts`、`inlineImagePaste.test.ts`、関連fixture | なし | 問題なし |
| `github-download-boundary` | 許可URL・認証ホスト・MIME・サイズ・cleanupを同じ境界で維持する | `src/infra/github/attachmentUrl.ts`、`src/infra/github/prImageDownload.ts` | PR attachment storeまでの経路を確認 | HTTP失敗、上限超過、cancel失敗、token非露出を確認 | downloader対象テスト | 実GitHub通信 | 問題なし |
| `pr-image-lifecycle-dataflow` | 一時画像とtask specを所有者終了時に解放し、保存・stagingまで参照を維持する | shared store、add、routing、pipeline | task保存、interactive実行・保存、run context staging | 保存失敗、実行例外、workflow false、cleanup失敗を確認 | add、routing、pipeline、production dataflow IT | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | `markdown-literal-scan-complexity` | 過剰エンジニアリング・非線形処理 | `src/features/tasks/prReviewAttachments.ts:158,193-215,435-445` | `findLiteralRanges()`は各行でindented/fenced code判定を行い、各判定から`findInheritedListIndent()`が`content.slice(0, start).split('\n').reverse()`で先頭から現在行までを再構築する。画像0件の通常本文で22KB/72ms、44KB/279ms、88KB/1,079ms、176KB/4,256msとなり、入力倍増ごとに約4倍化した。全PR入口がこの同期処理を待つため、大きなPR本文・コメントでCLIを長時間停止させる | 本文を一方向に走査し、blockquote・list・paragraph状態を前行から引き継ぐ構造へ変更する。少なくとも行ごとのprefix再分割を除去し、既存Markdown意味論テストを維持したうえで、大きな画像なし本文に対する非線形退行を検出する決定的テストを追加する |

## 継続指摘（persists）

| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| - | なし | - | - | - | - | - |

## 解消済み（resolved）

| finding_id | 解消根拠 |
|------------|----------|
| `AI-NEW-TASKS-PR-BODY-194` | `src/features/tasks/add/index.ts:194-205`でPR本文を入力判定へ含め、本文画像のみ・本文テキストのみ・全入力空のテストおよびproduction dataflow ITが成功 |
| `AI-NEW-IMAGE-MAGIC-16` | `src/shared/utils/imageMimeType.ts:17`でPNGの8バイト署名を完全比較し、PR downloader・inline paste双方で短縮署名と途中不一致を拒否するテストが成功 |

## 再開指摘（reopened）

| # | finding_id | family_tag | 解消根拠（前回） | 再発根拠 | 問題 | 修正案 |
|---|------------|------------|----------------|---------|------|--------|
| - | なし | - | - | - | - | - |

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| AI Antipattern「スコープクリープ・過剰エンジニアリング」 | `src/features/tasks/prReviewAttachments.ts:21-499` |
| 呼び出しチェーン検証・契約影響経路 | `src/features/tasks/add/index.ts:203-205`、`src/app/cli/routing-inputs.ts:73-76`、`src/features/pipeline/steps.ts:232-247` |
| 解消判定・欠陥クラス再走査 | `src/features/tasks/add/index.ts:194-205`、`src/shared/utils/imageMimeType.ts:16-29` |
| 振る舞い証跡 | 対象14ファイル・415テスト成功、型契約検査成功 |
| 非線形処理の再現 | 画像0件の2,000/4,000/8,000/16,000行で72/279/1,079/4,256msを観測 |
| 差分整合 | `git diff --check`成功 |

## REJECT判定条件

- `AI-NEW-MARKDOWN-LITERAL-SCAN-158`が`new`として1件存在するためREJECT。