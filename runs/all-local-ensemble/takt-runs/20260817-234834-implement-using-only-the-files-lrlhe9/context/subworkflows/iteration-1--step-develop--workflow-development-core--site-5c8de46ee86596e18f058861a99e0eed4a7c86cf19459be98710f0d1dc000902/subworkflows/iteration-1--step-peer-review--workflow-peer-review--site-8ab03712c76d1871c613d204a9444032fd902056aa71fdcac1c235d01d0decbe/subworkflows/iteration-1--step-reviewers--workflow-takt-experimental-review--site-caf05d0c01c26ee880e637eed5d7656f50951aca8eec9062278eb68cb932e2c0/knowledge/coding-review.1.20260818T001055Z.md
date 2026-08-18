# アーキテクチャ知識

## 複数失敗を集約する境界

複数の結果をまとめる処理では、その処理に定められた規則で基準となる結果を一つ選ぶ。制御判断と外部向けの表現は、すべて同じ結果から作る。ほかの結果を記録に残してもよいが、規則にない優先順位で基準の結果を置き換えない。


各 response や exception は、共通の分類処理で、分類、原因、回復方法を持つ結果へ一度だけ変換する。並列処理、親子処理、batch などは、それぞれに定められた規則で基準となる結果を選ぶ。出力処理は、選ばれた結果から status、category、reason、retry・fallback・停止判断、abort 理由、外部向けの表現を作る。この3つの処理を、一つの汎用的な優先順位へまとめない。

```typescript
// 避ける例: sibling ごとに別々の親フィールドを選ぶ
const retryable = outcomes.find((outcome) => outcome.recovery === 'retry');
const categorized = outcomes.find((outcome) => outcome.category !== undefined);
return {
  action: retryable ? 'retry' : 'stop',
  category: categorized?.category,
  abortReason: retryable?.detail,
};

// 例: boundary policy で一度選び、同じ primary を投影する
const outcomes = responses.map(classifyOutcome);
const primary = selectPrimaryOutcome(outcomes, boundaryPolicy);
return {
  action: decideRecovery(primary.recovery),
  category: primary.category,
  reason: primary.detail,
  abortReason: primary.detail,
};
```

## 構造・設計

**ファイル分割**

ファイルは、同じ責務と変更理由を持つコードがまとまる単位にする。行数は内容を読み直すきっかけにはなるが、分割の根拠や品質の合否条件にはならない。責務が独立して変わる場合は分け、密接に協調して同じ理由で変わる小さな定義は同居できる。

**モジュール構成**

- 高凝集: 関連する機能がまとまっているか
- 低結合: モジュール間の依存が最小限か
- 循環依存がないか
- 適切なディレクトリ階層か

**操作の一覧性**

ドメイン上の操作や外部副作用は、目的と所有者が追える名前・境界を持つと理解しやすい。同じ契約を担う呼び出しが複数の場所で再構成されている場合は、共通の所有者へ集約する候補になる。一方、意図が明白な汎用 API の直接利用まで、一覧性だけを理由にラップする必要はない。

**パブリック API の公開範囲**

パブリック API が公開するのは、ドメインの操作に対応する関数・型のみ。インフラの実装詳細（特定プロバイダーの関数、内部パーサー等）を公開しない。


**関数設計**

- 1関数1責務になっているか
- 役割や変更理由が独立している処理は分離する
- 副作用が明確か

**レイヤー設計**

- 依存の方向: 上位層 → 下位層（逆方向禁止）
- Controller → Service → Repository の流れが守られているか
- 1インターフェース = 1責務（巨大なServiceクラス禁止）

**ディレクトリ構造**

構造パターンの選択:

| パターン | 適用場面 | 例 |
|---------|---------|-----|
| レイヤード | 小規模、CRUD中心 | `controllers/`, `services/`, `repositories/` |
| Vertical Slice | 中〜大規模、機能独立性が高い | `features/auth/`, `features/order/` |
| ハイブリッド | 共通基盤 + 機能モジュール | `core/` + `features/` |

Vertical Slice Architecture（機能単位でコードをまとめる構造）:

```
src/
├── features/
│   ├── auth/
│   │   ├── LoginCommand.ts
│   │   ├── LoginHandler.ts
│   │   ├── AuthRepository.ts
│   │   └── auth.test.ts
│   └── order/
│       ├── CreateOrderCommand.ts
│       ├── CreateOrderHandler.ts
│       └── ...
└── shared/           # 複数featureで共有
    ├── database/
    └── middleware/
```

Vertical Slice の選択材料:

| 条件 | 意味・選択肢 |
|------|-------------|
| 機能が独立した業務責務、変更理由、データ所有者を持つ | Slice化の候補 |
| 機能境界が既存の依存方向やデプロイ境界と整合する | Slice化で所有者を明確化できる |
| 複数機能が同じ業務規則と変更理由を共有する | 共通所有者を保つレイヤードまたはハイブリッドを検討 |
| 機能固有の責務と横断基盤が別々の理由で変わる | 機能Sliceと共通基盤を分けるハイブリッドの候補 |

`utils/` や `common/` は、責務や所有者を表さないまま肥大化しやすい。機能とレイヤーを同じ階層で表す構造では、依存方向と変更影響を確認する。

**責務の分離**

- 読み取りと書き込みの責務が分かれているか
- データ取得はルート（View/Controller）で行い、子に渡しているか
- 同じ外部契約の例外変換が境界の所有者に集約され、異なる契約は各境界で扱われているか
- ビジネスロジックがController/Viewに漏れていないか

**プロトコル境界の例外変換**

