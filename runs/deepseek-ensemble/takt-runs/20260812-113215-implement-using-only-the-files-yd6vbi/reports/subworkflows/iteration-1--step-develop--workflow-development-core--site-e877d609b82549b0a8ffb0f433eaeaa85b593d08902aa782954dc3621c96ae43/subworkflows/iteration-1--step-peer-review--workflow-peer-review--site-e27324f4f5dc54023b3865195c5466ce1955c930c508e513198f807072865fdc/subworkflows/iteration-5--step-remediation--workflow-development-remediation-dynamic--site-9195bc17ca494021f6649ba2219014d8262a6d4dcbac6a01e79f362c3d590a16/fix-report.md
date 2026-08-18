# 修正レポート
## サマリー
finding `PRIMG-TEMP-DIR-OWNERSHIP`（`direct_acceptance_criterion_violation`、根本原因は `createTempDownloadDir` が固定名 `takt-pr-images` を使用して処理単位の一意な private 一時ディレクトリを生成していないこと）に対し、修正計画 `TEMP-DIR-UNIQUE` を実装した。`fs.mkdtempSync` を用いて `takt-pr-images-` プレフィックスの一意なディレクトリを生成する局所修正と、並存・個別削除シナリオの統合テスト追加を完了。全品質ゲート（build / lint / ユニット / 統合 / mock E2E）が成功し、修正単位の全完了義務を閉じた。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `TEMP-DIR-UNIQUE` | `PRIMG-TEMP-DIR-OWNERSHIP` | 画像解決結果が自身の一時領域とcleanupを所有する計画契約 | 局所修正。`src/infra/github/prReviewImageAttachments.ts:425-428` の `createTempDownloadDir` を `fs.mkdtempSync(path.join(tmpRoot, 'takt-pr-images-'))` で一意な private 一時ディレクトリを返す実装に変更。公開API・引数・戻り値・契約は維持。`src/__tests__/prReviewImageAttachments.integration.test.ts` に並存・個別削除シナリオ2件を追加 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `TEMP-DIR-UNIQUE` | OBL-1 | 振る舞い修正 | `PRIMG-TEMP-DIR-OWNERSHIP` | 1回の解決処理は他から隔離された専用領域（`takt-pr-images-XXXXXX`）を所有する。経路: `createTempDownloadDir` → `fs.mkdtempSync` | 同一 `tmpRoot` で2回解決し、両方の `attachments` パスが同一ディレクトリ配下になる（[SCN-TEMP-DIR-UNIQUE-P1]） | 固定名 `takt-pr-images` により重複実行時に画像ファイルが衝突 | `fs.mkdtempSync` で一意パスを生成するよう変更 | 追加テスト `should store concurrent resolutions under distinct directories within the same tmpRoot` がパス（16件中） | 完了 |
| `TEMP-DIR-UNIQUE` | OBL-2 | 振る舞い修正 | `PRIMG-TEMP-DIR-OWNERSHIP` | そのcleanupは所有領域のみを削除し、他方の保存ファイルを破壊しない。経路: `cleanup` → `fs.rmSync(downloadDir)` | 1回目の `cleanup()` 実行後、2回目のファイルが消える（[SCN-TEMP-DIR-UNIQUE-N1]） | 固定名のため一方のcleanupが他方のファイルを削除 | `fs.mkdtempSync` で各処理が独立ディレクトリを所有し、cleanup は所有領域のみ削除 | 追加テスト `should not delete the other resolution files when one cleanup runs` がパス（16件中） | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `PRIMG-TEMP-DIR-OWNERSHIP` | 同一 `tmpRoot` で2回解決し、両結果を未cleanupのまま保持してもファイルが独立して生成され、個別cleanupで他方を削除しないこと | `npm test -- src/__tests__/prReviewImageAttachments.integration.test.ts` で16件パス。追加した `should store concurrent resolutions under distinct directories within the same tmpRoot` と `should not delete the other resolution files when one cleanup runs` がパス | 完了 |

## 差し戻し後の証拠修正
該当なし（差し戻しなし）

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build`（tsc + copy-build-assets） |
| lint | 成功 | `npm run lint`（eslint src/） |
| カバレッジ対象テスト | 成功 | `npm test -- src/__tests__/prReviewImageAttachments.integration.test.ts` → 16 tests passed |
| 統合テスト | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it` → 158 files / 2357 tests passed |
| ユニットテスト | 成功 | `npm test` → 全シャード成功（95/95, 95/95, 94/94 files） |
| E2E (mock) | 成功 | `npm run test:e2e:mock` → 18 passed / 1 skipped（55 passed / 13 skipped / 30 todo） |
| その他 | 成功 | セルフスキャン（今回の編集差分のみ）: 未使用化・依存方向違反・共通責務候補の新規問題なし |

## 未完了義務
- なし