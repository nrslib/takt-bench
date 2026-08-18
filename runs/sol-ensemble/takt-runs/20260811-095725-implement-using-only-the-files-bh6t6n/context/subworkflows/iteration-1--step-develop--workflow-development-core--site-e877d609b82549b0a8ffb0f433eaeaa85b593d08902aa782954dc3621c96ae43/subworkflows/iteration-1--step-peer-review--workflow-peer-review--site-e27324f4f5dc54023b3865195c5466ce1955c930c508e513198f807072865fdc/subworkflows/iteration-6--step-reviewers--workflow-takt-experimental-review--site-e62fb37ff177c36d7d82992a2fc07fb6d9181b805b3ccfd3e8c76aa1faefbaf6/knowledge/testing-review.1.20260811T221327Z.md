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

| 基準 | 判定 |
|------|------|
| SDK 固有のエラーハンドリングが Provider 外に漏れている | REJECT |
| AgentResponse.error にエラーを伝播していない | REJECT |
| プロバイダー間でセッションキーが衝突する | REJECT |
| セッションキー形式 `{persona}:{provider}` | OK |

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

| 基準 | 判定 |
|------|------|
| runtime と preview が別々の入力で provider、model、tool、権限を解決している | REJECT |
| preview に値が表示されるだけで、runtime と同じ override 条件を検証していない | REJECT |
| doctor や validation が正常とする設定が runtime では別条件により失敗する | 警告 |
| runtime と補助入口が同じ正規化済み入力または同じ resolver を共有している | OK |

## 実行資産の消費境界

TAKT の実行資産は、配置場所や名前だけではなく、それを消費する入口で意味が決まる。同じ文字列でも、資産参照、セッション識別子、表示名、直接渡される本文は別契約として扱う。

| 基準 | 判定 |
|------|------|
| 資産参照を解決する入口と、識別子だけを使う入口を同一視している | REJECT |
| 同名の facet を追加しただけで、直接本文を渡す入口にも反映されると扱っている | REJECT |
| workflow 由来の実行資産と機能固有の実行資産が同じ責務名で混在している | 警告 |
| 入口ごとに、どの resolver / loader がどの資産種別を消費するかを確認して配置している | OK |
| 共有すべき本文を、既存の実行資産 loader から読む形に集約している | OK |

### 参照名と識別名

`persona`、`session_key`、`name` のような文字列は、参照名か識別名かで意味が異なる。参照名なら対応する resolver が資産を読み込む。識別名ならセッション、ログ、状態、表示のキーであり、同名ファイルの存在だけでは内容は使われない。新しい資産を追加した場合は、その資産を読む loader と呼び出し元まで追う。

## ファセット組み立て

faceted-prompting モジュールは TAKT 本体に依存しない独立モジュール。

```
compose(facets, options) → ComposedPrompt { systemPrompt, userMessage }
```

| 基準 | 判定 |
|------|------|
| faceted-prompting から TAKT コアへの import | REJECT |
| TAKT コアから faceted-prompting への依存 | OK |
| ファセットパス解決のロジックが faceted-prompting 外にある | 警告 |

### ファセット解決の3層優先順位

プロジェクト `.takt/` → ユーザー `~/.takt/` → ビルトイン `builtins/{lang}/`

同名ファセットは上位が優先。ビルトインのカスタマイズは上位層でオーバーライドする。

## テストレイヤーと実行ゲート

TAKT は、テスト名や所要時間ではなく実際にまたぐ境界で unit、軽い IT、重い IT、E2E を分類する。実子プロセスを起動しても、利用者の入口ではなく内部 client からローカルの偽 CLI を呼ぶ検証なら E2E ではなく重い IT である。

| レイヤー | 境界 | 標準ゲート |
|---------|------|-----------|
| unit | 個別関数・クラス。直接依存を test double に置き換え、実 process・Git・filesystem・SQLite・workflow engine を使わない | `npm test` |
| 軽い IT | 実 filesystem・SQLite・bounded storage、または複数の本番コンポーネントを結合するが、高負荷な process / engine 実行を伴わない | `npm run test:it` |
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
// NG - テストでリアル API を呼ぶ
const response = await callClaude(prompt)

