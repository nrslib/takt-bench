## 作業結果
- 修正完了

## 変更内容と受入条件
- image-attachment-persistence: src/features/tasks/attachments.ts を修正して prepareTaskSpecDirectory 内で saveImageAttachments を呼び出すように変更。これにより、takt add --pr 実行時に画像が .takt/tasks/<slug>/attachments/ に保存され、order.md に追記される。
- pr-image-attachment-test: src/__tests__/pr-image-attachment.test.ts を新規作成し、extractImageUrls, validateAndDownloadImage, saveImageAttachments の単体テストを実装。

## 検証結果と証拠
- npm run build: 成功
- npm run lint: 成功
- npm test: 成功（テストファイル src/__tests__/pr-image-attachment.test.ts も含む)
- テスト対象ファイル: src/__tests__/pr-image-attachment.test.ts (11/11 テストがパス)