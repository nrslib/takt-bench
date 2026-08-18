I'll start by reading the primary spec and the current review adjudication.
Let me read the policy file and the key source files.
Let me read the rest of the policy file and the key source files.
Let me read the rest of the policy and the key source files.
Let me read the pipeline files and the add task index.
Let me read the add task index and attachments.
Let me verify the test files and check the git diff to confirm the changes.
Let me verify the recurrence ledger carryover source and the remaining test files.
The recurrence ledger carryover in review-resolution.md matches the fix-verification.md source exactly. Let me verify the remaining test files and the pipeline execution test.
Let me check the pipelineExecution test for the attachment propagation test and the git-cwd-propagation test.
Let me check the pipelineExecution test for the attachment propagation test specifically.
Let me read the pipelineExecution test attachment propagation section in full.
Let me verify the add/index.ts and steps.ts diffs, and confirm the test files exist.
Let me verify the imageDownload test and the taskSpec context functions.
Let me verify the taskSpecContext functions used in the pipeline path.
Let me verify that `executeTask` consumes the `taskSpec` (stages attachments to run context).
Let me check the output contract for the final-gate step.
Let me check the previous final-gate response to understand the expected output format.
Let me find the output contract for the final-gate step.
Let me find the final-gate output contract definition.
I have gathered sufficient evidence. Let me verify the imageExtraction test file exists and confirm the final state.
I have completed my verification. Let me consolidate the evidence.

**Verification summary:**

All 11 requirement items from order.md are satisfied in the current code, verified by reading the actual implementation paths:

1. **Image URL detection** (order.md:11,27-31): `imageExtraction.ts:21` `extractImageUrls` — Markdown + HTML `<img>`, code block exclusion ✓
2. **Download** (order.md:12): `imageDownload.ts:64-84` `downloadImage` via `gh api --include` ✓
3. **attachments save** (order.md:13): `downloadPrImages` returns `StoredImageAttachment[]`, `attachments.ts:88` `promoteTaskAttachments` copies to `attachments/` ✓
4. **order.md append** (order.md:14,16-20): `attachments.ts:35` `buildTaskOrderContent` ✓
5. **Reference replacement** (order.md:22): `imageExtraction.ts:57` `replaceImageReferences`, applied at `imageDownload.ts:147-149` ✓
6. **pipeline --pr path** (order.md:23): `steps.ts:228` calls `downloadPrImages`, `steps.ts:360-372` builds taskSpec, `execute.ts:59` passes `attachments` to `runWorkflow`; `executeTask` consumes taskSpec via `stageTaskSpecForExecution` (`workflowExecution.ts:246-247`) ✓
7. **Format validation** (order.md:35): `imageDownload.ts:38-60` `detectImageFormat` ✓
8. **Content-Type validation** (order.md:36): `imageDownload.ts:126-129` throws on mismatch/missing; `SUPPORTED_CONTENT_TYPES` (L62) 4 formats; `downloadImage` parses headers via `\r\n\r\n` split with lower-case normalization ✓ **resolved**
9. **Size limit** (order.md:37): `imageDownload.ts:18` `MAX_IMAGE_BYTES` (10MB), `:134-136` ✓
10. **gh api** (order.md:38): `imageDownload.ts:65` ✓
11. **External URL restriction** (order.md:39): `imageDownload.ts:16,34-36` `isGitHubAttachmentUrl` ✓

**Prior findings:** TEST-001 resolved (`addTask.test.ts:391-415` non-empty attachments test, matches `add/index.ts:199,214-218`). CODE-NEW-1/2/3 overreach. The 2 new findings (CODE-NEW-infra-github-imageDownload-L126, ARCH-001) were adjudicated `out_of_scope` — neither violates an order.md requirement (no skip-and-continue requirement; no temp-cleanup requirement), so this is within the adjudication's authority.

**Recurrence ledger:** review-resolution.md carries over from `iteration-2--step-remediation--.../fix-verification.md` (N=2, max). I verified the fix-verification.md exists and its 2 rows match the review-resolution.md rows exactly across all 13 columns. Both invariants are `維持` (not incomplete), so no counter updates.

