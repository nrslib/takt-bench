# テストレビュー

## 結果: REJECT

## サマリー

対象テストは成功しており、既存の主要経路も概ね検証されています。ただし、PR画像付きパイプラインの失敗時cleanupと、画像構文の逆順混在ケースが未検証です。

## 確認した観点

| 観点 | 結果 | 備考 |
|------|------|------|
| テストカバレッジ | ❌ | 失敗時cleanupとMarkdown→HTML順序が未検証 |
| テスト構造（Given-When-Then） | ✅ | Arrange-Act-Assertが概ね明確 |
| テスト命名 | ✅ | 振る舞いを識別可能 |
| テスト独立性・再現性 | ✅ | 一時ディレクトリ・モックを各テストで管理 |
| モック・フィクスチャ | ✅ | 直接依存を中心にモックし、ファイルI/Oは実体で確認 |
| テスト戦略 | ✅ | ユニット、軽量IT、heavy ITを使い分け |
| 契約入力位置（body/query/path） | ✅ | PR body、コメント、review bodyを確認。未検証の宣言済みquery/path契約は確認されず |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| `F-PRIMG-REFERENCE-ORDER` | `src/infra/github/pr-images.ts` | 画像番号と置換順が本文の出現順と一致 | 同一抽出・置換処理の変更 | Markdown→HTMLの逆順入力 | `github-pr-images.test.ts` | `github-pr.test.ts`でbody/commentへ再注入 | HTML→Markdownのみ確認 | 本文fixture、抽出結果assert | Markdown→HTML | `TEST-FOLLOWUP-PRIMG-01-order` |
| `F-PRIMG-TEMP-LIFECYCLE` | `createGitHubPrImageResource` と `pipeline/execute.ts` | 成功・失敗・終了時に一時リソースを解放 | 同じresourceの所有・終端処理を変更 | PR画像付きpipeline workflow失敗 | `pr-images.ts`、`pipelineExecution.test.ts` | task specへの画像コピーとcleanup | 成功、routing失敗、process exitは確認 | cleanup spy、実一時ファイル | pipeline workflow失敗 | `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` |
| `F-PRIMG-DOWNLOAD-API` | `src/infra/github/pr-images.ts` | 画像形式・サイズ・Content-Typeを検証 | downloaderとvalidatorを同時変更 | なし | `github-pr-images.test.ts` | `github-pr.test.ts` | download内容の追加要求は裁定済みoverreach | fetch stub | なし | 問題なし |
| `F-PRIMG-REFERENCE-ALLOCATION` | `src/features/interactive/imageAttachments.ts` | 既存番号とファイル番号を避けて採番 | 採番と保存処理を変更 | なし | `imageAttachments.test.ts` | `addTask.test.ts`、pipeline tests | 既存placeholderを含む保存を確認 | 実ファイルfixture | なし | 問題なし |
| `F-PRIMG-FETCH-BOUNDARY` | `classifyGitHubAttachmentUrl` | 自リポジトリ・許可済み添付だけを対象 | URL分類と取得対象を変更 | なし | `github-pr-images.test.ts` | `github-pr.test.ts` | 他リポジトリ・外部URLを確認 | URL fixture | なし | 問題なし |
| `F-PRIMG-FETCH-SCOPE` | `fetchGitHubImage` | 認証情報を必要な取得先だけへ渡す | fetch対象と認証付与を変更 | なし | `github-pr.test.ts` | prepare経路 | private asset/user attachmentの分岐を確認 | fetch spy、token stub | なし | 問題なし |
| `F-PRIMG-TEST-WIRING` | `scripts/test-classification.mjs` | 変更テストが適切なrunnerで実行される | テスト分類とrelease wiringを変更 | なし | classification/release wiring tests | 各対象テスト | unit/light IT/heavy IT分類を確認 | runner mock | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|---|---|---|---|---|---|---|---|
| 1 | `TEST-FOLLOWUP-PRIMG-01-order` | `F-PRIMG-REFERENCE-ORDER` | カバレッジ | [github-pr-images.test.ts:70](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/github-pr-images.test.ts:70) | HTML→Markdown順のみで、Markdown→HTML順を確認していない。HTMLを常に先に連結する退行を検出できない | `direct_acceptance_criterion_violation` | 初回レビューの混在構文指摘はHTML→Markdownの追加で解消されたが、逆順入力が追加されなかった | 両方向の入力で抽出順、画像番号、置換後placeholder順を確認する |
| 2 | `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` | `F-PRIMG-TEMP-LIFECYCLE` | カバレッジ | [execute.ts:76](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/features/pipeline/execute.ts:76) | PR画像準備後にworkflowが`false`を返す、または例外になる経路でcleanupを確認していない。成功テストだけではcleanup退行を検出できない | `accepted_family_unvisited_consumer` | 初回レビュー後に成功、routing失敗、process exitの経路は追加されたが、pipeline workflow失敗経路は未追加 | PR画像付きpipelineでworkflow失敗を発生させ、終了結果、cleanup、一時task spec削除を確認する |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

| finding_id | 解消根拠 |
|---|---|
| `TEST-NEW-PRIMG-01-order` | 混在構文のHTML→Markdown順をテストに追加 |
| `TEST-NEW-PRIMG-06-cleanup` | 成功、routing初期化失敗、process exit時のcleanupを確認 |

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|---|---|---|---|
| `TEST-NEW-PRIMG-02-download-content` | `overreach` | — | `review-resolution.md`で、レスポンス本文のバイト内容や部分ダウンロード cleanupの追加要求は、実装欠陥または受入条件違反の根拠がないと裁定 |

## 再開指摘（reopened）

なし。

## 検証証跡

- ビルド: `fix-verification.md` に成功記録あり。
- Lint: `fix-verification.md` に成功記録あり。
- テスト: 対象テストおよびrelease wiring testは成功。
- 動作確認: PR画像の抽出、取得、保存、pipeline成功、routing失敗、process exitを確認。

## 未確認範囲

| 項目 | 理由 | 判定への影響 |
|---|---|---|
| PR画像付きpipelineのworkflow失敗時cleanup | 該当するテストが存在しない | REJECT理由 |
| Markdown→HTML順の画像抽出 | HTML→Markdown順のみ実装テスト済み | REJECT理由 |
| 実GitHubサービスとの外部連携 | テストはmock中心 | 今回の新規REJECT理由には算入しない |