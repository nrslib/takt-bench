# 修正計画

## 結果: 修正計画確定 / タスク全体の再計画が必要

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|-------------------------------|------|----------------------|
| TEST-001 / `testing-review.md` | 受入条件の直接違反（`direct_acceptance_criterion_violation`） | `src/__tests__/addTask.test.ts:9` の `mockDownloadPrImages` が常に `attachments: []` を返す。`add/index.ts:199,214-218` は非空 attachments を `saveTaskFile` → `prepareTaskSpecDirectory` → `buildTaskOrderContent`＋`promoteTaskAttachments` へ配線済み | U1: `addTask --pr` 経路の添付伝播テスト追加 | 問題: `takt add --pr` 一次入口での添付伝播が単体テスト未カバー。直接原因: テストのモック（`addTask.test.ts:9`）が常に空 attachments を返すため `add/index.ts:218` の `attachments.length > 0` 分岐が踏まれない。根本原因: `order.md` 品質要件「新規ロジックには単体テストを追加する」への違反（テスト欠落であり機能欠陥ではない） | 原因を確認した根拠: `addTask.test.ts` のモック定義と `add/index.ts` の配線を実コードで確認。`pipelineExecution.test.ts:1554` で pipeline 経路の添付伝播は検証済み。否定した別の原因: 機能配線の欠陥（配線は `add/index.ts:214-218` で成立済みのため） | 局所 | 受入条件: `downloadPrImages` が非空 attachments（実在の一時画像ファイル）を返すケースで、(1) `saveTaskFile` へ attachments が渡る、(2) `.takt/tasks/<slug>/attachments/` へ画像がコピーされる、(3) `order.md` に `[Image #1]` 参照と `## 添付画像` が追記されることを検証する。修正境界: `addTask.test.ts` へのテスト追加のみ。配線の作り直し・新規外部契約の追加・pipeline 経路（既に検証済み）への再変更は不要。Content-Type 検証（PR-IMG-8）は裁定対象外のため含めない |

## 不変条件台帳
引き継ぎ元: 先行 remediation なし（同一 remediation ディレクトリ内に先行 `fix-verification.md` が0件。`review-resolution.md` も白紙開始を明示しているため台帳は白紙で開始）

### 引き継ぎ元からの行
| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| （該当行なし・白紙） | — | — | — | — | — | — | — | — | — | — | — | 完全 |

