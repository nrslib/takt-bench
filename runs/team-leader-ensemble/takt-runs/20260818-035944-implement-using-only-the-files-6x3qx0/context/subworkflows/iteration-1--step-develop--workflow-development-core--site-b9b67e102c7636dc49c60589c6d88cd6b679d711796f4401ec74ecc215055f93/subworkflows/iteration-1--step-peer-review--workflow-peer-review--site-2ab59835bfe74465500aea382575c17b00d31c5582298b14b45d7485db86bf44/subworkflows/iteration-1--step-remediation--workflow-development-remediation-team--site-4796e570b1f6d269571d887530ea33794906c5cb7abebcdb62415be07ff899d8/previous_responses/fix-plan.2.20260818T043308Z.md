問題を要約すると、裁定済みの2つの修正対象 family（決定的な画像 placeholder と一時資源の lifecycle）について、実コードと正本資料を再確認し、fix step がそのまま実装できる境界付き計画を作成します。ソースは編集せず、指定された task・knowledge・policy と Report Directory の裁定結果を読み、実在する入口から終端までを追跡します。
指定された `order.md` は確認しました。現在の Report Directory には公開済み `fix-plan.md` と `fix-report.md` はありますが、`fix-verification.md` は見当たらず、内部レポートは台帳候補から除外する必要があります。続けて、指定された knowledge/policy の全文と、同一 remediation の公開成果物・上位裁定履歴を読みます。
裁定本文と公開 `fix-plan.md` を照合しました。対象は同じ2 familyで、`image-random-placeholder` は既存 family に統合済み、対象外の同期 I/O・throw 化は再採用しません。前回の `fix-report.md` は「fix-plan 未確認」とする未実施報告ですが、今回の計画では現行コードを再読して、placeholder と temp resource の終端を分けて具体化します。次に実コードの定義・呼び出し・consumer・失敗経路を確認します。
実コードの再構築で、採択 family に関する重要な差分が確認できました。現在の `downloadImage()` はすでに `imageIndex` から `[Image #n]` を生成しており、裁定に記載された `Math.random()` は現行ソースでは再現しません。一方、`addTask()` はダウンロード試行前に番号を増やすため、先行画像が失敗すると成功画像が `[Image #2]` から始まります。また、成功後の temp directory は外側 `finally` で削除する実装が既にありますが、現在はファイル単位追跡で、保存失敗・キャンセルを含む所有境界をより直接的に閉じる余地があります。裁定外の pipeline 新規配線や同期 I/O・throw 化は計画に追加しません。
問題を再確認した結果、裁定済みの修正対象は次の2 familyです。先行 `fix-verification.md` はなく、再発台帳の引き継ぎ行はありません。

### 指摘カバレッジ

| 指摘 | 対応 |
|---|---|
| `AI-NEW-imageUrls-L108` | `PR-IMG-PLACEHOLDER-1` |
| `image-random-placeholder` | 同 familyへ統合 |
| `AI-NEW-imageUrls-L90` | `PR-IMG-TEMP-LIFECYCLE-1` |
| `CODE-NEW-src-features-tasks-add-index-L148` | `no_issue_after_verification`、対象外 |
| `AI-NEW-imageUrls-L83` | `overreach`、非同期化しない |
| `AI-NEW-addTask-L223` | `overreach`、throw化しない |

### 修正単位1: `PR-IMG-PLACEHOLDER-1`

不変条件名は `pr-image-placeholder-deterministic-unique`、担当箇所は [`downloadImage()`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/shared/utils/imageUrls.ts:80>) とします。

現行コードでは、裁定に記載された `Math.random()` は存在せず、`imageIndex` から placeholder を生成しています。ただし [`addTask()`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/features/tasks/add/index.ts:218>) が取得前に番号を増やしているため、先行画像が失敗すると成功画像が `[Image #2]` から始まります。

修正内容:

- 成功済み attachment 数を基準に次の 1-based 番号を決める。
- ダウンロード・検証成功後に attachment を追加する。
- URL置換には手作業で再生成した placeholder ではなく、`downloadImage()` が返した値を使う。
- `buildTaskOrderContent()`、`promoteTaskAttachments()`、`resolveReferencedImageAttachments()` の既存契約は変更しない。
- ファイル名の hash 形式、URLフィルタ、pipeline新規配線、同期I/Oは変更しない。

確認状態:

- 画像0件: attachmentを生成しない。
- 画像1件: 実装上の index 0 を `[Image #1]` として保存する。
- 複数成功: `[Image #1]` から連番で重複しない。
- 先行失敗後に成功: 成功画像は `[Image #1]` から始める。
- `order.md`、保存済み attachment、後続 consumer が同じ placeholder を参照する。

### 修正単位2: `PR-IMG-TEMP-LIFECYCLE-1`

不変条件名は `pr-image-download-temp-finalization`、担当箇所は [`downloadImage()`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/shared/utils/imageUrls.ts:82>) の生成途中 cleanup と [`addTask()`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/features/tasks/add/index.ts:258>) の終端 cleanup とします。

現行コードには外側 `finally` があるため、既存 cleanup を維持しつつ、所有単位を一時ファイルではなく一時ディレクトリとして明確化します。

修正内容:

- `downloadImage()` が返した一時ディレクトリを保存直後から追跡する。
- `addTask()` の `finally` で、正常終了・保存失敗・workflow cancel・例外時に一時ディレクトリを回収する。
- `downloadImage()` と `validateAndSetImageExtension()` の取得途中失敗時 cleanup は維持する。
- `prepareTaskSpecDirectory()` の task directory cleanup は維持する。
- `.takt/tasks/.../attachments/` へ promote 済みの永続ファイルは cleanup 対象にしない。
- 強制終了や `process.exit()` は `finally` の保証外であり、今回の修正境界には含めない。

確認状態:

- 正常保存後: 一時資源は消え、永続 attachment は残る。
- 保存失敗後: task spec と取得用一時資源が消える。
- workflow cancel後: taskは作成せず、一時資源だけ回収する。
- `gh` 取得失敗・magic bytes検証失敗後: 一時資源を残さない。
- 画像0件: 一時ディレクトリを作成しない。

### 実施順序

1. 成功済み attachment 基準の placeholder 採番と producer 値の利用を修正する。
2. 一時ディレクトリの追跡・終端 cleanup を整理する。
3. [`addTask.test.ts`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/__tests__/addTask.test.ts:269>) に、成功・先行失敗・保存失敗・cancel後の placeholder、永続ファイル、一時資源を検証する回帰テストを追加または更新する。
4. 既存の attachment 保存・`order.md`・consumer 経路が保持されていることを確認する。

裁定で除外された同期I/Oの全面変更、画像処理例外のthrow化、外部URL対応、pipelineの新規配線、既存attachment機構の再設計は実施しません。