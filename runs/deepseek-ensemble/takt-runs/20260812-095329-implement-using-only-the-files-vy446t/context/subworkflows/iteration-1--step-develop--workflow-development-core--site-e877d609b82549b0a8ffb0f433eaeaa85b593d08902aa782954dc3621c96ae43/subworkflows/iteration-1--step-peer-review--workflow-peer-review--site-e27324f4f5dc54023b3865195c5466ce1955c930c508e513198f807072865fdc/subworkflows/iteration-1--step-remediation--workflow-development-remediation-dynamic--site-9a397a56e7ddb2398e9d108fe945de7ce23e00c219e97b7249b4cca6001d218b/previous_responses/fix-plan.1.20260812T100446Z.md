## 修正計画レポート

### 1. 修正対象の特定と分析

裁定に基づき、一時画像ディレクトリのライフサイクル管理の不備（退行）を修正します。

#### 構造問題: `F-PR-IMAGE-LIFECYCLE`
- **不変条件**: `downloadPrReviewImageAttachments` で生成された一時ディレクトリは、成功・失敗・キャンセル・例外に関わらず、その利用期間が終了した時点で必ず削除されなければならない。
- **根本原因**: 一時ディレクトリの生成(`createTempDownloadDir`)と、それを保護する`try-finally`（または同等の保証境界）の間に、例外を投げる可能性のある処理（token取得、外部API呼び出し、ユーザー対話による中断）が配置されており、それらの経路でcleanupが呼ばれない。
- **影響経路**:
    1. **Producer**: `src/infra/github/prReviewImageAttachments.ts`
        - `createTempDownloadDir` の直後に `await deps.getToken()` があり、ここで失敗するとディレクトリが残留する。
    2. **Consumer (Pipeline)**: `src/features/pipeline/execute.ts`
        - `runWorkflow` が reject した場合、後続の `taskContent.attachmentCleanup?.()` に到達せず残留する。
    3. **Consumer (Interactive)**: `src/app/cli/routing.ts`
        - `determineWorkflow` および `selectInteractiveMode` で `null` が返った（キャンセル）場合、`prAttachmentsCleanup?.()` が呼ばれる前に return している。
    4. **Consumer (Add)**: `src/features/tasks/add/index.ts`
        - `determineWorkflow` が `null` を返した際、`resolved.cleanup()` は呼ばれるが、その前の `provider.resolvePrReviewImageAttachments` 内で例外が発生した場合や、その後の `saveTaskFile` 等で予期せぬ例外が発生した際の保護が不十分な箇所がある（特に `determineWorkflow` 直後の return 経路）。

---

### 2. 修正計画

#### 修正単位 1: Producer の保護強化
- **対象**: `src/infra/github/prReviewImageAttachments.ts`
- **変更内容**:
    - `downloadPrReviewImageAttachments` 内で、`createTempDownloadDir` を `try` ブロックの直後に移動し、`getToken` を含む全工程を `try-catch-finally` または適切に構成された `try-catch` で囲い、失敗時に確実に `fs.rmSync` が行われるようにする。
- **受入条件**: `getToken` が reject した場合に一時ディレクトリが削除されていること。

#### 修正単位 2: Pipeline Consumer の保護強化
- **対象**: `src/features/pipeline/execute.ts`
- **変更内容**:
    - `runPipeline` 内の `runWorkflow` 呼び出しを含むメインロジックを `try-finally` で囲み、`taskContent.attachmentCleanup?.()` を `finally` ブロックに集約して、例外発生時も確実に実行されるようにする。
- **受入条件**: `runWorkflow` が例外を投げた場合に一時ディレクトリが削除されていること。

#### 修正単位 3: Interactive Consumer の保護強化
- **対象**: `src/app/cli/routing.ts`
- **変更内容**:
    - `executeDefaultAction` 内の `prAttachmentsCleanup?.()` を呼び出す範囲を拡大する。
    - `determineWorkflow` および `selectInteractiveMode` のキャンセル経路 (`return`) の前に `prAttachmentsCleanup?.()` を呼び出すか、全体を `try-finally` で構造化する。
- **受入条件**: ワークフロー選択やモード選択でキャンセル（`null`）された場合に一時ディレクトリが削除されていること。

#### 修正単位 4: Add Consumer の保護強化
- **対象**: `src/features/tasks/add/index.ts`
- **変更内容**:
    - `addTask` 内の `resolved.cleanup()` 呼び出しを `try-finally` ブロックで確実に実行されるように構成し、`determineWorkflow` 等の途中の return 経路で漏れがないようにする。
- **受入条件**: ワークフロー選択キャンセル時および `saveTaskFile` 失敗時に一時ディレクトリが削除されていること。

---

### 3. 検証計画

#### 決定的なテストシナリオ
各経路において、一時ディレクトリが生成された後に意図的に失敗を発生させ、ディレクトリが消滅することを検証する。

| 修正単位 | シナリオ | 観測点 |
| :--- | :--- | :--- |
| Producer | `deps.getToken` が `Error` を投げる | `takt-pr-images` ディレクトリが存在しないこと |
| Pipeline | `runWorkflow` が `Error` を投げる | `takt-pr-images` ディレクトリが存在しないこと |
| Interactive | `determineWorkflow` が `null` を返す | `takt-pr-images` ディレクトリが存在しないこと |
| Interactive | `selectInteractiveMode` が `null` を返す | `takt-pr-images` ディレクトリが存在しないこと |
| Add | `determineWorkflow` が `null` を返す | `takt-pr-images` ディレクトリが存在しないこと |
| Add | `saveTaskFile` が `Error` を投げる | `takt-pr-images` ディレクトリが存在しないこと |

**品質ゲート**:
- 上記すべての失敗経路でディレクトリが残留しないことをテストコード（Vitest）で確認する。
- 正常系で cleanup が二重に呼ばれてもエラーにならない（冪等性）ことを確認する。