# コーディングレビュー

## 結果: APPROVE

## サマリー
累積差分を再走査し、前回の他レビューで指摘された公開 `initialState` の可変共有状態と `src/index.ts` への責務集中は解消済みです。README と `src/types.ts` の公開契約に対するブロッキング指摘はありません。

## 契約入口チェック
| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| 公開 API re-export | `src/index.ts` から公開 API を re-export し、公開シグネチャを維持 | `src/index.ts:6`, `src/index.ts:7`, `src/index.ts:8`, `src/index.ts:9`, `src/index.ts:10` | `tests/domain.test.ts:3`, `tests/event-store.test.ts:2`, `tests/command-handler.test.ts:2`, `tests/projection.test.ts:2` | ✅ | なし |
| `initialState` | 未作成の商品を表す初期状態。公開共有状態の汚染を避ける | `src/domain.ts:13`, `src/domain.ts:18`, `src/command-handler.ts:14` | `tests/domain.test.ts:29` | ✅ | freeze 専用テストは未追加だが、テスト変更は禁止されており、実コードでネスト込み freeze と内部 factory 利用を確認 |
| `evolve` / `decide` | ドメインロジックは純粋で、ストアやプロジェクションに依存しない | `src/domain.ts:46`, `src/domain.ts:86` | `tests/domain.test.ts:35`, `tests/domain.test.ts:83`, `tests/domain.test.ts:105`, `tests/domain.test.ts:127` | ✅ | なし |
| `InMemoryEventStore` | `EventStore` ポート実装。version と楽観的並行性制御を満たす | `src/event-store.ts:4`, `src/event-store.ts:7`, `src/event-store.ts:12` | `tests/event-store.test.ts:7`, `tests/event-store.test.ts:31`, `tests/event-store.test.ts:38` | ✅ | なし |
| `CommandHandler` | `EventStore` ポートにのみ依存し、`load → replay → decide → append` を行う | `src/command-handler.ts:1`, `src/command-handler.ts:11`, `src/command-handler.ts:16` | `tests/command-handler.test.ts:15`, `tests/command-handler.test.ts:23`, `tests/command-handler.test.ts:41` | ✅ | なし |
| `StockProjection` | 書き込みモデルを参照せず、イベントのみから読み取りモデルを構築 | `src/projection.ts:1`, `src/projection.ts:7`, `src/projection.ts:35`, `src/projection.ts:40` | `tests/projection.test.ts:17`, `tests/projection.test.ts:55`, `tests/projection.test.ts:64` | ✅ | なし |

## 非finding化した懸念
| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 新規ソースが `git diff --name-only` に出ない | `src/domain.ts`, `src/event-store.ts`, `src/command-handler.ts`, `src/projection.ts` | no_issue_after_verification | `git status --short --untracked-files=all` で未追跡の実装差分として確認し、各ファイルを直接読んでレビュー対象に含めた |
| `StockShipped` の予約数量欠落時 `?? 0` | `src/domain.ts:75`, `src/projection.ts:21`, `src/projection.ts:27` | no_issue_after_verification | README は `evolve` が throw しないこと、`StockShipped` が数量を持たないことを明記しているため、イベント履歴から予約数量を得る実装として許容 |
| 空ストリームや未作成 projection の初期化 `??` | `src/event-store.ts:8`, `src/event-store.ts:13`, `src/projection.ts:59` | no_issue_after_verification | README の空ストリーム `{ events: [], version: 0 }` と、イベント適用時の読み取りモデル初期化に対応するため |

## 今回の指摘（new）
| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | 修正案 |
|---|------------|------------|--------|------|------|------|--------|
| なし |  |  |  |  |  |  |  |

## 継続指摘（persists）
| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| なし |  |  |  |  |  |  |

## 解消済み（resolved）
| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| ARCH-NEW-src-index-L17 / AI-NEW-src-index-L17 | 公開 `initialState` をネスト込みで runtime freeze し、内部 replay には毎回新しい初期状態を使う | `src/domain.ts:13`, `src/domain.ts:18`, `src/command-handler.ts:14` |
| ARCH-NEW-src-index-L50 | `src/index.ts` への責務集中を解消し、domain / store / handler / projection に分割する | `src/index.ts:6`, `src/domain.ts:46`, `src/event-store.ts:4`, `src/command-handler.ts:4`, `src/projection.ts:3` |

## 再開指摘（reopened）
| # | finding_id | family_tag | 解消根拠（前回） | 再発根拠 | 問題 | 修正案 |
|---|------------|------------|----------------|---------|------|--------|
| なし |  |  |  |  |  |  |

