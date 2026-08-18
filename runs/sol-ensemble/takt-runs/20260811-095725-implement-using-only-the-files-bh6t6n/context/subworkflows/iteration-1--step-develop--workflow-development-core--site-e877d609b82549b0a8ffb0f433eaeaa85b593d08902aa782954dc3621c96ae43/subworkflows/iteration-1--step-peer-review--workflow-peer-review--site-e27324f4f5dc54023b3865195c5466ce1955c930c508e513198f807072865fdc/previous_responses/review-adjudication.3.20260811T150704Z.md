問題は、最新のレビューレポートに提出された指摘だけを、要求・ポリシー・現行コード・実行証跡へ照合し、後続工程へ渡す修正対象 family を一意に確定することです。まず正本の Policy／Knowledge／task 全文とレポート一覧を確認し、その後、各 finding の根拠箇所を現行コードで再検証します。読み取りのみ行い、編集・ゲート再実行はしません。
正本の確認では、要求の中心は PR 本文・通常コメント・review summary／thread の画像を、GitHub attachment に限定しつつ検証・保存し、`add --pr` と pipeline `--pr` の双方へ配線することです。最新提出物は `iteration-2--step-reviewers` の4レポートなので、ここに記載された finding ID を裁定母集団とし、過去の修正レポートは現行実装との照合用履歴としてのみ扱います。
現行コードで、3件の指摘は同一原因であることを確認しました。`resolveMaxImageAttachmentIndex()` が任意長の数字列を `Number` 化し、PR と retry の双方がその値を `+1`／`+=1` して採番しています。実行確認でも `9007199254740991` の次の2値が同じ `9007199254740992` になり、400桁値は `Infinity` となって既存 placeholder validator に拒否されました。通常の `[Image #1]` 衝突テストが成功していることは、この安全整数境界の反証にはなりません。
# 裁定結果

**修正対象あり**。最新レビューレポートの現行 finding 3件を、1つの actionable family に統合する。再計画は不要で、次工程は修正計画・remediation とする。

## 指摘ごとの裁定

| finding ID / 出典 | disposition | 統合先 |
|---|---|---|
| `ARCH-NEW-src-features-tasks-attachments-L31` / architecture-review | `actionable` | `image-attachment-index-precision` |
| `CODE-NEW-imageAttachmentIndex-L37` / coding-review | `duplicate` | `image-attachment-index-precision` |
| `AI-NEW-IMAGE-INDEX-PRECISION-31` / ai-antipattern-review | `duplicate` | `image-attachment-index-precision` |

testing-review と security-review に現行 finding ID はない。過去の resolved finding は今回の裁定母集団に含めない。

## Actionable family

### `image-attachment-index-precision`

破られている不変条件:

- 新規attachmentの `[Image #N]` と `image-N.ext` は、既存参照および同一バッチ内の他attachmentと重複しない。
- 採番結果は既存validatorが受理する正の10進番号であり、数値精度の喪失によって `Infinity` や重複値を生成しない。

確認済みの証拠:

- [attachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/attachments.ts:31) は任意長の数字列を `Number` に変換する。
- [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:564) と [retryTaskSpecAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/retryTaskSpecAttachments.ts:52) は、その値を加算して連続採番する。
- 実行確認では、`9007199254740991` の次の2値がともに `9007199254740992` となった。400桁の数字列は `Infinity` となり、[imageAttachmentReferences.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageAttachmentReferences.ts:7) のvalidatorに拒否される。
- 重複したfileNameは [attachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/attachments.ts:126) の保存境界で `Task attachment destination already exists` となる。
- 既存テストは通常の `[Image #1]` からの採番だけを確認しており、安全整数境界・任意長番号・複数画像の反例はない。

関係する契約経路:

- `takt add --pr` → `preparePrReviewAttachments` → `saveTaskFile`
- 対話CLI `--pr` → `resolvePrInput` → `preparePrReviewAttachments`
- pipeline `--pr` → `resolveTaskContent` → `prepareTaskSpecDirectory`
- retry attachment再注入 → `renumberRetryAttachments` → `prepareTaskSpecDirectory`

これは、PR画像を一意なattachmentとして保存し、本文から参照可能にするという一次要求に直接違反する。

## 受入条件

- 既存本文の任意長の画像番号を、精度を失わず衝突判定できる。
- 新規画像ごとに、既存参照・既存fileName・同一バッチ内の画像と重複しない正の10進番号を割り当てる。
- `Infinity`、指数表記、重複placeholder、重複fileNameを生成しない。
- `Number.MAX_SAFE_INTEGER`、安全整数超過値、400桁の値、および異なる2画像を含むケースをPR経路とretry経路で直接検証する。
- 通常範囲の採番、`[Image #N]`／`image-N.ext`形式、一時ファイルのcleanup、add・対話CLI・pipelineの既存契約を維持する。

## 修正境界

変更対象は、共通採番責務とPR・retryの直接回帰テストに限定する。`BigInt`、10進文字列、未使用安全番号の探索などは実装候補であり、特定方式は裁定では固定しない。

以下は除外する。

- Markdown構文対応や画像抽出範囲の拡大
- download、認証、MIME・magic bytes、サイズ制限の再設計
- 新しい互換経路、migration、fallback
- attachment公開形式の変更
- unrelatedな整理・広域リファクタリング
- reviewer提案を根拠とした新しい外部制限

適用したPolicy／Knowledgeは、レビュー裁定、最小内部修正、契約保持、Raw入力の正規化、呼び出しチェーン、境界値テスト、変更スコープである。Provider、WorkflowEngine、session、facet、E2E運用などは本findingに非適用。要追加確認および未解決の前提はない。