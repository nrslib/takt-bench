# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|---|---|---|---|---|---|---|---|
| `AI-NEW-imageUrls-L108` / `ai-antipattern-review.md` | `direct_acceptance_criterion_violation` | `src/shared/utils/imageUrls.ts:108` | `PR-IMG-PLACEHOLDER-1` | placeholder が実行ごとに変化し、重複し得る → `Math.random()` で採番 → placeholder producer が入力順を使わず非決定的に生成している | `downloadImage()` の実装と `resolveReferencedImageAttachments()` の重複拒否を確認。同期I/Oは別契約のため否定 | 局所 | 成功した画像を `[Image #1]` から一意に採番し、既存の保存形式・consumerを維持する。同期I/O、URL取得範囲、pipeline配線は変更しない |
| `image-random-placeholder` / `architecture-review.md` | なし（duplicate） | `src/shared/utils/imageUrls.ts:108` | `PR-IMG-PLACEHOLDER-1` に統合 | 同上 | `AI-NEW-imageUrls-L108` と同じ行・同じ不変条件であることを確認 | 局所 | 独立した修正単位を作らず、同じ採番修正で解消する |
| `AI-NEW-imageUrls-L90` / `ai-antipattern-review.md` | `remediation_regression` | `src/shared/utils/imageUrls.ts:90-110`、`src/features/tasks/attachments.ts:88-107` | `PR-IMG-TEMP-LIFECYCLE-1` | 取得用一時資源が成功後・保存失敗後・cancel後に残る → `mkdtempSync()` 後に所有権を終端へ接続していない → 永続コピーと取得用一時資源のcleanup責務が分離されていない | `downloadImage()`、`saveTaskFile()`、`prepareTaskSpecDirectory()` の実経路を確認。保存用task spec cleanupは存在するが取得元cleanupは存在しない | 構造 | 正常終了・保存失敗・workflow cancel・取得失敗で取得用資源を回収し、永続task attachmentは保持する。transaction、非同期化、signal基盤は追加しない |
| `CODE-NEW-src-features-tasks-add-index-L148` / `coding-review.md` | なし | 現行 `src/features/tasks/add/index.ts:199-242` | 対象外（`no_issue_after_verification`） | 現行 `addTask()` に抽出・download・保存呼び出しが存在するため、修正対象にしない | 裁定記録と現行コードを確認 | 対象外 | 再採用・追加修正しない |
| `AI-NEW-imageUrls-L83` / `ai-antipattern-review.md` | なし | `execFileSync`、同期filesystem APIの使用 | 対象外（`overreach`） | 同期I/Oは確認できるが、性能要件・測定証拠・非同期化受入条件がない | 裁定記録を確認 | 対象外 | 非同期I/Oへの変更を計画しない |
| `AI-NEW-addTask-L223` / `ai-antipattern-review.md` | なし | `src/features/tasks/add/index.ts:213-225` | 対象外（`overreach`） | `log.warn` は個別失敗を継続する既存契約であり、全体throw契約はない | 裁定記録と個別失敗継続の実装を確認 | 対象外 | throw化、エラー契約変更、周辺ログ整理を計画しない |

## 不変条件台帳

引き継ぎ元: 先行 remediation なし。Report Directory配下に数値付きの先行 `fix-verification.md` は存在しない。

### 引き継ぎ元からの行

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 該当なし | — | — | — | — | — | — | — | — | — | — | — | 先行 remediation なし |

### 新規・現在の計画行

| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|---|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `PR-IMG-PLACEHOLDER-1` | `pr-image-placeholder-deterministic-unique` | 同じ成功入力では同じ順序のplaceholderになり、同一attachment集合内で重複しない | `downloadImage()` のplaceholder生成責務 | 局所 | 未確認 | 不要。既存のproducer責務で直接修正 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `PR-IMG-TEMP-LIFECYCLE-1` | `pr-image-download-temp-finalization` | 取得用一時資源が正常終了・保存失敗・cancel・取得失敗で回収され、永続attachmentは保持される | `downloadImage()` の一時資源生成・初期cleanup責務と `addTask()` の終端接続 | 構造 | 未確認 | `addTask()` の画像取得から保存・cancel・例外終端を覆う単一の `try/finally`。`downloadImage()` の生成途中失敗は同関数内で回収 |

