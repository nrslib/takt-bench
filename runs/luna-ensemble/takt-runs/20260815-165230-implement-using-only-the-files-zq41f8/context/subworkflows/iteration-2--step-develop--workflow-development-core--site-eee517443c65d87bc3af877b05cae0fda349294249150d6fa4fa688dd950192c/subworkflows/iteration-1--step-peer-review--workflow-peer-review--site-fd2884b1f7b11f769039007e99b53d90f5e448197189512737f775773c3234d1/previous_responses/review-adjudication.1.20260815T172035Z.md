問題は、提出済みレビュー指摘だけを対象に、現行コード・要求・レビュー履歴・再発台帳を突合し、修正対象 family と各 finding の正式な裁定を確定することです。まず指定された Knowledge/Policy と Report Directory の全成果物を確認し、その後、各指摘に必要な範囲だけコードと要求を再検証します。ソース変更・コミット・ステージングは行いません。
指定された Policy と Knowledge は先頭から EOF まで確認しました。Report Directory 直下には remediation の `fix-verification.md` も既存の `review-resolution.md` もなく、現時点で確認できる提出物は initial-reviewers 配下の6レポートです。次に要求仕様と各レビュー本文を全文確認し、finding ID・family・証拠を抽出します。
レビュー本文の全6件を確認しました。指摘は主に同じPR画像契約に集中していますが、(a) 抽出・採番、(b) 一時資源の終端、(c) 汎用PR metadata境界、(d) 認証取得のURLスコープ、(e) テスト分類の5系列に分かれています。重複を統合できるかと、要求・変更差分に直接結び付くかを、現行実装で確認します。
現行コードで、`fetchPrReviewComments()` は `system-git-context` からも直接呼ばれ、system 側の型・consumer は attachments を受け取らず `body` だけを公開しています。したがって画像取得・本文置換の副作用混入は実在します。また `gh --help` の実環境出力は endpoint を GitHub API v3 のパスまたは `graphql` と定義しており、`https://github.com/.../assets/...` をそのまま渡す現在の呼び出しは仕様外です。引き続き、番号衝突・終端cleanup・テスト配線の再現性を確認します。
候補の再検証結果です。`releaseVerificationWiring.test.ts` は現行状態で実行し、`src/__tests__/pipelineExecution.test.ts` が unit から未分類境界として検出され、17件中1件失敗しました。一方、既存の画像 parser テスト12件は通過しましたが、混在記法・既存 placeholder 衝突・一時ディレクトリ終端はテストされていないため、コード上の欠陥確認を打ち消しません。次に再発台帳の候補がないことを明示確認し、重複を family 単位で統合して裁定します。
## 裁定結果

**修正対象あり。** 7 family を actionable とし、重複指摘を統合します。`TEST-NEW-PRIMG-02-download-content` のみ `overreach` とします。

### 再発台帳の引き継ぎ

- 引き継ぎ元: **先行 remediation なし**
- 根拠: 公開済み `subworkflows/iteration-N--step-remediation-*/fix-verification.md` は0件
- `review-resolution.md` も未存在
- したがって、既存の不変条件行・13項目はなく、合成行や初期値行は作成しない

### 修正対象 family

| Family | 不変条件・実在経路 | 受入条件・境界 |
|---|---|---|
| `pr-image-download-api` | `downloadGitHubPrImages()` → `gh api` → Content-Type/magic/size検証 → temp file → add/routing/pipeline | 実在する認証付き取得経路で PNG/JPEG/GIF/WebP を保存できる。`gh api` に完全URLをAPI endpointとして渡さない。HTTP方式や不要な汎用化は対象外 |
| `pr-image-reference-order` | `extractGitHubPrImageReferences()` → Markdown/HTML抽出 → placeholder置換 → `formatPrReviewAsTask()` → `order.md` | 同一本文内のMarkdown/HTML混在でも出現順と `[Image #N]`、filename、order.md が一致する |
| `pr-image-reference-allocation` | PR本文 → placeholder採番 → attachment manifest → task consumer | 既存本文中の `[Image #N]` と新規画像の番号が衝突しない。無関係な既存タスクの一般採番変更は対象外 |
| `pr-review-fetch-boundary` | `fetchPrReviewComments()` → system context / sync / enqueue / add / pipeline | 汎用metadata取得は画像download・本文置換を行わない。add/routing/pipeline の画像task準備は別経路で維持する |
| `pr-attachment-lifecycle` | `mkdtempSync()` → attachment copy → add/routing/pipeline → cleanup | 成功・失敗・cancel・`process.exit()`前の終了でファイルと親temp directoryを削除する。`SIGKILL`対応や全機能のtemp掃除は対象外 |
| `pr-image-fetch-scope` | PR URL/repository context → attachment URL検証 → 認証取得 → task attachment | 現在のPRと無関係なprivate repository資産を、コメント由来URLだけで認証取得しない。GitHub外ホストの一般対応は対象外 |
| `release-verification-wiring` | `pipelineExecution.test.ts` → test classifier → release verification runner | 実filesystemを使うテストがunitに残らず、分類検証が成功する。現行実行では同ファイルが未分類として失敗済み |

