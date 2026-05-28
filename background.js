// Slack AI Rewriter - Background Service Worker
// Gemini API でテキストをリライト。Slack mrkdwn 準拠を強制する。

const SLACK_MRKDWN_RULES = `【出力フォーマット: Slack mrkdwn 厳守】
Slack はクライアント独自の mrkdwn 形式を使う。標準 Markdown と異なる点があるので必ず以下に従うこと。
- 太字: *text* （アスタリスク1つ。**text** は使わない）
- 斜体: _text_ （アンダースコア1つ。*text* は太字なので衝突しないよう注意）
- 取り消し線: ~text~
- インラインコード: \`text\`
- コードブロック: \`\`\` の3連バッククォートで囲む（言語指定は付けない）
- 引用: 行頭に > （複数行は各行に > を付ける）
- 箇条書き: 行頭に「• 」（中黒+半角スペース）。ネストは行頭スペース2個＋「◦ 」
- 番号付きリスト: 行頭に「1. 」「2. 」…
- 見出しは存在しない。強調したい場合は太字 *text* を1行で使う
- リンク: <https://example.com|表示名> または <https://example.com>
- メンション: <@USERID> は元テキストにあれば保持。新規には作らない
- 改行は通常の改行（\\n）でよい。段落間は空行1つで区切る
- HTML タグや **bold** など標準 Markdown 記法は絶対に出力しない`;

const DEFAULT_PROMPTS = [
  {
    id: 'polite',
    name: '丁寧にリライト',
    icon: '🙇',
    prompt: `次の Slack メッセージを、ビジネスチャットに適した丁寧で柔らかい敬語にリライトしてください。

【ルール】
- 元の意図・情報を変えない
- 過度に堅くせず、Slack らしい読みやすさを保つ
- 冗長な敬語の重ね掛けは避ける（「させていただく」連発しない）
- 絵文字が元にあれば必要に応じて残す。新規追加は最小限
- メンション (<@USER>) や URL はそのまま保持`,
  },
  {
    id: 'organize',
    name: 'わかりやすく整理',
    icon: '🧹',
    prompt: `次の Slack メッセージを、わかりやすく整理してリライトしてください。

【ルール】
- 一文が長い場合は適切に分割
- 結論や要点を先に、詳細を後に置く
- 重複・冗長表現を削除
- 文脈に応じて箇条書き化（• ）してよいが、短い内容は無理に箇条書きにしない
- 元の意図・情報を変えない`,
  },
  {
    id: 'structure',
    name: '構造化',
    icon: '🗂️',
    prompt: `次の Slack メッセージを、構造化されたフォーマットにリライトしてください。

【ルール】
- 内容を見出し的な太字ラベル（例: *背景* / *依頼内容* / *期限* など）でグルーピング
- 各セクションは箇条書き（• ）または短い文で記述
- 「依頼/相談/共有/質問」など、メッセージの目的が明確になるよう冒頭1行で要約してもよい
- 元の意図・情報を変えない。情報が不足している項目は無理に作らない`,
  },
  {
    id: 'concise',
    name: '簡潔化',
    icon: '✂️',
    prompt: `次の Slack メッセージを、意味を保ったまま簡潔にリライトしてください。

【ルール】
- 冗長な前置き・繰り返しを削除
- 1〜3文程度を目安に短くまとめる
- 必要な情報（誰が・何を・いつ）は落とさない
- 過度にぶっきらぼうにならない程度の丁寧さは保つ`,
  },
  {
    id: 'casual',
    name: 'カジュアル化',
    icon: '😊',
    prompt: `次の Slack メッセージを、社内のフラットなチャットに適した自然でカジュアルなトーンにリライトしてください。

【ルール】
- ですます調を基本としつつ、堅すぎる敬語は崩す
- 「お疲れ様です」「恐れ入りますが」などの過剰な定型句は省く
- フランクすぎる若者言葉やタメ口にはしない
- 元の意図・情報を変えない`,
  },
  {
    id: 'bullets',
    name: '箇条書きに変換',
    icon: '•',
    prompt: `次の Slack メッセージを、要点を抽出した箇条書きにリライトしてください。

【ルール】
- 行頭は「• 」（中黒+半角スペース）
- 1項目は1行で簡潔に
- 必要なら冒頭に1行サマリー（太字 *summary*）を付ける
- 元の意図・情報を変えない`,
  },
  {
    id: 'translate-en',
    name: '英語に変換',
    icon: '🌐',
    prompt: `次の Slack メッセージを、自然な英語に翻訳してください。

【ルール】
- 元の意図・情報・トーンを変えない
- ビジネスチャットに適したカジュアル過ぎず堅すぎない英語にする
- 直訳ではなく、ネイティブが書く自然な表現にする
- 日本語の謙譲・婉曲表現は、英語として自然な表現に置き換える（"sorry to bother you" 等で代替できる場合は活用）
- 元テキストの URL、メンション (<@USER>)、絵文字ショートコード (:smile: 等)、数字、固有名詞はそのまま保持
- 既に英語の部分があれば、不要な書き換えはしない
- 1〜2文の短い場合は冒頭の Hi/Hello 等の挨拶は付けず、本文だけを訳す`,
  },
];

