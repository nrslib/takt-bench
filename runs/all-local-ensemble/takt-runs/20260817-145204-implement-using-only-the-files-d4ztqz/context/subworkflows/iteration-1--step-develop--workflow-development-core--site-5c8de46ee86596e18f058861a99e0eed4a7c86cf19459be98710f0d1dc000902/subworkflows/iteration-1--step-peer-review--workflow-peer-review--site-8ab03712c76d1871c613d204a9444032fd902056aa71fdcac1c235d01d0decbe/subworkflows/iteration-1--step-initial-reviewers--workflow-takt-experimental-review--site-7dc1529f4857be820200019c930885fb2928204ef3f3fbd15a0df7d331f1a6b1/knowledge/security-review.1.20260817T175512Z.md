# セキュリティ知識

## 脅威モデルの判断材料

セキュリティ境界とは、誰が値を制御できるか、誰が観測できるか、どの権限が値を解釈または実行するかが変わる点である。定石や API 名を finding とみなさず、次の関係を判断材料にする。

| 条件 | 立証する境界・影響 |
|------|--------------------|
| trust または権限が異なる主体間を値が移動する | 制御主体、受け取る権限、移動後に得られる能力を特定する |
| 値が code、command、query、path、URL、その他の命令として解釈される | interpreter、命令として制御される部分、実行時の権限を特定する |
| 出力に保護対象の data が含まれる | data、出力を観測できる各主体、権限外の観測者を特定する |
| 認証、認可、scope、sandbox、credential が変わる | 変更前後で可能になる action と保護資産を比較する |
| 制御が存在しない、または削除される | 不在だけで影響を仮定せず、その制御が実在する境界を守っていたか確認する |

## 優先順位解決・オーバーライド・trust boundary

複数の設定・定義ソース、documented な優先順位、意図的な override、拡張点は、それ自体では脆弱性ではない。低信頼側が documented なモデルを超える能力を得るかが判断材料になる。

| 条件 | 示唆される境界・影響 |
|------|----------------------|
| 同じ主体・同じ trust level 内で documented な優先順位に従う | 新しい主体や権限境界は示されない |
| 明示的な selector が同じカスタマイズ契約で許可された定義を選ぶ | 選択だけでは権限拡大や data access を示さない |
| 高い優先順位の source が documented な scope 内で採用される | 優先順位だけで影響とせず、trust level と能力を比較する |
| 低信頼の source が高信頼の設定を override できる | code 実行、高信頼資産の変更、data access、認可回避へ到達するか追跡する |
| confirmation が削除される | 明示選択で意図が確立しているか、confirmation が trust level を分ける唯一の制御だったか確認する |

優先順位や override の懸念では、低信頼の主体と制御 source、保護資産、変更後に初めて可能になること、documented な契約を超える理由を特定する。


---

# データ・機密情報セキュリティ知識

## 適用条件

credential、個人情報・保護 data、log、error、response、成果物、repository 内容、暗号 material に影響する変更へ適用する。

## 露出境界

field 名や log 出力の存在だけで判定しない。data、その発生元、受け取る出力・保存先、その宛先を観測できる全主体、具体的な権限外の観測者を特定する。

| 条件 | 確認する露出・影響 |
|------|--------------------|
| password、token、API key、session 値、認証 header が log・成果物へ到達する | 宛先を読める主体と、その credential が与える access を確認する |
| request、object、exception、serialize 値全体を出力する | 含まれる機密 field と、それを受け取る権限外の観測者を特定する |
| 内部 path、query、stack、他 resource の内容が response へ到達する | caller と、その caller から保護される情報・data かを確認する |
| 個人情報を log へ出力する | data classification、運用上の必要性、保持、宛先の閲覧者、権限外露出を確認する |
| secret または保護 file を repository へ記録する | repository・後続成果物を読める主体と、得られる能力・data を特定する |

mask・除外は、実際の serialize 経路を覆う場合にだけ有効である。無効な log level は、deployment・設定によって権限外の観測者が読める出力へ値が到達しない場合にだけ露出を変える。

## 暗号 material と semantics

