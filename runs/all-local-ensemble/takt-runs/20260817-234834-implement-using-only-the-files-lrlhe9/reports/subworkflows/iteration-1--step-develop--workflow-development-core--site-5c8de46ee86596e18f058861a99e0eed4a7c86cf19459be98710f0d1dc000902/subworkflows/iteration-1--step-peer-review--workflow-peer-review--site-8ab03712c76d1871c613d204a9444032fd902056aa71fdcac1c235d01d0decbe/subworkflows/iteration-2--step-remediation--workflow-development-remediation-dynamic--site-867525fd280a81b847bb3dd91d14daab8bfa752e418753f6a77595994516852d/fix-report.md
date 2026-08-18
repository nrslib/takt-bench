# 修正レポート
## サマリー
修正計画 U1（画像ダウンロード時の Content-Type ヘッダ検証の追加）を実装しました。`src/infra/github/imageDownload.ts` の `downloadImage` を `gh api --include` でヘッダ込みを取得するよう変更し、`content-type` を lower-case 正規化してパースして返すようにしました。`downloadPrImages` で Content-Type が supported 形式（`image/png` / `image/jpeg` / `image/gif` / `image/webp`）以外・欠落の場合に throw する検証を追加し、magic bytes 検証（`detectImageFormat`）は維持して両方通過時のみ保存します。`src/__tests__/imageDownload.test.ts` は既存テストを `--include` 形式のモックへ更新し、Content-Type 不一致・欠落の拒否テストを追加しました。修正境界は計画どおり `imageDownload.ts` と `imageDownload.test.ts` のみで、外部契約（`add/index.ts`・`steps.ts` の `downloadPrImages` シグネチャ）は変更していません。全品質ゲート（build・lint・unit・light IT・mock E2E・smoke E2E）が成功しました。

## 修正単位
| 修正単位 | 対象 finding | 守る契約 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| U1: 画像ダウンロード時の Content-Type ヘッダ検証の追加 | FG-IMG-1 / FG-IMG-001 | order.md:35-36（対応形式は PNG/JPEG/GIF/WebP、Content-Type と magic bytes を検証する）。成立を保証する単一の責務・参照元は `src/infra/github/imageDownload.ts` の `downloadPrImages`（Content-Type 検証を追加すべき検証境界） | 局所修正。`downloadImage` を `gh api --include` へ変更し Content-Type を返す、`downloadPrImages` で Content-Type 検証を追加、`imageDownload.test.ts` を `--include` 形式へ更新し Content-Type 不一致・欠落の拒否テストを追加 | 完了 |

