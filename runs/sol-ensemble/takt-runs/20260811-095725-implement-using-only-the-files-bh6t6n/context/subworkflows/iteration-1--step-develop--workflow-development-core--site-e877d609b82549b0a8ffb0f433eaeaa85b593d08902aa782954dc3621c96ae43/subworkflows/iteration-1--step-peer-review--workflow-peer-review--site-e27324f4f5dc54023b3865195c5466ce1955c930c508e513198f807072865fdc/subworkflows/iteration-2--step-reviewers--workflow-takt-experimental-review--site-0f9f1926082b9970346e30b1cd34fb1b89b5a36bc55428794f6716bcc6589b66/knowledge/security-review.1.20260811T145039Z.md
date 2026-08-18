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

# セキュリティ知識

## AI生成コードのセキュリティ問題

AI生成コードには特有の脆弱性パターンがある。

| パターン | リスク | 例 |
|---------|--------|-----|
| もっともらしいが危険なデフォルト | 高 | `cors: { origin: '*' }` は問題なく見えるが危険 |
| 古いセキュリティプラクティス | 中 | 非推奨の暗号化、古い認証パターンの使用 |
| 不完全なバリデーション | 高 | 形式は検証するがビジネスルールを検証しない |
| 入力を過度に信頼 | 重大 | 内部APIは常に安全と仮定 |
| コピペによる脆弱性 | 高 | 同じ危険なパターンが複数ファイルで繰り返される |

特に厳しく審査が必要:
- 認証・認可ロジック（AIはエッジケースを見落としがち）
- 入力バリデーション（AIは構文を検証しても意味を見落とす可能性）
- エラーメッセージ（AIは内部詳細を露出する可能性）
- 設定ファイル（AIは学習データから危険なデフォルトを使う可能性）

## 優先順位解決・オーバーライド・信頼境界

複数の設定ソースや定義ソースを優先順位で解決する仕組み、意図的なオーバーライド、拡張ポイントは、それ自体では脆弱性ではない。重要なのは、変更が信頼境界を壊したか、低信頼側に新しい攻撃能力を与えたかである。

| 基準 | 判定 |
|------|------|
| documented な優先順位に従い、同じ利用者・同じ trust level 内で設定や定義が解決される | OK |
| 明示的な selector や引数指定で対象が選ばれ、既存の優先順位モデルに従って解決される | OK |
| 低い優先順位の定義より高い優先順位の定義が採用されても、それが既存のカスタマイズ契約の範囲内で、権限拡大や新しいデータアクセスを伴わない | 警告以下。通常は REJECT にしない |
| 低信頼側が高信頼側の設定や定義を上書きでき、その結果として新しいコード実行、高信頼資産の内容変更、データ取得、認可回避が可能になる | REJECT |
| 対話的な確認ステップがなくなったが、明示指定で意図は十分に一意で、trust boundary も変わらない | OK |
| 対話的な確認ステップが唯一の境界防御であり、それを外すことで低信頼側の override が silent に有効になる | REJECT になりうる。攻撃前提と影響を具体化する |

### 判定のしかた

優先順位解決やオーバーライドを脆弱性として扱うには、次を具体的に示す必要がある。

- 誰が低信頼側で、どの入力や設定を制御できるか
- 何が高信頼資産か
- 変更前にはできず、変更後に初めて可能になったことは何か
- その挙動が仕様上の precedence や拡張点の範囲を超えている理由

既に複数スコープの定義ファイルや設定ソースで挙動を調整できる設計なら、同じ trust level の別の定義を選べるようになっただけでは、通常は新しい攻撃能力とはいえない。

## OWASP Top 10 チェックリスト

| カテゴリ | 確認事項 |
|---------|---------|
| A04 Insecure Design | セキュリティ設計パターン |
| A05 Security Misconfiguration | デフォルト設定、不要な機能 |


---

# CLI・ローカル実行セキュリティ知識

## 適用条件

CLI、shell/process起動、ファイルシステム、ローカル設定を扱う変更に適用する。

## インジェクション攻撃

**コマンドインジェクション**

