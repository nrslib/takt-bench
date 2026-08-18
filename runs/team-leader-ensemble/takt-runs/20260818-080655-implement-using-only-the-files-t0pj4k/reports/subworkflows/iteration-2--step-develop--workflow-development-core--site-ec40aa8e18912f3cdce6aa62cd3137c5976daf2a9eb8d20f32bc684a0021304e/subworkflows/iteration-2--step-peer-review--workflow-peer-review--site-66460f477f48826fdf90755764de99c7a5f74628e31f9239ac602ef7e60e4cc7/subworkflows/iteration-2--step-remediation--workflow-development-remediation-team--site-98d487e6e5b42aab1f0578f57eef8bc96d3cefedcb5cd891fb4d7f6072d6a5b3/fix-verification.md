# 修正完了検証

## 結果: plan_invalid

## サマリー

修正計画は、primary spec の必須経路・制約と不整合しています。

- `order.md:23,47` の pipeline `--pr` 経路が計画対象から除外されています。
- `order.md:35-37` の Content-Type 検証が計画・実装確認範囲に含まれていません。
- `GIF89a` の magic bytes 判定が誤っており、対応形式の受入条件を満たしていません。
- 画像単体テストは `createHash` 未定義で5件失敗し、`addTask` テストも実在しない一時ファイルを返す test double により6件失敗しています。
- attachment 保存・復元 consumer の既存テスト70件は成功しました。
- `fix-report.md` は計画済み2不変条件の台帳を引き継いでおらず、成果物不足があります。

