# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件 |
|-------------------|------|----------------------|-----------------------------|------|----------|
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` / `ai-antipattern-review.md` | `src/app/cli/routing.ts:117-148,299-346`、`src/features/tasks/execute/selectAndExecute.ts:211-215`、`src/__tests__/cli-routing-pr-resolve.test.ts:420-510` | `pr-attachment-cleanup-hard-exit` | private PR画像が一時ディレクトリに残る → store取得後のworkflow失敗、PR context検証失敗、head branch欠落が`process.exit()`を呼び、外側の`finally`を実行しない → 対話CLIのattachment所有責務がスタック巻き戻しだけをcleanup境界としており、hard exit境界を所有していない | 構造 | 3つのhard-exit経路すべてでプロセス終了前にstoreが解放され、実child process終了後に画像ファイルが存在しない。成功時挙動、終了コード、利用者向けエラーを維持する |

## 欠陥 family の最終状態

| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `pr-attachment-cleanup-hard-exit` | `context/task/order.md`のprivate PR画像の安全な一時保存要件、裁定の受入条件、対話CLIの既存終了・エラー契約 | 1. PR attachment store取得後は通常完了、例外、早期return、`process.exit()`のいずれでも解放する。2. workflow失敗、PR context検証失敗、head branch欠落の3経路を漏らさない。3. hard exit時は終了前に同期cleanupを完了する。4. 通常の`finally`とprocess exitの競合でcleanupを重複実行しない。5. 成功時のattachment伝播、終了状態、既存エラー表示を変えない。6. listenerを通常完了後に残さない | `src/app/cli/routing.ts`をPR source attachmentの所有者として維持する。CLI内部のprocess exit cleanup登録・解除だけを専用モジュールへ分離し、routingがstore取得直後に登録して外側`finally`で終了させる | `resolvePrInput()` → 一時store・`TaskAttachment[]`取得 → interactive seed → `execute`または`save_task` → workflow失敗／base・PR context検証失敗／head branch欠落 → process exit cleanup → CLI終了。通常成功・取消・例外は既存`finally`から同じcleanupを実行 | 成立例: 正常実行、workflow選択取消、通常例外では`finally`で解放。失敗例: `selectAndExecuteTask()`が`process.exit(1)`、base解決が失敗してcatch内でexit、head branchなしでexit。境界値: attachmentなしのno-op cleanup、process exitと`finally`の双方から終了処理が呼ばれる場合 | `cleanupSourceAttachments`へ生のcleanup関数を保持して外側`finally`だけで呼ぶ旧経路を置換する。`selectAndExecuteTask()`の既定終了契約、`exitOnFailure`、add・pipeline・非PR経路は移行・削除しない |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `pr-attachment-cleanup-hard-exit` | 境界変更 | なし | 新規 `src/app/cli/processExitCleanup.ts` | cleanupをprocessの同期`exit`イベントへ一度だけ登録し、返却する終了関数がlistener解除とcleanupを行う。exit発火後または終了関数再呼び出しでも実cleanupが重複しない |
| 2 | `pr-attachment-cleanup-hard-exit` | 利用側移行 | 工程1 | `src/app/cli/routing.ts:117-148,342-346` | `resolvePrInput()`成功直後、base branch解決など後続の失敗可能処理より先にcleanupを登録する。外側`finally`は登録解除を含む終了関数を呼ぶ。3つの既存`process.exit(1)`、ログ文言、終了コードは変更しない |
| 3 | `pr-attachment-cleanup-hard-exit` | 回帰テスト修正 | 工程2 | `src/__tests__/cli-routing-pr-resolve.test.ts`、新規 `src/__tests__/processExitCleanup.test.ts` | workflow失敗をreject-only mockではなくhard-exit相当で再現する。PR context検証失敗とhead branch欠落も個別に通し、exit handler実行時点で一時画像がないことを観測する。正常終了時のlistener解除とcleanup一回性も確認する |
| 4 | `pr-attachment-cleanup-hard-exit` | 実終了境界テスト | 工程1、2 | 新規 `src/__tests__/it-pr-attachment-process-exit-cleanup.test.ts`および最小のchild fixture | 実child processで一時画像を作成し、productionのcleanup登録を通して非0終了する。親プロセスから終了コードと、一時画像・sessionディレクトリの不存在を確認する。route単体テストの3経路配線と組み合わせ、mockによるスタック巻き戻しだけではないことを証明する |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `pr-attachment-cleanup-hard-exit` | `order.md`のprivate画像安全性、裁定の修正境界、Policyの副作用解放・エラー契約・最小変更、Knowledgeの実境界別テスト分類 | 対話CLI所有スコープへprocess exit cleanupを登録する方式を採用する。`exitOnFailure: false`だけではPR検証失敗とhead branch欠落を解決せず、例外伝播により利用者向け表示を変える可能性があるため採用しない。`selectAndExecuteTask()`全体を`process.exitCode`方式へ変える案も既定終了契約を変更するため不採用。signal全般やグローバルresource managerへの拡張は行わない | routeテストで3経路それぞれのcleanup配線、既存ログ、exit codeを確認する。専用unitでlistener解除と一回性を確認する。実child processを使うheavy ITで終了後のfilesystem不存在を観測する。現在の環境でNode child processと一時filesystemを利用できるため、環境要因による未実証事項はない | PR attachment所有者の内部だけを変更し、既存hard exitと外部契約を保持する。add・pipeline、画像解析、download、MIME、サイズ、認証、非PR経路へ影響を広げない。実child processテストはheavy ITとして分類する | `npm test -- src/__tests__/processExitCleanup.test.ts`、`npm test -- src/__tests__/cli-routing-pr-resolve.test.ts`、`npm test -- src/__tests__/it-pr-attachment-process-exit-cleanup.test.ts`、`npm test -- src/__tests__/releaseVerificationWiring.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、`npm run test:e2e:mock` |

## 再計画事項

- なし。裁定済みfamilyは1件であり、既存の終了コード・エラー契約を維持したまま、対話CLIのPR attachment所有境界内で完結する修正が可能である。
- `false_positive`、`overreach`、`out_of_scope`、`no_issue_after_verification`、過去のresolved指摘、add・pipeline・画像取得処理など裁定外の領域は計画へ含めない。