# 修正レポート
## サマリー
修正計画 `PRIMG-CAPABILITY-NORMALIZATION` を全3工程（境界変更・利用側移行・旧経路削除）で完了した。`src/infra/git/index.ts` に共通解決関数 `resolvePrImages` を追加し、3 consumer（`routing-inputs.ts` / `steps.ts` / `add/index.ts`）の重複していた optional capability 判定と identity fallback 生成を一元化した。旧 fallback 生成コードは全 consumer から削除済み。ビルド・lint・fast unit gate・light IT・mock E2E が全て成功し、対象テストファイルも全パスした。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `PRIMG-CAPABILITY-NORMALIZATION` | `AI-NEW-src-app-cli-routing-inputs-L67`, `ADJ-FOLLOWUP-src-features-tasks-add-L198` | `GitProvider` インターフェース | 境界変更: `src/infra/git/index.ts` に `resolvePrImages` と `ResolvedPrImages` を追加。利用側移行: `src/app/cli/routing-inputs.ts`, `src/features/pipeline/steps.ts`, `src/features/tasks/add/index.ts` の三項演算子を `resolvePrImages` 呼び出しに置換。旧経路削除: 上記3ファイルの fallback 生成コードを完全削除 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-1 | 振る舞い修正 | `AI-NEW-src-app-cli-routing-inputs-L67`, `ADJ-FOLLOWUP-src-features-tasks-add-L198` | 対応プロバイダーでは `resolvePrImages` が定義済み resolver を実行し、その結果（画像リストと cleanup 関数）を返す | `git-factory.test.ts` の新規テスト: resolver の呼び出し引数 `(prReview, cwd)` と返り値の型を検証 | 判定と fallback 生成が consumer で重複し、共通所有者が不在 | `src/infra/git/index.ts` に `resolvePrImages` を実装 | `npm test -- src/__tests__/git-factory.test.ts` がパス | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-2 | 振る舞い修正 | 同上 | 非対応プロバイダーでは `resolvePrImages` がエラーにならず `attachments: []` と `cleanup: () => undefined` を返す | `git-factory.test.ts` の新規テスト: `attachments` が空配列、`cleanup()` が `undefined` を返すことを検証 | 同上 | 同上 | 同上 | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-3 | 利用側移行 | 同上 | 3 consumer が `resolvePrImages` を呼び出し、重複三項演算子が存在しない | grep `resolvePrReviewImageAttachments\s*\?` で consumer 側の判定が残存しないこと | 3 consumer に重複判定が存在 | `routing-inputs.ts:67`, `steps.ts:230`, `add/index.ts:198` を `resolvePrImages` 呼び出しに置換 | grep で判定は `types.ts:159` のインターフェース定義のみに残存。`cli-routing-pr-resolve` / `addTask` / `pipelineExecution` / `git-cwd-propagation` が全パス | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-4 | 旧経路削除 | 同上 | 旧 fallback 生成コードが完全に削除されている | grep で consumer 内の fallback 生成が残存しないこと | 3 consumer に fallback 生成が存在 | 置換と同時に削除 | grep で残存なし | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-5 | 既存契約保存 | 同上 | `resolvePrInput` / `resolveTaskContent` / `addTask` の戻り値・引数・cleanup 呼び出し順序が不変 | 既存テストの全パス | 既存契約は変更前の状態 | 戻り値・引数・cleanup 呼び出しを維持 | 対象テストファイル全パス（115 + 23 tests） | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `AI-NEW-src-app-cli-routing-inputs-L67` | optional capability 判定と identity fallback 生成が一元化され、3 consumer が移行済み | `resolvePrImages` の実装と 3 consumer の置換。`git-factory.test.ts` の新規テストがパス | 完了 |
| `ADJ-FOLLOWUP-src-features-tasks-add-L198` | 上記と同じ不変条件が `add/index.ts` 経路でも充足 | `add/index.ts:198` が `resolvePrImages` 呼び出しに置換され、`addTask.test.ts` が全パス | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| 該当なし | - | - | - | - | - |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` |
| lint | 成功 | `npm run lint` |
| fast unit gate | 成功 | `npm test`（4 shard 全パス） |
| light IT | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it`（158 files / 2357 tests） |
| mock E2E | 成功 | `npm run test:e2e:mock`（18 passed / 1 skipped） |
| 対象テストファイル | 成功 | `git-factory.test.ts`, `cli-routing-pr-resolve.test.ts`, `addTask.test.ts`, `pipelineExecution.test.ts`, `git-cwd-propagation.test.ts` をファイル単位で実行し全パス |

## 未完了義務
- なし