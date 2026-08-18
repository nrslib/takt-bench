# 修正レポート
## サマリー
verifier が指摘した retry 経路の複数 placeholder 再採番バグ（OBL-6 / OBL-8）を修正した。順次 `replaceAll` により、置換先が別の元 placeholder と一致すると同一番号化する問題を、正本 `imageAttachmentReferences.ts` に単一走査の一括置換関数 `replaceImagePlaceholderPlaceholders` を追加し、retry consumer をその関数へ移行して解消した。回帰テストとして、本文最大番号 `2`・retry note に `[Image #1]` と `[Image #3]`・添付2件の反例を追加し、一意な番号（`[Image #3]` と `[Image #4]`）が生成されることを検証した。全品質ゲート（build / lint / fast unit / IT / e2e:mock）が成功した。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | `AI-NEW-image-attach-L35` / `ADJ-FOLLOWUP-retry-placeholder-grammar` | `src/shared/utils/imageAttachmentReferences.ts`（`IMAGE_ATTACHMENT_PLACEHOLDER_EXACT_PATTERN`） | 境界変更: 正本に `replaceImageAttachmentPlaceholders` を追加。利用側移行: `retryTaskSpecAttachments.ts` の順次 `replaceAll` ループを単一走査の一括置換へ置換。回帰テスト追加 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-1 | 振る舞い修正 | `AI-NEW-image-attach-L35` | `extractImagePlaceholderNumber` が正規プレースホルダー `[Image #12]` から `12` を返す（[SCN-PRIMG-P1]） | `extractImagePlaceholderNumber('[Image #12]') === 12` | 関数未実装 | `isImageAttachmentPlaceholder` で正規判定後に `Number.parseInt` | `imageAttachmentReferences.test.ts` 成功 | 完了 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-2 | 振る舞い修正 | `AI-NEW-image-attach-L35` / `ADJ-FOLLOWUP-retry-placeholder-grammar` | 不正プレースホルダー `[Image #0]`・`[Image #01]` は番号が抽出されない（[SCN-PRIMG-N1, N2]） | `extractImagePlaceholderNumber('[Image #0]') === undefined`、`extractImagePlaceholderNumber('[Image #01]') === undefined` | consumer の独自 `\d+` 正規表現が不正番号を正規として扱い得た | 正本 `/^\[Image #[1-9]\d*\]$/` を経由しない限り `undefined` を返す実装 | `imageAttachmentReferences.test.ts` 成功 | 完了 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-3 | 振る舞い修正 | `AI-NEW-image-attach-L35` | `createImageAttachmentPlaceholder` が正の整数から正規プレースホルダーを生成し、非正数は拒絶する | `createImageAttachmentPlaceholder(1) === '[Image #1]'`、`createImageAttachmentPlaceholder(0)` が例外 | 関数未実装 | `Number.isSafeInteger(number) && number >= 1` の検証後 `[Image #${number}]` を返す実装 | `imageAttachmentReferences.test.ts` 成功 | 完了 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-4 | 利用側移行 | `AI-NEW-image-attach-L35` | `prReviewImageAttachments.ts` の番号収集とプレースホルダー生成が正本関数を通る。既存番号を避けた採番が維持される | `collectExistingPlaceholderNumbers` が `findImageAttachmentPlaceholders` + `extractImagePlaceholderNumber` を使い、`extractPrReviewImageReferences` が `createImageAttachmentPlaceholder` を使うこと | 独自 `/\[Image #(\d+)\]/g` と `` `[Image #${number}]` `` を使用 | 正本関数へ置換 | `prReviewImageAttachments.test.ts` 16件成功 | 完了 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-5 | 利用側移行 | `AI-NEW-image-attach-L35` | `imageAttachments.ts` の次番号採番とプレースホルダー生成が正本関数を通る。最大番号の次を採番する挙動が維持される | `nextAttachmentNumber` が `extractImagePlaceholderNumber` を使い、`saveImage` が `createImageAttachmentPlaceholder` を使うこと | 独自 `/^\[Image #(\d+)\]$/` と `` `[Image #${index}]` `` を使用 | 正本関数へ置換 | `imageAttachments.test.ts` 16件成功 | 完了 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-6 | 利用側移行 | `ADJ-FOLLOWUP-retry-placeholder-grammar` | retry consumer が複数添付を一意に再採番し、retry note を正しく置換する。最大番号の次を採番する挙動が維持される | 本文最大番号 `2`、retry note に `[Image #1]` と `[Image #3]`、添付2件で実行し、出力が一意な番号になること | 実結果は `Use [Image #4] and [Image #4].`（順次 `replaceAll` による再変換） | `replaceImageAttachmentPlaceholders`（単一走査の一括置換）へ移行 | 追加した回帰テストで `Use [Image #3] and [Image #4].` を確認。`retryTaskSpecAttachments.test.ts` 4件成功 | 完了 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-7 | 旧経路削除 | `AI-NEW-image-attach-L35` / `ADJ-FOLLOWUP-retry-placeholder-grammar` | 3 consumer から独自の `\d+` 系プレースホルダー正規表現と `[Image #` 文字列リテラルが除去されている | `rg` で3ファイルから `\[Image #` 系がゼロ件（ファイル名パターンのみ残存） | 修正前は各 consumer に独自実装が存在 | 正本関数への置換により旧実装を削除 | `rg` で `\[Image #` 系がゼロ件 | 完了 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-8 | 既存契約保存 | `AI-NEW-image-attach-L35` / `ADJ-FOLLOWUP-retry-placeholder-grammar` | 変更対象外の観測可能な既存契約（採番挙動、生成されるプレースホルダー形式、ファイル名形式）が維持される。retry の出力 placeholder が一意である | PR/interactive/retry の既存テストの期待値が全て通ること。retry 複数 placeholder 反例で一意な番号になること | 差し戻し時: retry 複数 placeholder で同一番号化を再現 | 単一走査の一括置換により再変換を排除 | 4被覆テストファイル全件成功、fast unit gate 1864件成功 | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `AI-NEW-image-attach-L35` | 正規 placeholder の判定・番号抽出・生成が共通所有者 `imageAttachmentReferences.ts` を通じて一貫する。PR/interactive/retry consumer の独自正規表現・リテラルが削除される | `extractImagePlaceholderNumber('[Image #12]') === 12`、`createImageAttachmentPlaceholder(1) === '[Image #1]'`、`rg` で3 consumer から `\[Image #` 系がゼロ件 | 完了 |
| `ADJ-FOLLOWUP-retry-placeholder-grammar` | retry consumer が共通所有者を通じ、不正形式を正規番号として扱わない。複数添付が一意に再採番され、採番挙動が維持される | `extractImagePlaceholderNumber('[Image #0]') === undefined`、`extractImagePlaceholderNumber('[Image #01]') === undefined`、回帰テストで `Use [Image #3] and [Image #4].` を確認 | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-6 | retry 経路で複数 placeholder を再採番する際、順次 `replaceAll` により異なる添付が同じ placeholder になる | retry テストは連番の置換先のみ確認し、置換先が別の元 placeholder と一致する反例を含んでいなかった | 本文最大番号 `2`、retry note に `[Image #1]` と `[Image #3]`、添付2件の反例を追加し、一意な番号（`[Image #3]` と `[Image #4]`）を検証 | OBL-1〜OBL-8 全義務を再確認 |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | OBL-8 | 異なる添付に同一 placeholder が割り当てられ、添付参照の既存契約が破壊される | 広いテストスイート成功と既存の連番テストでは置換の再変換を検出できない | 単一走査の一括置換 `replaceImageAttachmentPlaceholders` を正本に追加し、retry consumer を移行。回帰テストで出力 placeholder の一意性を検証 | OBL-1〜OBL-7 を再確認 |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build`（tsc 2構成 + copy-build-assets）成功 |
| lint | 成功 | `npm run lint` 成功（`prefer-const` 1件を修正後クリーン） |
| fast unit gate | 成功 | `npm test`（4シャード）1864 passed |
| 被覆テスト | 成功 | `npm test -- src/__tests__/retryTaskSpecAttachments.test.ts src/__tests__/imageAttachmentReferences.test.ts` 19件成功、`npm test -- src/__tests__/prReviewImageAttachments.test.ts src/__tests__/imageAttachments.test.ts` 18 + 16件成功 |
| 分類契約テスト | 成功 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts` 20/20 passed（`check:release failed` はハーネスの意図的シミュレーション） |
| 軽い IT | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it` 2366 passed |
| E2E mock | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:e2e:mock` 55 passed / 13 skipped / 30 todo（残りは既存 skip/todo） |

## 未完了義務
- なし