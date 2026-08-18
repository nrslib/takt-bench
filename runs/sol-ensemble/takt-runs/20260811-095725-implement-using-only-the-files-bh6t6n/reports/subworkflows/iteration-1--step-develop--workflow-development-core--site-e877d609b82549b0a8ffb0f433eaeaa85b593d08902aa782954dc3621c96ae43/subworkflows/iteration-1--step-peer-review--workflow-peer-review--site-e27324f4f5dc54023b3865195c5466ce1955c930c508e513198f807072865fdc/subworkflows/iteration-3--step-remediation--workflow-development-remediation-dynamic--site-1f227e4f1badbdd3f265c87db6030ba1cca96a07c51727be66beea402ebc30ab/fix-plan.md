# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件 |
|-------------------|------|----------------------|-----------------------------|------|----------|
| `ARCH-NEW-src-features-tasks-attachments-L31` / `architecture-review.md` | `src/features/tasks/attachments.ts:31-55`、`src/features/tasks/prReviewAttachments.ts:564-575`、`src/features/tasks/retryTaskSpecAttachments.ts:52-58` | `image-attachment-index-precision` | PR・retryで重複placeholder／fileNameまたは`Infinity`が生成される → 任意長の番号を`Number`へ変換し最大値へ加算する → PR・retry共通の採番責務が、外部入力の任意精度と同一バッチ内予約を表現できていない | 構造 | 任意長番号を精度損失なく予約し、既存placeholder・既存fileName・同一バッチと衝突しない正の10進番号を新規画像ごとに割り当てる |
| `CODE-NEW-imageAttachmentIndex-L37` / `coding-review.md` | `src/features/tasks/attachments.ts:37`、`src/features/tasks/attachments.ts:126-134` | `image-attachment-index-precision` | 安全整数超過後に加算結果が進まず保存が失敗する → `number`による採番 → placeholderとfileNameの識別子名前空間を共通所有者が正確に管理していない | 構造 | PR・retryで異なる2画像が異なるplaceholder／fileNameとして保存され、destination重複エラーを起こさない |
| `AI-NEW-IMAGE-INDEX-PRECISION-31` / `ai-antipattern-review.md` | `src/features/tasks/attachments.ts:31-38`、`src/shared/utils/imageAttachmentReferences.ts:7,32-39` | `image-attachment-index-precision` | 400桁番号からvalidator非適合の値が生成される → 未検証の`Number`変換 → 任意長10進識別子を有限精度数値として扱う仮定が誤っている | 構造 | `Number.MAX_SAFE_INTEGER`、安全整数超過値、400桁値の各境界で`Infinity`・指数表記・重複を生成せず、公開attachment形式とcleanupを維持する |

## 欠陥 family の最終状態

| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `image-attachment-index-precision` | `context/task/order.md`のPR画像保存・既存attachment形式・pipeline対応要求、および現在のレビュー裁定の受入条件 | 既存の`[Image #N]`と`attachments/image-N.ext`を任意桁の10進文字列として損失なく予約する。割当値は正の通常10進表記である。既存placeholder、既存fileName、同一バッチ内の先行割当と重複しない。同じPR URLは従来どおり同一placeholderを再利用し、異なる画像は異なる番号を得る。extension、`TaskAttachment`形式、保存・検証・cleanupを維持する。`Infinity`と指数表記を生成しない | `src/features/tasks/attachments.ts`に、本文から予約済み番号集合を構築し、割当ごとに未使用番号を予約する共通assignerを置く。入力番号は数値変換せず文字列として保持し、生成候補だけを正確に順送りする。PR・retryはassignerを1処理につき1個生成して共有する | `takt add --pr` → `preparePrReviewAttachments` → `saveTaskFile`、対話CLI `--pr` → `resolvePrInput`、pipeline `--pr` → `resolveTaskContent` → `prepareTaskSpecDirectory`、retry／再開／追加指示 → `prepareRetryTaskSpecWithAttachments` → `prepareTaskSpecDirectory`。検証境界は`validateStoredImageAttachment`、保存副作用は`promoteTaskAttachments`、失敗経路は重複destination・不正placeholder、後片付けはPR storeとprepared task specのcleanup | 通常例: 既存`#1`の次が`#2`。隙間例: 既存`#1`と`image-3.png`に対する2画像が`#2`と`#4`。境界値: `9007199254740991`、`9007199254740992`、400桁値。旧失敗例: 同じ`9007199254740992`の反復、`Infinity`、同一destination。変更後はすべて低い未使用番号へ割り当てて保存成功 | `prReviewAttachments.ts`と`retryTaskSpecAttachments.ts`を共通assignerへ移行する。`resolveMaxImageAttachmentIndex`、公開された単発`assignImageAttachmentIndex`、各利用側の`+ 1`／`+= 1`経路は同じ変更で削除する。互換alias、fallback、migrationは追加しない |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `image-attachment-index-precision` | 境界変更 | なし | `src/features/tasks/attachments.ts:31-55` | 任意長番号を`Number`へ変換しない共通assignerへ置換する。予約済み集合がplaceholderとfileNameの双方を含み、割当直後に同一集合へ追加されることをコード照合する |
| 2 | `image-attachment-index-precision` | 利用側移行 | 1 | `src/features/tasks/prReviewAttachments.ts:560-577` | PR処理ごとにassignerを1個生成し、異なるURLの保存済み画像へ順次適用する。同一URL再利用、download順、例外時cleanupが既存どおりである |
| 3 | `image-attachment-index-precision` | 利用側移行 | 1 | `src/features/tasks/retryTaskSpecAttachments.ts:47-62` | retry処理ごとにassignerを1個生成し、全添付へ適用する。元placeholderから新placeholderへの対応、既存attachmentコピー、prepared spec生成を維持する |
| 4 | `image-attachment-index-precision` | 削除 | 2、3 | `src/features/tasks/attachments.ts`、PR・retryのimportと局所変数 | 旧最大値helper、旧単発export、手動加算が残らず、全参照が新しい共通責務へ移行していることを`rg`で確認する |
| 5 | `image-attachment-index-precision` | 回帰テスト | 2、3、4 | `src/__tests__/prReviewAttachments.test.ts`、`src/__tests__/retryTaskSpecAttachments.test.ts` | PR・retry双方で、安全整数上限、安全整数超過、400桁値、既存`#1`、既存`image-3.png`、異なる2画像を組み合わせ、新規`#2`・`#4`と対応するfileNameを観測する。retryでは実ファイル内容と保存成功、両経路でcleanupを確認する |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `image-attachment-index-precision` | `order.md`、裁定の修正境界、契約置換ポリシー、コーディングポリシーのDRY・状態正規化・Fail Fast、テストポリシーの直接経路・境界値・IT分類 | 任意長入力は10進文字列の集合として保持し、共通assignerが低い未使用の正番号を割り当てる方式を採用する。最大値を`Number`で管理する方式は精度欠陥を残すため不採用。最大値だけを`BigInt`化する方式は400桁のplaceholder／fileNameを生成して保存成功条件を満たさないため不採用。PR・retry別々の修正は同じ不変条件を重複させるため不採用 | PR unit testではdownload/storeを決定的に差し替え、異なる2 URLのtask contentと`TaskAttachment[]`を観測する。retry light ITでは一時task directoryに既存`image-1.png`・`image-3.png`を置き、2画像の保存先・内容・order.md・cleanupを観測する。外部資格情報やネットワークは不要 | 新しい公開形式、互換経路、fallback、migrationを追加せず、既存の`TaskAttachment`、validator、保存・cleanup境界を維持する。変更理由が同一のPR・retryだけを共通責務へ移行し、Markdown解析、download、認証、MIME、magic bytes、サイズ制限には触れない | `npm test -- src/__tests__/prReviewAttachments.test.ts src/__tests__/retryTaskSpecAttachments.test.ts`、`npm test -- src/__tests__/releaseVerificationWiring.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、`git diff --check` |

## 再計画事項

- なし。裁定済みfamilyは1件で、要求・現行契約・修正方法に競合はない。
- 環境要因により実証できない完了条件や後続確認はない。
- `false_positive`、`overreach`、`out_of_scope`、`no_issue_after_verification`、過去のresolved指摘、および裁定外のMarkdown解析・download・認証・画像検証・周辺リファクタリングは実装対象に含めない。