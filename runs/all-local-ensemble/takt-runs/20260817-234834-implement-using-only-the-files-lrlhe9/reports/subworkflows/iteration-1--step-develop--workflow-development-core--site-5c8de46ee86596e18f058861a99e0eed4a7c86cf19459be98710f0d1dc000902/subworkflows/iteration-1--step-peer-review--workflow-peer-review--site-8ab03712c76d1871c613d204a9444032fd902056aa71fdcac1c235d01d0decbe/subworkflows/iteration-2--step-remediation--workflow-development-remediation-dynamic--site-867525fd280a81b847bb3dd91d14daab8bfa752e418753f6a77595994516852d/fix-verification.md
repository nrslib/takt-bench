# 修正完了検証

## 結果: verified

## サマリー
修正計画 U1（画像ダウンロード時の Content-Type ヘッダ検証の追加）の実装を、修正担当の報告から独立して検証した。`src/infra/github/imageDownload.ts` の実装を計画の不変条件・受入条件・修正境界と照合し、全完了義務（U1-O1 振る舞い修正、U1-O2 既存契約保存）が成立することを確認した。全品質ゲート（build・lint・unit・light IT・mock E2E・smoke E2E）を再実行して成功を確認した。修正境界は計画どおり `imageDownload.ts` と `imageDownload.test.ts` のみで、外部契約（`downloadPrImages` シグネチャ）は不変である。

