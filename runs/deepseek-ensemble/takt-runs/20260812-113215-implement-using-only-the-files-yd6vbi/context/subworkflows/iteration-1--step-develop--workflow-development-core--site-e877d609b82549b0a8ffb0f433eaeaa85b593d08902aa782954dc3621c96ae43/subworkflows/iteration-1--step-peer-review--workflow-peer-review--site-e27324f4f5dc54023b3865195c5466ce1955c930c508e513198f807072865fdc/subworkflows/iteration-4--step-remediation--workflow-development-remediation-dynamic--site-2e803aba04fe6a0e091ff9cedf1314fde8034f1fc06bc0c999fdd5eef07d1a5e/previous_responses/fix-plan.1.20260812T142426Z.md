## 根本原因と責務の分析

### 1. 現象の確認
以下の3箇所で、`GitProvider.resolvePrReviewImageAttachments` という optional method の存在確認と、非対応時の identity fallback (`{ prReview, attachments: [], cleanup: () => undefined }`) が重複して実装されている。

- `src/app/cli/routing-inputs.ts:67-69`
- `src/features/pipeline/steps.ts:230-232`
- `src/features/tasks/add/index.ts:198-200`

### 2. 根本原因
PR画像解決という「プロバイダーの capability に依存し、かつ特定の fallback 形式を持つ」ロジックが、`GitProvider` インターフェースの optional method として定義されているため、利用側（consumer）が個別に判定と fallback 生成を行う責務を負っている。
本来、この判定と fallback 生成は `GitProvider` またはその管理境界（例: `getGitProvider()` の戻り値に付随するヘルパー）で一元的に行われるべきである。

### 3. 構造的な分類
これは**構造問題**である。
- **正本**: `GitProvider` インターフェース (`src/infra/git/types.ts`)。
- **不変条件**: プロバイダーが画像解決に対応していればその結果を返し、していなければ「元のPRデータ・空のattachments・no-op cleanup」を返すこと。
- **影響経路**: `GitProvider` の `resolvePrReviewImageAttachments` を呼び出すすべての consumer。

---

## 修正計画

### 修正単位: `PRIMG-CAPABILITY-NORMALIZATION`

#### 権限根拠
- `AI-NEW-src-app-cli-routing-inputs-L67` (actionable)
- `ADJ-FOLLOWUP-src-features-tasks-add-L198` (duplicate)

#### 受入条件
- `GitProvider` の capability 判定と fallback 生成が共通境界に一元化されていること。
- 3つの consumer (`routing-inputs.ts`, `steps.ts`, `add/index.ts`) がすべてその共通境界を利用していること。
- GitHub などの対応プロバイダーでは既存の resolver が呼ばれ、非対応プロバイダーでは既存の identity fallback 挙動が維持されること。

#### 修正境界
- **共通解決境界の導入**: `GitProvider` インターフェースをラップするか、`infra/git` モジュール内に共通の解決関数を導入する。
- **Consumer の移行**: 上記3箇所の重複ロジックを共通関数への呼び出しに置換する。
- **テスト**: 直接契約テスト（`GitProvider` の mock を用いた判定テスト）で挙動を確認する。

#### 実装詳細
1. `src/infra/git/index.ts` (または適切な場所) に `resolvePrImages(provider: GitProvider, prReview: PrReviewData, cwd?: string)` のような共通関数を実装する。
   - 内部で `provider.resolvePrReviewImageAttachments` の有無を判定し、なければ fallback を返す。
2. 各 consumer の `provider.resolvePrReviewImageAttachments ? ... : ...` ブロックをこの関数呼び出しに置換する。

#### 完了条件
- **静的確認**: 3箇所の重複判定ロジックが削除され、共通関数に集約されていること。
- **動的確認**:
    - 対応プロバイダー使用時に `resolvePrReviewImageAttachments` が呼ばれること。
    - 非対応プロバイダー使用時に空の attachments と no-op cleanup が返されること。

---

## 要求シナリオの維持

### 識別子生成・境界リスク分類: `PRIMG-CAPABILITY-NORMALIZATION`

| シナリオ | 入力/状態 | 期待される挙動 |
| :--- | :--- | :--- |
| **対応プロバイダー (GitHub)** | `provider.resolvePrReviewImageAttachments` が定義済み | 定義済みの resolver が実行され、保存済み画像リストと cleanup 関数が返される |
| **非対応プロバイダー (GitLab)** | `provider.resolvePrReviewImageAttachments` が undefined | エラーにならず、`attachments: []` および `cleanup: () => undefined` が返される |
| **共通境界の利用** | `routing-inputs`, `steps`, `add/index` のいずれから呼出 | すべて同一の判定ロジック・fallback 形式が適用される |