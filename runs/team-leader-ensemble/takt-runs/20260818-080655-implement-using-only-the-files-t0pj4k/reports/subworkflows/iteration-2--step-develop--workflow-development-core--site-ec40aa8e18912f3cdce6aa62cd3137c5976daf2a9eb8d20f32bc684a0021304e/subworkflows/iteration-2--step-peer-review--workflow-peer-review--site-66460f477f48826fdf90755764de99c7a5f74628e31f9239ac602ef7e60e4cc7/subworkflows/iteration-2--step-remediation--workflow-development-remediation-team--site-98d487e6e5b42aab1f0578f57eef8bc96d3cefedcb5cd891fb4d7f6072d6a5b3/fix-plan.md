# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|---|---|---|---|---|---|---|---|
| `AI-NEW-imageUrls-L108` / `ai-antipattern-review.md` | `direct_acceptance_criterion_violation` | `src/shared/utils/imageUrls.ts:92-159`、`src/features/tasks/add/index.ts:214-235` | `PR-IMG-PLACEHOLDER-1` | placeholder は成功順に決定的・一意である必要がある。旧実装では非決定的採番が原因だった | 現在の計画・検証記録では `successCount` と成功後の `attachments.push()` を採用済み。残る義務は混在記法・重複・部分失敗の回帰証拠 | 局所 | `[Image #1]` から成功順に採番し、本文・`order.md`・保存済み attachment で同じ値を使う。URL allowlist、pipeline、新しい保存方式は変更しない |
| `PR-IMG-PLACEHOLDER-ORDER-1` / `fix-verification.md` | `direct_acceptance_criterion_violation` | `src/shared/utils/imageUrls.ts:19-63` | `PR-IMG-PLACEHOLDER-1` に統合 | Markdown、HTML double quote、HTML single quote の別走査で本文初出順が崩れる | `fix-verification.md` が混在入力で抽出順の不一致を確認している。placeholder 生成自体の乱数は今回の原因ではない | 局所 | 3記法を位置情報付きで統合し、初出順に並べてから重複排除する |
| `image-random-placeholder` / `architecture-review.md` | `duplicate` | `src/shared/utils/imageUrls.ts:156` | `PR-IMG-PLACEHOLDER-1` に統合 | `AI-NEW-imageUrls-L108` と同じ producer、同じ placeholder 不変条件に属する | 既存 family と同じ保存 consumer・同じ成功順契約を持つ | 局所 | 独立した family や ID は追加しない |
| `AI-NEW-imageUrls-L90` / `ai-antipattern-review.md` | `remediation_regression` | `src/shared/utils/imageUrls.ts:94-168,219-225`、`src/features/tasks/add/index.ts:265-289` | `PR-IMG-TEMP-LIFECYCLE-1` | PR画像取得用一時資源が全協調的終端で回収される必要がある。直接原因は旧 recursive cleanup API と終端確認不足 | `fix-verification.md` が Node `v25.7.0` で `fs.rmdirSync(..., { recursive: true })` の失敗を確認している。`enqueueService.ts` の親ディレクトリ cleanup は別責務として除外する | 構造 | 取得失敗、検証失敗、保存成功、保存失敗、workflow cancel で一時資源を回収し、永続 task attachment を保持する |
| `CODE-NEW-src-features-tasks-add-index-L148` / `coding-review.md` | なし | `src/features/tasks/add/index.ts:203-263` | `no_issue_after_verification` | PR取得から画像抽出、保存までの呼び出しは存在する | 現行 remediation の呼び出しチェーンで確認済み | 対象外 | 再採用しない |
| `AI-NEW-imageUrls-L83` / `ai-antipattern-review.md` | なし | `execFileSync`、同期 filesystem API | `overreach` | 非同期化を要求する性能契約・測定証拠がない | 現行裁定が修正権限を認めていない | 対象外 | 非同期 I/O へ変更しない |
| `AI-NEW-addTask-L223` / `ai-antipattern-review.md` | なし | `src/features/tasks/add/index.ts:237-240` | `overreach` | 個別画像失敗時の警告継続は既存契約であり、全体 throw 契約はない | `fix-verification.md` の対象 family に含まれない | 対象外 | `log.warn` の継続処理を throw 化しない |

## 不変条件台帳

引き継ぎ元: 同一 remediation 内の最新 `fix-verification.md`

