# コーディングレビュー

## 結果: REJECT

## サマリー
`src/projection.ts` において、`ReservationReleased` イベント時に個別の予約数量を正しく減算できず、予約合計額をすべて差し引いてしまう重大なバグが残っています。

## 観測した指摘
| # | family_tag | 重大度 | 場所 | 問題 | 影響 | 修正案 |
|---|------------|--------|------|------|------|--------|
| 1 | ai-antipattern-review | High | `src/projection.ts:14` | `ReservationReleased` 処理で `reserved` 数量を個別に減算できない | 予約の一部を解放した際に、他の予約分も含めてすべて減算されてしまい、在庫集計（`reserved`, `available`）が不整合になる | `StockProjection` 内部で `reservationId` ごとの数量を保持する Map を導入し、該当 ID の数量のみを減算するように修正してください |

## 検証証跡
- 差分確認: `src/projection.ts` の `apply` メソッド内、`ReservationReleased` 処理で `reserved` 全体を引いているロジックを確認。
- ビルド: 未確認。
- テスト: 未確認。

## REJECT判定条件
- ブロッキング指摘（High）が1件あるため REJECT。