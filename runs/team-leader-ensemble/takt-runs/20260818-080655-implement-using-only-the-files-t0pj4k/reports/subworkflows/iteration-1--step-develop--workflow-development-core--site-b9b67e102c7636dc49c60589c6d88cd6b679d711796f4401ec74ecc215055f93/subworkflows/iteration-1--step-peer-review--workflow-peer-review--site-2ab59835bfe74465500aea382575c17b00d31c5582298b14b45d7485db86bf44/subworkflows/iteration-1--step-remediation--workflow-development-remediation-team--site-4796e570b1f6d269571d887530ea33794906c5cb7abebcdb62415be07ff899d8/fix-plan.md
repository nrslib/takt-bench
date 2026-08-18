# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|---|---|---|---|---|---|---|---|
| `AI-NEW-imageUrls-L108` / `ai-antipattern-review.md` | `direct_acceptance_criterion_violation` | `src/shared/utils/imageUrls.ts:80-158`、`src/features/tasks/add/index.ts:214-245` | `PR-IMG-PLACEHOLDER-1` | placeholder の正本が分散し、同一URLの重複処理では本文参照と保存対象が一致しない → `downloadImage()` が空placeholderを返し、callerが別途採番する → producerと成功順序の責務が分離している | 現行コードの `downloadImage()` は `placeholder: ''` を返す。`Math.random()` は現行コードに存在しないため、その字面自体は修正対象にしない。重複URLは `filterGithubAttachmentUrls()` が保持し、URLハッシュ由来の同一fileNameが保存先で衝突することを確認 | 局所 | 成功画像を初出順の `[Image #1]` から決定的・一意に割り当て、本文・`order.md`・保存consumerで一致させる。同一URLは1 attachmentへ集約する。同期I/O、外部URL範囲、pipeline新規配線、保存機構再設計は除外 |
| `image-random-placeholder` / `architecture-review.md` | `duplicate` | `src/shared/utils/imageUrls.ts:80-158` | `PR-IMG-PLACEHOLDER-1` に統合 | 同じplaceholder不変条件に属する | 同じproducer経路と同じ保存consumerを指しているため、独立familyを作らない | 局所 | `AI-NEW-imageUrls-L108` と同じ採番修正で解消する |
| `AI-NEW-imageUrls-L90` / `ai-antipattern-review.md` | `remediation_regression` | `src/shared/utils/imageUrls.ts:82-157`、`src/features/tasks/add/index.ts:263-276` | `PR-IMG-TEMP-LIFECYCLE-1` | 取得用一時資源の所有と終端回収が明確でない → downloaderは一時ディレクトリを作成し、callerは成功済みファイルを条件付きで追跡する → ディレクトリ単位の所有境界が分散している | downloader内の失敗時cleanupと`addTask()`の外側`finally`は確認できる。`promoteTaskAttachments()`が永続先へcopyする経路も確認した。成功・保存失敗・cancelの全終端をディレクトリ単位で明示的に閉じる | 構造 | 取得用一時ディレクトリを取得失敗・検証失敗・保存成功・保存失敗・cancelで回収し、永続task attachmentを保持する。transaction、rollback、非同期I/O、signal処理は除外 |
| `CODE-NEW-src-features-tasks-add-index-L148` / `coding-review.md` | なし | `src/features/tasks/add/index.ts:214-260` | `no_issue_after_verification`。再修正しない | PR画像の抽出・download・保存呼び出しは現行コードに存在する | `addTask()`から`saveTaskFile(..., { attachments })`までの呼び出しを確認した | 局所 | 対象外 |
| `AI-NEW-imageUrls-L83` / `ai-antipattern-review.md` | なし | `execFileSync`、同期filesystem API | `overreach`。後続確認のみ | 同期APIは確認できるが、性能要件・測定証拠・非同期化受入条件がない | 現在の裁定が修正権限を認めていない | 局所 | 非同期I/Oへ変更しない |
| `AI-NEW-addTask-L223` / `ai-antipattern-review.md` | なし | `src/features/tasks/add/index.ts:234-238` | `overreach`。後続確認のみ | 個別画像失敗時の`log.warn`継続は既存契約であり、全体throw契約はない | 裁定と現行の個別失敗継続処理を確認 | 局所 | throw化やログ契約変更をしない |

## 不変条件台帳

引き継ぎ元: 先行 remediation なし。Report Directory直下に公開済みの先行 `fix-verification.md` は存在せず、`.takt-report-internal` は候補から除外した。

### 引き継ぎ元からの行

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 該当なし | — | — | — | — | — | — | — | — | — | — | — | 先行 remediation なし |

