# 事後審判（codex gpt-5.5 固定審判による最終コード品質採点）

| combo | rep | correctness | design | readability | robustness | overall | 総評 |
|-------|-----|-------------|--------|-------------|------------|---------|------|
| qwen-coder | 1 | 7 | 7 | 7 | 6 | 7 | 基本的なイベントソーシング構成は満たしており、decide/evolve、EventStore、CommandHandler、Projection の責務分離も概ね良好です。一方で、壊れたイベント列や外部からのミューテーションに弱く、型安全性を自分で崩している箇所があるため、レビューなしでマージするには少し不安があります。 |
| qwen-coder_gemma-reviewer | 1 | 7 | 7 | 7 | 6 | 7 | 全体として仕様の主要フローは素直に満たしており、decide/evolve、EventStore、CommandHandler、Projection の責務分離も概ね妥当です。ただし、不正なイベント列や外部からのミューテーションに弱く、Projection が異常を黙殺するため、レビューなしでそのままマージするには少し危うい実装です。 |
| qwen-coder_qwen-coder-reviewer | 1 | 7 | 7 | 7 | 6 | 7 | 純粋な decide/evolve、EventStore ポート、CommandHandler、Projection という主要構成は満たしており、全体として仕様の骨格は実装できています。一方で Projection が不正なイベント列を黙って補正する点と、内部状態を外部に漏らす点が品質上の主な弱点です。 |
| qwen-coder_qwen-instruct-reviewer | 1 | 7 | 7 | 8 | 6 | 7 | ドメイン層の純粋性、イベントストアの楽観的並行性制御、CommandHandler の流れは概ね仕様に沿っています。ただし、投影が不正なイベント順序を黙って無視する点、初期状態共有や Record 利用による境界ケース、存在確認漏れなどがあり、レビューなしで通すには少し弱い実装です。 |

## qwen-coder (r1) の指摘
- evolve の StockShipped で state.reservations[event.reservationId]! を使っており、存在しない予約の出荷イベントを replay すると onHand が NaN になります。Fail Fast でも無害化でもなく、状態破壊として出るのが弱いです。
- decideReleaseReservation と decideShipStock が Product does not exist を明示的に検査していません。通常フローでは予約がないため失敗しますが、不正な ProductState を渡された場合の不変条件チェックとしては不足しています。
- decideCreateProduct などの helper が Command を受け取り、内部で CreateProduct などへ型アサーションしています。switch で既に narrowing できるため、helper の引数を具体型にした方が型安全で読みやすいです。
- InMemoryEventStore は配列をコピーしていますが、イベントオブジェクト自体は共有しています。append 後に呼び出し側がイベントを変更すると保存済みイベントも変わり得るため、堅牢性は限定的です。
- StockProjection の updateStock と trackReservation は未知 productId のイベントを黙って無視します。Projection はイベント列の異常を検出できる場所なので、無視より明示的に失敗する方が安全です。
- StockProjection.getStock は内部の StockLevel オブジェクトをそのまま返すため、呼び出し側が値を書き換えると Projection の内部状態が破壊されます。コピーを返すべきです。
- CreateProduct で name を trim してイベントに保存しており、入力された事実をそのまま残す方針とは少しずれます。仕様上許容される可能性はありますが、参照実装とは意味論が異なります。
- domain.ts の末尾 import と helper 内の型キャストは可読性を落としています。実害は小さいものの、レビュー時に気になる構成です。

