# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|-------------------------------|------|----------------------|
| CODE-NEW-attachments-save | direct_acceptance_criterion_violation | `saveImageAttachments` が定義されているが呼び出し箇所がない | `image-attachment-persistence` | 画像が保存され order.md に反映されない $\rightarrow$ `saveImageAttachments` の呼び出し漏れ $\rightarrow$ 機能未完 | `src/features/tasks/attachments.ts` に定義はあるが、リポジトリ全体で参照箇所がないことを grep で確認 | 構造 | `takt add --pr` 等の実行時に、画像が `.takt/tasks/<slug>/attachments/` に保存され `order.md` に追記されること。保存ロジック自体の変更は除外。 |
| TEST-NEW-01 | direct_acceptance_criterion_violation | `src/__tests__/` に新規機能のテストが存在しない | `pr-image-attachment-test` | 品質要件（単体テスト追加）の不足 $\rightarrow$ テストファイル未作成 $\rightarrow$ テスト欠落 | `src/__tests__/` 下に `image-downloader` や `attachments` に関連するテストが存在しないことを確認 | 局所 | `extractImageUrls`, `validateAndDownloadImage`, `saveImageAttachments` に対する単体テストが実装され、成功すること。既存テストの修正は除外。 |

## 不変条件台帳
引き継ぎ元: 先行 remediation なし

### 引き継ぎ元からの行
（なし）

### 新規・現在の計画行
| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|----------|-----------|------------------|----------------------|----------|------|------------------------------|--------|
| `image-attachment-persistence` | `image-attachment-persistence` | 画像の永続化と order.md 追記の整合性 | ダウンロードされた画像はタスクディレクトリに保存され、`order.md` に記載されること | `src/features/tasks/attachments.ts` | 構造 | 未確認 | `prepareTaskSpecDirectory` 内で `saveImageAttachments` を呼び出し、ファイル保存と order.md 更新を一貫して行う。 |
| `pr-image-attachment-test` | `pr-image-attachment-test` | 画像処理ロジックの正当性担保 | 新規導入ロジック（抽出・検証・保存）が単体テストで担保されていること | `src/infra/github/image-downloader.ts` 等 | 局所 | 未確認 | 不要: 既存の担当箇所で直接修正（テスト作成） |

## 欠陥 family の最終状態
| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `image-attachment-persistence` | `order.md` の仕様 | 画像保存と追記の完遂 | `prepareTaskSpecDirectory` から `saveImageAttachments` を呼び出す | `addTask` $\rightarrow$ `saveTaskFile` $\rightarrow$ `saveEnqueuedTaskFile` $\rightarrow$ `prepareTaskSpecDirectory` $\rightarrow$ `saveImageAttachments` $\rightarrow$ ファイル保存 / `order.md` 追記 | SCN-image-attachment-persistence-P1 | なし |
| `pr-image-attachment-test` | 品質要件 (単体テスト) | 抽出・検証・保存ロジックの全パス検証 | `src/__tests__/` 下にテストを追加 | `extractImageUrls`, `validateAndDownloadImage`, `saveImageAttachments` $\rightarrow$ Unit Test | SCN-pr-image-attachment-test-P1 | なし |

## 要求シナリオ（条件付き）

Scenario: [SCN-image-attachment-persistence-P1] 画像の保存と order.md への追記
  Given PRレビューに画像URL `https://github.com/user-attachments/assets/abc` が含まれている
  When `takt add --pr <number>` を実行する
  Then `.takt/tasks/<slug>/attachments/` にファイルが保存され、`.takt/tasks/<slug>/.takt/order.md` の「## 添付画像」セクションにパスが記載される

Scenario: [SCN-pr-image-attachment-test-P1] 画像ダウンロードのバリデーション成功
  Given 有効なGitHubアセットURL `https://github.com/user-attachments/assets/valid`
  When `validateAndDownloadImage` を呼び出す
  Then 画像データ（Buffer）が返却される

Scenario: [SCN-pr-image-attachment-test-N1] 非許可URLの拒否
  Given 許可されていないドメインのURL `https://example.com/image.png`
  When `validateAndDownloadImage` を呼び出す
  Then `Only GitHub or GitLab attachment URLs are allowed` エラーがスローされる

## 入力・状態・経路の確認表
| 修正単位 | 軸の正本・根拠 | 具体的な入力・状態 | 入口・経路 | 実装上の制約 | consumer / terminal | 期待結果 | 反証方法・テスト ID |
|----------|----------------|--------------------|------------|----------------|---------------------|----------|-----------------------|
| `image-attachment-persistence` | `src/features/tasks/attachments.ts` | 画像ありの状態 | 現行: `addTask` $\rightarrow$ `saveTaskFile` $\rightarrow$ `saveEnqueuedTaskFile` $\rightarrow$ `prepareTaskSpecDirectory` $\rightarrow$ `promoteTaskAttachments` $\rightarrow$ ファイル保存のみ。修正後: 同入口 $\rightarrow$ `prepareTaskSpecDirectory` $\rightarrow$ `saveImageAttachments` $\rightarrow$ ファイル保存 + `order.md` 追記 | `saveImageAttachments` が `async` であるため、`beforeWrite` および `saveEnqueuedTaskFile` での `await` 処理が必要 | `order.md` ファイル / `attachments/` ディレクトリ | 保存済みファイルと `order.md` への追記内容が正しいこと | `takt add --pr` 後のファイル・内容確認 |
| `pr-image-attachment-test` | 品質要件 | 有効URL / 無効URL / サイズ超過 / 型不正 | 現行: テストなし。修正後: `npm test` $\rightarrow$ 新設テストファイル $\rightarrow$ 各関数 | `gh` CLIへの依存があるため、テストではモック化または検証用環境が必要 | テストランナー (Vitest) | すべてのテストケースが Pass すること | `npm test` |

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `image-attachment-persistence` | 局所修正 | なし | `src/features/tasks/attachments.ts` | `takt add --pr` 時に画像が保存され `order.md` に追記されること |
| 2 | `pr-image-attachment-test` | 局所修正 | 1 | `src/__tests__/` (新規ファイル) | 新設された単体テストがすべて成功すること |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|----------|--------------|--------------------------|-----------------------------|----------|
| `image-attachment-persistence` | `saveImageAttachments` の定義 | 既存の `saveImageAttachments` を `prepareTaskSpecDirectory` で呼び出す。`promoteTaskAttachments` と機能が重複するため、後者を `saveImageAttachments` に置き換える | `takt add --pr` 後のファイルシステム確認 | 既存の定義済み関数を正しく配線することで、機能未完を解消する |
| `pr-image-attachment-test` | 品質要件 (単体テスト) | 抽出・ダウンロード・保存の各関数を個別にテストするテストケースを作成 | `npm test` の実行結果 | 未実装だった品質要件（単体テスト）を充足させる |

## 再計画事項
- なし