HTTP、CLI、GraphQL、message consumer などの adapter は、内部例外を外部プロトコルの表現へ変換する境界である。endpoint や handler ごとに同じ try-catch / response 変換を散在させると、ステータス、エラー形状、ログ、認可失敗の扱いが不整合になりやすい。例外変換は adapter 境界の専用レイヤに集約し、真に横断的な変換だけを global handler に置く。


## 境界での解決

設定、Option、provider、権限、パスのような値は、境界で解決してから内部へ渡す。メイン処理は「何が解決済みか」を前提に組み立て、各所で設定ソースを問い合わせない。


```typescript
// 避ける例: 実行層が設定ソースを直接知っている
async function executeWorkflow(options) {
  const engine = new WorkflowEngine({
    provider: options.provider ?? globalConfig.provider,
  });
}

class AgentRunner {
  run(step, options) {
    const provider = options.provider ?? resolveProviderFromConfig();
    return getProvider(provider).call();
  }
}

// 例: 境界で解決し、内部は解決済み値を使う
async function executeWorkflow(options) {
  const context = resolveExecutionContext(options);
  const engine = new WorkflowEngine(context);
}

class AgentRunner {
  run(step, options) {
    return getProvider(options.resolvedProvider).call();
  }
}
```

### Tell, Don't Ask

下位層に設定ソースを問い合わせさせるのではなく、上位層が「これを使え」と解決済みの値を渡す。値の選択責務と実行責務を分離する。


### 腐敗防止層

優先順位解決や外部設定形式の吸収は、境界の専用層に閉じ込める。内部モデルへは正規化済みの値だけを渡す。


### 候補解決と値合成の分離

複数の候補から参照先を選ぶ処理と、選ばれた値を合成する処理は別の契約として扱う。探索順、上書き規則、参照種別を混ぜると、表示・検証・実行で別の結果になりやすい。


```typescript
// 避ける例: 参照種別と探索基準が1つの条件に混ざっている
const root = ref.includes('/') ? currentRoot : ownerRoot

// 例: 種別を先に分類し、種別ごとの探索契約を分ける
const kind = classifyReference(ref)
const root = resolveRootForReference(kind, resolvedPath)
```

### Raw入力の正規化

外部ファイルや設定から読む値は、構文上 valid でも期待する shape とは限らない。境界で unknown として受け、配列・record・scalar へ正規化してから内部処理へ渡す。


### フェーズ分離

入力、解釈、実行、出力を段階で分ける。反復処理は、できる限り「解釈済みの入力をまとめて受け取り、実行だけを繰り返す」構造にする。


```typescript
// 避ける例: 各反復が入力解釈まで担う
for (const item of items) {
  const resolved = resolveItem(item, rawOptions, config);
  const result = execute(resolved);
  output(result);
}

// 例: 先に解釈し、反復は実行だけ
const resolvedItems = items.map((item) => resolveItem(item, rawOptions, config));

for (const item of resolvedItems) {
  const result = execute(item);
  output(result);
}
```

逐次解釈が必要なケースでも、`nextRawInput()` と `resolveInput()` と `executeResolved()` の責務は分ける。性能要件でフェーズを近づけても、責務まで混ぜない。

## コード品質の検出手法

**説明コメント（What/How）の検出基準**

コードの動作をそのまま言い換えているコメントを検出する。


```typescript
// 避ける例: コードの言い換え（What）
// If interrupted, abort immediately
if (status === 'interrupted') {
  return ABORT_STEP;
}

// 避ける例: ループの存在を言い換えただけ
// Check transitions in order
for (const transition of step.transitions) {

// 避ける例: 関数名の繰り返し
/** Check if status matches transition condition. */
export function matchesCondition(status: Status, condition: TransitionCondition): boolean {

// 例: 設計判断の理由（Why）
// ユーザー中断はワークフロー定義のトランジションより優先する
if (status === 'interrupted') {
  return ABORT_STEP;
}

// 例: 一見不自然な挙動の理由
// stay はループを引き起こす可能性があるが、ユーザーが明示的に指定した場合のみ使われる
return step.name;

// 例: 定数の算出根拠
// paddingTop + paddingBottom + button height
const footerHeight = 24 + 12 + 48;
```

**状態の直接変更の検出基準**

配列やオブジェクトの直接変更（ミューテーション）を検出する。

```typescript
// 避ける例: 配列の直接変更
const steps: Step[] = getSteps();
steps.push(newStep);           // 元の配列を破壊
steps.splice(index, 1);       // 元の配列を破壊
steps[0].status = 'done';     // ネストされたオブジェクトも直接変更

// 例: イミュータブルな操作
const withNew = [...steps, newStep];
const without = steps.filter((_, i) => i !== index);
const updated = steps.map((s, i) =>
  i === 0 ? { ...s, status: 'done' } : s
);

// 避ける例: オブジェクトの直接変更
function updateConfig(config: Config) {
  config.logLevel = 'debug';   // 引数を直接変更
  config.steps.push(newStep);  // ネストも直接変更
  return config;
}

// 例: 新しいオブジェクトを返す
function updateConfig(config: Config): Config {
  return {
    ...config,
    logLevel: 'debug',
    steps: [...config.steps, newStep],
  };
}
```

## セキュリティ（基本チェック）

- インジェクション対策（SQL, コマンド, XSS）
- ユーザー入力の検証
- 機密情報のハードコーディング

## テスタビリティ

- 依存性注入が可能な設計か
- モック可能か
- テストが書かれているか

## 抽象化レベルの評価

**条件分岐と抽象化**

