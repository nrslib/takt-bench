# takt-bench

TAKT のプロバイダ/モデルの組み合わせをベンチマークするハーネス。

同一の題材タスク（`subject/` の cron パーサー実装）を、`matrix.yaml` に定義した
プロバイダ/モデルの組み合わせ（combo）ごとに独立したディレクトリで TAKT に解かせ、
客観メトリクス（テスト合否・型チェック・所要時間・トークン消費・差分規模）で比較する。

## 仕組み

- 変動点は各 combo ディレクトリの `.takt/config.yaml` にある `provider_routing.personas` のみ。
  ワークフロー（`template/takt-project/workflows/bench.yaml`）には provider / model を書かない
  （ステップ直書きは provider_routing より優先されて差し替え不能になるため）。
- ワークフローは implement → review → (fix ↔ review) → COMPLETE。
  ペルソナは `bench-coder` と `bench-reviewer` の 2 つで、combo はこの 2 役への
  プロバイダ/モデルの割り当てを変える。
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
| テスト | combo ディレクトリで `vitest run` | 40 件中何件成功したか（成果の客観判定） |
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
- テスト（`subject/src/cron.test.ts`)を変更したら `npm run verify-tests` で
  参照実装（`reference/cron-reference.ts`）に対して全テストが通ることを必ず確認する。