### 新規・現在の計画行

| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|---|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `PR-IMG-PLACEHOLDER-1` | `pr-image-placeholder-deterministic-unique` | 同じ成功入力では同じ初出順のplaceholderとなり、同一URLの重複保存・placeholder重複・本文と保存対象の不一致がない | PR画像attachment producerである`downloadImage()`のplaceholder生成契約 | 局所 | 未確認 | 不要。`downloadImage()`をplaceholderの単一producerにする |
| `PR-IMG-TEMP-LIFECYCLE-1` | `PR-IMG-TEMP-LIFECYCLE-1` | `pr-image-download-temp-finalization` | 取得用一時ディレクトリが全ての協調的終端で回収され、永続task attachmentは保持される | `addTask()` PR経路の一時ディレクトリ所有境界 | 構造 | 未確認 | `addTask()`の単一`finally`と`downloadImage()`の生成途中cleanup |

## 欠陥 family の最終状態

| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `TaskAttachment.placeholder`の既存形式、`buildTaskOrderContent()`のattachment形式、task attachment保存契約 | 成功順序とplaceholderの1-based対応、同一入力での決定性、同一URLの重複排除、本文・`order.md`・保存consumerの一致 | `addTask()`が許可済みURLを初出順に正規化し、成功位置を`downloadImage()`へ渡す。`downloadImage()`が有効なplaceholderを生成し、callerは返却値をそのまま利用する | `program.command('add')` → `addTask()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → URL重複排除 → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` → `.takt/tasks/.../order.md`・`attachments/` → `resolveTaskSpecForExecution()` → `stageTaskSpecForExecution()` | 画像0件、1件成功、複数件成功、先行失敗後の成功、同一URLの複数出現、同一入力の反復 | 空placeholder生成、caller側の二重採番、重複URLの二重保存を削除・置換する。fileName形式、allowlist、既存保存consumerは維持する |
| `PR-IMG-TEMP-LIFECYCLE-1` | 取得用一時資源と永続task attachmentの所有分離 | 取得失敗・検証失敗・保存成功・保存失敗・workflow cancelで取得用資源が残らず、保存成功時の永続attachmentが残る | `downloadImage()`は返却前の失敗を自身でcleanupし、`addTask()`は返却後の一時ディレクトリを所有して終端でcleanupする | `program.command('add')` → `addTask()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` → `.takt/tasks/.../attachments/`。保存後または例外・cancel後に`addTask()`の`finally`へ到達する | 画像なし、`gh`取得失敗、magic bytes拒否、保存成功、保存失敗、workflow cancel。hard killと`process.exit()`は`finally`保証外 | ファイル単位の条件付きcleanupをディレクトリ単位のcleanupへ置換する。永続task directory、generic attachment機構、transaction、signal処理は変更しない |

## 要求シナリオ（条件付き）

### `PR-IMG-PLACEHOLDER-1` — 識別子生成

