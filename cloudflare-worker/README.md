# Cloudflare Worker Gateway

Slack AI Rewriter 拡張機能用の **Gemini API プロキシ Worker** です。

2 つの動作モードを 1 つのコードで切り替え:

| モード           | 環境変数 `ALLOWED_TOKENS`  | 動作                                                                    |
| ---------------- | -------------------------- | ----------------------------------------------------------------------- |
| **Open Gateway** | 未設定                     | URL を知っていれば誰でも利用可。シンプル。                              |
| **Auth Gateway** | カンマ区切りトークンを設定 | `X-Member-Token` ヘッダーを検証。許可リストに含まれるトークンのみ通過。 |

社内向けに配布したい場合は **Auth Gateway** を使用してください。

## なぜ Worker を使うのか

- 拡張機能のユーザーに **Gemini API キーを配布しなくて良い** (Worker 側で注入)
- API 使用料が **会社/組織持ち**にできる
- メンバー追加/削除が **トークン入れ替え**で完結
- `wrangler tail` で誰がいつ何を使ったかリアルタイム確認できる

## クイックスタート

### 前提

- Cloudflare アカウント ([無料登録](https://dash.cloudflare.com/sign-up))
- Google Gemini API キー ([Google AI Studio で無料発行](https://aistudio.google.com/app/apikey))
- Node.js 20+ + pnpm or npm

### 1. リポジトリを clone

```sh
git clone https://github.com/nyanko3141592/SlackInputExtension.git
cd SlackInputExtension/cloudflare-worker
```

### 2. Wrangler をインストール

```sh
npm install -g wrangler@latest
wrangler login
```

### 3. `wrangler.toml` をカスタマイズ

`name` を組織の一意な名前に変えてください (URL の一部になります)。

```toml
name = "yourorg-ai-gateway"   # → https://yourorg-ai-gateway.YOUR-SUBDOMAIN.workers.dev
```

### 4. Secret を設定

```sh
# Gemini API キー (必須)
echo "AIzaSy..." | wrangler secret put GEMINI_API_KEY

# 認証付きで運用する場合のみ (カンマ区切り)
# UUID を生成: uuidgen (macOS/Linux) または PowerShell の [guid]::NewGuid()
echo "550e8400-e29b-41d4-a716-446655440000,6ba7b810-9dad-11d1-80b4-00c04fd430c8" | wrangler secret put ALLOWED_TOKENS
```

### 5. デプロイ

```sh
wrangler deploy
```

デプロイ後の URL が表示されます (例: `https://yourorg-ai-gateway.xxx.workers.dev`)。

### 6. 動作確認

```sh
curl https://yourorg-ai-gateway.xxx.workers.dev/health
# → {"status":"ok","mode":"auth"}   ← ALLOWED_TOKENS 設定済
# → {"status":"ok","mode":"open"}   ← ALLOWED_TOKENS 未設定
```

### 7. 拡張機能側の設定

各メンバーに以下を伝えてください:

1. Chrome Web Store から **Slack AI Rewriter** をインストール
2. 拡張機能アイコン → popup
3. 「**API 設定**」タブ
4. **接続モード**: `Gateway (Cloudflare Worker)` にラジオ切替
5. **Gateway URL**: `https://yourorg-ai-gateway.xxx.workers.dev`
6. **メンバートークン**: 配布された UUID (認証なし運用なら空欄)
7. **保存**

## メンバーの追加・削除

### 追加

新しい UUID を発行して `ALLOWED_TOKENS` に追加:

```sh
# 現在の値を取得 → 追加 → 再設定
echo "現在のトークン,新しい-uuid-1234..." | wrangler secret put ALLOWED_TOKENS
```

または、Cloudflare ダッシュボードで:

- Workers & Pages → 該当 Worker → **Settings** → **Variables and Secrets** → `ALLOWED_TOKENS` の編集ボタン
- 値を `現在値,新規UUID` に書き換えて保存

新メンバーに UUID と上記設定手順を Slack DM などで送付。

### 削除 (退職時など)

`ALLOWED_TOKENS` からそのトークンを削除して再保存。即座に拒否されます。

```sh
# 全部を 1 回入れ直す
echo "残す-uuid-1,残す-uuid-2,..." | wrangler secret put ALLOWED_TOKENS
```

## ログ確認

```sh
# リアルタイム
wrangler tail

# 例:
# [gateway] token=550e8400... model=gemini-2.5-flash ts=2026-05-28T10:23:45.123Z
```

Cloudflare ダッシュボードでも確認できます:

- Workers & Pages → 該当 Worker → **Logs** タブ

## オプション: Cloudflare AI Gateway 連携

リクエストログ・レート制限・キャッシュを Cloudflare 側で活用したい場合:

1. [Cloudflare AI Gateway](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway) で Gateway を作成
2. 表示される URL (例: `https://gateway.ai.cloudflare.com/v1/{accountId}/{gw}`) を取得
3. Worker に環境変数を設定:

   ```sh
   echo "https://gateway.ai.cloudflare.com/v1/{accountId}/{gw}" | wrangler secret put AI_GATEWAY_URL
   ```

4. `wrangler deploy`

これで全リクエストが AI Gateway 経由で記録され、ダッシュボードでメトリクス確認できます。

## コスト

すべて Cloudflare の **無料プラン** で動作:

| 機能               | 無料枠         | 想定使用量                                   |
| ------------------ | -------------- | -------------------------------------------- |
| Workers リクエスト | 100,000 req/日 | 1 ユーザー 100 req/日 × 50 人 = 5,000 req/日 |
| Workers CPU 時間   | 10ms/req まで  | プロキシなので 1〜2ms                        |
| Secret 数          | 制限なし       | GEMINI_API_KEY + ALLOWED_TOKENS の 2 つ      |

**月 50 人 × 100 req/日 でも余裕で無料枠内**。
ただし Gemini API 側の使用料金は別途発生します ([Gemini API 価格](https://ai.google.dev/pricing))。

## セキュリティ上の注意

- ✅ `ALLOWED_TOKENS` は Secret として保存され、ログにも表示されない
- ✅ `X-Member-Token` ヘッダーは HTTPS で暗号化される
- ⚠️ トークンが漏洩した場合: 即座に `ALLOWED_TOKENS` から削除して再保存
- ⚠️ Open Gateway モードは **誰でも叩ける** ので、Gemini API 課金が爆発するリスクあり。テスト用以外では Auth モード推奨
- ⚠️ Worker ログには **トークンの先頭 8 文字のみ** 出力されるが、必要に応じてマスクを強化してください

## トラブルシュート

### `403 Forbidden: X-Member-Token が無効または未指定です`

- ALLOWED_TOKENS に該当 UUID が含まれているか確認
- 拡張機能側のメンバートークン入力欄に UUID が正しく入っているか確認

### `500 GEMINI_API_KEY not configured on Worker`

- `wrangler secret put GEMINI_API_KEY` が完了しているか確認
- ダッシュボードの Settings → Variables and Secrets で確認

### `502 Proxy error`

- Gemini API 側のエラーの可能性。`wrangler tail` でログ確認

### CORS エラー (拡張機能から呼べない)

- 通常起きないが、もし起きたら `worker.js` の `cors()` 関数の Allow-Headers を確認

## アーキテクチャ

```
[拡張機能] ──fetch──> [Cloudflare Worker] ──fetch──> [Gemini API]
              │              │
              │              ├─ ALLOWED_TOKENS で認証
              │              ├─ GEMINI_API_KEY を注入
              │              └─ ログ出力
              └─ X-Member-Token を Header に添付 (任意)
```

## ライセンス

このディレクトリのコードは親リポジトリと同じ MIT License です。
