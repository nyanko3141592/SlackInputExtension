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

function dictionaryHint(dictionary) {
  if (!dictionary || dictionary.length === 0) return '';
  const lines = dictionary.map((d) => {
    const note = d.note ? ` // ${d.note}` : '';
    return `- "${d.from}" → "${d.to}"${note}`;
  });
  return `\n\n【用語辞書 (厳守)】
以下は「読み (発音や仮名表記) → 表示すべき正式名称」のマッピングです。出力中で「読み」側の表記や、その音に近い表記が現れた場合は、必ず「表示」側の表記に置き換えてください。
${lines.join('\n')}`;
}

function applyDictionary(text, dictionary) {
  if (!text || !dictionary || dictionary.length === 0) return text;
  // 長い reading から順に置換 (短い key が長い key を破壊しないように)
  const entries = [...dictionary].filter((d) => d.from && d.to).sort((a, b) => b.from.length - a.from.length);
  for (const e of entries) {
    text = text.split(e.from).join(e.to);
  }
  return text;
}

function buildPrompt(originalText, promptDef, customInstruction, dictionary) {
  const system = SYSTEM_INSTRUCTION_TEMPLATE.replace('{rules}', SLACK_MRKDWN_RULES);
  const instructionBlock = customInstruction
    ? `${promptDef.prompt}\n\n【追加の指示】\n${customInstruction}`
    : promptDef.prompt;
  const dictBlock = dictionaryHint(dictionary);

  return `${system}${dictBlock}

【リライトの方針: ${promptDef.name}】
${instructionBlock}

【元テキスト】
${originalText}

リライト後の Slack メッセージのみを出力してください。`;
}

const LEGACY_MODEL_MAP = {
  'gemini-2.0-flash': 'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-1.5-flash': 'gemini-2.5-flash-lite',
};

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

function resolveModel(stored) {
  if (!stored) return DEFAULT_MODEL;
  return LEGACY_MODEL_MAP[stored] || stored;
}

// 音声文字起こし用モデル解決
// 優先順位:
//  1. ユーザーが popup で明示的に指定した settings.transcribeModel
//  2. リライト用 model が flash-lite の場合: 自動で gemini-2.5-flash に昇格
//     (lite は音声理解の精度が落ちるため)
//  3. それ以外: リライト用 model をそのまま使う
function resolveTranscribeModel(settings) {
  const explicit = (settings.transcribeModel || '').trim();
  if (explicit) return LEGACY_MODEL_MAP[explicit] || explicit;
  const m = resolveModel(settings.model);
  if (m === 'gemini-2.5-flash-lite' || m.endsWith('-flash-lite')) {
    return 'gemini-2.5-flash';
  }
  return m;
}

async function getSettings() {
  // 設定は sync (端末間同期したい)、辞書は local (8KB/item の制限を回避)
  // ただし旧バージョンで sync.dictionary に書かれていた場合のフォールバックも持つ
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get([
      'apiKey',
      'apiMode',
      'gatewayUrl',
      'memberToken',
      'model',
      'transcribeModel',
      'transcribePrompt',
      'prompts',
      'dictionary',
    ]),
    chrome.storage.local.get(['dictionary']),
  ]);
  const dictionary = Array.isArray(localData.dictionary)
    ? localData.dictionary
    : Array.isArray(syncData.dictionary)
      ? syncData.dictionary
      : [];
  return {
    apiKey: syncData.apiKey || '',
    apiMode: syncData.apiMode || 'direct',
    gatewayUrl: syncData.gatewayUrl || '',
    memberToken: syncData.memberToken || '',
    model: resolveModel(syncData.model),
    transcribeModel: syncData.transcribeModel || '',
    transcribePrompt: (syncData.transcribePrompt || '').trim() || DEFAULT_TRANSCRIBE_PROMPT,
    prompts:
      Array.isArray(syncData.prompts) && syncData.prompts.length > 0 ? syncData.prompts : DEFAULT_PROMPTS,
    dictionary,
  };
}

function resolveGateway(settings) {
  if (settings.apiMode === 'gateway' && settings.gatewayUrl) {
    return {
      apiKey: null,
      gatewayUrl: settings.gatewayUrl,
      memberToken: settings.memberToken || '',
    };
  }
  if (!settings.apiKey) {
    throw new Error('API キーが未設定です。拡張機能アイコンから API キーを設定してください。');
  }
  return { apiKey: settings.apiKey, gatewayUrl: null, memberToken: '' };
}

