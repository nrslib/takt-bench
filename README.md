# takt-bench

TAKT のプロバイダ/モデルの組み合わせをベンチマークするハーネス。

同一の題材タスク（`subject/` のイベントソーシング在庫管理ライブラリ実装）を、`matrix.yaml` に定義した
プロバイダ/モデルの組み合わせ（combo）ごとに独立したディレクトリで TAKT に解かせ、
客観メトリクス（テスト合否・型チェック・所要時間・トークン消費・差分規模）で比較する。

## 仕組み

- 変動点は各 combo ディレクトリの `.takt/config.yaml` にある `provider_routing.tags` のみ。
  ステップに coding（implement / fix）と review（レビュー並列 + supervise）のタグを付けてあり、
  combo は coding タグ = コーダーだけを差し替える。loop monitor の judge は
  provider_routing の対象外（発火元ステップのプロバイダを継承）のため、workflow 側で codex に固定。
  ワークフロー（`template/takt-project/workflows/bench.yaml`）には provider / model を書かない
  （ステップ直書きは provider_routing より優先されて差し替え不能になるため）。
- ワークフローは implement → reviewers（arch + ai-antipattern + coding + supervise の 4 並列（takt-default の peer-review から pure-review を除いた構成）） ⇄ fix → COMPLETE。
  レビュアーは TAKT builtin のファセット（architecture-reviewer / ai-antipattern-reviewer /
  coding-reviewer / supervisor、各ポリシー・ナレッジ・出力契約込み）を 3 層解決でそのまま使う。
  reviewers ⇄ fix が 3 サイクル続くと loop monitor（supervisor）が介入し、
  非生産的なら ABORT する。
- coding タグだけを combo ごとに差し替え、review タグ（レビュアー 4 本）と loop monitor judge は
  全 combo で codex に固定する（審査条件を一定にしてコーダーだけを比較するため）。
- usage-events の制約: 並列レビューのトークンは親ステップ `reviewers` 名義で
  まとめて記録される（サブステップ個別には分かれない）。ラベルのプロバイダは
  engine フォールバック値になるため、taktrc の provider をレビュアーと同じ
  codex に固定してラベルと実態を一致させている。
- `TAKT_CONFIG_DIR` を `runs/taktrc/` に向けて実行するため、`~/.takt` の個人設定は
  実験に影響しない。usage-events（トークン記録）はここで有効化している。

## 使い方

```bash
npm install

# 1. テストスイート自体の妥当性検証（参照実装で全テストが通るか）
npm run verify-tests

# 2. ハーネス疎通確認（mock プロバイダ、API 消費なし）
node scripts/generate.ts --smoke --force
node scripts/run.ts --smoke
node scripts/collect.ts --smoke

# 3. 本番ベンチマーク
node scripts/generate.ts            # runs/<combo>-r<N>/ を生成
node scripts/run.ts                 # 逐次実行（--parallel N で並列）
node scripts/collect.ts             # results/summary.{md,json} を出力
```

`--filter <substr>` で combo を絞り込める。再生成は `--force`。

## メトリクスの見方

| 指標 | 出所 | 意味 |
|------|------|------|
| テスト | combo ディレクトリで `vitest run` | 51 件中何件成功したか（成果の客観判定） |
| 型 | `tsc --noEmit` | 型チェック合否 |
| 所要時間 | `meta.run.json` | takt 実行のウォールクロック |
| トークン | `.takt/runs/*/logs/*-usage-events.jsonl` | ステップ×プロバイダ×モデル別の消費量 |
| 差分 | `git diff HEAD --shortstat` | 初期コミットからの変更規模 |

レビュー品質の定性比較は `runs/<combo>/.takt/runs/*/reports/review.md` を直接読む。

## 注意

- LLM は非決定なので 1 回の結果で結論を出さない。`matrix.yaml` の `repetitions` を
  3 以上にして分散を見る。
- 同一プロバイダを使う combo を並列実行すると rate limit で時間計測が歪む。
  時間を比較したいときは逐次（デフォルト）で流す。
- トークン→金額の換算は TAKT は行わない。必要なら集計側で単価表を持つ。
- テスト（`subject/tests/`）を変更したら `npm run verify-tests` で
  参照実装（`reference/src/`）に対して全テストが通ることを必ず確認する。

## レビュアー監査（review-audit）

レビュアーモデルの品質を、レビュー本人の自己申告ではなく外部監査で採点する。

```bash
npm run audit                    # 全 combo を監査（codex + 機械検証）
npm run audit -- --filter gemma  # combo 絞り込み
npm run audit -- --no-llm        # 機械検証のみ（API 消費なし）
```

2 層で検証し、`results/review-audit.{md,json}` にレポートする。

- 機械検証（決定的・無料）: レビュー指摘が引用する `file:line` の実在チェック（存在しないファイルへの言及 = 捏造）、出力契約テンプレート例示行の丸写し検出。全ラウンドのレポート（`.md.<timestamp>` 含む）が対象
- codex 監査: `audit/known-traps.md`（既知の罠カタログ）と最終コードに照らして、罠の検出/見逃し、捏造指摘、スコープ外指摘（変更禁止ファイルへの修正要求）、思考漏れ、判定と実態の整合性を採点

`audit/known-traps.md` は combo ディレクトリにコピーされない（レビュアーに見えるとカンニングになるため subject/ に置かない）。テストや仕様を変えて罠が変わったら、このカタログも更新すること。
