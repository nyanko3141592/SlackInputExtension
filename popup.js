// Slack AI Rewriter - Popup

const els = {
  tabs: document.querySelectorAll('.tab'),
  panels: document.querySelectorAll('.panel'),
  apiMode: document.querySelectorAll('input[name="apiMode"]'),
  apiKeyField: document.getElementById('apiKeyField'),
  gatewayField: document.getElementById('gatewayField'),
  memberTokenField: document.getElementById('memberTokenField'),
  apiKey: document.getElementById('apiKey'),
  gatewayUrl: document.getElementById('gatewayUrl'),
  memberToken: document.getElementById('memberToken'),
  model: document.getElementById('model'),
  saveApi: document.getElementById('saveApi'),
  apiStatus: document.getElementById('apiStatus'),

  promptList: document.getElementById('promptList'),
  promptEditor: document.getElementById('promptEditor'),
  promptIcon: document.getElementById('promptIcon'),
  promptName: document.getElementById('promptName'),
  promptBody: document.getElementById('promptBody'),
  savePrompt: document.getElementById('savePrompt'),
  cancelEdit: document.getElementById('cancelEdit'),
  deletePrompt: document.getElementById('deletePrompt'),
  addPrompt: document.getElementById('addPrompt'),
  resetPrompts: document.getElementById('resetPrompts'),
};

let prompts = [];
let editingId = null;
let defaultPrompts = [];

// ===== タブ =====
els.tabs.forEach((t) => {
  t.addEventListener('click', () => {
    els.tabs.forEach((x) => x.classList.remove('active'));
    els.panels.forEach((p) => p.classList.remove('active'));
    t.classList.add('active');
    document.querySelector(`.panel[data-panel="${t.dataset.tab}"]`).classList.add('active');
  });
});

// ===== API 設定 =====
function updateApiModeUi(mode) {
  if (mode === 'gateway') {
    els.apiKeyField.classList.add('hidden');
    els.gatewayField.classList.remove('hidden');
    els.memberTokenField.classList.remove('hidden');
  } else {
    els.apiKeyField.classList.remove('hidden');
    els.gatewayField.classList.add('hidden');
    els.memberTokenField.classList.add('hidden');
  }
}

els.apiMode.forEach((r) => {
  r.addEventListener('change', () => {
    const mode = document.querySelector('input[name="apiMode"]:checked').value;
    updateApiModeUi(mode);
  });
});

async function loadApiSettings() {
  const data = await chrome.storage.sync.get(['apiKey', 'apiMode', 'gatewayUrl', 'memberToken', 'model']);
  const mode = data.apiMode || 'direct';
  document.querySelector(`input[name="apiMode"][value="${mode}"]`).checked = true;
  els.apiKey.value = data.apiKey || '';
  els.gatewayUrl.value = data.gatewayUrl || '';
  els.memberToken.value = data.memberToken || '';
  els.model.value = data.model || 'gemini-2.5-flash';
  updateApiModeUi(mode);
}

els.saveApi.addEventListener('click', async () => {
  const mode = document.querySelector('input[name="apiMode"]:checked').value;
  // モデル名は前後空白を除去し、空なら推奨デフォルトを使う
  const modelInput = els.model.value.trim();
  const data = {
    apiMode: mode,
    apiKey: els.apiKey.value.trim(),
    gatewayUrl: els.gatewayUrl.value.trim(),
    memberToken: els.memberToken.value.trim(),
    model: modelInput || 'gemini-2.5-flash',
  };
  if (mode === 'direct' && !data.apiKey) {
    return flashStatus('API キーを入力してください', true);
  }
  if (mode === 'gateway' && !data.gatewayUrl) {
    return flashStatus('Gateway URL を入力してください', true);
  }
  // 明らかに不正なモデル名 (gemini プレフィックス無し) を軽く警告
  if (!/^gemini[-\w.]*$/i.test(data.model)) {
    if (!confirm(`モデル名 "${data.model}" は Gemini の命名規則と異なります。このまま保存しますか？`)) {
      return;
    }
  }
  await chrome.storage.sync.set(data);
  // 反映した値を再描画 (空入力時のフォールバック表示)
  els.model.value = data.model;
  flashStatus('✓ 保存しました');
});