// OK - Mock プロバイダーでシナリオを設定
setMockScenario([
  { persona: 'coder', status: 'done', content: '[STEP:1]\nDone.' },
  { persona: 'reviewer', status: 'done', content: '[STEP:1]\napproved' },
])
```

### テストの分離

| 基準 | 判定 |
|------|------|
| テスト間でグローバル状態を共有 | REJECT |
| 環境変数をテストセットアップでクリアしていない | 警告 |
| E2E テストで実 API を前提としている | `provider` 指定の config で分離 |

## プラットフォーム優先度

TAKT では Windows を副次プラットフォームとして扱う。

## エラー伝播

プロバイダーエラーは `AgentResponse.error` → セッションログ → コンソール出力の経路で伝播する。

| 基準 | 判定 |
|------|------|
| SDK エラーが空の `blocked` ステータスになる | REJECT |
| エラー詳細がセッションログに記録されない | REJECT |
| エラー時に ABORT 遷移が定義されていない | 警告 |

## セッション管理

エージェントセッションは cwd と provider ごとに保存される。worktree/clone 実行時はセッション再開をスキップする。

通常の Phase 1 応答で `sessionId` が欠落しているだけなら、既存セッションを直ちに破棄する根拠にはならない。既存の resume context を継続してよい経路では、古い sessionId を維持する。

一方、明示的に新しいセッションとして実行した retry/fallback が成功した場合、応答に `sessionId` がなければ古い resumed session を使い続けてはならない。新規実行の結果として sessionId が得られなかったことを保存層へ伝え、古い session を clear または隔離する。

Report Phase は Phase 1 の成果物を読む Phase 2 であり、readonly かつ tool-free の実行契約を持つ。report retry/fallback でも `permissionMode: readonly`、空の tool 許可、provider 能力 override（例: turn 上限）を落としてはならない。

| 基準 | 判定 |
|------|------|
| `cwd !== projectCwd` でセッション再開している | REJECT |
| セッションキーにプロバイダーが含まれない | REJECT（クロスプロバイダー汚染） |
| 継続すべき Phase 間でセッションが切れている | REJECT（コンテキスト喪失） |
| 新規セッション retry 成功後に、古い resumed session を残している | REJECT（意図しない resume） |
| report retry/fallback で readonly、tool-free、能力 override が落ちている | REJECT |


---

# ユニットテスト知識

## テストダブルの使い分け

テストダブルは目的に応じて使い分ける。過剰なモックはテストの信頼性を下げる。

| 種類 | 目的 | 使用場面 |
|------|------|---------|
| Stub | 固定値を返す | 外部依存の出力を制御したい |
| Mock | 呼び出しを検証する | メソッド呼び出しの有無・引数を確認したい |
| Spy | 実装を残しつつ呼び出しを記録 | 副作用の検証をしたい |
| Fake | 簡易的な実装 | インメモリDBなど軽量な代替が必要 |

### モック粒度の判断

- テスト対象の直接の依存のみモックする（間接依存はモックしない）
- 「モックが多すぎる」はテスト対象の設計の問題を示唆する
- 純粋関数は依存がないのでモック不要

```typescript
// NG - 内部実装をモック（振る舞いではなく実装を検証している）
vi.spyOn(service, 'privateMethod')
service.execute()
expect(service.privateMethod).toHaveBeenCalled()

// OK - 外部依存をモックし、振る舞いを検証
const repository = { findById: vi.fn().mockResolvedValue(user) }
const service = new UserService(repository)
const result = await service.getUser('id')
expect(result).toEqual(user)
```

## テストダブルの契約一致

builder、runner、adapter、provider などをテストダブルに置き換える場合、型だけでなく本番実装の意味契約を揃える。テストダブルが簡略化してよいのは、対象テストで観測しない責務に限る。

| 観点 | 確認内容 |
|------|----------|
| 戻り値 | 必須値、任意値、欠落値、部分成功の shape が本番と一致している |
| 入力伝播 | override、context、options など、本番が分岐に使う入力を受け取り検証できる |
| 制約 | 権限、能力、tool 制限、上限値などが本番と同じ意味で渡る |
| 副作用 | セッション更新、イベント発行、保存、破棄などの有無を観測できる |
| 簡略化範囲 | テストダブルで証明できない挙動を、テスト名や期待値で主張しない |

テストダブルが本番契約の一部を省略する場合、テストはその省略範囲に依存しない振る舞いだけを検証する。権限伝播、状態遷移、欠落値処理を確認するテストでは、省略されたフィールド自体がバグの温床になる。

## 境界値分析

境界値と同値分割はユニットテストの基本手法。

| 手法 | 内容 |
|------|------|
| 同値分割 | 入力を等価なグループに分け、各グループから1つずつテスト |
| 境界値分析 | 同値クラスの境界でテスト（境界、境界±1） |

```typescript
// NG - 正常系のみ
test('validates age', () => {
  expect(validateAge(25)).toBe(true)
})

