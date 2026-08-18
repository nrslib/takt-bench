# コーディングレビュー

## 結果: REJECT

## サマリー

GitHub PR画像の取得・保存経路は追加されていますが、既存の汎用PRメタデータ取得経路にダウンロード副作用を混入させています。また、画像番号の衝突、出現順序の破綻、一時ディレクトリおよび`process.exit()`時の後片付け漏れを確認しました。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR画像を取得し、タスク添付として保存する | `src/infra/github/pr.ts:464-481`、`src/features/tasks/add/index.ts` | `src/__tests__/addTask.test.ts` | ⚠️ | 保存経路はあるが、画像番号衝突と一時領域の後片付けに問題 |
| interactive / pipeline の`--pr` | 取得画像を後続実行へ渡し、終了時に削除する | `src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts`、`src/app/cli/routing.ts:342-347` | `src/__tests__/cli-routing-pr-resolve.test.ts`、`src/__tests__/pipelineExecution.test.ts` | ⚠️ | 正常経路は確認済み。`process.exit()`経路と親ディレクトリ削除は未充足 |
| 汎用`fetchPrReviewComments` | 既存のPRメタデータ取得契約を維持する | `src/infra/github/pr.ts:426-481`、`src/infra/workflow/system/system-git-context.ts:72-77` | 直接的なsystem consumerテストなし | ❌ | メタデータ取得時に画像ダウンロードと本文置換が発生し、添付情報はsystem側へ伝播しない |
| GitHub画像の検証 | HTTPS、GitHubホスト、Content-Type、magic、サイズを検証する | `src/infra/github/pr-images.ts` | `src/__tests__/github-pr-images.test.ts` | ✅ | 確認範囲では問題なし |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| GitHub画像URLのホスト・形式検証 | `src/infra/github/pr-images.ts` | no_issue_after_verification | ホスト、許可パス、Content-Type、magic、10MiB制限の実装とテストを確認済み |
| GitLab、issue、直接タスク入力の既存経路 | `src/features/pipeline/steps.ts`、`src/app/cli/routing.ts` | outside_contract_jurisdiction | 今回のGitHub PR画像契約とは異なる経路で、確認範囲では変更による破壊を確認していない |
| 既存の添付保存・一意名付けの一般処理 | `src/features/interactive/imageAttachments.ts` | no_issue_after_verification | 既存添付を考慮する処理自体はある。ただしPR本文の番号割当は別findingとした |

## 問題系列の完了走査