分岐の数や構文だけでは抽象化方式を決められない。同じ意味・契約・変更理由を持つ実装が2つ確認できた時点で、共通の所有者へ集約すべきか判断する。外部 I/O とドメイン、方針と仕組み、公開契約と内部実装のように既存の境界がある場合は、最初の実装でも境界を表す抽象化が有効である。将来のバリアントを予測した Strategy やポリモーフィズムは追加しない。

**抽象度の不一致検出**

| パターン | 問題 | 修正案 |
|---------|------|--------|
| 高レベル処理の中に低レベル詳細 | 読みにくい | 詳細を関数に抽出 |
| 1関数内で抽象度が混在 | 認知負荷 | 同じ粒度に揃える |
| ビジネスロジックにDB操作が混在 | 責務違反 | Repository層に分離 |
| 設定値と処理ロジックが混在 | 変更困難 | 設定を外部化 |

**良い抽象化の例**

```typescript
// 条件分岐の肥大化
function process(type: string) {
  if (type === 'A') { /* 処理A */ }
  else if (type === 'B') { /* 処理B */ }
  else if (type === 'C') { /* 処理C */ }
  // ...続く
}

// Mapパターンで抽象化
const processors: Record<string, () => void> = {
  A: processA,
  B: processB,
  C: processC,
};
function process(type: string) {
  processors[type]?.();
}
```

```typescript
// 抽象度の混在
function createUser(data: UserData) {
  // 高レベル: ビジネスロジック
  validateUser(data);
  // 低レベル: DB操作の詳細
  const conn = await pool.getConnection();
  await conn.query('INSERT INTO users...');
  conn.release();
}

// 抽象度を揃える
function createUser(data: UserData) {
  validateUser(data);
  await userRepository.save(data);  // 詳細は隠蔽
}
```

## その場しのぎの検出

「とりあえず動かす」ための妥協を見逃さない。

| パターン | 例 |
|---------|-----|
| 不要なパッケージ追加 | 動かすためだけに入れた謎のライブラリ |
| テストの削除・スキップ | `@Disabled`、`.skip()`、コメントアウト |
| 空実装・スタブ放置 | `return null`、`// TODO: implement`、`pass` |
| モックデータの本番混入 | ハードコードされたダミーデータ |
| エラー握りつぶし | 空の `catch {}`、`rescue nil` |
| マジックナンバー | 説明なしの `if (status == 3)` |

## 未完成コードの検出

未完成コードの判定基準はコーディングポリシーに従う。アーキテクチャレビューでは、TODO/FIXME、空実装、スタブが設計上必要な境界・認可・バリデーション・契約更新の代替になっていないかを見る。

## DRY違反の検出

DRY はコード形状ではなく知識の重複を減らす原則である。同じ意味・契約・変更理由を持つ実装が2つ確認できたら、共通の所有者へ集約するか判断する。集約方法は関数、値オブジェクト、コンポーネント、ポリシーなど、その責務に最も自然な形を選ぶ。

DRY にしないケース:
- ドメインが異なる重複は抽象化しない（例: 顧客用バリデーションと管理者用バリデーションは別物）
- 表面的に似ているが、変更理由が異なるコードは別物として扱う

## 仕様準拠の検証

契約変更の整合性は有効な契約置換ポリシーに従う。アーキテクチャレビューでは、変更が文書化された仕様、型、スキーマ、設定形式と矛盾していないかを見る。

整合が必要になる条件:

| 変更 | 関係する契約 |
|------|---------|
| 設定ファイルの追加・変更 | 文書化された schema、必須フィールド、有効値 |
| 型・schema の追加・変更 | producer、consumer、利用者向け説明、変更対象外の有効な設定 |
| 設計制約に関わる変更 | その制約を定める一次仕様と実装境界 |

## 呼び出しチェーン検証

契約変更の配線漏れはコーディングポリシーに従う。アーキテクチャレビューでは、新しいパラメータ・フィールドが変更ファイル内だけで完結しておらず、実際の呼び出し元・生成元・読み取り側まで届いているかを見る。

契約が呼び出しチェーンを横断する場合、定義だけでは成立しない。値を生成する入口、伝播する呼び出し元、読み取る消費者が同じ意味を共有し、フォールバックも契約上の省略可能性と一致する必要がある。

危険パターン:

| パターン | 問題 | 検出方法 |
|---------|------|---------|
| `options.xxx ?? fallback` で全呼び出し元が `xxx` を省略 | 機能が実装されているのに常にフォールバック | 呼び出し元を確認 |
| テストがモックで直接値をセット | 実際の呼び出しチェーンを経由しない | テストの構築方法を確認 |
| `executeXxx()` が内部で使う `options` を引数で受け取らない | 上位から値を渡す口がない | 関数シグネチャを確認 |

```typescript
// 配線漏れ: projectCwd を受け取る口がない
export async function executeWorkflow(config, cwd, task) {
  const engine = new WorkflowEngine(config, cwd, task);  // options なし
}

// 配線済み: projectCwd を渡せる
export async function executeWorkflow(config, cwd, task, options?) {
  const engine = new WorkflowEngine(config, cwd, task, options);
}
```

呼び出し元の制約による論理的デッドコード:

呼び出しチェーンの検証は「配線漏れ」だけでなく、逆方向——呼び出し元が既に保証している条件に対する不要な防御コード——にも適用する。

| パターン | 問題 | 検出方法 |
|---------|------|---------|
| 呼び出し元がTTY必須なのに関数内でTTYチェック | 到達しない分岐が残る | 全呼び出し元の前提条件を確認 |
| 呼び出し元がnullチェック済みなのに再度nullガード | 冗長な防御 | 呼び出し元の制約を追跡 |
| 呼び出し元が型で制約しているのにランタイムチェック | 型安全を信頼していない | TypeScriptの型制約を確認 |

