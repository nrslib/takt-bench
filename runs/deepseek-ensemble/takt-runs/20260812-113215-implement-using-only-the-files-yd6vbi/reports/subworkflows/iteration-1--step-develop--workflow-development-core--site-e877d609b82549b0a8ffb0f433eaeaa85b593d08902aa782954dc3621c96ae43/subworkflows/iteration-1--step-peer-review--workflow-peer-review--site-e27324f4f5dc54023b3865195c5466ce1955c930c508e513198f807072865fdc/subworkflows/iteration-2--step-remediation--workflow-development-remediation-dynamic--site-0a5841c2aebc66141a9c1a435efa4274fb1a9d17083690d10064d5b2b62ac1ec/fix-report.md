# 修正レポート
## サマリー
差し戻しで確認された3つの未完了義務（URL-2 / SIZE-2 / TEST-3）を修正し、全完了義務を閉じた。URL分類は `segments.includes('assets')` による形式外パスの過剰許可を、セグメント数に基づく厳密判定（`/user-attachments/assets/<id>` と `/owner/repo/assets/<id>` のみ許可）へ変更した。サイズ上限は Content-Length の本文読込前拒否を追加し、ストリーム超過時に `reader.cancel()` で明示停止・清掃するようにした。pipeline 結合は実 `runWorkflow` を通して task spec の実 `order.md`・promote された実画像ファイル・`attachmentManifest` を観測し、完了後の削除を検証する統合テストを新規追加した。ビルド・lint・fast unit gate・IT gate はすべて成功。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| UNIT-URL-CLASSIFY | FINAL-NEW-PRIMG-REPO-ASSET-URL | 要求シナリオP1/P2 | `isAllowedGithubAttachmentUrl` を `segments.includes('assets')` からセグメント数による厳密判定へ局所修正。3セグメントは `user-attachments/assets` を、4セグメントは `segments[2]==='assets'` を許可し、それ以外は拒否。外部ホスト・非HTTPS・無関係URLの拒否は従来どおり維持。 | 完了 |
| UNIT-SIZE-LIMIT | FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT | 要求仕様 (MAX_IMAGE_BYTES) | `fetchImageWithRedirects` で Content-Length 超過を `readResponseBody` 前に拒否。`readResponseBody` のストリーム読込ループで上限超過時に `reader.cancel()` を呼び明示停止・清掃。Buffer 経路の上限チェックは維持。 | 完了 |
| UNIT-TEST-EVIDENCE | FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE | 要求シナリオ P1, P2, Pipeline | 実 pipeline 結合フローを観測する統合テスト `src/__tests__/pipeline-image-attachments.integration.test.ts` を新規追加。実 `runWorkflow` を通し、`executeTask` 実行中に task spec の `order.md`（`attachments/image-1.png` 参照含む）・promote された実画像ファイル・`attachmentManifest` を検証し、完了後に spec ディレクトリの物理削除を `fs.existsSync` で確認。失敗時クリーンアップのケースも追加。 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| UNIT-URL-CLASSIFY | URL-1 | 既存契約保存 | FINAL-NEW-PRIMG-REPO-ASSET-URL | `https://github.com/<owner>/<repo>/assets/<id>` を抽出し本文を置換する | 単体テスト「should extract a repository asset URL of the form /owner/repo/assets/<id>」 | セグメント数3固定判定で抽出不可だった状態 | `segments.length===4 && segments[2]==='assets'` を許可 | 単体テスト16件パス | 完了 |
| UNIT-URL-CLASSIFY | URL-2 | 振る舞い修正 | FINAL-NEW-PRIMG-REPO-ASSET-URL | 外部・非HTTPS・形式外GitHub URL（`/issues/assets/123`、`/assets/123`）を拒否する | 単体テスト「should reject a path that contains assets in a non-asset position」 | `segments.includes('assets')` が両方を誤許可 | セグメント数と位置の厳密判定へ変更 | 単体テスト16件パス | 完了 |
| UNIT-SIZE-LIMIT | SIZE-1 | 既存契約保存 | FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT | 上限内のストリームをBuffer化し保存する | 統合テスト「should read a streamed body within the size limit into a Buffer」 | 既存の逐次読込経路が成立 | 変更なし（再確認） | 統合テスト14件パス | 完了 |
| UNIT-SIZE-LIMIT | SIZE-2 | 振る舞い修正 | FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT | Content-Length 超過を本文読込前に拒否し、ストリーム超過時に明示停止・清掃する | 統合テスト「should reject an over-limit Content-Length before reading the response body」「should cancel the stream once the body exceeds the size limit」 | Content-Length確認が本文読込後、超過時に `cancel()` なし | Content-Length事前拒否と `reader.cancel()` を追加 | 統合テスト14件パス | 完了 |
| UNIT-SIZE-LIMIT | SIZE-3 | 既存契約保存 | FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT | 旧 `arrayBuffer()` 全読込経路が存在しない | `grep arrayBuffer src/infra/github/` が空 | `readResponseBody` は `getReader().read()` のみ使用 | 変更なし（静的確認） | grep で該当なし | 完了 |
| UNIT-TEST-EVIDENCE | TEST-1 | 既存契約保存 | FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE | PR本文の置換と添付1件の生成 | 統合テスト「should replace the PR body with a placeholder and produce one temp file for a single image」 | 実経路で成立 | 変更なし（再確認） | 統合テスト14件パス | 完了 |
| UNIT-TEST-EVIDENCE | TEST-2 | 既存契約保存 | FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE | 通常コメント2 URLから一意なplaceholder・ファイル名を生成 | 統合テスト「should assign distinct placeholders and file names for two distinct asset URLs in a comment」 | 実経路で成立 | 変更なし（再確認） | 統合テスト14件パス | 完了 |
| UNIT-TEST-EVIDENCE | TEST-3 | 振る舞い修正 | FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE | pipeline で task spec・実ファイルを作成し `executeTask` 実行中に観測、完了後に削除する | `pipeline-image-attachments.integration.test.ts` の実ファイル生存期間検証 | 旧テストは resolver・task spec・order・画像をモックし実ファイルを観測不可 | 実 `runWorkflow` を通し `executeTask` 内で promote ファイル・`order.md`・manifest を検証 | 新規統合テスト3件パス | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| FINAL-NEW-PRIMG-REPO-ASSET-URL | `https://github.com/<owner>/<repo>/assets/<id>` を抽出可能にし、外部ホスト・無関係URLは拒否 | 単体テスト16件（正例 `/owner/repo/assets/<id>`、負例 `/issues/assets/123`・`/assets/123`）がパス | 完了 |
| FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT | `MAX_IMAGE_BYTES` 超過時に読込を即座に停止 | Content-Length事前拒否とストリーム `cancel()` を観測する統合テストがパス | 完了 |
| FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE | P1(置換本文+添付1件)、P2(通常コメント2URLから一意な識別子)、pipeline(実ファイル作成・削除)を観測 | 統合テスト（P1/P2 既存2件＋実pipeline結合3件）がパス | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| UNIT-URL-CLASSIFY | URL-2 | `segments.includes('assets')` が `/issues/assets/123` などを許可 | 正例と `/issues/123` のみをテストし、`assets` を含む形式外パスを検証していなかった | 単体テストに「should reject a path that contains assets in a non-asset position」を追加し、実装をセグメント数・位置の厳密判定へ変更 | URL-1（正例抽出）を同一テストファイルで再確認 |
| UNIT-SIZE-LIMIT | SIZE-2 | Content-Length確認が本文読込後、超過時に `cancel()` なし | テストが reject のみを確認し、早期終了・読込回数・cancel を観測していなかった | Content-Length事前拒否テストとストリーム `cancel()` 観測テストを追加し、実装へ事前拒否と cancel を反映 | SIZE-1（上限内読込）、SIZE-3（旧経路削除）を同一テスト・静的確認で再確認 |
| UNIT-TEST-EVIDENCE | TEST-3 | pipeline テストが実ファイル・order・task spec を観測していない | モック戻り値の存在と cleanup 呼出しだけで pipeline 結合を完了扱いしていた | 実 `runWorkflow` を通す統合テストを新規追加し、`executeTask` 実行中に promote ファイル・`order.md`・manifest を検証、完了後に物理削除を確認 | TEST-1、TEST-2（実経路）を統合テストで再確認 |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` |
| lint | 成功 | `npm run lint` |
| fast unit gate | 成功 | `npm test`（1864件パス） |
| IT gate | 成功 | `HOME=/tmp/takt-fixretry-v2 npm run test:it`（2357件パス） |
| 対象単体テスト | 成功 | `npm test -- src/__tests__/prReviewImageAttachments.test.ts`（16件） |
| 対象統合テスト | 成功 | `src/__tests__/prReviewImageAttachments.integration.test.ts`（14件） |
| pipeline結合テスト | 成功 | `src/__tests__/pipeline-image-attachments.integration.test.ts`（3件） |
| 影響下流テスト | 成功 | `pipelineExecution.test.ts`（54件）、`github-provider.test.ts`（40件）、`cli-routing-pr-resolve.test.ts`（31件）、`addTask.test.ts`（23件）、`releaseVerificationWiring.test.ts`（20件） |

## 未完了義務
- なし