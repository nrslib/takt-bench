問題は、タスク正本・現在コード・最新のレビュー裁定を照合し、要求シナリオごとの充足状況、前段 finding の解消、再発台帳の無変更継承を最終判定することです。まず指定された Knowledge／Policy を全文確認し、task 配下と Report Directory の成果物を特定したうえで、機械ゲートには立ち入らず実コードだけを対応付けます。
指定された Knowledge／Policy は EOF まで確認しました。今回の変更は PR コメント内画像の取得・参照置換・一時資源管理に関する契約で、一般的な TAKT のモデル解決やルール評価などは非適用、終了経路・実行資産・テスト分類の知識は要件経路の判定材料として適用します。次に一次仕様と公開済みの最新裁定・修正履歴を全文で照合します。
一次仕様と2回の remediation 計画から、要求シナリオは計12件（初回8件、後続4件）と特定しました。現在コードでは、PR metadata 取得と task 専用画像準備が分離され、共通のレビュー表示順が抽出・置換・formatter に接続されています。引き続き、add／interactive／pipeline の保存・run-context 終端と、旧経路が残っていないことを確認します。
保存・終端経路も確認できました。`add --pr` は添付を `.takt/tasks/<slug>/attachments/` へコピーして `order.md` に既存形式で列挙し、pipeline／interactive は同じ task spec を run context へ再配置して参照パスを書き換えます。旧 `PrReviewData.attachments`、旧 comments 先行走査、完全 URL を `gh api` に渡す経路、旧 file-only cleanup は現行経路に残っていません。最終判定前に、正本要件・主要強制点・台帳7行を再読して確定します。
# 最終判定

## 結果: APPROVE

元要件は現在コードで充足されています。前段24 finding に未解消・再開はなく、修正対象 family はありません。機械ゲートの実行結果は判定対象としていません。

## 要件と現在コードの対応

| 要件 | 現在コードの対応 | 判定 |
|---|---|---|
| PR本文・通常コメント・review summary・review threadから画像を抽出 | `fetchPrReviewComments()` が各本文を `PrReviewData` に集約し、`getPrReviewBodiesInTaskOrder()` が全本文を表示順で列挙 | 充足 |
| Markdown画像・HTML `<img>`対応 | [pr-images.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:256) で両記法を抽出し、本文位置順に統合 | 充足 |
| GitHub画像に取得先を制限 | HTTPS、GitHub host、userinfo・port、repository scopeを取得前に検証 | 充足 |
| private repository対応 | 同一repositoryのassetだけ `gh auth token` を取得し、Bearer認証付きHTTP取得 | 充足 |
| PNG/JPEG/GIF/WebP、Content-Type・magic bytes検証 | 対応4形式をContent-Typeとバイトシグネチャの双方で検証 | 充足 |
| サイズ上限 | Content-Lengthとストリーム実読込の双方で10 MiBを強制 | 充足 |
| `[Image #N]`への置換・一意な採番 | 既存番号を予約し、未使用番号を割当。同一URLは同じplaceholderへ集約 | 充足 |
| `add --pr`で添付を保存し`order.md`へ追記 | [add/index.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/features/tasks/add/index.ts:176) から添付を渡し、[attachments.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/features/tasks/attachments.ts:35) が `attachments/image-N.ext` と添付一覧を生成 | 充足 |
| `takt --pr`・pipelineでも同等に利用 | interactive seedとpipeline task specへ添付を伝播し、run contextへ画像と書換済み`order.md`を配置 | 充足 |
| 一時資源の解放 | resource handle、process exit hook、add/routing/pipelineの`finally`で親directory単位に解放 | 充足 |

## 要求シナリオ

2回の remediation 計画にある全12シナリオを確認しました。

