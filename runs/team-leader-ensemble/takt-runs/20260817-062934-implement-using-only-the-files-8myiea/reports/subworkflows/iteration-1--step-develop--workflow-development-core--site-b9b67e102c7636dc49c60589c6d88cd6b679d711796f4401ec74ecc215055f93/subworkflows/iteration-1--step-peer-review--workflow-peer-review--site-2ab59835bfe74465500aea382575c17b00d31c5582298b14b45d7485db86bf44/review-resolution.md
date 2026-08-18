# レビュー指摘裁定

## 結果: 修正対象あり

## 裁定サマリー

対象レポートは `coding-review.md`、`ai-antipattern-review.md`、`architecture-review.md` です。

修正対象 family は2件、提出 finding は6件です。`actionable` 2件、`duplicate` 1件、非修正対象3件です。`AI-NEW-imageUrls-L108` と `image-random-placeholder` は同一原因として統合します。

## 要件の判定根拠

| 対象 | 状態 | 根拠 |
|------|------|------|
| `CODE-NEW-src-features-tasks-add-index-L148` | 解消済み | 現行の `src/features/tasks/add/index.ts:199-242` で画像抽出、ダウンロード、検証、`saveTaskFile(..., { attachments })` まで実行される。 |
| `PR-IMG-PLACEHOLDER-1` | 未充足 | `src/shared/utils/imageUrls.ts:108` で `Math.random()` を使っており、placeholder が実行ごとに変化し、重複も起こり得る。 |
| `PR-IMG-TEMP-LIFECYCLE-1` | 未充足 | `src/shared/utils/imageUrls.ts:90-110` で一時ディレクトリを作成して成功時に返却するが、保存後の削除経路がない。 |
| 同期 I/O の非同期化要求 | 対象外 | 同期 API の使用は確認できるが、性能要件、測定証拠、非同期化を要求する受入条件は確認できない。 |
| 画像処理例外の throw 要求 | 対象外 | `log.warn` による個別失敗継続は確認できるが、全体を失敗させる契約は確認できない。 |

## 再発台帳の引き継ぎ

引き継ぎ元: 先行 remediation なし

Report Directory 直下に数値 `N` を持つ remediation の `fix-verification.md` は存在しません。.takt-report-internal 配下は候補から除外しています。そのため、引き継ぐ不変条件行はありません。

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|----------|------------------|------------------|----------|----------|------------------------|-------------------------|--------------------|------------|--------------|

## 修正対象 family

| family | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | finding ID / 出典 | 修正権限の根拠 | 根拠 | 問題 → 根本原因 | 追加した経路 | 関係する契約経路 | 受入条件 | 修正境界 |
|--------|----------|----------------------|--------------------------|-------------------|----------------|------|-------------------|--------------|--------------------|----------|----------|
| `PR-IMG-PLACEHOLDER-1` | `src/shared/utils/imageUrls.ts:83-110` の `downloadImage()` | PR画像 attachment の placeholder が決定的かつ一意で、task本文・`order.md`・attachment consumer で同じ値になる | PR画像を既存の `TaskAttachment` 契約へ接続するため | `AI-NEW-imageUrls-L108` / `ai-antipattern-review.md`; `image-random-placeholder` / `architecture-review.md` | 受入条件の直接違反 | `Math.random()` により placeholder が実行ごとに変化する。`buildTaskOrderContent()` と `resolveReferencedImageAttachments()` が placeholder を参照する | なし | `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `buildTaskOrderContent()` → `order.md` / attachment consumer。重複 placeholder は `resolveReferencedImageAttachments()` で拒否される | 同一入力で placeholder が変化せず、同一処理内で重複せず、既存の保存形式を維持する | placeholder の採番に必要な最小変更のみ。同期 I/O の全面変更、外部URL対応、pipeline の新規配線、既存保存機構の再設計は除外 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `src/shared/utils/imageUrls.ts:90-110` の一時ファイル所有処理 | PR画像取得で作成した一時ファイル・一時ディレクトリが、成功・保存失敗・キャンセルの終端で回収され、永続 task attachment は保持される | 今回追加した画像取得処理の一時資源を、既存 task attachment 保存経路の終端まで閉じるため | `AI-NEW-imageUrls-L90` / `ai-antipattern-review.md` | 今回差分が導入した退行 | `mkdtempSync()` で作成した資源は、失敗時には一部削除されるが、成功後に `promoteTaskAttachments()` がコピーした後の削除経路がない | なし | `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` → `.takt/tasks/.../attachments/`。保存後の `addTask()` 終端まで cleanup がない | 正常終了・保存失敗・キャンセル後に取得用一時資源が残らず、保存済み task attachment は残る | cleanup の所有と終端接続に必要な最小変更のみ。transaction、rollback、非同期 I/O への全面変更、既存 attachment 機構の変更は除外 |

## 指摘ごとの裁定

| finding ID / 出典 | 技術的妥当性 | 裁定 | 対象 family | 同じ原因で変更される理由 | 合流根拠 | authorization basis | 初回に含まれなかった理由 | 根拠 |
|-------------------|----------------|------|-------------|--------------------------|----------|---------------------|--------------------------|------|
| `CODE-NEW-src-features-tasks-add-index-L148` / `coding-review.md` | 反証済み | `no_issue_after_verification` | なし | 該当なし | 現行 `addTask` に抽出・ダウンロード・保存の呼び出しが存在する | なし | 該当なし | `src/features/tasks/add/index.ts:199-242` |
| `AI-NEW-imageUrls-L108` / `ai-antipattern-review.md` | 確認済み | `actionable` | `PR-IMG-PLACEHOLDER-1` | PR画像 attachment の placeholder 契約を成立させる同一原因 | `Math.random()` による不安定な placeholder 生成を指摘している | `direct_acceptance_criterion_violation` | 該当なし（初回レビュー） | `src/shared/utils/imageUrls.ts:108` |
| `AI-NEW-imageUrls-L83` / `ai-antipattern-review.md` | 方式の使用は確認済み、退行は未確認 | `overreach` | なし | 該当なし | 非同期化という方式要求を裏付ける性能契約・測定証拠がない | なし | 該当なし（初回レビュー） | `execFileSync`、同期 filesystem API の使用だけでは今回の修正権限を満たさない |
| `AI-NEW-imageUrls-L90` / `ai-antipattern-review.md` | 確認済み | `actionable` | `PR-IMG-TEMP-LIFECYCLE-1` | 今回追加した画像取得資源の終端管理に属する | 一時ディレクトリ作成後、成功時の cleanup がない | `remediation_regression` | 該当なし（初回レビュー） | `src/shared/utils/imageUrls.ts:90-110`、`src/features/tasks/attachments.ts:99-107` |
| `AI-NEW-addTask-L223` / `ai-antipattern-review.md` | 継続ログ処理は確認済み、修正必要性は未確認 | `overreach` | なし | 該当なし | `log.warn` は例外を無視する空処理ではなく、全体を throw する契約もない | なし | 該当なし（初回レビュー） | `src/features/tasks/add/index.ts:213-225` |
| `image-random-placeholder` / `architecture-review.md` | 確認済み | `duplicate` | `PR-IMG-PLACEHOLDER-1` | `AI-NEW-imageUrls-L108` と同じ | 同じファイル、同じ行、同じ placeholder 不変条件を指摘している | なし | 該当なし（初回レビュー） | `src/shared/utils/imageUrls.ts:108` |

## 未解決の前提

- なし。