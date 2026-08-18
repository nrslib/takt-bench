要件と裁定を正本として、まず指定された task・policy・knowledge・Report Directory を再確認し、次に現行コードの実行経路と既存テストを追跡します。今回は計画作成のみのため、ソースは変更しません。
指定された policy と knowledge を末尾まで確認しました。適用するのは、契約経路を終端まで追うこと、今回の2 family以外を追加しないこと、cleanup の正常・失敗・キャンセル・強制終了を分けて確認すること、そして変更前の失敗を検出する最小の回帰証拠を計画することです。次に裁定と実コードを照合します。
現行コードで原因を再確認しました。`downloadImage()` の乱数 placeholder は `resolveReferencedImageAttachments()` の重複拒否へ直結し、`mkdtempSync()` の戻り資源は `saveTaskFile()` のコピー後・workflow cancel 後とも所有者へ返却されていません。`saveTaskFile()` 自身の task spec cleanup は既に存在するため、計画ではそれを変更せず、取得用資源だけを `add --pr` の終端で回収します。
## 調査結果

`order.md`、指定された policy・knowledge、Report Directory、現在のコードを再確認しました。先行 remediation の `fix-verification.md` はなく、引き継ぐ台帳行はありません。

修正対象は裁定どおり次の2 familyだけです。

| Family | 対応する finding |
|---|---|
| `PR-IMG-PLACEHOLDER-1` | `AI-NEW-imageUrls-L108`、`image-random-placeholder`（duplicate） |
| `PR-IMG-TEMP-LIFECYCLE-1` | `AI-NEW-imageUrls-L90` |

`CODE-NEW-src-features-tasks-add-index-L148`、`AI-NEW-imageUrls-L83`、`AI-NEW-addTask-L223` は修正対象に含めません。

## 修正単位1: `PR-IMG-PLACEHOLDER-1`

- 不変条件名: `pr-image-placeholder-deterministic-unique`
- 担当箇所: `downloadImage()` の placeholder 生成責務
- 権限根拠: `direct_acceptance_criterion_violation`
- 問題: `Math.random()` により placeholder が実行ごとに変化し、同一処理内で重複し得る。
- 分類: 単一 producer の局所契約欠陥
- 強制点: `downloadImage()` で成功した attachment の順序に基づき、一度だけ決定的に採番する。

現行経路:

`addTask()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` → `.takt/tasks/.../order.md`・`attachments/` → `resolveTaskSpecForExecution()` / attachment consumer

修正後は、成功した attachment の 1-based 連番を `downloadImage()` に明示的に渡し、`[Image #1]`、`[Image #2]` のように生成します。既存の file name、拡張子検証、保存形式、manifest、run-context staging は変更しません。

受入条件:

- 対象画像が0件の場合、既存の空 attachment 経路を維持する。
- 1件以上の成功時、placeholder が `[Image #1]` から重複なく連番になる。
- 同じ URL が複数回現れても placeholder が重複しない。
- `buildTaskOrderContent()`、保存済み `order.md`、`resolveReferencedImageAttachments()` が同じ placeholder を参照する。
- 既存の attachment 保存・検証・consumer 経路を変更しない。

検証シナリオ:

- `![a](https://github.com/user-attachments/assets/a)` と `<img src="https://github.com/org/repo/assets/b" />` を同一 PR に含め、`[Image #1]`、`[Image #2]` と保存行の一致を確認する。
- 同一画像 URLを2回含め、duplicate placeholder が発生しないことを確認する。
- 既存の `resolveReferencedImageAttachments()` の重複拒否テストを維持する。

## 修正単位2: `PR-IMG-TEMP-LIFECYCLE-1`

- 不変条件名: `pr-image-download-temp-finalization`
- 担当箇所: `downloadImage()` が生成する取得用一時資源の所有処理
- 権限根拠: `remediation_regression`
- 問題: `mkdtempSync()` で作成したディレクトリが、保存成功後・workflow cancellation後に削除されない。ファイル作成前の失敗時にも空ディレクトリが残り得る。
- 分類: 取得資源と永続 task attachment の所有境界に関わる構造問題
- 強制点: `add --pr` の画像取得開始から保存・cancel・例外終端までを覆う単一の `try/finally`。

現行経路:

`downloadImage()` → 一時ディレクトリ作成 → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` が永続先へコピー

現行では、保存失敗時に task spec は既存 cleanup されますが、取得元の一時ディレクトリは削除されません。workflow が `null` を返す cancellation 経路でも、画像取得後に return するため残留します。

修正後:

- `downloadImage()` 自身の取得失敗時は、ファイルの有無にかかわらず作成した一時ディレクトリを回収する。
- `addTask()` は取得済み PR画像だけを所有し、`formatPrReviewAsTask()`、workflow選択、`saveTaskFile()`、表示処理の全終端を `finally` で覆う。
- 保存成功後は永続 `.takt/tasks/.../attachments/` を保持し、取得用一時資源だけを削除する。
- 保存失敗・workflow cancellation・画像処理例外でも取得用一時資源を削除する。
- `saveTaskFile()`、`prepareTaskSpecDirectory()`、既存 interactive image store の cleanup 契約は変更しない。

受入条件:

- 正常終了後、一時ファイル・一時ディレクトリが存在せず、永続 task attachment は存在する。
- 保存失敗後、一時資源と作成途中の task spec が残らない。
- workflow cancellation 後、taskを作成せず一時資源も残さない。
- `gh` 取得失敗や magic bytes 検証失敗時にも空の一時ディレクトリを残さない。
- hard kill や `process.exit()` は `finally` を実行できないため、今回の受入条件として保証しない。新しい signal 処理や transaction は追加しない。

検証シナリオ:

- 有効な PNGを取得して保存し、永続画像の存在と取得用一時ディレクトリの不存在を確認する。
- 既存の保存失敗条件で `saveTaskFile()` を失敗させ、task specと一時資源が残らないことを確認する。
- 画像取得後に workflow 選択をキャンセルし、task未作成・一時資源削除を確認する。
- `gh api` がファイル作成前に失敗するケースで、一時ディレクトリが残らないことを確認する。

## 実施順序

1. `downloadImage()` の deterministic placeholder 採番と取得失敗時 cleanup を修正する。
2. `addTask()` に PR画像取得資源の終端 cleanup を接続する。
3. placeholder の保存経路、正常終了・保存失敗・cancel・部分失敗の回帰テストを追加または更新する。
4. 既存の attachment 保存、manifest、consumer 経路が変更されていないことを確認する。

品質ゲートの実行は fix フェーズの指示に従います。今回はソースを変更していません。