function flashStatus(msg, isError = false) {
  els.apiStatus.textContent = msg;
  els.apiStatus.classList.add('show');
  els.apiStatus.classList.toggle('error', isError);
  setTimeout(() => els.apiStatus.classList.remove('show'), 1800);
}

// ===== プロンプト =====
async function loadPrompts() {
  const [data, defaults] = await Promise.all([
    chrome.storage.sync.get(['prompts']),
    chrome.runtime.sendMessage({ action: 'getDefaultPrompts' }),
  ]);
  defaultPrompts = defaults || [];
  prompts =
    Array.isArray(data.prompts) && data.prompts.length > 0
      ? data.prompts
      : JSON.parse(JSON.stringify(defaultPrompts));
  renderPrompts();
}

function renderPrompts() {
  els.promptList.innerHTML = '';
  prompts.forEach((p, idx) => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    if (editingId === p.id) li.classList.add('editing');
    li.innerHTML = `
      <span class="p-icon">${escapeHtml(p.icon || '✨')}</span>
      <span class="p-name">${escapeHtml(p.name)}</span>
      <div class="p-actions">
        <button class="move-up" title="上へ" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="move-down" title="下へ" ${idx === prompts.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="edit" title="編集">✎</button>
      </div>`;
    li.querySelector('.move-up').addEventListener('click', (e) => {
      e.stopPropagation();
      movePrompt(idx, -1);
    });
    li.querySelector('.move-down').addEventListener('click', (e) => {
      e.stopPropagation();
      movePrompt(idx, +1);
    });
    li.querySelector('.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditor(p.id);
    });
    li.addEventListener('click', () => openEditor(p.id));
    els.promptList.appendChild(li);
  });
}

function movePrompt(idx, delta) {
  const j = idx + delta;
  if (j < 0 || j >= prompts.length) return;
  const tmp = prompts[idx];
  prompts[idx] = prompts[j];
  prompts[j] = tmp;
  persistPrompts();
}

function openEditor(id) {
  const p = prompts.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  els.promptIcon.value = p.icon || '';
  els.promptName.value = p.name || '';
  els.promptBody.value = p.prompt || '';
  els.promptEditor.classList.remove('hidden');
  renderPrompts();
  els.promptName.focus();
}

function closeEditor() {
  editingId = null;
  els.promptEditor.classList.add('hidden');
  renderPrompts();
}

els.savePrompt.addEventListener('click', () => {
  if (!editingId) return;
  const p = prompts.find((x) => x.id === editingId);
  if (!p) return;
  const name = els.promptName.value.trim();
  const body = els.promptBody.value.trim();
  if (!name) return alert('プロンプト名を入力してください');
  if (!body) return alert('プロンプト本文を入力してください');
  p.icon = els.promptIcon.value.trim() || '✨';
  p.name = name;
  p.prompt = body;
  persistPrompts();
  closeEditor();
});

els.cancelEdit.addEventListener('click', closeEditor);

els.deletePrompt.addEventListener('click', () => {
  if (!editingId) return;
  if (prompts.length <= 1) return alert('最低1つのプロンプトが必要です');
  if (!confirm('このプロンプトを削除しますか？')) return;
  prompts = prompts.filter((p) => p.id !== editingId);
  persistPrompts();
  closeEditor();
});

els.addPrompt.addEventListener('click', () => {
  const id = `custom-${Date.now()}`;
  prompts.push({
    id,
    name: '新しいプロンプト',
    icon: '✨',
    prompt: '次の Slack メッセージを、以下の方針でリライトしてください。\n\n【方針】\n- ',
  });
  persistPrompts();
  openEditor(id);
});

els.resetPrompts.addEventListener('click', () => {
  if (!confirm('プロンプトをデフォルトに戻しますか？カスタマイズは失われます。')) return;
  prompts = JSON.parse(JSON.stringify(defaultPrompts));
  persistPrompts();
  closeEditor();
});

async function persistPrompts() {
  await chrome.storage.sync.set({ prompts });
  renderPrompts();
}

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );
}

// ===== 初期化 =====
loadApiSettings();
loadPrompts();
