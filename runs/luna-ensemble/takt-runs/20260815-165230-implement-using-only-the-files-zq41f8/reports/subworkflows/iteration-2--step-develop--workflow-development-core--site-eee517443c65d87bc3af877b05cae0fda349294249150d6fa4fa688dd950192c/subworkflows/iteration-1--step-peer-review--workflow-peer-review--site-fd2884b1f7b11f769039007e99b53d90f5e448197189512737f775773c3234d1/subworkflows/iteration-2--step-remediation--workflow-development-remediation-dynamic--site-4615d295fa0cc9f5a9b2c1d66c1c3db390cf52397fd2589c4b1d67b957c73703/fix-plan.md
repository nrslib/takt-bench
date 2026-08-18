# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|-------------------------------|------|----------------------|
| `PRIMG-09-FORMATTED-ORDER` / `reviewers/coding-review.md` | `accepted_family_unvisited_consumer` | `src/infra/github/pr-images.ts:49-54`、`src/infra/git/format.ts:197-254` | U2-画像参照出現順整合 | 本文と添付一覧の番号順が不一致 → 抽出はbody→comments→reviews、formatterはbody→分類済みreviews→comments → 表示順の定義が二重化している | 2つの走査順を実コードで確認。本文内のMarkdown/HTML順はmatch位置でソート済み、添付一覧はreference配列順を保持しており、これらは原因ではない | 構造 | placeholder・filename・最終本文・添付一覧を同じ表示順にする。formatterの既存review節順、別provider、非画像リンクは変更しない |
| `TEST-FOLLOWUP-PRIMG-01-order` / `reviewers/testing-review.md` | `direct_acceptance_criterion_violation` | `src/__tests__/github-pr-images.test.ts:70-86` | U2-画像参照出現順整合 | Markdown→HTMLの退行を検出できない → HTML→Markdownの一方向だけを検証 → 双方向が受入条件なのに反対方向の観測点がない | 現行テスト入力がHTML→Markdownのみであることを確認。実装は位置ソート済みであり、原因は現行実装の順序処理ではなく証拠不足 | 局所（U2へ合流） | Markdown→HTMLとHTML→Markdownの双方で抽出順・placeholder・置換後本文を確認する。parser全面刷新は行わない |
| `ARCH-PRIMG-004` / `architecture-review.md` | 裁定済み`duplicate`としてU2へ統合 | `review-resolution.md` | U2-画像参照出現順整合（既存条件保全） | 混在syntax順序の不一致 → syntax別抽出結果の連結 → 同じ参照順契約 | 現行はmatch位置統合済み。既存HTML→Markdownテストも存在するため、再実装せず双方向回帰として保全する | 構造 | 同一本文内の出現順ソートを維持する |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` / `backend-review.md` | 裁定済み`duplicate`としてU2へ統合 | `review-resolution.md` | U2-画像参照出現順整合（既存条件保全） | syntax別抽出順序 → 別々のmatch集合 → 同じ参照順契約 | 現行`pr-images.ts:273-282`でmatch位置による統合済み | 構造 | 位置順統合を維持し、別parserや非画像処理へ拡張しない |
| `TEST-NEW-PRIMG-01-order` / `testing-review.md` | 裁定済み`duplicate`としてU2へ統合 | `review-resolution.md` | U2-画像参照出現順整合（既存条件保全） | 混在記法順序の証拠不足 → 一方向のみ追加 → 同じ双方向順序契約 | 既存テストとfollow-up findingを照合。現在不足するMarkdown→HTMLだけを追加する | 局所（U2へ合流） | 既存HTML→Markdownケースを保持し、反対方向を追加する |
| `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` / `reviewers/testing-review.md` | `accepted_family_unvisited_consumer` | `src/features/pipeline/execute.ts:65-109`、`src/__tests__/pipelineExecution.test.ts:1325-1419` | U6-temp資源終端解放 | PR画像付きpipelineの失敗時cleanupを証明できない → 成功経路しかresourceとtask specを同時観測していない → false／例外terminalが未訪問 | `runPipeline()`の入れ子の`finally`がfalseと例外の双方を囲むことを確認。一般workflow falseテスト、PR画像成功テストはあるが両条件の共存テストがない。並行度、タイミング、timeoutは原因ではない | 局所 | falseと例外の双方で画像file・画像親directory・task spec・空のtasks親directoryが残らず、cleanupが1回であることを観測する |
| `ARCH-PRIMG-001` / `architecture-review.md` | 裁定済み`duplicate`としてU6へ統合 | `review-resolution.md` | U6-temp資源終端解放（既存条件保全） | 親directory残留 → file単位cleanup → resource所有境界の不足 | 現行resource cleanupは`rmSync(attachmentDirectory, recursive)`で親directoryを所有している | 構造 | 親directory所有を維持し、pipeline失敗テストでも消滅を確認する |
| `ARCH-PRIMG-003` / `architecture-review.md` | 裁定済み`duplicate`としてU6へ統合 | `review-resolution.md` | U6-temp資源終端解放（既存条件保全） | 明示終了時残留 → `finally`依存のみ → process終了境界不足 | 現行はprocess `exit` listenerとheavy ITで確認済み | 構造 | exit cleanupを変更せず保持する。SIGKILLは対象外 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` / `backend-review.md` | 裁定済み`duplicate`としてU6へ統合 | `review-resolution.md` | U6-temp資源終端解放（既存条件保全） | file／directory cleanup不足 → cleanup所有者不足 → 同一resource lifecycle契約 | `createGitHubPrImageResource()`とdownload失敗時cleanupを確認 | 構造 | downloader、resource handle、pipeline所有権を維持する |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` / `coding-review.md` | 裁定済み`duplicate`としてU6へ統合 | `review-resolution.md` | U6-temp資源終端解放（既存条件保全） | process終了時残留 → `finally`迂回 → exit時強制点不足 | `github-pr-image-lifecycle.integration.test.ts`がprocess exit後のfile・directory消滅を確認済み | 構造 | exit listenerを変更せず、pipeline terminal追加だけを行う |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` / `coding-review.md` | 裁定済み`duplicate`としてU6へ統合 | `review-resolution.md` | U6-temp資源終端解放（既存条件保全） | temp親directory残留 → fileだけの削除 → resource所有範囲不足 | 現行cleanupがresource root全体を再帰削除することを確認 | 構造 | 親directory消滅をfalse／例外テストの観測点に含める |
| `SEC-PRIMG-002` / `security-review.md` | 裁定済み`duplicate`としてU6へ統合 | `review-resolution.md` | U6-temp資源終端解放（既存条件保全） | system経路のtemp残留 → terminal cleanup未接続 → 同じresource lifecycle契約 | add、routing、pipelineの所有権経路と既存cleanupを確認 | 構造 | 一般temp janitorや認証・取得scopeの変更は加えない |
| `TEST-NEW-PRIMG-06-cleanup` / `testing-review.md` | 裁定済み`duplicate`としてU6へ統合 | `review-resolution.md` | U6-temp資源終端解放（既存条件保全） | cleanup証拠不足 → 成功・routing失敗・exitのみ → pipeline失敗terminal未訪問 | 既存テストが成功、routing初期化失敗、process exitを覆う一方、PR画像付きworkflow false／例外を覆わないことを確認 | 局所（U6へ合流） | 既存テストを重複追加せず、未訪問の2 terminalだけを追加する |

