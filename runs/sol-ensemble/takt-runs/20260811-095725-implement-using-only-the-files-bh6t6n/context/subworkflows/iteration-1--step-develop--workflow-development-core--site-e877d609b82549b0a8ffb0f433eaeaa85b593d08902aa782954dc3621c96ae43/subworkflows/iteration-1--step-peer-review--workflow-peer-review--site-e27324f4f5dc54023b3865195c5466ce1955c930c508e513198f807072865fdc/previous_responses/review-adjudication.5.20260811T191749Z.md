問題は、最新の提出済みレビュー指摘だけを、現行コード・一次要求・実行証跡と照合し、次工程へ渡す修正対象 family を一意に確定することです。まず Policy／Knowledge の正本を EOF まで読み、task と Report Directory の最新レポートを特定したうえで、各 finding の根拠箇所を現在のコードで再検証します。編集やテストゲートの再実行は行いません。
Policy と Knowledge は正本を EOF まで確認しました。今回直接適用する軸は、提出済み finding の一意な裁定、変更契約との直接関係、最小内部修正、契約置換時の明示要求範囲、テストが実際に観測する境界です。次に iteration 4 の reviewer 4件を最新提出物として読み、一次要求と直近 remediation 証跡に照合します。
現時点の証拠では、現行 finding は2件です。1件目は再現できており、未閉鎖フェンスを含む独立したPR本文を後続コメントと連結すると、AST上の画像ノードが0件になり、3つの `--pr` 入口が同じ経路を通ります。2件目は実装不具合の主張ではなく、今回変更した実process境界の恒久的な回帰テスト不足です。正式E2Eと手動 probe の成功証跡はありますが、現在のテストコードが本番 attempt を差し替えている事実とは両立するため、別 family として裁定します。
# 裁定結果

**修正対象あり。再計画は不要です。**

最新 reviewer の現行 finding は2件で、いずれも別の根本原因を持つ `actionable` family と裁定します。`duplicate`、未解決前提、`environment_unverified` はありません。

## Finding 裁定

| finding ID / 出典 | disposition | 統合先 family | 裁定根拠 |
|---|---|---|---|
| `CODE-NEW-pr-review-fragment-isolation-L92` / [coding-review.md](</Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/.takt/runs/20260811-095725-implement-using-only-the-files-bh6t6n/reports/subworkflows/iteration-1--step-develop--workflow-development-core--site-e877d609b82549b0a8ffb0f433eaeaa85b593d08902aa782954dc3621c96ae43/subworkflows/iteration-1--step-peer-review--workflow-peer-review--site-e27324f4f5dc54023b3865195c5466ce1955c930c508e513198f807072865fdc/subworkflows/iteration-4--step-reviewers--workflow-takt-experimental-review--site-fe7cdb8f61b40013ac5282327b5eed6e48490ab038e1af09bc6eec250df61821/coding-review.md:39>) | `actionable` | `FAM-PR-MARKDOWN-FRAGMENT-ISOLATION` | [format.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/git/format.ts:197) が独立した本文を連結し、[prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:91) が全体を1回だけ解析する。未閉鎖フェンスの後に画像コメントを置く再現で、ASTの画像ノードは0件となった。 |
| `TEST-NEW-e2e-runner-attempt-boundary-L31` / [testing-review.md](</Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/.takt/runs/20260811-095725-implement-using-only-the-files-bh6t6n/reports/subworkflows/iteration-1--step-develop--workflow-development-core--site-e877d609b82549b0a8ffb0f433eaeaa85b593d08902aa782954dc3621c96ae43/subworkflows/iteration-1--step-peer-review--workflow-peer-review--site-e27324f4f5dc54023b3865195c5466ce1955c930c508e513198f807072865fdc/subworkflows/iteration-4--step-reviewers--workflow-takt-experimental-review--site-fe7cdb8f61b40013ac5282327b5eed6e48490ab038e1af09bc6eec250df61821/testing-review.md:33>) | `actionable` | `FAM-E2E-ATTEMPT-BOUNDARY-COVERAGE` | [e2eMockRunner.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/e2eMockRunner.test.ts:49) は全ケースで `runAttempt` を差し替え、本番の [runShardAttempt](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/run-e2e-mock-shards.mjs:138) を通らない。[it-teed-command.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/it-teed-command.test.ts:31) も追加された `cwd`・`env` optionを使用していない。正式E2Eと手動probeの成功は、恒久的な回帰テスト不足を反証しない。 |

coding review の「resolved」欄にある過去IDは再提出された finding ではないため、今回の裁定集合には含めません。

## 修正対象 family

### `FAM-PR-MARKDOWN-FRAGMENT-ISOLATION`

- 破られた不変条件: PR本文、review summary、review thread、通常コメントは独立したMarkdown入力であり、ある本文の構文状態が別本文の画像検出を阻害しない。
- 要求との関係: [order.md](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/.takt/runs/20260811-095725-implement-using-only-the-files-bh6t6n/context/task/order.md:11) の全コメント種別の画像検出に直接違反する。
- 影響経路: `PrReviewData` → 整形・画像抽出 → `add --pr`、対話CLI、pipeline。3入口すべてが同じ連結済み文字列を渡している。
- 受入条件:
  - 未閉鎖フェンスを含む先行本文があっても、後続の各コメント種別にある画像が検出・保存・置換される。
  - 同一断片内のコードフェンスなど、Markdown上のリテラルは引き続き画像扱いしない。
  - URL重複排除、出現順、画像番号割当は断片間で一貫する。
  - 3つの入口が共通の修正済み経路を使用する。
- 修正境界: PRデータの整形・画像抽出境界、その3利用側、回帰テストに限定する。parser交換、download・MIME・サイズ制約の変更、壊れたMarkdown自体の補正、互換fallback、周辺リファクタリングは除外する。

### `FAM-E2E-ATTEMPT-BOUNDARY-COVERAGE`

- 破られた品質原則: 変更した実process境界の意味契約を、テストダブルだけで検証済みとしてはならない。
- 契約経路: `test:e2e:mock` → `runCli()` → `runShardAttempt()` → `runTeedCommand()` → child process。
- 受入条件:
  - 実child processで、指定した `cwd` と隔離 `env` が子へ伝播することを恒久的なheavy ITで観測する。
  - attemptごとに隔離ディレクトリが生成され、成功時および代表的な起動失敗時にcleanupされることを検証する。
  - 初回と再測定が同じ隔離済みproduction attempt契約を使うことを確認する。
  - 追加・変更したheavy ITを対象実行し、分類契約テストも単体実行する。
- 修正境界: runner境界のテスト可能性と必要最小限の回帰テストに限定する。再測定条件、shard構成、timeout、正式E2Eの外部挙動、全heavy IT実行、広域なrunner再設計は除外する。

適用した判断材料は、裁定ポリシー、契約置換、TAKTテスト実行ポリシー、およびKnowledgeのフェーズ分離・呼び出しチェーン・テストダブル契約・振る舞い保証・テストレイヤーです。セキュリティ、provider、session、公開APIなどは今回提出された2件には非適用です。