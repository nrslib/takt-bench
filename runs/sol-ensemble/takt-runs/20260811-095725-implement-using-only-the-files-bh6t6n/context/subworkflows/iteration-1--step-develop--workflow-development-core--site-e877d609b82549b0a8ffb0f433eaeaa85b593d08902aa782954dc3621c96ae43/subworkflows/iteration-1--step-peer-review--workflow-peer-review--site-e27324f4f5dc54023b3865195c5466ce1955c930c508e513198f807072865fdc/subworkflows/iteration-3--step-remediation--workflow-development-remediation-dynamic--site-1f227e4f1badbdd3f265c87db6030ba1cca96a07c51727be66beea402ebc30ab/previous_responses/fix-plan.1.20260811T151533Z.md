問題を「任意長の画像番号に対する一意採番の修正計画」に限定し、まず指定された Knowledge／Policy、主仕様、現在の裁定レポート、現行コードとテストを一次情報として照合します。このステップでは編集せず、採用済み family 以外は計画へ含めません。
指定された現在の remediation レポートディレクトリ自体は空で、先行ステップの一次履歴は直上の peer-review レポート配下にあります。裁定本文を正本として維持しつつ、採用済み3指摘の記録だけを ID 検索で特定し、原因・再現条件・受入条件の補助証拠として確認します。履歴上の `persists`／`reopened` は今回の裁定にないため、過去指摘から対象を追加しません。
根本原因は局所的な `Number` 変換ですが、PR と retry が同じ採番契約を共有するため、分類は「共通責務に関わる構造問題」です。400桁値をそのまま最大値として加算すると OS のファイル名上限にも達し得るため、最大値方式は採らず、既存番号を10進文字列の集合として保持し、低い未使用の正番号を順次予約する共通 assigner が最小かつ受入条件に一致します。これなら任意長値を数値化せず、同一バッチ内の予約も一箇所で保証できます。
## 修正計画

対象は裁定済み family `image-attachment-index-precision` の1件のみです。

対応する指摘:

- `ARCH-NEW-src-features-tasks-attachments-L31` — actionable
- `CODE-NEW-imageAttachmentIndex-L37` — duplicate
- `AI-NEW-IMAGE-INDEX-PRECISION-31` — duplicate

### 根本原因

[src/features/tasks/attachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/attachments.ts:31) が任意長の番号を `Number` に変換し、PR・retry双方が最大値へ加算しています。

確認結果:

- `9007199254740992 + 1` は値が進まない
- 400桁値は `Infinity` になる
- PRとretry以外に同じ変換・採番実装は存在しない
- 問題は共通採番責務に属する構造問題で、環境依存の未確認事項ではない
- 400桁の最大値をそのまま次のfileNameへ使う方式は、現在のファイル名上限255文字にも適合しない

### 修正単位

1. 共通採番責務を置換する

   [attachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/attachments.ts:31) で、既存の最大値取得と `number` 採番を、状態を所有する共通 assigner に置換します。

   - `[Image #N]` と `attachments/image-N.ext` の番号を変換せず10進文字列として予約する
   - `1` から未使用番号を探索する
   - 1件割り当てるたび同じ集合へ予約し、同一バッチ内の重複も防ぐ
   - 生成値は正の通常10進表記だけとする
   - extension検証、attachmentのコピー形式、placeholder／fileName形式は維持する
   - 旧 `resolveMaxImageAttachmentIndex` と外部向け `assignImageAttachmentIndex`、各利用側の手動加算を残さない
   - 互換alias、fallback、migrationは追加しない

2. 全利用側を同じ採番責務へ移行する

   - [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:560)
     - PR本文からassignerを一度生成する
     - URLごとに初回保存した画像へassignerを適用する
     - 同一URLのplaceholder再利用、download順、失敗時cleanupを維持する

   - [retryTaskSpecAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/retryTaskSpecAttachments.ts:47)
     - base `order.md` からassignerを一度生成する
     - retry添付を順に割り当て、元placeholderから新placeholderへの置換を維持する
     - 既存attachmentコピーとprepared spec cleanupを変更しない

### 回帰テスト

[prReviewAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/prReviewAttachments.test.ts:112) と [retryTaskSpecAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/retryTaskSpecAttachments.test.ts:38) に、PR・retry双方の直接回帰テストを追加します。

各経路で以下をパラメータ化して検証します。

- `Number.MAX_SAFE_INTEGER`
- `Number.MAX_SAFE_INTEGER + 1` の正確な10進文字列
- 400桁の10進文字列
- 既存placeholder `#1`
- 既存fileName `image-3.png`
- 異なる2画像

期待値は新規画像が `#2` と `#4`、fileNameが `image-2.png` と `image-4.png` になることです。これにより、既存番号の隙間、同一バッチ予約、placeholder／fileName双方の衝突を同時に反証できます。

retryでは実ファイルを保存して内容の取り違えやdestination重複がないこと、PRでは異なるURLが各1回ダウンロードされることを確認します。既存の通常範囲、同一URL再利用、attachment形式、成功・失敗時cleanupテストは維持します。

### 品質ゲート

実装後は次を実行します。

1. `npm test -- src/__tests__/prReviewAttachments.test.ts src/__tests__/retryTaskSpecAttachments.test.ts`
2. `npm test -- src/__tests__/releaseVerificationWiring.test.ts`
3. `npm run build`
4. `npm run lint`
5. `npm test`
6. `npm run test:it`
7. `git diff --check`

外部GitHub通信やprivate repository接続は今回の裁定境界外であり、決定的なmockとローカルfilesystemで全受入条件を検証できます。後続環境確認はありません。Markdown解析、download・認証、MIME・magic bytes・サイズ制限、公開形式、周辺リファクタリングは変更しません。