Report Directory内に`review-resolution.md`および既存レビュー報告はなく、既存familyの裁定・引き継ぎは確認できませんでした。

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| PRIMG-01 抽出・置換 | `extractGitHubPrImageReferences` / `replaceGitHubPrImageReferences` | 画像参照を本文上の出現順で一意に置換する | PR本文・コメント・レビューを画像対応へ変更 | PR本文、コメント、レビュー本文からtask/pipelineへ接続 | `src/infra/github/pr-images.ts:184-208` | `src/infra/github/pr.ts:470-481`、add/pipeline consumer | 混在タグの順序と既存placeholder衝突を確認 | `github-pr-images.test.ts` | system表示経路の添付伝播 | `CODE-NEW-src-infra-github-pr-images.ts-L184`、`CODE-NEW-src-infra-github-pr-images.ts-L198` |
| PRIMG-02 取得・検証 | `downloadGitHubPrImages` | 許可された画像だけを取得し、サイズ・形式を制限する | GitHub外部境界を追加 | `gh api`から一時ファイルへ | `src/infra/github/pr-images.ts:275-309` | 添付保存処理へ渡る | 取得失敗時のcleanupはPRIMG-06で指摘 | `github-pr-images.test.ts`、`github-pr.test.ts` | 実GitHub応答での全形式 | 問題なし |
| PRIMG-03 add保存 | `addTask` | PR画像をタスク添付として保存し本文参照を保持する | add経路へ添付を追加 | `src/features/tasks/add/index.ts` | `src/features/tasks/add/index.ts` | タスク保存・添付保存 | 失敗時cleanupはPRIMG-06で確認 | `addTask.test.ts` | 実CLIでの全失敗分岐 | 問題なし |
| PRIMG-04 interactive/pipeline伝播 | routing / pipeline executor | 添付が実行終端まで届き、終了時に破棄される | PR画像を実行入力へ追加 | `src/app/cli/routing.ts`、`src/features/pipeline/*` | `src/features/pipeline/steps.ts` | `execute.ts`でtask specへ伝播 | `process.exit()`経路はcleanupをスキップ | routing/pipeline tests | 実CLIの終了コード分岐 | `CODE-NEW-src-app-cli-routing.ts-L317` |
| PRIMG-05 placeholder/file番号一意性 | image reference allocator | 既存本文・既存添付・同一batch間で番号が衝突しない | PR画像を既存本文へ挿入するため | `src/infra/github/pr-images.ts:184-208` | `references.length + 1`のみで割当 | 置換後本文と添付名が衝突 | 既存`[Image #1]`との再現テストで確認 | 既存placeholder衝突テストなし | 既存添付を含む実task | `CODE-NEW-src-infra-github-pr-images.ts-L198` |
| PRIMG-06 一時領域cleanup | `cleanupGitHubPrAttachments` | 正常・失敗・中断時に画像と一時ディレクトリを削除する | 外部取得に一時ファイルを追加 | `src/infra/github/pr-images.ts:311-324` | ファイルのみ`rmSync` | 親ディレクトリが残り、`process.exit()`時はファイルも残る | routingの早期終了経路でfinallyを通らない | cleanup testsはファイルのみ確認 | キャンセル・強制終了の全経路 | `CODE-NEW-src-infra-github-pr-images.ts-L311` |
| PRIMG-07 既存PRメタデータconsumer保持 | `fetchPrReviewComments` | 汎用PR取得はメタデータ取得に留まり、既存consumerを壊さない | 画像取得を既存providerメソッドへ追加 | system context、sync、enqueueへ接続 | `src/infra/github/pr.ts:464-481` | system側はbody等のみ利用しattachmentsを伝播しない | 画像取得失敗がメタデータ取得失敗になる | system consumerの直接テストなし | 全system入口 | `CODE-NEW-src-infra-github-pr.ts-L464` |
| PRIMG-08 テスト・品質ゲート | 受入条件の検証 | 追加契約の境界ケースを検証する | 画像機能追加 | 対象テスト、build、lint | targeted test 170件、build/lint成功 | 混在順序、番号衝突、system副作用、親ディレクトリcleanupは未検証 | — | 上記テスト | 全体integration/e2e | 問題なし（不足ケースは各findingに含めた） |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | CODE-NEW-src-infra-github-pr.ts-L464 | PRIMG-07 | High | `src/infra/github/pr.ts:464-481` | 汎用`fetchPrReviewComments`内で画像取得と本文置換を実行している | `system-git-context`、system sync、enqueue等のメタデータ取得でも外部画像を取得し、本文が`[Image #N]`へ置換される。system側は添付を伝播しないため、既存consumerは画像参照を復元できず、画像取得失敗で従来のPR取得まで失敗する | 該当なし（初回レビュー） | 初回レビューで確認した新規変更 | 画像取得をtask boundaryの明示的な準備処理へ分離し、汎用PRメタデータ取得は従来どおり副作用なしに戻す |
| 2 | CODE-NEW-src-infra-github-pr-images.ts-L311 | PRIMG-06 | High | `src/infra/github/pr-images.ts:283-324`、`src/app/cli/routing.ts:317-347` | cleanupが一時ファイルだけを削除し、`mkdtempSync`で作成した親ディレクトリを削除しない。さらに`process.exit(1)`は外側の`finally`を実行しない | 正常終了後も一時ディレクトリが蓄積し、`--pr`のbranch未解決終了では画像ファイルを含む一時領域が残る | 該当なし（初回レビュー） | 初回レビューで確認した新規変更 | 添付単位ではなく一時ディレクトリ全体をfinallyで削除し、`process.exit()`前にも明示cleanupするか、例外を上位へ返してfinallyを通す |
| 3 | CODE-NEW-src-infra-github-pr-images.ts-L198 | PRIMG-05 | Medium | `src/infra/github/pr-images.ts:198-208` | placeholder番号を既存本文の`[Image #N]`や既存添付名を考慮せず、配列長だけで割り当てている | 既存本文に`[Image #1]`がある状態で新画像を追加すると、置換結果も`[Image #1]`となり、既存参照と新規画像を区別できない | 該当なし（初回レビュー） | 初回レビューで確認した新規変更 | 本文・添付・同一batchから使用済み番号を収集し、空いている番号を割り当てる |
| 4 | CODE-NEW-src-infra-github-pr-images.ts-L184 | PRIMG-01 | Medium | `src/infra/github/pr-images.ts:184-208` | 本文中の画像をMarkdown形式とHTML形式に分けて抽出している | 同一本文でHTML画像がMarkdown画像より先に出現しても、Markdown画像が先に`Image #1`となり、仕様上の出現順序と置換番号がずれる | 該当なし（初回レビュー） | 初回レビューで確認した新規変更 | 両形式を同一走査で抽出するか、match indexで統合ソートしてから番号を付ける |

## 継続指摘（persists）

なし。Report Directory内に最新`review-resolution.md`または未解消として裁定された前回findingはありません。

## 解消済み（resolved）

なし。既存の裁定記録はありません。

## 裁定済みの対象外指摘

なし。既存の裁定記録はありません。

## 再開指摘（reopened）

なし。既存の解消済みfindingはありません。

## 検証証跡

- 差分確認: 指定された15ファイルと、変更契約に関係する下流consumerを確認。`fetchPrReviewComments`からtask/add、interactive、pipeline、system経路まで追跡。
- ビルド: `npm run build` 成功。
- lint: `npm run lint` 成功。
- テスト: 対象6ファイルを実行し、6ファイル・170テスト成功。混在形式の出現順、既存placeholder衝突、system consumerへの副作用、親一時ディレクトリ削除、`process.exit()`経路は未検証で、上記findingとして実コード上の不具合を確認。

## 再走査証跡（2回目以降のレビューで必須）

初回レビューのため該当なし。