## 欠陥 family の最終状態

| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `TaskAttachment.placeholder`、`buildTaskOrderContent()`、attachment consumerの既存契約 | 成功画像のplaceholderが決定的・一意で、task本文、`order.md`、保存済みattachment consumerが同じ値を使う | `downloadImage()` が成功順序に基づくplaceholderの正本になる。`validateAndSetImageExtension()`、`saveTaskFile()`、`buildTaskOrderContent()`、`promoteTaskAttachments()`、manifest、consumerは既存責務を維持 | `addTask()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` → `.takt/tasks/.../order.md`・`attachments/` → `resolveTaskSpecForExecution()` / `resolveReferencedImageAttachments()` | 0件、1件、複数件、同一URLの重複、先行画像の失敗後に成功する画像を確認する。対象外URL・コード文脈の抽出変更は含めない | 乱数placeholder生成を削除する。fileName形式、保存経路、互換経路、pipeline新規配線は変更しない |
| `PR-IMG-TEMP-LIFECYCLE-1` | 取得用資源と永続task attachmentの所有分離 | 成功後・保存失敗・workflow cancel・画像取得失敗で一時資源が残らず、成功時の永続attachmentは残る | `downloadImage()` が生成途中失敗を回収し、`addTask()` が取得済みPR画像の終端cleanupを所有する。generic `saveTaskFile()` はinteractive attachmentを壊さないため変更しない | `addTask()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` → `.takt/tasks/.../attachments/`。保存失敗時は既存の `cleanupTaskSpecDirectory()` も通る | 正常終了、保存失敗、workflow cancel、`gh api`失敗前、magic bytes検証失敗、画像0件、`gh`未使用を確認する。hard killは`finally`保証外として受入対象にしない | 取得用一時資源のcleanup接続のみ。transaction、rollback、非同期I/O、signal処理、interactive image storeの変更はしない |

## 要求シナリオ（条件付き）

### `PR-IMG-PLACEHOLDER-1` — 識別子生成

