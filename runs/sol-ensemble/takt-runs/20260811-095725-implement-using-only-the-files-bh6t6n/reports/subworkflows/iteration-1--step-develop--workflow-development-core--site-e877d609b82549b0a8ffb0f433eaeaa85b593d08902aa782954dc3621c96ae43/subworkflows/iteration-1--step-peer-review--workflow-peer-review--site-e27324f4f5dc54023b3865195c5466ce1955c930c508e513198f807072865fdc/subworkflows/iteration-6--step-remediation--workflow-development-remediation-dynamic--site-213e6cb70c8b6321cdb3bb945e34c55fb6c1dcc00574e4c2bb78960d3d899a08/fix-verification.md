# 修正完了検証

## 結果: verified

## サマリー

`pr-attachment-cleanup-hard-exit`について、計画の全不変条件を現在のコード、差分、対象テスト、実child processで独立に検証した。

PR attachment store取得直後に同期exit cleanupが登録され、workflow失敗、PR context検証失敗、head branch欠落の3経路では、外側`finally`へ巻き戻る前にcleanupが完了する。通常完了、取消、通常例外ではcleanupとlistener解除が行われ、exit handlerと`finally`が競合しても実cleanupは1回に限定される。

実child process終了後の画像・session directory不存在、既存のattachment伝播、終了コード、エラー文言、解決済みproject `cwd`の伝播も確認した。未完了義務および追加findingはない。

## 修正単位の整合性

| 修正単位 | 対象 finding | 前提・方法・証拠能力の整合性 | 判定 |
|----------|--------------|------------------------------|------|
| `pr-attachment-cleanup-hard-exit` | `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | 対話CLIのattachment所有境界で同期`exit` listenerと通常`finally`が同じ一回性cleanupを共有する方式は、既存hard exit契約を維持しながら全対象経路を保護する。route単体テストはhard-exit直後を観測し、heavy ITは実process終了境界を観測できている | 適合 |

## 完了義務の独立検証

| 修正単位 | 義務ID | 対象 finding | 不変条件と対象経路 | 独立に用いた反例・観測点 | 観測結果 | 証拠 | 判定 |
|----------|--------|--------------|--------------------|----------------------------|----------|------|------|
| `pr-attachment-cleanup-hard-exit` | `PACH-01` | `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | 実process終了時に同期cleanupを完了する | 子processを終了コード23で終了し、親processから画像とsession directoryを確認 | 成立 | `it-pr-attachment-process-exit-cleanup.test.ts`成功。両方とも不存在 | 完了 |
| 同上 | `PACH-02` | 同上 | store取得直後、後続の失敗可能処理より前にcleanupを登録する | `resolvePrInput()`返却からPR context生成までのコード順を追跡 | 成立 | `routing.ts:124-145`で返却直後の`:125`に登録 | 完了 |
| 同上 | `PACH-03` | 同上 | workflow失敗の`process.exit(1)`前に解放する | 新規exit listener実行後、モック例外送出前にcleanup回数を観測 | 成立 | `cli-routing-pr-resolve.test.ts:436-466`でcleanup 1回、終了コード1 | 完了 |
| 同上 | `PACH-04` | 同上 | PR context検証失敗の`process.exit(1)`前に解放する | 不正base branchを入力し、exit listener直後に観測 | 成立 | 同テスト`:468-493`でcleanup 1回、既存エラー文言、終了コード1 | 完了 |
| 同上 | `PACH-05` | 同上 | head branch欠落の`process.exit(1)`前に解放する | head branchなしで`save_task`を選択し、exit listener直後に観測 | 成立 | 同テスト`:564-590`でcleanup 1回、保存未実行、既存エラー文言、終了コード1 | 完了 |
| 同上 | `PACH-06` | 同上 | 正常完了、取消、通常例外で解放し、listenerを残さない | routing実行前後の`process.rawListeners('exit')`を比較 | 成立 | 同テスト`:389-434`、`:525-562`でcleanup 1回、listener集合一致 | 完了 |
| 同上 | `PACH-07` | 同上 | exit handlerと`finally`が競合してもcleanupは1回 | exit listener実行後に返却された終了関数を再実行 | 成立 | `processExitCleanup.test.ts`の2件で一回性とlistener解除を確認 | 完了 |
| 同上 | `PACH-08` | 同上 | 生のcleanupを外側`finally`だけで呼ぶ旧経路を残さない | 旧変数名とcleanup利用箇所を検索 | 成立 | `cleanupSourceAttachments`なし。`finishSourceAttachmentsCleanup`のみが登録済み終了関数を保持 | 完了 |
| 同上 | `PACH-09` | 同上 | attachment伝播、終了コード、利用者向けエラーを維持する | execute/save_task成功と3失敗経路を実行 | 成立 | routing回帰31件成功 | 完了 |
| 同上 | `PACH-10` | 同上 | PR画像処理へ解決済みproject `cwd`を明示的に伝播する | シグネチャ、全呼び出し元、provider・attachment準備への引数を照合 | 成立 | `resolvePrInput(prNumber, cwd: string)`、実在呼び出し元は`resolvedCwd`を指定。cwd伝播11件成功 | 完了 |

## 不成立・未確認事項

なし。

## 環境要因により実証できない後続確認（判定非ブロッキング）

なし。

## 実行証跡

| 対象 | 方法 | 結果 |
|------|------|------|
| cleanup一回性・listener解除 | `npm test -- src/__tests__/processExitCleanup.test.ts` | 成功、2件 |
| 3つのhard-exit経路、通常完了、取消、例外、既存契約 | `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts` | 成功、31件 |
| 実process終了後の画像・session directory不存在 | `npm test -- src/__tests__/it-pr-attachment-process-exit-cleanup.test.ts` | 成功、1件 |
| heavy IT分類とrunner配線 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts` | 成功、19件 |
| project `cwd`伝播 | `npm test -- src/__tests__/git-cwd-propagation.test.ts` | 成功、11件 |
| 型チェック・ビルド | `npm run build` | 成功 |
| 静的検査 | `npm run lint` | 成功 |
| 差分形式 | `git diff --check` | 成功 |