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
    globalPopup.appendChild(makeSaveAsButtonItem());
    if (prompts.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:10px;color:#9a9b9d;font-size:12px;text-align:center';
      empty.textContent = 'プロンプトが登録されていません (拡張機能アイコンから追加)';
      globalPopup.appendChild(empty);
    }
  }
  // 指示欄に書いた内容を、ストリップに常時出るボタンとして保存する
  function makeSaveAsButtonItem() {
    const { input } = currentPopupContext;
    const instr = (input?.value || '').trim();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border-top:1px solid #353a3f;margin-top:4px;padding-top:4px';
    if (!instr) {
      wrap.innerHTML = `<div style="padding:6px 8px;color:#9a9b9d;font-size:11.5px;line-height:1.5">
        指示欄に書いてからここを開くと、その指示をボタンとして保存できます</div>`;
      return wrap;
    }
    const item = document.createElement('button');
    item.style.cssText = `
      display:flex;align-items:center;gap:8px;width:100%;
      padding:7px 8px;border:none;background:transparent;
      border-radius:5px;cursor:pointer;font-size:12.5px;color:#ECB22E;
      text-align:left;font-family:inherit
    `;
    item.textContent = `📌 「${instr.slice(0, 16)}${instr.length > 16 ? '…' : ''}」をボタンにする`;
    item.addEventListener('mouseenter', () => (item.style.background = '#2c2f33'));
    item.addEventListener('mouseleave', () => (item.style.background = 'transparent'));
    item.addEventListener('mousedown', (e) => e.preventDefault());
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const editor = currentPopupContext?.editor;
      hideGlobalPopup();
      const name = instr.replace(/\s+/g, ' ').slice(0, 12);
      const res = await chrome.runtime.sendMessage({
        action: 'savePrompt',
        name,
        icon: '⭐',
        prompt: instr,
        pinned: true,
      });
      if (!editor) return;
      if (res?.error) flashToast(editor, '✗ ' + res.error, 'error', 3000);
      else {
        input.value = '';
        flashToast(editor, `📌 「${name}」をボタンにしました (名前は設定画面で変更可)`, 'success', 3000);
      }
    });
    wrap.appendChild(item);
    return wrap;
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
    document.querySelectorAll('.sair-strip-inline').forEach((strip) => {
      if (strip._sairEditor) renderQuickButtons(strip, strip._sairEditor);
    });
  }

  // ======== ボタン表示 (pinned) のプロンプトをストリップに並べる ========
  function renderQuickButtons(strip, editor) {
    const wrap = strip.querySelector('.sair-quick');
    if (!wrap) return;
    wrap.innerHTML = '';
    prompts
      .filter((p) => p.pinned)
      .forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = p.name;
        b.style.cssText = `
          display:inline-flex;align-items:center;gap:3px;background:transparent;
          border:1px solid rgba(127,127,127,0.35);color:currentColor;cursor:pointer;
          padding:0 7px;height:26px;border-radius:5px;font-size:11.5px;font-family:inherit;
          white-space:nowrap;flex-shrink:0;opacity:0.85;max-width:9em;overflow:hidden
        `;
        const icon = document.createElement('span');
        icon.textContent = p.icon || '✨';
        const name = document.createElement('span');
        name.textContent = p.name;
        name.style.cssText = 'overflow:hidden;text-overflow:ellipsis';
        b.append(icon, name);
        b.addEventListener('mouseenter', () => {
          b.style.background = 'rgba(127,127,127,0.2)';
          b.style.opacity = '1';
        });
        b.addEventListener('mouseleave', () => {
          b.style.background = 'transparent';
          b.style.opacity = '0.85';
        });
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          runRewrite(editor, { promptId: p.id });
        });
        wrap.appendChild(b);
      });
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
      align-items: flex-end;
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
      <div class="sair-quick" style="display:inline-flex;align-items:flex-end;gap:4px;flex:0 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none"></div>
      <button class="sair-mic" title="音声で Slack 入力欄に挿入 (クリック開始 / もう一度で停止)"
        style="display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;color:currentColor;cursor:pointer;padding:0;width:28px;height:28px;border-radius:5px;font-size:14px;font-family:inherit;flex-shrink:0;opacity:0.85;align-self:flex-end">🎤</button>
      <textarea class="sair-input"
        placeholder="AI 指示を書いて Enter (Shift+Enter で改行)"
        spellcheck="false"
        rows="1"
        style="flex:1 1 auto;min-width:80px;min-height:28px;max-height:140px;padding:5px 10px;background:rgba(127,127,127,0.1);border:1px solid transparent;border-radius:5px;color:currentColor;font-size:12.5px;font-family:inherit;outline:none;resize:none;line-height:1.4;overflow-y:auto"></textarea>
      <button class="sair-close" title="閉じる" style="background:transparent;border:none;color:currentColor;cursor:pointer;padding:0 4px;height:28px;border-radius:5px;font-size:12px;font-family:inherit;opacity:0.5;flex-shrink:0;align-self:flex-end">✗</button>
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
      input.value = '';
      input.style.height = 'auto'; // 高さリセット
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
    // 最大録音時間制限
    const MAX_RECORDING_MS = 5 * 60 * 1000; // 5 分
    const WARN_BEFORE_MS = 30 * 1000; // 残り 30 秒で警告
    let maxDurationTimerId = null;
    let warningTimerId = null;
    // Volume meter
    let audioCtx = null;
    let analyser = null;
    let volRafId = null;
    let smoothedVol = 0; // ローパスでカクつき抑制

    function setMicState(state) {
      // state: 'idle' | 'recording' | 'transcribing'
      if (state === 'recording') {
        micBtn.textContent = '⏹';
        micBtn.style.background = 'rgba(255, 92, 92, 0.2)';
        micBtn.style.color = '#ff5c5c';
        micBtn.style.boxShadow = '0 0 0 0 rgba(255, 92, 92, 0.5)';
        micBtn.style.transition = 'box-shadow 80ms ease-out, background 80ms ease-out';
        micBtn.title = '録音中 (クリックで停止)';
      } else if (state === 'transcribing') {
        micBtn.textContent = '⋯';
        micBtn.style.background = 'rgba(127,127,127,0.2)';
        micBtn.style.color = 'currentColor';
        micBtn.style.boxShadow = 'none';
        micBtn.style.transition = '';
        micBtn.title = '文字起こし中...';
        micBtn.disabled = true;
      } else {
        micBtn.textContent = '🎤';
        micBtn.style.background = 'transparent';
        micBtn.style.color = 'currentColor';
        micBtn.style.boxShadow = 'none';
        micBtn.style.transition = '';
        micBtn.title = '音声で Slack 入力欄に挿入 (クリック開始 / もう一度で停止)';
        micBtn.disabled = false;
      }
    }

    function startVolumeMeter(stream) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!recording || !analyser) return;
          analyser.getByteTimeDomainData(buf);
          // RMS: 中央値 128 からのズレを 2乗平均
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          // 0〜1 にスケール (RMS は通常 0〜0.3 程度なので *3.5 して頭打ち)
          const raw = Math.min(1, rms * 3.5);
          // ローパスで滑らかに (上昇は速く、下降は遅く)
          smoothedVol = raw > smoothedVol ? raw : smoothedVol * 0.85 + raw * 0.15;
          // 反映: box-shadow の広がり + 背景の濃度
          const spread = Math.round(smoothedVol * 14);
          const blur = Math.round(smoothedVol * 6);
          const sOpacity = (0.25 + smoothedVol * 0.5).toFixed(2);
          const bgAlpha = (0.15 + smoothedVol * 0.45).toFixed(2);
          micBtn.style.boxShadow = `0 0 ${blur}px ${spread}px rgba(255, 92, 92, ${sOpacity})`;
          micBtn.style.background = `rgba(255, 92, 92, ${bgAlpha})`;
          volRafId = requestAnimationFrame(tick);
        };
        volRafId = requestAnimationFrame(tick);
      } catch {
        // AudioContext 失敗時は無視 (録音自体は継続)
      }
    }

    function stopVolumeMeter() {
      if (volRafId) cancelAnimationFrame(volRafId);
      volRafId = null;
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch {}
      }
      audioCtx = null;
      analyser = null;
      smoothedVol = 0;
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
        stopVolumeMeter();
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
            action: 'transcribeForInput',
            audioBase64: base64,
            mimeType: 'audio/webm',
          });
          if (res?.error) throw new Error(res.error);
          const text = (res.text || '').trim();
          if (!text) throw new Error('音声が認識できませんでした');
          // Slack 入力欄の末尾に挿入 (リライトは実行しない)
          appendToEditor(editor, text);
          setMicState('idle');
        } catch (err) {
          setMicState('idle');
          showStripError(input, '✗ ' + (err.message || '文字起こし失敗'));
        }
      };
      mediaRecorder.start(500);
      recording = true;
      setMicState('recording');
      startVolumeMeter(mediaStream);

      // 残り 30 秒で警告 (input placeholder で通知)
      warningTimerId = setTimeout(() => {
        if (recording) {
          showStripError(input, '⚠️ 残り 30 秒で自動停止します (最大 5 分)');
        }
      }, MAX_RECORDING_MS - WARN_BEFORE_MS);

      // 5 分で自動停止
      maxDurationTimerId = setTimeout(() => {
        if (recording) {
          stopRecording();
          showStripError(input, '⏱ 最大録音時間 (5分) に達したので停止しました');
        }
      }, MAX_RECORDING_MS);
    }

    function stopRecording() {
      if (!recording) return;
      recording = false;
      if (maxDurationTimerId) {
        clearTimeout(maxDurationTimerId);
        maxDurationTimerId = null;
      }
      if (warningTimerId) {
        clearTimeout(warningTimerId);
        warningTimerId = null;
      }
      stopVolumeMeter();
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
    // textarea 自動高さ調整
    const autoResize = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    };
    input.addEventListener('input', autoResize);

    input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        // Enter のみ: リライト実行
        e.preventDefault();
        const instr = input.value.trim();
        if (instr) {
          runRewrite(editor, { promptId: 'oneshot', customInstruction: instr });
          input.value = '';
          autoResize();
        }
      } else if (e.key === 'Enter' && e.shiftKey) {
        // Shift+Enter: 改行 (デフォルト動作を許可、ただし高さ更新)
        setTimeout(autoResize, 0);
      } else if (e.key === 'ArrowDown' && !e.shiftKey && input.value === '') {
        // 空欄で ↓: プロンプト一覧
        e.preventDefault();
        if (globalPopup.style.display === 'block') hideGlobalPopup();
        else showGlobalPopup(promptBtn, editor, input, strip);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideGlobalPopup();
      }
    });

    strip._sairEditor = editor;
    renderQuickButtons(strip, editor);

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
      s = { original: snapshotEditor(editor), stack: [] };
      sessions.set(editor, s);
    }
    return s;
  }

  function doUndo(editor) {
    const s = sessions.get(editor);
    if (!s || s.stack.length === 0) return;
    const prev = s.stack.pop();
    applySnapshot(editor, prev.text, prev.embeds);
    if (s.stack.length === 0) sessions.delete(editor);
    updateAllStripHistory(editor);
    flashToast(editor, '↩ 直前に戻しました');
  }

  function doReset(editor) {
    const s = sessions.get(editor);
    if (!s) return;
    applySnapshot(editor, s.original.text, s.original.embeds);
    sessions.delete(editor);
    updateAllStripHistory(editor);
    flashToast(editor, '⟲ 原型に戻しました');
  }

  // ======== テキスト取得・置換 ========
  function getEditorText(el) {
    if (!el) return '';
    return el.innerText.replace(/\u00a0/g, ' ').replace(/\s+$/g, '');
  }

  // ======== メンション等の埋め込み要素の保持 ========
  // Slack のメンションは <ts-mention> などの埋め込み要素で、innerText では「@名前」の
  // ただの文字列になる。そのまま AI に渡して書き戻すと通知されない偽メンションになるため、
  // ⟦M1⟧ のトークンに置き換えて送り、戻ってきたら元の要素 (outerHTML) で復元する。
  const BLOCK_TAGS = new Set(['P', 'DIV', 'PRE', 'BLOCKQUOTE', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

  function isEmbedElement(node) {
    if (node.nodeType !== 1) return false;
    if (node.tagName === 'IMG') return false; // 絵文字は :code: のテキストで扱う
    return node.tagName.includes('-') || node.getAttribute('contenteditable') === 'false';
  }

  function countEmbeds(el) {
    return Array.from(el.querySelectorAll('*')).filter(isEmbedElement).length;
  }

  // 返り値: { text, embeds: [{ token, html, label }] }  (text 内に token を含む)
  function snapshotEditor(el) {
    if (!el) return { text: '', embeds: [] };
    // innerText は使わない: Quill は1行=1つの <p> で、<p> 間は innerText だと "\n\n" になり
    // 改行しただけの行の間に空行が入った状態で AI に渡ってしまう
    const embeds = [];
    const out = [];
    const endsWithNewline = () => out.length > 0 && out[out.length - 1].endsWith('\n');
    const walk = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === 3) {
          out.push(child.nodeValue.replace(/\u00a0/g, ' ').replace(/\uFEFF/g, ''));
        } else if (child.nodeType !== 1) {
          // コメント等は無視
        } else if (isEmbedElement(child)) {
          const token = `⟦M${embeds.length + 1}⟧`;
          embeds.push({ token, html: child.outerHTML, label: child.textContent || '' });
          out.push(token);
        } else if (child.tagName === 'BR') {
          // Quill の空行は <p><br></p>。末尾の <br> は改行として数えない
          if (child.nextSibling) out.push('\n');
        } else if (child.tagName === 'IMG') {
          out.push(child.getAttribute('data-stringify-text') || child.getAttribute('alt') || '');
        } else if (BLOCK_TAGS.has(child.tagName)) {
          if (out.length > 0 && !endsWithNewline()) out.push('\n');
          walk(child);
          out.push('\n');
        } else {
          walk(child);
        }
      });
    };
    walk(el);
    return { text: out.join('').replace(/\s+$/g, ''), embeds };
  }

  // snapshot (またはトークン入りの AI 出力) を入力欄に書き戻す
  // 戻り値 (Promise): 復元できなかった埋め込みの数
  async function applySnapshot(el, text, embeds) {
    if (!embeds || embeds.length === 0) {
      replaceEditorText(el, text);
      return 0;
    }
    const html = text
      .split('\n')
      .map((line) => {
        if (line === '') return '<p><br></p>';
        let h = escapeHtml(line);
        for (const e of embeds) h = h.split(e.token).join(e.html);
        return `<p>${h}</p>`;
      })
      .join('');
    let plain = text;
    let expected = 0;
    for (const e of embeds) {
      const n = plain.split(e.token).length - 1;
      expected += n;
      plain = plain.split(e.token).join(e.label);
    }
    replaceEditorText(el, plain, html);
    // Slack のペースト処理は非同期のことがあるので少し待ってから数える
    await new Promise((r) => setTimeout(r, 150));
    const missingFromAi = embeds.filter((e) => !text.includes(e.token)).length;
    const notRestored = Math.max(expected - countEmbeds(el), 0);
    return missingFromAi + notRestored;
  }

  function replaceEditorText(el, text, html) {
    if (!el) return;
    isReplacing = true;
    try {
      el.focus();
      // 全選択してから ClipboardEvent paste をシミュレート。
      // execCommand('insertText') はメンション等の embed ノードを含む選択に対して
      // Quill が削除だけ実行して挿入を取りこぼす問題がある。
      // Quill はペーストを専用クリップボードモジュールで処理するため、
      // この方法だと embed 含む選択でも正しく置換される。
      document.execCommand('selectAll');
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      // html があれば Slack 側でメンション要素として解釈される
      if (html) dt.setData('text/html', html);
      el.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        })
      );
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
      setTimeout(() => {
        isReplacing = false;
      }, 80);
    }
  }

  // Slack 入力欄の末尾にテキストを追記
  function appendToEditor(el, text) {
    if (!el || !text) return;
    isReplacing = true;
    try {
      el.focus();
      // キャレットを末尾に
      const sel = window.getSelection();
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); // 末尾
      sel.addRange(range);
      // 既存テキストが空でなければ改行で区切る
      const current = el.innerText.replace(/\s+$/g, '');
      const insert = current ? '\n' + text : text;
      const ok = document.execCommand('insertText', false, insert);
      if (!ok) {
        el.dispatchEvent(
          new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: insert,
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
    const snap = snapshotEditor(editor);
    const original = snap.text;
    if (!original) {
      flashToast(editor, '入力欄が空です', 'error');
      return;
    }
    busy = true;
    lastPromptInfo = { promptId, customInstruction };
    const session = getSession(editor);
    session.stack.push(snap);
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
      const lost = await applySnapshot(editor, res.result, snap.embeds);
      updateAllStripHistory(editor);
      if (lost > 0) {
        flashToast(
          editor,
          `⚠ メンション等 ${lost} 件を復元できませんでした。付け直してください`,
          'error',
          5000
        );
      } else {
        flashToast(editor, `✓ ${label}`, 'success');
      }
      // 続けて指示を出せるようストリップ入力欄にフォーカスを戻す
      setTimeout(() => {
        const composer = editor.closest('.c-wysiwyg_container');
        const inp = composer ? composer.querySelector('.sair-input') : null;
        if (inp) {
          try {
            inp.value = '';
            inp.style.height = 'auto';
            inp.focus();
          } catch {}
        }
      }, 120);
    } catch (err) {
      session.stack.pop();
      if (session.stack.length === 0 && session.original.text === original) sessions.delete(editor);
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
