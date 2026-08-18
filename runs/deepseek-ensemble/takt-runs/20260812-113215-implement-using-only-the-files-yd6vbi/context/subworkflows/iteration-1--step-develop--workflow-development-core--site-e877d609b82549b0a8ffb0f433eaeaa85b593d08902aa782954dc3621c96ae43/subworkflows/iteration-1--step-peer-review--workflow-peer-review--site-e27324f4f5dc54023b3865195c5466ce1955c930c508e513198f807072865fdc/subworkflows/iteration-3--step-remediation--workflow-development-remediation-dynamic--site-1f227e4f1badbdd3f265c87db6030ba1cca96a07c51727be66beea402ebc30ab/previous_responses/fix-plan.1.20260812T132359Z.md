## 修正計画レポート

### 1. 修正対象と受入条件の列挙

裁定に基づき、以下の2つの修正単位を計画します。

| 修正単位 | family ID | 受入条件 | 根拠・権限 |
| :--- | :--- | :--- | :--- |
| **保護領域を維持した画像置換** | `FINAL-NEW-PRIMG-PROTECTED-SEGMENT-REWRITE` | 同一画像URLが通常本文と保護領域（コードフェンス、インラインコード、HTMLコメント）の両方に存在する場合、**通常本文のみが `[Image #N]` へ置換され、保護領域内の文字列は完全に維持される**こと。 | `direct_acceptance_criterion_violation` (src/infra/github/prReviewImageAttachments.ts:134-160) |
| **現行成果物のE2E品質ゲート証跡** | `FINAL-NEW-PRIMG-E2E-EVIDENCE` | 最新のコード修正後の成果物に対して `npm run test:e2e:mock` が完了し、成功結果が記録されること。 | `direct_acceptance_criterion_violation` (iteration 2 remediationの品質ゲート表) |

---

### 2. 根本原因と構造分析

#### 修正単位1: 保護領域を維持した画像置換
- **現状の挙動**:
    1. `extractPrReviewImageReferences` 内で `splitNonCodeSegments` を使い、非コード領域からのみURLを抽出する（正しい）。
    2. しかし、置換処理を行う `buildReplacedPrReview` (および `replaceSegmentImageUrls`) は、**本文全体 (`text: string`) に対して正規表現による一括置換**を行っている。
    3. そのため、非コード領域で抽出されたURLがコードフェンス内にも存在した場合、そこも置換されてしまう。
- **分類**: 局所的な実装不備（抽出ロジックと置換ロジックの不整合）。
- **不変条件**:
    - `splitNonCodeSegments` で定義された「保護領域（Fence, Inline Code, HTML Comment）」は、いかなる置換からも保護されなければならない。
    - 置換対象は、`splitNonCodeSegments` で抽出された「非コード領域」の中にある、かつ「許可されたGitHubアタッチメントURL」のみである。

#### 修正単位2: E2E品質ゲート証跡
- **現状**: Remediation後の最終的なコードベースで E2E mock テストが実行された証跡が不足している。
- **分類**: 品質保証プロセスの欠落。

---

### 3. 実装計画

#### 修正単位1: 保護領域を維持した画像置換
- **修正方針**:
    - `buildReplacedPrReview` の実装を変更し、本文全体への一括置換を廃止する。
    - `splitNonCodeSegments` を利用して本文をセグメントに分割し、**「非コード領域のセグメント」に対してのみ**置換処理を適用し、保護領域のセグメントはそのまま結合して本文を再構成する。
- **修正境界**:
    - `src/infra/github/prReviewImageAttachments.ts` の `buildReplacedPrReview` および `replaceText` 内部ロジック。
    - `splitNonCodeSegments` は既存のロジックをそのまま利用（境界維持）。
- **検証方法**:
    - `src/__tests__/prReviewImageAttachments.test.ts` に以下のケースを追加し、合格を確認する。
        - **成立ケース**: 通常本文にURLがあり、同時にコードフェンス内にも同一URLがある場合 $\rightarrow$ 本文のみ置換され、フェンス内は維持される。
        - **拒否ケース**: 保護領域（インラインコード、HTMLコメント）のみにURLがある場合 $\rightarrow$ 置換されず維持される。

#### 修正単位2: 現行成果物のE2E品質ゲート証跡
- **実施内容**:
    - 修正完了後、`npm run test:e2e:mock` を実行。
    - 実行結果（ログおよびテスト成功数）をレポートに記録する。

---

### 4. 依存関係と完了条件

**順序**:
1. `FINAL-NEW-PRIMG-PROTECTED-SEGMENT-REWRITE` の実装と単体テスト。
2. `FINAL-NEW-PRIMG-E2E-EVIDENCE` の実行と証跡記録。

**完了条件**:
- [ ] `src/__tests__/prReviewImageAttachments.test.ts` の混在入力テストが成功すること。
- [ ] `npm run test:e2e:mock` が成功し、その証跡が記録されること。

---

### 5. 要求シナリオの維持

| 修正単位 | 入力断片 (Scenario) | 期待結果 (Expected) |
| :--- | :--- | :--- |
| **保護領域維持** | `![img](URL_A)` <br> \` ![img](URL_A) \` <br> \`\`\` <br> ![img](URL_A) <br> \`\`\` | `[Image #1]` <br> \` ![img](URL_A) \` <br> \`\`\` <br> ![img](URL_A) <br> \`\`\` |
| **保護領域維持** | `<!-- <img src="URL_B"> -->` | `<!-- <img src="URL_B"> -->` (置換なし) |