## 不変条件の再発記録
| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| U1(前回): `addTask --pr` 経路の添付伝播テスト追加 | `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | 1（初回） | なし | なし | なし | 維持（判定できない（初回）） | 0 | 未確認 | 該当なし | 完全 |
| U1: 画像ダウンロード時の Content-Type ヘッダ検証の追加 | `image-content-type-validation` | 画像ダウンロード時の Content-Type 検証 | `src/infra/github/imageDownload.ts` の `downloadPrImages`（Content-Type 検証を追加すべき検証境界） | なし | なし | なし | なし | 維持 | 0 | 未確認 | 不要: 独立した局所欠陥かつ初回検証のため、既存の担当箇所（`downloadPrImages`）で直接修正。同一不変条件が別経路で2回以上壊れた場合は強制点の導入を再計画する | 完全 |

今回の検証は両不変条件とも `incomplete` ではないため、記録済みの検証回数・経路・回数・別経路での再発は据え置き、今回の判定のみ「維持」とした。`image-content-type-validation` は計画時の「未判定」から「維持」へ更新した。fix-report の「不変条件台帳の引き継ぎ」は fix-plan の台帳を無変更で転記しており、両行とも完全である。

## 修正単位の整合性
| 修正単位 | 対象 finding | 前提・方法・証拠能力の整合性 | 判定 |
|----------|--------------|------------------------------|------|
| U1: 画像ダウンロード時の Content-Type ヘッダ検証の追加 | FG-IMG-1 / FG-IMG-001 | 計画の前提（order.md:36 の Content-Type 検証要件、`gh api --include` の仕様）は実コードと照合して有効。修正境界（`imageDownload.ts` と `imageDownload.test.ts` のみ）は守られ、外部契約（`downloadPrImages` シグネチャ）は不変 | 適合 |

## 完了義務の独立検証
| 修正単位 | 義務ID | 対象 finding | 不変条件と対象経路 | 独立に用いた反例・観測点 | 観測結果 | 証拠 | 判定 |
|----------|--------|--------------|--------------------|----------------------------|----------|------|------|
| U1 | U1-O1 | FG-IMG-1 / FG-IMG-001 | 振る舞い修正。Content-Type 不一致・欠落で throw | `imageDownload.ts:126-129` で `contentType === undefined \|\| !SUPPORTED_CONTENT_TYPES.has(contentType)` のとき throw。`SUPPORTED_CONTENT_TYPES`（L62）は4形式。`downloadImage`（L64-84）は `gh api --include` でヘッダを `\r\n\r\n` 分割し `content-type` を lower-case 正規化してパース | 成立 | テスト `should reject ... Content-Type does not match`（`text/html`→throw）、`should reject ... Content-Type header is missing`（ヘッダなし→throw）、`should download ...`（`image/png` 受理）が 11 passed で検証 | 完了 |
| U1 | U1-O2 | FG-IMG-1 / FG-IMG-001 | 既存契約保存。`downloadPrImages` シグネチャ不変、magic bytes・サイズ上限・`isGitHubAttachmentUrl` 維持 | `imageDownload.ts:100-103` のシグネチャは計画どおり。`detectImageFormat`（L38）・`MAX_IMAGE_BYTES`（L18）・`isGitHubAttachmentUrl`（L34）は無変更。add 経路（`add/index.ts:199`）と pipeline 経路（`steps.ts:228`）が同一の `downloadPrImages` を共有 | 成立 | コード照合＋`npm test`（4シャード成功）・light IT（1798 passed）・mock E2E（48 passed/13 skipped）・smoke E2E（16 passed/1 skipped）で回帰なし | 完了 |

## 不成立・未確認事項
| 修正単位 | 義務ID | 種別 | 根拠 | 修正報告の証拠が検出できなかった理由 | 同じ検出パターンで再監査した範囲 | 必要な対応 |
|----------|--------|------|------|----------------------------------------|----------------------------------|--------------|
| なし | - | - | - | - | - | - |

## 環境要因により実証できない後続確認（判定非ブロッキング）
| 対象 | 環境要因 | リポジトリ内で解消不能な根拠 | 現在確認した代替証拠 | 後続確認 |
|------|----------|------------------------------|--------------------------|----------|
| なし | - | - | - | - |

## 実行証跡
| 対象 | 方法 | 結果 |
|------|------|------|
| 対象テスト | `npm test -- src/__tests__/imageDownload.test.ts` | 成功（11 passed） |
| ビルド | `npm run build` | 成功 |
| lint | `npm run lint` | 成功 |
| unit gate | `npm test` | 成功（4シャード） |
| 軽い IT gate | `HOME=/tmp/takt-bench-v3-home npm run test:it` | 成功（1798 passed） |
| mock E2E | `npm run test:e2e:mock` | 成功（48 passed / 13 skipped） |
| smoke E2E | `npm run test:e2e:smoke` | 成功（16 passed / 1 skipped） |

### 検証の根拠
- **U1-O1（Content-Type 検証）**: `imageDownload.ts:126-129` で Content-Type が supported 形式以外・欠落の場合に throw することを確認。`SUPPORTED_CONTENT_TYPES`（L62）は計画どおり `image/png` / `image/jpeg` / `image/gif` / `image/webp` の4形式。`downloadImage`（L64-84）は `gh api --include` でヘッダ込みを取得し、`\r\n\r\n` で分割して `content-type` を lower-case 正規化してパース。magic bytes 検証（`detectImageFormat`、L130-133）は維持され、両方通過時のみ保存。
- **U1-O2（既存契約保存）**: `downloadPrImages` のシグネチャ `(prReview, cwd): { prReview; attachments }` は不変。`detectImageFormat`・`MAX_IMAGE_BYTES`・`isGitHubAttachmentUrl` は無変更。add 経路（`add/index.ts:199`）と pipeline 経路（`steps.ts:228`）が同一の共有関数を使用し、検証は共有関数で一度行えば双方に適用される。
- **再発記録**: fix-report の「不変条件台帳の引き継ぎ」は fix-plan の台帳を無変更で転記しており、両行とも完全。今回の検証は `incomplete` ではないため、`image-content-type-validation` の判定を「維持」へ更新した。

**判定: verified** — 修正計画 U1 の全完了義務と受入条件を独立に確認できた。実装・証拠・計画のいずれにも不足はない。