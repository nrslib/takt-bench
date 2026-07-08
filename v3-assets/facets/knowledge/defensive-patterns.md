# 防御的実装パターン

外部リソースと非同期処理を扱うコードで、レビューで頻出する欠陥を実装時に未然に防ぐためのパターン集。実装前にこの章の各パターンを確認し、該当する処理には最初から適用する。

## 非同期エラー経路の完全被覆

非同期処理では、正常系だけでなく全ての失敗経路が呼び出し元に伝播することを保証する。ストリームやコールバック方式の API では、エラーが Promise の外に漏れて握りつぶされる・ハングする事故が起きやすい。

| 観点 | 満たすべき条件 |
|------|----------------|
| ストリーム | `data`/`end` だけでなく `error` を必ず購読し、reject に接続する |
| コールバック内の throw | コールバック内で同期 throw せず、reject 経由で呼び出し元へ返す |
| タイムアウト | 応答が返らない経路に上限を設け、超過時は abort して reject する |
| 早期 return | 上限超過・不正入力の判定は、リソース取得の前に行い、取得済みなら解放してから返す |

```ts
// 悪い例: error 未購読でヘッダ後のエラーがハングを招く
const res = await fetch(url);
const buf = await res.arrayBuffer(); // ストリーム中断で無限待ちし得る

// 良い例: 全経路を Promise に閉じ込める
await new Promise<Buffer>((resolve, reject) => {
  const req = get(url, (res) => {
    if (res.statusCode !== 200) { res.resume(); reject(new Error(`status ${res.statusCode}`)); return; }
    const chunks: Buffer[] = [];
    let total = 0;
    res.on('data', (c) => {
      total += c.length;
      if (total > LIMIT) { req.destroy(); reject(new Error('size limit')); return; }
      chunks.push(c);
    });
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
  req.on('error', reject);
  req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
});
```

## リソースのライフサイクル

取得したリソース（ファイル・一時ディレクトリ・接続・登録）は、成功・失敗・早期 return の全経路で解放する。`try/finally` で解放を1箇所に集約し、複数リソースは取得の逆順で解放する。部分的に取得された状態での失敗も忘れず解放する。

## 部分失敗の隔離

複数項目を処理するループでは、1項目の失敗が全体を巻き込まないようにする。仕様が「全件成功が必須」と明記していない限り、失敗項目は警告付きでスキップし、残りと本体処理を継続する。握りつぶして成功と区別できなくするのは避ける。

## 入力検証の完全性

外部入力の検証は仕様が定める完全な形で行う。形式署名（magic bytes 等）は規格の全長を照合し、サイズ上限はリソースを消費し切る前に強制する。種別判定を拡張子や自己申告ヘッダだけに依存させない。

## 特権アクセスの境界

認証情報を伴うリクエストの送信先は、仕様が許す最小のホスト・パスに限定する。リダイレクト先へ認証ヘッダを無条件に転送しない。秘匿情報を含み得るファイルは権限を明示して作成し、ログやエラーメッセージへ漏らさない。
