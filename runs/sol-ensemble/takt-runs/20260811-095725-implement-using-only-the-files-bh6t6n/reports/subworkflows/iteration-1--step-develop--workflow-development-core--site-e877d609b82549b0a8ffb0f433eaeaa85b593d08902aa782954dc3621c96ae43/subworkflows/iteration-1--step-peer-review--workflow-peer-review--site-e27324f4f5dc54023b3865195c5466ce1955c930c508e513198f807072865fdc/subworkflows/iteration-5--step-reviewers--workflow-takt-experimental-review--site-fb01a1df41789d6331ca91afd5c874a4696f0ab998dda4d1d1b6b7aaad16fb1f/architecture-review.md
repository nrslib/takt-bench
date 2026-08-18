# アーキテクチャレビュー

## 結果: APPROVE

## サマリー

PR画像のMarkdown断片分離、3入口への伝播、添付保存・cleanup、およびmock E2E attemptの隔離境界を再確認した。未解消の設計・配線問題は確認されなかった。

## 検証証跡

- ビルド: `npm run build`は本レビューでは未実行。対象テスト実行時のTypeScript型契約検査はすべて成功。
- テスト: PR解析・add・対話CLI・pipeline・データフロー・E2E attempt境界の対象179件、および分類契約19件が成功。
- 動作確認: 独立したMarkdown断片の解析、inline／nested `<pre>`内画像の除外、URL重複排除、採番、3入口の共通経路、実childへのcwd・隔離env伝播、正常時・spawn失敗時のcleanupを確認。
- 回帰確認: 提示された変更対象46件を照合し、`git diff --check 7d623634f205 --`が成功。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約影響経路・呼び出しチェーン | `src/infra/git/format.ts:148-326`、`src/features/tasks/prReviewAttachments.ts:176-233`、`src/features/tasks/add/index.ts:203-236`、`src/app/cli/routing-inputs.ts:52-84`、`src/features/pipeline/steps.ts:222-248` |
| レイヤー設計・責務所有 | `src/infra/git/format.ts:228-326`が整形と断片範囲を所有し、`src/features/tasks/prReviewAttachments.ts:145-233`が解析・取得・置換を所有 |
| 状態整合性・副作用解放 | `src/features/tasks/prReviewAttachments.ts:208-231`、`src/features/tasks/add/index.ts:211-236`、`src/features/pipeline/execute.ts:40-92` |
| 契約置換・旧経路削除 | 3入口はすべて`formatPrReviewTask()`から`preparePrReviewAttachments()`へ接続。連結済み文字列を直接解析する旧本番経路は該当なし |
| テストレイヤーと実行境界 | `src/__tests__/pr-image-dataflow.integration.test.ts:41-99`、`src/__tests__/it-e2e-mock-runner-attempt.test.ts:70-154`、`scripts/test-classification.mjs:360-377` |
| E2E attemptの分離・cleanup | `scripts/run-e2e-mock-shards.mjs:138-170`、`scripts/teed-command.mjs:14-71` |