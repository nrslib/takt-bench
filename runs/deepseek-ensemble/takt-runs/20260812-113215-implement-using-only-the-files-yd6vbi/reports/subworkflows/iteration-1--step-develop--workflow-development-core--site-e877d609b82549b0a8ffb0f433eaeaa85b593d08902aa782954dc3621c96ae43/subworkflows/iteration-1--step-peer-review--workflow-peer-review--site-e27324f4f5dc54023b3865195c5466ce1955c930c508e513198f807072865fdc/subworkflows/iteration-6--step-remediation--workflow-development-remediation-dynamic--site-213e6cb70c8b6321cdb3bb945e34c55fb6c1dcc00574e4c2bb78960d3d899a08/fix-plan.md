# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|------|----------------------|
| `AI-NEW-image-attach-L35` / `ai-antipattern-review.md` | `remediation_regression` | `src/shared/utils/imageAttachmentReferences.ts:7` | `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | プレースホルダー文法が複数箇所に分散実装され、正本（先頭ゼロ不可・正の整数）と不整合が発生している → 共通所有者が利用されていない → 文法所有の退行 | 構造 | 正規 placeholder の判定、番号抽出、生成が共通所有者を通じて一貫すること。PR/interactive/retry consumerの移行のみを対象とする。 |
| `ADJ-FOLLOWUP-retry-placeholder-grammar` / 裁定 | `accepted_family_unvisited_consumer` | `src/features/tasks/retryTaskSpecAttachments.ts:51` | `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | (上記と同じ根本原因) | 構造 | (上記と同じ) |

## 欠陥 family の最終状態
| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | `src/shared/utils/imageAttachmentReferences.ts:7` | 形式は `[Image #N]` であり、`N` は正の整数（1以上）かつ先頭ゼロを含まない | `src/shared/utils/imageAttachmentReferences.ts` が判定・抽出・生成の全責務を保持する | `imageAttachmentReferences.ts` (定義) $\rightarrow$ `prReviewImageAttachments.ts` / `imageAttachments.ts` / `retryTaskSpecAttachments.ts` (生成・抽出) | [SCN-PRIMG-P1], [SCN-PRIMG-N1], [SCN-PRIMG-N2] | `prReviewImageAttachments.ts`, `imageAttachments.ts`, `retryTaskSpecAttachments.ts` 内の独自正規表現および文字列リテラル |

## 要求シナリオ（条件付き）

Scenario: [SCN-PRIMG-P1] 正規プレースホルダーから正しく番号が抽出される
  Given プレースホルダーとして `"[Image #12]"` が入力された状況
  When 番号抽出処理を実行
  Then 数値 `12` が返却される

Scenario: [SCN-PRIMG-N1] 番号が0のプレースホルダーは不正として拒絶される
  Given プレースホルダーとして `"[Image #0]"` が入力された状況
  When 番号抽出処理を実行
  Then `undefined` または不正として判定され番号が抽出されない

Scenario: [SCN-PRIMG-N2] 先頭にゼロを含む番号のプレースホルダーは不正として拒絶される
  Given プレースホルダーとして `"[Image #01]"` が入力された状況
  When 番号抽出処理を実行
  Then `undefined` または不正として判定され番号が抽出されない

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | 境界変更 | なし | `src/shared/utils/imageAttachmentReferences.ts` | `extractImagePlaceholderNumber` と `createImageAttachmentPlaceholder` が実装され、ユニットテストで [SCN-PRIMG-P1, N1, N2] をパスすること |
| 2 | `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | 利用側移行 | 工程1 | `src/infra/github/prReviewImageAttachments.ts`, `src/features/interactive/imageAttachments.ts`, `src/features/tasks/retryTaskSpecAttachments.ts` | 独自の `\d+` 正規表現と `[Image #` リテラルが削除され、工程1の関数に置換されていること。既存の採番挙動が維持されていること |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `PRIMG-PLACEHOLDER-GRAMMAR-OWNER` | `src/shared/utils/imageAttachmentReferences.ts:7` (正本) | `imageAttachmentReferences.ts` に抽出・生成関数を追加し、Consumer側で利用する。独自実装の削除による DRY 化と不整合排除を行う。 | ユニットテストによる文法検証および、各Consumerの静的コード照合 | 正本である `IMAGE_ATTACHMENT_PLACEHOLDER_EXACT_PATTERN` の制約を全経路で強制できるため | `npm test` (追加したユニットテストを含む) |

## 再計画事項
- なし