## 不変条件台帳

引き継ぎ元: `../../review-resolution.md`。同一remediation内に先行する公開済み`fix-verification.md`はなく、同ファイルに記録された引き継ぎ元は`subworkflows/iteration-1--step-remediation--workflow-development-remediation-dynamic--site-d9addbd19e4443d2c14133ce9f102ca3b49843833a159a516825cd1ee29a7a86/fix-verification.md`。

### 引き継ぎ元からの行

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| U1-PR metadata副作用分離 | `F-PRIMG-FETCH-BOUNDARY` | PR metadata副作用分離 | `fetchPrReviewComments()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | task専用PR準備境界 | 完全 |
| U2-画像参照出現順整合 | `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | parser内のmatch位置統合 | 完全 |
| U3-画像参照名前空間一意性 | `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照名前空間一意性 | `extractGitHubPrImageReferences()`の採番責務 | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | 使用済み番号集合による単一採番 | 完全 |
| U4-認証取得repository scope | `F-PRIMG-FETCH-SCOPE` | 認証取得repository scope | `isAllowedGitHubAttachmentUrl()`とPR repository context | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | credential付与直前の単一分類境界 | 完全 |
| U5-実在画像取得 | `F-PRIMG-DOWNLOAD-API` | 許可画像の実在取得 | `downloadGitHubPrImages()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | HTTP取得と既存payload validator | 完全 |
| U6-temp資源終端解放 | `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | `downloadGitHubPrImages()` / resource cleanup | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | 親directoryを所有するresource handleと同期exit cleanup | 完全 |
| U7-実境界テスト分類 | `F-PRIMG-TEST-WIRING` | 実境界テスト分類 | test classifier | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | filesystem分類のsingle source of truth | 完全 |

### 新規・現在の計画行

| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|----------|-----------|------------------|----------------------|----------|------|------------------------------|--------|
| U2-画像参照出現順整合 | `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | placeholder、filename、本文参照、添付一覧、最終task本文の表示順が一致する | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | 構造 | 未確認 | formatterと画像抽出が直接利用する、分類済みreview節順の単一定義 |
| U6-temp資源終端解放 | `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | 成功・失敗・cancel・明示終了でtemp fileと親directoryが解放される | `downloadGitHubPrImages()` / resource cleanup | 局所 | 未確認 | 不要: 既存のresource handleと`runPipeline()`の入れ子の`finally`を単一検証点として直接確認する |

## 欠陥 family の最終状態

| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| U2-画像参照出現順整合 | `order.md`の本文参照と既存attachment形式が同じ画像順を表すこと | PR body、review summary、各thread state、legacy review、conversation commentのformatter表示順と採番順が一致する。同一本文ではMarkdown／HTMLのmatch位置順を使う。既存placeholderと衝突しない。添付配列・filename・一覧は同じreference順を保持する | `src/infra/git/format.ts`が分類済みreview節順の内部的な単一参照元を所有し、formatterと`src/infra/github/pr-images.ts`が直接利用する。公開indexへは追加しない | `PrReviewData`生成 → 共通節順によるbody走査 → URL分類・抽出・採番 → 本文置換 → `formatPrReviewAsTask()` → `buildTaskOrderContent()` → add／interactive routing／pipeline → `order.md`・添付manifest・run context。`participates`: GitHub PR画像経路。`preserved`: コードブロック、HTMLコメント、外部URL、既存placeholder。`outside`: 別providerと非画像リンク | SCN-U2-P1、SCN-U2-N1、SCN-U2-P2、SCN-U2-N2 | `reviewBodies()`のcomments先行走査を削除する。formatter内の独立したreview分類・節順構築を共通定義へ移行する。互換alias、fallback、別の旧順序は残さない |
| U6-temp資源終端解放 | PR画像を用いるpipelineがどのterminalへ到達しても一時画像とtask specを残さないこと | workflow成功、false、例外でtask specと画像resourceを1回解放する。addのcancel、routing失敗、process exitの既存契約を保持する | 本番責務は変更しない。`createGitHubPrImageResource()`が画像親directoryを所有し、`runPipeline()`の入れ子の`finally`がtask spec cleanup後にresource cleanupを実行する | PR画像準備 → `TaskContent.imageResource`とattachments → task spec生成・画像copy → workflow実行 → false／例外terminal → task spec削除 → image resource削除。成功、add cancel、routing cleanup、process exitは`preserved` | false時は終了コード3で、例外時は元例外が伝播し、双方で画像file・画像親directory・task spec・空の`.takt/tasks`が存在しない。cleanupは1回。SIGKILLは境界外 | 本番コードの移行・削除なし。`pipelineExecution.test.ts`に不足するfalse／例外ケースだけを追加する |

## 要求シナリオ（条件付き）

```gherkin
Scenario: [SCN-U2-P1] Markdown画像の後にHTML画像がある本文を出現順で採番する
  Given PR本文が "![first](https://github.com/user-attachments/assets/first) then <img src=\"https://github.com/user-attachments/assets/second\">" である
  When 画像参照を抽出して本文を置換する
  Then 本文は "[Image #1] then [Image #2]" となり、reference配列もfirst、secondの順になる

