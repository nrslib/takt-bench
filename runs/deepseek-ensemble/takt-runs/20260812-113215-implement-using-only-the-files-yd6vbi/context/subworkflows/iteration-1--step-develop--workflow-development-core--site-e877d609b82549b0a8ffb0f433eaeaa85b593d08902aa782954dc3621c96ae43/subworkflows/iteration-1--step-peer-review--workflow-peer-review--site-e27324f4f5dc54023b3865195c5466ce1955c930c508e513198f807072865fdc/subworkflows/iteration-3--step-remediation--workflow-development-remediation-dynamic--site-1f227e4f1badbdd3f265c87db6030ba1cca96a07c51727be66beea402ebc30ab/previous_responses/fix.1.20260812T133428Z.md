Now I understand the bug. Extraction uses `splitNonCodeSegments` (protected), but `buildReplacedPrReview` applies replacement to the entire text via `replaceText`, so a URL inside a code fence also gets replaced. Let me fix this.
Now I need to refactor the segmentation to share a single basis between extraction and replacement. Let me replace `splitNonCodeSegments` with a function that returns all segments with a code flag.
The current `splitTextSegments` drops code content (it skips it without accumulating). I need it to preserve code segments for reconstruction. Let me rewrite it properly.
Now let me add the mixed-input tests for the scenarios.
Now let me run the covering test file.
All 18 tests pass. Now let me run the quality gates.
All gates pass. Let me verify the final state of the modified file.
The implementation is complete. Let me do the self-scan for unused code. `splitNonCodeSegments` is still used by extraction, and `splitTextSegments` is used by both. Let me verify no unused references remain.
Both functions are used. No unused code. All gates pass.

## 作業結果
- 修正完了

## 変更内容と受入条件
- **PROTECTED-REWRITE**（`src/infra/github/prReviewImageAttachments.ts`）: 置換ロジックを本文全体への `replace` から、抽出と同一のセグメンテーション基準（`splitTextSegments`）で分割し、非コード領域のみ置換して再結合する方式に変更。`splitTextSegments` は各セグメントに `isCode` フラグを持ち、コードフェンス・インラインコード・HTMLコメント内の文字列を完全に維持する。`splitNonCodeSegments` は `splitTextSegments` の非コード抽出として保持（抽出側の既存挙動を維持）。
  - 反証方法: 混在入力テスト2件を追加。`SCN-PROTECTED-REWRITE-P1`（通常本文＋コードフェンスに同一URL → 通常本文のみ `[Image #1]` 化、フェンス内は維持）、`SCN-PROTECTED-REWRITE-N1`（保護領域のみにURL → 置換なし・原文維持）。
- **E2E-EVIDENCE**: 環境要因により実証できない（実行のみ）分類。`npm run test:e2e:mock` を実行し成功を記録。

## 検証結果と証拠
- `npm test -- src/__tests__/prReviewImageAttachments.test.ts`: 18 passed（追加2件含む）
- `npm run build`: 成功
- `npm run lint`: 成功
- `npm test`: 4 shard 全 passed（1161/1499/1864/1524）
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 2357 passed
- `npm run test:e2e:mock`: 55 passed | 13 skipped | 30 todo（18 files passed）
- セルフスキャン: 未使用化なし（`splitTextSegments`/`splitNonCodeSegments` とも使用中）、依存方向・共通責務の新規問題なし。