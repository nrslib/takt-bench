## 修正計画レポート

### 1. 修正対象と受入条件の対応付け

| 修正単位 (Family ID) | 指摘 ID / 出典 | 修正権限 | 受入条件 | 完了条件 (証拠) |
|:---|:---|:---|:---|:---|
| **F-INTERACTIVE-RESULT-TOTALITY** | `AI-NEW-routing-L283` | 退行 | 非nullの選択モードは、non-null assertion (`!`) なしで必ず `InteractiveModeResult` を生成し、型安全に `dispatchConversationAction` へ接続されること。 | `src/app/cli/routing.ts` において `result!` が排除され、全モード経路で型が確定していることの静的確認。 |
| **F-PR-IMAGE-LIFECYCLE** | `FU-PRIMG-TERMINAL-EXIT-TEST` | 契約違反 | PR head branch 欠落時の `process.exit(1)` 直前に `prAttachmentsCleanup` が呼ばれることを、モックを用いて決定的に観測できること。 | `src/__tests__/cli-routing-pr-resolve.test.ts` に、`prAttachmentsCleanup` の呼び出しを assert するテストケースを追加し、パスすること。 |

---

### 2. 原因分析と構造分類

#### F-INTERACTIVE-RESULT-TOTALITY (構造問題: 型安全性の退行)
- **正本**: `INTERACTIVE_MODES` (closed union) および `InteractiveModeResult` 型。
- **現状**: `src/app/cli/routing.ts:283` で `const confirmedResult = result!;` としており、`switch` 文による全量処理の保証を型レベルで放棄している。
- **根本原因**: モード処理の全域性を TypeScript の型検査ではなく、開発者の記憶（`switch` で全部書いたはず）に依存させ、非null assertion で強制的に型を合わせている。
- **影響経路**: `selectInteractiveMode` $\rightarrow$ `switch (selectedMode)` $\rightarrow$ `result` への代入 $\rightarrow$ `dispatchConversationAction`。

#### F-PR-IMAGE-LIFECYCLE (局所問題: テスト証拠不足)
- **正本**: PR 添付ファイルのライフサイクル管理（生成 $\rightarrow$ 利用 $\rightarrow$ Cleanup）。
- **現状**: 実装 (`src/app/cli/routing.ts:326`) は存在するが、テスト (`src/__tests__/cli-routing-pr-resolve.test.ts:367-387`) が `prAttachmentsCleanup` の呼び出しを検証していない。
- **根本原因**: `process.exit` を throw でシミュレートしているため、外側の `finally` が動いてしまう偽陽性のリスクがあり、exit 直前の明示的な cleanup 呼び出しを個別に検証できていない。

---

### 3. 修正計画

#### 修正単位 1: `F-INTERACTIVE-RESULT-TOTALITY`
- **方法**: 
  - `result` の初期値を `undefined` にせず、`switch` 文の中で直接 `InteractiveModeResult` を返す関数にするか、`switch` の各 case で `result` を確定させ、`default` case で到達不能であることを型に伝える（例: `throw new Error` または `exhaustive check`）。
  - `confirmedResult = result!` を削除し、型推論によって `confirmedResult` が `InteractiveModeResult` であることを保証する。
- **完了条件**: `result!` の削除と、コンパイルエラーのない型安全な接続。

#### 修正単位 2: `F-PR-IMAGE-LIFECYCLE`
- **方法**: 
  - `src/__tests__/cli-routing-pr-resolve.test.ts` の `should exit with a controlled error when a saved PR task has no head branch` テストを拡張。
  - `resolvePrInput` の戻り値にある `cleanup` 関数を `vi.fn()` でモックし、`process.exit` が呼ばれる前にこのモックが呼ばれたことを `expect(cleanup).toHaveBeenCalled()` で検証する。
- **完了条件**: 追加したテストケースのパス。

---

### 4. 依存関係と実行順序

1. **`F-PR-IMAGE-LIFECYCLE`** (テスト補完): 既存実装の正当性を証明するため、先にテストを完結させる。
2. **`F-INTERACTIVE-RESULT-TOTALITY`** (型修正): ロジック変更を伴わない型安全性の回復を行う。

---

### 5. 要求シナリオの維持

#### F-INTERACTIVE-RESULT-TOTALITY
- **成立側**: `selectedMode` が `'assistant'` のとき $\rightarrow$ `interactiveMode` が `InteractiveModeResult` を返し $\rightarrow$ `confirmedResult` として安全に dispatch される。
- **拒否側**: 将来的に `INTERACTIVE_MODES` に `'new-mode'` が追加され、`switch` に case がないとき $\rightarrow$ コンパイルエラーが発生し、`result!` による黙殺が不可能になる。

#### F-PR-IMAGE-LIFECYCLE
- **成立側**: `prNumber` 指定あり $\rightarrow$ `resolvePrInput` で cleanup 関数生成 $\rightarrow$ `save_task` 選択 $\rightarrow$ `prBranch` が `undefined` $\rightarrow$ `prAttachmentsCleanup()` が実行され $\rightarrow$ `process.exit(1)` となる。
- **拒否側**: `prBranch` が存在する場合 $\rightarrow$ `saveTaskFromInteractive` が呼ばれ、`process.exit(1)` 経路を通らず、`finally` ブロックでの一括 cleanup に委ねられる。