## 不変条件の再発記録

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|----------------|----------|----------------|----------------|----------|----------|------------------------|--------------------------|------------------------------|------------|--------------|
| `PR-IMG-PLACEHOLDER-1` | `PR-IMG-PLACEHOLDER-1` | `pr-image-placeholder-deterministic-unique` | `src/shared/utils/imageUrls.ts` の `downloadImage()` による placeholder 生成契約 | 2（fix-plan の既知値1から更新） | 1 | `addTask()` → `extractImageUrls()` → URL重複排除 → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` | 同じ経路。本文置換・保存 consumer の実行証拠が未確認 | 同一 | 2 | 判定できない（fix-report の台帳欠落） | `downloadImage()` を単一 producer とし、実在ファイルを用いた addTask 統合検証点を維持する | 理由付き成果物不足 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `PR-IMG-TEMP-LIFECYCLE-1` | `pr-image-download-temp-finalization` | `addTask()` PR経路の一時ディレクトリ所有境界 | 2（fix-plan の既知値1から更新） | 1 | `downloadImage()` の取得失敗 cleanup、validator の検証失敗 cleanup、`addTask()` の保存成功・保存失敗・cancel cleanup | `downloadImage()` / `validateAndSetImageExtension()` の GIF89a 判定、addTask の実ファイル保存・失敗・cancel 検証経路 | 別（fix-report 欠落のため最終判定は判定できない） | 2 | 判定できない（fix-report の台帳欠落） | magic bytes 判定の単一強制点と、addTask 外側 `finally` の実ファイル検証 | 理由付き成果物不足・理由付き計画不足 |

## 修正単位の整合性

| 修正単位 | 対象 finding | 前提・方法・証拠能力の整合性 | 判定 |
|----------|--------------|------------------------------|------|
| `PR-IMG-PLACEHOLDER-1` | `AI-NEW-imageUrls-L108`、`PR-IMG-PLACEHOLDER-ORDER-1`、`image-random-placeholder` | 成功件数による採番と位置付き抽出は addTask 経路に適合するが、primary spec の pipeline 経路が計画に含まれていない | 計画不備 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `AI-NEW-imageUrls-L90` | cleanup の主要方式は適合するが、Content-Type 検証が計画に含まれず、GIF89a の実装も不正 | 計画不備 |

## 完了義務の独立検証

| 修正単位 | 義務ID | 対象 finding | 不変条件と対象経路 | 独立に用いた反例・観測点 | 観測結果 | 証拠 | 判定 |
|----------|--------|--------------|--------------------|----------------------------|----------|------|------|
| `PR-IMG-PLACEHOLDER-1` | `SCN-PR-IMG-PLACEHOLDER-1-P1` | `AI-NEW-imageUrls-L108`、`PR-IMG-PLACEHOLDER-ORDER-1` | 混在記法の本文初出順 | Markdown、HTML double quote、HTML single quote の混在入力 | 成立 | `imageUrls.test.ts`、11件成功 | 完了 |
| `PR-IMG-PLACEHOLDER-1` | `SCN-PR-IMG-PLACEHOLDER-1-N1` | `AI-NEW-imageUrls-L108` | plain URL を抽出しない | 通常 URL と画像記法の混在 | 成立 | `imageUrls.test.ts` | 完了 |
| `PR-IMG-PLACEHOLDER-1` | `SCN-PR-IMG-PLACEHOLDER-1-P2` | `AI-NEW-imageUrls-L108` | 本文・`order.md`・保存 attachment の placeholder 一致 | 実在しない一時ファイルを返す addTask test double、画像 URL を含まない formatter 出力 | 未確認 | `addTask.test.ts:457-460,505-508,540-544`、同テスト6件失敗 | 未完了 |
| `PR-IMG-PLACEHOLDER-1` | `SCN-PR-IMG-PLACEHOLDER-1-N2` | `AI-NEW-imageUrls-L108` | 先行失敗が後続成功の番号を消費しない | 先行 download 失敗後の後続成功 | 成立 | `addTask.test.ts`、対象テスト成功 | 完了 |
| `PR-IMG-PLACEHOLDER-1` | `PR-IMG-DUPLICATE-1` | `PR-IMG-PLACEHOLDER-ORDER-1` | URL 重複を一 attachment に集約 | 重複 URL の抽出と初出順 | 成立 | `imageUrls.test.ts`、`extractImageUrls()` の Set | 完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-FORMAT-PNG` | `AI-NEW-imageUrls-L90` | PNG を受理し `.png` で保存 | PNG magic bytes | 成立 | 現行判定ロジック、前回の直接確認記録 | 完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-FORMAT-JPEG` | `AI-NEW-imageUrls-L90` | JPEG を受理し `.jpg` で保存 | JPEG magic bytes | 成立 | 現行判定ロジック、前回の直接確認記録 | 完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-FORMAT-GIF` | `AI-NEW-imageUrls-L90` | `GIF87a` / `GIF89a` を受理 | 標準 `GIF89a` ヘッダー | 違反 | `imageUrls.ts:132-135,192-195` は `0x39` の後に `0x37` を比較し、`GIF89a` の `0x61` を受理しない | 未完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-FORMAT-WEBP` | `AI-NEW-imageUrls-L90` | WebP を受理し `.webp` で保存 | `RIFF....WEBP` ヘッダー | 未確認 | 現行コードの判定は修正済みだが、`imageUrls.test.ts` が setup 前に失敗 | 未完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-MAGIC-REJECT` | `AI-NEW-imageUrls-L90` | unsupported bytes を拒否し cleanup | 不正 magic bytes | 成立 | validator の例外処理と recursive cleanup、前回直接確認記録 | 完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `PR-IMG-TEMP-LIFECYCLE-T1` | `AI-NEW-imageUrls-L90` | 取得失敗後に cleanup | `gh api` 取得失敗 | 成立 | `downloadImage()` の catch cleanup、前回404直接確認記録 | 完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `PR-IMG-TEMP-LIFECYCLE-T2` | `AI-NEW-imageUrls-L90` | 検証失敗後に cleanup | 不正 magic bytes | 成立 | `validateAndSetImageExtension()` の catch cleanup、前回直接確認記録 | 完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-SAVE-SUCCESS` | `AI-NEW-imageUrls-L90` | 永続 attachment を保持し temp のみ削除 | addTask の実在ファイル保存 | 未確認 | test double が `/tmp/takt-image-*.png` の実在しないパスを返し、保存前に失敗 | 未完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-SAVE-FAILURE` | `AI-NEW-imageUrls-L90` | 保存失敗時に temp cleanup と例外伝播 | 保存失敗 test double | 未確認 | `vi.mock()` が実行時の既存 import に適用されず、保存失敗経路を観測できない | 未完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-CANCEL` | `AI-NEW-imageUrls-L90` | 画像付き cancel 時に保存せず cleanup | cancel 経路と実在 temp 状態 | 未確認 | cancel テストは画像付き実ファイル状態を観測していない | 未完了 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-RUN-CONTEXT` | `AI-NEW-imageUrls-L90` | 永続 attachment を run context へ復元 | manifest、copy、run-context | 成立 | attachment consumer テスト70件中の task context テスト | 完了 |

## 不成立・未確認事項