## 検証証跡
- 差分確認: `git status --short --untracked-files=all` で `src/index.ts` 変更と `src/domain.ts`、`src/event-store.ts`、`src/command-handler.ts`、`src/projection.ts` の追加を確認。`git diff -- src/types.ts tests README.md` は差分なし。
- ビルド: `npm run typecheck` 成功。
- テスト: `npm test` 成功。4 test files / 51 tests passed。
- 静的確認: `rg` で `any`、TODO/FIXME、空 `catch`、未実装スタブ、`@ts-ignore`、`eslint-disable` の混入なしを確認。`git diff --check` は問題なし。

## 再走査証跡（2回目以降のレビューで必須）
| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| レビューポリシー / 原則 | `src/domain.ts:46`, `src/domain.ts:86`, `src/event-store.ts:4`, `src/command-handler.ts:4`, `src/projection.ts:3` |
| レビューポリシー / スコープ判定 | `git status --short --untracked-files=all` で追跡変更と未追跡新規ソースを確認 |
| レビューポリシー / REJECT 判定基準 | `src/index.ts:1`、`src/domain.ts:1`、`src/event-store.ts:1`、`src/command-handler.ts:1`、`src/projection.ts:1` から各ファイル末尾まで確認し、該当なし |
| レビューポリシー / 振る舞い証跡の判定 | `npm test` で 51 tests passed |
| レビューポリシー / ファクトチェック | `README.md`, `src/types.ts`, `src/index.ts`, `src/domain.ts`, `src/event-store.ts`, `src/command-handler.ts`, `src/projection.ts`, `tests/` を再読 |
| レビューポリシー / 契約追加・変更の全入口検証 | `src/index.ts:6`, `src/domain.ts:18`, `src/domain.ts:46`, `src/domain.ts:86`, `src/event-store.ts:7`, `src/command-handler.ts:11`, `src/projection.ts:7` |
| レビューポリシー / 副作用と状態遷移の確認 | `src/event-store.ts:12`, `src/event-store.ts:18`, `src/command-handler.ts:13`, `src/command-handler.ts:16`, `src/projection.ts:7` |
| レビューポリシー / 前回指摘の追跡 | `reports/architect-review.md`, `reports/ai-antipattern-review.md`, `reports/coding-review.md`, `src/domain.ts:18`, `src/command-handler.ts:14`, `src/index.ts:6` |
| コーディングポリシー / 原則 | `src/domain.ts:4`, `src/domain.ts:46`, `src/event-store.ts:4`, `src/command-handler.ts:4`, `src/projection.ts:3` |
| コーディングポリシー / フォールバック・デフォルト引数の禁止 | `src/domain.ts:75`, `src/event-store.ts:8`, `src/event-store.ts:13`, `src/projection.ts:21`, `src/projection.ts:27`, `src/projection.ts:59` は仕様上の初期化・非throw経路として確認 |
| コーディングポリシー / 解決責務の一元化 | 該当なし |
| コーディングポリシー / フェーズ分離 | `src/command-handler.ts:11`, `src/command-handler.ts:13`, `src/command-handler.ts:14`, `src/command-handler.ts:15`, `src/command-handler.ts:16` |
| コーディングポリシー / 抽象化 | `src/domain.ts:28`, `src/domain.ts:34`, `src/domain.ts:40`; 過剰抽象化なし |
| アーキテクチャ知識 / 構造・設計 | `src/index.ts:6`, `src/domain.ts:1`, `src/event-store.ts:1`, `src/command-handler.ts:1`, `src/projection.ts:1` |
| アーキテクチャ知識 / パブリック API の公開範囲 | `src/index.ts:6`, `src/index.ts:7`, `src/index.ts:8`, `src/index.ts:9`, `src/index.ts:10` |
| アーキテクチャ知識 / 責務の分離 | `src/domain.ts:46`, `src/event-store.ts:4`, `src/command-handler.ts:4`, `src/projection.ts:3` |
| アーキテクチャ知識 / 公開状態の不変性 | `src/domain.ts:13`, `src/domain.ts:18`, `src/command-handler.ts:14` |
| アーキテクチャ要件 / ドメインの純粋性 | `src/domain.ts:46`, `src/domain.ts:86` |
| アーキテクチャ要件 / ポートへの依存 | `src/command-handler.ts:1`, `src/command-handler.ts:5` |
| アーキテクチャ要件 / プロジェクションの独立性 | `src/projection.ts:1`, `src/projection.ts:7` |
| アーキテクチャ要件 / モジュール分割 | `src/index.ts:6`, `src/domain.ts:1`, `src/event-store.ts:1`, `src/command-handler.ts:1`, `src/projection.ts:1` |

## REJECT判定条件
- `new`、`persists`、`reopened` は 0 件です。