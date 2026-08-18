問題を、計画で定義された全不変条件が現在の差分・コード・実行証跡で独立に成立しているかの検証として扱います。まず正本の task、Knowledge、Policy、最新レポートを EOF まで確認し、その後に差分・対象コード・反例テストを照合します。ソース編集は行いません。
正本と履歴を確認しました。直前の検証は「実装は成立しているが、hard-exit直後の観測と通常終了時のlistener解放を回帰テストが直接証明していない」として差し戻しており、今回の修正報告はその2点と`cwd`必須化を対応対象にしています。ここからPolicy/Knowledgeの適用範囲を確定します。
適用される基準は、副作用解放、利用側移行、旧経路削除、必須`cwd`の明示伝播、実境界に応じたテスト分類です。現コードではstore返却直後にexit cleanupを登録し、hard exit・通常`finally`が同じ一回性関数を共有しています。次に、旧実装へ退行した場合に今回のテストが本当に失敗する観測点を含むかを確認し、対象テストを再実行します。
主要な反例テストはすべて成功しました。特に3つのhard-exitテストは、exit listener実行後かつモック例外による外側`finally`の前にcleanup 1回を検証しており、直前差し戻しの弱い観測点は解消されています。実child processテストも終了コード23と画像・session directoryの不存在を再確認できました。
# 修正完了検証

## 結果: verified

`AI-NEW-pr-attachment-cleanup-hard-exit-L307`の全完了義務を独立に確認しました。

- store取得直後に同期exit cleanupを登録
- 3つのhard-exit経路で、外側`finally`より前にcleanup完了
- 通常完了・取消・例外時にlistenerを解除
- exitと`finally`が競合してもcleanupは1回
- 実child process終了後に画像・session directoryが不存在
- 旧cleanup経路なし
- `cwd`は必須引数として全呼び出し元から伝播
- 既存の終了コード、エラー文言、attachment伝播を維持

再実行結果：

- routing回帰：31件成功
- cleanup unit：2件成功
- heavy IT：1件成功
- 分類契約：19件成功
- cwd伝播：11件成功
- build、lint、`git diff --check`：成功

未完了義務、環境要因による未確認事項、追加findingはありません。