algorithm、key、nonce、transport protection、hash では、保護する性質、攻撃者の能力、runtime・protocol semantics、機密性・完全性への具体的影響を特定する。非推奨という名称だけでは影響を示さない。hardcoded key、nonce の再利用、保護されない transport は、関連する主体と観測・変更経路が到達可能な場合に影響を示し得る。


---

# 依存関係セキュリティ知識

## 適用条件

dependency または lockfile entry を追加・削除・解決・設定・更新する変更に適用する。

## 脆弱性の到達可能性

CVE、advisory、maintenance 状態だけでは、変更が悪用可能な経路を導入したことを示さない。関連する link をすべて確認する。

- 差分で変わる正確な resolved version
- 一次 advisory または vendor source が示す affected version range
- この project から到達する脆弱な package function または runtime feature
- 脆弱性に必要な低信頼入力、主体の access、deployment mode、platform、設定
- 到達する機能が実行される権限と保護資産
- 変更が affected version を導入するか、関連経路を変更していないか

いずれかの link が欠ける場合、package 名から悪用可能性を推測せず、未確認の内容を記録する。resolved version、affected range、到達可能な機能、攻撃前提、具体的影響を立証できる場合、実害を再現せずに dependency と call path の静的証拠でセキュリティ経路を示せる。

## Integrity と解決

registry、lockfile、checksum、install script、build plugin、source reference では、resolved artifact の制御主体、保護する検証、code が実行される時点、build・runtime 権限を特定する。新規 dependency の必要性や maintenance 品質は、確認済みの integrity・実行経路を作らない限り、それ自体ではセキュリティ境界にならない。


---

# TAKT アーキテクチャ知識

## コア構造

WorkflowEngine は状態機械。step 間の遷移を EventEmitter ベースで管理する。

```
CLI → WorkflowEngine → Runner（4種） → RuleEvaluator → 次の step
```

| Runner | 用途 | 使い分け |
|--------|------|---------|
| StepExecutor | 通常の3フェーズ実行 | デフォルト |
| ParallelRunner | 並列サブステップ | parallel ブロック |
| ArpeggioRunner | データ駆動バッチ処理 | arpeggio ブロック |
| TeamLeaderRunner | タスク分解 → サブエージェント並列 | team_leader ブロック |

各 Runner は排他。1つの step に複数の Runner タイプを指定しない。

### 3フェーズ実行モデル

通常 step は最大3フェーズで実行される。セッションはフェーズ間で維持される。

| フェーズ | 目的 | ツール | 条件 |
|---------|------|--------|------|
| Phase 1 | メイン作業 | step の allowed_tools | 常に |
| Phase 2 | レポート出力 | Write のみ | output_contracts 定義時 |
| Phase 3 | ステータス判定 | なし（判定のみ） | タグベースルール時 |

## ルール評価

RuleEvaluator は YAML 記述順にすべての rule を評価し、最初に成立した rule を採用する。意味ラベルは Phase 3 で一度だけ選択し、`when(...)` と aggregate 条件は同じ順序ループで決定的に評価する。どの rule も成立しなければ workflow は `rule_no_match` で ABORT する。

| 優先度 | 方法 | 対象 |
|--------|------|------|
| YAML 順 | condition | 最初に true となる rule |

### Condition の記法

| 記法 | パース | 正規表現 |
|------|--------|---------|
| `when(...)` | workflow state の決定的 predicate | `isWhenConditionExpression` |
| `all("...")` / `any("...")` | 集約条件 | `AGGREGATE_CONDITION_REGEX` |
| 裸の意味ラベル | Phase 3 の単一選択値との一致 | — |

意味・aggregate 条件は `&& when(...)` と組み合わせられる。特殊構文を追加する場合は condition parser と RuleEvaluator を同時に更新する。

## プロバイダー統合

Provider インターフェースで抽象化。具体的な SDK の差異は各プロバイダー内に閉じ込める。

```
Provider.setup(AgentSetup) → ProviderAgent
ProviderAgent.call(prompt, options) → AgentResponse
```


### モデル解決

provider と model はフィールドごとに独立して解決される。上位が優先。

