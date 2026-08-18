# コーディングレビュー

## 結果: REJECT

## サマリー

PR画像の取得・検証・一時ファイル管理・各入口への配線は、既存の指摘を含めて確認した範囲で解消されています。ただし、画像参照の採番順と最終タスク本文の表示順が一致せず、添付画像番号と本文上の出現順が崩れる新しい問題があります。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR本文・コメント・レビューの画像を取得し、タスクへ保存する | `src/features/tasks/add/index.ts`、`src/infra/github/pr-images.ts` | `src/__tests__/addTask.test.ts`、`src/__tests__/github-pr-images.test.ts` | ✅ | なし |
| パイプライン `--pr` | PR画像を後続のタスク実行まで渡す | `src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` | `src/__tests__/pipelineExecution.test.ts` | ✅ | なし |
| 対話型PR解決 | 画像添付と一時リソースを対話処理後まで保持し、終了時に解放する | `src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts` | `src/__tests__/cli-routing-pr-resolve.test.ts`、`src/__tests__/github-pr-image-lifecycle.integration.test.ts` | ✅ | なし |
| GitHub URL・認証・画像形式検証 | 対象リポジトリのURLだけを取得し、Content-Type・マジックバイト・サイズを検証する | `src/infra/github/repository.ts`、`src/infra/github/pr-images.ts` | `src/__tests__/github-pr-images.test.ts` | ✅ | なし |
| 本文参照・添付一覧の順序 | 本文中の画像参照と添付ファイル番号を表示順に対応させる | `src/infra/github/pr-images.ts:49`、`src/features/tasks/add/format.ts:242`、`:248` | 単一本文内の混在記法は確認済み。複数コメント種別の最終出力順は未確認 | ❌ | 新規 finding `PRIMG-09-FORMATTED-ORDER` |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 既存のGitHub API経路が画像取得まで担う懸念 | `src/infra/github/pr.ts`、`src/infra/github/pr-images.ts` | no_issue_after_verification | `review-resolution.md`および`fix-verification.md`で、メタデータ取得とタスク専用画像準備が分離されていることを確認済み |
| 一時ディレクトリがプロセス終了時に残る懸念 | `src/infra/github/pr-images.ts` | no_issue_after_verification | 終了フックを含む子プロセスのライフサイクルテストが成功している |
| テスト分類変更を実装契約の欠陥とする懸念 | `scripts/test-classification.mjs` | overreach | 分類変更は変更された実ファイルシステム・子プロセス経路を実行するためのテスト配線であり、単独では実装不備を示さない |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| `F-PRIMG-DOWNLOAD-API` | `src/infra/github/pr-images.ts` | 対象URLを認証付きHTTP取得し、検証済み画像だけ保存する | 画像取得APIの境界変更 | add・interactive・pipelineの共通取得経路 | Content-Type、サイズ、マジックバイト、拡張子を検証 | task attachmentsへ保存し、各入口へ渡す | 取得失敗時にリソースを解放 | `github-pr-images.test.ts` | なし | 問題なし |
| `F-PRIMG-REFERENCE-ORDER` | 画像参照抽出とタスク整形 | 採番、本文参照、添付一覧が同じ表示順に対応する | コメント・レビュー画像対応の追加 | `body → comments → reviews` の抽出から、最終formatterまでを確認 | `pr-images.ts:49`でコメント順に採番 | `format.ts:242,248`でレビューをコメントより先に表示 | 混在本文は検証済み。複数要素の最終順序で不一致 | `github-pr-images.test.ts` | formatterの複数コメント種別順 | `PRIMG-09-FORMATTED-ORDER` |
| `F-PRIMG-REFERENCE-ALLOCATION` | 画像番号割当 | 既存プレースホルダーと衝突しない | 既存本文との参照番号共存 | 抽出から対話添付allocatorまで | `pr-images.ts`、`imageAttachments.ts` | 添付ファイル名と参照番号へ伝播 | 既存番号を走査して割当 | `imageAttachments.test.ts` | なし | 問題なし |
| `F-PRIMG-FETCH-BOUNDARY` | PR取得とタスク準備の分離 | 汎用PR取得が不要な副作用を起こさない | 画像処理をタスク用途へ限定 | `pr.ts → prepareGitHubPrTask → add/routing/pipeline` | `fetchPrReviewComments`は生データのみ取得 | task生成時だけ置換・添付化 | エラー時に準備リソースを解放 | `github-pr.test.ts`、`addTask.test.ts` | なし | 問題なし |
| `F-PRIMG-TEMP-LIFECYCLE` | `createGitHubPrImageResource` | 成功・失敗・通常終了・`process.exit`で一時物が残らない | 画像取得導入による一時状態の追加 | add・interactive・pipelineの所有権経路 | 一時ディレクトリをresourceが所有 | `finally`と終了フックで削除 | 例外・プロセス終了を確認 | `github-pr-image-lifecycle.integration.test.ts` | なし | 問題なし |
| `F-PRIMG-FETCH-SCOPE` | GitHub URL解析・画像URL分類 | 対象PRリポジトリ以外の画像を取得しない | private repo画像対応による信頼境界変更 | URL解析から認証選択・取得まで | `repository.ts`、`pr-images.ts` | 対象repo assetのみ認証取得 | 不正ホスト・repo不一致を拒否 | `github-pr-images.test.ts` | なし | 問題なし |
| `F-PRIMG-TEST-WIRING` | テスト分類設定 | 変更された実行経路が適切なテスト分類で実行される | 新規画像・filesystem・child-process経路の追加 | 既存テストとライフサイクルIT | `scripts/test-classification.mjs` | 対象テストをlight/heavy ITへ配線 | 子プロセス・実FS経路を実行 | `releaseVerificationWiring.test.ts` | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | `PRIMG-09-FORMATTED-ORDER` | `F-PRIMG-REFERENCE-ORDER` | Medium | `src/infra/github/pr-images.ts:49`、`src/features/tasks/add/format.ts:242,248` | 抽出・採番は `body → comments → reviews` 順だが、最終本文は `body → reviews → comments` 順に出力される | 通常コメントの画像が `[Image #1]`、レビュー画像が `[Image #2]`でも、本文では`#2`が`#1`より先に表示され、本文・添付一覧の出現順が一致しない | `accepted_family_unvisited_consumer` | 初回・修正確認では単一本文内のMarkdown/HTML混在順のみ検証され、複数コメント種別を最終formatterへ通した順序が未確認だった | 抽出側と`formatPrReviewAsTask()`が同じ表示順定義を共有し、採番・本文置換・添付一覧をその順序から生成する |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| `F-PRIMG-DOWNLOAD-API`に紐づく既存finding群 | GitHub画像を適切なHTTP・認証境界で取得する | `src/infra/github/pr-images.ts`、`github-pr-images.test.ts`、`fix-verification.md` |
| `F-PRIMG-REFERENCE-ALLOCATION`に紐づく既存finding | 既存参照番号と衝突しない番号を割り当てる | `src/infra/github/pr-images.ts`、`src/features/interactive/imageAttachments.ts` |
| `F-PRIMG-FETCH-BOUNDARY`に紐づく既存finding | 汎用PR取得とタスク専用画像処理を分離する | `src/infra/github/pr.ts`、`src/features/tasks/add/index.ts` |
| `F-PRIMG-TEMP-LIFECYCLE`に紐づく既存finding | 通常終了・例外・プロセス終了時に一時リソースを解放する | `src/infra/github/pr-images.ts`、`github-pr-image-lifecycle.integration.test.ts` |
| `F-PRIMG-FETCH-SCOPE`に紐づく既存finding | 対象PR以外のGitHub画像を取得しない | `src/infra/github/repository.ts`、`src/infra/github/pr-images.ts` |
| `F-PRIMG-TEST-WIRING`に紐づく既存finding | 変更経路を適切なテスト分類へ配線する | `scripts/test-classification.mjs`、`releaseVerificationWiring.test.ts` |

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|------------|------------|---------------|----------|
| `review-resolution.md`記載のテスト配線に関する対象外finding | overreach | — | テスト分類の変更は実FS・子プロセスを必要とする変更経路への配線であり、実装契約の欠陥ではないと裁定されている |