```gherkin
Scenario: [SCN-PR-IMG-PLACEHOLDER-1-P1] 成功したPR画像を初出順のplaceholderへ変換する
  Given PR本文に`![a](https://github.com/user-attachments/assets/a)`と通常コメントに`<img src="https://github.com/user-attachments/assets/b" />`があり、両画像の取得と検証が成功する
  When `takt add --pr 456`を実行する
  Then 保存された画像は順に`[Image #1]`と`[Image #2]`となり、本文・`order.md`・attachment参照が同じplaceholderを使用する

Scenario: [SCN-PR-IMG-PLACEHOLDER-1-N1] 同一URLの保存先とplaceholderを重複させない
  Given PR本文と通常コメントに同じ`https://github.com/user-attachments/assets/a`が記載され、URLから生成されるfileNameが同一になる
  When `takt add --pr 456`を実行する
  Then 画像は1つのattachmentと1つのplaceholderへ集約され、保存先衝突とduplicate placeholder errorが発生しない

Scenario: [SCN-PR-IMG-PLACEHOLDER-1-P2] 失敗した画像が連番を消費しない
  Given PR本文に`https://github.com/user-attachments/assets/failed`と`https://github.com/user-attachments/assets/success`がこの順であり、前者の取得は失敗し後者は成功する
  When `takt add --pr 456`を実行する
  Then 成功した画像は`[Image #1]`となり、`[Image #2]`は生成されない

Scenario: [SCN-PR-IMG-PLACEHOLDER-1-N2] 既存consumerが重複placeholderを拒否する
  Given attachment配列に`[Image #1]`を持つ要素が2つある
  When `resolveReferencedImageAttachments()`で参照を解決する
  Then duplicate placeholder errorとなり、重複attachmentはproviderへ渡されない
```

### `PR-IMG-TEMP-LIFECYCLE-1`

対象外 — 「構造化入力」または「識別子生成」に該当する修正単位ではない。

## 入力・状態・経路の確認表

| 修正単位 | 軸の正本・根拠 | 具体的な入力・状態 | 入口・経路 | 実装上の制約 | consumer / terminal | 期待結果 | 反証方法・テスト ID |
|---|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `extractImageUrls()`、`filterGithubAttachmentUrls()`、`TaskAttachment.placeholder` | 対象URLが0件 | 現行: `program.command('add')` → `addTask()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → `attachments=[]` → `saveTaskFile()`。修正後: 同じ入口からattachment生成なしで保存 | URL抽出順とallowlistを維持し、該当なしではdownloadしない | `order.md`、task attachment directory、後続task spec | 画像なしの既存task保存を維持し、一時資源を作らない | `PR-IMG-PLACEHOLDER-1-T0` |
| `PR-IMG-PLACEHOLDER-1` | 同上、1-based placeholder pattern | 最初の成功画像。実装index 0、表示position 1 | 現行: `addTask()` → `downloadImage()` → callerがplaceholder設定 → `validateAndSetImageExtension()` → `saveTaskFile()`。修正後: `addTask()` → `downloadImage(url, cwd, 1)` →返却placeholderを検証・保存 | 成功前採番を行わず、`[Image #1]`をproducerが生成する | `buildTaskOrderContent()`、`order.md`、task spec consumer | `[Image #1]`と保存画像が一致する | `SCN-PR-IMG-PLACEHOLDER-1-P1` |
| `PR-IMG-PLACEHOLDER-1` | 同上 | 複数の異なるURL。最後の保持位置N、実装index N-1 | 現行: 各試行でcallerが独立採番し、本文置換も別配列で管理。修正後: 成功済みattachment数+1をproducerへ渡し、返却placeholderを本文と保存へ利用 | URLの初出順を維持し、1-based表示positionと0-based実装indexを混同しない | `order.md`、`attachments/`、`resolveTaskSpecForExecution()`、`stageTaskSpecForExecution()` | `[Image #1]`から`[Image #N]`が重複なく保存・復元される | `SCN-PR-IMG-PLACEHOLDER-1-P1` |
| `PR-IMG-PLACEHOLDER-1` | URL hash fileName生成と既存保存先制約 | 同一URLが複数のMarkdown/HTML参照に出現 | 現行: `filterGithubAttachmentUrls()` →重複URLを複数download→同一hash fileName→`promoteTaskAttachments()`のdestination collision。修正後: URL重複排除→1回download→全参照を同じplaceholderへ置換 | 初出順を保持し、fileName形式を変更しない | `order.md`、`attachments/`、保存先collision guard | 1 attachment、1 placeholder、保存先衝突なし | `SCN-PR-IMG-PLACEHOLDER-1-N1` |
| `PR-IMG-PLACEHOLDER-1` | 個別download失敗継続契約 | 先行URLが失敗し、後続URLが成功 | 現行: `addTask()` →成功前にcounter increment→失敗時decrement→次URL。修正後: `attachments.length + 1`を試行時に算出し、失敗時は配列長を変更しない | 個別失敗時の`log.warn`継続を維持する | `order.md`、保存済みattachment、consumer | 後続成功画像が`[Image #1]`になる | `SCN-PR-IMG-PLACEHOLDER-1-P2` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `mkdtempSync()`、`downloadImage()` catch | `gh`がファイル作成前に失敗 | 現行: `addTask()` → `downloadImage()` →内部catch。修正後: 同じ経路で生成済み一時ディレクトリを内部catchが回収 | 失敗を既存の個別警告契約へ渡し、後続URL処理を継続する | 一時ディレクトリ | 空の一時ディレクトリが残らない | `PR-IMG-TEMP-LIFECYCLE-T1` |
| `PR-IMG-TEMP-LIFECYCLE-1` | magic bytes検証処理 | 取得内容がPNG/JPEG/GIF/WebPの許可形式でない | 現行: `downloadImage()`または`validateAndSetImageExtension()` →内部cleanup。修正後: 同じ経路で一時ディレクトリを回収し、attachmentへ追加しない | 既存の形式検証と個別失敗継続を維持する | 一時ディレクトリ、task attachment | 不正画像と一時資源が残らない | `PR-IMG-TEMP-LIFECYCLE-T2` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `saveTaskFile()`、`prepareTaskSpecDirectory()`、`promoteTaskAttachments()` | 有効画像の保存成功 | 現行: `addTask()` →download/validate→`saveTaskFile()` →copy→既存`finally`。修正後: 同じ経路で一時ディレクトリを単一`finally`が回収 | 永続先はcopy後も保持し、取得元だけを削除する | `.takt/tasks/.../attachments/`、`order.md`、後続task spec | 永続attachmentと`order.md`が残り、取得用一時ディレクトリが消える | `PR-IMG-TEMP-LIFECYCLE-T3` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `saveEnqueuedTaskFile()`の保存失敗cleanup | `saveTaskFile()`が保存中に失敗 | 現行: task spec cleanupはあるが、取得元cleanupはouter `finally`に依存。修正後: 保存例外が伝播し、outer `finally`が取得用ディレクトリを回収 | generic task spec cleanupを変更しない | task spec、取得用一時ディレクトリ | 永続task artifactと取得用tempが残らない | `PR-IMG-TEMP-LIFECYCLE-T4` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `determineWorkflow()`のcancel戻り値 | workflow選択が`null` | 現行: `addTask()` →画像取得→`determineWorkflow()` →return。修正後: 同じreturn前後でouter `finally`が実行される | cancel時にtask保存を行わない | tasks.yaml、task directory、取得用temp | taskは作成されず、取得用tempだけが消える | `PR-IMG-TEMP-LIFECYCLE-T5` |
| `PR-IMG-TEMP-LIFECYCLE-1` | JavaScriptの`finally`実行保証 | hard killまたは`process.exit()` | 現行・修正後とも`finally`保証外 | signal処理は今回の修正境界外 | OS終端 | 本計画では保証しない | 後続の運用確認。実装修正対象外 |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|---:|---|---|---|---|---|
| 1 | `PR-IMG-PLACEHOLDER-1` | producer契約と利用側の局所修正 | なし | `src/shared/utils/imageUrls.ts:80-158`、`src/features/tasks/add/index.ts:214-245` | URL重複排除、成功順採番、placeholderの単一producer、本文と保存対象の一致 |
| 2 | `PR-IMG-TEMP-LIFECYCLE-1` | 一時資源所有境界の修正 | 1 | `src/shared/utils/imageUrls.ts:82-157`、`src/features/tasks/add/index.ts:263-276` | 取得失敗・検証失敗・保存成功・保存失敗・cancel後に取得用tempが残らない |
| 3 | 両family | 回帰確認 | 1、2 | `src/__tests__/addTask.test.ts`、必要な画像取得producerテスト | 正常系、重複URL、部分失敗、保存失敗、cancelの観測可能な結果が確認できる |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `order.md`、`TaskAttachment`、`buildTaskOrderContent()`、`resolveReferencedImageAttachments()` | 成功順の1-based番号を`downloadImage()`へ渡し、返却placeholderを正本にする。URL hashをplaceholderへ使う方式、fileName変更、本文URLの維持は採用しない | 保存された`order.md`、`attachments/`、本文参照、重複URL時の保存結果を確認する | 決定性・一意性・既存保存形式を同時に満たす |
| `PR-IMG-TEMP-LIFECYCLE-1` | Policy「資源所有権」、Knowledge「終了経路の完全性」 | downloader内の途中失敗cleanupと、`addTask()`の単一`finally`によるディレクトリ単位cleanupを採用する。transaction、rollback、signal基盤、generic attachment機構の変更は採用しない | 実filesystemと`gh`の決定的test doubleで、成功・保存失敗・cancel・取得失敗・検証失敗後のtempと永続taskを確認する | 取得用資源と永続task attachmentの所有を分離し、既存保存契約を保持する |
| 既存task attachment経路 | `src/features/tasks/attachments.ts:35-108`、`src/features/tasks/execute/taskSpecContext.ts:57-105` | `buildTaskOrderContent()`、`promoteTaskAttachments()`、manifest、run-context stagingは変更せず検証のみ | 保存済み`order.md`、manifest、run-contextのattachmentを確認する | 変更対象外の観測可能な契約を維持する |
| 同期I/O・個別失敗処理 | `review-resolution.md` | 非同期I/O化とthrow化は採用しない | 追加の性能測定・throw契約検証は計画しない | 裁定で`overreach`とされたため |
| pipeline / `takt --pr`新規配線 | `review-resolution.md` | `src/features/pipeline/steps.ts`、`src/app/cli/routing-inputs.ts`は変更しない | 現行経路を確認対象外として扱う | 現在の修正境界で明示的に除外されている |

## 再計画事項

- なし。修正対象family、原因、対象経路、受入条件、修正境界を確認できている。