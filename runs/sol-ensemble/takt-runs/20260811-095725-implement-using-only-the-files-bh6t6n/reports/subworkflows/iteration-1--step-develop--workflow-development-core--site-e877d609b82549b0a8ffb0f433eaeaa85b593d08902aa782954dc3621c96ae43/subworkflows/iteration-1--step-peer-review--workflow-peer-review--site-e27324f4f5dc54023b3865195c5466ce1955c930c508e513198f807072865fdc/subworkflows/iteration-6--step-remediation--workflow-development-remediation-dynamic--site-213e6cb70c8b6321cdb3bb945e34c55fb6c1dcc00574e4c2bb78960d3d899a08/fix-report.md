# 修正レポート

## サマリー

PR attachment cleanup の実装自体は維持し、差し戻し原因だった回帰テストの弱い観測点を修正した。

workflow失敗、PR context検証失敗、head branch欠落の3経路について、`process.exit()`モックが例外を投げた後ではなく、新規exit listenerの実行直後・例外送出前にcleanup完了を検証するよう変更した。正常完了、workflow選択取消、通常例外では、routing実行前後のexit listener集合が一致することを直接確認した。

併せて、PR画像の認証・一時保存に使用する`cwd`を`resolvePrInput()`の必須引数とし、不要な`process.cwd()`フォールバックと省略契約テストを削除した。

対象テスト、実child process heavy IT、分類契約、build、lint、全unit、light IT、mock E2E、差分検査はすべて成功した。

## 修正単位

| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `pr-attachment-cleanup-hard-exit` | `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | private PR画像の安全な一時保存要件、対話CLIの既存終了・エラー契約 | `cli-routing-pr-resolve.test.ts`のhard-exit観測点をexit listener実行直後へ移動。正常終了・取消・通常例外でlistener解放を直接検証。`routing-inputs.ts`のPR用`cwd`を必須化し、不要なフォールバックと旧省略テストを削除 | 完了 |

## 完了義務

| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `pr-attachment-cleanup-hard-exit` | `PACH-01` | 振る舞い修正 | `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | 実process終了時に同期cleanupを完了する | 子processを終了コード23で終了させ、親processから画像とsession directoryを確認 | 外側`finally`だけではhard exit時に一時画像が残り得た | `processExitCleanup.ts`の同期exit listener | heavy IT 1件成功。終了後に画像・session directoryとも不存在 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-02` | 利用側移行 | 同上 | store取得直後、後続の失敗可能処理より先にcleanup境界を登録する | 不正base branchでPR context生成を失敗させる | cleanup登録前に失敗するとhard exitで解放できない | `routing.ts`で`resolvePrInput()`直後に`registerProcessExitCleanup()`を実行 | コード順とPR context検証失敗テストで確認 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-03` | 振る舞い修正 | 同上 | workflow失敗の`process.exit(1)`より前に解放する | 新規exit listener実行後・モック例外送出前にcleanup回数を観測 | 前回は例外後にassertし、外側`finally`だけの旧実装でも合格できた | `mockHardProcessExit()`にexit listener実行直後の観測callbackを追加 | callback内でcleanup 1回を確認。終了コード1も維持 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-04` | 振る舞い修正 | 同上 | PR context検証失敗の`process.exit(1)`より前に解放する | `baseRefName: invalid..base`で失敗させ、exit listener直後に観測 | 前回は外側`finally`実行後のcleanupしか観測していなかった | hard-exitモック内の終了直前観測 | cleanup 1回、既存エラー文言、終了コード1を確認 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-05` | 振る舞い修正 | 同上 | head branch欠落の`process.exit(1)`より前に解放する | head branchなしで`save_task`を選択し、exit listener直後に観測 | 前回は例外送出後のcleanup assertionのみだった | hard-exitモック内の終了直前観測 | cleanup 1回、既存エラー文言、終了コード1、保存未実行を確認 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-06` | 既存契約保存 | 同上 | 正常完了、取消、通常例外で解放し、listenerを残さない | routing実行前後の`process.rawListeners('exit')`を比較 | helper unitだけではroutingが終了関数を使うことを証明できなかった | 正常実行、workflow選択取消、workflow解決例外のroutingテストへlistener比較を追加 | 3経路すべてでcleanup 1回、listener集合一致 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-07` | 既存契約保存 | 同上 | exit handlerと`finally`が競合してもcleanupは一度だけ | exit listener実行後に終了関数を再呼び出す | 共通の一回性境界がなければ二重cleanupになり得た | `processExitCleanup.ts`の`finished`状態 | 専用unit 2件成功。cleanup 1回とlistener解除を確認 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-08` | 旧経路削除 | 同上 | 生のcleanupを外側`finally`だけで呼ぶ旧経路を残さない | 旧変数名とcleanup利用箇所を検索 | 旧経路はhard exitを所有していなかった | `finishSourceAttachmentsCleanup`に登録済み終了関数だけを保持 | `cleanupSourceAttachments`なし。`git diff --check`成功 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-09` | 既存契約保存 | 同上 | attachment伝播、終了コード、利用者向けエラーを維持する | execute/save_task成功と3失敗経路の引数・ログ・終了コードを観測 | 既存routing契約が保存基準 | attachment生成・実行・保存処理を維持 | routing 31件成功 | 完了 |
| `pr-attachment-cleanup-hard-exit` | `PACH-10` | 利用側移行 | 同上 | PR画像取得・保存は選択済みprojectの解決済み`cwd`を使用する | `resolvePrInput()`の引数省略と`cwd ?? process.cwd()`を検索 | 任意引数とフォールバックにより起動ディレクトリを使える状態だった | `resolvePrInput(prNumber, cwd: string)`へ必須化し、全実在呼び出し元から明示的に渡す | cwd伝播テスト11件成功。フォールバックと省略呼び出しなし | 完了 |