1. CLI / 環境変数の明示オーバーライド
2. 現在の実行にマッチした promotion（通常の agent step のみ。parallel sub-step では指定自体がスキーマで拒否される）
3. step / parallel sub-step の直接 provider / model
4. workflow_call のオーバーライド
5. provider_routing（steps → tags → personas の順）
6. persona_providers（非推奨）
7. auto routing
8. workflow → プロジェクト config.yaml → グローバル config.yaml → プロバイダーデフォルト

## 補助入口の契約

TAKT では workflow 実行経路だけでなく、preview、doctor、workflow summary、validation、report も利用者に見える契約入口である。設定値、provider、model、tool、権限、出力契約を表示・検証する補助入口は、runtime と同じ正規化済み入力、resolver、override 順を使う。


## 実行資産の消費境界

TAKT の実行資産は、配置場所や名前だけではなく、それを消費する入口で意味が決まる。同じ文字列でも、資産参照、セッション識別子、表示名、直接渡される本文は別契約として扱う。


### 参照名と識別名

`persona`、`session_key`、`name` のような文字列は、参照名か識別名かで意味が異なる。参照名なら対応する resolver が資産を読み込む。識別名ならセッション、ログ、状態、表示のキーであり、同名ファイルの存在だけでは内容は使われない。新しい資産を追加した場合は、その資産を読む loader と呼び出し元まで追う。

## ファセット組み立て

faceted-prompting モジュールは TAKT 本体に依存しない独立モジュール。

```
compose(facets, options) → ComposedPrompt { systemPrompt, userMessage }
```


### ファセット解決の3層優先順位

プロジェクト `.takt/` → ユーザー `~/.takt/` → ビルトイン `builtins/{lang}/`

同名ファセットは上位が優先。ビルトインのカスタマイズは上位層でオーバーライドする。

## テストレイヤーと実行ゲート

TAKT は、テスト名や所要時間ではなく実際にまたぐ境界で unit、軽い IT、重い IT、E2E を分類する。実子プロセスを起動しても、利用者の入口ではなく内部 client からローカルの偽 CLI を呼ぶ検証なら E2E ではなく重い IT である。

| レイヤー | 境界 | 標準ゲート |
|---------|------|-----------|
| unit | 個別関数・クラス。直接依存を test double に置き換え、実 process・Git・filesystem・workflow engine を使わない | `npm test` |
| 軽い IT | 実 filesystem・bounded storage、または複数の本番コンポーネントを結合するが、高負荷な process / engine 実行を伴わない | `npm run test:it` |
| 重い IT | 実 child process・Git・完全な WorkflowEngine / TeamLeader、または計測上 serial 実行が必要な高負荷ケース | `npm run test:it:heavy` |
| E2E | 利用者が使う CLI などの公開入口からアプリケーション全体を実行し、利用者から見える結果を観測する | provider 別 E2E gate |

### 開発時の実行順

| 状態 | 実行 |
|------|------|
| 実装中 | unit gate を反復する |
| 実装完了時 | unit gate の後に軽い IT gate を実行する |
| IT を追加・変更した | 分類契約テスト `releaseVerificationWiring.test.ts` を単体実行する |
| 重い IT を追加・変更した | 全重い IT を待たず、変更したファイルを target 指定で自分で実行する |
| Pull Request / release | 軽い IT と重い IT の全件を実行する |

重い IT runner は、process・Git・同期 I/O の競合を避けるため1 workerで動く。ローカルの全件実行は直列であり、PR CI は重い parallel IT を独立 runner の4シャードへ分割し、serial groupも別 runnerへ分離する。`npm test -- <test-file>` は分類済みの対象を対応 runner へ送る。重い IT を追加・変更した担当者は、この target 実行を完了証拠として残し、PR での全重い IT だけに初回検証を委ねない。`npm run check:release` は unit、軽い IT、重い IT、prompt evaluation、E2E を順に実行する。

### Mock プロバイダー

`--provider mock` でテスト用の決定論的レスポンスを返す。シナリオキューで複数ターンのテストを構成する。

