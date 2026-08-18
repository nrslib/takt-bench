問題は、Markdown AST の複数ノードにまたがる inline `<pre>` の状態が保持されず、その内部画像が添付対象になる点です。まず正本の task・policy・knowledge・最新レポートと現行コードを再読し、`coding` スキルの手順に従って修正と反例テストを行います。
正本と最新検証を照合した結果、未完了は `PR-LITERAL-03` のみで、原因は個々の HTML ノード内部の走査ではなく、同一 Markdown 断片内で `<pre>` の開始・終了状態を mdast ノード間に引き継げていないことです。既存の断片分離・全体重複排除・採番・3入口・保存経路は維持対象として再開し、修正対象は画像参照収集境界とその反例テストに限定します。
修正では、mdast が HTML と認識した部分だけを元オフセットのまま再構成し、断片全体を parse5 で一度解析するようにしました。これにより、別ノードになった `<pre>` 開始・画像・終了を同じ HTML 状態として扱えます。新しい HTML 画像／Markdown画像の反例は修正前に2件とも失敗し、修正後は既存34件を含む全36件が成功しました。これから再開した全義務の対象テストと品質ゲートを確認します。
対象テスト群は unit 154件、light IT 1件、heavy IT／分類契約43件が成功しました。一方、ビルドで配列添字の `undefined` 型と parse5 の nullable location が4箇所検出されました。実行時フォールバックは加えず、範囲内文字取得を `charAt()` にし、location は明示的に fail-fast する型修正を行います。lint は成功しています。
ビルドと対象36件は型修正後に成功しました。Companion に新規 `must_fix` が追加されましたが、内容は削除済みの `htmlImageReferences()` を前提に「inline pre テストが失敗する」とするもので、現行コードでは断片全体の parse5 解析へ置換済み、当該2反例も成功しているため適用しません。次に fast unit gate、light IT gate、mock E2E を完了まで実行します。
fast unit gate は4 shard合計6,072件、light IT gate は159 files・2,358件が成功しました。対象heavy ITと分類契約も先ほど43件成功済みです。残る実行ゲートは mock E2E と最終lint、続いて差分セルフスキャンです。
mock E2E は進行中です。shard 2 で既知の birpc `onTaskUpdate` noise が記録されましたが、runner の契約どおり全 shard の初回終了後に再測定されるため、現時点では成功扱いにせず最終終了コードまで監視しています。
mock E2E は shard 2 の初回 birpc noise を再測定し、再測定28件を含め終了コード0で完了しました。最終lintと `git diff --check` も成功し、今回追加した関数は全て参照済み、同一責務の重複実装なし、既存3入口はいずれも共通経路を利用していることを確認しました。完了宣言前の Companion 最終確認を行います。
## 作業結果

- 修正完了

## 変更内容と受入条件

- [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:70)
  - Markdown断片全体でHTML構造を解析し、mdastノードをまたぐinline `<pre>` の範囲を保持。
  - `<pre>` 内のHTML画像・Markdown画像を除外し、直後の通常画像のみ添付化。
  - 既存の断片分離、順序、重複排除、採番、cleanup、3入口、保存経路を維持。

- [prReviewAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/prReviewAttachments.test.ts:263)
  - inline `<pre>` 内のHTML画像と、nested inline `<pre>` 内のMarkdown画像を反例として追加。
  - 修正前は2件失敗、修正後は全36件成功。
  - 前回証拠の不足理由は、block `<pre>` のみで兄弟mdastノード経路を実行していなかった「未実行の反例」。

- `PR-FRAGMENT-01`～`PR-DATAFLOW-10`および`E2E-ENV-01`～`E2E-CLASSIFY-07`を再確認し、全て完了。
- Companionのinline `<pre>` 指摘は修正確認後に`resolved`。公開formatter指摘は確定計画どおり`wontfix_accepted`。

## 検証結果と証拠

- 対象テスト群: unit 154件、light IT 1件、heavy IT／分類契約43件成功
- `npm run build`: 成功
- `npm run lint`: 成功
- `npm test`: 4 shard、合計6,072件成功
- `npm run test:it`: 159 files、2,358件成功
- `npm run test:e2e:mock`: shard 2をbirpc noise後に再測定し、終了コード0
- `git diff --check`: 成功
- セルフスキャン: 未使用参照、依存方向、共通責務重複、3入口配線、空白エラーを確認し問題なし
- git commit／add／pushは実行していません。