```gherkin
Scenario: [SCN-PR-IMG-PLACEHOLDER-1-P1] 成功したPR画像を順序付きplaceholderへ変換する
  Given PR本文に`![a](https://github.com/user-attachments/assets/a)`と通常コメントに`<img src="https://github.com/org/repo/assets/b" />`があり、両画像の取得と検証が成功する
  When `addTask()`がPR画像を既存のtask attachment保存経路へ渡す
  Then attachmentは順に`[Image #1]`と`[Image #2]`となり、`order.md`の対応行と保存済みconsumerのplaceholderが一致する

Scenario: [SCN-PR-IMG-PLACEHOLDER-1-N1] 同一入力内でplaceholderを重複させない
  Given PR本文と通常コメントに同じ`https://github.com/user-attachments/assets/a`があり、両方の取得が成功する
  When `addTask()`が2件の取得結果をattachmentへ変換する
  Then 生成されたplaceholderは異なる連番になり、`resolveReferencedImageAttachments()`の重複placeholder拒否に到達しない
```

### `PR-IMG-TEMP-LIFECYCLE-1`

対象外 — 「構造化入力」または「識別子生成」に該当する修正単位ではない。

## 入力・状態・経路の確認表

| 修正単位 | 軸の正本・根拠 | 具体的な入力・状態 | 入口・経路 | 実装上の制約 | consumer / terminal | 期待結果 | 反証方法・テスト ID |
|---|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `downloadImage()`、`StoredImageAttachment.placeholder`、`resolveReferencedImageAttachments()` | 対象URLが0件 | 現行: `addTask()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → `attachments=[]` → `saveTaskFile()`。修正後: 同じ入口でattachmentなしの既存終端 | attachment生成を開始しない | task保存は既存形式、画像consumerへの入力なし | 既存の画像なし挙動を維持 | `addTask.test.ts` のPR画像なしケース |
| `PR-IMG-PLACEHOLDER-1` | 同上 | 最初の成功画像。実装index 0、表示position 1 | 現行: `addTask()` → `downloadImage()` → `Math.random()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `buildTaskOrderContent()`。修正後: `downloadImage(url,cwd,1)` → `[Image #1]` → 同じ保存経路 | producerが成功順序を明示的に使う | `order.md` attachment行、保存済みファイル、placeholder consumer | `[Image #1]` が安定して保存される | `SCN-PR-IMG-PLACEHOLDER-1-P1` |
| `PR-IMG-PLACEHOLDER-1` | 同上 | 2件以上の成功画像。最後の保持position N | 現行: 各 `downloadImage()` が独立に乱数採番。修正後: `attachments.length + 1` による1-based採番 → `validateAndSetImageExtension()` → `promoteTaskAttachments()` | 同一attachment集合内でplaceholderを重複させない | `buildTaskOrderContent()`、`.takt/tasks/.../order.md`、`resolveReferencedImageAttachments()` | `[Image #1]` から `[Image #N]` が順序どおり成立する | producer回帰テスト、`saveTaskFile.test.ts` |
| `PR-IMG-PLACEHOLDER-1` | 同上 | 同一URLが2回成功する状態 | 現行: 乱数の衝突可能性があり、`resolveReferencedImageAttachments()` が重複を拒否。修正後: 同じURLでも成功順序1、2を割り当てる | URL重複排除は今回の変更対象ではなく、placeholderだけを一意化する | attachment mapと保存済みorder | placeholderが重複しない | `SCN-PR-IMG-PLACEHOLDER-1-N1` |
| `PR-IMG-PLACEHOLDER-1` | 同上 | 先行画像が失敗し、後続画像だけ成功する状態 | 現行: per-image `catch` で継続。修正後: push済みattachment数を次番号の基準にする | 失敗した画像にplaceholderを消費しない | `order.md` と保存済みattachment | 成功した画像が次の有効な連番を得る | addTaskの部分失敗テスト |
| `PR-IMG-TEMP-LIFECYCLE-1` | `downloadImage()` の `mkdtempSync()` と `saveTaskFile()` の既存cleanup | 有効画像の保存成功 | 現行: `downloadImage()` → temp dir/file → `saveTaskFile()` → `promoteTaskAttachments()`。修正後: 同じ経路 → `addTask()` の `finally` →取得元temp cleanup | 永続先をcleanup対象にしない | `.takt/tasks/.../attachments/` と `order.md` | 永続attachmentは残り、取得用tempだけ消える | addTask正常系cleanupテスト |
| `PR-IMG-TEMP-LIFECYCLE-1` | 同上 | `saveTaskFile()` が保存失敗する状態 | 現行: `prepareTaskSpecDirectory()` がtaskDirをcleanupするが、取得元tempは残る。修正後: `saveTaskFile()` の失敗伝播 → `addTask()` `finally` →temp cleanup | generic保存機構の既存task spec cleanupを維持する | taskDir、tasks.yaml、取得元temp | task保存失敗、task specなし、取得元tempなし | 保存失敗回帰テスト |
| `PR-IMG-TEMP-LIFECYCLE-1` | 同上 | workflow選択が`null`を返すcancel状態 | 現行: 画像取得後 `determineWorkflow()` → `return` でtemp残留。修正後: `determineWorkflow()` → `finally` →temp cleanup | cancel時にtask保存を実行しない | tasks.yaml、taskDir、取得元temp | task未作成、取得元tempなし | `addTask.test.ts` のPR cancelケース |
| `PR-IMG-TEMP-LIFECYCLE-1` | 同上 | `gh api` がファイル作成前に失敗 | 現行: `tempPath`不存在時はcatchがdirを削除しない。修正後: `downloadImage()`内で作成済みtemp dirを無条件回収 | エラーを握りつぶさず既存エラー伝播を維持する | temp dir | download失敗、空temp dirなし | downloader failureテスト |
| `PR-IMG-TEMP-LIFECYCLE-1` | 同上 | magic bytes検証失敗 | 現行: `validateAndSetImageExtension()` がファイルとdirを削除する経路あり。修正後: 既存cleanupを維持し、未登録attachmentを外側cleanup対象にしない | 個別画像失敗は既存どおりwarn継続 | temp dir、最終task保存 | 不正画像を保存せずtempを残さない | validation failureテスト |
| `PR-IMG-TEMP-LIFECYCLE-1` | 同上 | 対象画像0件、または`gh`未使用 | 現行: temp作成なし。修正後: 同じ | 不要なcleanupを発生させない | task保存 | 既存の画像なし経路を維持 | 既存PR画像なし・CLI unavailableテスト |
| `PR-IMG-TEMP-LIFECYCLE-1` | 終了経路知識および現行CLI経路 | hard kill / `process.exit()` | 現行・修正後ともJavaScriptの`finally`実行保証なし | 今回の受入条件外。signal処理を追加しない | OS終端 | 本計画では保証しない | 後続の環境・運用確認のみ。実装修正対象外 |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|---:|---|---|---|---|---|
| 1 | `PR-IMG-PLACEHOLDER-1` | producerの局所修正 | なし | `src/shared/utils/imageUrls.ts:83-110`、`src/features/tasks/add/index.ts:213-217` | 成功順序とplaceholderの1-based対応が固定され、同一集合で重複しない |
| 2 | `PR-IMG-TEMP-LIFECYCLE-1` | 生成途中cleanupの修正 | 1 | `src/shared/utils/imageUrls.ts:89-119` | ファイル作成前の失敗でもtemp dirが残らない |
| 3 | `PR-IMG-TEMP-LIFECYCLE-1` | 終端cleanupの接続 | 1、2 | `src/features/tasks/add/index.ts:199-243` | 保存成功・保存失敗・cancel・例外で取得元tempが回収される |
| 4 | 両family | 回帰確認 | 1〜3 | `src/__tests__/addTask.test.ts`、downloader lifecycle test、既存attachment tests | placeholder、永続保存、失敗・cancel cleanupを観測できる |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `order.md`、review-resolution、TaskAttachment契約、決定性テストポリシー | 成功順序を明示的に渡して採番する方法を採用。乱数、URL hashだけの採番、fileName変更、URL dedup、pipeline配線は採用しない | 同一入力を反復し、placeholder列・`order.md`・consumerの参照値を比較する | 明示されたplaceholderの決定性・一意性だけを変更し、既存保存契約を保持する |
| `PR-IMG-TEMP-LIFECYCLE-1` | review-resolution、Knowledgeの終了経路完全性、既存 `prepareTaskSpecDirectory()` cleanup | downloader内の生成途中cleanupと、`addTask()`の取得開始から保存終端を覆う`finally`を採用。generic `saveTaskFile()`への一律cleanup、transaction、非同期I/O、signal基盤は採用しない | 実filesystemと外部`gh` test doubleで、成功・保存失敗・cancel・取得失敗後のtempと永続taskを確認する | 取得用資源だけを所有者へ返し、interactive attachmentと永続task attachmentを破壊しない |
| 対象外指摘 | review-resolution | 同期I/Oの非同期化、画像処理例外のthrow化は採用しない | 追加の性能測定・throw契約テストを計画しない | 裁定で権限なしと明示されているため |
| 既存経路 | `src/features/tasks/attachments.ts`、`src/features/tasks/execute/taskSpecContext.ts` | 保存、manifest、symlink検証、run-context stagingを変更せず検証のみ行う | 既存attachmentの保存結果とmanifestを確認する | 変更対象外の観測可能な既存契約を保持する |

## 再計画事項

- なし。修正対象family、原因、受入条件、修正境界、検証経路を確定できる。