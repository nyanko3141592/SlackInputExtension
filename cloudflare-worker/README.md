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

## メンバー管理 (スクリプトで半自動化)

`scripts/` 配下のヘルパーで「UUID 発行 → members.json 更新 → Worker への push」をワンコマンドで実行できます。

> `members.json` はトークンを含むため `.gitignore` 済み。手元の管理ファイルとして保持してください (Notion / private gist / 1Password などにバックアップ推奨)。

### 新規メンバー発行

```sh
cd cloudflare-worker
node scripts/issue-token.js tanaka --note engineering
```

出力例:

```
✓ Updated members.json (3 members)
📡 Pushing ALLOWED_TOKENS to Worker (3 members)...
✓ Created secret ALLOWED_TOKENS

✅ 発行完了
---
Member  : tanaka
Token   : 550e8400-e29b-41d4-a716-446655440000
Note    : engineering
Gateway : https://yourorg-ai-gateway.takahashi-naoki.workers.dev
---

📋 Slack DM 用テンプレ (コピペ可):

```

@tanaka さん、Slack AI Rewriter のセットアップ情報を送ります。

1. Chrome Web Store から「Slack AI Rewriter」をインストール
2. 拡張機能アイコンをクリック → 「API 設定」タブ
3. 接続モード: 「Gateway (Cloudflare Worker)」
4. Gateway URL: https://yourorg-ai-gateway.takahashi-naoki.workers.dev
5. メンバートークン: 550e8400-e29b-41d4-a716-446655440000
6. 「保存」
   ...

```

```

このテンプレを Slack で対象メンバーに DM するだけで配布完了。

オプション:

- `--note "engineering"` 任意のメモ
- `--gateway-url https://...` Gateway URL を明示指定 (テンプレに反映)
- `--no-deploy` wrangler への push をスキップ (発行だけ)

### メンバー一覧表示

```sh
node scripts/list-members.js
```

```
Member    Issued      Token         Note
─────────────────────────────────────────────
tanaka    2026-05-29  550e8400...   engineering
suzuki    2026-05-29  6ba7b810...   sales

Total: 2 members
(--full でトークン全体を表示)
```

### メンバー削除 (退職など)

```sh
node scripts/revoke-token.js tanaka
```

`members.json` から該当メンバーを削除し、残ったトークンで `ALLOWED_TOKENS` を再生成 → Worker に push します。即座にそのトークンは無効化されます。

メンバーが 0 人になると `ALLOWED_TOKENS` 自体が削除され、Worker は **Open Gateway モード** (認証なし) に戻ります。

### チームで同じトークンを使い回したい場合

`members.json` の `id` を `engineering-team` のような単位にして、メンバー間で同じトークンを共有することも可能です。

```sh
node scripts/issue-token.js engineering-team --note "発行: 2026-05 / 共有可"
```

ログでは「engineering チームの誰かが」が分かる粒度になりますが、個人特定はできません。チーム単位の運用に切り替えたいときに使ってください。

### 手動運用 (スクリプトを使わない場合)

```sh
# 直接 wrangler secret を編集
echo "uuid1,uuid2,uuid3,..." | wrangler secret put ALLOWED_TOKENS
```

または Cloudflare ダッシュボード:

- Workers & Pages → 該当 Worker → **Settings** → **Variables and Secrets** → `ALLOWED_TOKENS` を編集

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
