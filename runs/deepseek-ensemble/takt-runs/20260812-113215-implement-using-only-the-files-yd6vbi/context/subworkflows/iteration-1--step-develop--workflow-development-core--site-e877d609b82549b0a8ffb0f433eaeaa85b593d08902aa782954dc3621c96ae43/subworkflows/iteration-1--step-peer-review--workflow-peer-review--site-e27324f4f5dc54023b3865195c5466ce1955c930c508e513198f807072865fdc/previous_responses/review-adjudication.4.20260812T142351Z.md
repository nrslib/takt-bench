問題を、最新レビューレポートの各 finding を現在の要求・コード・実行証跡に照合し、修正権限を持つ family だけへ正規化する作業と捉えます。まず指定された Policy／Knowledge を全文確認し、次に task 配下と Report Directory の最新レポートを特定して、提出済み finding のみを裁定します。ソース編集やテスト再実行は行いません。
指定正本の全文確認が完了しました。適用する中心基準は、PR画像 attachment family の定義から `takt add --pr` と pipeline `--pr` の末端までを閉じること、Content-Type・magic bytes・サイズ上限・GitHub URL 制限を直接満たすこと、そして修正方式の好みを権限根拠にしないことです。続いて最新の iteration-3 の4レポートだけから finding を抽出します。
最新レポートが提出した finding は3件です。現時点の直接確認では、`saveTaskFile` はすでに `try...finally` 内にあり、例外時 cleanup 不実行という主張とはコードが一致しません。一方、画像解決 capability の optional fallback は複数 consumer に実在するため、これは修正権限と共通所有者を分けて追加検証します。採番指摘は、現行の `[Image #N]` 契約と実到達する producer を追って衝突シナリオの有無を確認します。
検証結果は、修正対象 family が1件です。optional capability の同一 fallback が direct CLI、pipeline、`takt add --pr` の3 consumer で再構築されており、今回差分が導入した同一契約の重複として修正権限があります。採番指摘は現行契約外の将来フォーマット変更を前提とする方式要求、cleanup 指摘は現コードと回帰テストに反証されるため、修正対象へは入れません。最終裁定用に行番号を再確認して正本を確定します。
## 裁定結果

**修正対象あり**です。actionable family は1件、再計画は不要です。

### 提出 finding の一意な裁定

| finding ID | disposition | 裁定根拠 |
|---|---|---|
| `AI-NEW-src-features-interactive-imageAttachments-L34` | `overreach` | `[Image #N]` は現行の明示契約で、PR画像 producer も同形式を生成しています。[imageAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/interactive/imageAttachments.ts:34) は既存最大番号の次を採番し、テストも `#3 → #4` を確認しています。「将来フォーマットが変わる」という未確定前提に基づく `index` フィールド追加は、現在の欠陥を超える方式要求です。 |
| `AI-NEW-src-app-cli-routing-inputs-L67` | `actionable` → `PRIMG-CAPABILITY-NORMALIZATION` | optional capability の確認と identity fallback が [routing-inputs.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/app/cli/routing-inputs.ts:67)、[steps.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/pipeline/steps.ts:229)、`add --pr` に同じ意味で重複しています。今回差分が導入した同一契約のDRY退行であるため、Authorization Basis は reviewer 記載の直接違反ではなく `remediation_regression` とします。 |
| `AI-NEW-src-features-tasks-add-L232` | `no_issue_after_verification` | `saveTaskFile` は現在 [add/index.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/tasks/add/index.ts:235) の `try...finally` 内にあり、例外時も `resolved.cleanup()` が実行されます。[addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/addTask.test.ts:505) にも当該反例の検証があります。 |

### Bounded horizontal comparison で確認した consumer

`PRIMG-CAPABILITY-NORMALIZATION` と同じ不変条件・正本・根本原因を持つ未記載 consumer を1件確認しました。

| follow-up ID | disposition | Authorization Basis | Reason Absent |
|---|---|---|---|
| `ADJ-FOLLOWUP-src-features-tasks-add-L198` | `duplicate` → `PRIMG-CAPABILITY-NORMALIZATION` | `accepted_family_unvisited_consumer` | reviewer は direct CLI と pipeline の2箇所のみを列挙し、[add/index.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/tasks/add/index.ts:198) の同一 fallback を含めていなかったため |

## 修正対象 family

### `PRIMG-CAPABILITY-NORMALIZATION`

- 権限根拠: `remediation_regression`
- 破られた不変条件: optional なPR画像解決 capability の委譲・非対応時 fallback は、1つの共通所有者で定義され、全 consumer が同じ意味を利用する。
- 契約経路:
  - [GitProvider optional contract](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/git/types.ts:159)
  - GitHub 実装
  - GitLab の非対応経路
  - `takt --pr`
  - pipeline `--pr`
  - `takt add --pr`
- 受入条件:
  - capability の有無判定と `{ prReview, attachments: [], cleanup: noop }` の生成が共通境界に一元化される。
  - 上記3 consumer がその共通境界を利用する。
  - GitHub では既存 resolver へ委譲される。
  - 非対応 provider では元のPRデータ、空 attachment、no-op cleanupという既存挙動を維持する。
- 修正境界:
  - 変更対象: Git provider の共通解決境界、3 consumer、およびその契約テスト。
  - 明示的除外: GitLabへのGitHub画像取得実装、optional method の必須化、全 provider/mock の大規模移行、採番方式変更、画像抽出・検証・cleanup の周辺リファクタリング。

適用した基準は、レビュー裁定・契約置換ポリシー、アーキテクチャ上の共通所有者／DRY／呼び出しチェーン、既存テストの証拠能力です。E2E、WorkflowEngine、セッション、設定解決などは今回の3 finding には非適用です。`environment_unverified` および未解決前提はありません。実行ゲートは本ステップの責務外のため再実行していません。