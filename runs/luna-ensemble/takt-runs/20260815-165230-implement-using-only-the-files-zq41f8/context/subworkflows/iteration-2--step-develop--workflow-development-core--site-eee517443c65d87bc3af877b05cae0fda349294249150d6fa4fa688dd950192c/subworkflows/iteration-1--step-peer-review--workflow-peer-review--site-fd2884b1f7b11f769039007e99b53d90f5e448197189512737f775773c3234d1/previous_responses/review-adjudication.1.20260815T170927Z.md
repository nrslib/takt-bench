## coding-review
問題を要約すると、指定された15ファイルの累積変更がタスク仕様を満たしているか、実コードの入口から終端 consumer まで追跡して不具合・退行・テスト不足をレビューします。編集・コミット・ステージングは行いません。

方針は、まず正本の仕様・Policy・Knowledge・過去レビュー記録を全文確認し、次に変更契約と family を特定したうえで、指定ファイルの差分と周辺 call/data flow、関連テスト・実行証跡を照合します。確認できた事実だけを重大度順に報告します。
正本の `order.md` から、今回の変更契約は「PR本文・通常コメント・review thread の画像記法を対象に、許可された画像だけを検証・取得し、task attachment として保存し、add と pipeline の両入口から参照可能にすること」と確認しました。続けて、指定されたレビュー基準の全文と、前段の実装・テスト証跡を確認します。
実装証跡では、計画上の主 family が「PR画像を検証済み attachment として add／対話型／pipeline の終端へ届けること」で、既存の GitLab・Issue・system metadata 経路は保持対象とされています。次に、証跡の主張を現在のコードへ再照合し、特に認証取得、形式検証、採番、cleanup、pipeline の最終 consumer を確認します。証跡に「未完了」「未実証」と記載された項目も、現在コードと対象テストで再判定します。
現在コードの再照合で、少なくとも次の経路上の不整合候補を確認しています。

- `fetchPrReviewComments()` に画像取得副作用を埋め込んだため、画像を消費しない system PR metadata/sync 経路まで取得・本文置換・一時ファイル生成の影響を受ける。
- cleanup は添付ファイル自体を消すものの、生成した一時ディレクトリを残します。実行確認でもファイル消失後に空ディレクトリが残りました。
- PR本文に既存の `[Image #1]` がある場合でも新規画像を `[Image #1]` に採番します。実コードの直接実行でこの衝突を確認しました。

この後、対象テストを実行して挙動の証跡を補強し、cleanup の `process.exit()` 経路や既存 consumer への影響を含めて finding を分離します。
判定: **REJECT**

変更契約の主経路（PR画像抽出 → ダウンロード → タスク保存／パイプライン実行 → 後片付け）を確認しました。既存のPRメタデータ取得・システム同期経路は今回の契約外ですが、今回の変更により副作用が混入しています。

### 指摘

1. **[P1] `fetchPrReviewComments` に画像ダウンロード副作用が混入している**

   `src/infra/github/pr.ts:464-481`

   `fetchPrReviewComments()` はシステムコンテキストや同期処理からも呼ばれますが、ここで `gh api` による画像取得と本文置換を実行しています。画像取得失敗時には、タスク作成以外のPR取得・同期まで失敗します。また、システム側では添付ファイルを消費・後片付けしません。

   PRメタデータ取得を純粋な処理として維持し、画像準備は `add`／interactive／pipeline専用のタスク準備境界へ分離してください。

2. **[P1] `process.exit()` によりPR画像の後片付けが実行されない**

   `src/app/cli/routing.ts:145-147`  
   `src/app/cli/routing.ts:319-321`

   `prAttachments` 設定後に `resolveBaseBranch()` が失敗した場合、および interactive の保存時にPRブランチが未確定の場合、`process.exit()` が `finally` を迂回します。ダウンロード済みの一時画像が残ります。

   `process.exit()` 前に明示的に cleanup するか、終了処理を `finally` の管理下へ移してください。

3. **[P1] 既存の `[Image #N]` と新規画像の番号が衝突する**

   `src/infra/github/pr-images.ts:190-204`

   画像番号を検出画像数だけで採番しており、本文中の既存参照を考慮していません。実行結果も以下のとおり、既存の `[Image #1]` がある本文に新規画像を追加しても新規画像が `[Image #1]` になります。

   ```text
   [{"placeholder":"[Image #1]","url":"https://github.com/acme/repo/assets/123/x.png"}]
   ```

   既存本文の `[Image #N]` と既存添付ファイル名を走査し、未使用の番号を割り当ててください。