Scenario: [SCN-U2-N1] コード文脈内の同じ画像記法を抽出対象にしない
  Given PR本文が "`![sample](https://github.com/user-attachments/assets/sample)`" と "```markdown\n<img src=\"https://github.com/user-attachments/assets/fenced\">\n```" を含む
  When 画像参照を抽出して本文を置換する
  Then コード文脈の2件はreferenceへ追加されず、本文も変更されない

Scenario: [SCN-U2-P2] formatter表示順と添付識別子順を一致させる
  Given review summaryに "![review](https://github.com/user-attachments/assets/review)"、conversation commentに "<img src=\"https://github.com/user-attachments/assets/comment\">" がある
  When 抽出、置換、formatter、添付一覧生成を順に実行する
  Then 最終本文はreviewの[Image #1]がcommentの[Image #2]より先に現れ、一覧もimage-1、image-2の順になる

Scenario: [SCN-U2-N2] 既存placeholderと新規画像番号を衝突させない
  Given 表示対象本文に既存の "[Image #1]" と新規画像 "![new](https://github.com/user-attachments/assets/new)" がある
  When 画像参照を抽出して添付名を生成する
  Then 新規画像は[Image #2]およびimage-2として扱われ、既存の[Image #1]を上書きしない
```

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | U2-画像参照出現順整合 | 境界変更 | なし | `src/infra/git/format.ts:177-254` | review分類と節順が内部の単一定義になり、formatterの既存出力節順が維持される |
| 2 | U2-画像参照出現順整合 | 利用側移行・旧経路削除 | 工程1 | `src/infra/github/pr-images.ts:49-54,263-300` | 画像抽出が共通節順を利用し、comments先行の重複走査が残らない |
| 3 | U2-画像参照出現順整合 | 局所テスト追加 | 工程2 | `src/__tests__/github-pr-images.test.ts:26-162` | Markdown→HTML、HTML→Markdown、review／comment最終表示、添付一覧、既存番号衝突を対象テストで反証できる |
| 4 | U6-temp資源終端解放 | 局所テスト追加 | なし | `src/__tests__/pipelineExecution.test.ts:1325-1419` | PR画像付きworkflowのfalseと例外で、terminal結果、cleanup 1回、画像file・両親directory・task specの消滅を実filesystemで観測できる |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|----------|--------------|--------------------------|-----------------------------|----------|
| U2-画像参照出現順整合 | `order.md`の本文参照・attachment要件、契約置換ポリシー、コーディングポリシーのDRY・公開API境界、テストポリシーのparser変更 | formatterの現行review節順を内部の単一参照元へ抽出し、画像抽出を移行する。commentsをformatter前方へ移す案は既存表示契約を変更し、review配列内の分類順不一致も残すため不採用。Markdown parser刷新も修正境界外 | `github-pr-images.test.ts`で構文双方向と最終task本文・添付一覧を直接観測し、既存`git-format.test.ts`でreview節順を保全する | 同じ意味・変更理由を持つ2つの順序実装だけを集約し、公開index、別provider、非画像契約を変更しない |
| U6-temp資源終端解放 | `order.md`のpipeline同等利用要件、Knowledgeの終了経路完全性、テストポリシーの副作用・状態遷移、TAKT実境界分類 | 本番cleanup再設計は不採用。現行の入れ子の`finally`がfalseと例外を包含しているため、未訪問terminalのテストだけを追加する。timeout、再試行、並行度、一般janitorは原因との関係も修正権限もないため不採用 | `pipelineExecution.test.ts`の実filesystem境界で、workflow実行中のtask spec存在とterminal後の消滅を確認する。同ファイルは既存の軽いIT分類を維持し、分類契約の完了結果はfix工程の品質証拠として記録する | 実装済みの単一cleanup強制点を直接検証し、成功・routing・exitテストを重複させず、false／例外だけを補う |

## 再計画事項

- なし。原因、修正境界、受入条件、現在の環境で取得可能な決定的証拠を確定済み。