### 引き継ぎ元からの行

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|---|---|---|---|---:|---|---|---|---|---:|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `PR-IMG-PLACEHOLDER-1` | `pr-image-placeholder-deterministic-unique` | `src/shared/utils/imageUrls.ts` の `downloadImage()` による placeholder 生成契約 | 1 | なし（初回） | なし（初回） | `addTask()` → `extractImageUrls()` → URL重複排除 → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` | 同一・初回 | 1 | 未確認 | 不要 | 理由付き成果物不足 |
| `PR-IMG-TEMP-LIFECYCLE-1` | `PR-IMG-TEMP-LIFECYCLE-1` | `pr-image-download-temp-finalization` | `addTask()` PR経路の一時ディレクトリ所有境界 | 1 | なし（初回） | なし（初回） | 取得失敗時の `downloadImage()` cleanup、検証失敗時の `validateAndSetImageExtension()` cleanup、保存成功・保存失敗・cancel 時の `addTask()` 外側 `finally` | 同一・初回 | 1 | 未確認 | 不要 | 理由付き成果物不足 |

### 新規・現在の計画行

| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|---|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `PR-IMG-PLACEHOLDER-1` | `pr-image-placeholder-deterministic-unique` | 同じ成功入力では同じ初出順の placeholder となり、同一 URL の重複保存・placeholder 重複・本文と保存対象の不一致がない | `downloadImage()` の placeholder 生成責務 | 局所 | 未確認 | 不要。`downloadImage()` を placeholder の単一 producer として維持する |
| `PR-IMG-TEMP-LIFECYCLE-1` | `PR-IMG-TEMP-LIFECYCLE-1` | `pr-image-download-temp-finalization` | 取得用一時ディレクトリが正常終了・保存失敗・cancel・取得失敗・検証失敗で回収され、永続 attachment は保持される | `downloadImage()` の生成途中 cleanup と `addTask()` の終端 cleanup | 構造 | 未確認 | `downloadImage()` 内の失敗 cleanup と `addTask()` 外側 `finally` を単一の所有境界として維持する |

## 欠陥 family の最終状態

| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `order.md` の既存 attachment 形式、`TaskAttachment.placeholder`、`buildTaskOrderContent()`、画像 consumer | 3記法の初出順、URL重複排除、成功順の1-based採番、失敗画像が番号を消費しないこと、本文・`order.md`・保存済み consumer の一致 | `extractImageUrls()` が位置順を保持し、`downloadImage()` が成功件数から placeholder を生成する。`addTask()` は検証成功後だけ attachment を追加する | `addTask()` → `fetchPrReviewComments()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `buildTaskOrderContent()` / `promoteTaskAttachments()` → `order.md`・`attachments/` → `resolveTaskSpecForExecution()` | 画像0件、Markdown、HTML double quote、HTML single quote、重複 URL、複数成功、先行失敗後の成功、plain URL | 旧 placeholder 生成経路は削除・復活させない。既存保存 consumer は維持する |
| `PR-IMG-TEMP-LIFECYCLE-1` | 取得用一時資源と永続 task attachment の所有分離、PNG/JPEG/GIF/WebP の形式検証 | 4形式の保存、magic bytes 不一致の拒否、取得失敗・検証失敗・保存失敗・cancel 後の cleanup、保存成功時の永続 attachment 保持 | `downloadImage()` は生成途中の資源を回収し、`addTask()` は返却済み一時資源を外側 `finally` で回収する。既存の `fs.rmSync(..., { recursive: true, force: true })` 方式を使う | `addTask()` → `downloadImage()` → `validateAndSetImageExtension()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` → `.takt/tasks/.../attachments/` → run context staging | PNG、JPEG、GIF、WebP、unsupported magic bytes、取得前失敗、保存成功、保存失敗、workflow cancel。強制終了は `finally` の保証外 | 永続 task directory、generic attachment 機構、`enqueueService.ts` の別責務の cleanup は変更しない |

## 要求シナリオ（条件付き）

### `PR-IMG-PLACEHOLDER-1` — 構造化入力

~~~gherkin
Scenario: [SCN-PR-IMG-PLACEHOLDER-1-P1] 混在する画像記法を本文出現順に抽出する
  Given `![md](https://github.com/user-attachments/assets/md)`、`<img src="https://github.com/user-attachments/assets/html">`、`<img src='https://github.com/user-attachments/assets/single'>` がこの順で本文にある
  When `addTask()` が PR 画像を抽出する
  Then 抽出 URL と保存 placeholder は `md`、`html`、`single` の順になる