4. **[P2] cleanup が一時ディレクトリを削除しない**

   `src/infra/github/pr-images.ts:311-324`

   cleanup は画像ファイルだけを削除し、`/tmp/takt-github-pr-*` の親ディレクトリを残します。実行確認でも、ファイルは消える一方で空ディレクトリが残りました。繰り返し実行すると一時ディレクトリが蓄積します。

   ダウンロード単位のディレクトリ所有権を保持し、全ファイル削除後に親ディレクトリも削除してください。

5. **[P1] 変更テストがリリース検証の分類契約に違反している**

   `src/__tests__/pipelineExecution.test.ts:2-4,1321-1368`

   このテストは実ファイルシステムを使用していますが、`releaseVerificationWiring.test.ts` の分類検証で失敗します。

   ```text
   expected: []
   received: ["src/__tests__/pipelineExecution.test.ts"]
   ```

   実ファイルシステム部分を適切な統合テストへ移すか、ユニットテスト内でファイル依存をモックし、分類検証を通過させてください。

### 実行確認

- 変更対象の機能テスト: **170件成功**
- `releaseVerificationWiring.test.ts`: **失敗**
- 既存番号衝突: **再現**
- cleanup後の親一時ディレクトリ残存: **再現**

---

## ai-antipattern-review
日本語でレビューを行います。まず、指定された要件・Policy・Knowledge・過去レポートを全文確認し、その後15件の変更対象について契約の定義から終端 consumer までを再追跡します。ソースは変更せず、AI特有の問題に限定して判定します。
指定された review ディレクトリには現時点でレポート本文がなく、同一 run の実行履歴として利用できるのは前段の `implementation-report.md` と `test-report.md` でした。これらも含め、まず正本の Policy と Knowledge を全文で確認します。
要件は「PR本文・通常コメント・review thread の画像を、許可URL・形式・サイズ検証付きで添付化し、`add --pr`、対話型 `--pr`、pipeline `--pr` の終端まで届ける」です。前段記録には契約 family の既存タグがないため、まず今回の15ファイルから同一不変条件の経路を確定し、AI由来の配線漏れ・幻覚API・不要なフォールバック・テストダブルによる見かけの修正を重点確認します。
実装経路を確認したところ、画像抽出から添付保存・対話型 seed・pipeline の task spec までの配線自体は存在します。ただし、ダウンロード処理が `gh api` にブラウザ用の完全URLをそのまま渡しており、ローカルの `gh` 2.87.3 では同形式がAPI endpointとして扱われず404になることを確認しました。周辺の cleanup と抽出順も、同じ契約の範囲で追加検証します。
対象テストは型契約を含めて170件が成功しましたが、GitHub API境界はすべてモックでした。実際の `gh api` で完全URLを渡すと404になるため、テスト成功は本番ダウンロードの証拠になりません。さらに、成功後の一時ディレクトリ残存と、Markdown/HTML混在時の画像番号順序を確認しました。
結論: **REJECT**（新規 finding 3件）。ソース変更は行っていません。

現行 review ディレクトリには `review-resolution.md` などの既存 family 台帳がないため、既存タグは確認できませんでした。

### Finding

1. `AI-PRIMG-001` / `family_tag: pr-image-download` / `new`

[`pr-images.ts:288`](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:288)

`gh api` に `https://github.com/user-attachments/assets/...` というブラウザ用完全URLを渡しています。`gh api` はAPIパスまたは `graphql` を受け取るため、この呼び出しは実際に `Not Found` / `HTTP 404` になります。

そのため、PR取得 → 画像抽出 → ダウンロードの経路が本番では失敗し、添付保存まで到達しません。追加テストは `execFileSync` のモックで同じ不正な引数を検証しているだけです。

2. `AI-PRIMG-002` / `family_tag: pr-image-cleanup` / `new`

[`pr-images.ts:283`](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:283)、[`pr-images.ts:311`](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:311)

`mkdtempSync()` で作成した一時ディレクトリは、cleanup 時に画像ファイルだけ削除され、親ディレクトリが残ります。`add --pr`、対話型経路、pipeline の成功・キャンセル後に空の `takt-github-pr-*` ディレクトリが蓄積します。要件および PRIMG-06 の終端 cleanup 契約を満たしていません。

