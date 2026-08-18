問題を、裁定済みの2つの actionable family に限定した実装計画の作成として整理します。まず Knowledge／Policy の正本を全文確認し、その後 task ディレクトリ、Report Directory の現在の裁定・採用された reviewer 根拠・現行コードとテストを照合します。このステップでは編集しません。
正本の確認が完了しました。適用する制約は、既存の画像抽出・表示契約を最小差分で揃えること、pipeline の実リソース終端を観測するテストを追加すること、変更対象外の取得・認証・検証・cleanup 実装を保持することです。レビュー一般論から新しい family を追加することは明示的に禁止されています。次に、現在の裁定と採用された3 finding の一次レポートを特定します。
現行コードで根本原因を確認しました。画像抽出は `body → comments → reviews`、最終 formatter は `body → review の分類済み各節 → comments` で、表示順の定義が二重化しています。一方、pipeline は workflow 実行を囲む入れ子の `finally` で task spec と画像 resource を解放しており、こちらは実装欠陥ではなく false／例外 terminal の回帰証拠不足です。これら以外の原因候補は、現在の parser 内位置ソートと cleanup 実装から否定できます。
修正計画を2 family、3 actionable finding に限定して確定しました。ソース編集・テスト実行は行っていません。

## 確認した原因

- `F-PRIMG-REFERENCE-ORDER` は構造問題です。[pr-images.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:49) が `body → comments → reviews`、[format.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/git/format.ts:197) が `body → 分類済みreview節 → comments` と、表示順を二重定義していることが根本原因です。
- Markdown／HTMLの同一本文内順序は、match位置によるソートで既に保証されています。未検証なのは Markdown→HTML の反対方向です。
- `F-PRIMG-TEMP-LIFECYCLE` は局所的な検証不足です。[execute.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/features/pipeline/execute.ts:76) には task spec と画像resourceを解放する入れ子の `finally` があり、実装修正ではなく false／例外経路の観測テストが必要です。

## 実装単位1: `F-PRIMG-REFERENCE-ORDER`

不変条件名は「画像参照出現順整合」、担当箇所は `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` のまま維持します。

対象 finding:

- actionable: `PRIMG-09-FORMATTED-ORDER`
- actionable: `TEST-FOLLOWUP-PRIMG-01-order`
- duplicate: `ARCH-PRIMG-004`
- duplicate: `CODE-NEW-src-infra-github-pr-images.ts-L184`
- duplicate: `TEST-NEW-PRIMG-01-order`

実装方針:

1. [format.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/git/format.ts:177) に、review分類と節順を一度だけ定義する内部関数を抽出します。
2. formatterと画像抽出の双方がその定義を直接利用します。`src/infra/git/index.ts`からは公開せず、公開APIを増やしません。
3. `pr-images.ts`の旧 `body → comments → reviews` 走査を削除し、`body → formatter順のreview節 → conversation comments` に置換します。
4. formatterの既存の節表示順、URL制限、重複URL排除、既存placeholder回避、非画像リンク処理は変更しません。

経路は、PR metadata → 共通節順 → 抽出・採番 → 本文置換 → formatter → `buildTaskOrderContent()` → add／routing／pipeline → `order.md`・添付manifestまでを一単位で閉じます。

[github-pr-images.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/github-pr-images.test.ts:26) では次を反証可能にします。

- `![first](url1)` → `<img src="url2">` が `[Image #1]` → `[Image #2]` になる。
- 既存のHTML→Markdownケースも維持する。
- review画像とconversation comment画像を最終formatterへ通し、本文、filename、添付一覧が同じ順になる。
- review種別が入力配列内で交差していても、formatterの節順と採番順が一致する。

## 実装単位2: `F-PRIMG-TEMP-LIFECYCLE`

不変条件名は「PR画像一時資源終端解放」、担当箇所は `downloadGitHubPrImages()` / resource cleanup のまま維持します。

対象 finding:

- actionable: `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup`
- duplicate: `ARCH-PRIMG-001`
- duplicate: `ARCH-PRIMG-003`
- duplicate: `CODE-NEW-src-infra-github-pr-images.ts-L311`
- duplicate: `PRIMG-06-PROCESS-EXIT-CLEANUP`
- duplicate: `PRIMG-06-TEMP-DIRECTORY-CLEANUP`
- duplicate: `SEC-PRIMG-002`
- duplicate: `TEST-NEW-PRIMG-06-cleanup`

[pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/pipelineExecution.test.ts:1325) に、実filesystemを使う次の2ケースを追加します。

1. PR画像付きworkflowが `false` を返すケース  
   終了コード、cleanup 1回、画像file・画像親directory・task spec・空の `.takt/tasks` 親directoryの消滅を確認します。
2. PR画像付きworkflowが例外を投げるケース  
   同じ例外の伝播と、同一のcleanup観測点を確認します。

本番の `finally`、resource handle、process-exit cleanupは変更しません。成功、cancel、routing失敗、明示終了の既存テストも保持します。

## 台帳と境界

同一remediation内に先行 `fix-verification.md` はないため、現在の `review-resolution.md` を引き継ぎ元とします。U1〜U7の全7行・全13項目は無変更で転記します。共通値は、今回／前回検証なし、前回／今回経路なし、`判定できない（初回）`、累積0、別経路再発「未確認」、記録「完全」です。

対象外として維持するもの:

- `TEST-NEW-PRIMG-02-download-content` の追加bytes・途中失敗テスト
- Markdown parser全面刷新
- 認証、取得scope、payload validatorの再設計
- SIGKILL、一般temp janitor
- private GitHub E2E
- 別provider、非画像リンク、無関係なreview表示順

現在の環境で実証不能な actionable 項目や未解決の前提はありません。実装順は、共通表示順の導入と利用側移行、順序回帰テスト、pipeline失敗terminalテストの順とします。