// OK - 境界値を含む
test('validates age at boundaries', () => {
  expect(validateAge(0)).toBe(true)    // 下限
  expect(validateAge(-1)).toBe(false)  // 下限-1
  expect(validateAge(150)).toBe(true)  // 上限
  expect(validateAge(151)).toBe(false) // 上限+1
})
```

## 振る舞い保証

ユニットテストは設定値や内部状態のスナップショットだけでなく、公開された契約が期待どおりに振る舞うことを検証する。拒否、許可、隔離、解放のような境界変更は、主要な成功/失敗ケースを deterministic に確認する。

| 基準 | 判定 |
|------|------|
| 期待する戻り値・例外・副作用が直接検証されている | OK |
| 境界変更の成功/失敗、許可/拒否の両側が検証されている | OK |
| 設定値や最後の内部状態だけを確認している | REJECT |
| 外部環境がないと主要な境界条件を再現できない | Fake や Stub による deterministic test を検討 |

## 自然言語・宣言的資産の検証レイヤー

プロンプトや instruction の文字列、ワークフローなどの宣言的定義は入力データである。定義の保存状態、parser・loader の構造契約、実行時の振る舞いは、それぞれ別の検証対象として扱う。

| 検証対象 | 適切な方法 |
|----------|------------|
| parser・loader の参照解決、schema、rule 解釈 | 必要最小限の専用 fixture を使った構造テスト |
| 配布される宣言的資産群 | 全件 load と schema 適合の smoke test |
| 状態遷移や副作用 | 代表的な最小シナリオを使った実行結果のテスト |
| 文字列自体が外部公開契約である値 | 完全一致テスト |
| 自然言語による分類・判断 | 代表例と反例を含むモデル評価 |
| 決定的に定義できる判定 | 自然言語からコードへ分離したユニットテスト |

```typescript
// NG - 配布定義を期待値へ複製し、定義差分だけを検出する
expect(shippedWorkflow.steps.map((step) => step.name)).toEqual(['plan', 'review', 'fix'])

// OK - 最小 fixture で parser の構造契約を検証する
expect(parsedFixture.rules[0]?.next).toBe('fix')
```

個別の配布資産に含まれる step 名、rule、遷移先、設定値を期待値へ丸写しすると、実装とは独立した契約ではなく、同じ定義の複製になる。配布資産は全件 load・schema 適合で破損を検出し、遷移や副作用は最小シナリオの実行結果で検証する。

## テストフィクスチャ設計

テストデータはファクトリ関数で管理する。

- ファクトリ関数で必要最小限のフィクスチャを生成する
- テストに無関係なフィールドはデフォルト値で埋める
- 共有フィクスチャを変更して使い回さない（テスト間の独立性を保つ）

```typescript
// NG - 全フィールドを毎回定義
const user = { id: '1', name: 'test', email: 'test@example.com', role: 'admin', createdAt: new Date() }

// OK - ファクトリ関数で必要最小限
const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-id',
  name: 'test-user',
  email: 'test@example.com',
  role: 'user',
  ...overrides,
})

test('admin can delete', () => {
  const admin = createUser({ role: 'admin' })
  // テストに関係するフィールドだけ明示
})
```

## テスト対象の分離

テスト容易性は設計品質の指標。テストしにくいコードは依存が密結合している。

### 依存注入パターン

| パターン | 使用場面 |
|---------|---------|
| コンストラクタ注入 | クラスベースの依存分離 |
| 関数引数 | 関数の依存を引数で受け取る |
| モジュール差し替え | テスト時にモジュール全体を差し替える |

```typescript
// NG - 直接依存を生成（テストでモック不可）
class OrderService {
  private repo = new OrderRepository()
  async create(order: Order) { return this.repo.save(order) }
}

