# 決定ログ

## 1. GitHub画像の取得境界をGitHub attachment URLに限定

- **背景**: PR本文・通常コメント・review threadには外部URLも含まれ得るため、無制限の取得は契約外だった。
- **検討した選択肢**: 任意のHTTPS画像URLを取得する / GitHubのHTTPS attachment URLだけを取得する。
- **理由**: 認証済み`gh api`経路を利用しつつ、外部URLの無制限取得を防止するため。

## 2. 画像参照を画像構文全体からプレースホルダーへ置換

- **背景**: URL部分だけを置換するとMarkdown画像構文が残り、`[Image #N]`を明確に参照できない。
- **検討した選択肢**: URL部分だけを置換する / Markdown画像またはHTML`img`要素全体を置換する。
- **理由**: 本文から直接`[Image #N]`を参照でき、コードブロックやインラインコード内の文字列も保持できるため。

## 3. PipelineのPR添付を既存のtask spec実行経路へ接続

- **背景**: pipeline直実行では保存済みtaskを経由しないため、画像をダウンロードするだけではworkflowから参照できない。
- **検討した選択肢**: workflow promptへ一時パスを直書きする / `prepareTaskSpecDirectory`と`resolveTaskSpecForExecution`を利用する。
- **理由**: 既存のattachment manifest、run contextへのstage、`attachments/...`の安全なパス変換を維持できるため。