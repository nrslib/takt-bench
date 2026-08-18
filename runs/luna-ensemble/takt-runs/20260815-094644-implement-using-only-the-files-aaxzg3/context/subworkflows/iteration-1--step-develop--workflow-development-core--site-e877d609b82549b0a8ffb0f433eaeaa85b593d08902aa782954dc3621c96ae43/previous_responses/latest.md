テスト専用ステップとして、正本の `order.md`・指定された Knowledge／Policy・許可された Report Directory を再読し、変更契約に対応するテストだけを追加します。プロダクションコードは変更せず、まず既存の責務・テスト構造を確認してから、未実装を理由とする失敗まで検証します。コード作業に該当するため `coding` スキルも適用します。
正本と計画の読了が完了しました。契約 family は、(1) PR本文領域の画像参照変換、(2) GitHub URLの認証付き取得・形式／サイズ検証、(3) attachment番号の衝突回避、(4) add／対話型／pipelineの終端配線とcleanup、(5) 非GitHub・非PR経路の既存動作保持に分かれます。次に現行の公開境界とテスト慣行を再確認し、既存テストで検出できない契約に限定してテストを追加します。
既存テストを確認した結果、`imageAttachments.test.ts` は実ファイルを使う既存の attachment 所有者テストであり、番号割当の回帰を最小境界で追加できます。一方、PR画像抽出・GitHub応答検証は現行コードにまだ公開境界がないため、計画で示された責務に対応する小さなテスト契約を新規テストとして先に定義します。実装ステップはこの契約を満たすプロダクション境界を追加します。
テストを追加しました。新規テストは、四つのPR本文領域からのMarkdown／HTML画像抽出、重複URLの一意化、コード・コメント・外部URLの除外、GitHub URL制限、Content-Type／magic bytes／サイズ検証を直接観測します。既存の実filesystemテストには、既存番号とfilenameが不一致でも衝突しない採番回帰を追加しました。これからtest-firstの失敗が未実装由来であることを確認します。
最初の実行はテスト内容ではなく、依存関係未導入で `tsc: command not found` となりました。`node_modules` が存在せず、`.gitignore` でも管理対象外であることを確認したため、プロジェクトの標準手順どおり `npm install` 後に再実行します。
test-first実行では、既存テストは通過し、追加したテストだけが未実装の差分で失敗しました。失敗は、未作成のPR画像モジュール、衝突番号の上書き拒否、PR添付のadd／routing／pipeline配線欠落、cleanup欠落に対応しており、fixtureやrunner設定の失敗ではありません。`npm install` による `package-lock.json` の差分は復元済みで、編集対象はテストファイルだけです。次にテスト差分のlintとセルフスキャンを行います。
テストを先行作成しました。プロダクションコードは変更していません。

追加・更新:

- [github-pr-images.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/github-pr-images.test.ts)
  - 画像抽出、重複排除、URL制限、Content-Type／magic bytes／サイズ検証
- [addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/addTask.test.ts)
  - 保存、body-only、キャンセル時cleanup
- [cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/cli-routing-pr-resolve.test.ts)
  - 対話型seedへの添付配線
- [pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/pipelineExecution.test.ts)
  - pipeline task contentへの添付配線
- [imageAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/imageAttachments.test.ts)
  - 既存番号との衝突回避

検証結果:

- `npm run lint`: 成功
- `releaseVerificationWiring.test.ts`: 17件成功
- 対象テスト: 未実装のため意図どおり失敗。未作成のPR画像モジュール、添付配線、番号衝突、cleanupが検出されています。
- 編集後セルフスキャン: 未使用・禁止記述・プロダクション変更なしを確認済み。