3. `AI-PRIMG-003` / `family_tag: pr-image-order` / `new`

[`pr-images.ts:192`](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:192)

同一本文内の画像を Markdown と HTML で別々に抽出し、Markdown結果を先に連結しています。本文が HTML画像 → Markdown画像の順でも、画像番号は Markdown側が `Image #1` になります。PRIMG-01 の「重複除去と出現順保持」に違反します。

### 確認結果

対象テスト170件、TypeScript型検査、`git diff --check` は成功しました。ただしGitHub API境界はモックのみで、Finding 1を検出できません。

---

## architecture-review
問題を要約すると、指定された15ファイルについて、今回の契約変更に関係する責務所有者と実際の呼び出し・データ経路を確認し、既存 family との重複を照合したうえで、アーキテクチャ上の差し戻し事項だけを判定します。編集・コミットは行いません。

まず正本の要件、完全な architecture-review の Knowledge/Policy、Report Directory の既出 finding と最新履歴を読み、その後に累積差分と関連する全経路を確認します。
正本の要件と既存の実装履歴を確認しました。現時点の Report Directory には今回の architecture-review 用の既出 finding はなく、参照可能な履歴は実装計画・実装証跡・テスト報告です。実装証跡自身が契約台帳との対応を未確認としているため、そこはコードと要件から再照合します。

次に、指定された Knowledge と Policy を省略なく読み、finding の許可条件と family 引き継ぎ規則を確定します。
Knowledge/Policy の全文確認が完了しました。適用する中心基準は、契約所有者を一つに定めた end-to-end 配線、外部入力の境界正規化、主操作から終端 consumer までの到達、そして一時資源の正常・失敗・キャンセル・強制終了時の所有権です。finding は現在コードで直接確認でき、今回の変更契約に因果的なものだけを対象にします。

これから変更対象15ファイルを全文確認し、まず画像抽出・ダウンロード・task attachment の責務境界と、add/interactive/pipeline の3入口の配線を追います。
配線を追った結果、暫定的に2つの設計リスクが見えていますが、まだ finding として確定していません。

- `fetchPrReviewComments()` が PR 本文を返すだけの既存 provider API の中で画像をダウンロードし、system の `pr_context`・enqueue・sync という画像不要の consumer にも副作用を伝播させています。
- GitHub 画像の一時ディレクトリは作成されていますが、cleanup は各ファイルだけを削除し、さらに routing の `process.exit()` 経路では cleanup の `finally` 自体を通りません。

これらが今回の契約・実在経路に直接関係することを、残りの変更対象と実行可能な証拠で確認します。
現在の実装で、画像取得の外部 CLI 契約と一時ファイルの所有境界を追加確認します。特に、`fetchPrReviewComments` が画像を必要としない呼び出し元にも副作用を伝播させていないか、実際の呼び出し経路で判定します。
仕様と実装計画では、画像ダウンロードの一時ディレクトリは準備結果が所有し、system metadata 経路では取得しない設計が明記されています。現行コードはその境界から外れているため、残存ディレクトリの再現結果も再確認します。
確認を完了しました。変更対象の主経路（add、対話型、pipeline）と、今回の副作用で新たに巻き込まれた system PR metadata 経路を同一 family の境界で照合し、再現可能な問題を4件に絞ります。 

## 判定: REJECT

Report Directory に既存の `review-resolution.md`／レビュー履歴はなく、以下はすべて `new` finding です。

確認した主経路は、PR取得 → 画像抽出・検証 → 一時保存 → add／対話型／pipeline → task・workflow終端です。Issue、直接入力、GitLab、既存のinline paste経路は `outside` として報告対象から除外しました。

### ARCH-PRIMG-001 — 一時ディレクトリが削除されない

- `family_tag`: `github-pr-image-temp-lifecycle`
- 場所: [pr-images.ts:283](</Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:283)、[pr-images.ts:311](</Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:311>)
- `downloadGitHubPrImages()` は専用ディレクトリを作成しますが、`cleanupGitHubPrAttachments()` はファイルだけを削除し、親ディレクトリを削除しません。
- `npm test -- src/__tests__/github-pr.test.ts` は44件成功しましたが、cleanup後も新しい空の `takt-github-pr-*` ディレクトリが残りました。
- ダウンロード用ディレクトリの所有者を返すcleanup ownerにするか、cleanup処理でディレクトリまで確実に削除してください。

