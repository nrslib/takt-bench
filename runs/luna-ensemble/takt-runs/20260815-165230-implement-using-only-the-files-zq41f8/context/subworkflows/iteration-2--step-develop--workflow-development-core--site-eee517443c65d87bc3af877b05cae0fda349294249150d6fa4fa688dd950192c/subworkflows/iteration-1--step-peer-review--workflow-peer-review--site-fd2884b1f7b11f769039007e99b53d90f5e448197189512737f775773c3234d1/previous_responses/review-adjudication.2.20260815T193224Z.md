問題を要約すると、提出済みレビュー指摘だけを対象に、指定された要求・ポリシー・実行履歴・現在コードを照合し、修正対象 family と非修正対象を確定します。編集・コミット・ステージングは行いません。

まず正本の Knowledge/Policy、タスク仕様、同一 peer-review の最新レビューと再発台帳候補を特定し、必要なファイルを EOF まで確認します。
Report Directory 直下には現在の `review-resolution.md` と、公開済み remediation が1件あります。ポリシー上、再発台帳は直下の `iteration-1--step-remediation--.../fix-verification.md` を候補にし、`.takt-report-internal` は除外します。並行して、初回レビューと reviewers の公開レポートを提出済み finding の根拠として読みます。
Knowledge と裁定ポリシーは EOF まで確認しました。現行の reviewers では、前段7 familyの解消確認に加え、`coding-review.md` と `testing-review.md` に、本文整形後の順序および逆順混在ケースに関する follow-up が提出されています。これらが同一 family へ合流するか、現在コードで反証できるかを、各レポートの全文と実コードで確認します。
現在コードを再確認したところ、以下を確認しました。

- `F-PRIMG-REFERENCE-ORDER`: `pr-images.ts:49-54` は body→comments→reviews で採番しますが、`formatPrReviewAsTask()` は reviews の各区分を先に出し、`format.ts:248-253` で comments を後に出します。通常コメント画像を #1、review画像を #2 とした入力では、最終 task 本文の表示順が逆転するため、`PRIMG-09-FORMATTED-ORDER` は実在します。
- 逆順混在の parser は `pr-images.ts:273-282` で match index sort を行っており、実装自体に逆順の欠陥は確認できません。これはテスト網羅要求として別途権限があるかを、品質要件と family 閉鎖条件に照合します。
- pipeline の `false`/例外経路は `execute.ts:76-107` の `try/finally` で cleanup に到達する実装です。未確認テスト経路としては有効ですが、実装欠陥と同一視しないよう、accepted family の閉鎖に必要な検証として裁定します。
裁定の境界を確定しました。既存7 familyは維持し、新規 family は作りません。`PRIMG-09-FORMATTED-ORDER` は既存の参照順 family に合流する実装欠陥、2件の `TEST-FOLLOWUP` はそれぞれ既存 family の未確認経路・受入条件を閉じるための修正対象として扱います。逆順テストは、修正計画に明記された「混在記法の双方向」条件と、今回のテスト実体の不足が一致するため、単なる一般的テスト提案としては棄却しません。
裁定結果は「修正対象あり」です。既存7 familyは維持し、新規familyは作成しません。

| Finding | 裁定 | 統合先 | 根拠 |
|---|---|---|---|
| `PRIMG-09-FORMATTED-ORDER` | `actionable` | `F-PRIMG-REFERENCE-ORDER` | `pr-images.ts:49-54` は comments→reviews 順で採番する一方、`src/infra/git/format.ts:242-253` は reviews→comments 順で本文を出力するため、本文参照と添付番号が逆転する |
| `TEST-FOLLOWUP-PRIMG-01-order` | `actionable` | `F-PRIMG-REFERENCE-ORDER` | 修正計画の双方向混在テスト条件が未充足。現行実装の `match.index` ソート自体は正しいが、`github-pr-images.test.ts:70-86` はHTML→Markdownのみ |
| `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` | `actionable` | `F-PRIMG-TEMP-LIFECYCLE` | `execute.ts:76-107` は `false`/例外でも cleanup へ到達するが、PR画像付きpipeline失敗経路の実テストが未確認 |

修正境界は、参照順序の統一と双方向テスト、pipeline失敗時のcleanup検証までです。`SIGKILL`対応、一般temp janitor、追加のbytes検証、無関係なリファクタリングは対象外です。

再発台帳は、Report Directory直下で唯一かつ最大の remediation である [fix-verification.md](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/.takt/runs/20260815-165230-implement-using-only-the-files-zq41f8/reports/subworkflows/iteration-2--step-develop--workflow-development-core--site-eee517443c65d87bc3af877b05cae0fda349294249150d6fa4fa688dd950192c/subworkflows/iteration-1--step-peer-review--workflow-peer-review--site-fd2884b1f7b11f769039007e99b53d90f5e448197189512737f775773c3234d1/subworkflows/iteration-1--step-remediation--workflow-development-remediation-dynamic--site-d9addbd19e4443d2c14133ce9f102ca3b49843833a159a516825cd1ee29a7a86/fix-verification.md:11) から、7行・13項目を無変更で引き継ぎます。既存 [review-resolution.md](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/.takt/runs/20260815-165230-implement-using-only-the-files-zq41f8/reports/subworkflows/iteration-2--step-develop--workflow-development-core--site-eee517443c65d87bc3af877b05cae0fda349294249150d6fa4fa688dd950192c/subworkflows/iteration-1--step-peer-review--workflow-peer-review--site-fd2884b1f7b11f769039007e99b53d90f5e448197189512737f775773c3234d1/review-resolution.md:33) の「先行 remediation なし」は使用しません。

編集・コミット・ステージングは行っていません。