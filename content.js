// Slack AI Rewriter - Content Script (Inline 版)
// ストリップを Slack の composer 内に直接 inline 挿入する設計
// - position: fixed のフローティングを廃止 → 位置ズレが構造的に発生しない
// - 各 composer (メイン/スレッド/DM) にそれぞれストリップが共存
// - Slack の flex layout がスペース配分してくれる

(() => {
  'use strict';

  let prompts = [];
  let busy = false;
  let isReplacing = false;
  let lastPromptInfo = null;
  let lastMouseDownTime = 0;
  let lastMouseDownOnEditor = false;

  // グローバル mousedown 監視: ユーザーが Slack 入力欄を明示的にクリックしたか判定するため
  document.addEventListener(
    'mousedown',
    (e) => {
      lastMouseDownTime = Date.now();
      const ed = e.target.closest && e.target.closest('.ql-editor[contenteditable="true"]');
      lastMouseDownOnEditor = !!ed;
    },
    true
  );

  // ======== グローバル popup (プロンプト一覧) - body 直下に配置 ========
  // Slack のサイドバー overflow:hidden に切られないよう、composer 階層から離す
  const globalPopup = document.createElement('div');
  globalPopup.className = 'sair-popup-global';
  globalPopup.style.cssText = `
    display: none;
    position: fixed;
    background: #1a1d21;
    color: #d1d2d3;
    border-radius: 8px;
    border: 1px solid #353a3f;
    box-shadow: 0 12px 28px rgba(0,0,0,0.5), 0 0 0 4px rgba(74,21,75,0.18);
    padding: 6px;
    width: 280px;
    max-height: 360px;
    overflow: auto;
    z-index: 2147483647;
    font-family: -apple-system, sans-serif;
    font-size: 13px;
    pointer-events: auto;
  `;
  // body が存在する時点で append (init 時に必ず存在)
  function ensurePopupAttached() {
    if (!globalPopup.isConnected) {
      (document.body || document.documentElement).appendChild(globalPopup);
    }
  }
  let currentPopupContext = null; // { editor, input, strip }
  function showGlobalPopup(anchorBtn, editor, input, strip) {
    ensurePopupAttached();
    currentPopupContext = { editor, input, strip };
    renderGlobalPopupList();
    const r = anchorBtn.getBoundingClientRect();
    globalPopup.style.display = 'block';
    globalPopup.style.visibility = 'hidden';
    const pw = globalPopup.offsetWidth;
    const ph = globalPopup.offsetHeight;
    globalPopup.style.visibility = '';
    let top = r.top - ph - 6;
    if (top < 4) top = r.bottom + 6;
    if (top + ph > window.innerHeight - 4) top = window.innerHeight - ph - 4;
    if (top < 4) top = 4;
    let left = r.left;
    if (left + pw > window.innerWidth - 4) left = window.innerWidth - pw - 4;
    if (left < 4) left = 4;
    globalPopup.style.top = `${top}px`;
    globalPopup.style.left = `${left}px`;
  }
  function hideGlobalPopup() {
    globalPopup.style.display = 'none';
    currentPopupContext = null;
  }
  function renderGlobalPopupList() {
    globalPopup.innerHTML = '';
    if (!currentPopupContext) return;
    const { editor } = currentPopupContext;
    prompts.forEach((p, idx) => {
      const item = document.createElement('button');
      item.style.cssText = `
        display:flex;align-items:center;gap:8px;width:100%;
        padding:7px 8px;border:none;background:transparent;
        border-radius:5px;cursor:pointer;font-size:13px;color:#d1d2d3;
        text-align:left;font-family:inherit
      `;
      const sc =
        idx < 9
          ? `<span style="font-size:10px;color:#9a9b9d;padding:1px 4px;border:1px solid #353a3f;border-radius:3px;font-family:monospace">${idx + 1}</span>`
          : '';
      item.innerHTML = `
        <span style="font-size:14px">${escapeHtml(p.icon || '✨')}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</span>
        ${sc}`;
      item.addEventListener('mouseenter', () => {
        item.style.background = '#2c2f33';
        item.style.color = '#fff';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
        item.style.color = '#d1d2d3';
      });
      item.addEventListener('mousedown', (e) => e.preventDefault());
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideGlobalPopup();
        runRewrite(editor, { promptId: p.id });
      });
      globalPopup.appendChild(item);
    });
    if (prompts.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:10px;color:#9a9b9d;font-size:12px;text-align:center';
      empty.textContent = 'プロンプトが登録されていません (拡張機能アイコンから追加)';
      globalPopup.appendChild(empty);
    }
  }
  // 外部クリックで閉じる
  document.addEventListener(
    'mousedown',
    (e) => {
      if (globalPopup.style.display === 'none') return;
      if (globalPopup.contains(e.target)) return;
      // ✨ AI ▾ ボタンがクリックされた場合は togglePopup の方が処理する
      if (e.target.closest && e.target.closest('.sair-prompt')) return;
      hideGlobalPopup();
    },
    true
  );
  // ウィンドウリサイズ・スクロールで位置追従
  window.addEventListener(
    'scroll',
    () => {
      if (globalPopup.style.display === 'block' && currentPopupContext) {
        const strip = currentPopupContext.strip;
        const btn = strip.querySelector('.sair-prompt');
        if (btn) showGlobalPopup(btn, currentPopupContext.editor, currentPopupContext.input, strip);
      }
    },
    true
  );

  // 各 composer に紐づくセッション {original, stack}
  // editor → session
  const sessions = new WeakMap();
  // 各 composer に対応するストリップ要素 {composer → strip}
  const stripByComposer = new WeakMap();

  // ======== 初期化 ========
  function init() {
    console.log('[SAIR] Slack AI Rewriter loaded (inline-strip mode)');
    loadPrompts();
    setupObserver();
    chrome.storage.onChanged.addListener((c) => {
      if (c.prompts) loadPrompts();
    });
    // 既に存在する composer に注入
    scanAndInject();
  }

  async function loadPrompts() {
    try {
      const r = await chrome.runtime.sendMessage({ action: 'getSettings' });
      prompts = r?.prompts || [];
    } catch {
      prompts = [];
    }
  }

  // ======== Slack DOM のスキャン ========
  function scanAndInject() {
    // 全ての composer を発見してストリップを注入
    const composers = document.querySelectorAll('.c-wysiwyg_container');
    composers.forEach((c) => maybeInject(c));
  }

  function setupObserver() {
    // DOM 変更を監視して新しい composer にも注入
    const obs = new MutationObserver(() => {
      // debounce
      if (setupObserver._t) return;
      setupObserver._t = setTimeout(() => {
        setupObserver._t = null;
        scanAndInject();
      }, 150);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function maybeInject(composer) {
    if (!composer || !composer.isConnected) return;
    if (composer.querySelector(':scope > * .sair-strip-inline')) return; // 既にある
    if (composer.querySelector('.sair-strip-inline')) return;
    const editor = composer.querySelector('.ql-editor[contenteditable="true"]');
    if (!editor) return;
    const footer = composer.querySelector('.c-wysiwyg_container__footer');
    const suffix = footer ? footer.querySelector('.c-wysiwyg_container__suffix') : null;
    if (!footer || !suffix) return;
    const strip = makeStrip(editor);
    // 送信ボタン (suffix) の直前に挿入
    footer.insertBefore(strip, suffix);
    stripByComposer.set(composer, strip);
  }

  // ======== ストリップ要素を作る ========
  function makeStrip(editor) {
    const strip = document.createElement('div');
    strip.className = 'sair-strip-inline';
    strip.style.cssText = `
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: 4px;
      min-width: 0;
      padding: 0 6px;
      margin: 0 4px;
      border-left: 1px solid rgba(127, 127, 127, 0.25);
      border-right: 1px solid rgba(127, 127, 127, 0.25);
    `;

    const btnStyle = `
      display:none;align-items:center;justify-content:center;
      background:transparent;border:1px solid transparent;color:currentColor;
      cursor:pointer;padding:0;width:26px;height:26px;border-radius:5px;
      font-size:13px;font-family:inherit;opacity:0.7;flex-shrink:0;
    `;

    strip.innerHTML = `
      <button class="sair-undo" title="直前のリライトを取り消す" style="${btnStyle}">↩</button>
      <button class="sair-reset" title="原型に戻す" style="${btnStyle}">⟲</button>
      <button class="sair-prompt" title="保存済みプロンプト (↓ キー)"
        style="display:inline-flex;align-items:center;gap:3px;background:transparent;border:1px solid rgba(127,127,127,0.35);color:currentColor;cursor:pointer;padding:0 7px;height:26px;border-radius:5px;font-size:11.5px;font-weight:600;font-family:inherit;white-space:nowrap;flex-shrink:0;opacity:0.9">
        <span style="font-size:12px;color:#ECB22E">✨</span>
        <span>AI</span>
        <span style="font-size:9px;opacity:0.7">▾</span>
      </button>
      <button class="sair-mic" title="音声で指示を録音 (クリック開始 / もう一度で停止)"
        style="display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;color:currentColor;cursor:pointer;padding:0;width:28px;height:26px;border-radius:5px;font-size:14px;font-family:inherit;flex-shrink:0;opacity:0.85">🎤</button>
      <input class="sair-input" type="text"
        placeholder="AI 指示を書いて Enter (🎤で音声入力可)"
        spellcheck="false"
        style="flex:1 1 auto;min-width:80px;height:26px;padding:0 10px;background:rgba(127,127,127,0.1);border:1px solid transparent;border-radius:5px;color:currentColor;font-size:12.5px;font-family:inherit;outline:none" />
      <button class="sair-close" title="閉じる" style="background:transparent;border:none;color:currentColor;cursor:pointer;padding:0 4px;height:26px;border-radius:5px;font-size:12px;font-family:inherit;opacity:0.5;flex-shrink:0">✗</button>
    `;

    const undoBtn = strip.querySelector('.sair-undo');
    const resetBtn = strip.querySelector('.sair-reset');
    const promptBtn = strip.querySelector('.sair-prompt');
    const micBtn = strip.querySelector('.sair-mic');
    const input = strip.querySelector('.sair-input');
    const closeBtn = strip.querySelector('.sair-close');

    // hover
    [undoBtn, resetBtn, promptBtn, micBtn, closeBtn].forEach((b) => {
      b.addEventListener('mouseenter', () => {
        b.style.background = 'rgba(127,127,127,0.2)';
        b.style.opacity = '1';
      });
      b.addEventListener('mouseleave', () => {
        b.style.background = 'transparent';
        b.style.opacity = b === closeBtn ? '0.5' : '0.85';
      });
      b.addEventListener('mousedown', (e) => e.preventDefault());
    });
    let inputActive = false; // ユーザーがストリップ入力中だったか
    let imeInStrip = false;

    input.addEventListener('focus', () => {
      input.style.borderColor = '#4A154B';
      input.style.background = 'rgba(127,127,127,0.18)';
      inputActive = true;
    });
    input.addEventListener('compositionstart', () => {
      imeInStrip = true;
    });
    input.addEventListener('compositionend', () => {
      setTimeout(() => {
        imeInStrip = false;
      }, 50);
    });
    input.addEventListener('blur', (e) => {
      input.style.borderColor = 'transparent';
      input.style.background = 'rgba(127,127,127,0.1)';
      if (!inputActive) return;
      // ストリップ内の他要素にフォーカスが移ったなら OK
      const next = e.relatedTarget;
      if (next && (strip.contains(next) || (next.closest && next.closest('.sair-popup')))) {
        return;
      }
      // フォーカスを取り戻すか判定 (少し遅延して current focus を見る)
      setTimeout(() => {
        if (imeInStrip) return;
        const ae = document.activeElement;
        // ストリップ内に既にフォーカスがあれば OK
        if (ae && strip.contains(ae)) {
          return;
        }
        // フォーカスが ql-editor (Slack 入力欄) に飛んでいる場合
        if (ae && ae.classList && ae.classList.contains('ql-editor')) {
          // ユーザーが ql-editor を直接クリックして移動したなら戻さない
          const recent = Date.now() - lastMouseDownTime < 250;
          if (recent && lastMouseDownOnEditor) {
            // ユーザー意図 → ストリップ閉じる挙動はせず、active 解除のみ
            inputActive = false;
            return;
          }
          // それ以外 (React や Slack の自動 focus) → ストリップに戻す
          try {
            input.focus();
          } catch {}
          return;
        }
        // body や他要素にフォーカス → ストリップに戻す (連続編集を維持)
        if (!ae || ae === document.body) {
          try {
            input.focus();
          } catch {}
        } else {
          inputActive = false;
        }
      }, 10);
    });

    // クリックハンドラ
    undoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      doUndo(editor);
    });
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      doReset(editor);
    });
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      inputActive = false;
      // 完全に閉じる場合は strip を削除 (再表示は scanAndInject で再注入)
      // ただし scanAndInject が即座に再注入するので、ここでは入力欄だけクリア
      input.value = '';
      // Slack 入力欄に戻す
      try {
        editor.focus();
      } catch {}
    });
    promptBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (globalPopup.style.display === 'block') {
        hideGlobalPopup();
      } else {
        showGlobalPopup(promptBtn, editor, input, strip);
      }
    });

    // ======== マイクボタン (音声→文字起こし→自動Enter) ========
    let mediaRecorder = null;
    let mediaStream = null;
    let audioChunks = [];
    let recording = false;

    function setMicState(state) {
      // state: 'idle' | 'recording' | 'transcribing'
      if (state === 'recording') {
        micBtn.textContent = '⏹';
        micBtn.style.background = 'rgba(255, 92, 92, 0.25)';
        micBtn.style.color = '#ff5c5c';
        micBtn.title = '録音中 (クリックで停止)';
      } else if (state === 'transcribing') {
        micBtn.textContent = '⋯';
        micBtn.style.background = 'rgba(127,127,127,0.2)';
        micBtn.style.color = 'currentColor';
        micBtn.title = '文字起こし中...';
        micBtn.disabled = true;
      } else {
        micBtn.textContent = '🎤';
        micBtn.style.background = 'transparent';
        micBtn.style.color = 'currentColor';
        micBtn.title = '音声で指示を録音 (クリック開始 / もう一度で停止)';
        micBtn.disabled = false;
      }
    }

    async function startRecording() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        showStripError(input, 'マイクが使えません: ' + (err.message || err.name));
        return;
      }
      audioChunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mime });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        if (mediaStream) {
          mediaStream.getTracks().forEach((t) => t.stop());
          mediaStream = null;
        }
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];
        if (blob.size < 200) {
          setMicState('idle');
          showStripError(input, '録音が短すぎます');
          return;
        }
        setMicState('transcribing');
        try {
          const base64 = await blobToBase64(blob);
          const res = await chrome.runtime.sendMessage({
            action: 'transcribeInstruction',
            audioBase64: base64,
            mimeType: 'audio/webm',
          });
          if (res?.error) throw new Error(res.error);
          const text = (res.text || '').trim();
          if (!text) throw new Error('指示が認識できませんでした');
          input.value = text;
          setMicState('idle');
          // 自動で Enter (=リライト実行)
          runRewrite(editor, { promptId: 'oneshot', customInstruction: text });
          input.value = '';
        } catch (err) {
          setMicState('idle');
          showStripError(input, '✗ ' + (err.message || '文字起こし失敗'));
        }
      };
      mediaRecorder.start(500);
      recording = true;
      setMicState('recording');
    }

    function stopRecording() {
      if (!recording) return;
      recording = false;
      try {
        mediaRecorder && mediaRecorder.stop();
      } catch {}
    }

    micBtn.addEventListener('mousedown', (e) => e.preventDefault());
    micBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (micBtn.disabled) return;
      if (recording) stopRecording();
      else startRecording();
    });

    // input handlers
    // Slack に key event を漏らさない（送信誤発火防止）
    [
      'keydown',
      'keyup',
      'keypress',
      'input',
      'beforeinput',
      'compositionstart',
      'compositionupdate',
      'compositionend',
    ].forEach((ev) => input.addEventListener(ev, (e) => e.stopPropagation()));
    input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const instr = input.value.trim();
        if (instr) {
          runRewrite(editor, { promptId: 'oneshot', customInstruction: instr });
          input.value = '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (globalPopup.style.display === 'block') hideGlobalPopup();
        else showGlobalPopup(promptBtn, editor, input, strip);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideGlobalPopup();
      }
    });

    // セッション初期化（必要時）
    updateHistoryButtonsForStrip(strip, editor);

    // セッション履歴の変更で履歴ボタンを更新するため、editor の input を監視
    editor.addEventListener('input', () => {
      if (isReplacing) return;
      const s = sessions.get(editor);
      if (s && getEditorText(editor) === '') {
        sessions.delete(editor);
        updateHistoryButtonsForStrip(strip, editor);
      }
    });

    return strip;
  }

  function updateHistoryButtonsForStrip(strip, editor) {
    const s = sessions.get(editor);
    const stackLen = s ? s.stack.length : 0;
    const undoBtn = strip.querySelector('.sair-undo');
    const resetBtn = strip.querySelector('.sair-reset');
    if (undoBtn) undoBtn.style.display = stackLen > 0 ? 'inline-flex' : 'none';
    if (resetBtn) resetBtn.style.display = stackLen > 0 ? 'inline-flex' : 'none';
  }

  function updateAllStripHistory(editor) {
    // editor が含まれる composer 内のストリップを更新
    const composer = editor.closest('.c-wysiwyg_container');
    if (!composer) return;
    const strip = composer.querySelector('.sair-strip-inline');
    if (strip) updateHistoryButtonsForStrip(strip, editor);
  }

  // ======== セッション履歴 ========
  function getSession(editor) {
    let s = sessions.get(editor);
    if (!s) {
      s = { original: getEditorText(editor), stack: [] };
      sessions.set(editor, s);
    }
    return s;
  }

  function doUndo(editor) {
    const s = sessions.get(editor);
    if (!s || s.stack.length === 0) return;
    const prev = s.stack.pop();
    replaceEditorText(editor, prev);
    if (s.stack.length === 0) sessions.delete(editor);
    updateAllStripHistory(editor);
    flashToast(editor, '↩ 直前に戻しました');
  }

  function doReset(editor) {
    const s = sessions.get(editor);
    if (!s) return;
    replaceEditorText(editor, s.original);
    sessions.delete(editor);
    updateAllStripHistory(editor);
    flashToast(editor, '⟲ 原型に戻しました');
  }

  // ======== テキスト取得・置換 ========
  function getEditorText(el) {
    if (!el) return '';
    return el.innerText.replace(/ /g, ' ').replace(/\s+$/g, '');
  }

  function replaceEditorText(el, text) {
    if (!el) return;
    isReplacing = true;
    try {
      el.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.addRange(range);
      const ok = document.execCommand('insertText', false, text);
      if (!ok) {
        el.dispatchEvent(
          new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: text,
            bubbles: true,
            cancelable: true,
          })
        );
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
      setTimeout(() => {
        isReplacing = false;
      }, 80);
    }
  }

  // ======== リライト実行 ========
  async function runRewrite(editor, { promptId, customInstruction }) {
    if (busy || !editor) return;
    const original = getEditorText(editor);
    if (!original) {
      flashToast(editor, '入力欄が空です', 'error');
      return;
    }
    busy = true;
    lastPromptInfo = { promptId, customInstruction };
    const session = getSession(editor);
    session.stack.push(original);
    const label = formatLabel(promptId, customInstruction);
    flashToast(editor, `${label}...`, 'info', 60000);
    try {
      const res = await chrome.runtime.sendMessage({
        action: 'rewrite',
        originalText: original,
        promptId,
        customInstruction,
      });
      if (res?.error) throw new Error(res.error);
      replaceEditorText(editor, res.result);
      updateAllStripHistory(editor);
      flashToast(editor, `✓ ${label}`, 'success');
      // 続けて指示を出せるようストリップ入力欄にフォーカスを戻す
      setTimeout(() => {
        const composer = editor.closest('.c-wysiwyg_container');
        const inp = composer ? composer.querySelector('.sair-input') : null;
        if (inp)
          try {
            inp.focus();
          } catch {}
      }, 120);
    } catch (err) {
      session.stack.pop();
      if (session.stack.length === 0 && session.original === original) sessions.delete(editor);
      flashToast(editor, '✗ ' + (err.message || 'リライト失敗'), 'error', 4000);
    } finally {
      busy = false;
    }
  }

  function formatLabel(promptId, customInstruction) {
    if (promptId === 'oneshot') return `✨ ${(customInstruction || '').slice(0, 28)}`;
    const p = prompts.find((x) => x.id === promptId);
    return p ? `${p.icon || ''} ${p.name}` : 'リライト';
  }

  // ======== 簡易トースト (composer の上にインライン表示) ========
  let toastTimer = null;
  function flashToast(editor, message, kind = 'success', durationMs = 1800) {
    const composer = editor.closest('.c-wysiwyg_container');
    if (!composer) return;
    let t = composer.querySelector('.sair-toast-inline');
    if (!t) {
      t = document.createElement('div');
      t.className = 'sair-toast-inline';
      t.style.cssText = `
        position: absolute;
        right: 12px;
        top: -28px;
        padding: 4px 10px;
        background: #1a1d21;
        color: #d1d2d3;
        border-radius: 5px;
        font-size: 11.5px;
        font-family: -apple-system, sans-serif;
        pointer-events: none;
        z-index: 5;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        opacity: 0;
        transition: opacity 0.15s ease;
        white-space: nowrap;
        max-width: 90%;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      composer.style.position = composer.style.position || 'relative';
      composer.appendChild(t);
    }
    t.style.color = kind === 'error' ? '#ff6b76' : kind === 'success' ? '#2eb67d' : '#d1d2d3';
    t.textContent = message;
    requestAnimationFrame(() => {
      t.style.opacity = '1';
    });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.style.opacity = '0';
    }, durationMs);
  }

  // ======== chrome.commands 受信 (Slack 入力欄にフォーカス中のみ) ========
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg.action !== 'string' || !msg.action.startsWith('cmd:')) return;
    // フォーカス中の editor を取得
    const ae = document.activeElement;
    let editor = null;
    if (ae && ae.classList && ae.classList.contains('ql-editor')) {
      editor = ae;
    } else {
      // フォーカスが他にある場合はメイン入力欄を試す
      editor = document.querySelector('.ql-editor[contenteditable="true"]');
    }
    if (!editor) return;
    const composer = editor.closest('.c-wysiwyg_container');
    const strip = composer ? composer.querySelector('.sair-strip-inline') : null;
    switch (msg.action) {
      case 'cmd:openMenu':
        if (strip) {
          const input = strip.querySelector('.sair-input');
          if (strip.style.display === 'none') strip.style.display = 'flex';
          input.focus();
        }
        break;
      case 'cmd:repeatLast':
        if (lastPromptInfo) runRewrite(editor, lastPromptInfo);
        break;
      case 'cmd:runByIndex': {
        const p = prompts[msg.index];
        if (p) runRewrite(editor, { promptId: p.id });
        break;
      }
      case 'cmd:undo':
        doUndo(editor);
        break;
      case 'cmd:reset':
        doReset(editor);
        break;
    }
  });

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

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const comma = dataUrl.indexOf(',');
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }

  function showStripError(input, msg) {
    const prev = input.placeholder;
    const prevBorder = input.style.borderColor;
    input.placeholder = msg;
    input.style.borderColor = '#ff6b76';
    setTimeout(() => {
      input.placeholder = prev || 'AI 指示を書いて Enter (🎤で音声入力可)';
      input.style.borderColor = prevBorder || 'transparent';
    }, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
