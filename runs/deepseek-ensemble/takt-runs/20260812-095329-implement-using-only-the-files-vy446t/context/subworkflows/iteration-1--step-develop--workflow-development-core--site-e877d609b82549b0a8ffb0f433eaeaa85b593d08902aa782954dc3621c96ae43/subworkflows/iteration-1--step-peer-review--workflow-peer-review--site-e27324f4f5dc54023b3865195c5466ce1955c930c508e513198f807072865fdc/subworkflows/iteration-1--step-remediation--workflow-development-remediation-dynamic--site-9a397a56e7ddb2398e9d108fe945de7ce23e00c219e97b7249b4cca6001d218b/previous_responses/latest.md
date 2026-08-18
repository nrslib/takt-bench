問題を要約すると、`F-PR-IMAGE-LIFECYCLE` の修正報告が示す全完了義務について、現在の差分・対象経路・退行テストを独立に照合し、`verified` / `incomplete` / `plan_invalid` を判定します。ソースは変更せず、まず指定された正本（Knowledge / Policy / task spec）を全文確認し、その後に最新レビュー、差分、関連コード、対象テストを再確認します。
指定された正本は、Knowledge が 1024 行、Policy が 1405 行あり、単一出力では途中切れが発生するため、行範囲を分割して EOF まで読みます。先ほどの確認では Knowledge の大枠（対象経路の追跡、実行経路を通る決定的テスト、環境要因と未確認事項の分離）が適用対象であることを確認しました。続きを分割取得します。
正本・初回レビュー・裁定を照合した結果、今回の判定対象は `F-PR-IMAGE-LIFECYCLE` のみです。Response 読み取り指摘は裁定で `false_positive` となっており、再評価対象に含めません。次に、現在の差分を基準に producer と3 consumer（pipeline / routing / add）の全 return・throw・cancel・terminal exit を列挙し、各義務に対応する退行テストが実際に対象コードを通るか確認します。全体スイートは再実行せず、対象範囲の決定的テストに絞ります。
静的照合で、計画に含まれる主要経路は次のように確認できました。producer の token 取得・画像取得失敗は producer 内の catch、pipeline の workflow 成功/false/reject と実行環境準備失敗は `runPipeline` の finally、routing の選択前後・cancel・dispatch・save_task の terminal exit は cleanup 境界または exit 前処理、add の workflow cancel/reject・保存 reject は明示 cleanup / finally で覆われています。これらを対象テストで再実行し、報告の「全完了」主張と照合します。
対象テストを再実行し、producer / pipeline / routing / add の4ファイルで 115 テストが成功しました。分類契約テスト 20 件と画像抽出 unit 13 件も成功しています。静的再走査では、計画で列挙された全 return・throw・cancel・terminal exit が producer の catch、各 consumer の finally、または `process.exit` 前処理のいずれかで覆われており、今回の受入条件に対する未完了義務は確認できませんでした。全体品質ゲートは修正報告の証跡を参照し、ここでは再実行していません。
結果: `verified`（指摘なし・承認）

`F-PR-IMAGE-LIFECYCLE` の全完了義務を、producer・pipeline・routing・add の実コードと静的経路で確認しました。

対象テストも成功しています。

- 対象4ファイル: 115テスト成功
- 分類契約テスト: 20件成功
- 画像抽出テスト: 13件成功

ソース変更は行っていません。