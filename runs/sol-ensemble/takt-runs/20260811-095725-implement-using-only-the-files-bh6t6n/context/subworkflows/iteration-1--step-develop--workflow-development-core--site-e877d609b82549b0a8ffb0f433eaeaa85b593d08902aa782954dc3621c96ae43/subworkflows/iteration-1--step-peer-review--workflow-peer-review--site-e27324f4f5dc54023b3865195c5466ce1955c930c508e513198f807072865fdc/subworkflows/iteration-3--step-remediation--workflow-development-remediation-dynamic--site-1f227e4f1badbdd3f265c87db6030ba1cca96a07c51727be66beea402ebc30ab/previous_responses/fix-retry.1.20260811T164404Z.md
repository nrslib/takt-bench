問題は、retry が本文未記載の既存画像ファイルを予約せず保存時に衝突する点と、対話経路の伝播を実経路で検証できていない点です。`coding` スキルを適用し、正本の仕様・Policy・Knowledge・最新レポートを全文確認してから、既存計画の範囲内で実装と反例テストを補完します。
正本と実行履歴を照合しました。修正計画は有効です。再開する義務は、retry の実ディレクトリ予約に関わる `IAIP-03/05`、対話の producer→伝播→consumer を通す `IAIP-06`、それらの共通採番・旧経路削除・差分健全性を再確認する `IAIP-01/04/07` です。前回証拠の欠陥は、retry では反例不足、対話では consumer 単体テストによる未走査経路です。
現行コードで verifier の再現条件を確認しました。retry は `order.md` だけを allocator に渡し、その後に実ディレクトリをコピーしているため、指摘どおり予約元と保存対象が不一致です。共通 assigner の入力を参照集合へ正規化し、retry ではコピー対象のルート画像ファイル名を同じ集合に加えます。対話側は本実装の配線を変えず、既存の実 `runConversationLoop` テストへ反例を追加します。
実装と反例テストを追加し、テスト前の Companion 受信箱も確認しました。現時点でこの remediation site の新規レコードはありません。まず retry・対話実経路・PR の対象テストを分類済み runner で実行し、失敗時は観測点か実装のどちらが不正かを切り分けます。
対象テストは成功しました（PR 31件、retry＋対話 31件）。テスト完了後に Companion の新規レコードが到着したため、ここで内容を独立検証し、`must_fix` または妥当な `should_fix` があれば品質ゲート前に反映します。
Companion 1 は記録生成時点の古い状態で、現在の両呼び出しは配列を渡しており、型契約テストも成功しているため追加修正不要と確認しました。Companion 2 は妥当です。テスト名が保存→run-context を主張する一方、保存済み task ではなく元の一時添付から別 task spec を作っていました。保存された `task_dir` を直接 `resolveTaskSpecForExecution` へ渡すよう修正します。
Companion のデータフロー反例も、保存済み `task_dir` から run context へ stage する実経路で成功しました。続いて、変更した light IT の分類契約、ビルド、lint を実行し、その後に fast unit と light integration の全ゲートを確認します。
Fast unit gate exposed an incomplete test-double contract: six unit cases pass a synthetic `task_dir` whose mocked `order.md` exists, but no corresponding attachment directory exists on disk.本番では「添付ディレクトリが存在しない」は有効状態なので、manifest 読み取りを optional directory に対して正しく扱えるか、既存テストダブルの意味契約を確認してから修正します。
Fast unit gate は 379ファイル・6,059テストすべて成功しました。先の失敗は、本番欠陥ではなく unit テストが `existsSync=true` を全パスへ返しつつ manifest 境界を実装のまま残した不整合で、直接依存の manifest を空集合として差し替える契約一致に修正済みです。次に light integration 全件を実行します。
全体ゲートは fast unit 6,059件、light IT 2,357件まで成功しています。最後に、今回の差分について未使用化、依存方向、同義の採番実装、旧 `number` 採番、呼び出し配線、空白不整合を機械的に再走査します。テストダブル編集後の lint も再実行します。
セルフスキャンでは、旧 `number` 最大値 helper・件数採番・手動加算は復活しておらず、共通 assigner の全呼び出しが参照配列を渡しています。新規 import は tasks 内の同層依存と shared への下向き依存だけで、追加した mock・helper に未使用はありません。`git diff --check` と編集後 lint も成功しました。完了宣言前の Companion 最終確認を行います。
## 作業結果

- 修正完了

## 変更内容と受入条件

- retry が `order.md` 未記載の既存 `attachments/image-N.*` も予約するよう修正。既存 `image-1.png`・`image-3.png`に対し、新規画像を `image-2.png`・`image-4.png`として保存できることを確認。
- PR・retry の共通 assigner 契約を参照配列へ統一し、任意長番号、安全整数境界、400桁番号を損失なく予約。
- `runConversationLoop` の実経路で、source context の `#1`、初期添付の `#2/#4`、fileName の `#3`を伝播し、paste画像が `#5/#6`になること、実ファイル内容とcleanupを確認。
- PR画像データフローテストを、保存済み `task_dir`からrun contextへstageする経路へ修正。
- 旧数値採番、件数採番、手動加算、未使用コード、逆方向依存は検出されず、`IAIP-01`〜`IAIP-07`はすべて完了。
- Companionの`must_fix` 2件はいずれも解消済み。

## 検証結果と証拠

- 対象テスト: 62件成功
- 保存済みtask→run-contextデータフロー: 1件成功
- 関連unitテスト: 104件成功
- 分類契約: 19件成功
- `npm run build`: 成功
- `npm run lint`: 成功
- `npm test`: 379ファイル、6,059件成功
- `npm run test:it`: 159ファイル、2,357件成功
- `git diff --check`: 成功
- 最終セルフスキャン: 旧採番経路、未使用参照、同義重複、依存方向違反なし