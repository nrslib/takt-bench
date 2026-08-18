問題を、裁定済みの7 familyだけに限定した修正計画へ整理します。まず指定されたKnowledge・Policyを全文確認し、task正本、Report Directoryの現在の裁定と採用指摘、現行コード・テストの実経路を照合します。このステップでは編集しません。
正本の制約を確認しました。今回に直接適用されるのは、契約置換、終了経路の完全性、識別子名前空間、実境界によるテスト分類です。次に、taskの受入条件と現在の裁定を全文で突き合わせ、同一remediation内に先行`fix-verification`がないことも確認します。
現行経路では、画像付きtaskを消費するのは`add --pr`、interactive `--pr`、pipeline `--pr`の3入口で、system context・sync・enqueueは同じ汎用fetchを使うもののattachmentを消費しません。また、routing内だけでなくinteractiveの二度目のSIGINTにも`process.exit()`があり、PR一時資源が生存中なら同じlifecycle不変条件に参加します。計画ではこの終端を局所的に見落とさない所有境界を置きます。
## 結論

現在の`review-resolution.md`でactionableとされた7 familyだけを修正対象とします。計画は確定可能で、ユーザー確認が必要な前提はありません。このステップではソースを編集していません。

現行確認では、`releaseVerificationWiring.test.ts`は16件成功・1件失敗で、未分類ファイルは`src/__tests__/pipelineExecution.test.ts`だけでした。

## 指摘カバレッジ

