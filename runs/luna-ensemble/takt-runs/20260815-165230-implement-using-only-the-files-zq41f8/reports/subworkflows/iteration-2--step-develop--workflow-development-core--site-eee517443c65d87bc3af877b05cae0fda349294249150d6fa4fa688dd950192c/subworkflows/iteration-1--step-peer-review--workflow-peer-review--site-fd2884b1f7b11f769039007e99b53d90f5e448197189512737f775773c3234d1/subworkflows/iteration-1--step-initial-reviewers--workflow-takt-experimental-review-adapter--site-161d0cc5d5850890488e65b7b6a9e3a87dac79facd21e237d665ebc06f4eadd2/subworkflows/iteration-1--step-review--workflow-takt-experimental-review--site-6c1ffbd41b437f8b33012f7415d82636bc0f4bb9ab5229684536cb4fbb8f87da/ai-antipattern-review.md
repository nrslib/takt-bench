# AI生成コードレビュー

## 結果: REJECT

## サマリー

GitHub画像取得に実在しない`gh api`利用前提があり、cleanup漏れと画像番号順序の不整合も確認できるため、差し戻しとします。

## 検証した項目

| 観点 | 結果 | 備考 |
|------|------|------|
| 仮定の妥当性 | ❌ | `gh api`がブラウザ用完全URLを受け付けるという誤った仮定 |
| API/ライブラリの実在 | ❌ | `gh api https://github.com/user-attachments/assets/...`は404になる |
| コンテキスト適合 | ❌ | 実GitHub API境界ではなく、モックが不正な呼び出しを通している |
| スコープ | ❌ | PR画像取得・cleanup・番号付与の同一契約内で3件確認 |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| GitLab、Issue、direct task経路 | 複数 | outside_contract_jurisdiction | 今回のPR画像契約と担当箇所が異なり、退行は確認できない |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| pr-image-download | `downloadGitHubPrImages()` | 許可されたPR画像が認証付き取得を経て添付になる | GitHub添付URLと`gh api` endpointの混同 | PR取得 → 抽出 → ダウンロード → add/routing/pipeline | `src/infra/github/pr-images.ts:184-180`、`:276-303` | `addTask`、interactive seed、pipeline task specへ伝搬 | `execFileSync`の404がPR取得経路へ伝播 | `github-pr.test.ts`が`execFileSync`をモック | 実認証付き画像取得 | finding `AI-PRIMG-001` |
| pr-image-cleanup | `cleanupGitHubPrAttachments()` | 正常・キャンセル・失敗の全終端で一時資源を削除 | 一時ファイルだけ削除し、`mkdtempSync`の親を追跡していない | add/routing/pipelineのfinally | `src/infra/github/pr-images.ts:283-284`、`:311-323` | 添付コピー後に元ファイルのみ削除 | 空の一時ディレクトリが残る | cleanup後のファイル不存在だけを検証 | 長時間・繰り返し実行時の蓄積 | finding `AI-PRIMG-002` |
| pr-image-order | `extractGitHubPrImageReferences()` | `Image #N`が本文中の出現順と一致する | MarkdownとHTMLを別々に抽出して連結している | PR body/comment/review body → placeholder置換 | `src/infra/github/pr-images.ts:190-205` | `replaceGitHubPrImageReferences()` → order/task content | 同一本文内でHTML画像がMarkdown画像より先の場合に逆順 | 混在形式を同一本文で検証していない | 形式混在時の番号順 | finding `AI-PRIMG-003` |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|---------|------|------|---------------------|------------------------------|--------|
| 1 | AI-PRIMG-001 | pr-image-download | hallucination / 幻覚API | `src/infra/github/pr-images.ts:288-290` | `gh api`に`https://github.com/user-attachments/assets/...`を渡している。実際の`gh api`はAPIパスまたは`graphql`を想定するため404になり、画像取得が失敗する。 | direct_acceptance_criterion_violation | 該当なし（initial-review） | 認証済みHTTP取得または実在するAPI経路へ変更し、完全URLを`gh api`へ渡さない。モックではなく取得境界を検証する |
| 2 | AI-PRIMG-002 | pr-image-cleanup | resource cleanup漏れ | `src/infra/github/pr-images.ts:283-284,311-323` | `mkdtempSync()`で作成した一時ディレクトリは削除せず、添付ファイルだけを削除している。成功・キャンセル後に空ディレクトリが残る。 | direct_acceptance_criterion_violation | 該当なし（initial-review） | 一時ディレクトリを所有・追跡し、全終端でディレクトリまで削除する。成功・キャンセル・失敗で不存在を検証する |
| 3 | AI-PRIMG-003 | pr-image-order | 順序保持の実装漏れ | `src/infra/github/pr-images.ts:192-195` | 同一本文内の画像をMarkdown結果、HTML結果の順に連結するため、本文の実際の出現順と`Image #N`が一致しない。 | direct_acceptance_criterion_violation | 該当なし（initial-review） | 形式を横断して位置情報で統合・ソートし、混在形式のテストを追加する |

## 継続指摘（persists）

| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| - | - | - | - | - | なし | - |

## 解消済み（resolved）

| finding_id | 解消根拠 |
|------------|----------|
| - | なし |

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|------------|------------|---------------|----------|
| - | - | — | なし |

## 再開指摘（reopened）

| # | finding_id | family_tag | 直前の裁定 | 再開根拠（a-d） | 新しい証拠 | 問題 | 修正案 |
|---|------------|------------|------------|----------------|------------|------|--------|
| - | - | - | - | - | - | なし | - |

## 再走査証跡（2回目以降のレビューで必須）

初回レビューのため該当なし。

## REJECT判定条件

有効な`Authorization basis`を持つ`new` findingが3件あるため、REJECTとします。