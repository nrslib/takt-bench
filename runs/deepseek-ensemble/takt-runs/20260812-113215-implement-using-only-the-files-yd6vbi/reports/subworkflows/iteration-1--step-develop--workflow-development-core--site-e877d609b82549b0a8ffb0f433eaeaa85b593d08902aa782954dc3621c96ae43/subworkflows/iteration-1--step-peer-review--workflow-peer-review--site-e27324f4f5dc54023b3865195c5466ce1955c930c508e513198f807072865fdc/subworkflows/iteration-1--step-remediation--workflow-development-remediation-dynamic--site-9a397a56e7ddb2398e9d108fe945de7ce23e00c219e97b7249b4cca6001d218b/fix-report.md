# 修正レポート
## サマリー
裁定済み experimental finding 2件（`AI-NEW-routing-L283` と `FU-PRIMG-TERMINAL-EXIT-TEST`）の修正計画に基づき、両修正単位を実装・検証しました。

- **F-INTERACTIVE-RESULT-TOTALITY**: `src/app/cli/routing.ts` の `result!` 非null assertion（旧283行）を除去し、`switch (selectedMode)` の `default:` に local `assertNever` を導入。未処理モード追加時にコンパイルエラー（TS2345）で検出できる網羅性を回復しました。静的型チェックにより不変条件を確認済み。
- **F-PR-IMAGE-LIFECYCLE**: `src/__tests__/cli-routing-pr-resolve.test.ts` の PR head branch 欠落時の exit テストに cleanup モックの呼び出し検証を追加。cleanup が `process.exit(1)` より前に呼ばれることを決定的に観測します。

全品質ゲート（build / lint / test / test:it / test:e2e:mock / 対象テストファイル）を通過しました。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `F-INTERACTIVE-RESULT-TOTALITY` | `AI-NEW-routing-L283` | `INTERACTIVE_MODES`（closed union） | 局所修正 `src/app/cli/routing.ts`。`result!` 除去、`default:` に `assertNever` 導入で網羅性をコンパイル時に検出 | 完了 |
| `F-PR-IMAGE-LIFECYCLE` | `FU-PRIMG-TERMINAL-EXIT-TEST` | PR 添付ファイルライフサイクル管理 | 局所修正 `src/__tests__/cli-routing-pr-resolve.test.ts`。cleanup モックが exit より前に呼ばれることを検証 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `F-INTERACTIVE-RESULT-TOTALITY` | `O-TOTALITY-1` | 振る舞い修正 | `AI-NEW-routing-L283` | 全ての `InteractiveMode` が対応 handler を持ち、必ず `InteractiveModeResult` を生成する。経路: `selectInteractiveMode` → `switch` → `dispatchConversationAction` | 未処理モードを追加すると `default: assertNever(selectedMode)` が TS2345 を発生させる。`result!` が残っていると型安全性を放棄したままビルドが通る | `result!` による非null assertion で handler 漏れをコンパイル時に検出不可 | `result!` を `const confirmedResult = result;` に変更し、`default:` に `assertNever`（`value: never`）を追加。既存 `workflowTerminalStatus.ts` / `interpretation-case-model.ts` と同型の local helper | `npx tsc --noEmit -p tsconfig.json` 成功。probe（未処理モード `'c'` 追加）で `error TS2345: Argument of type '"c"' is not assignable to parameter of type 'never'` を確認 | 完了 |
| `F-PR-IMAGE-LIFECYCLE` | `O-LIFECYCLE-1` | 既存契約保存（証拠追加） | `FU-PRIMG-TERMINAL-EXIT-TEST` | `process.exit(1)` を伴う異常終了時も生成された添付ファイルの cleanup が確実に実行される。経路: `resolvePrInput` → `prAttachmentsCleanup` → `process.exit(1)` | PR head branch 欠落時に cleanup が exit より前に呼ばれないとテストが失敗する。`prCleanup.mock.invocationCallOrder[0]` が `mockExit.mock.invocationCallOrder[0]` より前でなければ失敗 | 既存テストは cleanup 呼び出しを検証しておらず偽陽性の余地があった | `mockResolvePrReviewImageAttachments` に `prCleanup` モックを設定し、呼び出し有無と順序（cleanup が exit より前）を assert | `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts` → 31 passed | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `AI-NEW-routing-L283` | 非nullの選択モードは assertion なしで必ず `InteractiveModeResult` を生成する。モード追加時の handler 漏れをコンパイル時に検出できる | `result!` を除去し `assertNever` を導入。`npx tsc --noEmit -p tsconfig.json` 成功。未処理モード追加の probe で TS2345 を確認 | 完了 |
| `FU-PRIMG-TERMINAL-EXIT-TEST` | PR head branch 欠落時に cleanup が exit より前に呼ばれることをテストで観測する | `prCleanup` モックの呼び出しと `invocationCallOrder` による順序検証を追加し、`npm test -- src/__tests__/cli-routing-pr-resolve.test.ts` が 31 passed | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| 該当なし | — | — | — | — | — |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` |
| lint | 成功 | `npm run lint` |
| 単体テスト | 成功 | `npm test`（95 files / 1499, 1864, 1519 tests 全シャード） |
| 対象テストファイル | 成功 | `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts` → 31 passed |
| 統合テスト | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it` → 158 files / 2357 tests passed |
| mock E2E | 成功 | `npm run test:e2e:mock` → 18 files / 55 passed, 13 skipped, 30 todo |

## 未完了義務
- なし