防御条件の必要性は、到達可能な入口が保証する事前条件で決まる。すべての実在入口が同じ条件を保証するなら内部ガードは論理的に到達不能になり、保証しない入口があるなら境界防御として意味を持つ。

## 公開状態の不変性

モジュールが公開する共有状態（初期状態、シングルトン、設定オブジェクト）では、利用側の変更が別の利用者へ漏れないことが重要である。必要な保証は観測可能な分離であり、ファクトリ、防御的コピー、永続データ構造、freeze などは実装上の選択肢である。公開契約が方式まで定めない限り、再帰的 freeze や参照同一性そのものを必須にしない。

```typescript
// 避ける例: 可変の公開初期状態。利用側が書き換えると全 replay の起点が汚染される
export const initialState: State = { count: 0, entries: {} };

// 選択肢 - freeze で保護（ネストも含めて）
export const initialState: State = Object.freeze({ count: 0, entries: Object.freeze({}) });

// 選択肢 - ファクトリで毎回新しいインスタンスを返す
export function createInitialState(): State {
  return { count: 0, entries: {} };
}
```

## 品質特性

| 特性 | 確認観点 |
|------|---------|
| Scalability | 負荷増加に対応できる設計か |
| Maintainability | 変更・修正が容易か |
| Observability | ログ・監視が可能な設計か |

## 大局観

細かい「クリーンコード」の指摘に終始しない。

品質特性は、要求、現在の負荷、既存の運用契約、または今回変更する境界から必要性を確認できる場合だけ設計条件になる。将来変わるかもしれない、規模が増えるかもしれないという予測だけでは、拡張点や追加レイヤーの根拠にならない。ドメイン命名と現在のビジネス契約の整合は、将来予測とは別に現在の意味契約として扱う。

## 変更スコープの評価

変更スコープは行数ではなく、要求・根本原因・同じ契約を持つ影響経路として論理的にまとまっているかで評価する。広い変更でも不可欠な場合があり、小さい変更でも無関係な編集は過剰である。

論理的なまとまりは、要求、根本原因、同じ契約、または実在する境界を共有することから説明できる。Coder のスコープ宣言は補助証跡であり、実際の変更との不一致がある場合も、要求と影響経路を正として評価する。

## 終了経路の完全性

一時ファイルや外部リソースを生成する機能では、正常終了だけでなく、失敗、キャンセル、強制終了の各終端でも解放されるかを確認します。`process.exit()` と強制終了（SIGINT 連打、abort ハンドラの即時終了）は `finally` を実行しません。`finally` に依存した cleanup は、その内側で `process.exit` が呼ばれる経路や強制終了経路では迂回されます。リソースを生成する入口ごとに、終端の一覧（正常・失敗・キャンセル・強制終了）を作り、cleanup が実行されない終端を列挙してください。


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
// 避ける例: 内部実装をモック（振る舞いではなく実装を検証している）
vi.spyOn(service, 'privateMethod')
service.execute()
expect(service.privateMethod).toHaveBeenCalled()

// 例: 外部依存をモックし、振る舞いを検証
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
// 避ける例: 正常系のみ
test('validates age', () => {
  expect(validateAge(25)).toBe(true)
})

// 例: 境界値を含む
test('validates age at boundaries', () => {
  expect(validateAge(0)).toBe(true)    // 下限
  expect(validateAge(-1)).toBe(false)  // 下限-1
  expect(validateAge(150)).toBe(true)  // 上限
  expect(validateAge(151)).toBe(false) // 上限+1
})
```

## 振る舞い保証

ユニットテストは設定値や内部状態のスナップショットだけでなく、公開された契約が期待どおりに振る舞うことを検証する。拒否、許可、隔離、解放のような境界変更は、主要な成功/失敗ケースを deterministic に確認する。


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
// 避ける例: 配布定義を期待値へ複製し、定義差分だけを検出する
expect(shippedWorkflow.steps.map((step) => step.name)).toEqual(['plan', 'review', 'fix'])

// 例: 最小 fixture で parser の構造契約を検証する
expect(parsedFixture.rules[0]?.next).toBe('fix')
```

個別の配布資産に含まれる step 名、rule、遷移先、設定値を期待値へ丸写しすると、実装とは独立した契約ではなく、同じ定義の複製になる。配布資産は全件 load・schema 適合で破損を検出し、遷移や副作用は最小シナリオの実行結果で検証する。

## テストフィクスチャ設計

テストデータはファクトリ関数で管理する。

- ファクトリ関数で必要最小限のフィクスチャを生成する
- テストに無関係なフィールドはデフォルト値で埋める
- 共有フィクスチャを変更して使い回さない（テスト間の独立性を保つ）