### 新規・現在の計画行
| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|----------|-----------|------------------|----------------------|----------|------|------------------------------|--------|
| U1: `addTask --pr` 経路の添付伝播テスト追加 | `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `takt add --pr <number>` 実行時に抽出した画像が `.takt/tasks/<slug>/attachments/` へコピーされ、`order.md` に `[Image #N]` 参照と `## 添付画像` が追記される | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | 局所 | 未確認 | 不要: 既存の担当箇所で直接修正（`addTask.test.ts` へのテスト追加のみ。初回検証のため再発判定は「判定できない（初回）」、別経路での再発は「未確認」） |

## 欠陥 family の最終状態
| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| U1: `addTask --pr` 経路の添付伝播テスト追加 | `order.md` 品質要件「新規ロジックには単体テストを追加する」、`takt add --pr` 経路の添付保存・配置・order.md 追記の観測可能な契約 | 一次入口 `takt add --pr` で抽出画像が attachments として保存・配置され、order.md に `[Image #N]` 参照と `## 添付画像` が追記される | 本番コードの責務・参照元は変更なし（`add/index.ts` の既存配線を維持）。テストカバレッジを `addTask.test.ts` に追加 | 定義・生成: `downloadPrImages`（`imageDownload.ts:84`）→ 永続化・配置: `saveTaskFile`（`add/index.ts:214`）→ `prepareTaskSpecDirectory`（`attachments.ts:266`）→ `promoteTaskAttachments`（`attachments.ts:88`）→ 出力: `buildTaskOrderContent` による order.md 追記（`attachments.ts:35`）。pipeline 経路（`steps.ts:228,360-372`）は既に `pipelineExecution.test.ts:1554` で検証済みのため検証のみ | 成立例: `downloadPrImages` が非空 attachments（実在の一時 `.png` ファイル）を返すとき、attachments が `.takt/tasks/<slug>/attachments/` へコピーされ、order.md に `[Image #1]` と `## 添付画像` が追記される。失敗例: `promoteTaskAttachments` のコピー先が存在しない、または `buildTaskOrderContent` が追記しない場合にテストが失敗する。境界値: `add/index.ts:218` の `attachments.length > 0` 分岐（空配列の場合は attachments を渡さず、添付なしの従来動作を維持） | なし（本番コード・pipeline 経路・旧経路の変更・削除は対象外） |

## 要求シナリオ（条件付き）
対象外 — 該当する修正単位なし（U1 はテスト追加のみで、構造化入力の分類・変換や識別子生成・連番の導入・変更を含まない）

## 入力・状態・経路の確認表
| 修正単位 | 軸の正本・根拠 | 具体的な入力・状態 | 入口・経路 | 実装上の制約 | consumer / terminal | 期待結果 | 反証方法・テスト ID |
|----------|----------------|--------------------|------------|----------------|---------------------|----------|-----------------------|
| U1 | `order.md` 品質要件（新規ロジックへの単体テスト追加）、`add/index.ts:199,214-218` の配線、`attachments.ts:266-282`（`prepareTaskSpecDirectory`）の保存・追記契約、`attachments.ts:35-54`（`buildTaskOrderContent`）の出力形式 | 添付あり: `downloadPrImages` が `{ prReview, attachments: [{ placeholder: '[Image #1]', tempPath: <実在の一時 .png>, fileName: 'image-1.png' }] }` を返す。添付なし（従来動作）: 空配列を返す（既存テストがカバー） | 現行: `addTask(cwd, task, { prNumber })`（`add/index.ts:164`）→ `provider.fetchPrReviewComments`（line 186）→ `downloadPrImages(prReview, cwd)`（line 199）→ `saveTaskFile(cwd, taskContent, { ...settings, prNumber, attachments })`（line 214）→ `saveTaskFile`（line 40）が非空時に `attachmentPrepareTaskSpec` を生成 → `prepareTaskSpecDirectory`（`attachments.ts:266`）→ `buildTaskOrderContent`（`attachments.ts:35`）＋ `promoteTaskAttachments`（`attachments.ts:88`）→ `saveEnqueuedTaskFile`（`enqueuedTaskFile.ts:41`）が order.md / tasks.yaml を書込。問題箇所: `addTask.test.ts:9` のモックが空 attachments を返すため line 218 の分岐が未検証。修正後: 同じ実経路に非空 attachments を注入し、line 218 分岐を通して保存・配置・order.md 追記を検証 | 現行の委譲: `saveTaskFile`（`add/index.ts:40`）は attachments 非空時にのみ `attachmentPrepareTaskSpec` を生成し `prepareTaskSpecDirectory`（`attachments.ts:266`）へ委譲。`promoteTaskAttachments` は拡張子（`.png` 等）と regular file のみを検証し magic bytes は要求しない（`imageAttachmentReferences.ts`）。現行の失敗との関係: モックが空を返すためこの委譲経路がテストで踏まれない | `order.md`（`prepareTaskSpecDirectory` が書込、`attachments.ts:272-280`）と `.takt/tasks/<slug>/attachments/`（`promoteTaskAttachments`、`attachments.ts:88-108`）。変更なし・検証のみ | 添付あり: `attachments/image-1.png` が実在し、order.md に `[Image #1]` と `## 添付画像` が含まれる | `addTask.test.ts` に非空 attachments ケースを追加し、(2)(3) の assertion で検証。`add/index.ts:218` の分岐や `promoteTaskAttachments` / `buildTaskOrderContent` が壊れた場合に assertion が失敗する。テスト ID: `addTask.test.ts` 内の新規テスト（例: `should save and place PR images as attachments with order.md references`） |

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | U1: `addTask --pr` 経路の添付伝播テスト追加 | 局所修正（テスト追加） | なし | `src/__tests__/addTask.test.ts` | 非空 attachments ケースのテストが `npm test` で成功し、attachments コピー（`.takt/tasks/<slug>/attachments/image-1.png` の実在）と order.md の `[Image #1]` / `## 添付画像` 追記を検証できる。`npm run build`、`npm run lint` の成功は fix ステップの品質ゲートで確認 |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|----------|--------------|--------------------------|-----------------------------|----------|
| U1 | `order.md` 品質要件（単体テスト追加）、テストポリシー（unit レイヤーで最小レイヤーの検証、`addTask.test.ts` は既存 unit テスト）、契約置換ポリシー（対象外契約の保持） | 採用: `addTask.test.ts` に非空 attachments ケースのテストを1件追加し、実経路（`addTask` → `saveTaskFile` → `prepareTaskSpecDirectory` → `promoteTaskAttachments`）を通す。採否: 配線の作り直し・新規外部契約の追加・pipeline 経路の再変更は、裁定の修正境界外（既に `pipelineExecution.test.ts:1554` で検証済み）のため不採用 | 検証: 追加テストを `npm test`（unit gate）で実行し、attachments コピーと order.md 追記をファイルシステム成果物と `toContain` で確認。外部環境に依存しない決定的なテスト。環境要因による実証不能はなし | 本番コードを変更せずテスト追加のみで `order.md` 品質要件を充足する。既存の配線（`add/index.ts:214-218`）と pipeline 経路を保持し、裁定の修正境界に適合 |

## 再計画事項
- なし（修正計画は確定。Content-Type ヘッダ検証（PR-IMG-8）は裁定対象外の観察であり、本ステップの探索権限外のため修正対象に含めない）