All requirements satisfied, all prior findings resolved, ledger carried forward correctly. **Verdict: APPROVE.**

---

# 最終検証結果

## 結果: APPROVE

## 要件充足チェック
| # | 分解した要件 | 元要件の出典 | 充足 | 根拠 |
|---|------------|--------------|------|------|
| 1 | PR コメント内の画像 URL 検出 | order.md:11,27-31 | 充足 | `src/infra/git/imageExtraction.ts:21` `extractImageUrls`。Markdown と HTML `<img>` の両対応（`IMAGE_SYNTAX` L9）、コードブロック除外 |
| 2 | 画像ダウンロード | order.md:12 | 充足 | `src/infra/github/imageDownload.ts:64-84` `downloadImage`（`gh api --include` 経由、private repo 対応） |
| 3 | attachments 保存 | order.md:13 | 充足 | `downloadPrImages`（imageDownload.ts:100-152）が `StoredImageAttachment[]` を返し、`attachments.ts:88` `promoteTaskAttachments` が `attachments/` へコピー |
| 4 | order.md 追記 | order.md:14,16-20 | 充足 | `attachments.ts:35` `buildTaskOrderContent` が既存形式 `## 添付画像` / `- [Image #N]: ...` で追記 |
| 5 | 本文の画像参照置換 | order.md:22 | 充足 | `imageExtraction.ts:57` `replaceImageReferences`、`imageDownload.ts:147-149` で PR body・comments・reviews 全本文に適用 |
| 6 | pipeline `--pr` 経路の画像参照 | order.md:23 | 充足 | `steps.ts:228` で `downloadPrImages` 呼び出し、`steps.ts:360-372` で attachment 付き taskSpec 組み立て。`execute.ts:59` で `taskContent.attachments` を `runWorkflow` へ伝播。`executeTask` は `stageTaskSpecForExecution`（workflowExecution.ts:246-247）で run context へ添付を stage |
| 7 | 形式検証（PNG/JPEG/GIF/WebP） | order.md:35 | 充足 | `imageDownload.ts:38-60` `detectImageFormat` が magic bytes で判定 |
| 8 | Content-Type 検証 | order.md:36 | 充足 | `imageDownload.ts:126-129` で Content-Type 不一致・欠落を throw。`SUPPORTED_CONTENT_TYPES`（L62）は4形式。`downloadImage`（L64-84）は `gh api --include` でヘッダを `\r\n\r\n` 分割し lower-case 正規化してパース |
| 9 | サイズ上限 | order.md:37 | 充足 | `imageDownload.ts:18` `MAX_IMAGE_BYTES`（10MB）、`:134-136` で超過拒否 |
| 10 | `gh api` 経由の取得 | order.md:38 | 充足 | `imageDownload.ts:65` `execFileSync('gh', ['api', '--include', url])` |
| 11 | 外部 URL の無制限取得防止 | order.md:39 | 充足 | `imageDownload.ts:16,34-36` `isGitHubAttachmentUrl` が GitHub attachment URL のみ許可 |

