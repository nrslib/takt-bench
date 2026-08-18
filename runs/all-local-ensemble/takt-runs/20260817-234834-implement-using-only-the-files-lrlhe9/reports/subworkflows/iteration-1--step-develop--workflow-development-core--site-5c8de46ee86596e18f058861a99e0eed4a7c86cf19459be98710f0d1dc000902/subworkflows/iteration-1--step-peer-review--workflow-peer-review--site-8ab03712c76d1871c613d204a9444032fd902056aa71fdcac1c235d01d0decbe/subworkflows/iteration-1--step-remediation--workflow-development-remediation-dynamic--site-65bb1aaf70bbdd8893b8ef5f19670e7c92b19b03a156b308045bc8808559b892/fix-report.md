# 修正レポート
## サマリー
修正計画の唯一の修正単位 U1（`addTask --pr` 経路の添付伝播テスト追加）を実装した。`src/__tests__/addTask.test.ts` に非空 attachments ケースのテストを1件追加し、`downloadPrImages` が実在の一時 `.png` ファイルを返すケースで、attachments が `.takt/tasks/<slug>/attachments/` へコピーされ、`order.md` に `[Image #1]` 参照と `## 添付画像` が追記されることを検証した。本番コードは変更していない。全品質ゲート（build、lint、unit、light IT、mock E2E）が成功した。

## 修正単位
| 修正単位 | 対象 finding | 守る契約 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| U1: `addTask --pr` 経路の添付伝播テスト追加 | TEST-001 | `order.md` 品質要件「新規ロジックには単体テストを追加する」、`takt add --pr` 経路の添付保存・配置・order.md 追記の観測可能な契約（担当箇所: `src/features/tasks/add/index.ts` の `addTask --pr` 経路） | 局所修正（テスト追加のみ）。`src/__tests__/addTask.test.ts` に非空 attachments ケースのテストを追加。本番コード・pipeline 経路・旧経路の変更・削除はなし | 完了 |

