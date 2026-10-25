# ポコドン・リズム

スマホブラウザで遊ぶ、3 拍入力のリズムゲーム。

## セットアップ

```bash
bun install
```

## 開発

```bash
bun run dev            # http://localhost:3000
PORT=3456 bun run dev  # ポートを変える
```

同じ Wi-Fi のスマホから `http://<PC の IP>:3000` で開ける（サーバは 0.0.0.0 で待ち受ける）。

## 検証

```bash
bun test
bun run typecheck
bun run check
```

## ビルド（静的ファイル）

```bash
bun run build   # dist/ に出力。任意の静的ホスティングに置ける
```

## デプロイ（Cloudflare Workers）

GitHub 連携の Workers Builds で、`main` に push すると自動でビルド・デプロイされる。
設定は `wrangler.jsonc`（`dist/` を静的アセットとして配信）。ダッシュボード側の設定:

- Build command: `bun run build`
- Deploy command: `bunx wrangler deploy`

Worker 名はダッシュボードと `wrangler.jsonc` の `name` を一致させること。

手元から直接デプロイする場合:

```bash
bun run build && bunx wrangler deploy
```

## 子分の掛け声を作り直す

掛け声の文言と配役（話者・スタイル）は `src/voiceLines.ts`。変更したら VOICEVOX エンジンを起動して再生成する。
`src/voice/` の wav・manifest.json・index.ts はすべてスクリプトが作り直す。

```bash
docker run -d --rm --name pokodon-voicevox -p 127.0.0.1:50121:50021 voicevox/voicevox_engine:cpu-latest
bun run voice
docker stop pokodon-voicevox
```

クレジットは配役から自動で作られる。話者を追加・変更したら、その話者の利用規約を確認すること
（公開・商用利用の可否や表記方法はキャラごとに異なる）。

## クレジット

音声: VOICEVOX:ずんだもん、VOICEVOX:白上虎太郎、VOICEVOX:櫻歌ミコ、VOICEVOX:猫使アル、VOICEVOX:春日部つむぎ、VOICEVOX:猫使ビィ、VOICEVOX:満別花丸

## アプリアイコン

原本は `public/icon.svg`。PNG（`icon-512.png` / `icon-192.png` / `apple-touch-icon.png` / `favicon-32.png`）は
この SVG をブラウザで描画して書き出し、`sips -z` で縮小して作った。絵柄を変えたら PNG も作り直すこと。

## 実機での注意

- iOS は消音スイッチがオンでも鳴るよう `navigator.audioSession` を指定しているが、古い iOS では鳴らないことがある。
- Bluetooth イヤホンは遅延が大きい。判定がずれるときは右上メニューのタイミング調整を使う。
