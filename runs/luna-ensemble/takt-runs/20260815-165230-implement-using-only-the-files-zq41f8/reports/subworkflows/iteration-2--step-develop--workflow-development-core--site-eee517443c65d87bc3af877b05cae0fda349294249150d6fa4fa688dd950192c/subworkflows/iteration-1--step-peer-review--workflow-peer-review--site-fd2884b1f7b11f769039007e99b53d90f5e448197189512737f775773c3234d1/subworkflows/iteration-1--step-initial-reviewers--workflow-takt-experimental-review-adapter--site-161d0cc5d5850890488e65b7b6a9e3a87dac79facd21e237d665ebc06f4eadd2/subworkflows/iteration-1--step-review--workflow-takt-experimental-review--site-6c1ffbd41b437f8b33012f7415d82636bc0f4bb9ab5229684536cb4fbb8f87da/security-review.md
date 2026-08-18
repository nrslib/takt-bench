# セキュリティレビュー

## 結果: REJECT

## サマリー

認証付きGitHub画像取得のrepoスコープがなく、PR本文から別private repositoryの画像取得を誘発できます。加えて、system系consumerで取得した一時画像がcleanupされず、機密データ残留と資源枯渇につながります。

## 重大度: High

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| `pr-image-fetch-scope` | `isAllowedGitHubAttachmentUrl()` とPR画像取得境界 | 低信頼PR本文が、現在のPRに属さない保護資産を認証付きで取得できない | PR本文のURLを現在のrepo情報なしに認証付きdownloaderへ渡している | PR body/comments/reviews → URL抽出 → `gh api` → task/interactive/pipeline | [pr-images.ts:116](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:116)、[pr.ts:436](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr.ts:436)、[pr-images.ts:290](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:290) | `PrReviewData.attachments` → task attachments、AI実行入力 | add、interactive、pipeline、systemの各PR取得経路を確認 | GitHub画像の正常系・形式検証mockは存在するが、別repo保護資産の拒否テストはなし | なし | finding `SEC-PRIMG-001` |
| `pr-image-temp-lifecycle` | `downloadGitHubPrImages()` / `cleanupGitHubPrAttachments()` | 取得した一時画像と一時ディレクトリが全consumerの終端で解放される | 汎用PR取得関数内でdownloadを開始し、cleanup所有権を全consumerへ配線していない | `fetchPrContext()` → system sync/enqueue/`pr_context` → cleanupなし | [pr-images.ts:283](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:283)、[pr-images.ts:316](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:316) | system経路では画像を利用せず、取得ファイルだけが残留。通常経路でも親一時ディレクトリが残る | [system-git-context.ts:77](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/workflow/system/system-git-context.ts:77)、[system-sync-effects.ts:42](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/workflow/system/system-sync-effects.ts:42)、[system-enqueue-effect.ts:197](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/workflow/system/system-enqueue-effect.ts:197)、[DefaultSystemStepServices.ts:111](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/workflow/system/DefaultSystemStepServices.ts:111) | cleanup専用テストなし | なし | finding `SEC-PRIMG-002` |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 種類 | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `SEC-PRIMG-001` | `pr-image-fetch-scope` | High | 認証付き取得のrepoスコープ欠落 | [pr-images.ts:138](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:138) | PR本文の攻撃者が指定した `https://github.com/other-private/repo/assets/...` を現在のPRとの関連なしに許可し、利用者のGitHub token付き `gh api` で取得する。取得画像はtask attachmentおよび後続AI実行へ渡るため、別private repositoryの機密画像が露出する。 | `initial_review_changed_family` | 該当なし | 現在のPRのowner/repoとasset URLを照合し、別repo資産を拒否する。`user-attachments` もPRとの関連を検証する。 |
| 2 | `SEC-PRIMG-002` | `pr-image-temp-lifecycle` | Medium | 一時画像のcleanup漏れ | [pr.ts:469](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr.ts:469) | `fetchPrReviewComments()` がsystem経路でも画像を取得するが、system consumerはcleanupしない。さらにcleanup関数は画像ファイルのみ削除し、親一時ディレクトリを残すため、反復実行で機密画像残留と一時領域の資源枯渇が発生する。 | `initial_review_changed_family` | 該当なし | metadata取得と画像付きtask準備を分離し、system経路ではdownloadしない。cleanup ownerが一時ディレクトリ全体を全終端で削除する。 |

## 継続指摘（persists）

| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|---|---|---|---|---|---|

該当なし。

## 解消済み（resolved）

| finding_id | 解消根拠 |
|---|---|

該当なし。

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|---|---|---|---|

該当なし。

## 再開指摘（reopened）

| # | finding_id | family_tag | 直前の裁定 | 再開根拠（a-d） | 新しい証拠 | 問題 | 修正案 |
|---|---|---|---|---|---|---|---|

該当なし。

## 検証証跡

- ビルド: 未確認。品質ゲートの未実行はfindingにしていない。
- Lint: 未確認。品質ゲートの未実行はfindingにしていない。
- テスト: `github-pr-images.test.ts` と `github-pr.test.ts` を実行し、56件成功。
- 動作確認: `gh api --verbose` により、GitHub URLへAuthorization headerが付与されることを確認。対象コードでは任意のrepo asset pathを同じ認証付き呼び出しへ渡している。

## 警告（非ブロッキング）

- Content-Type、magic bytes、10 MiB上限、外部host拒否、固定ファイル名によるpath traversal対策は確認できた。
- これらは上記2件のrepoスコープ欠落とsystem経路のcleanup漏れを解消しない。

## REJECT判定条件

有効なAuthorization basis付きの`new` findingが2件あるため、REJECTとする。