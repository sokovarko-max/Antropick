'use strict';

/* ---------- Хранилище ---------- */

const STORE_SETTINGS = 'copilot.settings';
const STORE_SESSIONS = 'copilot.sessions';

const defaultSettings = {
  apiKey: '',
  model: CLAUDE_MODELS[0].id,
  lang: 'ru-RU',
  context: '',
  autoSuggest: true,
  autoIntervalMs: 3000,
  panelOpacity: 1,
};

function loadSettings() {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORE_SETTINGS) || '{}') }; }
  catch { return { ...defaultSettings }; }
}
function saveSettings(s) { localStorage.setItem(STORE_SETTINGS, JSON.stringify(s)); }

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORE_SESSIONS) || '[]'); }
  catch { return []; }
}
function saveSessions(list) { localStorage.setItem(STORE_SESSIONS, JSON.stringify(list)); }

/* ---------- Состояние ---------- */

const state = {
  settings: loadSettings(),
  listening: false,
  micState: 'stopped', // stopped | listening
  interimText: '',
  session: newSession(),
  lastAutoIndex: 0,
  silenceTimer: null,
  loadingKinds: new Set(),
  historyOpenId: null,
  panelCollapsed: false,
};

function newSession() {
  return { id: 'call-' + Date.now(), startedAt: Date.now(), transcript: [], suggestions: [] };
}

let speech = null;

