問題を要約すると、修正報告の自己申告ではなく、計画に定義された3修正単位の完了義務を、現在の差分・正本・対象経路・反例テストで独立検証します。まず指定された Knowledge/Policy と最新レビュー・計画・実装差分を再読し、その後 URL分類、ストリーム上限、添付生成から cleanup までを個別に確認します。ソースは編集しません。
指定された Knowledge/Policy は全文を確認しました。適用する判断軸は、受入条件に対する直接検証、同一契約経路の水平確認、正常・拒否・早期終了・後片付けの分離、そして実行証跡と実コードの照合です。次に計画・実装・テストの正本を照合します。
最新レビューの正本は、3 family（URL分類、容量制御、要求シナリオ・pipeline証跡）を未充足としており、今回の修正計画もその3つに限定されています。修正報告は3つとも完了としていますが、ここでは報告の文言を採用せず、現在の実コードとテストの Given/When/Then を照合します。まず中心実装と追加テストを読みます。
中心コードでは、修正報告と異なる事実が少なくとも2点あります。`Content-Length` の超過判定は本文読込後にしかなく、ストリーム超過時の `finally` は `releaseLock()` のみで `cancel()` を呼んでいません。また、pipeline テストは実ファイル・order内容を作らず、attachment resolver と task-spec 関連をモックしています。これらを対象テストの実行結果と併せて確定させます。 URL分類の許可範囲も、正例だけでなく無関係な `assets` パスを静的に確認します。
対象経路（add、直接 `--pr`、pipeline）と関連テストを確認し、追加の対象テストも実行しました。URL分類・容量制御・pipeline証跡の3 familyのうち、容量制御とpipeline証跡に未充足があり、URL分類にも修正による許可範囲の過拡大を確認しました。計画自体は局所修正で解消可能なため `plan_invalid` ではなく `incomplete` と判定します。
## 判定: `incomplete`

修正計画自体は妥当で、実装と証跡が未完了です。

1. `FINAL-NEW-PRIMG-REPO-ASSET-URL`  
   [`prReviewImageAttachments.ts:58-60`](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/github/prReviewImageAttachments.ts:58) の `segments.includes('assets')` は、`/owner/repo/issues/assets/123` や `/assets/123` も許可します。指定形式外の GitHub URL を抽出・認証付き取得するため、構造検証を厳密化してください。

2. `FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT`  
   [`prReviewImageAttachments.ts:291-294`](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/github/prReviewImageAttachments.ts:291) で `Content-Length` 超過を本文読込前に拒否していません。実測でも、超過宣言時にストリーム読込回数は `1` でした。  
   また、[`prReviewImageAttachments.ts:323-330`](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/github/prReviewImageAttachments.ts:323) は `releaseLock()` のみで、超過時にストリームを cancel していません。再現結果は `pullCount: 2, cancelCount: 0` です。既存テストは reject のみで、即時停止を検証できていません。

3. `FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE`  
   [`pipelineExecution.test.ts:1571-1613`](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/pipelineExecution.test.ts:1571) は resolver、task spec 準備、`executeTask` をモックし、実画像・`order.md`・物理ファイルを観測していません。統合テストも resolver の一時ファイルだけを検証しています。pipeline の実ファイル作成・order 内容・完了後削除の証跡が不足しています。

対象テスト自体は通過しましたが、上記の反例を検出できる内容ではありません。編集は行っていません。