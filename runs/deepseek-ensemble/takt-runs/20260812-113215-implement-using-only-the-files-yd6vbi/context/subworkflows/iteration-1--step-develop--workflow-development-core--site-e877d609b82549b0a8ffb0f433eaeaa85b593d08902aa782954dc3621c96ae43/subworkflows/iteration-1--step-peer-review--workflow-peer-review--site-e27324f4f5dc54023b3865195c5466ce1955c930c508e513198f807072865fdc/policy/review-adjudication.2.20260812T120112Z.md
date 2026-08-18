# レビュー指摘裁定ポリシー

提出済み指摘の技術的妥当性と今回の修正権限を分離し、許可された修正対象だけを確定する。

## 探索権限と finding・修正権限

active contract family の共通所有者、同じ意味を別名で再構築する重複実装、未確認・未移行 consumer を特定する bounded horizontal comparison は、その family を閉じるための証拠収集として許可する。比較中に隣接する別 family の問題を観察しても、それ自体は finding 化、Companion の修正要求、修正計画への追加を許可しない。

follow-up で新しい finding を許可する Authorization Basis は次の4つだけとする。すべての新しい finding に Authorization Basis と Reason Absent（初回レビューに含まれなかった理由）を記録する。

| Authorization Basis | 許可条件 |
|---------------------|----------|
| `accepted_family_unvisited_consumer` | active accepted family と同じ不変条件、正本、根本原因を持つ未確認 consumer |
| `remediation_regression` | 今回の修正が導入した退行 |
| `direct_acceptance_criterion_violation` | 元の受入条件への直接違反 |
| `required_consumer_migration` | 変更済み契約を成立させるために必須の consumer migration |

通常経路と isolated failure path が同じ不変条件、正本、根本原因を共有する場合は1つの family として扱う。bounded horizontal comparison で見つけた隣接・別 family は、4つの Authorization Basis のいずれにも該当しない限り new finding にせず、修正範囲にも入れない。

Companion は、権限のない隣接・別 family を `must_fix`、`should_fix`、`nit`、または実質的な修正要求を残す note に昇格させない。Moderator はそのような指摘を `reject` する。Review Adjudication は技術的に妥当な指摘でも修正権限がなければ `out_of_scope` とし、actionable family や fix plan へ伝播させない。


## 原則

| 原則 | 基準 |
|------|------|
| 証拠優先 | 現在のコード、要求、レポート、実行証跡で確認できる事実だけを裁定根拠にする |
| 観察と権限の分離 | 技術的に妥当な欠陥でも、今回の修正を許可する根拠がなければ修正対象にしない |
| 権限根拠の限定 | 受入条件の直接違反、今回の差分が導入した退行、必須 consumer migration、採用済み contract family の閉鎖だけを修正権限にする |
| family の縦方向閉鎖 | 採用済み family は定義から terminal・API 出力まで同じ不変条件を持つ全実在経路を閉じる |
| 水平境界 | 近接性、一般品質、同じファイルという理由で隣接する別契約や改善へ広げない |
| 最小内部修正 | 既存の観測可能契約を維持する最小の内部修正で、確認済みの欠陥を解消できる形にする |
| 過剰方式の不採用 | atomicity、transaction、rollback、資源上限、互換経路など、確認済みの欠陥を超える新しい外部挙動・契約・制限・保証・運用要件を要求しない |
| 提案と権限の分離 | reviewer の重大度、REJECT、修正案、critical 分類は、今回の修正を要求する権限の根拠にしない |
| 一意な裁定 | すべての finding ID をちょうど1つの裁定へ対応付け、同じ原因だけを1つの family に統合する |
| 再計画の限定 | 指摘、要求、計画が競合し、現行の前提で修正対象を確定できない場合だけ再計画とする |

## 修正対象の範囲

| 状況 | 判定 |
|------|------|
| 元要求・受入条件へ直接違反している | `actionable` — `direct_acceptance_criterion_violation` |
| 今回の差分または修正が、変更前に存在しなかった退行を導入した | `actionable` — `remediation_regression` |
| 変更・置換した契約を成立させる現行 consumer の移行が必須である | `actionable` — `required_consumer_migration` |
| 既に採用した contract family と同じ不変条件を持つ未確認 consumer の欠陥である | `actionable` または同じ family への `duplicate` — `accepted_family_unvisited_consumer` |
| 技術的に妥当だが、上記の権限根拠を持たない別契約の品質欠陥・改善である | `out_of_scope` |
| 実在する欠陥の証拠がなく、より強い方式・保証・一般作法だけを要求する | `overreach` |