### 指摘ごとの裁定

| Finding ID | Disposition | 裁定 |
|---|---|---|
| `AI-PRIMG-001` | `actionable` | `pr-image-download-api`。`gh --help` はAPI v3 pathまたは`graphql`を要求し、現在の完全URL渡しは不正 |
| `AI-PRIMG-002` | `actionable` | `pr-attachment-lifecycle`。`pr-images.ts:283`で親dirを作成し、`cleanupGitHubPrAttachments()`はファイルしか削除しない |
| `AI-PRIMG-003` | `actionable` | `pr-image-reference-order`。`pr-images.ts:192-195`でMarkdown抽出後にHTML抽出を連結している |
| `ARCH-PRIMG-001` | `duplicate` → `pr-attachment-lifecycle` | `AI-PRIMG-002`と同じ親temp directory残留 |
| `ARCH-PRIMG-002` | `actionable` | `pr-review-fetch-boundary`。system consumerにも`fetchPrReviewComments()`経由でdownloadと本文置換が到達する |
| `ARCH-PRIMG-003` | `duplicate` → `pr-attachment-lifecycle` | `routing.ts:319-321`の`process.exit()`によるfinally迂回 |
| `ARCH-PRIMG-004` | `duplicate` → `pr-image-reference-order` | `AI-PRIMG-003`と同じ混在記法の順序破綻 |
| `CODE-NEW-src-infra-github-pr.ts-L464` | `duplicate` → `pr-review-fetch-boundary` | `ARCH-PRIMG-002`と同じmetadata境界への副作用混入 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | `duplicate` → `pr-attachment-lifecycle` | ファイルのみ削除・`process.exit()`迂回を同一familyへ統合 |
| `CODE-NEW-src-infra-github-pr-images.ts-L198` | `actionable` | `pr-image-reference-allocation`。既存`[Image #1]`との衝突を検出できる実装になっていない |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | `duplicate` → `pr-image-reference-order` | `AI-PRIMG-003`と同じ抽出順序の欠陥 |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | `duplicate` → `pr-review-fetch-boundary` | 汎用fetchのsystem経路への副作用混入 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | `duplicate` → `pr-attachment-lifecycle` | `process.exit()`時のcleanup漏れ |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | `duplicate` → `pr-attachment-lifecycle` | 親temp directory残留 |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | `duplicate` → `pr-image-reference-allocation` | 単純な配列長採番によるplaceholder衝突 |
| `PRIMG-08-TEST-CLASSIFICATION` | `actionable` | `release-verification-wiring`。実行結果でも`pipelineExecution.test.ts`が未分類として失敗 |
| `SEC-PRIMG-001` | `actionable` | `pr-image-fetch-scope`。`isAllowedGitHubAttachmentUrl()`は`other-private/repo/assets/...`を拒否せず、現在のPRとの関連も検証しない |
| `SEC-PRIMG-002` | `duplicate` → `pr-attachment-lifecycle` | system経路の残留と親dir残留を同一cleanup familyへ統合。fetch境界の指摘は独立findingで対応 |
| `TEST-NEW-PRIMG-01-order` | `duplicate` → `pr-image-reference-order` | 混在記法の未検証と実装上の順序破綻 |
| `TEST-NEW-PRIMG-02-download-content` | `overreach` | bytes検証・途中失敗テストの追加要求は技術的には有用だが、現行コードの実装欠陥または元受入条件の直接違反を示す証拠がない。新規テスト自体は存在する |
| `TEST-NEW-PRIMG-06-cleanup` | `duplicate` → `pr-attachment-lifecycle` | 親directoryと実終了経路のcleanup欠落 |

確認した実行証跡では、`github-pr-images.test.ts` は12件成功しましたが、`releaseVerificationWiring.test.ts` は17件中1件失敗し、`pipelineExecution.test.ts` が未分類境界として検出されています。ソース変更・コミット・ステージングは行っていません。