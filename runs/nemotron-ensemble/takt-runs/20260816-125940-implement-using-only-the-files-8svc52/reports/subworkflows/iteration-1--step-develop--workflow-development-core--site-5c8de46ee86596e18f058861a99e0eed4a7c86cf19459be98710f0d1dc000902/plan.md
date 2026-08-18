# タスク計画

## 元の要求

> Implement using only the files in `.takt/runs/20260816-125940-implement-using-only-the-files-8svc52/context/task`.  
> Primary spec: `.takt/runs/20260816-125940-implement-using-only-the-files-8svc52/context/task/order.md`.  
> Use report files in Report Directory as primary execution history.  
> Do not rely on previous response or conversation summary.

## 分析結果

### 目的

`order.md` の要求に従い、GitHub PRの本文・通常コメント・レビューコメントに含まれる画像URLを取得し、検証済みのローカル添付画像として次の経路へ渡す。

- `takt add --pr`
- 直接の `takt --pr`
- Pipelineの `--pr`

画像参照は既存の `[Image #n]` および `attachments/image-n.ext` 形式へ接続する。

### 分解した要件

| # | 要件 | 変更要否 | 種別 | 由来・導出根拠 | 備考 |
|---|------|----------|------|----------------|------|
| 1 | PR本文・通常コメント・レビューコメントからMarkdown画像記法を認識する | 要 | 明示 | `context/task/order.md` の対象箇所・期待する挙動 | `![alt](URL)` を対象とする |
| 2 | HTMLの `<img src="URL">` を認識する | 要 | 明示 | `context/task/order.md` の対象箇所・例示 | 属性の引用符違いを含める |
| 3 | GitHub添付URLを対象にする | 要 | 明示 | `context/task/order.md` の対応URL例 | `github.com/user-attachments/assets/...` と `github.com/<org>/<repo>/assets/...` |
| 4 | 任意の外部URLを無制限に取得しない | 要 | 明示 | `context/task/order.md` の安全要件 | allowlist外は取得しない |
| 5 | PNG/JPEG/GIF/WebPをContent-Typeとmagic bytesで検証する | 要 | 明示 | `context/task/order.md` の対応形式・検証要件 | 形式不一致は添付化しない |
| 6 | 画像サイズの上限を適用する | 要 | 明示 | `context/task/order.md` のサイズ上限制約 | 具体値は実装上の安全制限として定める |
| 7 | 画像を `image-1.ext` 形式で一時保存し、本文内の参照を `[Image #n]` に置換または補足する | 要 | 明示・直接導出 | `order.md` のファイル名・プレースホルダー指定。置換しないと後続consumerが画像と本文を対応付けられない | URL重複時は同一添付へ対応付ける |
| 8 | `takt add --pr` に画像添付を配線する | 要 | 明示 | `order.md` の対象CLI指定 | `saveTaskFile` に既存の添付形式で渡す |
| 9 | `takt add --pr` の添付を `.takt/tasks/<slug>/attachments/` と `order.md` に保存する | 要 | 明示 | `order.md` の保存先・形式指定 | 既存のtask attachment機構を利用する |
| 10 | 直接の `takt --pr` に画像添付を配線する | 要 | 明示 | `order.md` の対象CLI指定 | `InteractiveSeedInput.attachments` を利用する |
| 11 | Pipelineの `--pr` で画像を実行時task spec/run contextから参照可能にする | 要 | 明示・直接導出 | `order.md` のPipeline指定。保存・転送されなければPipeline側で画像を参照できない | 既存のtask spec経路を利用する |
| 12 | 画像取得で生成した一時ファイルを成功・失敗・キャンセル時にcleanupする | 要 | 直接導出 | 要件1〜11を一時ファイルで成立させるために不可欠 | Interactive内部のcleanupだけではPR取得元ファイルを所有できない |
| 13 | 画像を含まないPRの既存処理を維持する | 不要 | 維持 | `src/features/tasks/add/index.ts:193-196`、`src/infra/git/format.ts:197-265` | 画像がない場合は既存データと処理を維持する |
| 14 | 既存の手動画像添付処理を維持する | 不要 | 維持 | `src/features/tasks/attachments.ts:35-108`、`src/features/interactive/imageAttachments.ts:137-163` | 新しいPR画像処理で置換しない |
| 15 | GitLab PR取得およびシステムステップ経路を変更しない | 不要 | 維持 | `src/infra/gitlab/pr.ts`、`src/core/workflow/system/system-step-services.ts:84-101` | GitHub PR画像機能の対象外 |