### ARCH-PRIMG-002 — metadata取得APIへ画像ダウンロード副作用を混入させている

- `family_tag`: `github-pr-image-task-preparation`
- 場所: [pr.ts:464](</Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr.ts:464>)
- `fetchPrReviewComments()` が常に画像抽出・`gh api`取得・本文置換まで実行します。
- このAPIは `system-git-context.ts:77` から `pr_context`、enqueue、sync処理にも使われます。これらは添付を消費せずcleanupもしません。
- その結果、branch-only metadata取得でも不要な外部I/Oと一時ファイルが発生し、`pr_context` の本文だけが `[Image #N]` に変換されて対応ファイルを持たない状態になります。
- `fetchPrReviewComments()` はmetadata producerとして維持し、add／routing／pipeline専用の明示的なPR task準備境界へ画像処理を移してください。

### ARCH-PRIMG-003 — `process.exit()` が画像cleanupを迂回する

- `family_tag`: `github-pr-image-temp-lifecycle`
- 場所: [routing.ts:319](</Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/app/cli/routing.ts:319>)、[routing.ts:342](</Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/app/cli/routing.ts:342>)
- PR画像取得後、`save_task` で `prBranch` がない場合に `process.exit(1)` します。
- `process.exit()` は内側・外側の `finally` を実行しないため、`prAttachments` とinteractive attachmentの両方が残ります。
- exit前に明示cleanupするか、例外を投げてcleanupを通過してから終了してください。

### ARCH-PRIMG-004 — MarkdownとHTML画像の番号順が本文順にならない

- `family_tag`: `github-pr-image-reference-order`
- 場所: [pr-images.ts:192](</Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:192>)
- 現在はMarkdown画像を全件抽出した後にHTML画像を全件抽出しています。
- 本文が `<img first> ![second]` の場合、実結果は `second → [Image #1]`、`first → [Image #2]` になりました。
- 計画上の「重複を除いて順序を保持する」契約に違反し、filenameと本文参照の順序が逆転します。
- Markdown／HTMLのmatch位置を統合して本文上の出現順でdedupe・採番してください。

以上のため、現状は承認できません。

---

## backend-review
問題を要約すると、指定された15ファイルの変更が `order.md` の要求と観測可能な契約を満たすかを、実コード・累積差分・実行証跡に基づいて判定します。まず正本の仕様・Policy・Knowledgeと既存レビュー履歴を全文確認し、その後に変更対象の定義から終端 consumer までを追跡して、重大度順に指摘または APPROVE を返します。編集・コミット・ステージングは行いません。
仕様では、PR本文・通常コメント・review thread の画像を抽出し、形式・Content-Type・magic bytes・サイズ制限を検証して task attachment として `add --pr` と pipeline の両経路へ渡すことが契約です。Policy/Knowledge は出力が長いため、途中省略がないよう範囲を分けて全文を確認します。既存の今回ラウンド用レポートディレクトリにはレビュー報告がまだ見当たらず、前段の実装証跡のみ確認できています。
正本の Policy と Knowledge を全文確認しました。今回適用する基準は、変更契約の全経路配線、外部画像取得の入力検証・エラー伝播、主操作から保存・後続実行までの追跡、変更による既存契約の回帰、そして実コードで裏付けられた finding のみを REJECT とする点です。次に実装者の計画・判断・テスト証跡を読み、既出 family があれば照合します。
実装証跡では、実装者自身が `PRIMG-01`〜`PRIMG-08` の契約 family と、画像検証・保存・interactive・pipeline・cleanup の経路を宣言しています。ただし今回のレビューではその主張を証拠扱いせず、現行コードとテストを再確認します。まず外部入力境界（URL・認証・Content-Type・magic・サイズ）と共通 task 準備入口を確認し、次に3つの利用者入口を追います。
実コードの一次走査で、少なくとも次の2系統を確認しました。`fetchPrReviewComments()` 自体に画像ダウンロード副作用を入れたため、metadata-only の system `pr_context`・enqueue・sync が同じ API を呼び、添付を消費せず cleanup もしません。さらに PR downloader の cleanup は個別ファイルしか削除せず、成功・キャンセル後に mkdtemp の空ディレクトリを残します。加えて、PR画像の番号割当が本文内の既存 `[Image #N]` / `image-N` を考慮していない点を、仕様・実装・テストの突合で確認中です。対象テストも実行して、証拠を補強します。
対象テストは `npm test -- ...` で 6ファイル・170テストが成功しましたが、これは新規テストが検証していない経路を否定しません。実行後の `/var/folders/.../T` には `takt-github-pr-*` の一時ディレクトリが8個残り、空ディレクトリだけでなく、呼び出し側が cleanup しない経路ではファイルも残り得ることをコードで確認しました。次に、番号衝突と構文順序の再現結果、build/lint、最終行番号を確認します。
判定: REJECT

