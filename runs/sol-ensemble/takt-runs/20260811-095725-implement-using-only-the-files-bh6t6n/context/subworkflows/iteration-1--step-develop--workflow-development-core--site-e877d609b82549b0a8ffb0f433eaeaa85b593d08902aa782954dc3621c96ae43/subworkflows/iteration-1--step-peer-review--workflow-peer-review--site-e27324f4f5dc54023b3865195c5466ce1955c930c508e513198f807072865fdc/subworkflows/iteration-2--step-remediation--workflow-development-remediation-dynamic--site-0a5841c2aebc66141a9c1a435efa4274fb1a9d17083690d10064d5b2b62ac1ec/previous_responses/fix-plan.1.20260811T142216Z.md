問題は、裁定済みの `markdown-literal-scan-complexity` だけを対象に、現行実装・タスク正本・レポート履歴・適用ポリシーを再確認して、次工程がそのまま実装できる最小計画へ落とすことです。まず指定された正本を全文確認し、その後に現在の走査処理とテスト経路を照合します。
タスク正本では、画像抽出・保存・本文置換の既存契約を維持する必要があります。今回の裁定はそのうち内部の literal 範囲走査の計算量だけを対象としており、公開形式や対応構文の拡張は対象外です。続いて、計画を拘束するポリシー全文と、裁定の根拠レポートを確認しています。
現行コードで根本原因を確認できました。`findLiteralRanges()` は各行頭で indented/fenced 判定を順に試し、その双方が `findFenceOpeningContainer()` 経由で `findInheritedListIndent()` を呼びます。この関数が現在位置までの prefix を毎回 `slice → split → reverse` しているため、画像参照がゼロでも行数に対して二乗化します。これは公開契約ではなく、`prReviewAttachments` 内部の局所的な走査設計の問題です。
同一原因の横展開も確認しました。`slice(0, start) → split('\n') → reverse()` による prefix 再構築はリポジトリ内でこの関数だけです。3つのPR入口はいずれも同じ `preparePrReviewAttachments()` を共有しているため、入口別修正は不要で、内部走査とその単体回帰テストの1修正単位にまとめるのが最小です。既存28件の意味論テストは現在すべて成功しています。
# 修正計画

## 結果

修正計画を確定しました。対象は裁定済み family `markdown-literal-scan-complexity` の1件のみです。ソース編集は行っていません。

## 修正単位

| 項目 | 内容 |
|---|---|
| family | `markdown-literal-scan-complexity` |
| finding | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` |
| 分類 | 独立した局所問題 |
| 対象 | `src/features/tasks/prReviewAttachments.ts`、`src/__tests__/prReviewAttachments.test.ts` |
| 根本原因 | 各行頭の判定で `findInheritedListIndent()` が本文先頭から現在位置までを `slice → split → reverse` し、画像0件でも二乗時間になる |
| 影響経路 | `takt add --pr`、対話CLI `--pr`、pipeline `--pr` が共有する `preparePrReviewAttachments()` |
| 同一原因の別箇所 | なし。該当するprefix再構築は当該関数のみ |

## 実装方針

1. Markdown本文を前方へ一度走査し、直前行、blockquote深度、継続中のlist indent、paragraph状態を行ごとの内部状態として引き継ぐ。
2. `findFenceOpeningContainer()` と indented-code判定には、本文全体と開始位置ではなく、その時点で解決済みの行コンテキストを渡す。
3. 行ごとのprefix再構築を行う `findInheritedListIndent()` を置換し、変更により未使用になる引数・補助関数を削除する。
4. fenced code、indented code、inline code、HTMLコメントの既存範囲判定と、画像抽出・URL検証・download・store・cleanup経路は変更しない。
5. 新規Markdown parser依存や別モジュールへの公開API追加は行わず、既存ファイル内の内部走査として完結させる。

## 維持する不変条件

- 通常のMarkdown画像とHTML `<img>` は出現順に処理する。
- コードフェンス、inline code、HTMLコメント、インデント式コード内の画像風文字列は原文保持する。
- 引用、リスト、ネスト、タブ列幅、段落中断、無効なフェンス、エスケープ済みdelimiterの既存意味論を維持する。
- 重複URL、placeholder、attachment形式、download失敗・cleanup契約を変更しない。
- 画像がない本文では、入力本文をそのまま返し、downloadやstore作成を行わない。

## 回帰テスト

既存28件の `prReviewAttachments` テストを維持したうえで、固定された大規模な画像なし本文を使う回帰テストを同じunitファイルへ追加します。

観測点は以下です。

- 大規模本文が変更されず返る。
- attachmentsが空である。
- download・saveが呼ばれない。
- 修正前の二乗処理と十分な差があるテストローカルの実行上限で、同期停止の再発を検出する。
- 実装照合で、各行から本文prefixを再分割・再走査する経路が残っていないことを確認する。

## 実施順序と完了条件

1. 前方向の行状態管理へ置換し、旧prefix走査を削除する。
2. 大規模画像なし本文の回帰テストを追加する。
3. 次を順に実行する。

   - `npm test -- src/__tests__/prReviewAttachments.test.ts`
   - `npm run build`
   - `npm run lint`
   - `npm test`
   - `npm run test:it`

既存unitファイルだけを変更するため、IT分類変更や `releaseVerificationWiring.test.ts` の追加実行は不要です。

## 明示的な対象外

Markdown対応構文の拡大、新規parser依存、公開API・placeholder・attachment形式の変更、画像総量制限、GitHub互換経路、過去の解消済みfinding、他reviewerの非採用事項は実装しません。環境要因による後続確認やタスク全体の再計画も不要です。