### 参照資料の調査結果

タスク指示書には、`context/task/order.md` 以外の参照資料は指定されていません。外部実装を参照する要件もありません。

`order.md` と現行実装の主要な差異は次のとおりです。

- `src/infra/github/pr.ts:421-458` は本文・コメント・レビューを取得するが、画像URLを抽出しない。
- `src/features/tasks/add/index.ts:198-212` はPRをタスク化するが、添付を `saveTaskFile` に渡していない。
- `src/app/cli/routing-inputs.ts:50-70` はPR入力を文字列だけ返している。
- `src/features/pipeline/steps.ts:213-229` はPR本文をtask文字列に変換するが、添付を保持しない。
- `src/features/tasks/attachments.ts:35-108,266-296` は既存添付の保存機構を提供済みであり、新しいPR画像取得側から接続すればよい。
- `src/features/tasks/execute/selectAndExecute.ts:121-195` と `src/features/tasks/execute/taskSpecContext.ts:57-105` は一時task specとrun contextへの添付転送を既に実装している。

### スコープ

変更対象は、GitHub PR画像の抽出・検証・一時保存と、次の3入口への配線である。

- `src/infra/github/pr.ts` または隣接するGitHub専用画像処理モジュール
- `src/infra/git/types.ts` およびGitHub providerの型・能力接続
- `src/features/tasks/add/index.ts`
- `src/app/cli/routing-inputs.ts`
- `src/app/cli/routing.ts`
- `src/features/pipeline/steps.ts`
- `src/features/pipeline/execute.ts`
- 必要に応じて既存magic-byte判定の共通化箇所
- GitHub PR画像、add、routing、pipelineのテスト

対象外はGitLab、システムステップ、Issue、PR作成、任意URL取得、旧データ移行である。

### 検討したアプローチ

| アプローチ | 採否 | 理由 |
|-----------|------|------|
| 既存の `fetchPrReviewComments` に常時画像ダウンロードを追加する | 却下 | システムステップなど一時ファイルの所有者がない経路へ副作用を拡張する |
| GitHub専用の添付付きPR取得能力を追加し、3入口だけが利用する | 採用 | 要求範囲を限定し、既存のGitLab・システム経路を維持できる |
| 任意URLを正規表現で抽出して直接取得する | 却下 | 外部入力を無制限に取得するため、安全要件に反する |
| Markdownパーサーを新規導入する | 不採用 | 現在の依存関係に該当パーサーがなく、対象記法とコードフェンスを扱う小規模スキャナで要件を満たせる |
| 既存のtask attachment機構を置き換える | 却下 | `src/features/tasks/attachments.ts` が保存・検証・転送を既に提供している |
| 既存のmagic-byte判定をPR側で複製する | 不採用 | `src/features/interactive/inlineImagePaste.ts:45-59` と同じ不変条件のため、共通化して形式判定の乖離を防ぐ |

### 実装アプローチ

1. GitHub PR取得後に本文・通常コメント・レビューコメントを走査する専用処理を追加する。
2. Markdown画像とHTML画像だけを認識し、コードフェンス・インラインコード・通常リンク・bare URLは除外する。
3. GitHub添付URLのallowlistを検証する。
4. 認証済みの `gh api` / `gh` 経路で取得する。
5. Content-Type、magic bytes、サイズ、regular file状態を検証する。
6. 検証済み画像をprivateな一時ディレクトリへ保存する。
7. URLを出現順に `[Image #n]` とファイル名へ対応付け、PR本文・コメント・レビュー本文を置換する。
8. `takt add --pr` では添付を `saveTaskFile` に渡す。
9. 直接 `takt --pr` では添付を `InteractiveSeedInput.attachments` に渡す。
10. Pipelineでは `TaskContent.attachments` に保持し、`prepareTaskSpecDirectory`、`resolveTaskSpecForExecution`、`executeTask`、run context stagingへ接続する。
11. 各入口が一時ファイルの所有者となり、成功・失敗・キャンセル・早期終了でcleanupする。
12. 既存の画像なし経路、GitLab経路、システムステップ経路は変更しない。

### 完了契約

