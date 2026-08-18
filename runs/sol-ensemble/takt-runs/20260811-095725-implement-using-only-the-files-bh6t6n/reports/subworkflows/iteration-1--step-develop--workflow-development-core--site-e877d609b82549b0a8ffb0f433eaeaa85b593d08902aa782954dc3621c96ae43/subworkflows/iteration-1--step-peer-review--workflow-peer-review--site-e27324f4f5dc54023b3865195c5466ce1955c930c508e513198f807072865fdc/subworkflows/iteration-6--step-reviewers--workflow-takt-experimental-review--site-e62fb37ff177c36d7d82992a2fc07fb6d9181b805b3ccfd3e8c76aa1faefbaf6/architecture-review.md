# アーキテクチャレビュー

## 結果: APPROVE

## サマリー

PR attachment取得後のhard-exit cleanupについて、所有境界・一回性・listener解放・`cwd`伝播を再確認した。未解消の設計・配線問題は確認されなかった。

## 検証証跡

- ビルド: `npm run build`は本レビューでは未実行。対象テスト実行時のtype contract検査は成功。
- テスト: cleanup・routing・`cwd`伝播のunit 3ファイル44件、実child process・分類契約のheavy IT 2ファイル20件が成功。
- 動作確認: workflow失敗、PR context検証失敗、head branch欠落ではexit listener実行直後にcleanupが完了することを確認。通常完了・取消・例外ではcleanupが一度だけ実行され、listenerが残らないことを確認。
- 回帰確認: 提示された変更対象50件がすべて現存し、`git diff --check 7d623634f205 --`が成功。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 状態整合性・副作用解放 | `src/app/cli/routing.ts:121-149,318-348`、`src/app/cli/processExitCleanup.ts:1-15` |
| 呼び出しチェーン検証 | `src/app/cli/routing-inputs.ts:52-84`から`src/app/cli/routing.ts:124-130`へ、attachment・cleanup・解決済み`cwd`を伝播 |
| 境界での解決 | `src/app/cli/routing.ts:42,124`、`src/app/cli/routing-inputs.ts:52-76` |
| 副作用の一回性・通常解放 | `src/app/cli/processExitCleanup.ts:2-14`、`src/app/cli/routing.ts:346-348` |
| hard-exit回帰検証 | `src/__tests__/cli-routing-pr-resolve.test.ts:200-212,436-493,564-593` |
| 実process終了境界 | `src/__tests__/it-pr-attachment-process-exit-cleanup.test.ts:12-34` |
| 同一familyの完了走査 | store取得前のexit経路は一時画像を所有せず契約上変更不要。add・pipeline経路は既存の`finally` cleanupを維持しており、今回のhard-exit familyには非参加 |