| 修正単位 | family ID | 分類 | finding ID | 修正権限 |
|---|---|---|---|---|
| U1 | `F-PRIMG-FETCH-BOUNDARY` | 構造問題 | `ARCH-PRIMG-002`、`CODE-NEW-src-infra-github-pr.ts-L464`、`PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | `required_consumer_migration` |
| U2 | `F-PRIMG-REFERENCE-ORDER` | 独立局所問題 | `AI-PRIMG-003`、`ARCH-PRIMG-004`、`CODE-NEW-src-infra-github-pr-images.ts-L184`、`TEST-NEW-PRIMG-01-order` | `direct_acceptance_criterion_violation` |
| U3 | `F-PRIMG-REFERENCE-ALLOCATION` | 識別子生成境界 | `CODE-NEW-src-infra-github-pr-images.ts-L198`、`PRIMG-05-IMAGE-NUMBER-COLLISION` | `direct_acceptance_criterion_violation` |
| U4 | `F-PRIMG-FETCH-SCOPE` | セキュリティ境界 | `SEC-PRIMG-001` | `direct_acceptance_criterion_violation` |
| U5 | `F-PRIMG-DOWNLOAD-API` | 独立局所問題 | `AI-PRIMG-001` | `direct_acceptance_criterion_violation` |
| U6 | `F-PRIMG-TEMP-LIFECYCLE` | 構造問題 | `AI-PRIMG-002`、`ARCH-PRIMG-001`、`ARCH-PRIMG-003`、`CODE-NEW-src-infra-github-pr-images.ts-L311`、`PRIMG-06-PROCESS-EXIT-CLEANUP`、`PRIMG-06-TEMP-DIRECTORY-CLEANUP`、`SEC-PRIMG-002`、`TEST-NEW-PRIMG-06-cleanup` | `direct_acceptance_criterion_violation` |
| U7 | `F-PRIMG-TEST-WIRING` | 独立局所問題 | `PRIMG-08-TEST-CLASSIFICATION` | `direct_acceptance_criterion_violation` |

`TEST-NEW-PRIMG-02-download-content`は裁定済みの`overreach`です。temp file内容の追加assertや途中の複数画像失敗テストを独立要求として追加しません。

## 修正計画

### U1: PR metadataとtask準備の分離

不変条件名: `PR metadata副作用分離`  
担当箇所: `fetchPrReviewComments()`

- [pr.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr.ts)から画像抽出、取得、本文置換を除去し、従来のmetadataだけを返す処理へ戻す。
- [types.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/git/types.ts)の`PrReviewData.attachments`を廃止し、metadataとtask専用資源を型でも分離する。
- task専用の準備境界を`src/infra/git/pr-task.ts`として追加し、`PrReviewData`、`TaskAttachment[]`、cleanup所有者を一体で返す。
- `add --pr`、`resolvePrInput()`、pipelineの`resolveTaskContent()`だけを新境界へ移行する。
- system context、sync、enqueueは引き続き`fetchPrReviewComments()`だけを使う。GitLab経路は画像処理を追加せず、既存metadata動作を保持する。
- 置換済みの`PrReviewData.attachments`経路や互換aliasは残さない。

強制点はtask専用準備境界です。画像downloadと置換を開始できる入口を3つのtask consumerから共有する1箇所に限定します。

### U2: Markdown/HTML混在時の出現順保持

不変条件名: `画像参照出現順整合`  
担当箇所: `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()`

- sanitized bodyごとにMarkdown画像とHTML画像のmatch位置を収集し、位置順へ統合してからdedupe・採番する。
- 現行のコードブロック、inline code、HTML comment、escaped marker除外は保持する。
- 同一URLの重複は、本文上で最初に現れた位置だけを採番元にする。
- 置換は既存どおり末尾側から行い、抽出時に決めたplaceholderを変更しない。
- `formatPrReviewAsTask()`、`buildTaskOrderContent()`まで同じreference列を渡し、placeholder、filename、添付一覧を一致させる。

強制点は「両記法のmatch位置を統合する単一の正規化処理」です。

### U3: 画像番号の名前空間衝突防止

不変条件名: `画像参照名前空間一意性`  
担当箇所: `extractGitHubPrImageReferences()`の採番器

- render対象本文に既に存在する`[Image #N]`を先に収集する。
- 正の未使用番号を小さい順に割り当て、同一batchでも使用済み集合を更新する。
- referenceに割当番号を保持し、filenameを配列位置ではなく同じ番号から`image-N.ext`として生成する。
- 一般attachment機構や既存タスク全体の採番は変更しない。

強制点は使用済み番号集合を唯一の採番元にするallocatorです。

### U4: 認証取得前のrepository scope検証

不変条件名: `認証取得repository scope`  
担当箇所: `isAllowedGitHubAttachmentUrl()`とPR repository context

- task準備時に、providerが返したPR URLから信頼する`owner/repo`を一度だけ確定する。
- `https://github.com/<owner>/<repo>/assets/...`はPRとowner/repoが一致する場合だけ認証付き取得へ進める。
- `https://github.com/other-private/repo/assets/...`はtoken取得やHTTP送信より前に拒否する。
- repositoryとの関連をURLから検証できない`user-attachments/assets/...`は、公開取得可能な場合に限り認証情報なしで取得する。失敗時に認証付き取得へfallbackしない。
- HTTP、GitHub外host、userinfo、port付きURLは引き続き拒否する。
- redirect先へ認証情報を無条件転送しない。

強制点は認証情報を付与する直前のrequest分類です。URL抽出後やpayload検証後ではなく、外部送信前に必ず通します。

### U5: 実在する画像取得経路への置換

不変条件名: `許可画像の実在取得`  
担当箇所: `downloadGitHubPrImages()`

- Web asset完全URLを`gh api` endpointとして渡す処理を削除する。現行`gh api --help`でもendpointはAPI v3 pathまたは`graphql`と確認済み。
- NodeのHTTP取得を使い、認証が許可された同一repository assetだけ、実在確認済みの`gh auth token --hostname github.com`から得るcredentialを付与する。
- response bodyを上限付きで読み込み、既存のContent-Type、magic bytes、10 MiB上限検証へ渡す。
- PNG/JPEG/GIF/WebPから決定した拡張子でprivate temp fileを生成する。
- 再試行、汎用HTTP抽象化、GitHub外URL対応は追加しない。

### U6: temp resourceの全終端解放

不変条件名: `PR画像一時資源終端解放`  
担当箇所: `downloadGitHubPrImages()` / `cleanupGitHubPrAttachments()`

- downloaderの戻り値を、attachment配列と作成した親temp directoryを保持する明示的なresource handleにする。
- `cleanupGitHubPrAttachments()`はattachment個別削除ではなく、そのhandleが所有する正確な親directoryを再帰削除する。cleanupは冪等にする。
- download途中の例外でも同じownerからcleanupする。
- resource生成時に同期的なprocess exit cleanupを登録し、通常cleanup時に解除する。これによりrouting内の明示終了だけでなく、interactive AI呼び出し中の二度目のSIGINTによる`process.exit()`も同じ強制点で閉じる。
- routingのPR head branch欠落箇所は`process.exit(1)`を直接呼ばず例外として上位へ伝播させ、通常の`finally`も通す。SIGINT全体の既存終了仕様は変更しない。
- add、routing、pipelineはresource handleを保持し、成功、保存失敗、workflow選択cancel、interactive cancel、task spec準備失敗、workflow失敗の各終端で解放する。
- task directoryやrun contextへコピー済みの永続attachmentは削除対象にしない。
- `SIGKILL`、一般temp janitor、運用監視は対象外。

強制点はtemp directoryを所有するresource handleと、そのprocess exit hookです。

### U7: pipelineテストの分類配線

不変条件名: `実境界テスト分類`  
担当箇所: `pipelineExecution.test.ts`とtest classifier

- [pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/pipelineExecution.test.ts)は実filesystemを使い、child process・Git・完全なworkflow engineはmockしているため、軽いITに分類する。
- `scripts/test-classification.mjs`の`fileSystemIntegrationTestFiles`へソート順を保って追加する。
- unit gateの除外とlight ITへの包含を同じclassifier定義から成立させる。
- テストを未接続のまま除外したり、別の未変更テストを再分類したりしない。

## 有界graph

| family | 経路 | 分類 |
|---|---|---|
| DOWNLOAD | task準備 → scope判定 → HTTP取得 → payload検証 → temp保存 → attachment consumer | participates |
| REFERENCE-ORDER | raw body → syntax match位置統合 → dedupe → placeholder置換 → formatter → `order.md` | participates |
| REFERENCE-ALLOCATION | 既存placeholder走査 → 未使用番号割当 → filename → attachment manifest | participates |
| FETCH-BOUNDARY | `fetchPrReviewComments()` → system context/sync/enqueue | preserved |
| FETCH-BOUNDARY | task専用fetch/prepare → add/routing/pipeline | participates |
| TEMP-LIFECYCLE | temp生成 → task copy/workflow利用 → success/failure/cancel/process exit → resource cleanup | participates |
| FETCH-SCOPE | PR repository identity → URL分類 → credential付与判断 → download | participates |
| TEST-WIRING | test file → classifier → light IT runner → release verification | participates |
| GitLab、Issue、direct task、非画像リンク、GitHub外provider | 各既存経路 | outside |

## 要求シナリオ

- `<img src=".../first">`の後に`![second](.../second)`がある場合、firstが先の番号になり、本文置換、filename、添付一覧も同順になる。
- `![first]`の後に`<img second>`がある逆順でも同じ規則が成立する。
- 既存`[Image #1]`と新規画像2件が共存する場合、新規は`#2`、`#3`となる。同一URLの再出現は同じplaceholderを使う。
- PRが`org/repo`の場合、`org/repo/assets/...`は認証取得可能だが、`other-private/repo/assets/...`は外部送信前に拒否される。
- `user-attachments/assets/...`にはcredentialを付けず、公開取得できない場合も認証fallbackしない。
- system `pr_context`では元のMarkdown/HTML本文が返り、画像downloadは起きない。add/routing/pipelineでは置換済みtask本文とattachmentが得られる。
- 成功、cancel、保存失敗、workflow失敗、明示exit後にtemp fileと親directoryが存在しない。

## 実施順序

1. U2・U3・U4でreference生成と認証前scope判定を確定する。
2. U5・U6でdownloaderとresource ownershipを一体で置換する。
3. U1でmetadata契約を純化し、3つのtask consumerを新しい準備境界へ同時移行する。
4. 各familyの回帰テストを契約所有者へ追加・更新する。
5. U7でpipelineテストをlight ITへ接続する。
6. fixステップで提供される品質ゲート指示に従って検証する。

## 検証方針

- parser unit: 混在記法の双方向順序、dedupe、既存placeholder衝突。
- scope unit: 同一repo許可、別repo拒否、user-attachmentへのcredential非付与。
- download unit: Web URLが`gh api`へ渡らないこと、認証モード、形式別extension、既存payload検証。
- metadata/task境界: 汎用fetchの本文非置換・downloadなしと、3 task consumerだけのattachment伝播。
- lifecycle: 親directory削除、二重cleanup、download失敗、process exit callback、routingのhead branch欠落、pipelineの代表的失敗終端。
- integration: add保存とpipeline task specでplaceholder、attachment path、永続コピーを観測する。
- classifier: `pipelineExecution.test.ts`がunitから除外されlight ITへ一意に配線され、分類契約が成功する。

実GitHub private repositoryとの認証付きE2Eは、現在の報告証跡では資格情報・対象repositoryが提供されておらず未実証です。実装完了条件は決定的なtransport mock、scope拒否テスト、実task保存経路で確認し、実サービス確認は利用可能なcredential環境での後続確認として分離します。

## 不変条件台帳

引き継ぎ元: **先行 remediation なし**  
同一remediation内にも先行`fix-verification.md`はありません。継承行はありません。

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 再発判定 | 累積 incomplete | 別経路再発 | 強制点 | 完全性 |
|---|---|---|---|---|---|---|---|---|---:|---|---|---|
| U1 | `F-PRIMG-FETCH-BOUNDARY` | PR metadata副作用分離 | `fetchPrReviewComments()` | — | — | — | — | 未検証 | 0 | 未確認 | task専用準備境界 | 完全 |
| U2 | `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | 参照parser/置換器 | — | — | — | — | 未検証 | 0 | 未確認 | match位置統合 | 完全 |
| U3 | `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照名前空間一意性 | 参照採番器 | — | — | — | — | 未検証 | 0 | 未確認 | 使用済み番号集合 | 完全 |
| U4 | `F-PRIMG-FETCH-SCOPE` | 認証取得repository scope | URL許可境界＋PR context | — | — | — | — | 未検証 | 0 | 未確認 | credential付与前分類 | 完全 |
| U5 | `F-PRIMG-DOWNLOAD-API` | 許可画像の実在取得 | downloader | — | — | — | — | 未検証 | 0 | 未確認 | 取得transport境界 | 完全 |
| U6 | `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | downloader/cleanup owner | — | — | — | — | 未検証 | 0 | 未確認 | resource handle＋exit hook | 完全 |
| U7 | `F-PRIMG-TEST-WIRING` | 実境界テスト分類 | test classifier | — | — | — | — | 未検証 | 0 | 未確認 | classifier SSOT | 完全 |

## Policy / Knowledge適用結果

- 適用: 契約置換、現行consumer移行、旧経路削除、終了経路完全性、識別子名前空間、外部入力のscope検証、テスト実境界分類、回帰テスト最小化。
- 非適用: WorkflowEngine遷移、provider/model解決、prompt/facet、session/report、DB migration、UI、別provider画像対応、一般HTTP抽象化、再試行戦略。
- 要追加確認: なし。
- 明示的な非実装制約: `overreach`のdownload内容・途中失敗テスト追加、GitHub外host、GitLab画像対応、SIGKILL、一般temp janitor、周辺リファクタリング、互換alias。