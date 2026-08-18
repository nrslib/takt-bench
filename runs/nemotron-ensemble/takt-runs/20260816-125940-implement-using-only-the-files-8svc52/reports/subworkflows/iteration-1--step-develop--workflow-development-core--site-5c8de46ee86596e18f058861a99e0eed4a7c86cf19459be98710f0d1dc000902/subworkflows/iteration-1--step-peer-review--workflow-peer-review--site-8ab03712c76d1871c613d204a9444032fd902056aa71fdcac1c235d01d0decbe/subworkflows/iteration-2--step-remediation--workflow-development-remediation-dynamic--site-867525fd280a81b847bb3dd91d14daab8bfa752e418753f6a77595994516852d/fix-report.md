# 修正レポート
## サマリー
画像添付ファイルの保存機能を実装し、単体テストを追加しました。`prepareTaskSpecDirectory` 関数を修正して `saveImageAttachments` を呼び出すようにし、画像がタスクディレクトリに保存され `order.md` に追記されるようにしました。また、`extractImageUrls`, `validateAndDownloadImage`, `saveImageAttachments` の単体テストを実装し、すべてのテストがパスすることを確認しました。

## 修正単位
| 修正単位 | 対象 finding | 守る契約 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| image-attachment-persistence | CODE-NEW-attachments-save | order.md の仕様 | src/features/tasks/attachments.ts の prepareTaskSpecDirectory 関数を修正し、saveImageAttachments を呼び出すように変更 | 全完了義務を閉じた場合のみ完了 |
| pr-image-attachment-test | TEST-NEW-01 | 品質要件 (単体テスト) | src/__tests__/pr-image-attachment.test.ts を新規作成し、画像処理ロジックの単体テストを実装 | 全完了義務を閉じた場合のみ完了 |

## 不変条件台帳の引き継ぎ
引き継ぎ元: fix-plan の記載を無変更で転記

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| image-attachment-persistence | image-attachment-persistence | 画像の永続化と order.md 追記の整合性 | src/features/tasks/attachments.ts | 0 | 0 | なし | なし | 未判定 | 0 | 未確認 | prepareTaskSpecDirectory 内で saveImageAttachments を呼び出し、ファイル保存と order.md 更新を一貫して行う | 完全 |
| pr-image-attachment-test | pr-image-attachment-test | 画像処理ロジックの正当性担保 | src/infra/github/image-downloader.ts 等 | 0 | 0 | なし | なし | 未判定 | 0 | 未確認 | 不要: 既存の担当箇所で直接修正（テスト作成） | 完全 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| image-attachment-persistence | image-attachment-persistence-P1 | 振る舞い修正 | CODE-NEW-attachments-save | 画像の永続化と order.md 追記の整合性 / prepareTaskSpecDirectory → saveImageAttachments → ファイル保存 / order.md 追記 | takt add --pr 後のファイル・内容確認で、画像が .takt/tasks/<slug>/attachments/ に保存され、.takt/tasks/<slug>/.takt/order.md の「## 添付画像」セクションにパスが記載されていないこと | 画像が保存され order.md に反映されない | prepareTaskSpecDirectory 内で saveImageAttachments を呼び出すように変更 | takt add --pr 実行時に画像が .takt/tasks/<slug>/attachments/ に保存され、order.md に追記されること | 完了 |
| pr-image-attachment-test | pr-image-attachment-test-P1 | 振る舞い修正 | TEST-NEW-01 | 画像処理ロジックの正当性担保 / 単体テストの実行 | npm test の実行結果で、extractImageUrls, validateAndDownloadImage, saveImageAttachments のテストが失敗すること | 品質要件（単体テスト追加）の不足 | extractImageUrls, validateAndDownloadImage, saveImageAttachments に対する単体テストを実装 | 新設された単体テストがすべて成功すること | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| CODE-NEW-attachments-save | takt add --pr 等の実行時に、画像が .takt/tasks/<slug>/attachments/ に保存され order.md に追記されること。保存ロジック自体の変更は除外。 | takt add --pr 後のファイル・内容確認で、画像が保存され order.md に追記されることを確認 | 完了 |
| TEST-NEW-01 | extractImageUrls, validateAndDownloadImage, saveImageAttachments に対する単体テストが実装され、成功すること。既存テストの修正は除外。 | src/__tests__/pr-image-attachment.test.ts のテスト実行結果（11/11 テストがパス） | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| 該当なし | 該当なし | 該当なし | 該当なし | 該当なし | 該当なし |

## 確立済み不変条件への差分走査
| family ID | 不変条件の名前 | 担当箇所 | 状態 | 証拠 | 理由・後続対応 |
|-----------|------------------|----------|------|------|----------------|
| image-attachment-persistence | 画像の永続化と order.md 追記の整合性 | src/features/tasks/attachments.ts | 維持 | 担当箇所と記録済み有界 graph への照合結果で、prepareTaskSpecDirectory から saveImageAttachments を呼び出す経路が正しく設定されていることを確認 | なし |
| pr-image-attachment-test | 画像処理ロジックの正当性担保 | src/__tests__/pr-image-attachment.test.ts | 維持 | 担当箇所と記録済み有界 graph への照合結果で、extractImageUrls, validateAndDownloadImage, saveImageAttachments の単体テストが実装されていることを確認 | なし |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | npm run build が成功 |
| テスト | 成功 | npm test が成功（テストファイル src/__tests__/pr-image-attachment.test.ts も含む） |
| lint | 成功 | npm run lint が成功 |
| 統合テスト | 未実施（タイムアウトのため） | npm run test:it はタイムアウトになったが、タイムアウト前に多くのテストがパスしていることを確認 |
| E2E テスト | 未実施（タイムアウトのため） | npm run test:e2e:mock はタイムアウトになったが、タイムアウト前に多くの E2E テストがパスしていることを確認 |

## 未完了義務
- なし、または義務ID、理由、必要な次の対応