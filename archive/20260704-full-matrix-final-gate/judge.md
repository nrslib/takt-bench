# 事後審判（codex gpt-5.5 固定審判による最終コード品質採点）

| combo | rep | correctness | design | readability | robustness | overall | 総評 |
|-------|-----|-------------|--------|-------------|------------|---------|------|
| codex-all | 1 | 8 | 8 | 9 | 7 | 8 | 全体として、decide/evolve の純粋性、EventStore ポート、OCC、CommandHandler の流れ、モジュール分割は素直でかなり良い実装です。ただし Projection が壊れたイベント順序や未知の商品イベントを黙って受け入れる点と、予約IDを通常オブジェクトで扱う境界ケースに弱さがあります。 |
| qwen-coder | 1 | 7 | 8 | 7 | 5 | 7 | 主要なイベントソーシング構成と通常系の不変条件は押さえられており、層分離も小規模ライブラリとしては妥当です。一方で、無効なイベント列や特殊な reservationId を静かに受け入れる箇所があり、レビューなしでそのままマージするには堅牢性が足りません。 |
| qwen-coder_gemma-reviewer | 1 | 6 | 6 | 7 | 5 | 6 | 主要なイベントソーシングの流れは実装できていますが、CommandHandler にドメイン判断ロジックが重複しており、層分離と保守性に明確な弱さがあります。さらに Projection と InMemoryEventStore が不整合や外部変更を静かに許すため、レビューなしでのマージは避けたい品質です。 |
| qwen-coder_qwen-coder-reviewer | 1 | 7 | 8 | 8 | 6 | 7 | 全体として、イベントソーシングの基本構造は素直で、decide/evolve、EventStore、CommandHandler、Projection の責務分離も概ね良好です。一方で、イベント列が不正な場合に fail fast せず NaN や幽霊レコードを作る箇所があり、レビューなしでマージするには堅牢性に不安があります。 |
| qwen-coder_qwen-instruct-reviewer | 1 | 7 | 7 | 8 | 6 | 7 | 全体として仕様の主要フローは素直に実装されており、層分離も小規模ライブラリとしては概ね妥当です。ただし Projection と InMemoryEventStore に、テスト外の不正順序・特殊ID・外部変更に弱い箇所があり、レビューなしでそのままマージするには少し危ういです。 |

## codex-all (r1) の指摘
- StockProjection が ProductCreated 前の StockReceived/StockReserved/StockShipped などを受けても fail fast せず、暗黙に行を作成します。イベントストリームの破損や順序ミスを隠し、後続の ProductCreated で既存値を 0 に戻す可能性があります。
- StockProjection は reserved を denormalized に保持しつつ reservations Map も保持しているため、同一 reservationId の StockReserved が重複して流れると reserved が二重加算され、getStock の値がイベント列から再計算した値と乖離します。
- ReservationReleased / StockShipped で存在しない reservationId を受けた場合、Projection は 0 として処理して黙殺します。ドメインが正しいイベントだけを出す前提なら動きますが、読み取りモデルとしては異常イベントの検出力が弱いです。
- ProductState.reservations が通常の Record<string, number> なので、reservationId に toString や constructor などのプロトタイプ由来キーが来ると assertReservationExists や重複チェックが誤判定する可能性があります。Object.create(null) や Map の方が堅牢です。
- InMemoryEventStore.append は events 配列内のイベントを shallow copy するだけで、イベントオブジェクト自体は外部参照のままです。呼び出し側が後からイベントを mutate できるため、完全な不変ログとしては弱いです。

## qwen-coder (r1) の指摘
- projection.ts: updateProduct が未知の商品に対するイベントを無視するため、イベント順序の破損や別ストリーム混入を検出できません。Projection はイベントのみから構築される読み取りモデルなので、破損入力は Fail Fast すべきです。
- projection.ts: reserved を reservations から計算できる派生値として別保持しており、状態の正規化に反しています。現在の通常フローでは同期していますが、バグや無効イベントで不整合を作りやすい設計です。
- projection.ts: ReservationReleased / StockShipped で未知の reservationId を `|| 0` として処理しており、読み取りモデル上の不整合を隠します。特に StockShipped は在庫減算なしで処理済みのように進むため危険です。
- domain.ts: reservationId の存在判定に `in state.reservations` を使っているため、`toString` など prototype 上のキーを予約IDにした場合に誤判定します。`Object.hasOwn` または `Map` / null prototype の Record を使うべきです。
- domain.ts: reservations が通常の object なので、`__proto__` などの特殊キーを reservationId にするとオブジェクトプロトタイプ絡みの不正な挙動を招きます。外部入力由来のIDとしては境界値が弱いです。
- domain.ts: ProductId / reservationId の空文字や空白のみ文字列を拒否していません。型上は string なので、ドメイン不変条件として扱うなら明示バリデーションが必要です。
- domain.ts / projection.ts: switch の runtime default がなく、型をすり抜けた未知イベントは evolve/apply で静かに無視されます。ライブラリ境界では TypeScript の型だけに頼らず、破損イベントを検出する方が堅牢です。
- types.ts: DomainError / ConcurrencyError にメッセージがなく、障害解析時にどの不変条件に違反したか分かりません。テスト上は同じでも、運用・デバッグ品質は落ちます。
- command-handler.ts: `newEvents.length > 0` のときだけ append しており、仕様の `load → replay → decide → append` から少し外れています。現状のコマンドは常にイベントを返すため実害は小さいですが、将来 no-op コマンドが入ると期待 version の検査を飛ばします。

