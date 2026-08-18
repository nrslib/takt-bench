問題の修正計画を作成するため、まず指定された `order.md`、Knowledge、Policy を末尾まで確認し、Report Directory の現行裁定・履歴と実コードの4ファイルを照合します。編集・コミット・ステージングは行わず、採用済みの問題だけを不変条件単位の実行計画へ整理します。
指定されたタスク仕様と Knowledge は確認しました。Policy は約1,500行あるため分割して末尾まで読み、その後に現行の `fix-plan.md`、`fix-report.md`、`fix-verification.md` と4つの変更対象ファイルを再確認します。
現行 remediation には `review-resolution.md` がなく、同一 remediation の `fix-verification.md` が直近の引き継ぎ元です。そこでは、同じ2つの不変条件について「抽出順」と「一時資源 cleanup API」の未達が確認されています。これを既存 family として扱い、実コードで現在も残っているか、また指摘対象4ファイル以外に同じ原因の実在経路があるかを確認します。
## 修正計画確定

現行 remediation に `review-resolution.md` はありません。既存の family は先行裁定と同一 remediation の `fix-verification.md` から引き継ぎます。新しい family や finding ID は追加しません。

| 修正単位 | 対象 | 状態 |
|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `AI-NEW-imageUrls-L108`、`image-random-placeholder`、`PR-IMG-PLACEHOLDER-ORDER-1` | 同一の placeholder 不変条件へ統合 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `AI-NEW-imageUrls-L90` | 継続。cleanup と画像形式検証を完了させる |
| 対象外 | 同期 I/O、個別画像失敗時の `log.warn`、pipeline の新規画像配線 | 再採用しない |

### 根本原因

- `downloadImage()` は現在 `successCount + 1` で採番し、`extractImageUrls()` も位置順ソートを行っているため、旧ランダム採番・旧抽出順問題の実装は現在確認できない。
- ただし、`imageUrls.test.ts` の混在記法テストは HTML を先に置いており、記法別の別走査による逆順を検出できない。
- `addTask.test.ts:40-46` のモックが `vi.mock` の hoisting 前の変数を参照するため、テストスイート自体が収集前に失敗する。さらに、テスト内の保存モックは `addTask/index.ts` が実際に import する `enqueuedTaskFile.js` ではなく、別モジュールを対象にしている。
- Node `v25.7.0` で現行 cleanup API は `fs.rmSync` に置換済みである。
- 画像形式判定は `downloadImage()` と `validateAndSetImageExtension()` に重複しており、GIF89a の判定が `0x37` になっている。実行確認でも `GIF89a-data` が `Unsupported image format` になった。

### 実施内容

1. `PR-IMG-PLACEHOLDER-1`

   - [imageUrls.test.ts](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/__tests__/imageUrls.test.ts:20>) の混在記法を Markdown → HTML double quote → HTML single quote の順にし、本文出現順を検証する。
   - 重複 URL は初出順を維持して1件へ集約する。
   - `addTask.test.ts` では成功画像を `attachments.length` の 0-based 値から `[Image #1]` の 1-based placeholder へ変換し、失敗画像が番号を消費しないことを確認する。
   - 本文、`order.md`、保存済み attachment の placeholder が一致することを確認する。
   - `downloadImage()` を placeholder の単一 producer とし、URL hash や乱数による採番は追加しない。

2. `PR-IMG-TEMP-LIFECYCLE-1`

   - [imageUrls.ts](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/shared/utils/imageUrls.ts:115>) の画像形式判定を非公開の単一責務へ集約し、`downloadImage()` と `validateAndSetImageExtension()` が同じ判定結果を使うようにする。
   - PNG、JPEG、GIF87a、GIF89a、WebP を許可し、それ以外は拒否する。GIF89a は `0x39` を判定する。
   - `downloadImage()` 内の取得失敗・形式不正 cleanup、`addTask()` 外側 `finally` の保存成功・保存失敗・cancel cleanup、永続 attachment の保持を維持する。
   - `rmdirSync` の置換は PR 画像の一時資源経路に限定し、`enqueueService.ts` の別責務の親ディレクトリ cleanup は変更しない。
   - `addTask.test.ts` では hoisted mock を修正し、実在する一時ファイルを使って、取得失敗・検証失敗・保存失敗・cancel 後の一時ディレクトリ消去を観測する。

### 経路と期待結果

- `program.command('add')` → `addTask()` → `fetchPrReviewComments()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` → `.takt/tasks/.../order.md` と `attachments/`
- 保存後は `resolveTaskSpecForExecution()` → `stageTaskSpecForExecution()` → `copyTaskAttachmentsToRunContext()` で run context へ復元され、既存 consumer が同じ placeholder を参照する。
- 画像なしでは download・一時ディレクトリ生成を行わない。
- Markdown、HTML double quote、HTML single quote は本文の位置順で処理する。
- 重複 URL は1 attachment、先行失敗後の成功画像は `[Image #1]` になる。
- 保存成功時は永続 attachment を保持し、一時資源だけを削除する。
- 取得失敗、形式不正、保存失敗、workflow cancel では task が不正に残らず、一時資源も残さない。

`src/features/tasks/add/index.ts` の現行 producer・保存・cleanup 配線、既存の task attachment consumer、pipeline 経路は変更せず検証対象とします。`addTask.test.ts` のテスト基盤修正後、unit と heavy integration の担当 runner で回帰証拠を取得します。品質ゲートの実行順は後続の fix 指示に従います。

継承する不変条件台帳の検証回数・累積 `incomplete` 回数・既存経路は変更しません。