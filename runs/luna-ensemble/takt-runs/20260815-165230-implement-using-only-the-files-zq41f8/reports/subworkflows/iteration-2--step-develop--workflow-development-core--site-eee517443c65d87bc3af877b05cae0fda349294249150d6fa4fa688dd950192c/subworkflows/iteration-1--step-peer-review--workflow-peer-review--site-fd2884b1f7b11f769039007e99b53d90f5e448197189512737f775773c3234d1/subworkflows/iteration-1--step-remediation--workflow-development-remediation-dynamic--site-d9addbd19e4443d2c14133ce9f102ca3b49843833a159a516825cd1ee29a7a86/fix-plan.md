# 修正計画

## 結果: 修正計画確定

現在の`review-resolution.md`でactionableまたはduplicateとして採用された7 familyだけを対象とする。確認が必要な未解決前提はなく、実装工程へ移行できる。

## 指摘カバレッジ

| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|---|---|---|---|---|---|---|---|
| `AI-PRIMG-001` / `ai-antipattern-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:275-303` | `U5-実在画像取得` | 画像取得失敗 → Web完全URLを`gh api`へ渡す → Web asset URLとAPI endpointを同一視 | `pr-images.ts:288-290`と`gh api`のendpoint契約で確認。Content-Type・magic bytes・サイズ検証の欠陥ではないことは既存validatorで確認 | 局所 | 実在するHTTP取得経路へ置換。汎用HTTP抽象化、再試行、GitHub外URL対応は追加しない |
| `AI-PRIMG-002` / `ai-antipattern-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:283-324` | `U6-temp資源終端解放` | temp残留 → fileだけ削除 → 親directoryの所有情報がcleanupへ渡らない | `mkdtempSync()`の戻り値を保持せず、cleanupが`attachment.tempPath`だけを削除。個別file削除失敗だけが原因ではない | 構造 | 成功・失敗・cancel・明示exit後にfileと親directoryが不存在。`SIGKILL`、一般janitorは対象外 |
| `AI-PRIMG-003` / `ai-antipattern-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:184-205` | `U2-画像参照出現順整合` | 番号順逆転 → Markdown結果とHTML結果を連結 → syntax横断の位置正規化がない | `pr-images.ts:192-195`でMarkdown全件が常にHTML全件より前になる。置換時の末尾順reduceは原因ではない | 局所 | 混在記法の本文出現順、placeholder、filename、添付一覧を一致させる |
| `ARCH-PRIMG-001` / `architecture-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:283-323` | `U6-temp資源終端解放` | 空directory残留 → file-only cleanup → resource owner不在 | cleanup後にも`mkdtempSync()`の親が残る再現結果で確認 | 構造 | U6のresource handleへ統合 |
| `ARCH-PRIMG-002` / `architecture-review.md` | `required_consumer_migration` | `pr.ts:464-481` | `U1-PR metadata副作用分離` | system経路でもdownload・置換 → 汎用fetch内でtask準備 → metadataとtask資源の責務混在 | `fetchPrReviewComments()`をsystem context・sync・enqueue・task入口が共用。system側cleanup追加では不要なdownloadと本文置換が残るため解決しない | 構造 | system consumerは元metadataを受け、add/routing/pipelineだけが画像task準備を行う |
| `ARCH-PRIMG-003` / `architecture-review.md` | `direct_acceptance_criterion_violation` | `routing.ts:319-346` | `U6-temp資源終端解放` | 明示終了時にtemp残留 → `process.exit()`が`finally`を迂回 → cleanupがcallerのfinallyだけに依存 | PR head branch欠落経路の`process.exit(1)`で確認。テストのthrow置換は実process exitの証拠にならない | 構造 | 明示exitでもresource ownerが同期cleanupする |
| `ARCH-PRIMG-004` / `architecture-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:192-195` | `U2-画像参照出現順整合` | HTML先行入力が後の番号になる → syntax別抽出 → match位置統合なし | `<img first> ![second]`の再現結果で確認 | 局所 | U2へ統合 |
| `CODE-NEW-src-infra-github-pr.ts-L464` / `backend-review.md` | `required_consumer_migration` | `pr.ts:464-481` | `U1-PR metadata副作用分離` | 汎用fetchの既存契約破壊 → task専用処理を常時実行 → consumer境界未分離 | system consumerがattachmentを受け取らず、置換本文だけを消費する経路で確認 | 構造 | U1へ統合 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` / `backend-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:311-324`、`routing.ts:317-347` | `U6-temp資源終端解放` | file・directory残留 → cleanup対象と終端が不足 → resource ownership欠落 | file-only処理と`process.exit()`経路の双方で確認 | 構造 | U6へ統合 |
| `CODE-NEW-src-infra-github-pr-images.ts-L198` / `backend-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:190-208` | `U3-画像参照名前空間一意性` | 既存`[Image #1]`と衝突 → `references.length + 1`採番 → 使用済み名前空間を参照しない | allocatorの式と既存placeholder入力で確認。保存側は渡されたplaceholderを保持するだけで原因ではない | 局所 | 既存本文と同一batchで一意な番号を割り当てる。一般attachment再設計は行わない |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` / `backend-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:184-205` | `U2-画像参照出現順整合` | syntax混在時の順序破壊 → regex結果の別々の列挙 → 位置正規化なし | 実コードの配列連結で確認 | 局所 | U2へ統合 |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` / `coding-review.md` | `required_consumer_migration` | `pr.ts:464-481`、`system-git-context.ts:72-77` | `U1-PR metadata副作用分離` | system取得の外部I/O増加 → 汎用fetchが画像task準備を所有 → consumer migration不足 | `fetchPrContext()`が同じprovider APIを直接使用 | 構造 | U1へ統合 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` / `coding-review.md` | `direct_acceptance_criterion_violation` | `routing.ts:145-147,319-321` | `U6-temp資源終端解放` | exit時cleanup迂回 → `process.exit()` → cleanupがfinallyだけに存在 | routingとinteractiveの明示exit経路で確認 | 構造 | U6へ統合 |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` / `coding-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:311-324` | `U6-temp資源終端解放` | 親directory蓄積 → attachment fileだけ削除 → directory owner未伝播 | cleanup実装で確認 | 構造 | U6へ統合 |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` / `coding-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:190-204` | `U3-画像参照名前空間一意性` | 既存参照と新規参照が同名 → 件数だけで採番 → 使用済み番号集合なし | 既存`[Image #1]`との再現結果で確認 | 局所 | U3へ統合 |
| `PRIMG-08-TEST-CLASSIFICATION` / `coding-review.md` | `direct_acceptance_criterion_violation` | `pipelineExecution.test.ts:2-4,1321-1368`、`releaseVerificationWiring.test.ts:459` | `U7-実境界テスト分類` | unit分類違反 → 実`node:fs`を利用 → classifierへの接続漏れ | 現在の分類契約は16件成功・1件失敗し、未分類対象は同ファイルのみ。所要時間は原因ではない | 局所 | light ITへ一意に接続。テスト除外のみ、全体E2E追加、別テスト再分類はしない |
| `SEC-PRIMG-001` / `security-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:116-139`、`pr.ts:406-436` | `U4-認証取得repository scope` | 別private repo資産を認証取得可能 → host/path種別だけを確認 → PR repository contextを認可判断に使わない | `other-private/repo/assets/...`も現predicateを通る。Content-Type・magic検証は取得後の検証であり認証付き送信を防がない | 構造 | 現PRと関連を確認できる範囲だけ認証取得。GitHub外hostや未検証URL許可は追加しない |
| `SEC-PRIMG-002` / `security-review.md` | `direct_acceptance_criterion_violation` | `pr.ts:469`、`pr-images.ts:283-323` | `U6-temp資源終端解放` | system経路と親directoryに画像残留 → 不要downloadとfile-only cleanup → ownership境界欠落 | system consumerがcleanupを持たない経路と親directory残留で確認。metadata部分はU1へ移行し、新familyは作らない | 構造 | U6へ統合。system側の不要download除去はU1で閉じる |
| `TEST-NEW-PRIMG-01-order` / `testing-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:190-195`、`github-pr-images.test.ts:28-56` | `U2-画像参照出現順整合` | 混在記法回帰を検出不能 → syntax別の単独fixtureだけ → 同一本文の順序観測なし | 実装上の順序欠陥と既存テスト入力を照合 | 局所 | 混在記法の双方向をparser所有テストで検証 |
| `TEST-NEW-PRIMG-06-cleanup` / `testing-review.md` | `direct_acceptance_criterion_violation` | `pr-images.ts:283-323`、`pipelineExecution.test.ts:1321-1368`、`routing.ts:121-347` | `U6-temp資源終端解放` | cleanup漏れを検出不能 → fileまたはproject全体だけを確認 → owner directoryと実exitを観測しない | pipelineテストの最終project削除がtemp ownerの漏れを区別しないことを確認 | 構造 | resource ownerと代表terminalで親directory不存在を検証 |

裁定済み`overreach`である`TEST-NEW-PRIMG-02-download-content`は修正単位へ含めない。temp file bytesの追加assertや複数画像途中失敗テストを独立要件として追加しない。

## 不変条件台帳

引き継ぎ元: `../../review-resolution.md`（記載: **先行 remediation なし**）

### 引き継ぎ元からの行

引き継ぐ不変条件行なし。初期値への変換や合成行は作成しない。

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

### 新規・現在の計画行

| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|---|---|---|---|---|---|---|---|
| `U1-PR metadata副作用分離` | `F-PRIMG-FETCH-BOUNDARY` | `PR metadata副作用分離` | system系consumerは元本文を受けて画像downloadを起こさず、add/routing/pipelineだけがattachmentを受ける | `fetchPrReviewComments()` | 構造 | 未確認 | task専用のPR準備境界だけが画像取得・置換を開始できる構造 |
| `U2-画像参照出現順整合` | `F-PRIMG-REFERENCE-ORDER` | `画像参照出現順整合` | Markdown/HTML混在時もplaceholder、filename、本文参照、添付一覧が本文出現順に一致する | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | 局所 | 未確認 | 不要: 既存担当箇所でmatch位置を統合して直接修正 |
| `U3-画像参照名前空間一意性` | `F-PRIMG-REFERENCE-ALLOCATION` | `画像参照名前空間一意性` | 新規画像のplaceholderとfilenameが既存本文および同一batch内で衝突しない | `extractGitHubPrImageReferences()`の採番責務 | 局所 | 未確認 | 不要: 既存担当箇所で使用済み番号集合から直接採番 |
| `U4-認証取得repository scope` | `F-PRIMG-FETCH-SCOPE` | `認証取得repository scope` | PR本文が現在のPRと関連しないprivate repository資産を認証付き取得させない | `isAllowedGitHubAttachmentUrl()`とPR repository context | 構造 | 未確認 | credential付与直前に必ず通る単一request分類境界 |
| `U5-実在画像取得` | `F-PRIMG-DOWNLOAD-API` | `許可画像の実在取得` | 許可画像URLから検証済みPNG/JPEG/GIF/WebP attachmentが生成される | `downloadGitHubPrImages()` | 局所 | 未確認 | 不要: 既存downloaderで実在するHTTP取得へ直接置換 |
| `U6-temp資源終端解放` | `F-PRIMG-TEMP-LIFECYCLE` | `PR画像一時資源終端解放` | 成功・失敗・cancel・明示exit後にtemp fileと親directoryが存在しない | `downloadGitHubPrImages()` / `cleanupGitHubPrAttachments()` | 構造 | 未確認 | 親directoryを所有するresource handleと同期process-exit cleanup |
| `U7-実境界テスト分類` | `F-PRIMG-TEST-WIRING` | `実境界テスト分類` | 実filesystemテストがunit gateに残らずlight ITから実行される | `pipelineExecution.test.ts`とtest classifier | 局所 | 未確認 | 不要: classifierの既存SSOTへ直接接続 |

## 欠陥 family の最終状態

| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|---|---|---|---|---|---|---|
| `U1-PR metadata副作用分離` | PR metadata取得とtask attachment準備の責務分離 | metadata本文は非置換、metadata取得はdownloadなし、task入口だけが置換済み本文とattachmentを得る | `fetchPrReviewComments()`はmetadataのみ。task専用準備関数が画像処理とresource ownershipを担当 | `fetchPrReviewComments()` → system context/sync/enqueue → metadata terminal（preserved）。task準備 → add/routing/pipeline → task保存・実行（participates） | `SCN-U1-P1`、`SCN-U1-N1` | add、routing-inputs、pipelineをtask準備境界へ移行。`PrReviewData.attachments`と汎用fetch内の画像処理を削除。GitLab画像機能は追加しない |
| `U2-画像参照出現順整合` | PR本文・通常コメント・review本文の画像参照順 | syntax横断のmatch位置順、最初の出現によるdedupe、同じplaceholderによる置換、filename・添付一覧との対応 | 既存parser/置換器でMarkdown・HTML matchを位置付きで統合 | raw body → 非render領域除外 → match位置統合 → dedupe → 置換 → formatter → `buildTaskOrderContent()` → `order.md`（participates） | `SCN-U2-P1`、`SCN-U2-N1` | syntax別配列を単純連結する旧処理を削除。Markdown parser全面刷新や非画像リンク処理は行わない |
| `U3-画像参照名前空間一意性` | `[Image #N]`と`image-N.ext`の一意性 | 既存placeholder予約、同一batch予約、正の未使用番号、placeholderとfilenameの同一番号 | 既存採番器が使用済み番号集合を唯一の採番元とする | review body群 → 既存番号走査 → 未使用番号割当 → replacement → attachment filename → manifest → task consumer | `SCN-U3-P1`、`SCN-U3-N1` | `references.length + 1`と配列index由来filenameを削除。一般attachment機構は変更しない |
| `U4-認証取得repository scope` | 低信頼PR本文からの認証付き取得範囲 | HTTPS/GitHub host、userinfo・port拒否、現PR owner/repo一致、credentialの非漏洩、未検証URLへの認証fallback禁止 | PR URLから確定したrepository contextを、認証情報付与前のURL分類へ渡す | PR metadata URL → repository identity → image URL分類 → credential判断 → download → payload検証 → task consumer | `SCN-U4-P1`、`SCN-U4-N1` | host/pathだけの旧predicateを置換。別repo、GitHub外host、未検証外部URLを許可しない |
| `U5-実在画像取得` | 認証が必要なGitHub画像を実在する取得方式で保存する | Web URLをAPI endpointとして扱わない、response Content-Type取得、上限付きbody読込、既存magic/size検証、形式別extension | downloaderがHTTP responseを取得し、既存payload validatorとprivate file writerへ渡す | task準備 → scope判定 → HTTP取得 → size/content検証 → temp file → attachment → add/routing/pipeline | 同一repo PNG/JPEG/GIF/WebPは対応extensionで利用可能。HTML/404/サイズ超過はattachment化しない。10 MiBが境界 | `gh api <Web URL>`経路とheader/body分割処理を削除。汎用HTTP layer、retryは追加しない |
| `U6-temp資源終端解放` | 一時画像資源の所有と終端解放 | fileと親directoryの一体所有、冪等cleanup、download失敗、task copy後、cancel、workflow失敗、明示exitでの解放 | downloaderがresource handleを返し、cleanupがhandleの正確な親directoryを削除する。process exitにも同期hookを登録 | temp生成 → attachment transfer → task保存またはworkflow実行 → success/failure/cancel/exit → cleanup terminal。interactive二度目SIGINTは既存exit動作を維持し、hookで解放 | 正常cleanupと明示exitで親directory不存在。二重cleanupは同じ外部状態。`SIGKILL`は対象外 | attachment pathだけを受ける旧cleanupを削除。add/routing/pipelineへhandleを伝播。routingのPR head欠落時の直接`process.exit()`を例外伝播へ置換 |
| `U7-実境界テスト分類` | TAKTの実境界によるunit/light IT分類 | 実`node:fs`利用ファイルはunit除外とlight IT包含が同じclassifierから決まり、未接続にならない | `scripts/test-classification.mjs`のfilesystem分類が所有者 | `pipelineExecution.test.ts` → classifier → light IT config → targeted routing → release verification | 現在は未分類として失敗。変更後はlight ITへ1回だけ含まれ、unitには含まれない | `pipelineExecution.test.ts`をfilesystem分類へ追加。テスト内容の全面移動、skip、別ファイル再分類は行わない |

## 要求シナリオ（条件付き）

```gherkin
Scenario: [SCN-U1-P1] task専用入口ではPR画像がattachmentになる
  Given PR本文が「![shot](https://github.com/org/repo/assets/123/shot.png)」でtask入口がadd --prである
  When PR task準備を実行する
  Then task本文は「[Image #1]」となりimage-1.pngがattachmentとして返る

Scenario: [SCN-U1-N1] system metadata入口では同じ画像記法を変換しない
  Given PR本文が「![shot](https://github.com/org/repo/assets/123/shot.png)」で入口がsystem pr_contextである
  When fetchPrReviewCommentsを実行する
  Then 元のMarkdown本文が返り画像HTTP取得は実行されない

Scenario: [SCN-U2-P1] HTML先行の混在記法を本文順に採番する
  Given 本文が「<img src="https://github.com/user-attachments/assets/first"> then ![second](https://github.com/user-attachments/assets/second)」である
  When 画像参照を抽出して置換する
  Then firstが[Image #1]、secondが[Image #2]となりattachment一覧も同順になる

Scenario: [SCN-U2-N1] コード内の同じ画像記法を抽出しない
  Given fenced code内に「![sample](https://github.com/user-attachments/assets/sample)」だけがある
  When 画像参照を抽出して置換する
  Then referenceとattachmentは生成されずコード本文も変更されない

Scenario: [SCN-U3-P1] 既存番号を避けて新規画像を採番する
  Given 本文に既存の「[Image #1]」と新規画像「![new](https://github.com/user-attachments/assets/new)」がある
  When 新規画像参照を割り当てる
  Then 新規画像は[Image #2]とimage-2.extを使用する

Scenario: [SCN-U3-N1] 同一URLの再出現で別番号を消費しない
  Given 同じURLがMarkdown画像とHTML画像として各1回現れ、[Image #1]は既存本文で使用済みである
  When 新規画像参照を割り当てる
  Then 両出現は同じ[Image #2]を参照し[Image #3]は生成されない

Scenario: [SCN-U4-P1] 現在のPR repository資産だけを認証取得する
  Given PR URLがhttps://github.com/org/repo/pull/42で画像URLがhttps://github.com/org/repo/assets/123/image.pngである
  When 認証付き画像requestを分類する
  Then org/repoのcredential付き取得が許可される

Scenario: [SCN-U4-N1] 別repository資産を認証取得しない
  Given PR URLがhttps://github.com/org/repo/pull/42で画像URLがhttps://github.com/other-private/repo/assets/123/image.pngである
  When 認証付き画像requestを分類する
  Then credential取得と画像HTTP requestの前に拒否される
```

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|---|---|---|---|---|---|
| 1 | `U2-画像参照出現順整合` | 局所修正 | なし | `src/infra/github/pr-images.ts:184-252`、`src/__tests__/github-pr-images.test.ts` | 混在記法の双方向でURL、placeholder、置換本文の順序が一致し、非render領域は保持される |
| 2 | `U3-画像参照名前空間一意性` | 局所修正 | U2 | `src/infra/github/pr-images.ts:184-208`、`src/__tests__/github-pr-images.test.ts` | 既存番号を避け、reference番号とfilename番号が一致する |
| 3 | `U4-認証取得repository scope` | 境界変更 | U2 | `src/infra/github/pr-images.ts:116-139`、PR URL repository解析、関連テスト | 同一repo許可、別repo拒否、外部送信前拒否、user-attachmentへの認証fallbackなしを観測できる |
| 4 | `U5-実在画像取得` | 局所修正 | U4 | `src/infra/github/pr-images.ts:275-309`、`src/__tests__/github-pr.test.ts` | Web URLが`gh api` endpointへ渡らず、検証済み形式のattachmentが生成される |
| 5 | `U6-temp資源終端解放` | 境界変更・利用側移行・旧cleanup削除 | U5 | `src/infra/github/pr-images.ts:283-324`、`src/features/tasks/add/index.ts:181-222`、`src/app/cli/routing.ts:118-347`、`src/features/pipeline/execute.ts:47-106`、関連テスト | resource handleが全terminalで一度解放され、fileと親directoryが残らない |
| 6 | `U1-PR metadata副作用分離` | 境界変更・全consumer移行・旧経路削除 | U2〜U6 | `src/infra/github/pr.ts:426-483`、`src/infra/git/types.ts`の`PrReviewData`、新規task準備module、`src/features/tasks/add/index.ts:181-222`、`src/app/cli/routing-inputs.ts:50-77`、`src/features/pipeline/steps.ts:216-235`、system関連テスト | system経路はdownload・置換なし。3 task入口だけが同じ準備境界からattachmentを取得し、旧`PrReviewData.attachments`経路が残らない |
| 7 | `U7-実境界テスト分類` | 局所配線 | U1、U6 | `scripts/test-classification.mjs`、`src/__tests__/pipelineExecution.test.ts` | 対象ファイルがlight ITだけに含まれ、分類契約が未分類0件になる |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|---|---|---|---|---|
| `U1-PR metadata副作用分離` | task要件、契約置換Policy、責務分離Knowledge | 専用task準備境界を採用。system各consumerへのcleanup追加は、不要downloadと本文置換を残すため不採用 | 汎用fetchの戻り本文と画像request回数、3 task入口のattachment引渡しを観測 | metadata契約を保持し、変更対象consumerだけを移行して旧経路を削除する |
| `U2-画像参照出現順整合` | PR本文画像抽出要件、Raw入力正規化、テストPolicy | regex全面刷新ではなく、既存matchへindexを付けて統合する | SCN-U2-P1/N1をparser所有テストで検証 | 既存のコード領域除外とURL dedupeを保持する最小変更 |
| `U3-画像参照名前空間一意性` | task attachment参照要件、識別子名前空間Knowledge | 使用済み番号集合を採用。全attachment機構の再設計は不採用 | SCN-U3-P1/N1でplaceholderとfilenameを観測 | 生成IDの正本を1つにし、既存本文との衝突だけを解消する |
| `U4-認証取得repository scope` | 安全性要件、信頼境界、契約置換Policy | PR repository contextとの一致をcredential付与前に強制。別repo許可や認証fallbackは不採用 | SCN-U4-P1/N1、credential付与の有無、network呼出し回数を観測 | 認証方式全体を変更せず、今回追加した取得境界だけを制限する |
| `U5-実在画像取得` | 認証付き取得要件、Content-Type/magic/size既存契約 | Node HTTP取得を採用。Web URLの`gh api`渡し、一般HTTP layer、retryは不採用 | 決定的なHTTP response doubleと既存形式validatorで検証。実private repo連携はcredential環境で後続確認 | 現在の環境でもtransport引数とpayload処理は決定的に検証できる |
| `U6-temp資源終端解放` | 終了経路完全性Knowledge、状態・副作用Policy | 親directoryを所有するresource handleとprocess exit hookを採用。file推測削除や一般janitorは不採用 | 正常、失敗、cancel、明示exitで親directory不存在とcleanup一回性を観測 | ownerとcleanup対象が同じ構造に入り、callerのfinallyだけに依存しない |
| `U7-実境界テスト分類` | TAKTテスト実行Policy、分類契約 | filesystem分類へ追加。fs mock化はtask specの実コピー観測を失うため不採用。重いIT化は実境界に合わない | classifier出力、unit除外、light IT包含、対象テスト完了結果を観測 | 実filesystemのみを使い、child process・Git・完全engineはmock済みのためlight ITに一致 |

実GitHub private repositoryとの認証付きE2Eは、現在の証跡では資格情報と対象repositoryが提供されていないため環境要因により未実証である。実装修正からは除外せず、決定的なtransport・scope・保存経路のテストを完了証拠とし、実サービス確認だけをcredential利用可能環境での後続確認とする。

`TEST-NEW-PRIMG-02-download-content`、GitHub外host、GitLab画像対応、一般temp janitor、`SIGKILL`対応、再試行戦略、互換alias、周辺リファクタリングは実装しない。

## 再計画事項

- なし。7 familyの原因、責務、consumer、terminal、受入条件、修正境界を現行前提で確定済み。