Scenario: [SCN-PR-IMG-PLACEHOLDER-1-N1] plain URL を画像として扱わない
  Given `https://github.com/user-attachments/assets/plain` が本文中の通常文字列にあり、画像記法は `![image](https://github.com/user-attachments/assets/marked)` だけである
  When `extractImageUrls()` が本文を処理する
  Then `plain` は抽出されず、`marked` だけが attachment 処理へ渡される
~~~

### `PR-IMG-PLACEHOLDER-1` — 識別子生成

~~~gherkin
Scenario: [SCN-PR-IMG-PLACEHOLDER-1-P2] 成功した画像を連番 placeholder に変換する
  Given `https://github.com/user-attachments/assets/a` と `https://github.com/user-attachments/assets/b` の取得・検証が成功する
  When `addTask()` が画像を順番に保存する
  Then task 本文、`order.md`、保存済み attachment consumer が同じ対応関係で `[Image #1]` と `[Image #2]` を参照する

Scenario: [SCN-PR-IMG-PLACEHOLDER-1-N2] 失敗した画像が番号を消費しない
  Given `https://github.com/user-attachments/assets/failed` の取得が失敗し、後続の `https://github.com/user-attachments/assets/success` の取得・検証が成功する
  When `addTask()` が2件を順番に処理する
  Then 保存される画像は `[Image #1]` だけになり、`[Image #2]` は生成されない
~~~

## 入力・状態・経路の確認表

