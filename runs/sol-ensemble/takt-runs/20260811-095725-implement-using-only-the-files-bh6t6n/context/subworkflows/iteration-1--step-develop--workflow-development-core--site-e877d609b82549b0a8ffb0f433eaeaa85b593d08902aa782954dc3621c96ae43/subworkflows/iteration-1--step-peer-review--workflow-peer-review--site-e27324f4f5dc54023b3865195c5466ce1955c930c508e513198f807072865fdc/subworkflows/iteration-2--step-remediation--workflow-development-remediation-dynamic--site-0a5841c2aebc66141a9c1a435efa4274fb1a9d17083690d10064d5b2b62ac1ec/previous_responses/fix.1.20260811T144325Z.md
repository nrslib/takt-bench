問題は、PR本文のMarkdown literal判定が各行で本文先頭を再走査し、大規模な画像なし本文で非線形に遅くなる点です。`coding` スキルを適用し、まず正本の仕様・ポリシー・ナレッジ・直近レポートと現在コードを再照合してから、前方状態管理への局所置換と回帰テスト追加を行います。
`coding` スキルにより、実装前に Coder／AIアンチパターン／Architecture の正本も確認します。これらは実装品質の判断基準としてのみ使い、要件は指定された `context/task` と今回の確定修正計画に限定します。
照合結果、根本原因は現行コードの `findInheritedListIndent()` にあり、3入口はすべて同じ `preparePrReviewAttachments()` を通るため利用側変更は不要です。既存のMarkdown判定を保つため、各物理行について「直前行・blockquote深度・有効なlist indent候補・paragraph判定に必要な値」を一度だけ前方計算し、literal範囲検出へ解決済み状態を渡す形に置換します。
本体と回帰テストの編集が完了しました。旧prefix再走査と、それに伴い不要になった `lineBefore()`／全文・start引数を削除し、30,000行の画像なし本文を3秒のテストローカル上限で検証するケースを追加しています。ここでCompanion受信箱と静的差分を確認してから、対象テストを実行します。
対象テスト29件は成功しましたが、`npm run build` で配列インデックスの `undefined` 可能性が2箇所検出されました。状態配列を非空確認後に直接添字参照している箇所なので、型安全な取得に直してから対象テストとビルドを再実行します。
型エラー修正後、対象29テスト・ビルド・lintはいずれも成功しました。次に高速unit全体、軽量integration、mock E2Eを重複なく順番に実行します。
必須ゲートは、unit全体、軽量integration（159ファイル・2,355件）、mock E2Eまで成功しました。最後に今回差分だけを対象として、未使用化・依存方向・同一責務の重複・旧prefix走査残存を機械的に再走査し、Companion受信箱の新規レコードも再確認します。
Companionに2件の `must_fix` が届きました。独立検証すると、配列変更の指摘は「関数内で新規作成し外部公開しない局所蓄積コレクションは変更可」という有効ポリシーの明示例外に該当します。一方、既存本文の `[Image #1]` と新規画像が衝突する指摘は、現行コード上で再現可能か、ストア所有者と全利用経路を確認します。
既存プレースホルダー衝突は実コードで成立し、元のPR画像attachment契約にも直接影響するため対応します。既にretry経路に同じ最大画像番号の解決責務があるので、`attachments.ts` の共通所有者へ移し、PR経路でも既存番号の次からplaceholderとfileNameを割り当てます。形式自体は `[Image #N]`／`image-N.ext` のまま維持します。
Companionで確認された衝突反例も修正し、PR対象30件と既存retry attachment 3件、ビルド、lintが成功しました。追加編集で先ほどの全体証拠が無効になったため、unit全体・軽量integration・mock E2Eを同じ順序で再取得します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:429)
  - 行ごとの本文prefix再分割・後方走査を、前方計算したMarkdown行状態へ置換。
  - blockquote、list indent、paragraph、fenced／indented codeの既存判定を維持。
  - 旧 `findInheritedListIndent()` と `lineBefore()` を削除。
- [prReviewAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/prReviewAttachments.test.ts:569)
  - 30,000行の画像なし本文が3秒以内に無変更・添付なし・download/saveなしで完了する回帰テストを追加。
  - 既存の `[Image #1]` と新規画像が衝突しない反例テストも追加。
- [attachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/attachments.ts:31)
  - 画像番号解決・再採番を共通所有者へ集約し、PR・retry経路へ配線。
- セルフスキャン：旧走査残存、未使用コード、依存方向、重複責務を検索し、問題なし。Companionの3件もすべて解消済み判定。

## 検証結果と証拠

- `npm test -- src/__tests__/prReviewAttachments.test.ts src/__tests__/retryTaskSpecAttachments.test.ts`
  - 30件＋3件成功
- `npm run build`：成功
- `npm run lint`：成功
- `npm test`：成功
- `HOME=/tmp/takt-bench-v3-home npm run test:it`：成功
- `npm run test:e2e:mock`：成功
- `git diff --check`：成功
- smoke E2Eは、CLI起動・workflow実行・provider・設定・sandbox・runtime preparationの変更ではないため対象外です。