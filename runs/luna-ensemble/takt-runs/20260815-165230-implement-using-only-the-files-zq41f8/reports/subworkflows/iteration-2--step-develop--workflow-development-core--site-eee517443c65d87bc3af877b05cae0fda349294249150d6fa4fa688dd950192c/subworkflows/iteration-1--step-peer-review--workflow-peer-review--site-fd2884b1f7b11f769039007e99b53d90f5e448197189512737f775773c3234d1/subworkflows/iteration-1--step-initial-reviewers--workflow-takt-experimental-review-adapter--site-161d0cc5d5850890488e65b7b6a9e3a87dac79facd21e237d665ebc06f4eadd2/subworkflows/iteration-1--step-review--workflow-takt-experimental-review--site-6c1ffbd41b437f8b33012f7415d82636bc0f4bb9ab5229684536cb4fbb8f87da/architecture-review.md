# アーキテクチャレビュー

## 結果: REJECT

## サマリー

PR画像の主経路は接続されていますが、metadata取得APIへの副作用混入、一時ディレクトリのcleanup漏れ、`process.exit()`によるcleanup迂回、画像番号順序の破綻を確認しました。4件すべて今回のスコープ内です。

## 確認した観点

- [x] 構造・設計
- [x] コード品質
- [x] 変更スコープ
- [x] テストカバレッジ
- [x] デッドコード
- [x] 呼び出しチェーン検証

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| `github-pr-image-task-preparation` | PR task準備境界。現行実装では`fetchPrReviewComments()`がmetadata取得と画像準備を兼務 | PR画像だけがtask attachmentへ変換され、system metadata経路へ副作用を漏らさない | PR画像処理をPR task利用側へ限定する必要がある | PR取得 → 抽出 → download → placeholder置換 → add／interactive／pipeline | `src/infra/github/pr.ts:452-482`、`src/infra/github/pr-images.ts:184-252` | `addTask`、routing、pipelineのtask spec・workflow実行 | system `pr_context`、enqueue、syncにも同じprovider APIが到達 | `github-pr.test.ts`、`cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts` | 実GitHub認証通信は未確認 | `ARCH-PRIMG-002` |
| `github-pr-image-temp-lifecycle` | `downloadGitHubPrImages()`／`cleanupGitHubPrAttachments()` | 成功・失敗・キャンセル・明示終了の全経路で一時ファイルと親ディレクトリを削除する | 一時ディレクトリの所有情報がattachmentへ移譲されず、cleanupがファイル単位に限定されている | download → add／routing／pipeline cleanup、`process.exit()`経路 | `pr-images.ts:283-323` | task保存・transient spec・run contextへのコピー後にcleanup | downloader failureは削除するが、成功後の親ディレクトリと`process.exit()`経路が残る | `github-pr.test.ts`、`addTask.test.ts`、`cli-routing-pr-resolve.test.ts` | `SIGKILL`後のcleanupは対象外 | `ARCH-PRIMG-001`, `ARCH-PRIMG-003` |
| `github-pr-image-reference-order` | `extractGitHubPrImageReferences()` | placeholder、filename、本文内参照が出現順に対応する | MarkdownとHTMLを別々に全件抽出している | raw body → parser → placeholder → replacement → order.md | `pr-images.ts:184-205`、`210-252` | `formatPrReviewAsTask()`、`buildTaskOrderContent()` | 同一URLのdedupeは確認済み。混在記法の順序が破綻 | `github-pr-images.test.ts` | なし | `ARCH-PRIMG-004` |

## 今回の指摘（new）

| # | finding_id | family_tag | スコープ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|---|---|---|---|---|---|---|---|
| 1 | `ARCH-PRIMG-001` | `github-pr-image-temp-lifecycle` | スコープ内 | `src/infra/github/pr-images.ts:283-323` | `downloadGitHubPrImages()`が作成した親ディレクトリを`cleanupGitHubPrAttachments()`が削除しない。対象テストは44件成功したが、cleanup後も空の`takt-github-pr-*`ディレクトリが残った | 該当なし | 初回レビュー | cleanup ownerが一時ディレクトリまで所有し、ファイルとディレクトリを一体で削除する |
| 2 | `ARCH-PRIMG-002` | `github-pr-image-task-preparation` | スコープ内 | `src/infra/github/pr.ts:464-481` | metadata用の`fetchPrReviewComments()`が画像downloadと本文置換を常時実行する。system `pr_context`、enqueue、syncはattachmentを消費・cleanupしないため、不要な外部I/Oと未対応の`[Image #N]`参照を発生させる | 該当なし | 初回レビュー | metadata取得APIは従来どおり保持し、add／routing／pipeline専用のPR task準備境界で画像処理を行う |
| 3 | `ARCH-PRIMG-003` | `github-pr-image-temp-lifecycle` | スコープ内 | `src/app/cli/routing.ts:319-346` | PR attachment取得後、PR head branchがない`save_task`経路で`process.exit(1)`を呼ぶため、内外の`finally`が実行されず画像attachmentとinteractive attachmentが残る | 該当なし | 初回レビュー | exit前に明示cleanupするか、例外を送出してcleanup後に終了する |
| 4 | `ARCH-PRIMG-004` | `github-pr-image-reference-order` | スコープ内 | `src/infra/github/pr-images.ts:192-195` | Markdown画像を全件抽出した後にHTML画像を全件抽出するため、本文が`<img first> ![second]`の場合、`second`が`[Image #1]`、`first`が`[Image #2]`になる | 該当なし | 初回レビュー | Markdown／HTMLのmatch位置を統合し、本文上の出現順でdedupe・採番する |

## 継続指摘（persists）

該当なし。

## 解消済み（resolved）

該当なし。

## 裁定済みの対象外指摘

該当なし。

## 再開指摘（reopened）

該当なし。

## 検証証跡

- ビルド: 実装履歴上、`npm run build` は成功。本レビューでは再実行していない。
- Lint: 実装履歴上、`npm run lint` は成功。本レビューでは再実行していない。
- テスト: `npm test -- src/__tests__/github-pr.test.ts` は44件成功。ただし親一時ディレクトリが残存した。
- 動作確認: 混在記法の実行で、`<img first> ![second]` が`[Image #2] [Image #1]`へ変換されることを確認した。