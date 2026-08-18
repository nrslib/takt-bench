# takt-bench

ローカルLLM編成ベンチマーク。
[TAKT](https://github.com/nrslib/takt) のモデル編成を差し替えながら同一の発注書を実装させ、成果物のコード品質を採点する。
記事「ローカルLLMモデルがフラグシップAIを凌駕した日」の実験一式。

## 題材

約9万行の TypeScript CLI である TAKT 本体への機能追加。
PR コメント内の画像をダウンロードして task attachments に配置する(`order/order.md`、52行)。

## 採点

`eval/PROTOCOL.md` を参照。
検査表24項目(AP/AR/F/T)を3値で判定し、独立に3回採点して平均する。
採点者は GPT-5.6-Sol (reasoning high)。
得点はテスト2項目を除く22項目を正しさ3・堅牢性2・規律1・設計1で重み付けした100点満点換算。

```bash
# 採点(成果物リポジトリを read-only で開いて3回)
eval/scripts/judge.sh <成果物リポジトリ> eval/rubrics/pr-image-attachments.md eval/results/pr-image-attachments/<条件名>

# 集計・比較
node eval/scripts/aggregate.mjs eval/rubrics/pr-image-attachments.md \
  sol=eval/results/pr-image-attachments/sol-ensemble \
  ds=eval/results/pr-image-attachments/deepseek-ensemble
```

## 編成と結果

編成はワークフローではなく `ensembles/<名前>/runtime.yaml` で差し替える。

| 条件 | 実装 | レビュー | 判断まわり | 得点 |
|---|---|---|---|---|
| sol-ensemble | Sol | Sol | Sol | 74.3 |
| deepseek-ensemble | DeepSeek-V4-Flash | Gemma4:31B | Sol + Luna(検証) + Gemma(修正計画) | 70.3 |
| luna-ensemble | Luna | Luna | Luna(計画とマージ判定は Sol) | 67.6 |
| sol-single | Sol 単発 | なし | なし | 62.6 |
| all-local-ensemble | DeepSeek-V4-Flash | Gemma4:31B | DeepSeek-V4-Flash | 49.1 |
| nemotron-ensemble | nemotron-3-super | Gemma4:31B | Gemma4:31B(計画は Luna) | 18.5 |
| team-leader-ensemble | nemotron-3-super(リーダーは Luna) | Gemma4:31B | Luna | 測定中 |

judge ログは `eval/results/pr-image-attachments/<条件>-r{1..3}.log`。

## 実走証跡

`runs/<条件>/` に走行の証跡を置く。

- `taktrc/` : 実走時に TAKT_CONFIG_DIR として使った素の config(guards 等を含む。`ensembles/` は同内容を記事準拠のプロファイル名で書き直したもの)
- `takt-runs/` : 実行 worktree の `.takt/runs` のコピー(レポート、ログ、usage-events。トークン集計の根拠)
- `ARTIFACT.md` : 実行 worktree のパスと判定対象 HEAD の commit

## 再現手順

```bash
export TAKT_CONFIG_DIR=$(pwd)/ensembles/deepseek   # 例: DeepSeek編成
takt run   # 発注書 order/order.md をタスクとして投入
```

## 履歴について

2026-08-18 に記事の実験一式へ再構成し、履歴を一新した。
旧履歴と旧実験データはローカルの git bundle に保全してある。