## 提案方式と元の欠陥

指摘本文に実在する欠陥と過剰な修正方式が併記されている場合、欠陥の事実性、修正権限、修正方式を別々に判定する。元の欠陥が修正権限を持つ場合は、finding を `actionable` または同じ family への `duplicate` とし、受入条件には必要な最小修正と既存契約の保持だけを記録する。元の欠陥が技術的に妥当でも権限根拠がなければ `out_of_scope` とし、欠陥の証拠がなく方式だけを要求していれば `overreach` とする。

## 非修正の分類

`duplicate` は同じ根本原因と受入条件を持つ統合可能な指摘だけに使い、統合先 family を示す。`false_positive` / `no_issue_after_verification` は現在のコードまたは証跡が主張と矛盾する場合、`out_of_scope` は確認済みだが修正権限のない別契約の欠陥・改善、`overreach` は証拠または権限を超える方式・保証の要求、`environment_unverified` は環境要因の全条件を満たし実装欠陥を確認できない場合だけに使う。環境制限で実装欠陥の証拠を退けてはならない。

## 裁定の完全性

各 actionable family には、権限根拠、破られた不変条件、定義・生成・正規化・検証・全 consumer・retry・fallback・parallel・永続化・復元・terminal・API 出力のうち関係する実在経路、観測可能な受入条件、修正境界を記録する。未解決の actionable を重大度、発見時期、発見率、記録済みであることを理由に完了へ送ってはならない。裁定できない懸念は推測で非修正へ落とさず、未解決の前提として記録する。


---

# 契約置換ポリシー

既存契約の保持、現行利用側の移行、置換対象の旧契約を支える互換・移行を分離し、要求ソースが認めた範囲だけを実装する。

## 原則

| 原則 | 基準 |
|------|------|
| 対象外契約の保持 | 要求の変更対象外にある観測可能な既存契約は維持する |
| 利用側移行 | 置換対象の旧契約を使う現行利用側は新契約へ移行する |
| 旧経路削除 | 明示的に支援対象とされた経路を除き、置換対象の旧経路は削除する |
| 明示要求だけを権限にする | 後方互換、legacy support、移行支援、並存は、要求ソースが明示した対象・範囲だけを許可する |
| 必要な方式だけを使う | 明示された対象を満たすために必要な方式だけを追加・維持する |

## 判定基準

| 基準 | 判定 |
|------|------|
| 変更対象外にある観測可能な既存契約を維持する | OK |
| 置換対象の旧契約を使う現行利用側を新契約へ移行する | OK |
| 旧契約の生成・読込・alias・fallback・変換・upcaster・backfill・data migration・rebuildを、対象への明示要求なしに追加・維持する | REJECT |
| 明示された支援の対象・範囲を超える、または不要な方式を追加する | REJECT |
| API互換への権限をevent upcaster、data migration・backfill、Read Model rebuildなど別の支援対象へ広げる | REJECT |
| 要求ソースにない期限、廃止時期、終了条件、移行日程を要求または補完する | REJECT |

## 根拠の境界

現行コード、既存テスト・利用箇所、保存済みデータ、公開・リリース状態、読込境界への配置・隔離は、影響経路と現行利用側を調べる証拠として扱う。それだけを、置換対象の旧契約を支援する権限にはしない。

明示的な支援要求がある場合も、対象と範囲を記録し、その振る舞いを直接検証する。支援対象ごとに独立して判定し、1つの対象への権限を他へ広げない。


---

# TAKT テスト実行ポリシー

TAKT のテストを実境界に従って分類し、開発速度と完了証拠を両立する。

## 原則

| 原則 | 基準 |
|------|------|
| 実境界で分類 | ファイル名や所要時間ではなく、実際に通る依存境界でレイヤーを決める |
| unit を開発ループに限定 | 実装中の反復確認は高速な unit gate を使う |
| 軽い IT で完了確認 | 実装完了時に軽い IT gate を実行する |
| 変更した重い IT は自己検証 | 追加・変更した重い IT は対象指定で担当者が実行する |
| 分類契約を個別確認 | IT を追加・変更したら分類契約テストを単体実行する |
| 全重い IT は PR gate | 変更外を含む全重い IT は Pull Request で確認する |
| PR へ初回実行を委ねない | PR gate は変更した重い IT の対象実行を代替しない |
| 実行結果を証拠化 | 開始したコマンドではなく、完了結果と終了状態を報告する |

