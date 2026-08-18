修正計画の2つの契約 family について、修正報告を正解表にせず、正本・最新レビュー・差分・実コード・対象テストを再確認します。まず指定された Knowledge／Policy と task 配下、Report Directory の履歴を末尾まで読み、その後に原子的な完了義務へ分解して検証します。ソース編集は行いません。
正本とポリシーの読了が完了しました。今回適用する基準は、断片境界を共有する3入口の契約整合、旧直接解析経路の削除、既存文字列formatter契約の保存、実child process境界の環境伝播・cleanup・再測定共通化、および変更heavy ITの実行・分類です。その他のTAKT一般領域は今回の変更契約に直接関係しないため、finding 判定には使いません。続いてレビュー履歴と現差分を照合します。
差分照合では、断片の順序・重複排除・採番・3入口移行・cleanupは実コード上で成立しています。一方、計画が維持対象とした「`<pre>`内は画像扱いしない」と「既存formatterの同一文字列出力」に反する反例を確認しました。対象テストを再実行し、既存テストがこの2点を検出できないことも含めて証拠化します。
対象テストはすべて終了コード0でした。E2E attempt familyは、実childでのcwd・隔離env、attemptごとの一意root、成功・spawn失敗cleanup、再測定、heavy分類まで独立に確認できています。PR断片familyでは、既存テストが成功しても検出できない2点が残っているため、最終的な行番号と反例を再確認しています。
## 判定: `incomplete`

修正計画は有効ですが、`pr-review-markdown-fragment-isolation` に2件の未完了義務があります。

1. `PR-LITERAL-03`: `<pre>` 内のHTML画像が除外されない

[prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:65) はHTMLツリー内の全`img`を再帰収集し、`pre`祖先を判定していません。

`<pre><img src="https://github.com/user-attachments/assets/..."></pre>`を解析すると、parse5が`pre`配下の`img`を返し、現在の実装は画像参照として収集します。計画の「`pre`内は画像扱いしない」に違反します。

既存テストは [prReviewAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/prReviewAttachments.test.ts:223) で`<pre>`内のMarkdown記法だけを検証しており、実際のHTML `<img>`を含まないため不足を検出できません。

修正では`pre`配下の走査を除外し、`pre`内HTML画像と、その直後の通常画像を対にした回帰テストが必要です。

2. `PR-PUBLIC-09`: 既存formatterの文字列契約が変化している

[format.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/git/format.ts:295) はconversation commentにも`formatPrReviewComment()`を使用するようになりました。変更前はauthorとbodyだけでしたが、現在は有効な`PrReviewComment`に`path`や`url`があると次の行を追加します。

```text
File: src/a.ts, Line: 4
URL: https://example.test/comment
```

これは計画が維持するとした`formatPrReviewAsTask(): string`の既存整形結果と一致しません。既存formatterテストはconversation commentに`path`／`url`を設定せず、部分一致のみを検証しているため検出できません。

conversation commentの既存文字列を変えずに本文範囲だけを記録し、変更前出力との完全一致テストを追加する必要があります。

`e2e-runner-attempt-boundary`はverifiedです。実childへのcwd・隔離env伝播、attempt分離、成功・spawn失敗cleanup、再測定、heavy分類を確認しました。

実行結果:

- PR対象unit 58件、light IT 1件: 成功
- 3入口テスト: unit 85件、heavy IT 21件成功
- runner unit 7件、heavy IT／分類契約22件: 成功
- `git diff --check`: 成功

環境要因による未確認事項はありません。ソースは編集していません。