```typescript
// 避ける例: 全フィールドを毎回定義
const user = { id: '1', name: 'test', email: 'test@example.com', role: 'admin', createdAt: new Date() }

// 例: ファクトリ関数で必要最小限
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
// 避ける例: 直接依存を生成（テストでモック不可）
class OrderService {
  private repo = new OrderRepository()
  async create(order: Order) { return this.repo.save(order) }
}

// 例: コンストラクタ注入（テストでモック可能）
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


## 振る舞い観測

E2Eテストはユーザーから見える振る舞いを観測する。設定値、ログ、スナップショットの確認だけでは、実際の拒否、許可、隔離、回復が起きたことを保証しない。


## 否定契約の観測

E2E で権限、実行時に選択される能力・バックエンド・オプション、設定、拒否、隔離を確認する場合、出力全体への文字列否定は証拠として弱い。
対象の行、イベント、レコード、フィールド、呼び出し引数などを取り出し、禁止値ごとに検査することで、順序、大小文字、空白、区切り、部分漏れによる見逃しを防ぐ。


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
// 避ける例: 固定 sleep でタイミングを合わせる
await sleep(3000)
expect(result).toBeDefined()

// 例: 条件ベースで待機する
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

# アーキテクチャ知識

## 複数失敗を集約する境界

複数の結果をまとめる処理では、その処理に定められた規則で基準となる結果を一つ選ぶ。制御判断と外部向けの表現は、すべて同じ結果から作る。ほかの結果を記録に残してもよいが、規則にない優先順位で基準の結果を置き換えない。


各 response や exception は、共通の分類処理で、分類、原因、回復方法を持つ結果へ一度だけ変換する。並列処理、親子処理、batch などは、それぞれに定められた規則で基準となる結果を選ぶ。出力処理は、選ばれた結果から status、category、reason、retry・fallback・停止判断、abort 理由、外部向けの表現を作る。この3つの処理を、一つの汎用的な優先順位へまとめない。

```typescript
// 避ける例: sibling ごとに別々の親フィールドを選ぶ
const retryable = outcomes.find((outcome) => outcome.recovery === 'retry');
const categorized = outcomes.find((outcome) => outcome.category !== undefined);
return {
  action: retryable ? 'retry' : 'stop',
  category: categorized?.category,
  abortReason: retryable?.detail,
};

// 例: boundary policy で一度選び、同じ primary を投影する
const outcomes = responses.map(classifyOutcome);
const primary = selectPrimaryOutcome(outcomes, boundaryPolicy);
return {
  action: decideRecovery(primary.recovery),
  category: primary.category,
  reason: primary.detail,
  abortReason: primary.detail,
};
```

## 構造・設計

**ファイル分割**

ファイルは、同じ責務と変更理由を持つコードがまとまる単位にする。行数は内容を読み直すきっかけにはなるが、分割の根拠や品質の合否条件にはならない。責務が独立して変わる場合は分け、密接に協調して同じ理由で変わる小さな定義は同居できる。

**モジュール構成**

- 高凝集: 関連する機能がまとまっているか
- 低結合: モジュール間の依存が最小限か
- 循環依存がないか
- 適切なディレクトリ階層か

**操作の一覧性**

ドメイン上の操作や外部副作用は、目的と所有者が追える名前・境界を持つと理解しやすい。同じ契約を担う呼び出しが複数の場所で再構成されている場合は、共通の所有者へ集約する候補になる。一方、意図が明白な汎用 API の直接利用まで、一覧性だけを理由にラップする必要はない。

**パブリック API の公開範囲**

パブリック API が公開するのは、ドメインの操作に対応する関数・型のみ。インフラの実装詳細（特定プロバイダーの関数、内部パーサー等）を公開しない。


**関数設計**

- 1関数1責務になっているか
- 役割や変更理由が独立している処理は分離する
- 副作用が明確か

**レイヤー設計**

- 依存の方向: 上位層 → 下位層（逆方向禁止）
- Controller → Service → Repository の流れが守られているか
- 1インターフェース = 1責務（巨大なServiceクラス禁止）

**ディレクトリ構造**

構造パターンの選択:

| パターン | 適用場面 | 例 |
|---------|---------|-----|
| レイヤード | 小規模、CRUD中心 | `controllers/`, `services/`, `repositories/` |
| Vertical Slice | 中〜大規模、機能独立性が高い | `features/auth/`, `features/order/` |
| ハイブリッド | 共通基盤 + 機能モジュール | `core/` + `features/` |

Vertical Slice Architecture（機能単位でコードをまとめる構造）:

```
src/
├── features/
│   ├── auth/
│   │   ├── LoginCommand.ts
│   │   ├── LoginHandler.ts
│   │   ├── AuthRepository.ts
│   │   └── auth.test.ts
│   └── order/
│       ├── CreateOrderCommand.ts
│       ├── CreateOrderHandler.ts
│       └── ...
└── shared/           # 複数featureで共有
    ├── database/
    └── middleware/
```

Vertical Slice の選択材料:

| 条件 | 意味・選択肢 |
|------|-------------|
| 機能が独立した業務責務、変更理由、データ所有者を持つ | Slice化の候補 |
| 機能境界が既存の依存方向やデプロイ境界と整合する | Slice化で所有者を明確化できる |
| 複数機能が同じ業務規則と変更理由を共有する | 共通所有者を保つレイヤードまたはハイブリッドを検討 |
| 機能固有の責務と横断基盤が別々の理由で変わる | 機能Sliceと共通基盤を分けるハイブリッドの候補 |

`utils/` や `common/` は、責務や所有者を表さないまま肥大化しやすい。機能とレイヤーを同じ階層で表す構造では、依存方向と変更影響を確認する。

**責務の分離**

- 読み取りと書き込みの責務が分かれているか
- データ取得はルート（View/Controller）で行い、子に渡しているか
- 同じ外部契約の例外変換が境界の所有者に集約され、異なる契約は各境界で扱われているか
- ビジネスロジックがController/Viewに漏れていないか

**プロトコル境界の例外変換**

HTTP、CLI、GraphQL、message consumer などの adapter は、内部例外を外部プロトコルの表現へ変換する境界である。endpoint や handler ごとに同じ try-catch / response 変換を散在させると、ステータス、エラー形状、ログ、認可失敗の扱いが不整合になりやすい。例外変換は adapter 境界の専用レイヤに集約し、真に横断的な変換だけを global handler に置く。


## 境界での解決

設定、Option、provider、権限、パスのような値は、境界で解決してから内部へ渡す。メイン処理は「何が解決済みか」を前提に組み立て、各所で設定ソースを問い合わせない。


```typescript
// 避ける例: 実行層が設定ソースを直接知っている
async function executeWorkflow(options) {
  const engine = new WorkflowEngine({
    provider: options.provider ?? globalConfig.provider,
  });
}