## qwen-coder_gemma-reviewer (r1) の指摘
- CommandHandler が exported な domain.decide を使わず、同じ decide ロジックを private method として丸ごと複製している。ドメイン不変条件が2箇所に分散し、将来片方だけ修正されると挙動が分岐する。
- StockProjection が未知の商品イベントや未知の予約解放・出荷を黙って無視する。イベント列の破損や順序不正を検出できず、Fail Fast ではなく誤った読み取りモデルを作る可能性がある。
- StockProjection.getStock が内部の StockLevel オブジェクト参照をそのまま返しているため、呼び出し側が戻り値を変更すると Projection 内部状態が破壊される。
- InMemoryEventStore.load は配列だけを浅くコピーしており、イベントオブジェクト自体は共有される。append 後や load 後にイベントを外部から mutate でき、イベントストアの不変性が弱い。
- Record<string, ...> を通常オブジェクトとして使っているため、productId や reservationId が toString、constructor、__proto__ などの場合にプロトタイプ由来の衝突や異常動作が起きうる。Map か Object.create(null) の方が堅い。
- InMemoryEventStore は EventStore interface と構造的には一致しているが implements EventStore を明示していないため、ポート実装としての型チェック意図が弱い。
- domain.decide と handler.decide の重複により、可読性も悪化している。判断ロジックを読む場所が増え、レビュー時に両者の一致確認が必要になる。
- evolve と Projection の一部で存在しない予約を 0 扱いまたは無視する経路があり、壊れたイベントストリームに対する検出力が低い。

## qwen-coder_qwen-coder-reviewer (r1) の指摘
- StockShipped の evolve で `state.reservations[event.reservationId]!` をそのまま減算しており、壊れたイベント列や手書きイベントで予約が存在しない場合に `onHand` が `NaN` になる。少なくとも fail fast すべきです。
- StockProjection.apply が ProductCreated 以外のイベントでも暗黙に product 行を作るため、`StockReceived` だけのイベント列でも存在する商品として投影される。イベント順序や欠落を隠してしまいます。
- StockProjection の StockShipped でも予約がない場合に `undefined` を減算して `NaN` になり得る。読み取りモデルはドメインほど厳格でなくてもよいですが、壊れたイベントを黙って壊れた状態にするのは弱いです。
- InMemoryEventStore はイベント配列自体はコピーして返すが、イベントオブジェクトは共有参照のままなので、load 後に取得側がイベントをミューテートすると保存済みイベントが破壊され得る。テスト用途なら許容範囲ですが、堅牢なポート実装としては浅いです。
- productId や reservationId の空文字・空白文字を検証していない。公開型が単なる string なので、境界値への防御としては不足しています。
- versions Map と store Map を別々に持っており、現状の append 実装では整合していますが、イベント数から導ける version を二重管理しているため設計上のズレ要因になります。

## qwen-coder_qwen-instruct-reviewer (r1) の指摘
- InMemoryEventStore が append 時にイベントオブジェクトをそのまま保持し、load でも浅いコピーしか返さないため、append 後または load 後に呼び出し側がイベントオブジェクトを変更すると保存済み履歴が破壊されます。イベントストアとしては履歴の不変性を守れていません。
- Record<string, ...> を通常オブジェクトで辞書利用しているため、productId や reservationId が `toString`、`constructor`、`__proto__` などの場合にプロトタイプ由来プロパティと衝突します。EventStore、domain の reservations、Projection の内部辞書すべてに影響します。
- StockProjection が `onHand`、`reserved`、`available` と reservationQuantities を二重管理しており、重複予約イベントや不正順序イベントで簡単に不整合になります。読み取りモデルはイベントのみから再構築する責務なので、派生値は都度計算する方が堅いです。
- StockProjection.updateStock は未知の商品へのイベントを黙って無視し、Release/Ship で未知の reservationId を `0` として扱います。壊れたイベント列を Fail Fast できず、投影結果の欠落や不整合を隠します。
- domain.evolve の StockShipped は `!` で予約数量の存在を仮定しており、不正なイベント列では `NaN` を作り得ます。イベントソーシングでは replay が中核なので、壊れた履歴を検出するか、少なくとも安全に扱う方針が必要です。
- CommandHandler、domain、event-store、projection の分割は過不足なく読みやすい一方、`types.ts` にドメイン型・エラー・EventStore ポートが同居しており、規模が伸びるとドメイン契約とインフラポートの境界が曖昧になりやすいです。現時点では大きな減点ではありません。
- CreateProduct で name を trim してイベントに保存しており、入力値を正規化する設計としては理解できますが、公開契約に明示がない場合は観測可能な値の変更になります。仕様として意図を固定した方がよいです。
