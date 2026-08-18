# テストレビュー

## 結果: REJECT

## サマリー

対象テストは通過していますが、PR画像の出現順、実ダウンロード内容、一時リソースの終端解放を検出できない具体的な経路があります。既存の成功結果だけではこれらの受入条件を保証できません。

## 確認した観点

| 観点 | 結果 | 備考 |
|------|------|------|
| テストカバレッジ | ❌ | 順序、実ファイル内容、cleanup失敗経路が不足 |
| テスト構造（Given-When-Then） | ✅ | 主要テストはArrange-Act-Assert相当 |
| テスト命名 | ✅ | 振る舞いを概ね表現 |
| テスト独立性・再現性 | ❌ | pipeline cleanupがテスト側のディレクトリ削除で隠れる |
| モック・フィクスチャ | ❌ | downloaderの実ファイル結果を検証していない |
| テスト戦略（ユニット/統合/E2E） | ⚠️ | unitと統合の選択は妥当だが失敗経路が不足 |
| 契約入力位置（body/query/path） | ✅ | 宣言されたPR本文・コメント本文の入力位置を確認 |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| PRIMG-01 | `src/infra/github/pr-images.ts` のPR本文画像parser | 画像参照の順序とplaceholder対応が保持される | PR本文・コメント・reviewを同一parserで処理するため | 同一本文内のHTML→Markdown混在 | parserの抽出・置換 | add、interactive、pipeline | 混在順序未検証 | `github-pr-images.test.ts` | 同一本文内の異種記法順序 | finding 1 |
| PRIMG-02 | `downloadGitHubPrImages()` | 検証済みresponse bodyが実ファイルとして保存される | GitHub画像取得を共通downloaderへ集約したため | `gh api` responseからtemp fileまで | MIME・magic・sizeの検証 | add／pipelineのattachment source | 実ファイル内容と途中失敗cleanup未検証 | `github-pr.test.ts` のgh mock | 実GitHub連携 | finding 2 |
| PRIMG-06 | PR画像temp file／directoryのcleanup所有者 | 成功・失敗・キャンセル・exit時に一時資源が残らない | add、interactive、pipelineが同じPR attachmentを所有するため | pipeline、interactive PR seed、`process.exit()` | cleanup呼び出し | task保存・task spec・workflow実行 | 親directory、pipeline失敗、実exit経路未検証 | addのcancel test、pipeline success test | 強制終了相当の実経路 | finding 3 |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|---|---|---|---|---|---|---|---|
| 1 | TEST-NEW-PRIMG-01-order | PRIMG-01 | カバレッジ | `src/infra/github/pr-images.ts:190-195`、`src/__tests__/github-pr-images.test.ts:28-56` | parserはMarkdown抽出結果とHTML抽出結果を別々に連結するため、同一本文内の出現順を壊す。既存テストは各本文に1種類の記法しかなく、この経路を検出できない。 | 該当なし | 初回レビュー | 同一本文にHTML→Markdown、Markdown→HTMLを置き、placeholder・attachment順を検証する。抽出実装も単一の出現順で処理する。 |
| 2 | TEST-NEW-PRIMG-02-download-content | PRIMG-02 | カバレッジ | `src/__tests__/github-pr.test.ts:772-815` | テストはplaceholder、filename、`gh`呼び出しだけを確認し、返却されたtemp fileの実内容を読んでいない。add／pipelineテストもdownloaderではなく手作成のattachmentを使うため、誤った内容や未作成ファイルを検出できない。途中の2件目失敗時の部分cleanupも未検証。 | 該当なし | 初回レビュー | downloader経由で返った各temp fileのbytesを検証し、途中のresponse失敗時に全作成物が消えることを確認する。 |
| 3 | TEST-NEW-PRIMG-06-cleanup | PRIMG-06 | カバレッジ／状態遷移 | `src/infra/github/pr-images.ts:283-306,311-323`、`src/features/pipeline/execute.ts:1320-1368`、`src/app/cli/routing.ts:121-148,317-347` | cleanupは画像ファイルだけを削除し、downloaderが作成した親temp directoryを検証していない。pipelineテストは最後にproject directory全体を削除するためcleanup漏れを隠す。さらに、実際の`process.exit()`は`finally`を実行しないが、該当テストはattachmentなし、またはexitをthrowへ置換している。 | 該当なし | 初回レビュー | 親directoryの不存在までassertし、pipelineのworkflow失敗・準備失敗、interactive PR cancel、head branch欠落によるexitでtemp資源が残らないことを、実際の所有経路で検証する。 |

## 継続指摘（persists）

なし。指定Report Directory内に、前回actionableとして裁定されたfindingの記録はありません。

## 解消済み（resolved）

なし。

## 裁定済みの対象外指摘

なし。

## 再開指摘（reopened）

なし。

## 検証証跡

- ビルド: 実装レポート上、`npm run build` は成功。
- Lint: 実装レポート上、`npm run lint` は成功。
- テスト: 対象6ファイル170件、unit・integrationとも成功。成功結果では上記個別経路を閉じられない。
- 動作確認: 同一本文内の記法順序、temp directory残存、実downloaderのbytes検証は未充足。

## 未確認範囲

| 項目 | 理由 | 判定への影響 |
|---|---|---|
| GitHub実API・認証付き実連携 | テストは`gh`呼び出しをmock | REJECT理由ではない |
| downloaderの途中失敗後cleanup | 該当テストがない | REJECT理由 |
| pipeline／interactiveのPR attachment cleanup全終端 | 成功・転送中心で、失敗・実exitの観測がない | REJECT理由 |