- `exec()`, `spawn()` での未検証入力 → REJECT
- シェルコマンド構築時のエスケープ不足 → REJECT

```typescript
// NG
exec(`ls ${userInput}`)

// OK
execFile('ls', [sanitizedInput])
```

## ファイル操作

**パストラバーサル**

- ユーザー入力を含むファイルパス → REJECT
- `../` のサニタイズ不足 → REJECT

```typescript
// NG
const filePath = path.join(baseDir, userInput)
fs.readFile(filePath)

// OK
const safePath = path.resolve(baseDir, userInput)
if (!safePath.startsWith(path.resolve(baseDir))) {
  throw new Error('Invalid path')
}
```

## OWASP Top 10 チェックリスト

| カテゴリ | 確認事項 |
|---------|---------|
| A03 Injection | コマンド |


---

# データ・機密情報セキュリティ知識

## 適用条件

機密情報、ログ、エラーレスポンス、暗号化を扱う変更に適用する。

## データ保護

**機密情報の露出**

- APIキー、シークレットのハードコーディング → 即REJECT
- ログへの機密情報出力 → REJECT
- エラーメッセージでの内部情報露出 → REJECT
- `.env` ファイルのコミット → REJECT

## ログとマスキング

機密情報がログやレスポンスに露出するのを防ぐ。

**ログに出力してはいけない情報:**
- パスワード、トークン、APIキー
- クレジットカード番号、個人識別番号
- セッションID、認証ヘッダの値
- 個人情報（メールアドレス、電話番号）のうち、デバッグ目的で不要なもの

**マスキングパターン:**

```typescript
// NG - パスワードがログに露出
logger.info('User login attempt', { email, password })

// OK - 機密フィールドを除外
logger.info('User login attempt', { email })
```

```kotlin
// NG - リクエスト全体をログ出力
logger.info("Request: {}", request)

// OK - 機密フィールドをマスク
logger.info("Request: userId={}, action={}", request.userId, request.action)
```

**構造化ログでのフィールドフィルタリング:**

ログ出力にオブジェクトを渡す場合、`toString()` や JSON シリアライズで機密フィールドが含まれないようにする。

```kotlin
// NG - data class の toString() がパスワードを含む
data class UserCredentials(val email: String, val password: String)

// OK - toString() をオーバーライドしてマスク
data class UserCredentials(val email: String, val password: String) {
    override fun toString(): String = "UserCredentials(email=$email, password=***)"
}
```

| 基準 | 判定 |
|------|------|
| ログ出力にパスワード・トークン・APIキーが含まれる | REJECT |
| エラーレスポンスにスタックトレースや内部パスが含まれる | REJECT |
| data class の toString() が機密フィールドを露出する | REJECT |
| ログレベルに関わらず機密情報が出力される可能性がある | REJECT |
| デバッグログに個人情報が含まれるが本番で無効化されている | 警告。設定ミスのリスクがある |

## 暗号化

- 弱い暗号アルゴリズムの使用 → REJECT
- 固定IV/Nonceの使用 → REJECT
- 暗号化キーのハードコーディング → 即REJECT
- HTTPSの未使用（本番環境） → REJECT

## エラーハンドリング

- スタックトレースの本番露出 → REJECT
- 詳細なエラーメッセージの露出 → REJECT
- エラーの握りつぶし（セキュリティイベント） → REJECT

## OWASP Top 10 チェックリスト

| カテゴリ | 確認事項 |
|---------|---------|
| A02 Cryptographic Failures | 暗号化、機密データ保護 |
| A09 Logging Failures | セキュリティログ |


---

# 依存関係セキュリティ知識

## 適用条件

依存関係を扱う変更に適用する。

## 依存関係

- 既知の脆弱性を持つパッケージ → REJECT
- メンテナンスされていないパッケージ → 警告
- 不必要な依存関係 → 警告

## OWASP Top 10 チェックリスト

| カテゴリ | 確認事項 |
|---------|---------|
| A06 Vulnerable Components | 依存関係の脆弱性 |
| A08 Software Integrity | コード署名、CI/CD |
