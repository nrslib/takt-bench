## 根本原因と責務の分析

### 1. 現状の確認
`src/shared/utils/imageAttachmentReferences.ts` において、画像プレースホルダーの正本となる定義が以下のように存在している。
- `IMAGE_ATTACHMENT_PLACEHOLDER_EXACT_PATTERN = /^\[Image #[1-9]\d*\]$/`
- 成立条件: `[Image #N]` 形式であり、`N` は正の整数（先頭ゼロ不可）。

しかし、以下の consumer がこの正本を利用せず、独自に `\d+` を用いたパーサーおよび生成ルールを実装している。
- `src/infra/github/prReviewImageAttachments.ts:87, 190`: `[Image #(\d+)]` を使用。`[Image #0]` や `[Image #01]` を許容し、採番も独自に行っている。
- `src/features/interactive/imageAttachments.ts:37, 143`: `^\[Image #(\d+)\]$` を使用。採番も独自（`maxNumber + 1`）に行っている。
- `src/features/tasks/retryTaskSpecAttachments.ts:51, 71`: `\[Image #(\d+)\]` を使用。採番も独自に行っている。

### 2. 構造問題の分類
これは **「文法所有の分散による退行（Regression of Grammar Ownership）」** という構造問題である。
プレースホルダーの形式という単一の不変条件が、複数の実装箇所にコピー＆ペースト的に分散して存在しているため、正本（`imageAttachmentReferences.ts`）の制約（先頭ゼロ不可・正の整数）が consumer 側で無視され、不整合が発生している。

### 3. 影響経路の特定
- **正本**: `src/shared/utils/imageAttachmentReferences.ts` (定義・検証)
- **Consumer (生成・抽出・採番)**:
    - `src/infra/github/prReviewImageAttachments.ts`: PR本文・コメントからの番号収集 $\rightarrow$ 未使用番号の採番 $\rightarrow$ プレースホルダー生成。
    - `src/features/interactive/imageAttachments.ts`: 既存最大番号の抽出 $\rightarrow$ 次番号の採番 $\rightarrow$ プレースホルダー生成。
    - `src/features/tasks/retryTaskSpecAttachments.ts`: ベースコンテンツからの最大番号抽出 $\rightarrow$ 次番号の採番 $\rightarrow$ プレースホルダー生成。

---

## 修正計画

### 修正単位: `PRIMG-PLACEHOLDER-GRAMMAR-OWNER`
プレースホルダーの文法判定、番号抽出、および生成の責務を `imageAttachmentReferences.ts` に集約し、全 consumer を移行する。

#### 1. 正本の拡張 (`src/shared/utils/imageAttachmentReferences.ts`)
以下の機能を追加し、文法所有を完全に担わせる。
- `extractImagePlaceholderNumber(placeholder: string): number | undefined`: `isImageAttachmentPlaceholder` で正規と判定された文字列から番号を抽出する。
- `createImageAttachmentPlaceholder(number: number): string`: 与えられた番号から正規のプレースホルダー文字列を生成する。
- (内部的に) `IMAGE_ATTACHMENT_PLACEHOLDER_PATTERN` などの正規表現を整理し、外部から不整合な正規表現を直接参照させない。

#### 2. Consumer の移行
各 consumer において、独自の正規表現と文字列テンプレートを削除し、正本の関数に置換する。

- **GitHub Producer (`src/infra/github/prReviewImageAttachments.ts`)**:
    - `collectExistingPlaceholderNumbers` 内の独自正規表現 $\rightarrow$ `isImageAttachmentPlaceholder` + `extractImagePlaceholderNumber` へ移行。
    - `extractPrReviewImageReferences` 内の `` `[Image #${number}]` `` $\rightarrow$ `createImageAttachmentPlaceholder(number)` へ移行。
- **Interactive Consumer (`src/features/interactive/imageAttachments.ts`)**:
    - `nextAttachmentNumber` 内の独自正規表現 $\rightarrow$ `isImageAttachmentPlaceholder` + `extractImagePlaceholderNumber` へ移行。
    - `saveImage` 内の `` `[Image #${index}]` `` $\rightarrow$ `createImageAttachmentPlaceholder(index)` へ移行。
- **Retry Consumer (`src/features/tasks/retryTaskSpecAttachments.ts`)**:
    - `resolveMaxImageIndex` 内の `\[Image #(\d+)\]` 部分 $\rightarrow$ `isImageAttachmentPlaceholder` + `extractImagePlaceholderNumber` へ移行。
    - `renumberRetryAttachments` 内の `` `[Image #${nextImageIndex}]` `` $\rightarrow$ `createImageAttachmentPlaceholder(nextImageIndex)` へ移行。

### 受入条件
- **一貫性の確保**: 全ての consumer が生成するプレースホルダー、および抽出・判定に用いるロジックが `imageAttachmentReferences.ts` の定義と完全に一致すること。
- **挙動の維持**:
    - PR: 既存番号を避けた空き番号を採番する挙動を維持。
    - Interactive/Retry: 最大番号の次を採番する挙動を維持。
- **不正形式の拒絶**: `[Image #0]` や `[Image #01]` などの不正なプレースホルダーを、抽出・採番プロセスで正規番号として扱わないこと。

### 検証方法
- **静的確認**: 全 consumer から `[Image #` という文字列リテラルと `\d+` 系の独自プレースホルダー正規表現が消去され、`imageAttachmentReferences.ts` の関数に置き換わっていることを確認する。
- **テスト**: 
    - `imageAttachmentReferences.ts` に、境界値（1, 0, -1, 01, 非数値）に対する判定・抽出・生成のユニットテストを追加し、不変条件を検証する。
    - 既存の画像アタッチメント関連テストを実行し、採番ロジックに退行がないことを確認する。

## 要求シナリオの維持

| 修正単位 | シナリオ | 入力/状態 | 期待される結果 |
| :--- | :--- | :--- | :--- |
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | 正規プレースホルダーの抽出 | `"[Image #12]"` | `12` として抽出され、正規と判定される |
| | 不正プレースホルダーの拒絶 (0) | `"[Image #0]"` | 正規と判定されず、番号も抽出されない |
| | 不正プレースホルダーの拒絶 (先頭ゼロ) | `"[Image #01]"` | 正規と判定されず、番号も抽出されない |
| | プレースホルダーの生成 | `1` | `"[Image #1]"` が生成される |