class AgentRunner {
  run(step, options) {
    const provider = options.provider ?? resolveProviderFromConfig();
    return getProvider(provider).call();
  }
}

// 例: 境界で解決し、内部は解決済み値を使う
async function executeWorkflow(options) {
  const context = resolveExecutionContext(options);
  const engine = new WorkflowEngine(context);
}

class AgentRunner {
  run(step, options) {
    return getProvider(options.resolvedProvider).call();
  }
}
```

### Tell, Don't Ask

下位層に設定ソースを問い合わせさせるのではなく、上位層が「これを使え」と解決済みの値を渡す。値の選択責務と実行責務を分離する。


### 腐敗防止層

優先順位解決や外部設定形式の吸収は、境界の専用層に閉じ込める。内部モデルへは正規化済みの値だけを渡す。


### 候補解決と値合成の分離

複数の候補から参照先を選ぶ処理と、選ばれた値を合成する処理は別の契約として扱う。探索順、上書き規則、参照種別を混ぜると、表示・検証・実行で別の結果になりやすい。


```typescript
// 避ける例: 参照種別と探索基準が1つの条件に混ざっている
const root = ref.includes('/') ? currentRoot : ownerRoot

// 例: 種別を先に分類し、種別ごとの探索契約を分ける
const kind = classifyReference(ref)
const root = resolveRootForReference(kind, resolvedPath)
```

### Raw入力の正規化

外部ファイルや設定から読む値は、構文上 valid でも期待する shape とは限らない。境界で unknown として受け、配列・record・scalar へ正規化してから内部処理へ渡す。


### フェーズ分離

入力、解釈、実行、出力を段階で分ける。反復処理は、できる限り「解釈済みの入力をまとめて受け取り、実行だけを繰り返す」構造にする。


```typescript
// 避ける例: 各反復が入力解釈まで担う
for (const item of items) {
  const resolved = resolveItem(item, rawOptions, config);
  const result = execute(resolved);
  output(result);
}

// 例: 先に解釈し、反復は実行だけ
const resolvedItems = items.map((item) => resolveItem(item, rawOptions, config));

for (const item of resolvedItems) {
  const result = execute(item);
  output(result);
}
```

逐次解釈が必要なケースでも、`nextRawInput()` と `resolveInput()` と `executeResolved()` の責務は分ける。性能要件でフェーズを近づけても、責務まで混ぜない。

## コード品質の検出手法

**説明コメント（What/How）の検出基準**

コードの動作をそのまま言い換えているコメントを検出する。


```typescript
// 避ける例: コードの言い換え（What）
// If interrupted, abort immediately
if (status === 'interrupted') {
  return ABORT_STEP;
}

