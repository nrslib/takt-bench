Let me examine the report directory and current source files.
Let me examine the remediation fix-verification and the key source files.
Let me read the fix-verification.md and the key source files to verify the requirements.
Now let me verify the actual implementation against the requirements.
Let me verify the pipeline and addTask integration paths.
Let me check the diffs of changed files and the addTask attachment propagation test.
Let me check the pipeline execution test and the runWorkflow/executeTask signature.
Let me verify the `ResolvedTaskSpec` type and `executeTask` signature, and the image tests.
Let me verify the `executeTask` signature accepts `taskSpec` and `reportDirName`, and confirm the pipeline passes them correctly.
Let me check the output contract for the final-gate step and verify the Content-Type requirement situation.
Let me find the output contract for the final-gate step.
Let me find the final-gate output contract to know the expected report format.
Let me verify whether Content-Type validation is implemented anywhere, since the order.md explicitly requires it.
Let me examine the test files for the image features.
I have gathered sufficient evidence. Let me verify the Content-Type situation definitively and check the shared types for `StoredImageAttachment`.
I have completed the requirement verification. Let me confirm the order.md's Content-Type requirement once more and check the gh api invocation detail.
I have completed my verification. Let me consolidate my findings.

## 検証結果

**元要件（order.md）を現在のコードへ対応付けました。**

主要経路を追跡確認:
- **PR-IMG-1〜7, 9〜11**: 充足。`imageExtraction.ts:21` の `extractImageUrls`、`imageDownload.ts:38-60` の `detectImageFormat`、`imageDownload.ts:62-68` の `gh api` 取得、`imageDownload.ts:34-36` の `isGitHubAttachmentUrl`、`imageDownload.ts:115-117` のサイズ上限、`steps.ts:228` / `add/index.ts:199` の配線、`attachments.ts:88` の `promoteTaskAttachments`、`attachments.ts:35` の `buildTaskOrderContent` を実コードで確認。
- **PR-IMG-8（Content-Type 検証）**: **未充足**。order.md:36 は「Content-Type と magic bytes を検証する」と明記するが、`imageDownload.ts` には magic bytes 判定（`detectImageFormat`）のみで、Content-Type ヘッダの検証はどこにも実装されていません。`grep` で `content-type`/`contentType`/`headers` を検索しても `imageDownload.ts` に該当なし。
- 前段 finding TEST-001（`attachment-propagation`）は解消済み（`fix-verification.md` verified、`addTask.test.ts:391-415` のテスト追加）。
- 再発台帳の引き継ぎ行（`attachment-propagation`）は review-resolution.md と fix-verification.md で完全一致し、全13項目無変更で維持すべきもの。

**判定: REJECT**

Content-Type 検証は元要件（order.md:36）の明示的要求であり、実装されていない。これは元要件の未充足としてマージ阻害になります。レビュー指摘として提出されていなくても、supervisor は現在のコードを元要件へ対応付けて判定する責務があります。

---

以下、出力契約（supervisor-validation）に従いレポートを報告します。

# 最終検証結果

## 結果: REJECT

## 要件充足チェック
| # | 分解した要件 | 元要件の出典 | 充足 | 根拠 |
|---|------------|--------------|------|------|
| 1 | PR コメント内の画像 URL 検出 | order.md:11,27-31 | 充足 | `src/infra/git/imageExtraction.ts:21` `extractImageUrls`。Markdown と HTML `<img>` の両対応（`IMAGE_SYNTAX` L9）、コードブロック除外 |
| 2 | 画像ダウンロード | order.md:12 | 充足 | `src/infra/github/imageDownload.ts:62-68` `downloadImage`（`gh api` 経由、private repo 対応） |
| 3 | attachments 保存 | order.md:13 | 充足 | `downloadPrImages`（imageDownload.ts:84）が `StoredImageAttachment[]` を返し、`attachments.ts:88` `promoteTaskAttachments` が `attachments/` へコピー |
| 4 | order.md 追記 | order.md:14（16-20） | 充足 | `attachments.ts:35` `buildTaskOrderContent` が既存形式 `## 添付画像` / `- [Image #N]: ...` で追記 |
| 5 | 本文の画像参照置換 | order.md:22 | 充足 | `imageExtraction.ts:57` `replaceImageReferences`、`imageDownload.ts:128-130` で PR body・comments・reviews 全本文に適用 |
| 6 | pipeline `--pr` 経路の画像参照 | order.md:23 | 充足 | `steps.ts:228` で `downloadPrImages` 呼び出し、`steps.ts:360-372` で attachment 付き taskSpec 組み立て。`execute.ts:59` で `taskContent.attachments` を `runWorkflow` へ伝播 |
| 7 | 形式検証（PNG/JPEG/GIF/WebP） | order.md:35 | 充足 | `imageDownload.ts:38-60` `detectImageFormat` が magic bytes で判定 |
| 8 | Content-Type 検証 | order.md:36 | **未充足** | `imageDownload.ts` に Content-Type ヘッダ検証の実装なし（magic bytes のみ）。`content-type`/`contentType`/`headers` 検索で該当なし |
| 9 | サイズ上限 | order.md:37 | 充足 | `imageDownload.ts:18` `MAX_IMAGE_BYTES`（10MB）、`:115-117` で超過拒否 |
| 10 | `gh api` 経由の取得 | order.md:38 | 充足 | `imageDownload.ts:63` `execFileSync('gh', ['api', url])` |
| 11 | 外部 URL の無制限取得防止 | order.md:39 | 充足 | `imageDownload.ts:34-36` `isGitHubAttachmentUrl` が GitHub attachment URL のみ許可 |

