問題は、裁定済み family `pr-attachment-cleanup-hard-exit` だけを対象に、現行コードと実行履歴から根本原因・責務境界・実終了テスト経路を再確認し、次の実装ステップでそのまま使える最小修正計画へ落とすことです。まず指定された task、Knowledge、Policy、Report Directory を一次情報として読み、次に関係コードとテストを照合します。ソース編集は行いません。
一次情報の確認結果として、指定された今回の Report Directory 自体は現時点で空です。そのため履歴から対象を追加せず、プロンプトに明示された現行裁定と、その裁定が採用した `ai-antipattern-review.md` の該当 finding だけを補助証拠として確認します。Knowledge/Policy では、今回に適用されるのは「副作用の解放を失敗・早期終了経路で実証すること」「実 child process は heavy IT に分類すること」「変更した heavy IT と分類契約を対象実行すること」「既存の終了・エラー契約を維持すること」です。その他の provider、workflow rule、契約移行などの項目は非適用です。
現行コードでは、問題は局所的な1箇所の漏れではなく、対話CLIが所有するPR attachment一時storeのライフサイクル契約に属する構造問題です。store生成後に到達可能な3つの `process.exit()` は同じ外側 `finally` を迂回します。一方、`selectAndExecuteTask()` の既定終了契約を変える必要はありません。既存の終了コードとエラー表示を完全に保つ最小案として、PR store取得直後に同期的な process `exit` cleanup をその所有スコープ内だけへ登録し、通常の `finally` では登録解除と既存cleanupを行う方式を中心に、実 child process テストの既存規約を確認しています。
# 修正計画

対象は裁定済み family `pr-attachment-cleanup-hard-exit`、finding `AI-NEW-pr-attachment-cleanup-hard-exit-L307` の1件だけです。指定された今回の Report Directory は空であり、過去指摘の追加・再採用は行いません。

## 根本原因

これは局所的な削除漏れではなく、対話CLIが所有するPR attachment一時storeのライフサイクル問題です。

- [routing.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:117) がstoreのcleanup責務を取得する。
- 現在の解放手段は外側の `finally` だけである。
- workflow失敗、PR context検証失敗、保存時のhead branch欠落では `process.exit()` がスタックを巻き戻さず、`finally` を迂回する。
- [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:187) 内のdownload途中失敗は既にcleanup済みであり、今回の原因には含まれない。
- add・pipeline経路もそれぞれcleanup境界を持つため対象外とする。

## 実装順序

1. `src/app/cli/processExitCleanup.ts` にCLI内部専用の終了cleanup管理を追加する。

   - cleanupをprocessの同期 `exit` イベントへ登録する。
   - 通常終了用に、listenerを解除して同じcleanupを実行する関数を返す。
   - process終了と通常の `finally` の両方から呼ばれても、実cleanupは一度だけ行う。
   - package公開APIからはexportしない。

2. [routing.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:117) のPR attachment所有境界へ適用する。

   - `resolvePrInput()` 成功直後、base branch解決など後続処理より先に終了cleanupを登録する。
   - 外側の `finally` は、従来のcleanup直接呼び出しから、listener解除を含む終了関数の呼び出しへ置換する。
   - 既存の3つの `process.exit(1)`、終了コード、ログ文言、成功経路は変更しない。
   - [selectAndExecute.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/execute/selectAndExecute.ts:211) の既定終了契約や `exitOnFailure` 型も変更しない。

3. 回帰テストを追加・更新する。

   - cleanup登録の単体テストで、通常解放、実行済みcleanupの再呼び出し防止、listener解除を確認する。
   - [cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:420) で次の3経路を個別に通す。
     - workflow失敗によるhard exit
     - attachment取得後のPR base/context検証失敗
     - `save_task` 選択時のhead branch欠落
   - rejectやthrowだけのmockをcleanup保証に使わず、登録されたprocess exit handlerを発火させ、終了処理時点で一時画像が存在しないことを観測する。
   - 実child processを使うheavy ITを追加し、終了コードを維持したまま実際の `process.exit()` 後にattachmentファイルとsessionディレクトリが残らないことを確認する。routingの3経路との配線は上記テスト、Nodeの実終了境界はheavy ITで組み合わせて証明する。

## 完了条件

- 3つの失敗経路すべてで、process終了前にPR attachment storeが解放される。
- 実child終了後、一時画像が存在しない。
- 成功時のattachment伝播とcleanupが維持される。
- 既存の終了コードと利用者向けエラーが変わらない。
- 次を完了する。
  - 対象unitテスト
  - 追加したheavy ITの対象実行
  - `npm test -- src/__tests__/releaseVerificationWiring.test.ts`
  - `npm run build`
  - `npm run lint`
  - `npm test`
  - `npm run test:it`
  - `npm run test:e2e:mock`

現在の環境にはNode child processと一時filesystemがあるため、環境要因として分離する未実証事項はありません。画像解析、download、MIME・サイズ・認証、add・pipeline、非PR経路、広域CLI再設計は変更しません。