## 不変条件台帳の引き継ぎ
引き継ぎ元: `../iteration-1--step-peer-review--workflow-peer-review--site-8ab03712c76d1871c613d204a9444032fd902056aa71fdcac1c235d01d0decbe/review-resolution.md`（同一 iteration-2 remediation ディレクトリ内に先行 fix-verification が 0 件のため review-resolution を使用。fix-plan の「不変条件台帳」に記録済みの行を無変更で転記）

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| U1(前回): `addTask --pr` 経路の添付伝播テスト追加 | `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | 1（初回） | なし | なし | なし | 維持（判定できない（初回）） | 0 | 未確認 | 該当なし | 完全 |
| U1: 画像ダウンロード時の Content-Type ヘッダ検証の追加 | `image-content-type-validation` | 画像ダウンロード時の Content-Type 検証 | `src/infra/github/imageDownload.ts` の `downloadPrImages`（Content-Type 検証を追加すべき検証境界） | なし | なし | なし | なし | 未判定 | 0 | 未確認 | 不要: 独立した局所欠陥かつ初回検証のため、既存の担当箇所（`downloadPrImages`）で直接修正。同一不変条件が別経路で2回以上壊れた場合は強制点の導入を再計画する | 完全 |

## 引き継ぎ不足
- なし

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| U1: 画像ダウンロード時の Content-Type ヘッダ検証の追加 | U1-O1 | 振る舞い修正 | FG-IMG-1 / FG-IMG-001 | 画像ダウンロード時の Content-Type 検証。経路: `downloadPrImages`（imageDownload.ts:100）→ `downloadImage`（L64、`gh api --include <url>`）→ Content-Type 検証（新規）＋ `detectImageFormat`（L38、magic bytes）→ 保存・placeholder 置換 | Content-Type `text/html` ＋ PNG magic bytes → `downloadPrImages` が throw する。Content-Type ヘッダなし ＋ PNG magic bytes → throw する | 修正前は `downloadImage` が `gh api` を `encoding: null` で生バイトとして受け、Content-Type ヘッダを取得・検証せず magic bytes のみで受理していた | `downloadImage` を `gh api --include` へ変更し、`\r\n\r\n` でヘッダとボディを分割して `content-type` を lower-case 正規化してパース。`SUPPORTED_CONTENT_TYPES`（`image/png` / `image/jpeg` / `image/gif` / `image/webp`）を定義し、`downloadPrImages` で Content-Type が supported 形式以外・欠落の場合 throw。magic bytes 検証は維持 | `npm test -- src/__tests__/imageDownload.test.ts` が 11 passed。Content-Type 不一致（`text/html`）拒否・Content-Type 欠落拒否・supported Content-Type ＋ 一致 magic bytes 受理を検証 | 完了 |
| U1: 画像ダウンロード時の Content-Type ヘッダ検証の追加 | U1-O2 | 既存契約保存 | FG-IMG-1 / FG-IMG-001 | 画像ダウンロード時の Content-Type 検証。経路: `downloadPrImages` の戻り（`attachments` と `prReview`）を消費する add 経路（`add/index.ts:199` → `saveTaskFile`）と pipeline 経路（`steps.ts:228` → `runWorkflow`） | `downloadPrImages` のシグネチャ `(prReview: PrReviewData, cwd: string): { prReview; attachments }` が変わらないこと。magic bytes 検証（`detectImageFormat`）とサイズ上限・`isGitHubAttachmentUrl` が維持されること | 外部契約は変更前から `downloadPrImages` のシグネチャで、add / pipeline 両経路が同一の共有関数を使用 | `downloadPrImages` のシグネチャは変更せず、検証のみ追加。`detectImageFormat`・`MAX_IMAGE_BYTES`・`isGitHubAttachmentUrl` は無変更で維持。`add/index.ts`・`steps.ts`・`execute.ts` は変更なし | `npm test`（全シャード成功）、`HOME=/tmp/takt-bench-v3-home npm run test:it`（1798 passed）、`npm run test:e2e:mock`（48 passed / 13 skipped）、`npm run test:e2e:smoke`（16 passed / 1 skipped）で外部契約の回帰なし | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| FG-IMG-1 / FG-IMG-001 | ダウンロードした画像の HTTP Content-Type ヘッダが supported 形式（`image/png` / `image/jpeg` / `image/gif` / `image/webp`）に一致する場合のみ受理し、不一致・欠落を拒否（throw）する。magic bytes 検証は維持し、両方を検証する | `npm test -- src/__tests__/imageDownload.test.ts` が 11 passed。`should download GitHub attachment images and return stored attachments with replaced bodies`（`image/png` ＋ PNG magic bytes 受理）、`should reject a downloaded image whose Content-Type does not match a supported format`（`text/html` ＋ PNG magic bytes → throw）、`should reject a downloaded image whose Content-Type header is missing`（ヘッダなし ＋ PNG magic bytes → throw）、`should reject a downloaded image whose magic bytes do not match a supported format`（`image/png` ＋ 非対応 magic bytes → throw）で検証 | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| 該当なし | - | - | - | - | - |

## 確立済み不変条件への差分走査
| family ID | 不変条件の名前 | 担当箇所 | 状態 | 証拠 | 理由・後続対応 |
|-----------|------------------|----------|------|------|----------------|
| `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | 維持 | 今回の差分は `imageDownload.ts` と `imageDownload.test.ts` のみ。`add/index.ts`・`steps.ts`・`execute.ts` は変更していない。`downloadPrImages` のシグネチャは不変で、add / pipeline 両経路の配線は維持。`npm test`・light IT・mock E2E・smoke E2E で回帰なし | なし |
| `image-content-type-validation` | 画像ダウンロード時の Content-Type 検証 | `src/infra/github/imageDownload.ts` の `downloadPrImages`（Content-Type 検証を追加すべき検証境界） | 維持 | 担当箇所 `downloadPrImages` で Content-Type 検証を追加し、magic bytes 検証（`detectImageFormat`）とサイズ上限・`isGitHubAttachmentUrl` を維持。反例集合（Content-Type 不一致・欠落・非対応 magic bytes）を `imageDownload.test.ts` で検証し、全経路（add / pipeline の共有 `downloadPrImages`）に適用 | なし |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` 成功 |
| lint | 成功 | `npm run lint` 成功 |
| 対象テスト | 成功 | `npm test -- src/__tests__/imageDownload.test.ts` が 11 passed |
| unit gate | 成功 | `npm test` 全シャード成功（849 / 1597 / 1453 / 1351 passed） |
| 軽い IT gate | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it` が 1798 passed |
| mock E2E | 成功 | `npm run test:e2e:mock` が 48 passed / 13 skipped |
| smoke E2E | 成功 | `npm run test:e2e:smoke` が 16 passed / 1 skipped |

## 未完了義務
- なし