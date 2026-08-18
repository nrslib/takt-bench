問題を要約します。修正報告の自己申告を正解表にせず、計画済み7 familyの不変条件・全対象経路・完了義務を現行コード、差分、実行証跡へ独立照合し、`verified` / `incomplete` / `plan_invalid` を判定します。ソースは編集しません。

まず、指定された計画・ポリシー・最新レポートと、作業ツリーの差分および関連実装を再読します。
計画と正本の要求は確認しました。適用する主な判定軸は、(1) 7 family の同一担当箇所・同一不変条件で全 graph を追う、(2) 成功だけでなく拒否・失敗・cancel・明示終了・境界値を確認する、(3) fix-report の品質ゲートは記載結果を確認するが未記録ゲートを推測しない、(4) 証拠不足は `incomplete`、計画自体の不足・不整合だけを `plan_invalid` とする、です。

次に、レポートの実体と変更差分を family ごとに分解して確認します。
主要な実装経路を追跡した結果、少なくとも一つ、修正報告が閉じたとしている U6 の終端漏れ候補が見つかりました。`routing` は画像 resource を取得した後、外側の `try/finally` を開始する前に `resolveBaseBranch()` と PR context 構築を実行しており、その区間で例外が出ると cleanup に到達しません。これを現行テスト・差分・実行可能な再現で確定させます。

併せて、U7 の分類契約について、実際に変更された画像テストが unit runner に残っていないかを確認します。完了済みゲートの自己申告だけでは閉じません。
独立検証を継続しています。計画済み7 familyの経路を再追跡した結果、現時点でU6の終了前資源所有とU7の実filesystemテスト分類に追加確認が必要です。残りの対象テストと該当コードを再実行・再読して判定を確定します。
追加の反例を実行します。画像取得中に明示終了した場合、`process.exit` フックが一時directory生成直後から有効かを、実際のdownloader入口で確認します。検証用の一時directory以外は変更しません。
## 判定: `incomplete`

計画自体は有効です。実装・証拠に、U6とU7の未完了が確認されました。

### Findings

1. `[高] PRIMG-06-DOWNLOAD-EXIT-HOOK` — U6未完了

`src/infra/github/pr-images.ts:463-480` では、temp directory生成後、全画像の取得・保存が完了してから終了フックを登録しています。

`fetch()`中に `process.exit()` すると `catch` も終了フックも実行されず、temp fileと親directoryが残ります。実際にdownloader入口で終了させたところ、親directoryが残ることを確認しました。

修正方針: `mkdtempSync()`直後からresource ownerと同期終了cleanupを有効にしてください。

2. `[高] PRIMG-06-ROUTING-SETUP-CLEANUP` — U6未完了

`src/app/cli/routing.ts:129-149` でresourceを取得した後、外側のcleanup用 `try/finally` は `168` 行目から開始します。したがって、`resolveBaseBranch()` または `createPullRequestContext()` が失敗すると、`345-346` 行目のcleanupに到達しません。

`resolveBaseBranch()` は存在しない明示的base branchで、`createPullRequestContext()` は不正なbranch名で実際に例外を送出します。

修正方針: PR画像resourceの所有範囲をPR入力準備・branch/context構築まで拡張し、同じownerがこの失敗経路もcleanupしてください。

3. `[中] PRIMG-08-GITHUB-PR-FS-CLASSIFICATION` — U7未完了

`src/__tests__/github-pr.test.ts:812` の追加テストは `prepareGitHubPrTask()` を実行し、実装内の `mkdtempSync()` / `writeNewPrivateFileWithMode()` を通ります。しかし分類結果は `test:unit:parallel` で、filesystem分類には `pipelineExecution.test.ts` だけが登録されています。

独立実行結果:

```text
npm test -- src/__tests__/github-pr.test.ts
test:unit:parallel
44 passed
```

修正方針: この実filesystem経路も既存classifierのlight IT対象へ接続してください。

### 不変条件台帳

| 修正単位 | Family / 担当箇所 | 今回の判定 | 今回経路 | 累積 incomplete | 別経路再発 |
|---|---|---|---|---:|---|
| U1 | `F-PRIMG-FETCH-BOUNDARY` / `fetchPrReviewComments()` | 維持 | なし | 0 | 未確認 |
| U2 | `F-PRIMG-REFERENCE-ORDER` / parser・replacement | 維持 | なし | 0 | 未確認 |
| U3 | `F-PRIMG-REFERENCE-ALLOCATION` / image allocator | 維持 | なし | 0 | 未確認 |
| U4 | `F-PRIMG-FETCH-SCOPE` / URL分類境界 | 維持 | なし | 0 | 未確認 |
| U5 | `F-PRIMG-DOWNLOAD-API` / downloader | 維持 | なし | 0 | 未確認 |
| U6 | `F-PRIMG-TEMP-LIFECYCLE` / resource owner・cleanup | `incomplete`（今回1回目） | download中の明示終了、routing setup例外 | 1 | 未確認 |
| U7 | `F-PRIMG-TEST-WIRING` / test classifier | `incomplete`（今回1回目） | `github-pr.test.ts` → unit runner | 1 | 未確認 |

U6/U7はいずれも前回の `incomplete` がないため、同一検証内で複数経路が確認されても「別経路での再発」は未確認です。

修正報告に記載されたbuild、lint、unit、light IT、E2E、分類契約の品質ゲートは成功として確認しました。ただし、これらは上記の経路を閉じていないため、全体判定は `incomplete` です。