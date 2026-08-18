# テストレビュー

## 結果: REJECT

## サマリー

主要ロジックの単体テストは明確で再現可能ですが、PR画像の実production経路を通す結合テストと、後続処理が例外終了した場合のcleanupテストが不足しています。

## 確認した観点

| 観点 | 結果 | 備考 |
|------|------|------|
| テストカバレッジ | ❌ | 結合経路と例外時cleanupが未検証 |
| テスト構造（Given-When-Then） | ✅ | Arrange-Act-Assertが概ね明確 |
| テスト命名 | ✅ | 条件と期待動作を読み取れる |
| テスト独立性・再現性 | ✅ | mock・一時ディレクトリ・global復元が適切 |
| モック・フィクスチャ | ❌ | pipelineの内部production境界を過剰にモック |
| テスト戦略（ユニット/統合/E2E） | ❌ | 3モジュール以上を横断する新規データフローに結合テストがない |
| 契約入力位置（body/query/path） | ✅ | GitHub attachment URLのpath許可・拒否を検証。body/queryは非適用 |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `pr-image-dataflow` | PR画像が抽出・検証・保存され、task spec経由でrun contextから参照できる | `prReviewAttachments.test.ts`、`github-pr-image-download.test.ts` | `addTask.test.ts`、`cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts`、既存`taskSpecContext.test.ts` | pipeline成功・workflow失敗を確認 | addでは画像準備をモック。pipelineでは画像準備、task spec生成、resolverをすべてモック | PR取得後から実store・task spec stagingまでの単一結合経路 | `TEST-NEW-pr-image-dataflow-L29` |
| `pr-image-cleanup` | 一時画像とtransient task specを成功・取消・例外の全所有終了時に1回解放する | `prReviewAttachments.test.ts` | add、対話routing、pipelineの各cleanup所有者 | 部分取得失敗、選択取消、pipelineのfalse終了を確認 | cleanup callbackの呼出回数をmockで観測 | add保存例外、PR routingの実行・保存例外 | `TEST-NEW-pr-image-cleanup-L301` |
| `pr-image-validation` | GitHub attachment URLのみ取得し、PNG/JPEG/GIF/WebPのContent-Type・magic bytes・サイズを検証する | `github-pr-image-download.test.ts` | `preparePrReviewAttachments`へ検証済みbytesを渡す | HTTP失敗、サイズ超過、cancel失敗を確認 | `gh auth token`と`fetch`のみを外部境界としてモック | 実private GitHub通信 | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | `TEST-NEW-pr-image-dataflow-L29` | `pr-image-dataflow` | テスト戦略・カバレッジ | `src/__tests__/pipelineExecution.test.ts:29`、`src/__tests__/addTask.test.ts:315` | pipelineテストは画像準備、task spec生成、run context resolverをすべてモックし、addテストも準備済み`TaskAttachment`を直接返している。個別テストが成功しても、実際の抽出・store・永続化・staging間の配線を保証できない | 外部GitHub取得とagent境界だけをモックし、実際の`preparePrReviewAttachments`、attachment store、task保存／task spec stagingを通して画像ファイルと書き換え済み`order.md`を観測する分類済みITを追加する |
| 2 | `TEST-NEW-pr-image-cleanup-L301` | `pr-image-cleanup` | 副作用・失敗経路 | `src/__tests__/addTask.test.ts:301`、`src/__tests__/cli-routing-pr-resolve.test.ts:370` | PR画像所有者のcleanupは保存・実行成功とworkflow選択取消だけが検証されている。既存の一般的な実行例外テストにはPR入力がなく、`cleanupSourceAttachments`は検証されない | PR画像準備後に`saveTaskFile()`、`selectAndExecuteTask()`または`saveTaskFromInteractive()`を例外終了させ、cleanupが1回実行され、元の例外と永続状態が適切に保たれることを確認する |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

なし。

## 再開指摘（reopened）

なし。

## 検証証跡

- ビルド: 独立実行なし。対象テスト実行時のtype-contractsはすべて成功
- テスト: 変更対象・関連テスト153件成功、分類契約19件成功、合計172件成功
- 動作確認: URL許可・拒否、4画像形式、MIME/magic不一致、サイズ超過、重複URL、画像保存、interactive伝播、pipeline task spec引数、既存run context stagingを確認

## 未確認範囲

| 項目 | 理由 | 判定への影響 |
|------|------|--------------|
| 実private GitHub repositoryからの取得 | 資格情報と外部サービスが必要。単体テストでは外部境界をモック | 単独ではAPPROVE可 |
| PR取得からrun contextまでの単一結合経路 | 内部productionモジュールが個別にモックされている | `TEST-NEW-pr-image-dataflow-L29`のREJECT理由 |
| add保存例外・PR routing実行例外後のcleanup | 該当テストが存在しない | `TEST-NEW-pr-image-cleanup-L301`のREJECT理由 |
| 全E2E・全テストスイート | レビュアーの対象実行範囲外 | 最終ゲートで確認 |