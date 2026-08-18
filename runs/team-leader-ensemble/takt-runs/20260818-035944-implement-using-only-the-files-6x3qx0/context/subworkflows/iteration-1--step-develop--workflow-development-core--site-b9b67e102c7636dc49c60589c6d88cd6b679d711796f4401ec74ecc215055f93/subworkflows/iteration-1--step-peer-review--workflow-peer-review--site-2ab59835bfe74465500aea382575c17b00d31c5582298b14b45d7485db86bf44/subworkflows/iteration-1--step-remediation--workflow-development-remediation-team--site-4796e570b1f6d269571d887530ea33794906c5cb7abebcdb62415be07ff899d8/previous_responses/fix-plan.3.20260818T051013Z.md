問題の正本・裁定・再発台帳を先に確認し、許可された2つの修正 family について現行コードの全経路と受入条件を対応付けます。ソースは編集せず、計画だけを確定します。
指定された task spec と fix-plan の Knowledge/Policy は全体を確認しました。次に、現在の裁定・同一 remediation の先行成果物・レビュー証跡を照合し、先行 fix-verification の有無と不変条件台帳の扱いを確定します。
現行コードでは、裁定本文にある旧 `Math.random()` は既に存在せず、連番化と `addTask()` の後処理が部分的に入っています。ただし、placeholder の正本が `downloadImage()` と caller に分散し、同一URLの複数参照では置換順と attachment がずれる余地があります。また cleanup は成功済みファイルだけを条件付きで追跡しています。これを同じ2 family内の残存契約として、既存保存経路を変えない計画に整理します。
調査結果として、修正計画は2つの既存 family に限定して確定できます。ソースは編集していません。

## 指摘カバレッジ

| Finding | 対応 |
|---|---|
| `AI-NEW-imageUrls-L108` | `PR-IMG-PLACEHOLDER-1` |
| `image-random-placeholder` | 同じ `PR-IMG-PLACEHOLDER-1` へ統合 |
| `AI-NEW-imageUrls-L90` | `PR-IMG-TEMP-LIFECYCLE-1` |
| `CODE-NEW-src-features-tasks-add-index-L148` | `no_issue_after_verification`。再修正しない |
| `AI-NEW-imageUrls-L83` | `overreach`。同期I/Oを変更しない |
| `AI-NEW-addTask-L223` | `overreach`。警告継続契約を変更しない |

先行 remediation の公開 `fix-verification.md` は存在せず、`.takt-report-internal` は引き継ぎ対象外です。

## 確認した根本原因

- 現行コードに旧レビューの `Math.random()` は存在しません。
- ただし、`downloadImage()` が `placeholder: ''` を返し、`addTask()` が別途 placeholder を生成しているため、placeholder の正本が分散しています。
- `filterGithubAttachmentUrls()` は同一URLを重複して返します。現行のファイル名はURLハッシュ由来なので、同一URLを複数回保存すると `promoteTaskAttachments()` の保存先が衝突します。
- 一時資源は現在も `addTask()` の `finally` で一部回収されていますが、ファイル単位・存在確認条件付きです。取得用ディレクトリ単位の所有境界へ整理します。

## 修正単位1: `PR-IMG-PLACEHOLDER-1`

対象:

- [`src/shared/utils/imageUrls.ts`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/shared/utils/imageUrls.ts:80>)
- [`src/features/tasks/add/index.ts`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/features/tasks/add/index.ts:214>)

不変条件名は `pr-image-placeholder-deterministic-unique` を維持します。

実装方針:

1. `addTask()` で対象URLを初出順に重複排除する。
2. `attachments.length + 1` を1-basedの画像番号として `downloadImage()` に渡す。
3. `downloadImage()` が `[Image #N]` を生成して返し、空の placeholder を返さないようにする。
4. caller側で placeholder を再生成せず、返却値を本文置換・保存へ使用する。
5. 失敗した画像は番号を消費しない。
6. `buildTaskOrderContent()`、`promoteTaskAttachments()`、`order.md`、既存 consumer の形式は変更しない。

確認する状態:

- 画像0件
- 画像1件成功
- 複数画像成功
- 先行画像失敗後に後続画像が成功
- 同一URLが複数箇所に出現
- 同一入力を繰り返した場合

期待結果は、保存された attachment、本文参照、`order.md` の `[Image #N]` が一致し、placeholder の重複や保存先衝突がないことです。

## 修正単位2: `PR-IMG-TEMP-LIFECYCLE-1`

対象:

- [`src/shared/utils/imageUrls.ts`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/shared/utils/imageUrls.ts:82>)
- [`src/features/tasks/add/index.ts`](</Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/src/features/tasks/add/index.ts:263>)

不変条件名は `pr-image-download-temp-finalization` を維持します。

実装方針:

1. `downloadImage()` 内の取得失敗・検証失敗では、生成済み一時ディレクトリを自身で回収する。
2. `addTask()` は成功した attachment の親一時ディレクトリを `Set` で追跡する。
3. PR処理全体を覆う `finally` で、成功・保存失敗・workflowキャンセルのいずれでも一時ディレクトリを削除する。
4. 既存の `saveTaskFile()` による task directory、`attachments/`、`order.md` の保存は維持する。
5. 強制終了や `process.exit()` 対応、transaction、rollback、非同期I/O化は追加しない。

確認する状態:

- 画像なし
- `gh` 取得失敗
- magic bytes 検証失敗
- 画像取得後の workflow キャンセル
- 保存成功
- 保存失敗
- 先行成功画像があり、後続画像が失敗

保存成功時は永続 task attachment を残し、取得用一時ディレクトリだけを削除します。保存失敗・キャンセル時は task spec と一時資源を残しません。

## 実施順序

1. placeholder の producer 契約と重複URL処理を修正
2. 一時ディレクトリの所有・終端 cleanup を修正
3. `addTask()` の正常系・失敗系・キャンセル系を通る回帰確認
4. 既存の task attachment 保存、manifest、run-context staging は検証のみ

pipeline の新規 attachment 配線、同期I/Oの全面変更、個別画像失敗時の `throw` 化は、現在の裁定で対象外のため計画に含めません。