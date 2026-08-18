問題を要約すると、現在の裁定で修正対象となった内容を、実コードと指定された正本・ポリシー・履歴だけで再構築し、実装担当へ渡せる一貫した修正計画に整理する段階です。まず指定された `order.md`、Knowledge/Policy の全文、Report Directory の裁定・履歴、次に対象コードとテスト経路を確認します。ソースは編集しません。
指定された `context/task` には `order.md` だけが存在し、現在の remediation には `fix-report.md` と `fix-verification.md`、過去の remediation には `review-resolution.md` が確認できました。現在の remediation 内の先行検証を優先し、現行裁定が不在である事実も含めて、継承条件を確認します。続けて正本とポリシーを全文読了します。
正本は、PR 本文・通常コメント・review thread の各画像記法を対象に、形式検証、サイズ上限、認証済み GitHub 取得、attachment 保存、`order.md` 参照、`--pr` pipeline 配線を要求しています。ポリシー上は、生成から保存・消費までの全入口を同じ契約で追跡し、品質ゲート自体を finding にせず、対象コードで変更前の失敗を検出できる回帰証拠を計画へ含める必要があります。次に、現在の remediation の先行成果物と過去の裁定を読みます。
実コードの再確認で、前回検証が未達とした2点の状態に差異がありました。現在の `imageUrls.ts` は抽出候補を位置付きで集約してから `position` 順に並べ、`downloadImage()`・`validateAndSetImageExtension()` は `fs.rmSync` を使っています。`addTask()` の外側 `finally` も `fs.rmSync` です。一方、`addTask.test.ts` には PR 画像の順序・失敗後採番・一時資源回収を観測するテストがなく、前回レポートの実証不足は残っています。コードの成立を読み取り専用の最小実行で確認してから、修正と検証を分離した計画にします。
調査結果に基づく修正計画は、既存の2 familyに限定します。新規 finding は追加しません。現在のソースには前回未達とされた本番修正が既に反映されているため、主な残作業は回帰検証の追加です。

## 引き継ぐ不変条件

| Family | 不変条件 | 担当箇所 | 状態 |
|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `pr-image-placeholder-deterministic-unique` | `imageUrls.ts` の `downloadImage()` による placeholder 生成 | 検証回数1、累積 `incomplete` 1、別経路再発未確認 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `pr-image-download-temp-finalization` | `addTask()` PR 経路の一時ディレクトリ所有境界 | 検証回数1、累積 `incomplete` 1、別経路再発未確認 |

引き継ぎ元は同一 remediation の `fix-verification.md` です。台帳の既存13項目は変更しません。

## 原因の再確認

- `imageUrls.ts:20-52` は Markdown/HTML の候補を位置付きで集約し、出現位置でソートしています。混在記法でも本文順になることを最小実行で確認しました。
- `imageUrls.ts:166`、`imageUrls.ts:224`、`add/index.ts:283` はすべて `fs.rmSync(..., { recursive: true, force: true })` です。対象経路に旧 `rmdirSync(..., { recursive: true })` は残っていません。
- `addTask()` は `attachments.length` を採番値として渡し、検証成功後にだけ attachment を追加します。先行失敗が番号を消費しない構造です。
- `src/infra/task/enqueueService.ts:165` の `rmdirSync` は空の親ディレクトリを削除する既存 task spec cleanup であり、今回の PR 画像用一時ディレクトリとは別責務のため変更しません。

## 修正単位1: `PR-IMG-PLACEHOLDER-1`

本番コードの追加変更は不要です。現在の採番・抽出順を維持し、未検証だった契約をテストで固定します。

対象経路は次のとおりです。

`addTask()` → `fetchPrReviewComments()` → `allText` → `extractImageUrls()` → URL 重複排除 → `filterGithubAttachmentUrls()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` → `order.md`・`attachments/` → task execution consumer

確認する状態は以下です。

- `"<img src=\".../html\"> ![md](.../md) <img src='.../single'>"`  
  → URL が `html`, `md`, `single` の順で抽出される。
- 画像2件が成功  
  → `[Image #1]`, `[Image #2]` が順序どおり生成され、本文・`order.md`・保存済み attachment で一致する。
- 同一 URL が複数箇所にある  
  → URL 重複排除により1 attachmentだけ生成される。
- 先行画像が失敗し、後続画像が成功  
  → 後続画像が `[Image #1]` となり、`[Image #2]` は生成されない。
- 画像 URL が0件  
  → attachment 処理を行わず、既存の task 保存結果を維持する。

テストは `src/__tests__/imageUrls.test.ts` に抽出順・採番を追加し、`src/__tests__/addTask.test.ts` で PR 取得から `order.md` と保存済み attachment までの配線を確認します。

## 修正単位2: `PR-IMG-TEMP-LIFECYCLE-1`

現在の cleanup API は適合しているため、既存の所有境界を変更せず、各終端の観測証拠を追加します。

対象経路は次のとおりです。

`downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` → `.takt/tasks/.../attachments/`  
保存成功・保存失敗・cancel 後は `addTask()` の `finally` で取得用一時資源を削除します。

確認する状態は以下です。

- `gh api` がファイル作成前に失敗  
  → `downloadImage()` 内で一時ディレクトリが削除される。
- magic bytes が PNG/JPEG/GIF/WebP のいずれにも該当しない  
  → attachment に追加せず、取得用一時資源を削除する。
- PNG、JPEG、GIF、WebP  
  → それぞれ `.png`、`.jpg`、`.gif`、`.webp` として保存される。
- 保存成功  
  → 永続 task attachment は残り、取得用一時ディレクトリだけが削除される。
- 保存失敗  
  → task spec と取得用一時資源が残らない。
- workflow cancel  
  → task を作成せず、取得用一時資源を削除する。
- 画像0件  
  → 一時ディレクトリを生成しない。

`src/__tests__/imageUrls.test.ts` で取得失敗・検証失敗を、`src/__tests__/addTask.test.ts` で保存成功・cancel 後の一時資源と永続 attachment を確認します。既存の `saveTaskFile.test.ts` の task attachment 保存契約は変更せず、検証のみ行います。

## 実施順序

1. `PR-IMG-PLACEHOLDER-1` の抽出順・採番回帰テストを追加。
2. `PR-IMG-TEMP-LIFECYCLE-1` の取得失敗・検証失敗・保存成功・cancel 回帰テストを追加。
3. 既存の `saveTaskFile()`、`order.md`、task execution の attachment consumer との整合を確認。

pipeline の新規画像配線、外部 URL 範囲の拡張、同期 I/O の非同期化、個別画像失敗時の throw 化、汎用 attachment 機構の変更は、現在の裁定範囲外のため計画に含めません。