## qwen-coder_gemma-reviewer (r1) の指摘
- StockProjection が ProductCreated 前の StockReceived/StockReserved などを黙って無視しており、イベント列の破損や適用順序のバグを検知できません。Fail Fast の観点では例外にした方が堅牢です。
- InMemoryEventStore は配列だけをコピーし、DomainEvent オブジェクト自体は同じ参照を保持します。append 後や load 後に呼び出し側がイベントオブジェクトを変更できるため、保存済みイベントの不変性が守られません。
- initialState が mutable なオブジェクトとして公開されています。利用側が initialState や reservations を変更すると replay の基準状態が壊れる可能性があります。
- evolve の StockShipped で state.reservations[e.reservationId]! を使っており、不正なイベント列では onHand が NaN になり得ます。ドメイン層でイベント列の整合性を信頼する設計なら許容範囲ですが、堅牢性は落ちます。
- productId や reservationId の空文字、空白だけの値は検証されていません。仕様に明記がなければ必須とは言い切れませんが、在庫管理の識別子としては境界ケースが残ります。
- quantity は正の整数チェックがありますが、Number.MAX_SAFE_INTEGER を超える値は許容され、加算・減算で精度が崩れる可能性があります。
- domain.ts の newState 変数、index.ts と command-handler.ts の一部 import、ProductInfo.exists など未使用要素があり、可読性と仕上げの粗さが少し目立ちます。
- switch 内で event as ProductCreated などの型アサーションを多用していますが、判別共用体により通常は不要です。型システムを十分に活かせていません。
- InMemoryEventStore は versions Map と events.length の二重管理になっています。現状のメソッド経由では破綻しにくいものの、単一情報源にした方が設計は簡潔です。

## qwen-coder_qwen-coder-reviewer (r1) の指摘
- StockProjection.getStock が内部の StockLevel オブジェクトをそのまま返しており、呼び出し側が onHand/reserved/available を書き換えると Projection の内部状態が破壊される。コピーを返すべきです。
- StockProjection.adjustStock が未作成 productId に対して暗黙に行を作るため、ProductCreated より前の StockReceived/StockReserved を検知できない。イベントストリーム破損を Fail Fast できず、読み取りモデルが誤った状態を作ります。
- StockProjection は存在しない reservationId の ReservationReleased/StockShipped を黙って無視する。イベントソーシングでは不正イベント列を隠す挙動になり、障害解析が難しくなります。
- StockProjection で同じ reservationId の StockReserved が複数回来ると reserved は加算される一方、reservations は上書きされるため、後続の release/ship 後に reserved が不整合になります。ドメインが通常は防ぐとしても Projection 単体の堅牢性は弱いです。
- releaseReservation/shipStock は state.exists を明示的に検証していない。通常の replay 状態では問題化しにくいものの、壊れた ProductState を渡された場合に「存在しない商品だが予約だけある」状態を受け入れます。
- DomainError/ConcurrencyError にメッセージがなく、失敗理由の診断性が低い。ライブラリとしては呼び出し側・運用時のデバッグがしづらいです。
- domain.ts と projection.ts に switch case 内では不要な type guard や未使用のイベント type guard があり、型設計に対する信頼感と可読性を少し下げています。
- CommandHandler が currentStreamId/currentState/loadedVersion をインスタンス状態として保持しているが、handle 内のローカル変数で完結できる。不要な可変状態があり、再入・並行利用時の見通しを悪くしています。

## qwen-coder_qwen-instruct-reviewer (r1) の指摘
- projection.ts: StockReceived / StockReserved / ReservationReleased / StockShipped が ProductCreated 未適用の productId を受けても黙って無視します。イベントのみから構築する Projection としてはイベント列の破損を Fail Fast できず、読み取りモデルの欠落を隠します。
- domain.ts: ReleaseReservation と ShipStock で state.exists を明示確認していません。通常は予約がなければ弾かれますが、状態オブジェクトが不整合な場合に「商品が存在する」という不変条件を直接守っていません。
- domain-evolve.ts: initialState が mutable なオブジェクトとして公開されており、外部から変更されると replay の起点が壊れます。evolve 自体は新しいオブジェクトを返しますが、公開 API としては Object.freeze や factory の方が堅牢です。
- domain.ts / domain-evolve.ts / projection.ts: reservations を通常の Record で扱い、in 演算子を使っています。__proto__ や constructor などの特殊キー、プロトタイプ汚染系の入力に弱く、予約IDが外部入力なら Map か Object.create(null) の方が安全です。
- event-store.ts: append は events が空でも version 不一致を検査してから成功しますが、CommandHandler は newEvents.length > 0 の場合しか append しません。現在の decide は常にイベントを返すか例外ですが、将来 no-op コマンドが入ると競合検出の意味が変わります。
- index.ts / command-handler.ts: 未使用 import が残っています。挙動には影響しませんが、公開面の小さな実装としては仕上げが甘く見えます。
- DomainError / ConcurrencyError にメッセージがなく、呼び出し側やデバッグ時に原因を判別しづらいです。テスト向けには十分でも、ライブラリ品質としては診断性が低いです。