{{include:output-contracts/invariant-register-carry-forward}}

## 再発台帳の引き継ぎ
引き継ぎ元: `subworkflows/iteration-1--step-remediation--workflow-development-remediation-dynamic--site-65bb1aaf70bbdd8893b8ef5f19670e7c92b19b03a156b308045bc8808559b892/fix-verification.md`（review-resolution.md に記録済みの行を無変更で転記）

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|----------|------------------|------------------|----------|----------|------------------------|-------------------------|--------------------|------------|--------------|
| U1: `addTask --pr` 経路の添付伝播テスト追加 | `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | 1（初回） | なし | なし | なし | 維持（判定できない（初回）） | 0 | 未確認 | 該当なし | 完全 |

- 引き継ぎ元の全13項目を無変更で転記した。今回の検証でこの不変条件は `incomplete` ではないため、検証回数・経路・回数・別経路での再発を更新せず、記録済みの初期値を維持した。

## 前段 finding の再評価
| finding ID / 出典 | 元の受入条件 | 解消状態 | 根拠 |
|-------------------|--------------|----------|------|
| TEST-001 / 前段 review | `addTask --pr` 経路で抽出画像が `.takt/tasks/<slug>/attachments/` へ保存され order.md に `[Image #N]` が追記される | 解消済み | `src/__tests__/addTask.test.ts:391-415` に非空 attachments のテストを追加。`fix-verification.md` で verified。本番コード変更なし。現在コード（add/index.ts:199,214-218）と経路一致 |
| CODE-NEW-1 / 2 / 3（`image-download-safety`） | — | overreach | 裁定どおり反証済み。実在する欠陥の証拠なし。今回も再提出なし。変更契約の退行なし |

## 修正対象 family
| family | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | finding ID / 出典 | 修正権限の根拠 | 根拠 | 問題 → 根本原因 | 追加した経路 | 関係する契約経路 | 受入条件 | 修正境界 |
|--------|----------|----------------------|--------------------------|-------------------|----------------|------|-------------------|--------------|--------------------|----------|----------|
| `image-content-type-validation` | `src/infra/github/imageDownload.ts` の `downloadPrImages`（Content-Type 検証を追加すべき検証境界） | ダウンロードした画像の HTTP Content-Type ヘッダを検証し、対応形式以外を拒否する | order.md:36 が Content-Type と magic bytes の両方を検証対象と定めるが、実装は magic bytes のみ。同じ検証境界で Content-Type が欠落 | FG-IMG-1 | 元要件（order.md:36）の直接違反 | `imageDownload.ts:38-60` `detectImageFormat` は magic bytes のみ。`content-type` 検証なし | 仕様要求（Content-Type 検証）→ 実装は magic bytes 検証のみで Content-Type を検証しない → 形式不一致の画像を magic bytes のみで受け入れる | なし（今回は発見経路） | `downloadImage`（gh api）→ `detectImageFormat`（magic bytes）→ 保存。Content-Type 検証が未接続 | Content-Type ヘッダが supported 形式でない画像を拒否できる | 最小変更: `downloadImage` でレスポンスの Content-Type を確認し、`downloadPrImages` で不適合時に throw。外部契約・他経路の変更なし |

## 指摘ごとの裁定
| finding ID / 出典 | 技術的妥当性 | 裁定 | 対象 family | 同じ原因で変更される理由 | 合流根拠 | authorization basis | 初回に含まれなかった理由 | 根拠 |
|-------------------|----------------|------|-------------|--------------------------|----------|---------------------|--------------------------|------|
| FG-IMG-001 / final-gate | 確認済み | actionable | `image-content-type-validation` | order.md:36 の Content-Type 検証要求の未充足 | 新規 family（既存 `attachment-propagation` とは異なる検証境界） | order.md:36 の明示的要求 | 該当なし（新規指摘） | order.md:36「Content-Type と magic bytes を検証する」。`imageDownload.ts` に Content-Type ヘッダ検証なし（grep で確認）。マージ阻害 |

**修正対象 family の記載:** 上記 `image-content-type-validation` のみ。他の要件は充足しており、修正対象外。

## 判定根拠
- 全要件のうち PR-IMG-8（Content-Type 検証）のみ未充足。order.md:36 の「Content-Type と magic bytes を検証する」は明示的セキュリティ制約であり、`imageDownload.ts` は magic bytes 検証のみで Content-Type を検証しない。
- 前段 finding（TEST-001）は解消済み、CODE 系 3 件は overreach。不変条件台帳（attachment-propagation）の引き継ぎは完全。
- テスト・ビルド等の機械ゲートは審査対象外（最終ゲートの規定どおり）。

よって REJECT とします。修正対象 family は `image-content-type-validation` で、受入条件は「Content-Type ヘッダが supported 形式に一致する画像を許可し、不一致を拒否する」こと。