## 受入条件

| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | workflow失敗、PR context検証失敗、head branch欠落の全hard-exit経路でprocess終了前にstoreを解放する | 3経路すべてでexit listener実行直後・例外送出前にcleanup 1回を確認 | 完了 |
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | 実child process終了後に一時画像が存在しない | heavy ITで終了コード23、画像・session directory不存在を確認 | 完了 |
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | 成功時挙動、終了コード、利用者向けエラーを維持する | routing 31件、全unit、light IT、mock E2E成功 | 完了 |
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | cleanupを重複実行せず、通常完了後にlistenerを残さない | 専用unitとroutingの正常・取消・通常例外テストで確認 | 完了 |
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | PR画像処理に解決済みproject cwdを使用する | 必須引数化、全呼び出し元検索、cwd伝播テスト11件成功 | 完了 |

## 差し戻し後の証拠修正

| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| `pr-attachment-cleanup-hard-exit` | `PACH-03`、`PACH-04`、`PACH-05` | hard-exitテストのcleanup assertionが外側`finally`実行後であり、旧実装への退行を検出できない | 弱い観測点。モック例外後の最終状態だけを確認していた | exit listener実行後・例外送出前のcallback内でcleanupをassert | `PACH-01`〜`PACH-05`、`PACH-07`〜`PACH-09` |
| `pr-attachment-cleanup-hard-exit` | `PACH-06` | routing正常完了後のlistener不存在を直接観測していない | 不完全な移行証拠。helper unitとrouting cleanup assertionを別々に完了根拠としていた | 正常実行、取消、通常例外でrouting前後のexit listener集合を比較 | `PACH-06`、`PACH-07`、`PACH-08` |
| `pr-attachment-cleanup-hard-exit` | `PACH-10` | PR画像処理の`cwd`に不要な省略・フォールバック経路が残っていた | 不完全な移行。実運用呼び出し元がすべて明示値を渡す事実を省略契約へ反映していなかった | `cwd`必須化、フォールバック削除、全呼び出し元検索 | `PACH-02`、`PACH-09`、`PACH-10` |

## 品質ゲート

| 種別 | 結果 | 証拠 |
|------|------|------|
| routing回帰 | 成功 | `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts`：31件成功 |
| cwd伝播 | 成功 | `npm test -- src/__tests__/git-cwd-propagation.test.ts`：11件成功 |
| cleanup unit | 成功 | `npm test -- src/__tests__/processExitCleanup.test.ts`：2件成功 |
| heavy IT | 成功 | `npm test -- src/__tests__/it-pr-attachment-process-exit-cleanup.test.ts`：1件成功 |
| 分類契約 | 成功 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts`：19件成功 |
| ビルド | 成功 | `npm run build` |
| Lint | 成功 | `npm run lint` |
| 全unit | 成功 | `npm test`：4 shardすべて成功 |
| light IT | 成功 | `npm run test:it`：159ファイル、2358件成功 |
| mock E2E | 成功 | `npm run test:e2e:mock`：初回shard 2の全テスト成功後にVitest RPCノイズを検出し、自動再計測で成功。最終終了コード0 |
| 差分検査 | 成功 | `git diff --check` |
| セルフスキャン | 成功 | 未使用import/export、旧cleanup経路、不要なcwdフォールバック、依存方向、同一責務の重複を確認し、新規問題なし |

## 未完了義務

- なし