## 再発台帳の引き継ぎ
引き継ぎ元: `subworkflows/iteration-2--step-remediation--workflow-development-remediation-dynamic--site-867525fd280a81b847bb3dd91d14daab8bfa752e418753f6a77595994516852d/fix-verification.md`（review-resolution.md に記録済みの行を無変更で転記）

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|----------|------------------|------------------|----------|----------|------------------------|-------------------------|--------------------|------------|--------------|
| U1(前回): `addTask --pr` 経路の添付伝播テスト追加 | `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | 1（初回） | なし | なし | なし | 維持（判定できない（初回）） | 0 | 未確認 | 該当なし | 完全 |
| U1: 画像ダウンロード時の Content-Type ヘッダ検証の追加 | `image-content-type-validation` | 画像ダウンロード時の Content-Type 検証 | `src/infra/github/imageDownload.ts` の `downloadPrImages`（Content-Type 検証を追加すべき検証境界） | なし | なし | なし | なし | 維持 | 0 | 未確認 | 不要: 独立した局所欠陥かつ初回検証のため、既存の担当箇所（`downloadPrImages`）で直接修正。同一不変条件が別経路で2回以上壊れた場合は強制点の導入を再計画する | 完全 |

- 引き継ぎ元（review-resolution.md の再発台帳）の全13項目を無変更で転記した。今回の検証で両不変条件とも `incomplete` ではないため、検証回数・経路・回数・別経路での再発を更新せず、記録済みの値を維持した。

## 前段 finding の再評価
| finding ID / 出典 | 元の受入条件 | 解消状態 | 根拠 |
|-------------------|--------------|----------|------|
| FG-IMG-001 / final-gate（前段） | Content-Type ヘッダが supported 形式に一致する画像を許可し、不一致・欠落を拒否する | 解消済み | `imageDownload.ts:126-129` の Content-Type 検証、`SUPPORTED_CONTENT_TYPES`（L62）、`gh api --include` によるヘッダ取得を現在コードで再確認。iteration-2 fix-verification.md で verified |
| TEST-001 / 前段 review | `addTask --pr` 経路で抽出画像が `.takt/tasks/<slug>/attachments/` へ保存され order.md に `[Image #N]` が追記される | 解消済み | `src/__tests__/addTask.test.ts:391-415` に非空 attachments のテスト。現在コード（add/index.ts:199,214-218）と経路一致 |
| CODE-NEW-1 / 2 / 3（`image-download-safety`）/ 前段 review | — | overreach | 前回裁定どおり反証済み。実在する欠陥の証拠なし。今回も再提出なし |

## 修正対象 family
（該当なし — 全要件充足、前段 finding は全て解消済み。今回の2件は `out_of_scope` であり、修正対象 family は存在しない）

## 指摘ごとの裁定
| finding ID / 出典 | 技術的妥当性 | 裁定 | 対象 family | 同じ原因で変更される理由 | 合流根拠 | authorization basis | 初回に含まれなかった理由 | 根拠 |
|-------------------|----------------|------|-------------|--------------------------|----------|---------------------|--------------------------|------|
| CODE-NEW-infra-github-imageDownload-L126 / coding-review | 確認済み | out_of_scope | なし | 該当なし（修正対象外） | 該当なし | なし | 該当なし | 画像1枚の失敗で `takt add` / pipeline が exit(1) で中断する影響は実在するが、order.md に画像1枚の失敗をスキップして継続する要件はない。受入条件の直接違反・退行・必須 migration・採用済み family のいずれにも該当しない |
| ARCH-001 / architecture-review | 確認済み | out_of_scope | なし | 該当なし（修正対象外） | 該当なし | なし | 該当なし | `.takt/tmp/pr-images` の一時ファイル蓄積は実在するが、order.md に一時ファイルのクリーンアップ要件はない。アーキテクチャポリシーの資源所有権基準は「解放しない」ケースを直接対象にしておらず、権限根拠にならない |

## 判定根拠
- 元要件（order.md）の全11項目を現在のコードへ対応付け、いずれも充足を確認した。特に前回未充足だった Content-Type 検証（order.md:36）は `imageDownload.ts:126-129` で実装済み。
- 前段 finding（FG-IMG-001、TEST-001）は解消済み、CODE-NEW-1/2/3 は overreach。今回の2件（CODE-NEW-infra-github-imageDownload-L126、ARCH-001）は order.md の受入条件に直接違反しないため `out_of_scope` 裁定は妥当。
- 再発台帳の引き継ぎは review-resolution.md の全行・全13項目を無変更で維持した。
- テスト・ビルド等の機械ゲートは審査対象外（最終ゲートの規定どおり）。

よって **APPROVE** とします。マージ阻害となる未充足要件・未解消 finding・引き継ぎ不整合はありません。