## 不変条件台帳の引き継ぎ
引き継ぎ元: 先行 remediation なし（同一 remediation ディレクトリ内に先行 `fix-verification.md` が0件。`review-resolution.md` も白紙開始を明示しているため台帳は白紙で開始）

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| U1: `addTask --pr` 経路の添付伝播テスト追加 | `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | なし | なし | なし | なし | 未判定 | 0 | 未確認 | 該当なし | 完全 |

検証回数なし・累積 `incomplete` 回数 `0`・別経路での再発「未確認」の初期値は、引き継ぎ情報が完全で fix-plan に引き継ぎ行がない不変条件だけへ適用する。引き継ぎ元がないことを初期値の根拠にできるのは「先行 remediation なし」と記録され、同一 remediation 内にも先行 fix-verification がない場合だけとする。本行は fix-plan の「新規・現在の計画行」に基づく初回行であり、引き継ぎ行は存在しないため初期値を適用した。引き継ぎ行は全13項目を無変更で転記する（該当する引き継ぎ行はなし）。

計画が既存 family へ合流した finding の経路を追加している場合も、台帳行は変更しない。その経路への修正と証拠は同じ修正単位の「完了義務」に記録する（該当なし）。

## 引き継ぎ不足
- なし

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| U1: `addTask --pr` 経路の添付伝播テスト追加 | U1-OBL-1 | 既存契約保存 | TEST-001 | 不変条件: `takt add --pr <number>` 実行時に抽出した画像が `.takt/tasks/<slug>/attachments/` へコピーされ、`order.md` に `[Image #N]` 参照と `## 添付画像` が追記される。対象経路: `addTask(cwd, task, { prNumber })`（`add/index.ts:164`）→ `provider.fetchPrReviewComments`（line 186）→ `downloadPrImages(prReview, cwd)`（line 199）→ `saveTaskFile(cwd, taskContent, { ...settings, prNumber, attachments })`（line 214）→ `saveTaskFile`（line 40）が非空時に `attachmentPrepareTaskSpec` を生成 → `prepareTaskSpecDirectory`（`attachments.ts:266`）→ `buildTaskOrderContent`（`attachments.ts:35`）＋ `promoteTaskAttachments`（`attachments.ts:88`）→ `saveEnqueuedTaskFile`（`enqueuedTaskFile.ts:41`）が order.md / tasks.yaml を書込 | 反例: `promoteTaskAttachments` のコピー先が存在しない、または `buildTaskOrderContent` が追記しない場合に、追加テストの assertion（`attachments/image-1.png` の実在、order.md の `[Image #1]` / `## 添付画像` の `toContain`）が失敗する | 修正前: `addTask.test.ts:9` のモックが常に空 attachments を返すため `add/index.ts:218` の `attachments.length > 0` 分岐がテストで踏まれず、添付伝播が単体テスト未カバーだった | 変更箇所: `src/__tests__/addTask.test.ts` に非空 attachments ケースのテストを追加（`should save and place PR images as attachments with order.md references`）。実在の一時 `.png` ファイル（PNG magic bytes）を `downloadPrImages` の戻り値として注入し、実経路を通して保存・配置・order.md 追記を検証。本番コードは変更なし | 証拠: `npm test -- src/__tests__/addTask.test.ts` が 18 tests passed。追加テストは attachments コピー（`.takt/tasks/<slug>/attachments/image-1.png` の実在）と order.md の `[Image #1]` / `## 添付画像` 追記を検証 | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| TEST-001 | `downloadPrImages` が非空 attachments（実在の一時画像ファイル）を返すケースで、(1) `saveTaskFile` へ attachments が渡る、(2) `.takt/tasks/<slug>/attachments/` へ画像がコピーされる、(3) `order.md` に `[Image #1]` 参照と `## 添付画像` が追記されることを検証する | 追加テスト `should save and place PR images as attachments with order.md references` が `npm test -- src/__tests__/addTask.test.ts` で成功（18 tests passed）。(2) は `fs.existsSync(path.join(taskDir, 'attachments', 'image-1.png'))` で、(3) は `orderContent` の `toContain('[Image #1]')` と `toContain('## 添付画像')` で検証。(1) は実経路（`addTask` → `saveTaskFile` → `prepareTaskSpecDirectory` → `promoteTaskAttachments`）を通すことで間接的に検証 | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| （該当なし） | — | — | — | — | — |

## 確立済み不変条件への差分走査
| family ID | 不変条件の名前 | 担当箇所 | 状態 | 証拠 | 理由・後続対応 |
|-----------|------------------|----------|------|------|----------------|
| `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | 維持 | 記録済み有界 graph（`downloadPrImages` → `saveTaskFile` → `prepareTaskSpecDirectory` → `promoteTaskAttachments` → `buildTaskOrderContent`）へ今回の差分（テスト追加のみ）を照合した。本番コードは変更しておらず、配線・pipeline 経路・旧経路は無変更。追加テストはこの graph の全経路を通して不変条件の成立を検証する | なし |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` |
| lint | 成功 | `npm run lint` |
| テスト（対象ファイル） | 成功 | `npm test -- src/__tests__/addTask.test.ts`（18 tests passed、ファイル全体） |
| テスト（unit gate） | 成功 | `npm test`（86 files / 849 tests passed） |
| テスト（light IT） | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it`（129 files / 1796 tests passed） |
| テスト（mock E2E） | 成功 | `npm run test:e2e:mock`（16 passed / 1 skipped、48 passed / 13 skipped） |

## 未完了義務
- なし

## 編集後セルフスキャン
追加テストは既存の helper（`createMockPrReview`、`loadTasks`、`readOrderContent`）と既存 import（`fs`、`path`、`tmpdir`）のみを使用し、新規 import・未使用コード・依存方向の変更はない。走査範囲: 今回の編集差分（`src/__tests__/addTask.test.ts` のテスト追加1件）。問題なし。