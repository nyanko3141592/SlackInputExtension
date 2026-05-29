// Slack AI Rewriter - Cloudflare Worker Gateway
//
// このWorkerはGoogle Gemini APIを拡張機能側に隠してプロキシし、
// 必要に応じて簡易的なメンバー認証を追加します。
//
// 環境変数 (Secret として設定推奨):
//   GEMINI_API_KEY   (必須) - Google Gemini API キー
//   AI_GATEWAY_URL   (任意) - Cloudflare AI Gateway URL
//                            (例 https://gateway.ai.cloudflare.com/v1/{accountId}/{gw}/google-ai-studio
//                             ※ /google-ai-studio はコード側で付与するので付けない)
//   ALLOWED_TOKENS   (任意) - 認証付き運用にする場合のみ設定。
//                            カンマ区切りの UUID 等のトークン文字列。
//                            未設定なら認証なし (誰でも URL を知っていれば使える) で動作。
//
// セットアップ:
//   wrangler secret put GEMINI_API_KEY
//   wrangler secret put ALLOWED_TOKENS  # 認証付きの場合のみ
//   wrangler deploy
//
// 動作モード:
//   - ALLOWED_TOKENS 未設定 → 「Open Gateway」
//   - ALLOWED_TOKENS 設定済 → 「Auth Gateway」: X-Member-Token ヘッダーを検証

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    const tokens = parseTokens(env.ALLOWED_TOKENS);
    const mode = tokens.length > 0 ? 'auth' : 'open';

    // ヘルスチェック (動作モードも返す)
    if (url.pathname === '/health') {
      return cors(Response.json({ status: 'ok', mode }));
    }

    // /v1beta/ 以降のパスのみ Gemini にプロキシ
    const match = url.pathname.match(/^\/v1beta\/(.*)/);
    if (!match) {
      return cors(Response.json({ error: 'Not found' }, { status: 404 }));
    }
    if (request.method !== 'POST') {
      return cors(Response.json({ error: 'Method not allowed' }, { status: 405 }));
    }

    // 認証チェック (Auth Gateway モードのみ)
    if (mode === 'auth') {
      const provided = request.headers.get('X-Member-Token');
      if (!provided || !tokens.includes(provided)) {
        return cors(
          Response.json({ error: 'Forbidden: X-Member-Token が無効または未指定です。' }, { status: 403 })
        );
      }
      // ログ (wrangler tail でリアルタイム確認できる)
      const model = (match[1].split(':')[0] || '').replace('models/', '');
      console.log(`[gateway] token=${provided.slice(0, 8)}... model=${model} ts=${new Date().toISOString()}`);
    }

    // API キーチェック
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return cors(Response.json({ error: 'GEMINI_API_KEY not configured on Worker' }, { status: 500 }));
    }

    // 転送先 URL
    const base = env.AI_GATEWAY_URL
      ? `${env.AI_GATEWAY_URL.replace(/\/$/, '')}/google-ai-studio`
      : 'https://generativelanguage.googleapis.com';
    const target = `${base}/v1beta/${match[1]}?key=${apiKey}`;

    try {
      const resp = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: request.body,
      });
      const data = await resp.text();
      return cors(
        new Response(data, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    } catch (err) {
      return cors(Response.json({ error: `Proxy error: ${err.message}` }, { status: 502 }));
    }
  },
};

function parseTokens(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function cors(response) {
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // X-Member-Token を許可リストに含める
  h.set('Access-Control-Allow-Headers', 'Content-Type, X-Member-Token');
  return new Response(response.body, { status: response.status, headers: h });
}