| 修正単位 | 義務ID | 種別 | 根拠 | 修正報告の証拠が検出できなかった理由 | 同じ検出パターンで再監査した範囲 | 必要な対応 |
|----------|--------|------|------|----------------------------------------|----------------------------------|--------------|
| `PR-IMG-PLACEHOLDER-1` | `SCN-PR-IMG-PLACEHOLDER-1-P2` | 証拠不足 | addTask の成功画像テストが `assertRegularImageAttachmentFile` で失敗し、本文に画像 URL を含む formatter 出力もない | 実在ファイルを使わない test double と、画像 URL を含まない fixture のため、本文置換・保存・consumer の対応を観測できない | 実在する一時ディレクトリ・画像ファイルを返す test double に置換し、保存された `order.md` の本文置換と attachment 対応を検証する |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-FORMAT-GIF` | 実装不足 | `GIF89a` の標準ヘッダーを拒否する比較式が `downloadImage()` と validator の両方にある | 形式別テストは `createHash` 未定義で実行前に失敗したが、コード照合で実装不備を確認できた | 両判定で `GIF89a` を受理し、形式別回帰テストを実行可能にする |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-FORMAT-WEBP` | 証拠不足 | 現行の `RIFF....WEBP` 判定は存在するが、標準 WebP テストを実行できていない | `imageUrls.test.ts:114,146,178,214,244` の `createHash` 未定義により5件が失敗 | test setup を修正し、WebP の受理と `.webp` 保存を実行確認する |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-SAVE-SUCCESS` | 証拠不足 | addTask の成功保存テストが実在しない `/tmp/takt-image-*.png` を返す | `promoteTaskAttachments()` は regular file を要求するため、保存 consumer に到達しない | 実在ファイルを返す test double で永続 attachment 保持と temp 削除を確認する |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-SAVE-FAILURE` | 証拠不足 | 保存失敗を注入する `vi.mock()` が遅すぎ、実際の保存例外を発生させていない | addTask の保存失敗テストを再監査 | import 前のモックまたは注入可能な保存境界で失敗を発生させ、例外伝播と cleanup を確認する |
| `PR-IMG-TEMP-LIFECYCLE-1` | `T-PR-IMG-CANCEL` | 証拠不足 | 画像付き cancel の temp 状態を観測していない | cancel 経路を再監査 | 実在画像を用い、workflow `null` 後に task 未作成・temp 削除を確認する |
| `PR-IMG-TEMP-LIFECYCLE-1` | `order.md:23,47` | その他の計画不備 | pipeline `--pr` が必須だが、fix-plan は pipeline を変更対象外としている | 計画の bounded graph が `addTask()` 経路だけで、pipeline の producer・consumer・terminal を含まない | fix-plan に pipeline `--pr` 経路を追加し、attachment の生成から実行時 consumer までを計画する |
| `PR-IMG-TEMP-LIFECYCLE-1` | `order.md:35-37` | その他の計画不備 | Content-Type 検証が primary spec にあるが、計画は magic bytes のみを対象にしている | 画像取得・検証経路を再監査 | Content-Type と magic bytes の両方を有限集合として計画・実装・テストする |
| なし | `fix-report.md` 不変条件台帳 | 証拠不足 | fix-report が「fix-plan未取得」の placeholder 行のみで、計画済み2 family の台帳を欠落させている | fix-verifier の履歴入力である台帳を復元できない | fix-plan の2行を使って台帳を再構築し、欠落理由を成果物不足として引き継ぐ |

## 環境要因により実証できない後続確認（判定非ブロッキング）

| 対象 | 環境要因 | リポジトリ内で解消不能な根拠 | 現在確認した代替証拠 | 後続確認 |
|------|----------|------------------------------|--------------------------|----------|
| なし | なし | Node.js、filesystem、テスト runner は利用可能で、失敗は環境ではなく実装・test double・fixture に起因する | 対象テスト実行、静的コード照合、既存 consumer テスト | なし |

## 実行証跡

| 対象 | 方法 | 結果 |
|------|------|------|
| 抽出順・重複排除・plain URL 除外 | `npm test -- src/__tests__/imageUrls.test.ts` | 11件成功、5件失敗。`createHash` 未定義 |
| addTask PR 経路 | `npm test -- src/__tests__/addTask.test.ts` | 18件成功、6件失敗。実在しない temp path と不成立な保存失敗検証 |
| attachment 保存・復元 consumer | `npm test -- src/__tests__/imageAttachmentReferences.test.ts src/__tests__/imageAttachments.test.ts src/__tests__/saveTaskFile.test.ts src/__tests__/taskSpecContext.test.ts` | 70件成功 |
| GIF magic bytes | `src/shared/utils/imageUrls.ts:132-135,192-195` のコード照合 | 失敗。標準 `GIF89a` を拒否 |
| WebP magic bytes | `src/shared/utils/imageUrls.ts:137-140,197-200` のコード照合 | 判定ロジックは成立、実行テストは未確認 |
| 取得失敗 cleanup | `downloadImage()` の catch と recursive cleanup のコード照合、および前回直接確認記録 | 成立 |
| 検証失敗 cleanup | `validateAndSetImageExtension()` の catch と recursive cleanup のコード照合、および前回直接確認記録 | 成立 |
| build | fix-report の品質ゲート記録 | 未実施 |
| lint | fix-report の品質ゲート記録 | 未実施 |