# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|------|----------------------|
| `PRIMG-TEMP-DIR-OWNERSHIP` | `direct_acceptance_criterion_violation` | `prReviewImageAttachments.ts:427` | `TEMP-DIR-UNIQUE` | 重複実行時に画像ファイルが衝突し、一方のcleanupが他方のファイルを削除する $\rightarrow$ `createTempDownloadDir` が固定名 `takt-pr-images` を使用している $\rightarrow$ 処理単位の一意なprivate一時ディレクトリを生成していない | 構造 | 同一 `tmpRoot` で2回解決し、両結果を未cleanupのまま保持してもファイルが独立して生成され、個別cleanupで他方を削除しないこと。境界は一時ディレクトリ生成とcleanup処理のみ。 |

## 欠陥 family の最終状態
| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `TEMP-DIR-UNIQUE` | 画像解決結果が自身の一時領域とcleanupを所有する計画契約 | 1回の解決処理は他から隔離された専用領域を所有し、そのcleanupは所有領域のみを削除して他を破壊しない | 変更なし（実装の不備修正） | `resolvePrReviewImageAttachments` $\rightarrow$ `downloadPrReviewImageAttachments` $\rightarrow$ `createTempDownloadDir` $\rightarrow$ `fs.rmSync` | [SCN-TEMP-DIR-UNIQUE-P1], [SCN-TEMP-DIR-UNIQUE-N1] | なし |

## 要求シナリオ（条件付き）

Scenario: [SCN-TEMP-DIR-UNIQUE-P1] 同一tmpRootで複数回の解決処理を並存させても独立して保存される
  Given 同一の `tmpRoot` を指定し、2回連続で `resolvePrReviewImageAttachments` を呼び出した状況
  When 両方の処理結果の `attachments` パスを確認する
  Then それぞれが異なるディレクトリ（`takt-pr-images-XXXXXX`）配下のパスを持ち、両方のファイルが実在する

Scenario: [SCN-TEMP-DIR-UNIQUE-N1] 一方のcleanupを実行しても他方の保存ファイルは削除されない
  Given 同一の `tmpRoot` で2回解決し、両方の成果物を保持している状況
  When 1回目の処理の `cleanup()` を実行する
  Then 2回目の処理で生成されたファイルが依然として実在する

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `TEMP-DIR-UNIQUE` | 局所修正 | なし | `src/infra/github/prReviewImageAttachments.ts:425-430` | `createTempDownloadDir` が `fs.mkdtempSync` 等を用いて一意なパスを返すこと |
| 2 | `TEMP-DIR-UNIQUE` | 局所修正 | 1 | `src/__tests__/prReviewImageAttachments.integration.test.ts` | 追加した並存・個別削除シナリオのテストがすべてパスすること |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `TEMP-DIR-UNIQUE` | `Knowledge: TAKT アーキテクチャ知識` | `fs.mkdtempSync` を用いて `takt-pr-images-` プレフィックスの一意なディレクトリを生成する方式を採用。固定名による衝突を完全に回避できるため。 | 同一 `tmpRoot` 下で複数インスタンスを生成し、パスの不一致と `cleanup` 後の生存確認を行う統合テスト。 | 各解決処理が完全に独立したライフサイクル（生成 $\rightarrow$ 所有 $\rightarrow$ 削除）を持つため、契約を満たす。 | `npm run test:it` |