既存の `review-resolution.md` / レビュー履歴は確認できず、以下は新規 finding です。

- `F-PRIMG-07-001`（P1、family: `PRIMG-07`）  
  `src/infra/github/pr.ts:464-481` で、汎用の `fetchPrReviewComments()` が画像取得・本文置換を実行しています。`system-git-context.ts:77` 経由の system `pr_context`、enqueue、sync もこの関数を呼ぶため、task attachment を消費しない経路で `gh api` が実行されます。system 側は添付を返さず、本文には解決不能な `[Image #N]` だけが残り、取得した一時ファイルも cleanup されません。画像取得を add / interactive / pipeline の task 準備境界へ移し、metadata 取得は従来の生データを返すべきです。

- `F-PRIMG-06-001`（P1、family: `PRIMG-06`）  
  `src/infra/github/pr-images.ts:283-316` は画像ファイルだけを削除し、`mkdtempSync()` で作った親ディレクトリを残します。対象テスト実行後にも `takt-github-pr-*` の空ディレクトリが残りました。また `src/app/cli/routing.ts:319-321` の `process.exit(1)` は `finally` より前なので、PR添付がある状態ではファイル自体も残ります。添付所有者が一時ディレクトリ全体を削除し、明示終了前にも cleanup を実行する必要があります。

- `F-PRIMG-05-001`（P2、family: `PRIMG-05`）  
  `src/infra/github/pr-images.ts:201-203` は常に `references.length + 1` で番号を割り当て、本文中の既存 `[Image #N]` や `attachments/image-N.*` を考慮していません。実際に本文へ既存の `[Image #1]` と新規画像を置くと、置換結果が `existing [Image #1] [Image #1]` になります。既存番号を収集して空き番号を割り当てる必要があります。

- `F-PRIMG-01-001`（P2、family: `PRIMG-01`）  
  `src/infra/github/pr-images.ts:192-195` は Markdown画像を全て抽出してからHTML画像を抽出するため、本文中の出現順を保持しません。HTML画像を先、Markdown画像を後に置くと、先頭画像が `[Image #2]`、後続画像が `[Image #1]` になります。単一スキャナまたは source span の位置で並べ替えてから重複排除すべきです。

検証結果: 対象テスト170件、`npm run build`、`npm run lint` は成功しました。ただし、上記の system 経路、番号衝突、構文順序、親ディレクトリ cleanup は既存テストで検証されていません。

---

## security-review
セキュリティレビューとして、指定された変更対象15ファイル、主仕様、完全版のKnowledge/Policy、既存レビュー履歴を読み、入力から権限付き処理・出力までの実経路を確認します。編集・コミット・プッシュは行いません。
主仕様では、GitHub PR本文・通常コメント・review thread内の画像を取得し、形式・magic bytes・Content-Type・サイズ・取得元を制約しつつ、task attachmentsとpipeline経路へ接続する契約です。完全版Policy/Knowledgeの読了を完了したため、次に既存familyと累積変更の実経路を照合します。
既存履歴ではPR画像処理を1つのfamily（抽出・検証・取得・attachment配線・cleanup）として扱い、既存のレビュー解決台帳は現run配下には存在しませんでした。実装レポート上の契約IDは未確認扱いなので、現在コードを正本として再検証します。まず新規ダウンローダーと型・PR取得境界から読みます。
実経路の追跡で、`fetchPrReviewComments()` がPR task化入口だけでなく、workflowの `fetchPrContext()`（system sync、enqueue、`pr_context`解決）からも呼ばれることを確認しました。これらのconsumerは添付のcleanupを呼ばず、さらにURLのrepoスコープ検証も見当たりません。ここは、認証付き取得の実挙動と保護資産への到達を追加確認します。
確認結果は、セキュリティ上の指摘が2件です。認証付き `gh api` がPR本文で指定された任意のGitHub repo assetへ到達できることを実行確認し、system系の実consumerでは取得後のcleanupが存在しないことをコード上で確定しました。判定はREJECTです。
判定: **REJECT**