const SYSTEM_INSTRUCTION_TEMPLATE = `あなたは Slack のメッセージリライト専用のアシスタントです。
ユーザーから元テキストと「リライトの方針」が与えられます。方針に沿って元テキストをリライトし、結果のみを出力してください。

{rules}

【厳守】
- 出力はリライト後の Slack メッセージのみ。前置き・後書き・説明・「リライト後:」などのラベルは一切付けない
- 元テキストに含まれる URL、メンション、絵文字ショートコード (:smile: 等)、コードブロックの中身は改変しない
- 元テキストに無い情報を勝手に追加しない`;

function buildPrompt(originalText, promptDef, customInstruction) {
  const system = SYSTEM_INSTRUCTION_TEMPLATE.replace('{rules}', SLACK_MRKDWN_RULES);
  const instructionBlock = customInstruction
    ? `${promptDef.prompt}\n\n【追加の指示】\n${customInstruction}`
    : promptDef.prompt;

  return `${system}

【リライトの方針: ${promptDef.name}】
${instructionBlock}

【元テキスト】
${originalText}

リライト後の Slack メッセージのみを出力してください。`;
}

const LEGACY_MODEL_MAP = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-1.5-flash': 'gemini-2.5-flash-lite',
};

function resolveModel(stored) {
  if (!stored) return 'gemini-2.5-flash';
  return LEGACY_MODEL_MAP[stored] || stored;
}

async function getSettings() {
  const data = await chrome.storage.sync.get(['apiKey', 'apiMode', 'gatewayUrl', 'model', 'prompts']);
  return {
    apiKey: data.apiKey || '',
    apiMode: data.apiMode || 'direct',
    gatewayUrl: data.gatewayUrl || '',
    model: resolveModel(data.model),
    prompts: Array.isArray(data.prompts) && data.prompts.length > 0 ? data.prompts : DEFAULT_PROMPTS,
  };
}

function resolveGateway(settings) {
  if (settings.apiMode === 'gateway' && settings.gatewayUrl) {
    return { apiKey: null, gatewayUrl: settings.gatewayUrl };
  }
  if (!settings.apiKey) {
    throw new Error('API キーが未設定です。拡張機能アイコンから API キーを設定してください。');
  }
  return { apiKey: settings.apiKey, gatewayUrl: null };
}

async function callGemini({ apiKey, model, prompt, gatewayUrl }) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
  };

  let url;
  if (gatewayUrl) {
    url = `${gatewayUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini からのレスポンスが空でした');
  return text.trim();
}

async function handleRewrite({ originalText, promptId, customInstruction }) {
  if (!originalText || !originalText.trim()) {
    throw new Error('リライト対象のテキストがありません');
  }
  const settings = await getSettings();
  const { apiKey, gatewayUrl } = resolveGateway(settings);

  let promptDef;
  if (promptId === 'oneshot') {
    if (!customInstruction || !customInstruction.trim()) {
      throw new Error('指示が空です');
    }
    promptDef = {
      id: 'oneshot',
      name: 'カスタム指示',
      prompt: customInstruction.trim(),
    };
    // oneshot は customInstruction を本体に使うので追加指示は不要
    const prompt = buildPrompt(originalText, promptDef, null);
    const result = await callGemini({ apiKey, model: settings.model, prompt, gatewayUrl });
    return { result };
  }

  promptDef = settings.prompts.find((p) => p.id === promptId);
  if (!promptDef) throw new Error('プロンプトが見つかりません');

  const prompt = buildPrompt(originalText, promptDef, customInstruction);
  const result = await callGemini({
    apiKey,
    model: settings.model,
    prompt,
    gatewayUrl,
  });
  return { result };
}

async function handleSavePrompt({ name, icon, prompt }) {
  if (!name || !name.trim()) throw new Error('プロンプト名が空です');
  if (!prompt || !prompt.trim()) throw new Error('プロンプト本文が空です');
  const data = await chrome.storage.sync.get(['prompts']);
  const list =
    Array.isArray(data.prompts) && data.prompts.length > 0
      ? data.prompts
      : JSON.parse(JSON.stringify(DEFAULT_PROMPTS));
  const id = `custom-${Date.now()}`;
  list.push({
    id,
    name: name.trim(),
    icon: (icon || '✨').trim() || '✨',
    prompt: prompt.trim(),
  });
  await chrome.storage.sync.set({ prompts: list });
  return { ok: true, id };
}

// ===== chrome.commands: キーボードショートカット =====
chrome.commands.onCommand.addListener(async (command) => {
  let payload = null;
  if (command === 'open-menu') payload = { action: 'cmd:openMenu' };
  else if (command === 'repeat-last') payload = { action: 'cmd:repeatLast' };
  else if (command === 'undo-rewrite') payload = { action: 'cmd:undo' };
  else if (command === 'reset-original') payload = { action: 'cmd:reset' };
  else {
    const m = command.match(/^rewrite-(\d+)$/);
    if (m) payload = { action: 'cmd:runByIndex', index: parseInt(m[1], 10) - 1 };
  }
  if (!payload) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    if (!/^https?:\/\/([a-z0-9-]+\.)*slack\.com\//i.test(tab.url || '')) return;
    await chrome.tabs.sendMessage(tab.id, payload);
  } catch {
    // content script がいないタブ等は無視
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'rewrite') {
    handleRewrite(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'savePrompt') {
    handleSavePrompt(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }
  if (message.action === 'getDefaultPrompts') {
    sendResponse(DEFAULT_PROMPTS);
    return false;
  }
});