| 契約ID | 要求・維持事項 | 由来 | 成立する振る舞い | 拒否すべき誤実装 | 実装箇所 | 完了証拠 |
|--------|----------------|------|------------------|--------------------|----------|----------|
| `C1` | 対象記法のGitHub画像URLを抽出し、検証済み画像と `[Image #n]` に対応付ける | 要件1-7 | Markdown/HTMLの対象URLだけが取得され、対応する画像ファイル・プレースホルダーが生成される | bare URL、コード領域、allowlist外URL、形式不一致画像を取得する | GitHub PR画像処理、共通magic-byte判定 | GitHub画像取得ユニットテスト |
| `C2` | `add --pr`、直接 `takt --pr`、Pipeline `--pr` へ添付を渡す | 要件8、10、11 | 3入口で同一PR画像が後続処理へ到達する | PR文字列だけ渡し、添付が失われる | add、routing、pipeline各配線 | 各入口のユニット・統合テスト |
| `C3` | `add --pr` の添付を既存形式で保存する | 要件9 | `.takt/tasks/<slug>/attachments/image-n.ext` と `order.md` の添付参照が生成される | 添付を別形式で保存する、相対参照を壊す | `saveTaskFile` 呼び出し側 | 実ファイルを使うaddTaskテスト |
| `C4` | 直接実行とPipeline実行で画像を終端consumerから参照可能にする | 要件10、11の直接導出 | 直接実行ではInteractive seedへ、Pipelineではrun context内task specへ画像が届く | PR取得時だけ画像を作り、実行時に添付を渡さない | routing、pipeline task spec staging | routingテスト、pipeline実行テスト |
| `P1` | 画像なしPR、既存手動添付、GitLab、システム経路を維持する | 要件13-15 | 画像処理対象外の既存結果と経路が変わらない | GitHub向け副作用を全provider・全システム経路へ拡張する | 既存実装を維持 | 既存テスト群と回帰テスト |
| `C5` | PR画像取得側が一時ファイルのライフサイクルを管理する | 要件12 | 成功・失敗・キャンセル後に一時ファイルが残らない | Interactive内部cleanupだけに依存し、PR取得ファイルを残す | add、routing、pipelineの所有者処理 | cleanupおよび失敗経路テスト |

### 影響経路

| 契約ID | 定義・生成 | 変換・保存・復元 | 消費・出力・補助入口 | 状態・所有権 | 現行利用側の移行 | 明示された支援 |
|--------|------------|------------------|---------------------|-------------|------------------|------------------|
| `C1` | GitHub PR取得結果が画像URLのproducer | URL抽出、allowlist検証、認証取得、Content-Type/magic bytes/サイズ検証、placeholderとファイル名への正規化 | PR formatter、task order、Interactive seed、Pipeline task spec | 取得処理が一時ファイルを所有 | 既存 `fetchPrReviewComments` 利用側は維持し、対象3入口のみ添付付き能力へ接続 | GitHub PR本文・通常コメント・レビューコメント |
| `C2` | 添付付きPR data | add/routing/pipelineへ転送 | `saveTaskFile`、Interactive、`executeTask` | 各入口が実行期間中の添付を所有 | 既存の文字列のみ利用側を添付付き入力へ拡張 | `takt add --pr`、直接 `takt --pr`、Pipeline `--pr` |
| `C3` | `TaskAttachment` | `prepareTaskSpecDirectory`、attachment manifest生成、ファイルコピー | `.takt/tasks/<slug>/order.md` と添付ファイル | task spec保存処理が保存先を所有 | 既存保存経路をそのまま利用 | `.takt/tasks/<slug>/attachments/` |
| `C4` | `TaskContent.attachments` またはInteractive seed | task spec生成、run context staging、Interactive画像入力 | agentのtask instruction、provider画像入力 | Pipelineの一時task specはpipelineが所有 | 既存task spec・Interactive経路へ接続 | 直接実行とPipeline |
| `P1` | 既存PR・添付・provider経路 | 既存の変換・保存・復元 | 既存consumer | 既存所有者を変更しない | 移行なし | 対象外経路の維持 |
| `C5` | ダウンロード一時ファイル | success/failure/cancel/early exit cleanup | 各入口の終了処理 | 生成元の入口が所有 | なし | 3入口すべて |

### 到達経路・起動条件

| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、直接の `takt --pr <number>`、Pipelineの `--pr` |
| 更新が必要な呼び出し元・配線 | `src/infra/github/pr.ts`、GitHub provider、`src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | GitHub PR番号が指定され、PR本文・通常コメント・レビューコメントに対象記法のallowlist済み画像URLが存在すること |
| 未対応項目 | なし。GitLab、Issue、任意外部URLは要求対象外 |

## 要求シナリオ（条件付き）

### C1: 構造化入力

```gherkin
Scenario: [SCN-C1-P1] Markdown画像とHTML画像を添付へ変換する
  Given PR本文に `![screen](https://github.com/user-attachments/assets/a1)` があり、レビューコメントに `<img src="https://github.com/org/repo/assets/b2">` がある
  When PR画像の抽出と検証を実行する
  Then 2つの画像が取得され、本文とレビューコメントのURLがそれぞれ `[Image #1]` と `[Image #2]` に対応付けられる

Scenario: [SCN-C1-N1] 非対象文脈のURLを取得しない
  Given PR本文に `` `![screen](https://github.com/user-attachments/assets/a1)` `` と、``` ```markdown\n![screen](https://github.com/user-attachments/assets/b2)\n``` ``` がある
  When PR画像の抽出と検証を実行する
  Then 画像ファイルもプレースホルダーも生成されない
```

### C1: 識別子生成

```gherkin
Scenario: [SCN-C1-P2] 同一URLを安定した添付識別子へ対応付ける
  Given PR本文と通常コメントに同じ `https://github.com/user-attachments/assets/a1` があり、レビューコメントに `https://github.com/org/repo/assets/b2` がある
  When PR画像の抽出と検証を実行する
  Then `a1` は1つの `[Image #1]` と1つの画像ファイルに対応し、`b2` は `[Image #2]` と別の画像ファイルに対応する

Scenario: [SCN-C1-N2] 検証に失敗した画像に識別子を割り当てない
  Given `https://github.com/user-attachments/assets/a1` の応答Content-Typeが `image/png` だがmagic bytesがJPEGである
  When PR画像の抽出と検証を実行する
  Then画像ファイルと `[Image #1]` は生成されず、検証失敗の一時ファイルも残らない
```

## 実装ガイドライン

- PR取得の既存パターンは `src/infra/github/pr.ts:421-458` を参照する。
- `PrReviewData` とprovider接続は `src/infra/git/types.ts:109-141` を参照する。
- 添付保存形式は `src/features/tasks/attachments.ts:35-108,266-296` を再利用する。
- Pipelineの一時task spec管理は `src/features/tasks/execute/selectAndExecute.ts:121-195`、run context転送は `src/features/tasks/execute/taskSpecContext.ts:57-105` に合わせる。
- 直接PR入力の配線は `src/app/cli/routing-inputs.ts:50-70`、`src/app/cli/routing.ts:118-140,197-338` を参照する。
- PipelineのPR入力は `src/features/pipeline/steps.ts:213-229`、実行は `src/features/pipeline/execute.ts:32-60` を参照する。
- Interactive seed添付は `src/features/interactive/interactive.ts:198-214`、session attachmentの扱いは `src/features/interactive/conversationLoop.ts:126-143` を参照する。
- GitHub取得は認証済み `gh api` の既存パターン `src/infra/git/paginated-api.ts:52-69` に合わせる。
- magic bytes判定は `src/features/interactive/inlineImagePaste.ts:45-59` と同じ対応形式を共有する。
- 正規表現だけでURLを検索し、コードフェンスやリテラル領域を無視してはならない。
- allowlist外のURLに対して通常の外部HTTP取得を行わない。
- 画像取得の一時ファイルをInteractive内部のcleanupだけに任せない。
- `process.exit()` がある経路では `finally` だけをcleanup保証とみなさない。
- GitHub向けの副作用を `GitProvider.fetchPrReviewComments` 全体やGitLab・system経路へ広げない。
- `formatPrReviewAsTask` は可能な限り変更せず、整形前に本文・コメントを正規化する。
- 新しいパラメータを追加する場合は、producerから最終consumerまでの全配線を確認する。

## スコープ外

| 項目 | 除外理由 |
|------|---------|
| 任意の外部画像URLの取得 | `order.md` の安全要件に反する |
| GitLab PR画像対応 | 要求はGitHub添付URLを対象としている |
| Issue・通常Interactive入力の画像URL対応 | 今回の対象入口ではない |
| PR作成・更新時の画像処理 | 要求対象外 |
| 旧添付形式のupcaster・migration・backfill | 明示要求がない |
| システムステップのPRデータへの添付追加 | 一時ファイル所有者と終端consumerが要求範囲外 |
| `takt add --pr` の既存コメント有無判定の変更 | `src/features/tasks/add/index.ts:193-196` の既存契約を変更する要求がない |

## 確認事項

なし。