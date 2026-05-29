// Slack AI Rewriter - Popup

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

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

  // 辞書
  dictTbody: document.getElementById('dictTbody'),
  dictCount: document.getElementById('dictCount'),
  dictFrom: document.getElementById('dictFrom'),
  dictTo: document.getElementById('dictTo'),
  dictNote: document.getElementById('dictNote'),
  dictAdd: document.getElementById('dictAdd'),
  dictImport: document.getElementById('dictImport'),
  dictImportFile: document.getElementById('dictImportFile'),
  dictExport: document.getElementById('dictExport'),
  dictClear: document.getElementById('dictClear'),
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
  els.model.value = data.model || DEFAULT_MODEL;
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
    model: modelInput || DEFAULT_MODEL,
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

// ===== 辞書 =====
let dictionary = [];

async function loadDictionary() {
  const data = await chrome.storage.sync.get(['dictionary']);
  dictionary = Array.isArray(data.dictionary) ? data.dictionary : [];
  renderDictionary();
}

function renderDictionary() {
  els.dictCount.textContent = String(dictionary.length);
  els.dictTbody.innerHTML = '';
  if (dictionary.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" class="dict-empty">まだ辞書エントリがありません</td>';
    els.dictTbody.appendChild(tr);
    return;
  }
  // 長い from から表示 (適用順と一致させる)
  const sorted = [...dictionary].sort((a, b) => (b.from || '').length - (a.from || '').length);
  sorted.forEach((entry) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-field="from" /></td>
      <td><input type="text" data-field="to" /></td>
      <td><input type="text" data-field="note" /></td>
      <td><button class="dict-del" title="削除">×</button></td>
    `;
    tr.querySelector('[data-field="from"]').value = entry.from || '';
    tr.querySelector('[data-field="to"]').value = entry.to || '';
    tr.querySelector('[data-field="note"]').value = entry.note || '';
    tr.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('change', () => {
        entry[inp.dataset.field] = inp.value;
        // 配列内の同 id を上書き
        const idx = dictionary.findIndex((x) => x.id === entry.id);
        if (idx !== -1) dictionary[idx] = entry;
        persistDictionary({ rerender: false });
      });
    });
    tr.querySelector('.dict-del').addEventListener('click', () => {
      dictionary = dictionary.filter((x) => x.id !== entry.id);
      persistDictionary();
    });
    els.dictTbody.appendChild(tr);
  });
}

async function persistDictionary({ rerender = true } = {}) {
  await chrome.storage.sync.set({ dictionary });
  if (rerender) renderDictionary();
  else els.dictCount.textContent = String(dictionary.length);
}

els.dictAdd.addEventListener('click', () => {
  const from = els.dictFrom.value.trim();
  const to = els.dictTo.value.trim();
  if (!from || !to) {
    return alert('「読み」と「表示」の両方を入力してください');
  }
  dictionary.push({
    id: `d-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    from,
    to,
    note: els.dictNote.value.trim(),
  });
  els.dictFrom.value = '';
  els.dictTo.value = '';
  els.dictNote.value = '';
  persistDictionary();
  els.dictFrom.focus();
});

// Enter で追加
[els.dictFrom, els.dictTo, els.dictNote].forEach((inp) => {
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      els.dictAdd.click();
    }
  });
});

els.dictClear.addEventListener('click', () => {
  if (dictionary.length === 0) return;
  if (!confirm(`辞書を全削除します (${dictionary.length} 件)。よろしいですか？`)) return;
  dictionary = [];
  persistDictionary();
});

// ===== CSV import / export =====
function csvEscape(s) {
  s = String(s ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseCsv(text) {
  // BOM 除去
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else cur += c;
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((s) => s.toLowerCase().trim());
  // 新仕様: reading / display ; 旧仕様: from / to も互換で受け付ける
  const readingIdx = ['reading', 'from', 'kana', 'pronunciation']
    .map((k) => header.indexOf(k))
    .find((i) => i !== -1);
  const displayIdx = ['display', 'to', 'notation'].map((k) => header.indexOf(k)).find((i) => i !== -1);
  const noteIdx = header.indexOf('note');
  let dataRows;
  let pickFrom, pickTo, pickNote;
  if (readingIdx !== undefined && displayIdx !== undefined) {
    dataRows = rows.slice(1);
    pickFrom = (r) => r[readingIdx];
    pickTo = (r) => r[displayIdx];
    pickNote = (r) => (noteIdx === -1 ? '' : r[noteIdx]);
  } else {
    // ヘッダー無し: 列順 reading,display,note と仮定
    dataRows = rows;
    pickFrom = (r) => r[0];
    pickTo = (r) => r[1];
    pickNote = (r) => r[2];
  }
  return dataRows
    .map((r) => ({
      from: (pickFrom(r) || '').trim(),
      to: (pickTo(r) || '').trim(),
      note: (pickNote(r) || '').trim(),
    }))
    .filter((e) => e.from && e.to);
}

els.dictExport.addEventListener('click', () => {
  if (dictionary.length === 0) {
    return alert('辞書が空です');
  }
  const header = 'reading,display,note\n';
  const body = dictionary
    .map((d) => `${csvEscape(d.from)},${csvEscape(d.to)},${csvEscape(d.note || '')}`)
    .join('\n');
  // Excel 互換のため UTF-8 BOM 付与
  const csv = '﻿' + header + body + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().split('T')[0];
  a.download = `slack-ai-rewriter-dictionary-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

els.dictImport.addEventListener('click', () => els.dictImportFile.click());

els.dictImportFile.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const entries = parseCsv(text);
    if (entries.length === 0) {
      alert(
        'CSV から辞書エントリを読み込めませんでした。\n' +
          'ヘッダー: reading,display,note (note 任意 / 旧 from,to も可) を含む CSV を指定してください。'
      );
      return;
    }
    const existingMap = new Map(dictionary.map((d) => [d.from, d]));
    let added = 0;
    let overwritten = 0;
    for (const ent of entries) {
      if (existingMap.has(ent.from)) {
        const cur = existingMap.get(ent.from);
        cur.to = ent.to;
        cur.note = ent.note;
        overwritten++;
      } else {
        const newEntry = {
          id: `d-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
          ...ent,
        };
        dictionary.push(newEntry);
        existingMap.set(ent.from, newEntry);
        added++;
      }
    }
    await persistDictionary();
    alert(`取り込み完了: 新規 ${added} 件 / 上書き ${overwritten} 件`);
  } catch (err) {
    alert(`CSV の読み込みに失敗しました: ${err.message}`);
  }
  els.dictImportFile.value = '';
});

// ===== 初期化 =====
loadApiSettings();
loadPrompts();
loadDictionary();
