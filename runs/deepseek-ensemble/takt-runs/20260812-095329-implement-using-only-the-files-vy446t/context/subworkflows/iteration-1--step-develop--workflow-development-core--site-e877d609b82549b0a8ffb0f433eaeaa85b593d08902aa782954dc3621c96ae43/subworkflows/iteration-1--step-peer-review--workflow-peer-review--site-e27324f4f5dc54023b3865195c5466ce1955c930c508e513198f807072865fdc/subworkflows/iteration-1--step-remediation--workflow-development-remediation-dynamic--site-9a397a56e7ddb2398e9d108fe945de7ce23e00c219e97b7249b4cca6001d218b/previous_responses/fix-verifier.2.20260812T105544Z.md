問題は、修正報告の自己申告に依存せず、計画の一時ディレクトリ cleanup 不変条件を対象経路ごとに独立検証し、`verified` / `incomplete` / `plan_invalid` を判定することです。ソースは変更せず、正本の計画・ポリシー・知識・最新レポート、差分、実コード、対象テストを再確認します。
正本の修正報告には、前回 verifier が未完了とした routing 選択例外と add 保存例外を解消したと記録されています。次に、指定された fix-verifier の知識・ポリシーを EOF まで読み、現在の差分と各 consumer の保証境界を行単位で照合します。前回レポートの成功判定は証拠として採用しません。
現行コードの主要保証境界は、producer の token/download 失敗、pipeline の `resolveTaskContent` 後、routing の workflow 選択開始から dispatch、add の保存処理まで確認できました。残る判定上の焦点は、producer 成功後に各 consumer が保証境界へ入る前の例外・終了経路と、追加された回帰テストが実際にその反例を通るかです。対象テストを再実行し、テスト実装も独立に確認します。
対象テストは再実行し、型契約を含めて 4 ファイル・115 件が成功しました。独立したコード追跡では、routing は cleanup 関数を取得した後も、workflow 選択用 `try/finally` の開始前に PR の base branch 解決・PR context 構築・設定解決を実行しています。これらは実コード上で例外を投げ得るため、計画の「生成後の例外すべて」という不変条件に対する未確認ではなく、保証境界の欠落候補として追加確認します。
## 判定: `incomplete`

計画自体は有効ですが、`F-PR-IMAGE-LIFECYCLE` の不変条件を満たしていません。

不足箇所:

- `src/app/cli/routing.ts:123-148`
  - cleanup 関数取得後、`resolveBaseBranch()` や `createPullRequestContext()` が cleanup 用 `finally` の外で実行されます。
  - これらは実装上例外を投げ得るため、PR画像の一時ディレクトリが残留します。
- `src/app/cli/routing.ts:168-172`
  - 設定解決も cleanup 境界の外で、設定エラー時に cleanup されません。
- `src/app/cli/routing.ts:320-322`
  - 実際の `process.exit(1)` は `finally` を実行せず終了します。既存テストは `process.exit` を throw に差し替えているため、この経路の実挙動を証明していません。

修正報告に記載された workflow/mode 選択例外、pipeline、add 保存例外のテストは成功しましたが、上記の pre-dispatch 例外・終了経路が未検証かつ未保証です。cleanup 所有開始直後から終了までを保証境界に含め、該当反例テストを追加してください。

確認済みテスト:

- 対象4ファイル: 115件成功
- 分類契約テスト: 20件成功