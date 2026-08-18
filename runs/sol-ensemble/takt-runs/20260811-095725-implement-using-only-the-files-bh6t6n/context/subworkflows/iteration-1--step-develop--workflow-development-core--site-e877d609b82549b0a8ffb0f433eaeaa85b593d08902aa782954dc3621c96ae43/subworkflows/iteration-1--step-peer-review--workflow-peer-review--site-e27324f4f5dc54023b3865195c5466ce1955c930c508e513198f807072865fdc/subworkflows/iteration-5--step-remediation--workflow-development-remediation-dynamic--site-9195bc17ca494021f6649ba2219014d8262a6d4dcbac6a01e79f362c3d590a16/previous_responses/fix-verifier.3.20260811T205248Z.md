問題は、確定した2つの修正単位について、修正報告を鵜呑みにせず、計画上の全不変条件と反例を現行コード・差分・対象テストで独立検証することです。まず正本の仕様・ポリシー・ナレッジと最新レポートを全読し、その後に差分、実在経路、反例テストを照合します。ソースは編集しません。
正本と最新履歴を確認しました。直前の verifier が唯一再現した不足は、mdast ノードをまたぐ inline `<pre>` 状態の欠落です。今回の修正はそこを狙っていますが、同じ解析方式が HTML comment、ネスト、閉じタグ不整合、通常画像への復帰、各入口・保存経路へ与える影響も含めて再検証します。先に適用ポリシー全文を読み切ります。
実装照合では、3入口はすべて `FormattedPrReviewTask` を使い、旧「連結文字列を直接解析」経路は残っていません。E2E runner も初回・再測定とも同じ attempt executor を通り、`finally` cleanup されています。次に、修正の核心である parse5 の source offset が、閉鎖・未閉鎖・ネストした `<pre>` と mdast 分割時に実際どう振る舞うかを反例入力で確認します。
対象実行は完了しました。型契約、PR解析・formatter・3入口の unit 154件、filesystem dataflow の light IT 1件、実 child process attempt と分類契約の heavy IT 43件がすべて成功しました。inline `<pre>` の2反例では内部画像を保持し、直後の通常画像だけを `[Image #1]` にする観測点が成立しています。現在、未完了候補が他の完了義務へ波及していないか最終照合しています。
## 結果: verified

修正計画の全完了義務を独立検証し、未完了事項は確認されませんでした。

- inline／nested `<pre>` 内の画像除外と、直後の通常画像の処理を確認
- Markdown断片分離、順序、重複排除、採番、cleanupを確認
- add・対話CLI・pipelineの3入口と旧直接解析経路の削除を確認
- filesystem保存・run context stagingを確認
- E2E attemptの環境分離、env伝播、正常時／spawn失敗時cleanup、再測定、分類契約を確認
- 対象テスト結果: unit 154件、light IT 1件、heavy IT／分類契約43件、すべて成功
- `git diff --check` 成功

ソースは編集していません。