| 修正単位 | 軸の正本・根拠 | 具体的な入力・状態 | 入口・経路 | 実装上の制約 | consumer / terminal | 期待結果 | 反証方法・テスト ID |
|---|---|---|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `PrReviewData`、`extractImageUrls()` | 画像 URL なし | 現行: `addTask()` → `extractImageUrls()` → `filterGithubAttachmentUrls()` → `formatPrReviewAsTask()` → `saveTaskFile()` → `buildTaskOrderContent()`。修正後: 同じ入口から attachment なしで `order.md` を保存する | 空集合では download しない | task 保存、attachment なし | 一時ディレクトリを作成せず task を保存する | addTask の画像なしケース |
| `PR-IMG-PLACEHOLDER-1` | `extractImageUrls():19-63` | Markdown `![md](...)` | 現行: `addTask()` → `extractImageUrls()` の Markdown regex → `downloadImage()` → `saveTaskFile()`。修正後: 同じ入口で本文位置順を維持する | Markdown 画像記法だけを対象にする | `order.md`、attachment | Markdown URL が出現位置に対応する | `SCN-PR-IMG-PLACEHOLDER-1-P1` |
| `PR-IMG-PLACEHOLDER-1` | `extractImageUrls():32-48` | HTML double quote `<img src="...">` | 現行: `addTask()` → HTML double quote regex → `downloadImage()` → `saveTaskFile()`。修正後: Markdown と混在しても位置順を維持する | `src` の double quote を対象にする | `order.md`、attachment | HTML URL が本文位置に対応する | `SCN-PR-IMG-PLACEHOLDER-1-P1` |
| `PR-IMG-PLACEHOLDER-1` | `extractImageUrls():41-48` | HTML single quote `<img src='...'>` | 現行: `addTask()` → HTML single quote regex → `downloadImage()` → `saveTaskFile()`。修正後: 他記法との混在順を維持する | `src` の single quote を対象にする | `order.md`、attachment | single quote HTML URL が本文位置に対応する | `SCN-PR-IMG-PLACEHOLDER-1-P1` |
| `PR-IMG-PLACEHOLDER-1` | `addTask():214-224` | 同一 URL が本文とコメントに複数回出現 | 現行: `extractImageUrls()` → `Set` による重複排除 → `filterGithubAttachmentUrls()` → `downloadImage()`。修正後: 初出順を維持したまま1回だけ処理する | URL 重複を1 attachmentへ集約する | `order.md`、attachment manifest | 保存先衝突と duplicate placeholder を発生させない | `SCN-PR-IMG-PLACEHOLDER-1-N1` |
| `PR-IMG-PLACEHOLDER-1` | `downloadImage():92-159`、`addTask():227-235` | 最初の成功画像。実装 index 0、表示 position 1 | 現行: `addTask()` → `downloadImage(url, cwd, attachments.length)` → `validateAndSetImageExtension()` → `saveTaskFile()`。修正後: 同じ経路で `[Image #1]` を保存する | 0-based 件数を 1-based placeholder へ変換する | `buildTaskOrderContent()`、`order.md` | `[Image #1]` と画像が一致する | `SCN-PR-IMG-PLACEHOLDER-1-P2` |
| `PR-IMG-PLACEHOLDER-1` | `addTask():227-235` | 2件以上が連続して成功 | 現行: 成功後に `attachments.length` が増加する。修正後: `[Image #1]` から `[Image #N]` を成功順に生成する | 成功した画像だけが次の番号を消費する | `order.md`、保存済み attachment | placeholder が重複しない | `SCN-PR-IMG-PLACEHOLDER-1-P2` |
| `PR-IMG-PLACEHOLDER-1` | `addTask():227-240` | 先行 download 失敗、後続 download 成功 | 現行: 個別 catch で継続し、失敗時は `attachments` を増やさない。修正後: 同じ失敗継続契約を保つ | `log.warn` 後に後続 URL を処理する | `order.md`、attachment | 後続成功画像が `[Image #1]` になる | `SCN-PR-IMG-PLACEHOLDER-1-N2` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `downloadImage():94-168` | PNG、JPEG、GIF、WebP の magic bytes | 現行: `addTask()` → `downloadImage()` → magic bytes 判定 → `validateAndSetImageExtension()` → `saveTaskFile()`。修正後: 同じ経路で対応拡張子を付けて保存する | 許可形式だけを attachment にする | persistent attachment、画像 consumer | `.png`、`.jpg`、`.gif`、`.webp` が保存される | `T-PR-IMG-FORMAT-PNG`、`T-PR-IMG-FORMAT-JPEG`、`T-PR-IMG-FORMAT-GIF`、`T-PR-IMG-FORMAT-WEBP` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `downloadImage():144-168` | 対応形式以外の bytes | 現行: unsupported error → 内部 catch cleanup → `addTask()` 個別 catch。修正後: 同じ失敗終端を維持する | 不正画像を attachment に追加しない | 一時 directory、task attachment | 不正画像と一時資源が残らない | `T-PR-IMG-MAGIC-REJECT` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `downloadImage():97-116` | `gh api` がファイル作成前に失敗 | 現行: `downloadImage()` 内 catch → cleanup。修正後: 同じ経路で一時 directory を回収する | 元の取得例外を cleanup 例外で隠さない | 一時 directory、warning | 取得失敗を記録し、temp を残さない | `PR-IMG-TEMP-LIFECYCLE-T1` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `validateAndSetImageExtension():174-225` | magic bytes 検証失敗 | 現行: validator catch → file/directory cleanup。修正後: 同じ cleanup を現行 Node API で実施する | 検証失敗 attachment を追加しない | 一時 directory、task attachment | 不正 attachment と temp を残さない | `PR-IMG-TEMP-LIFECYCLE-T2` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `saveTaskFile()`、`addTask()` outer `finally` | 有効画像の保存成功 | 現行: download/validate → `saveTaskFile()` → `promoteTaskAttachments()` → outer cleanup。修正後: persistent 先を保持して取得元だけ削除する | 永続 task directory を cleanup 対象にしない | `.takt/tasks/.../order.md`、`attachments/` | task attachment と order を保持し、temp を削除する | `T-PR-IMG-SAVE-SUCCESS` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `saveTaskFile()`、`addTask()` outer `finally` | task 保存失敗 | 現行: 保存例外 → task cleanup と outer cleanup。修正後: 両方の所有境界を維持する | 保存失敗を握りつぶさない | task directory、temp directory | 保存失敗が伝播し、取得用 temp が残らない | `T-PR-IMG-SAVE-FAILURE` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `determineWorkflow()`、`addTask():249-253,265-289` | workflow 選択が `null` の cancel | 現行: download/validate → cancel return → outer `finally`。修正後: 同じ順序で cleanup する | cancel 時は保存しない | tasks.yaml、task directory、temp directory | task は作成されず temp は残らない | `T-PR-IMG-CANCEL` |
| `PR-IMG-TEMP-LIFECYCLE-1` | `resolveTaskSpecForExecution()`、`stageTaskSpecForExecution()` | 保存成功後の task 実行 | 現行: persistent attachment → run-context staging。修正後: 同じ復元経路を維持する | 実行時は persistent attachment を読む | run context の `order.md` と `attachments/` | outer cleanup 後も画像を参照できる | `T-PR-IMG-RUN-CONTEXT` |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|---:|---|---|---|---|---|
| 1 | `PR-IMG-PLACEHOLDER-1` | 抽出順・採番の producer 修正 | なし | `src/shared/utils/imageUrls.ts:19-63`、`src/features/tasks/add/index.ts:214-240` | 3記法の出現順、重複排除、成功順採番、先行失敗後の採番が成立する |
| 2 | `PR-IMG-TEMP-LIFECYCLE-1` | 一時資源の cleanup API と終端境界の修正 | 1 | `src/shared/utils/imageUrls.ts:94-225`、`src/features/tasks/add/index.ts:265-287` | 取得失敗、検証失敗、保存成功、保存失敗、cancel の全経路で一時資源を回収する |
| 3 | `PR-IMG-PLACEHOLDER-1` | 構造化入力・識別子生成の回帰テスト | 1 | `src/__tests__/imageUrls.test.ts`、`src/__tests__/addTask.test.ts` | 本文、`order.md`、attachment consumer の placeholder 一致を観測する |
| 4 | `PR-IMG-TEMP-LIFECYCLE-1` | cleanup・形式検証の回帰テスト | 2 | `src/__tests__/imageUrls.test.ts`、`src/__tests__/addTask.test.ts` | 4形式、unsupported、取得失敗、検証失敗、保存成功、保存失敗、cancel の状態を観測する |
| 5 | 両 family | 既存 consumer の契約確認 | 3、4 | `buildTaskOrderContent()`、`promoteTaskAttachments()`、`resolveTaskSpecForExecution()`、`stageTaskSpecForExecution()` | persistent attachment、run context、画像 consumer が既存形式を維持する |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|---|---|---|---|---|
| `PR-IMG-PLACEHOLDER-1` | `order.md`、`TaskAttachment`、`buildTaskOrderContent()`、`resolveReferencedImageAttachments()` | 位置付き候補を統合してソートし、成功件数に基づく1-based placeholder を維持する。乱数、URL hash placeholder、fileName 変更、別の公開 API は採用しない | 抽出 URL 列、`downloadImage()` の返却 placeholder、`order.md`、保存済み consumer を比較する | 既存保存形式と公開 consumer を保ったまま、決定性・一意性・初出順を満たす |
| `PR-IMG-TEMP-LIFECYCLE-1` | Knowledge「終了経路の完全性」、契約置換ポリシー、Node runtime 契約 | `downloadImage()` 内 cleanup と `addTask()` 外側 `finally` を維持し、旧 recursive `rmdirSync` を現行の recursive removal API へ置換する。transaction、rollback、signal 基盤、非同期 I/O は採用しない | `gh` の deterministic test double と実 filesystem で、temp directory と persistent attachment の状態を確認する | 取得用資源と永続 task artifact の所有を分離し、正常・失敗・cancel を閉じる |
| 両 family | テストポリシー、プロジェクトのテスト分類 | pure helper は unit、実 filesystem と複数本番コンポーネントを使う `addTask` 経路は軽い integration / heavy integration の既存分類に従う。consumer ごとの重複 assertion は追加しない | placeholder、file、directory、`order.md`、run-context attachment を観測する | 実装詳細ではなく契約結果を検証する |
| 対象外契約 | 現行裁定、契約置換ポリシー | pipeline の新規画像配線、外部 URL 範囲拡張、Content-Type 契約追加、同期 I/O の非同期化、個別失敗の throw 化は計画しない | 現行 remediation の修正範囲外として保持する | 裁定済み family の権限と境界を超えない |
| 環境要因 | 環境要因判定ポリシー | 環境依存として除外しない。`gh` は test double、filesystem は現在の実行環境で決定的に確認する | 現行 report が示す cleanup API の runtime 差異を対象コードと deterministic test で再確認する | 環境要因として扱う全条件を満たさないため、後続環境確認へ移さない |

## 再計画事項

- なし。現在の `fix-verification.md` が示す未達は、既存の2 family の範囲内で、抽出順の producer 修正、cleanup API の置換、回帰証拠の追加により解消できる。
- `fix-report.md` に計画・台帳の引き継ぎ不足が記録されているため、fix-report では本計画の2つの不変条件行を全項目無変更で転記する。回数を初期化しない。