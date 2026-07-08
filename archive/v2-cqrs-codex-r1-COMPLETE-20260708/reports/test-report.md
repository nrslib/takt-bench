# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| WT-001 | `src/types.ts` の公開契約に準拠し、`src/index.ts` から公開 API を import できる | 公開 API / 実行時 import | `tests/domain.test.ts`, `tests/event-store.test.ts`, `tests/command-handler.test.ts`, `tests/projection.test.ts` | 既存 | |
| WT-002 | CQRS/ES の主要経路が動作する | `decide` / `evolve` / `CommandHandler` / `InMemoryEventStore` / `StockProjection` | `tests/domain.test.ts`, `tests/event-store.test.ts`, `tests/command-handler.test.ts`, `tests/projection.test.ts` | 既存 | |
| WT-003 | `tests/` 配下をベースと一致させ、F-0012 を再発させない | リポジトリ差分 / レビュー境界 | `diff -qr /Users/nrs/work/git/takt-bench/subject/tests tests` | 既存 | |
| WT-004 | `tests/event-store.test.ts` の import 整形差分を解消する | ファイル差分 | `tests/event-store.test.ts` | 既存 | |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| `tests/` 配下への追加・変更 | F-0012 の再発 | `diff -qr /Users/nrs/work/git/takt-bench/subject/tests tests` | |
| `tests/event-store.test.ts` の import 整形差分残存 | ベースとの差分が残ったまま通過する | `diff -qr /Users/nrs/work/git/takt-bench/subject/tests tests` | |
| 公開 API import 破損 | `src/index.ts` から既存テストが import できない | `npm test` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| コマンド処理からイベント保存 | `CommandHandler` | `InMemoryEventStore` | replay、decide、append の接続 | `tests/command-handler.test.ts`, `tests/event-store.test.ts` | |
| 保存イベントから読み取りモデル更新 | `InMemoryEventStore` / `DomainEvent` | `StockProjection` | イベントのみから在庫状態を構築 | `tests/projection.test.ts` | |
| F-0012 差分解消 | `tests/event-store.test.ts` の import 修正 | 差分確認 / レビュー | `tests/` 禁止契約に反する差分を残さない | `diff -qr /Users/nrs/work/git/takt-bench/subject/tests tests` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| `tests/` 配下に新規テストを追加する | リポジトリ差分確認 | `diff -qr /Users/nrs/work/git/takt-bench/subject/tests tests` | |
| 既存テストを編集して F-0012 を再発させる | ベースとの差分確認 | `diff -qr /Users/nrs/work/git/takt-bench/subject/tests tests` | |
| プロダクションコードを write_tests step で変更する | `git status --short` / テスト実行 | なし | 今回はプロダクションコードを変更していないため、差分確認で担保 |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| なし | なし | 0 | 新規テストは作成していない。F-0012 解消のため、既存 `tests/event-store.test.ts` の import をベースと一致させた |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| なし | なし | なし |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 51 | `npm test` で 4 files / 51 tests passed |
| Fail / Import Error（想定内） | 0 | |
| Error（要対応） | 0 | |

## 備考（判断がある場合のみ）
- `npm run typecheck` は成功。
- `diff -qr /Users/nrs/work/git/takt-bench/subject/tests tests` は無出力になり、F-0012 の残存差分は解消済み。
- `git status --short` は出力なし。