/* ---------- Утилиты ---------- */

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Простая разметка ответа модели: маркированные списки и переносы строк
function renderRichText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const html = [];
  let inList = false;
  for (const line of lines) {
    const bullet = line.match(/^[-*•]\s+(.*)/);
    if (bullet) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`);
    } else {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) html.push('</ul>');
  return html.join('');
}
function toast(msg, kind = 'info') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 4000);
}

function transcriptWindowText(maxChars = 3000) {
  const full = state.session.transcript.map(t => t.text).join(' ');
  return full.length > maxChars ? full.slice(-maxChars) : full;
}
function transcriptSinceText(fromIndex, maxChars = 3000) {
  const slice = state.session.transcript.slice(fromIndex);
  const full = slice.map(t => t.text).join(' ');
  return full.length > maxChars ? full.slice(-maxChars) : full;
}

/* ---------- Запросы к Claude ---------- */

const QUICK_ACTIONS = {
  idea: { label: '💡 Идея', instruction: 'Предложи 2–4 конкретные идеи или варианта решения того, что сейчас обсуждается на созвоне.' },
  question: { label: '❓ Вопрос', instruction: 'Предложи 1–3 уточняющих вопроса, которые полезно задать по текущей теме обсуждения.' },
  summary: { label: '📝 Резюме', instruction: 'Кратко резюмируй последнюю часть обсуждения 3–5 пунктами.' },
  proscons: { label: '⚖️ За / Против', instruction: 'Перечисли ключевые плюсы и минусы варианта(ов), которые сейчас обсуждаются.' },
};

function buildSystemPrompt() {
  const ctx = state.settings.context.trim();
  return [
    'Ты — ИИ-ассистент, который помогает пользователю ВО ВРЕМЯ его собственного рабочего созвона или брейншторма.',
    'Ты не участник звонка, тебя не слышат другие люди — твои подсказки видит только пользователь на экране.',
    'Тебе присылают свежий фрагмент транскрипта разговора (автоматическое распознавание речи с микрофона, возможны ошибки распознавания и обрывки фраз).',
    ctx ? `Контекст встречи от пользователя: ${ctx}` : '',
    'Отвечай маркированным списком, коротко и по делу, без вступительных и заключительных фраз.',
    'Пиши на языке разговора (русский по умолчанию, английский — если обсуждение на английском).',
  ].filter(Boolean).join('\n');
}

async function requestSuggestion(kind, transcriptText) {
  const text = (transcriptText ?? transcriptWindowText()).trim();
  if (!text) { toast('Пока нет расшифровки разговора для анализа.', 'warn'); return; }
  if (state.loadingKinds.has(kind)) return;

  state.loadingKinds.add(kind);
  renderCall();

  const isAuto = kind === 'auto';
  const instruction = isAuto
    ? 'Обсуждение сделало паузу. Если сейчас уместна полезная подсказка — предложи 1–3 коротких пункта (идею, уточняющий вопрос или комментарий) по текущей теме. Если добавить нечего, ответь ровно одним словом: НЕТ.'
    : QUICK_ACTIONS[kind].instruction;

  const prompt = `Фрагмент транскрипта разговора:\n"""\n${text}\n"""\n\n${instruction}`;

  try {
    const answer = await askClaude({
      apiKey: state.settings.apiKey,
      model: state.settings.model,
      system: buildSystemPrompt(),
      prompt,
      maxTokens: 400,
    });
    if (isAuto && answer.trim().toUpperCase().startsWith('НЕТ')) return;
    if (!answer) return;
    state.session.suggestions.unshift({ t: Date.now(), kind, text: answer });
    persistCurrentSession();
  } catch (e) {
    if (!isAuto) toast(e.message || 'Ошибка запроса к Claude', 'error');
  } finally {
    state.loadingKinds.delete(kind);
    renderCall();
  }
}

/* ---------- Распознавание речи ---------- */

function ensureSpeechEngine() {
  if (speech) return speech;
  speech = new SpeechEngine({
    lang: state.settings.lang,
    onFinal: (text) => {
      if (!text) return;
      state.session.transcript.push({ t: Date.now(), text });
      state.interimText = '';
      persistCurrentSession();
      renderCall();
      scheduleAutoSuggest();
    },
    onInterim: (text) => { state.interimText = text; renderCall(); },
    onStateChange: (s) => { state.micState = s; renderCall(); },
    onError: (err) => {
      if (err === 'unsupported') {
        toast('Браузер не поддерживает распознавание речи. Попробуйте Chrome/Edge на компьютере или введите текст вручную.', 'error');
      } else if (err === 'not-allowed' || err === 'permission-denied') {
        toast('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.', 'error');
      } else {
        toast('Ошибка распознавания речи: ' + err, 'error');
      }
      state.listening = false;
      renderCall();
    },
  });
  return speech;
}

function scheduleAutoSuggest() {
  if (!state.settings.autoSuggest) return;
  clearTimeout(state.silenceTimer);
  state.silenceTimer = setTimeout(() => {
    const fresh = transcriptSinceText(state.lastAutoIndex);
    if (fresh.trim()) {
      state.lastAutoIndex = state.session.transcript.length;
      requestSuggestion('auto', transcriptWindowText());
    }
  }, state.settings.autoIntervalMs);
}

function toggleListening() {
  if (!state.settings.apiKey) { toast('Сначала укажите API-ключ Anthropic в «Настройках».', 'warn'); showPage('settings'); return; }
  const engine = ensureSpeechEngine();
  if (state.listening) {
    engine.stop();
    state.listening = false;
    clearTimeout(state.silenceTimer);
  } else {
    engine.start();
    state.listening = true;
  }
  renderCall();
}

/* ---------- Сессии/история ---------- */

function persistCurrentSession() {
  if (state.session.transcript.length === 0) return;
  const list = loadSessions();
  const idx = list.findIndex(s => s.id === state.session.id);
  const toSave = { ...state.session };
  if (idx >= 0) list[idx] = toSave; else list.unshift(toSave);
  saveSessions(list.slice(0, 50));
}

function startNewSession() {
  if (state.listening) { speech.stop(); state.listening = false; }
  clearTimeout(state.silenceTimer);
  state.session = newSession();
  state.lastAutoIndex = 0;
  state.interimText = '';
  renderCall();
}

function deleteSession(id) {
  saveSessions(loadSessions().filter(s => s.id !== id));
  renderHistory();
}

function exportSessionText(session) {
  const lines = [`Созвон — ${fmtDateTime(session.startedAt)}`, '', '== Транскрипт =='];
  for (const t of session.transcript) lines.push(`[${fmtTime(t.t)}] ${t.text}`);
  lines.push('', '== Подсказки ==');
  for (const s of session.suggestions) lines.push(`[${fmtTime(s.t)}] (${s.kind})\n${s.text}\n`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sozvon-${session.id}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Рендер: страница «Созвон» ---------- */

function renderCall() {
  const page = document.getElementById('page-call');
  const s = state.session;
  const micOn = state.listening;

  page.innerHTML = `
    <header class="topbar">
      <h1>Со-Пилот</h1>
      <div class="topbar-actions">
        <button class="btn-accent" id="btn-private-panel">
          ${isPrivatePanelOpen() ? 'Закрыть панель' : '🔒 Приватная панель'}
        </button>
        <button class="btn-ghost" id="btn-new-session" title="Новый созвон">Новый созвон</button>
      </div>
    </header>

    ${isPrivatePanelOpen() ? `
      <div class="panel-open-note">
        Подсказки идут в отдельное плавающее окно. Шарьте на созвоне вкладку
        встречи или конкретное окно — панель в трансляцию не попадёт.
      </div>` : ''}

    <div class="mic-panel">
      <button class="mic-btn ${micOn ? 'on' : ''}" id="btn-mic" aria-pressed="${micOn}">
        <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2z"/></svg>
      </button>
      <div class="mic-status">
        <span class="dot ${micOn ? 'pulse' : ''}"></span>
        ${micOn ? 'Слушаю микрофон…' : 'Остановлено — нажмите на микрофон'}
      </div>
      <label class="lang-select">
        <select id="sel-lang">
          <option value="ru-RU" ${state.settings.lang === 'ru-RU' ? 'selected' : ''}>Русский</option>
          <option value="en-US" ${state.settings.lang === 'en-US' ? 'selected' : ''}>English</option>
        </select>
      </label>
    </div>

    <div class="context-row">
      <input type="text" id="inp-context" placeholder="Контекст встречи (необязательно): о чём брейншторм?"
        value="${escapeHtml(state.settings.context)}">
    </div>

    <div class="quick-actions">
      ${Object.entries(QUICK_ACTIONS).map(([k, a]) => `
        <button class="chip" data-action="${k}" ${state.loadingKinds.has(k) ? 'disabled' : ''}>
          ${state.loadingKinds.has(k) ? '⏳' : a.label}
        </button>
      `).join('')}
      <label class="auto-toggle">
        <input type="checkbox" id="chk-auto" ${state.settings.autoSuggest ? 'checked' : ''}>
        Авто-подсказки
      </label>
    </div>

    <div class="split">
      <section class="panel transcript-panel">
        <h2>Транскрипт</h2>
        <div class="transcript-list" id="transcript-list">
          ${s.transcript.length === 0 ? '<p class="empty">Пока тишина. Начните говорить или разрешите доступ к микрофону.</p>' : ''}
          ${s.transcript.map(t => `<div class="line"><span class="ts">${fmtTime(t.t)}</span>${escapeHtml(t.text)}</div>`).join('')}
          ${state.interimText ? `<div class="line interim">${escapeHtml(state.interimText)}</div>` : ''}
        </div>
      </section>

      <section class="panel suggestions-panel">
        <h2>Подсказки Claude</h2>
        <div class="suggestions-list" id="suggestions-list">
          ${s.suggestions.length === 0 ? '<p class="empty">Здесь появятся идеи и подсказки — от кнопок выше или автоматически во время пауз.</p>' : ''}
          ${s.suggestions.map(sg => `
            <div class="suggestion-card kind-${sg.kind}">
              <div class="card-head">
                <span class="badge">${QUICK_ACTIONS[sg.kind]?.label || '🤖 Авто'}</span>
                <span class="ts">${fmtTime(sg.t)}</span>
              </div>
              <div class="card-body">${renderRichText(sg.text)}</div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;

  document.getElementById('btn-mic').onclick = toggleListening;
  document.getElementById('btn-private-panel').onclick = () => {
    if (isPrivatePanelOpen()) closePrivatePanel(); else openPrivatePanel();
  };
  document.getElementById('btn-new-session').onclick = () => {
    if (s.transcript.length && !confirm('Начать новый созвон? Текущий уже сохранён в истории.')) return;
    startNewSession();
  };
  document.getElementById('sel-lang').onchange = (e) => {
    state.settings.lang = e.target.value;
    saveSettings(state.settings);
    if (speech) speech.setLang(state.settings.lang);
  };
  document.getElementById('inp-context').oninput = debounce((e) => {
    state.settings.context = e.target.value;
    saveSettings(state.settings);
  }, 400);
  document.getElementById('chk-auto').onchange = (e) => {
    state.settings.autoSuggest = e.target.checked;
    saveSettings(state.settings);
  };
  page.querySelectorAll('.chip[data-action]').forEach(btn => {
    btn.onclick = () => requestSuggestion(btn.dataset.action);
  });

  const list = document.getElementById('transcript-list');
  list.scrollTop = list.scrollHeight;
  const sug = document.getElementById('suggestions-list');
  if (sug) sug.scrollTop = 0;

  // держим плавающую панель в актуальном состоянии
  if (isPrivatePanelOpen()) renderPrivatePanel();
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Рендер: страница «История» ---------- */

function renderHistory() {
  const page = document.getElementById('page-history');
  const sessions = loadSessions();
  const open = sessions.find(s => s.id === state.historyOpenId);

  if (open) {
    page.innerHTML = `
      <header class="topbar">
        <button class="btn-ghost" id="btn-back">← Назад</button>
        <h1>${fmtDateTime(open.startedAt)}</h1>
      </header>
      <div class="split">
        <section class="panel transcript-panel">
          <h2>Транскрипт</h2>
          <div class="transcript-list">
            ${open.transcript.map(t => `<div class="line"><span class="ts">${fmtTime(t.t)}</span>${escapeHtml(t.text)}</div>`).join('') || '<p class="empty">Пусто</p>'}
          </div>
        </section>
        <section class="panel suggestions-panel">
          <h2>Подсказки</h2>
          <div class="suggestions-list">
            ${open.suggestions.map(sg => `
              <div class="suggestion-card kind-${sg.kind}">
                <div class="card-head">
                  <span class="badge">${QUICK_ACTIONS[sg.kind]?.label || '🤖 Авто'}</span>
                  <span class="ts">${fmtTime(sg.t)}</span>
                </div>
                <div class="card-body">${renderRichText(sg.text)}</div>
              </div>
            `).join('') || '<p class="empty">Пусто</p>'}
          </div>
        </section>
      </div>
      <div class="history-actions">
        <button class="btn-ghost" id="btn-export">Экспорт в .txt</button>
        <button class="btn-danger" id="btn-delete">Удалить</button>
      </div>
    `;
    document.getElementById('btn-back').onclick = () => { state.historyOpenId = null; renderHistory(); };
    document.getElementById('btn-export').onclick = () => exportSessionText(open);
    document.getElementById('btn-delete').onclick = () => {
      if (confirm('Удалить этот созвон из истории?')) { deleteSession(open.id); state.historyOpenId = null; renderHistory(); }
    };
    return;
  }

  page.innerHTML = `
    <header class="topbar"><h1>История созвонов</h1></header>
    <div class="history-list">
      ${sessions.length === 0 ? '<p class="empty">Пока нет сохранённых созвонов.</p>' : ''}
      ${sessions.map(s => `
        <button class="history-item" data-id="${s.id}">
          <div class="hi-main">
            <strong>${fmtDateTime(s.startedAt)}</strong>
            <span>${s.transcript.length} реплик · ${s.suggestions.length} подсказок</span>
          </div>
          <span class="chev">›</span>
        </button>
      `).join('')}
    </div>
  `;
  page.querySelectorAll('.history-item').forEach(btn => {
    btn.onclick = () => { state.historyOpenId = btn.dataset.id; renderHistory(); };
  });
}

/* ---------- Рендер: страница «Настройки» ---------- */

function renderSettings() {
  const page = document.getElementById('page-settings');
  const s = state.settings;
  page.innerHTML = `
    <header class="topbar"><h1>Настройки</h1></header>
    <div class="settings-form">
      <label class="field">
        <span>API-ключ Anthropic</span>
        <input type="password" id="inp-key" placeholder="sk-ant-..." value="${escapeHtml(s.apiKey)}" autocomplete="off">
        <small>Хранится только в этом браузере (localStorage) и отправляется напрямую в api.anthropic.com. Получить ключ можно в
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.</small>
      </label>

      <label class="field">
        <span>Модель</span>
        <select id="sel-model">
          ${CLAUDE_MODELS.map(m => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </label>

      <label class="field">
        <span>Пауза до авто-подсказки</span>
        <select id="sel-interval">
          <option value="2000" ${s.autoIntervalMs === 2000 ? 'selected' : ''}>2 секунды</option>
          <option value="3000" ${s.autoIntervalMs === 3000 ? 'selected' : ''}>3 секунды</option>
          <option value="5000" ${s.autoIntervalMs === 5000 ? 'selected' : ''}>5 секунд</option>
          <option value="8000" ${s.autoIntervalMs === 8000 ? 'selected' : ''}>8 секунд</option>
        </select>
      </label>

      <div class="note">
        <p><strong>Как это работает.</strong> Приложение слушает микрофон вашего устройства (в том числе то, что доносится из динамиков — голоса собеседников), распознаёт речь прямо в браузере через Web Speech API и присылает свежий фрагмент транскрипта модели Claude. Подсказки видите только вы на экране — участники звонка ничего не получают.</p>
        <p><strong>Приватная панель.</strong> Кнопка «🔒 Приватная панель» на вкладке «Созвон» (или Ctrl+Shift+H) выносит подсказки в отдельное плавающее окно. Если вы шарите вкладку встречи или конкретное окно — панель в трансляцию не попадёт. При демонстрации всего экрана она будет видна: браузер не может исключить страницу из захвата экрана на уровне системы.</p>
        <p><strong>Приватность.</strong> Распознавание речи в Chrome/Edge выполняется через сервисы Google (так устроен Web Speech API в этих браузерах). Транскрипт и ваш API-ключ уходят напрямую в api.anthropic.com — ни на какой другой сервер данные не передаются.</p>
        <p><strong>Поддержка браузеров.</strong> Постоянное распознавание речи надёжно работает в Chrome/Edge на компьютере и Android. В Safari/iOS поддержка ограничена или отсутствует.</p>
      </div>
    </div>
  `;

  document.getElementById('inp-key').oninput = debounce((e) => {
    state.settings.apiKey = e.target.value.trim();
    saveSettings(state.settings);
  }, 300);
  document.getElementById('sel-model').onchange = (e) => {
    state.settings.model = e.target.value;
    saveSettings(state.settings);
  };
  document.getElementById('sel-interval').onchange = (e) => {
    state.settings.autoIntervalMs = Number(e.target.value);
    saveSettings(state.settings);
  };
}

/* ---------- Навигация ---------- */

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${name}`));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === name));
  if (name === 'call') renderCall();
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => showPage(tab.dataset.page));
});

/* ---------- Инициализация ---------- */

renderCall();

// Ctrl+Shift+H — открыть приватную панель / свернуть её содержимое
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h' || e.code === 'KeyH')) {
    e.preventDefault();
    if (isPrivatePanelOpen()) togglePanelCollapsed(); else openPrivatePanel();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

window.addEventListener('beforeunload', () => {
  if (state.session.transcript.length) persistCurrentSession();
});