async function callGemini({ apiKey, model, prompt, gatewayUrl, memberToken }) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
  };

  let url;
  const headers = { 'Content-Type': 'application/json' };
  if (gatewayUrl) {
    url = `${gatewayUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
    // 認証付き Gateway のみ X-Member-Token を添付
    if (memberToken) headers['X-Member-Token'] = memberToken;
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
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
  const { apiKey, gatewayUrl, memberToken } = resolveGateway(settings);

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
    const prompt = buildPrompt(originalText, promptDef, null, settings.dictionary);
    const rawResult = await callGemini({
      apiKey,
      model: settings.model,
      prompt,
      gatewayUrl,
      memberToken,
    });
    return { result: applyDictionary(rawResult, settings.dictionary) };
  }

  promptDef = settings.prompts.find((p) => p.id === promptId);
  if (!promptDef) throw new Error('プロンプトが見つかりません');

  const prompt = buildPrompt(originalText, promptDef, customInstruction, settings.dictionary);
  const rawResult = await callGemini({
    apiKey,
    model: settings.model,
    prompt,
    gatewayUrl,
    memberToken,
  });
  return { result: applyDictionary(rawResult, settings.dictionary) };
}

// 音声 → 書き起こし用デフォルトプロンプト
// ユーザーは popup の「プロンプト」タブで自由に編集できる
const DEFAULT_TRANSCRIBE_PROMPT = `添付された日本語音声を、聞こえたとおりに忠実に書き起こしてください。

【最優先 - 補正しない】
- 聞こえた音をそのまま忠実にテキスト化する
- 言い直し・言いよどみ・同じ単語の繰り返しはそのまま残す
- 内容を要約・補完・整形しない
- 別の単語に言い換えない・敬語の調整もしない
- 自信のない箇所は、最も近い音をひらがな or カタカナで書く（無理に意味づけしない）

【フィラーのみ削除】
- 「えーと」「あの」「まあ」「ん〜」「えー」「そのー」など、意味のないつなぎ語は削除する
- ただし、フィラー以外の発話内容（言い直し・繰り返しを含む）は変えない

【整形は最低限】
- 句読点は音の自然な切れ目に合わせて入れる（過剰には入れない）
- 改行は段落の明らかな切れ目だけ

【出力】
- 書き起こしテキストのみを出力。説明・注釈・引用符 (「" など) は付けない`;

async function handleTranscribeForInput({ audioBase64, mimeType }) {
  if (!audioBase64) throw new Error('音声データがありません');
  const settings = await getSettings();
  const { apiKey, gatewayUrl, memberToken } = resolveGateway(settings);

  // 音声起こしは flash-lite だと聞き取り精度が落ちるので flash 以上にアップグレード
  // (ユーザーが popup で明示指定していたらそれを優先)
  const transcribeModel = resolveTranscribeModel(settings);

  const promptText = settings.transcribePrompt + dictionaryHint(settings.dictionary);
  const body = {
    contents: [
      {
        parts: [
          { text: promptText },
          { inline_data: { mime_type: mimeType || 'audio/webm', data: audioBase64 } },
        ],
      },
    ],
    // 文字起こしは創造性より忠実さ。temperature を低めに固定
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };

  let url;
  const headers = { 'Content-Type': 'application/json' };
  if (gatewayUrl) {
    url = `${gatewayUrl.replace(/\/$/, '')}/v1beta/models/${transcribeModel}:generateContent`;
    if (memberToken) headers['X-Member-Token'] = memberToken;
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${transcribeModel}:generateContent?key=${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API Error: ${response.status}`);
  }
  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini からのレスポンスが空でした');
  text = text.trim().replace(/^["「』『」]+|["「』『」]+$/g, '');
  // 保険として後処理でも辞書を機械適用 (LLM が無視した場合のフォールバック)
  text = applyDictionary(text, settings.dictionary);
  return { text };
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
  if (message.action === 'transcribeForInput') {
    handleTranscribeForInput(message)
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
  if (message.action === 'getDefaultTranscribePrompt') {
    sendResponse(DEFAULT_TRANSCRIBE_PROMPT);
    return false;
  }
});