// OK - コンストラクタ注入（テストでモック可能）
class OrderService {
  constructor(private readonly repo: OrderRepository) {}
  async create(order: Order) { return this.repo.save(order) }
}
```


---

# E2Eテスト知識

## E2Eテストのスコープ

E2Eテストはユーザーの操作フロー全体を検証する。ユニットテストやインテグレーションテストとはスコープが異なる。

| テスト種別 | スコープ | 検証対象 |
|-----------|---------|---------|
| ユニット | 関数/クラス | ロジックの正しさ |
| インテグレーション | モジュール間結合 | データフローの正しさ |
| E2E | ユーザー操作フロー全体 | ユーザーから見た振る舞い |

| 基準 | 判定 |
|------|------|
| ユニットテストでカバーできるロジック検証をE2Eで書く | 警告。ユニットテストに移動を検討 |
| ユーザーが実行する操作フローの検証 | E2Eテストが適切 |
| 複数コマンド/ページにまたがるシナリオ | E2Eテストが適切 |
| エラーメッセージの表示確認 | E2Eテストが適切 |

## 振る舞い観測

E2Eテストはユーザーから見える振る舞いを観測する。設定値、ログ、スナップショットの確認だけでは、実際の拒否、許可、隔離、回復が起きたことを保証しない。

| 基準 | 判定 |
|------|------|
| ユーザー操作や外部入力に対する結果が観測されている | OK |
| 拒否・エラー・リカバリーの経路で期待する結果が確認されている | OK |
| 設定や内部状態だけを確認してユーザー-visible な結果を見ていない | REJECT |
| 実外部環境に依存する確認しかなく、主要境界の deterministic test がない | 警告またはREJECT |

## 否定契約の観測

E2E で権限、実行時に選択される能力・バックエンド・オプション、設定、拒否、隔離を確認する場合、出力全体への文字列否定は証拠として弱い。
対象の行、イベント、レコード、フィールド、呼び出し引数などを取り出し、禁止値ごとに検査することで、順序、大小文字、空白、区切り、部分漏れによる見逃しを防ぐ。

| 基準 | 判定 |
|------|------|
| 「特定の一文が出ていない」だけで拒否・非継承・隔離を検証した扱いにする | REJECT |
| 許可された値の表示だけを確認し、禁止値が末端処理へ渡っていないことを見ていない | REJECT |
| 観測単位を抽出して、禁止値・拒否値・非継承値が含まれないことを値単位で確認する | OK |
| 同じシナリオで許可側と拒否側、継承側と非継承側を比較できる | OK |

## UXルートの洗い出し

E2Eテストの網羅性はユーザー操作ルートの洗い出しに依存する。ドキュメントではなくコードから起点を特定する。

### 起点の特定方法

| アプリケーション種別 | 起点の探し方 |
|-------------------|------------|
| CLI | コマンド定義、サブコマンド登録、オプション/フラグ定義をコードから抽出 |
| Web | ルーティング定義、ページコンポーネント一覧をコードから抽出 |
| API | エンドポイント定義、ルーター登録をコードから抽出 |

### 分岐パターン

各起点から分岐するルートを網羅的に列挙する。

| 分岐パターン | 例 |
|------------|-----|
| オプション/フラグの組み合わせ | `--verbose` あり/なし、`--format json` vs `--format table` |
| 状態による分岐 | 初回実行 vs 既存データあり、設定ファイルあり vs なし |
| 権限/ロール | 管理者 vs 一般ユーザー、認証済み vs 未認証 |
| 外部依存の状態 | 接続成功 vs タイムアウト、正常レスポンス vs エラーレスポンス |
| エラーリカバリー | 途中で失敗した場合の再試行、ロールバック |
| 入力バリエーション | 有効な入力、無効な入力、空入力、境界値 |


## モック境界の設計

E2Eテストでは「どこまで実物で動かし、どこからモックするか」の判断が重要。

### モック設計の原則

- テスト対象のアプリケーションコードはそのまま動かす
- 外部サービスとの境界でモックを挿入する
- モックは既存のフィクスチャ・ヘルパーのパターンに合わせる
- 新しいモック機構を導入する前に既存のものを確認する

## フレイキーテスト対策

E2Eテストは非決定的な要因で失敗しやすい。

| 原因 | 対策 |
|------|------|
| タイミング依存 | 明示的な待機条件を使う（固定 sleep ではなく状態ベースの待機） |
| ポート競合 | テストごとにランダムポートを割り当てる |
| ファイルシステムの残留 | テストごとに一時ディレクトリを作成し、終了時にクリーンアップ |
| プロセスリーク | タイムアウトと強制終了を設定する |
| 環境依存 | テスト実行に必要な前提条件を明示的にセットアップする |
| 実行順序依存 | 各テストが独立して実行できるよう、状態を初期化する |
| 既存規約から外れた timeout/cleanup | 同種 E2E の既存規約に合わせる |

```typescript
// NG - 固定 sleep でタイミングを合わせる
await sleep(3000)
expect(result).toBeDefined()

// OK - 条件ベースで待機する
await waitFor(() => expect(result).toBeDefined(), { timeout: 5000 })
```

## テストケース管理

E2Eテストの網羅性を保証するため、テストケースをリストで管理する。

| 原則 | 内容 |
|------|------|
| 番号付きリスト | 各テストケースに一意の番号を付与し、実装状況を追跡する |
| 起点ごとに分類 | コマンド/ページ/エンドポイント単位でグループ化する |
| 優先度付け | ユーザー影響度 × 未テストのリスクで優先度を決定する |
| 既存テストとの突き合わせ | 新規追加前に既存テストのカバー範囲を確認する |
