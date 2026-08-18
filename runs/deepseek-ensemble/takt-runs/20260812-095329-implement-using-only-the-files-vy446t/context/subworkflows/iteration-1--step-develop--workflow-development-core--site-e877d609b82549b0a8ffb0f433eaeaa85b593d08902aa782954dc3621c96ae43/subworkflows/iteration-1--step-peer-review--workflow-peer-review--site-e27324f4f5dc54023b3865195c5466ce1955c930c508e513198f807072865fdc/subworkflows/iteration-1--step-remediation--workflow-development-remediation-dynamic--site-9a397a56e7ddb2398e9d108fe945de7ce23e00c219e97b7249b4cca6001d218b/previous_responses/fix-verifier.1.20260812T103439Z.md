修正計画の4経路（producer、pipeline、対話 routing、`add --pr`）を、報告内容とは独立に差分・実コード・対象テストで再確認します。まず指定された Knowledge / Policy と最新レビューレポートを全文確認し、その後に各完了義務を反例ベースで検証します。
指定資料の全文確認が完了しました。裁定上の対象は `F-PR-IMAGE-LIFECYCLE` だけで、Response 読み取りの指摘は false positive、周辺の別契約は対象外です。次に、実際の現在コードで cleanup の所有期間と全 return / throw / cancel 経路を追跡します。
現在コードでは、producer の token 取得・画像取得・書込み失敗は `try/catch` 内で削除され、pipeline と `add --pr` の保存失敗も finally で覆われています。一方、対話経路の `determineWorkflow` 例外は line 174 の await が finally の外にあり、修正報告の「例外も cleanup」の主張と一致しません。これを対象テストの実行結果と、同じ family の他の早期終了経路で切り分けます。
判定: `incomplete`

`F-PR-IMAGE-LIFECYCLE` は未完了です。

- `src/app/cli/routing.ts:174` の `determineWorkflow()` 例外時、cleanup が呼ばれません。
- `src/app/cli/routing.ts:193` の `selectInteractiveMode()` 例外時も同様です。
- cleanup の `finally` は `:283-347` の dispatch 部分だけを覆っており、選択処理・workflow description・mode 実行の例外経路は対象外です。

修正報告のテストはキャンセルと dispatch 後の例外のみで、workflow/mode 選択の reject ケースを検証していません。

確認済み:

- producer の token 取得失敗・成功後 cleanup: 実行確認済み
- pipeline の成功・失敗・workflow 例外: 対象テスト 29件成功
- add のキャンセル・workflow 例外・保存失敗: 対象テスト成功
- producer/add の統合テスト: 83件成功

次の修正では、PR画像解決後から処理完了までの routing 全体を cleanup の保証境界で覆い、workflow 選択例外・mode 選択例外の回帰テストを追加してください。