| 計画 | シナリオ | Given / When / Then のコード対応 | 判定 |
|---|---|---|---|
| iteration-1 | `SCN-U1-P1` | 同一repository画像を含むPR → `prepareGitHubPrTask()` → `[Image #1]`と`image-1.ext`を返す | 充足 |
| iteration-1 | `SCN-U1-N1` | system metadata入口 → `fetchPrReviewComments()`のみ実行 → 本文非置換・画像取得なし | 充足 |
| iteration-1 | `SCN-U2-P1` | HTML→Markdown混在 → match位置でソート → #1、#2の順 | 充足 |
| iteration-1 | `SCN-U2-N1` | fenced code内の画像記法 → 非render領域を除外 → 抽出・置換なし | 充足 |
| iteration-1 | `SCN-U3-P1` | 既存`[Image #1]`あり → 使用済み番号を走査 → 新規画像は#2 | 充足 |
| iteration-1 | `SCN-U3-N1` | 同一URLが両記法で出現 → URL dedupe → 同じ#2を参照 | 充足 |
| iteration-1 | `SCN-U4-P1` | 現PRと同一repository asset → scope分類 → 認証取得を許可 | 充足 |
| iteration-1 | `SCN-U4-N1` | 別repository asset → scope分類 → token取得・HTTP request前に拒否 | 充足 |
| iteration-2 | `SCN-U2-P1` | Markdown→HTML混在 → match位置でソート → #1、#2の順 | 充足 |
| iteration-2 | `SCN-U2-N1` | inline codeとfenced code → 非render領域を除外 → 本文維持 | 充足 |
| iteration-2 | `SCN-U2-P2` | review summaryとconversation comment → formatter共通順で抽出・表示・添付一覧を生成 | 充足 |
| iteration-2 | `SCN-U2-N2` | 既存placeholderと新規画像 → 使用済み番号を避けて#2／`image-2`を生成 | 充足 |

## 前段 finding の状態

- `F-PRIMG-FETCH-BOUNDARY`：`ARCH-PRIMG-002`、`CODE-NEW-src-infra-github-pr.ts-L464`、`PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT`は、metadata取得とtask専用準備の分離により解消済み。
- `F-PRIMG-REFERENCE-ORDER`：`AI-PRIMG-003`、`ARCH-PRIMG-004`、`CODE-NEW-src-infra-github-pr-images.ts-L184`、`TEST-NEW-PRIMG-01-order`、`PRIMG-09-FORMATTED-ORDER`、`TEST-FOLLOWUP-PRIMG-01-order`は、共通表示順とmatch位置統合により解消済み。
- `F-PRIMG-REFERENCE-ALLOCATION`：`CODE-NEW-src-infra-github-pr-images.ts-L198`、`PRIMG-05-IMAGE-NUMBER-COLLISION`は、使用済み番号集合による採番で解消済み。
- `F-PRIMG-FETCH-SCOPE`：`SEC-PRIMG-001`は、credential付与前のrepository scope検証で解消済み。
- `F-PRIMG-DOWNLOAD-API`：`AI-PRIMG-001`は、実HTTP取得とpayload validatorへの接続で解消済み。
- `F-PRIMG-TEMP-LIFECYCLE`：関連9 findingは、親directoryを所有するresource handleと各終端のcleanup接続で解消済み。
- `PRIMG-08-TEST-CLASSIFICATION`は現在裁定で非修正対象。機械ゲートは本ステップの審査対象外。
- `TEST-NEW-PRIMG-02-download-content`は、元要件違反の証拠がない追加要求として`overreach`裁定を維持。

## 再発台帳の引き継ぎ

引き継ぎ元: `subworkflows/iteration-2--step-remediation--workflow-development-remediation-dynamic--site-4615d295fa0cc9f5a9b2c1d66c1c3db390cf52397fd2589c4b1d67b957c73703/fix-verification.md`

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|----------|------------------|------------------|----------|----------|------------------------|-------------------------|--------------------|------------|--------------|
| U1-PR metadata副作用分離 | `F-PRIMG-FETCH-BOUNDARY` | PR metadata副作用分離 | `fetchPrReviewComments()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | task専用PR準備境界 | 完全 |
| U2-画像参照出現順整合 | `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | parser内のmatch位置統合 | 完全 |
| U3-画像参照名前空間一意性 | `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照名前空間一意性 | `extractGitHubPrImageReferences()`の採番責務 | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | 使用済み番号集合による単一採番 | 完全 |
| U4-認証取得repository scope | `F-PRIMG-FETCH-SCOPE` | 認証取得repository scope | `isAllowedGitHubAttachmentUrl()`とPR repository context | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | credential付与直前の単一分類境界 | 完全 |
| U5-実在画像取得 | `F-PRIMG-DOWNLOAD-API` | 許可画像の実在取得 | `downloadGitHubPrImages()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | HTTP取得と既存payload validator | 完全 |
| U6-temp資源終端解放 | `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | `downloadGitHubPrImages()` / resource cleanup | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | 既存resource handleと`runPipeline()`の入れ子の`finally` | 完全 |
| U7-実境界テスト分類 | `F-PRIMG-TEST-WIRING` | 実境界テスト分類 | test classifier | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | filesystem分類のsingle source of truth | 完全 |

修正対象 family、未充足要件、未解決の前提はいずれもありません。