## レイヤー分類

TAKT ナレッジの unit、軽い IT、重い IT、E2E の境界定義を正本とする。分類に迷う場合は、対象が実際に通る call chain と副作用を確認する。

| 基準 | 判定 |
|------|------|
| 直接依存を test double に置き換えた個別ロジック | unit |
| 実 filesystem、SQLite、bounded storage、複数コンポーネント結合 | 軽い IT |
| 実 child process、Git、完全な workflow engine、計測済み高負荷処理 | 重い IT |
| 利用者の公開入口から全体を実行し、利用者可視の結果を観測 | E2E |
| 実 process を使うが内部 client から偽 CLI を呼ぶ | 重い IT。E2E ではない |
| 遅いという理由だけでレイヤーを変更 | REJECT |

## 開発中の検証

実装中は unit gate を反復し、実装がまとまった時点で軽い IT gate を実行する。全重い IT のローカル反復は通常の完了条件にしない。

| 状態 | 必須の確認 |
|------|-----------|
| プロダクションコードのみ変更 | 変更対象の unit と完了時の軽い IT |
| unit を追加・変更 | 対象 unit と unit gate |
| 軽い IT を追加・変更 | 対象 IT と軽い IT gate |
| 重い IT を追加・変更 | 分類契約テストの単体実行と、変更した重い IT の対象実行 |
| テスト分類・runner を変更 | unit、軽い IT、重い IT の排他性と routing 契約 |

IT を追加・変更した場合は、全 gate を待たずに分類契約テストを単体実行する。

```bash
npm test -- src/__tests__/releaseVerificationWiring.test.ts
```

## 重い IT の扱い

重い IT の全件実行は PR の責務だが、変更したテストが一度も成功していない状態で PR へ渡してはならない。

| 基準 | 判定 |
|------|------|
| 変更した重い IT を対象指定で完了まで実行 | OK |
| 関連する既存の重い IT をリスクに応じて対象実行 | OK |
| 全重い IT をローカルで毎回実行 | 不要。明示要求がある場合のみ |
| PR の全件実行だけを変更した重い IT の初回確認にする | REJECT |
| timeout 延長だけで停止・競合・無限ループを解決した扱いにする | REJECT |
| 重いテストを unit gate から除外しただけで分類先へ接続しない | REJECT |

重い IT は1 runner 内で1 workerに固定する。ローカルの全件実行は直列とし、PR CI では worker を増やさず、独立 runner の4シャードと serial group ごとの runner に分離する。

| 実行方式 | 判定 |
|---------|------|
| ローカルで1 workerの全件実行 | OK |
| PR CIで独立 runnerへシャード分割 | OK |
| 同一 runner内の worker増加で高速化 | REJECT。process・Git・同期I/Oの競合を再発させる |

## 完了証拠

報告には、実行した gate または対象テスト、完了結果、未実行の全重い IT が PR gate で実行されることを区別して記録する。

| 証拠 | 判定 |
|------|------|
| unit と軽い IT の成功結果 | 通常の実装完了証拠 |
| 追加・変更した重い IT の対象成功結果 | 重い IT 変更の必須証拠 |
| コマンドを開始した事実だけ | 不十分 |
| PR で実行予定という記述だけ | 変更した重い IT の証拠として不十分 |
| 失敗をフレークと推測しただけ | 不十分。再現条件と直接原因の調査が必要 |

## 禁止事項

- **速度基準だけの分類** - 遅い unit と実境界を通る IT を混同する
- **未接続の除外** - どの gate からも実行されないテストを作る
- **変更テストの未実行** - 自分で追加・変更した重い IT の初回実行を PR に委ねる
- **分類契約の未確認** - IT の追加・変更後に分類契約テストを単体実行しない
- **重い IT の同一 runner 内並列化** - worker 数を増やして process・Git・同期I/Oを競合させる
- **完了前の成功報告** - 実行中、timeout、worker 通信エラーを成功として扱う
- **分類と文書の不一致** - runner、開発ガイド、TAKT ナレッジが異なる実行順を示す
