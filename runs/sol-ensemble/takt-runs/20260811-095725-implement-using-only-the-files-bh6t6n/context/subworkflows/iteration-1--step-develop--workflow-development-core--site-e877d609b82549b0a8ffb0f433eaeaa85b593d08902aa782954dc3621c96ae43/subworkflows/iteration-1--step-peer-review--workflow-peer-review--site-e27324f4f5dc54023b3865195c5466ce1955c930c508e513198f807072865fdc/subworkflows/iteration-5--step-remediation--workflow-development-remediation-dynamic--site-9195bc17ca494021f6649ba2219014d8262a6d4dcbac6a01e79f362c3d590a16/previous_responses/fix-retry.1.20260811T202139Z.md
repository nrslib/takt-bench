問題は2点です。`<pre>`配下の実HTML画像除外と、conversation commentの既存文字列出力の復元です。まず正本の`order.md`、全文のPolicy/Knowledge、最新レポート、現在の差分を再確認し、`coding`スキルの手順に従って対象実装と反例テストを修正します。実装後・テスト前・完了直前にはCompanion受信箱も確認します。
現行コードで2件とも再確認できました。`htmlImageReferences()`は`pre`要素でも子孫走査を続け、conversation commentはreview用フォーマッターを再利用してFile／URL行を追加しています。前回の証拠不足はそれぞれ「未実行の反例」と「弱い部分一致assertion」です。修正では、HTML走査の`pre`境界を閉じ、conversation専用の既存文字列形式を断片情報付きで生成します。
実装と反例テストを追加し、テスト前のCompanion受信箱に新規指摘がないことを確認しました。まず`git-format`と`prReviewAttachments`を対象実行し、次に差し戻しで再開した同一familyのdataflow・3入口・分類契約を再確認します。
対象テストは成功しました。新しい反例を含むunit 60件、同一familyのdataflow・3入口・分類契約126件が終了コード0です。これにより`PR-LITERAL-03`と`PR-PUBLIC-09`を再開したうえで、断片分離・順序・重複排除・採番・cleanup・3入口・保存経路も同じ検証経路から再確認できました。続けて全体ゲートを実行します。
ビルド、lint、fast unit gateも成功しました。unit gateは4 shardすべて終了コード0（合計6,070 tests）です。続いてlight IT gateとmock E2Eを順に完了させます。
light ITは159 files・2,358 testsで成功しました。mock E2Eは現在4 shardを実行中で、ここまで失敗はありません。完了後に今回差分の未使用参照・依存方向・共通責務を機械的に走査します。
mock E2Eは初回shard 2のbirpc通信ノイズを検出して同shardを自動再測定し、最終的に終了コード0となりました。セルフスキャンでは、今回追加したconversation専用関数とreview用関数に「author/bodyの断片化」という同一責務の重複が見つかったため、共通の本文フォーマッターへ畳み込みます。この整理後、影響テストとbuild/lintを再実行します。
最終コードで対象unit・light/heavy分類テスト185件、build、lint、fast unit 6,070件がすべて成功しました。差分セルフスキャンでは未使用参照・逆向き依存・同一責務の残存重複はありません。最後にCompanion受信箱と差分整合性を再確認します。なお受信済みの旧wrapper削除指摘は、確定計画が`formatPrReviewAsTask()`の既存公開文字列契約を明示的に維持すると定め、変更前HEADにも同APIが存在するため、今回も適用対象外です。
## 作業結果

- 修正完了

## 変更内容と受入条件

- [`prReviewAttachments.ts`](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:66)
  - `<pre>`要素の子孫走査を停止し、配下のHTML `<img>`を画像として収集しないよう修正。
  - `<pre>`直後の通常画像は従来どおり検出・置換。
- [`format.ts`](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/git/format.ts:163)
  - conversation commentは従来どおりauthorとbodyだけを出力。
  - `path`・`line`・`url`はreview commentだけに出力。
  - 本文断片位置の生成は共通化し、画像解析境界を維持。
- 回帰テストを追加。
  - `<pre>`内HTML画像と直後の通常画像の対照テスト
  - metadata付きconversation commentの出力完全一致テスト
- 差し戻しで再開した`PR-FRAGMENT-01`～`PR-DATAFLOW-10`を、断片解析、順序、重複排除、採番、cleanup、3入口、保存経路まで再確認済み。
- Companionのwrapper削除指摘は、確定計画が`formatPrReviewAsTask()`の公開文字列契約維持を明示し、変更前HEADにも存在するため適用対象外と判定。

## 検証結果と証拠

- 対象unit・light/heavy分類テスト: 185件成功
- `npm run build`: 成功
- `npm run lint`: 成功
- `npm test`: 4 shard、合計6,070件成功
- `npm run test:it`: 159 files・2,358件成功
- `npm run test:e2e:mock`: shard 2のbirpc noiseを再測定後、終了コード0
- `git diff --check`: 成功
- セルフスキャン: 未使用参照、依存方向違反、同一責務の重複、旧直接解析経路の残存なし
- `git add`、commit、pushは実行していません。