// 避ける例: ループの存在を言い換えただけ
// Check transitions in order
for (const transition of step.transitions) {

// 避ける例: 関数名の繰り返し
/** Check if status matches transition condition. */
export function matchesCondition(status: Status, condition: TransitionCondition): boolean {

// 例: 設計判断の理由（Why）
// ユーザー中断はワークフロー定義のトランジションより優先する
if (status === 'interrupted') {
  return ABORT_STEP;
}

// 例: 一見不自然な挙動の理由
// stay はループを引き起こす可能性があるが、ユーザーが明示的に指定した場合のみ使われる
return step.name;

// 例: 定数の算出根拠
// paddingTop + paddingBottom + button height
const footerHeight = 24 + 12 + 48;
```

**状態の直接変更の検出基準**

配列やオブジェクトの直接変更（ミューテーション）を検出する。

```typescript
// 避ける例: 配列の直接変更
const steps: Step[] = getSteps();
steps.push(newStep);           // 元の配列を破壊
steps.splice(index, 1);       // 元の配列を破壊
steps[0].status = 'done';     // ネストされたオブジェクトも直接変更

// 例: イミュータブルな操作
const withNew = [...steps, newStep];
const without = steps.filter((_, i) => i !== index);
const updated = steps.map((s, i) =>
  i === 0 ? { ...s, status: 'done' } : s
);

// 避ける例: オブジェクトの直接変更
function updateConfig(config: Config) {
  config.logLevel = 'debug';   // 引数を直接変更
  config.steps.push(newStep);  // ネストも直接変更
  return config;
}

// 例: 新しいオブジェクトを返す
function updateConfig(config: Config): Config {
  return {
    ...config,
    logLevel: 'debug',
    steps: [...config.steps, newStep],
  };
}
```

## セキュリティ（基本チェック）

- インジェクション対策（SQL, コマンド, XSS）
- ユーザー入力の検証
- 機密情報のハードコーディング

## テスタビリティ

- 依存性注入が可能な設計か
- モック可能か
- テストが書かれているか

## 抽象化レベルの評価

**条件分岐と抽象化**

分岐の数や構文だけでは抽象化方式を決められない。同じ意味・契約・変更理由を持つ実装が2つ確認できた時点で、共通の所有者へ集約すべきか判断する。外部 I/O とドメイン、方針と仕組み、公開契約と内部実装のように既存の境界がある場合は、最初の実装でも境界を表す抽象化が有効である。将来のバリアントを予測した Strategy やポリモーフィズムは追加しない。

**抽象度の不一致検出**

| パターン | 問題 | 修正案 |
|---------|------|--------|
| 高レベル処理の中に低レベル詳細 | 読みにくい | 詳細を関数に抽出 |
| 1関数内で抽象度が混在 | 認知負荷 | 同じ粒度に揃える |
| ビジネスロジックにDB操作が混在 | 責務違反 | Repository層に分離 |
| 設定値と処理ロジックが混在 | 変更困難 | 設定を外部化 |

**良い抽象化の例**

```typescript
// 条件分岐の肥大化
function process(type: string) {
  if (type === 'A') { /* 処理A */ }
  else if (type === 'B') { /* 処理B */ }
  else if (type === 'C') { /* 処理C */ }
  // ...続く
}

// Mapパターンで抽象化
const processors: Record<string, () => void> = {
  A: processA,
  B: processB,
  C: processC,
};
function process(type: string) {
  processors[type]?.();
}
```

```typescript
// 抽象度の混在
function createUser(data: UserData) {
  // 高レベル: ビジネスロジック
  validateUser(data);
  // 低レベル: DB操作の詳細
  const conn = await pool.getConnection();
  await conn.query('INSERT INTO users...');
  conn.release();
}

// 抽象度を揃える
function createUser(data: UserData) {
  validateUser(data);
  await userRepository.save(data);  // 詳細は隠蔽
}
```

## その場しのぎの検出

「とりあえず動かす」ための妥協を見逃さない。

| パターン | 例 |
|---------|-----|
| 不要なパッケージ追加 | 動かすためだけに入れた謎のライブラリ |
| テストの削除・スキップ | `@Disabled`、`.skip()`、コメントアウト |
| 空実装・スタブ放置 | `return null`、`// TODO: implement`、`pass` |
| モックデータの本番混入 | ハードコードされたダミーデータ |
| エラー握りつぶし | 空の `catch {}`、`rescue nil` |
| マジックナンバー | 説明なしの `if (status == 3)` |

## 未完成コードの検出

未完成コードの判定基準はコーディングポリシーに従う。アーキテクチャレビューでは、TODO/FIXME、空実装、スタブが設計上必要な境界・認可・バリデーション・契約更新の代替になっていないかを見る。

## DRY違反の検出

DRY はコード形状ではなく知識の重複を減らす原則である。同じ意味・契約・変更理由を持つ実装が2つ確認できたら、共通の所有者へ集約するか判断する。集約方法は関数、値オブジェクト、コンポーネント、ポリシーなど、その責務に最も自然な形を選ぶ。

DRY にしないケース:
- ドメインが異なる重複は抽象化しない（例: 顧客用バリデーションと管理者用バリデーションは別物）
- 表面的に似ているが、変更理由が異なるコードは別物として扱う

## 仕様準拠の検証

契約変更の整合性は有効な契約置換ポリシーに従う。アーキテクチャレビューでは、変更が文書化された仕様、型、スキーマ、設定形式と矛盾していないかを見る。

整合が必要になる条件:

| 変更 | 関係する契約 |
|------|---------|
| 設定ファイルの追加・変更 | 文書化された schema、必須フィールド、有効値 |
| 型・schema の追加・変更 | producer、consumer、利用者向け説明、変更対象外の有効な設定 |
| 設計制約に関わる変更 | その制約を定める一次仕様と実装境界 |

## 呼び出しチェーン検証

契約変更の配線漏れはコーディングポリシーに従う。アーキテクチャレビューでは、新しいパラメータ・フィールドが変更ファイル内だけで完結しておらず、実際の呼び出し元・生成元・読み取り側まで届いているかを見る。

契約が呼び出しチェーンを横断する場合、定義だけでは成立しない。値を生成する入口、伝播する呼び出し元、読み取る消費者が同じ意味を共有し、フォールバックも契約上の省略可能性と一致する必要がある。

危険パターン:

| パターン | 問題 | 検出方法 |
|---------|------|---------|
| `options.xxx ?? fallback` で全呼び出し元が `xxx` を省略 | 機能が実装されているのに常にフォールバック | 呼び出し元を確認 |
| テストがモックで直接値をセット | 実際の呼び出しチェーンを経由しない | テストの構築方法を確認 |
| `executeXxx()` が内部で使う `options` を引数で受け取らない | 上位から値を渡す口がない | 関数シグネチャを確認 |

```typescript
// 配線漏れ: projectCwd を受け取る口がない
export async function executeWorkflow(config, cwd, task) {
  const engine = new WorkflowEngine(config, cwd, task);  // options なし
}

// 配線済み: projectCwd を渡せる
export async function executeWorkflow(config, cwd, task, options?) {
  const engine = new WorkflowEngine(config, cwd, task, options);
}
```

呼び出し元の制約による論理的デッドコード:

呼び出しチェーンの検証は「配線漏れ」だけでなく、逆方向——呼び出し元が既に保証している条件に対する不要な防御コード——にも適用する。

| パターン | 問題 | 検出方法 |
|---------|------|---------|
| 呼び出し元がTTY必須なのに関数内でTTYチェック | 到達しない分岐が残る | 全呼び出し元の前提条件を確認 |
| 呼び出し元がnullチェック済みなのに再度nullガード | 冗長な防御 | 呼び出し元の制約を追跡 |
| 呼び出し元が型で制約しているのにランタイムチェック | 型安全を信頼していない | TypeScriptの型制約を確認 |

防御条件の必要性は、到達可能な入口が保証する事前条件で決まる。すべての実在入口が同じ条件を保証するなら内部ガードは論理的に到達不能になり、保証しない入口があるなら境界防御として意味を持つ。

## 公開状態の不変性

モジュールが公開する共有状態（初期状態、シングルトン、設定オブジェクト）では、利用側の変更が別の利用者へ漏れないことが重要である。必要な保証は観測可能な分離であり、ファクトリ、防御的コピー、永続データ構造、freeze などは実装上の選択肢である。公開契約が方式まで定めない限り、再帰的 freeze や参照同一性そのものを必須にしない。

```typescript
// 避ける例: 可変の公開初期状態。利用側が書き換えると全 replay の起点が汚染される
export const initialState: State = { count: 0, entries: {} };

// 選択肢 - freeze で保護（ネストも含めて）
export const initialState: State = Object.freeze({ count: 0, entries: Object.freeze({}) });

// 選択肢 - ファクトリで毎回新しいインスタンスを返す
export function createInitialState(): State {
  return { count: 0, entries: {} };
}
```

## 品質特性

| 特性 | 確認観点 |
|------|---------|
| Scalability | 負荷増加に対応できる設計か |
| Maintainability | 変更・修正が容易か |
| Observability | ログ・監視が可能な設計か |

## 大局観

細かい「クリーンコード」の指摘に終始しない。

品質特性は、要求、現在の負荷、既存の運用契約、または今回変更する境界から必要性を確認できる場合だけ設計条件になる。将来変わるかもしれない、規模が増えるかもしれないという予測だけでは、拡張点や追加レイヤーの根拠にならない。ドメイン命名と現在のビジネス契約の整合は、将来予測とは別に現在の意味契約として扱う。

## 変更スコープの評価

変更スコープは行数ではなく、要求・根本原因・同じ契約を持つ影響経路として論理的にまとまっているかで評価する。広い変更でも不可欠な場合があり、小さい変更でも無関係な編集は過剰である。

論理的なまとまりは、要求、根本原因、同じ契約、または実在する境界を共有することから説明できる。Coder のスコープ宣言は補助証跡であり、実際の変更との不一致がある場合も、要求と影響経路を正として評価する。

## 終了経路の完全性

一時ファイルや外部リソースを生成する機能では、正常終了だけでなく、失敗、キャンセル、強制終了の各終端でも解放されるかを確認します。`process.exit()` と強制終了（SIGINT 連打、abort ハンドラの即時終了）は `finally` を実行しません。`finally` に依存した cleanup は、その内側で `process.exit` が呼ばれる経路や強制終了経路では迂回されます。リソースを生成する入口ごとに、終端の一覧（正常・失敗・キャンセル・強制終了）を作り、cleanup が実行されない終端を列挙してください。


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
// 避ける例: 内部実装をモック（振る舞いではなく実装を検証している）
vi.spyOn(service, 'privateMethod')
service.execute()
expect(service.privateMethod).toHaveBeenCalled()

// 例: 外部依存をモックし、振る舞いを検証
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
// 避ける例: 正常系のみ
test('validates age', () => {
  expect(validateAge(25)).toBe(true)
})

// 例: 境界値を含む
test('validates age at boundaries', () => {
  expect(validateAge(0)).toBe(true)    // 下限
  expect(validateAge(-1)).toBe(false)  // 下限-1
  expect(validateAge(150)).toBe(true)  // 上限
  expect(validateAge(151)).toBe(false) // 上限+1
})
```

## 振る舞い保証

ユニットテストは設定値や内部状態のスナップショットだけでなく、公開された契約が期待どおりに振る舞うことを検証する。拒否、許可、隔離、解放のような境界変更は、主要な成功/失敗ケースを deterministic に確認する。


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
// 避ける例: 配布定義を期待値へ複製し、定義差分だけを検出する
expect(shippedWorkflow.steps.map((step) => step.name)).toEqual(['plan', 'review', 'fix'])

// 例: 最小 fixture で parser の構造契約を検証する
expect(parsedFixture.rules[0]?.next).toBe('fix')
```

個別の配布資産に含まれる step 名、rule、遷移先、設定値を期待値へ丸写しすると、実装とは独立した契約ではなく、同じ定義の複製になる。配布資産は全件 load・schema 適合で破損を検出し、遷移や副作用は最小シナリオの実行結果で検証する。

## テストフィクスチャ設計

テストデータはファクトリ関数で管理する。

- ファクトリ関数で必要最小限のフィクスチャを生成する
- テストに無関係なフィールドはデフォルト値で埋める
- 共有フィクスチャを変更して使い回さない（テスト間の独立性を保つ）

```typescript
// 避ける例: 全フィールドを毎回定義
const user = { id: '1', name: 'test', email: 'test@example.com', role: 'admin', createdAt: new Date() }

// 例: ファクトリ関数で必要最小限
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
// 避ける例: 直接依存を生成（テストでモック不可）
class OrderService {
  private repo = new OrderRepository()
  async create(order: Order) { return this.repo.save(order) }
}

// 例: コンストラクタ注入（テストでモック可能）
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


## 振る舞い観測

E2Eテストはユーザーから見える振る舞いを観測する。設定値、ログ、スナップショットの確認だけでは、実際の拒否、許可、隔離、回復が起きたことを保証しない。


## 否定契約の観測

E2E で権限、実行時に選択される能力・バックエンド・オプション、設定、拒否、隔離を確認する場合、出力全体への文字列否定は証拠として弱い。
対象の行、イベント、レコード、フィールド、呼び出し引数などを取り出し、禁止値ごとに検査することで、順序、大小文字、空白、区切り、部分漏れによる見逃しを防ぐ。


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
// 避ける例: 固定 sleep でタイミングを合わせる
await sleep(3000)
expect(result).toBeDefined()

// 例: 条件ベースで待機する
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
