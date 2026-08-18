修正計画の2つの契約 family を、修正報告とは独立に再検証します。まず正本の `order.md`、完全版 Policy／Knowledge、Report Directory の最新レビュー履歴を読み、その後に差分・実コード・反例テストを照合します。編集は行いません。
正本と完全版基準を読了しました。今回適用するのは、Markdown 断片境界・全断片共有状態・3入口移行・既存文字列契約、および実 child process の attempt 分離／環境伝播／両終了経路の cleanup／分類契約です。その他のアーキテクチャ項目は、この2 family に実在する経路へ関係する範囲だけを判断へ反映します。
前回差し戻しの2反例は、現コード上で直接解消されています。`<pre>`要素で子孫走査が停止し、conversation comment は review metadata formatterを通らず本文だけを出力しています。ここから、同じ証明手段で断片 family 全体と attempt family の対象テストを再実行し、成功終了と観測内容を確認します。
対象実行は完了し、型契約、unit 152件、light IT 1件、heavy IT／分類契約 43件がすべて成功しました。実 child の出力から `cwd` と各隔離環境値を観測し、再測定を含む全 attempt root の削除もテストで確認されています。追加の空 shard 反例でも、対象 shard 1件だけが実行されました。
追加の逆方向反例で、`PR-LITERAL-03` に未完了が残ることを確認しました。行頭の block HTML `<pre>` は除外されますが、段落内の inline `<pre>` は mdast 上で開始タグ・画像・終了タグが別ノードになり、現在の「単一HTMLノード内だけで `pre` 子孫を止める」実装をすり抜けます。HTML `<img>` と Markdown画像の両方でダウンロード処理への到達を再現しました。残りの義務も確認したうえで最終判定をまとめます。
# 修正完了検証

## 結果: incomplete

修正計画は有効ですが、`PR-LITERAL-03` が未完了です。

### 未完了事項

[prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:60) の `<pre>` 除外は、単一のHTMLノード内だけで機能します。

次の段落内inline `<pre>`では、mdastが開始タグ・画像・終了タグを別ノードに分割するため、画像がダウンロード対象になります。

```md
Prefix <pre><img src="https://github.com/user-attachments/assets/example"></pre> suffix
Prefix <pre>![image](https://github.com/user-attachments/assets/example)</pre> suffix
```

ダウンロード不能な `PATH` で現在のビルドを実行した結果、どちらも `spawnSync gh ENOENT` となり、ダウンロード処理への誤到達を確認しました。期待結果は画像参照を変更せず、ダウンロードしないことです。

既存テストは行頭の `<pre><img ...></pre>` を使うため、全体が単一HTML blockノードになり、この反例を検出できません。

必要な対応:

- Markdown断片全体でinline HTMLの`pre`状態を保持し、別mdastノードになったHTML画像・Markdown画像も除外する。
- inline `<pre>`内のHTML画像とMarkdown画像、およびその直後の通常画像を対にした回帰テストを追加する。

### その他の検証結果

- `PR-FRAGMENT-01`、`PR-ORDER-02`、`PR-DEDUPE-04`～`PR-DATAFLOW-10`: 完了
- conversation commentの既存文字列契約: 復元済み
- `e2e-runner-attempt-boundary`の全義務: 完了
- 対象実行: unit 152件、light IT 1件、heavy IT／分類契約43件成功
- 空shard: processを起動しないことを確認
- `git diff --check`: 成功
- 環境要因による後続確認: なし

ソースは編集していません。