## 再開指摘（reopened）

なし。

## 検証証跡

- 差分確認: 指定された17ファイルを確認し、PR取得、画像抽出・検証・保存、add・interactive・pipelineへの伝播、cleanup、テスト分類を追跡した。
- ビルド: `fix-verification.md`で成功を確認。今回のレビューでは再実行していない。
- テスト:
  - `github-pr-images.test.ts`: 16 passed
  - `github-pr.test.ts`: 44 passed
  - `github-pr-image-lifecycle.integration.test.ts`: 1 passed
  - `pipelineExecution.test.ts`: 53 passed
  - `addTask.test.ts`: 19 passed
  - `cli-routing-pr-resolve.test.ts`: 27 passed
  - `imageAttachments.test.ts`: 16 passed
  - `releaseVerificationWiring.test.ts`: 17 passed
  - `git diff --check`: 成功
- 追加確認: 通常コメントとレビューに各1枚を含む入力で、採番はコメントが`#1`、レビューが`#2`となる一方、最終本文はレビューを先に出力することを確認した。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 複数失敗を集約する境界 | 該当なし。今回の変更は複数失敗結果の集約ではない |
| 契約置換ポリシー | `src/infra/github/pr.ts`、`src/infra/github/pr-images.ts`。汎用取得とタスク専用変換を分離 |
| 主操作と終端consumer | `src/infra/github/pr-images.ts:49` → `src/features/tasks/add/format.ts:242,248`。最終本文で順序不一致を確認 |
| Follow-up findingの認可 | `PRIMG-09-FORMATTED-ORDER`: accepted familyの未走査consumerに対する `accepted_family_unvisited_consumer` |
| 既出familyの照合 | `review-resolution.md`、`fix-verification.md`。新規findingは`F-PRIMG-REFERENCE-ORDER`へ統合 |
| 失敗・中断・後片付け | `src/infra/github/pr-images.ts`、`src/app/cli/routing.ts`、`github-pr-image-lifecycle.integration.test.ts` |
| テスト十分性 | `src/__tests__/github-pr-images.test.ts`は単一本文内の順序を確認。formatterの複数コメント種別順は未確認 |