既存の `review-resolution.md` 等は確認できず、以下は新規findingです。

1. **SEC-PRIMG-001 / new — 認証付き取得のrepoスコープ欠落**

   PR本文の攻撃者が指定した `https://github.com/other-private/repo/assets/...` が、現在のPRリポジトリとの関連確認なしに許可されます。[pr-images.ts:138](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:138)

   そのURLは認証付き `gh api` に渡され、利用者のGitHub tokenで別private repositoryの画像を取得できます。[pr-images.ts:290](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:290) 取得画像はtask attachmentおよび後続AI実行へ渡ります。

   現在のPRのowner/repoは取得済みですが、画像URLの検証へ渡されていません。[pr.ts:436](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr.ts:436)

   修正案: 現在のPRに紐づくrepo assetだけを許可し、別repo URLを拒否する。`user-attachments` もPRとの関連を検証する。

2. **SEC-PRIMG-002 / new — system系consumerで一時画像が解放されない**

   `fetchPrReviewComments()` が常に画像をダウンロードします。[pr.ts:469](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr.ts:469)

   しかし `fetchPrContext()` はsystem sync、enqueue、`pr_context`解決から呼ばれ、画像cleanupを行いません。[system-git-context.ts:77](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/workflow/system/system-git-context.ts:77) 一時ディレクトリと画像はここで作成されます。[pr-images.ts:283](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:283)

   さらに通常consumerのcleanupも画像ファイルだけを削除し、親一時ディレクトリを残します。[pr-images.ts:316](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:316) 繰り返し実行でprivate画像の残留と一時領域の資源枯渇に至ります。

   修正案: metadata取得と画像付きtask準備を分離し、system経路では画像取得を起動しない。cleanup ownerが一時ディレクトリ全体を全終端で削除する。

確認済みの対象テストは56件成功しましたが、上記のtrust boundaryとcleanup欠陥は残っています。

---

## testing-review
テスト品質レビューとして、まず正本の要件・ポリシー・ナレッジと Report Directory の既存判定を全文確認し、その後に変更対象15ファイルのテスト計画・実装・実際のデータフローを突合します。編集・コミット・ステージングは行いません。
正本の要件と実装計画を確認しました。計画上は PR画像抽出、形式・サイズ検証、add／対話型／pipeline の終端配線、採番衝突、失敗・キャンセル時 cleanup を別契約としてテスト対象にしています。次に、レビュー権限を定めるポリシーとナレッジを全文確認します。
実装とテストの突合で、少なくとも次の未検証軸が見えています。PR画像の同一本文内での Markdown／HTML の出現順、pipeline の成功後 cleanup、PR添付を保持したままの失敗・`process.exit()` 終端です。まず対象テストを実行し、現行の通過状況と再現可能な根拠を確定します。
判定: REJECT

対象テスト170件は成功しましたが、以下の未検証・再現可能な問題があります。

- `TST-PRIMG-01`（PRIMG-01）
  [pr-images.ts:190](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:190) は Markdown を先に、HTML を後に収集するため、同一本文内の出現順を壊します。HTML→Markdown の入力で実際に `[md, html]` となりました。[github-pr-images.test.ts:28](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/github-pr-images.test.ts:28) に混在順序の検証がありません。

- `TST-PRIMG-02`（PRIMG-02/03）
  [github-pr.test.ts:772](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/github-pr.test.ts:772) は attachment のメタデータと呼び出しだけを検証し、実ファイルの内容を確認していません。Downloader が誤った内容・存在しないファイルを返しても検出できず、途中ダウンロード失敗時の一時ファイル削除も未検証です。

- `TST-PRIMG-03`（PRIMG-06）
  [cleanupGitHubPrAttachments](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:311) はファイルだけ削除し、`mkdtempSync` で作成した親ディレクトリを残します。実行結果も「ファイルなし・親ディレクトリあり」でした。さらに、pipeline のテストは最後にプロジェクト全体を削除しており、cleanup 漏れを隠しています。[routing.ts:147](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/app/cli/routing.ts:147) と [routing.ts:321](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/app/cli/routing.ts:321) の `process.exit()` 経路も、実際の強制終了時に cleanup される証拠がありません。

編集・コミットは行っていません。