```typescript
// 避ける例: テストでリアル API を呼ぶ
const response = await callClaude(prompt)

// 例: Mock プロバイダーでシナリオを設定
setMockScenario([
  { persona: 'coder', status: 'done', content: '[STEP:1]\nDone.' },
  { persona: 'reviewer', status: 'done', content: '[STEP:1]\napproved' },
])
```

### テストの分離


## プラットフォーム優先度

TAKT では Windows を副次プラットフォームとして扱う。

## エラー伝播

プロバイダーエラーは `AgentResponse.error` → セッションログ → コンソール出力の経路で伝播する。


## セッション管理

エージェントセッションは cwd と provider ごとに保存される。worktree/clone 実行時はセッション再開をスキップする。

通常の Phase 1 応答で `sessionId` が欠落しているだけなら、既存セッションを直ちに破棄する根拠にはならない。既存の resume context を継続してよい経路では、古い sessionId を維持する。

一方、明示的に新しいセッションとして実行した retry/fallback が成功した場合、応答に `sessionId` がなければ古い resumed session を使い続けてはならない。新規実行の結果として sessionId が得られなかったことを保存層へ伝え、古い session を clear または隔離する。

Report Phase は Phase 1 の成果物を読む Phase 2 であり、readonly かつ tool-free の実行契約を持つ。report retry/fallback でも `permissionMode: readonly`、空の tool 許可、provider 能力 override（例: turn 上限）を落としてはならない。


## 終了経路の完全性

一時ファイルや外部リソースを生成する機能では、正常終了だけでなく、失敗、キャンセル、強制終了の各終端でも解放されるかを確認します。`process.exit()` と強制終了（SIGINT 連打、abort ハンドラの即時終了）は `finally` を実行しません。`finally` に依存した cleanup は、その内側で `process.exit` が呼ばれる経路や強制終了経路では迂回されます。リソースを生成する入口ごとに、終端の一覧（正常・失敗・キャンセル・強制終了）を作り、cleanup が実行されない終端を列挙してください。


---

# ローカル process・path・terminal・設定のセキュリティ知識

## 適用条件

低信頼の CLI 引数、環境変数、設定、repository 内容が process 実行、filesystem 操作、terminal 出力、credential、sandbox、ローカル権限へ到達する変更に適用する。local という理由で同じ trust level とみなさず、各 source を分けて評価する。

## Process 実行

実行ファイル、引数、environment、working directory、loader、plugin、search path は別々の制御点である。

| 条件 | 確認する境界・影響 |
|------|--------------------|
| 低信頼の値が shell command 文字列へ入る | shell による再解釈と、起動 process の権限で可能な command まで追う |
| 値が executable・loader・plugin・environment entry・search path を選ぶ | 制御主体と、宣言された権限または sandbox を越えて実行されるかを確認する |
| 固定 executable へ shell を使わず引数配列で渡す | 引数自体が interpreter、設定、出力先、危険な実行機能を選ばないか確認する |

## Path と filesystem 権限

字句上の path 選択と、解決 target に対する権限を分ける。相対関係の正規化は lexical containment の判断材料になる。既存 symlink には、契約が escape を禁じる境界で canonical path または handle による証拠を要求する。canonical path は filesystem race が成立しない場合に限り containment の証拠になる。検証から利用までの間に race が成立し得る場合は、安定した handle または同等の atomic な no-follow 操作を要求し、canonicalization だけで操作対象が同一に保たれたとは判断しない。path の制御主体、保護 root、解決される read・write・delete target、機密性・完全性への影響を特定する。

## Terminal の解釈

repository label、filename、command output は terminal 利用者より低信頼な場合がある。可視 text と control sequence の解釈を分ける。byte の制御主体、到達する terminal sequence と semantics、表示・clipboard・入力その他の効果、その terminal を信頼する主体を特定する。

## Repository とローカル設定の trust

repository 設定、user-global 設定、環境変数、runtime credential、明示 CLI 選択は、所有者と trust level が異なり得る。どの source が採用され、誰が制御し、process・filesystem・terminal・credential・network・sandbox・tool・ローカル権限を広げるかを確認する。同じ trust level の source を documented な方法で選ぶだけでは、権限変更を示さない。
