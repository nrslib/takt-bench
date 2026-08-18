問題を要約すると、確定済み修正計画の7 family（U2〜U7、U1）を依存順に実装し、指定された品質ゲートと受入条件を確認する作業です。まず `coding` スキル、指定された Knowledge/Policy、task の正本、Report Directory の実行履歴を全文確認してから、現在のコード経路を再構築します。編集後は旧経路・未移行 consumer・未使用化を再検索し、必要なテストを順番に実行します。
`coding` スキルを読み込みました。指定どおり、実装前に同スキルが参照する6つの正本（Coder、AI Antipattern Reviewer、Architecture Reviewer、Coding Policy、AI Antipattern Policy、Architecture Knowledge）を全文確認します。
正本の `order.md` と現行 `fix-plan.md` を確認しました。計画は「先行 remediation なし」の初回検証で、対象は7 familyに限定されています。続いて、プロンプトで省略表示されている remediation 用 Knowledge/Policy を指定パスから全文読み込みます。これらを読了するまで実装には入りません。
指定された Knowledge/Policy は全文確認済みです。適用分類は、U2/U3/U5が局所、U4/U6/U1が構造、U7が分類配線です。ここから現在の実コードで owner・producer・consumer・terminal を再構築し、既存の未コミット変更がある場合はその範囲を確認して保持します。
影響グラフを確認しました。現状は `fetchPrReviewComments()` が metadata取得・画像抽出・HTTP/API取得・本文置換・temp生成を一括所有し、`PrReviewData.attachments` を add/routing/pipeline/system へ流しています。これを、metadata専用の既存同期APIと、3つのtask入口だけが呼ぶ非同期 `prepareGitHubPrTask()` に分離します。画像準備は `GitHubPrImageResource`（attachments＋冪等cleanup）を返し、親temp directoryを所有したまま `exit` hook も登録します。まず共有repository解析と画像ownerを実装します。
U2〜U5とU1の基盤変更を反映済みです。続けて、未移行のpipeline経路とresource handleの終端を接続し、旧`attachments`/旧cleanup経路の残存を検索で解消します。
pipelineの非同期task準備と、実行開始前・添付準備失敗・workflow終端の3箇所へresource cleanupを接続しました。`pipelineExecution.test.ts`もclassifierのfilesystem境界へ追加済みです。次に型・既存テストを、旧`PrReviewData.attachments`契約から新resource契約へ移行します。
旧`PrReviewData.attachments`参照と旧`cleanupGitHubPrAttachments`呼び出しは実装側から除去しました。task/add、routing、pipelineの各テストを新resource handleのモックへ移行したため、まず影響範囲のテストをファイル単位で順に実行します。
影響範囲の対象テストは通過しました。追加確認で、task準備後のformatter例外時にresource所有権が失われる余地を確認したため、routing/pipelineの準備境界自身でcleanupする例外経路を補強します。これは失敗時終端の完了義務に含まれます。
GitLab系の既存経路を確認し、GitHub専用準備関数がGitLab MR本文を解釈しないno-op境界を追加しました。認証はrepository assetだけに付与し、user-attachmentsには付与しないことをテストで確認済みです。これから全体ゲートを順次実行します。
セルフスキャンで、非render領域の`[Image #N]`を採番予約に含めないよう正規化し、pipelineのtask-spec cleanupが失敗してもPR resource cleanupへ到達する`finally`構造にしました。親directory不存在とcleanup一回性のテスト観測も追加したため、影響ファイルを再実行します。
最終編集後のbuild・lint・fast unit gateと、追加した影響テスト（github-pr-images 16件、addTask 19件、pipelineExecution 53件）は全て通過しました。終端変更を含む最終状態でlight ITを再確認し、その後、先ほど通過済みのmock E2E結果と合わせて最終静的確認を行います。
最終light ITは132ファイル・2102テスト全通過です。実行経路変更を含むため、mock E2Eも最終状態で再実行します。既に一度全shard通過していますが、終端cleanupの最終変更後の確認として扱います。
最終mock E2Eはexit=0、4 shard全通過（16 test files、48 passed、13 skipped）でした。最後に差分・旧経路・分類配線・未使用参照を再検索し、成果物状態を確定します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- U2/U3: Markdown・HTML混在順を統合し、既存番号を避けて採番。placeholder・filename・添付順を一致。
- U4/U5: PR repository scopeを認証前に検証し、Web URLを直接HTTP取得。Content-Type、magic bytes、サイズを検証。
- U6: temp fileと親directoryをresource handleで所有し、成功・失敗・cancel・明示終了時に冪等cleanup。
- U1: `fetchPrReviewComments()`をmetadata-onlyへ変更し、add/routing/pipelineのtask入口だけで画像準備を実行。GitLab経路は保持。
- U7: `pipelineExecution.test.ts`をfilesystem light IT分類へ接続。
- 旧`attachments`経路、`gh api`画像取得、旧cleanup helperの残存なし。

## 検証結果と証拠

- `npm run build` 成功
- `npm run lint` 成功
- `npm test` 成功（4 shard、5,378 tests）
- `HOME=/tmp/takt-bench-v3-home npm run test:it` 成功（132 files、2,102 tests）
- `npm run test:e2e:mock` 成功（exit=0、全shard通過）
- `npm run test:e2e:smoke` 成功
- 影響テスト、分類契約、`git diff --check` 成功
- 実private GitHub E2Eは資格情報未提供のため未実証。決定的なHTTP・scope・保存・cleanupテストで確認済み。