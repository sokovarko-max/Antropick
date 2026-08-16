'use strict';

/* Приватная панель — компактное плавающее окно с подсказками.
 *
 * Задача: подсказки не должны попадать в демонстрацию экрана. Когда вы шарите
 * на созвоне вкладку браузера или конкретное окно приложения, эта панель живёт
 * в отдельном маленьком окне поверх остальных и в трансляцию не входит.
 *
 * Используется Document Picture-in-Picture API (Chrome/Edge 116+): он создаёт
 * настоящее always-on-top окно. Если API недоступен — откатываемся на обычный
 * popup через window.open(). Это privacy-фича уровня «не показывать свои
 * заметки», а не обход захвата экрана: полноэкранный шаринг всего десктопа
 * панель всё равно увидит, веб-страница не может исключить себя из записи.
 */

const privatePanel = {
  win: null,        // окно PiP или popup
  root: null,       // корневой элемент панели внутри этого окна
  usingPopup: false,
};

function isDocumentPiPSupported() {
  return 'documentPictureInPicture' in window;
}

function isPrivatePanelOpen() {
  return !!(privatePanel.win && !privatePanel.win.closed);
}

/* Переносим стили в новое окно: у PiP-документа своя таблица стилей. */
function copyStylesTo(targetDoc) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
      const style = targetDoc.createElement('style');
      style.textContent = css;
      targetDoc.head.appendChild(style);
    } catch {
      // Кросс-доменную таблицу прочитать нельзя — подключаем ссылкой
      if (sheet.href) {
        const link = targetDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        targetDoc.head.appendChild(link);
      }
    }
  }
}

async function openPrivatePanel() {
  if (isPrivatePanelOpen()) { privatePanel.win.focus(); return; }

  const width = 380, height = 520;

  try {
    if (isDocumentPiPSupported()) {
      privatePanel.win = await window.documentPictureInPicture.requestWindow({ width, height });
      privatePanel.usingPopup = false;
    } else {
      privatePanel.win = window.open('', 'copilot-private-panel',
        `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`);
      if (!privatePanel.win) {
        toast('Браузер заблокировал всплывающее окно. Разрешите popup для этого сайта.', 'error');
        return;
      }
      privatePanel.usingPopup = true;
    }
  } catch (e) {
    toast('Не удалось открыть приватную панель: ' + (e.message || e), 'error');
    return;
  }

  const doc = privatePanel.win.document;
  doc.body.innerHTML = '';
  doc.documentElement.lang = 'ru';
  if (privatePanel.usingPopup) doc.title = 'Со-Пилот';
  copyStylesTo(doc);
  doc.body.classList.add('pip-body');

  const root = doc.createElement('div');
  root.className = 'pip-root';
  doc.body.appendChild(root);
  privatePanel.root = root;

  applyPanelOpacity();

  // Ctrl+Shift+H внутри панели — свернуть/развернуть содержимое
  doc.addEventListener('keydown', handlePanelHotkey);

  privatePanel.win.addEventListener('pagehide', () => {
    privatePanel.win = null;
    privatePanel.root = null;
    renderCall();
  });

  renderPrivatePanel();
  renderCall();
}

function closePrivatePanel() {
  if (!isPrivatePanelOpen()) return;
  privatePanel.win.close();
  privatePanel.win = null;
  privatePanel.root = null;
  renderCall();
}

function applyPanelOpacity() {
  if (!privatePanel.root) return;
  privatePanel.root.style.opacity = String(state.settings.panelOpacity ?? 1);
}

function handlePanelHotkey(e) {
  if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h' || e.code === 'KeyH')) {
    e.preventDefault();
    togglePanelCollapsed();
  }
}

function togglePanelCollapsed() {
  state.panelCollapsed = !state.panelCollapsed;
  renderPrivatePanel();
}

/* Компактный рендер. Вынесен отдельно от renderCall(), чтобы панель
   оставалась маленькой: только статус, действия и сами подсказки. */
function renderPrivatePanel() {
  if (!privatePanel.root) return;
  const doc = privatePanel.root.ownerDocument;
  const s = state.session;
  const micOn = state.listening;

  if (state.panelCollapsed) {
    privatePanel.root.innerHTML = `
      <div class="pip-collapsed">
        <button class="pip-mic ${micOn ? 'on' : ''}" data-act="mic" title="Микрофон">
          <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2z"/></svg>
        </button>
        <button class="pip-expand" data-act="collapse">Показать подсказки</button>
      </div>
    `;
  } else {
    privatePanel.root.innerHTML = `
      <div class="pip-head">
        <button class="pip-mic ${micOn ? 'on' : ''}" data-act="mic" title="Микрофон">
          <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2z"/></svg>
        </button>
        <span class="pip-status"><span class="dot ${micOn ? 'pulse' : ''}"></span>${micOn ? 'Слушаю' : 'Пауза'}</span>
        <button class="pip-collapse" data-act="collapse" title="Свернуть (Ctrl+Shift+H)">－</button>
      </div>

      <div class="pip-actions">
        ${Object.entries(QUICK_ACTIONS).map(([k, a]) => `
          <button class="pip-chip" data-act="ask" data-kind="${k}" ${state.loadingKinds.has(k) ? 'disabled' : ''}>
            ${state.loadingKinds.has(k) ? '⏳' : a.label}
          </button>
        `).join('')}
      </div>

      <div class="pip-suggestions">
        ${s.suggestions.length === 0 ? '<p class="empty">Подсказки появятся здесь.</p>' : ''}
        ${s.suggestions.slice(0, 12).map(sg => `
          <div class="suggestion-card kind-${sg.kind}">
            <div class="card-head">
              <span class="badge">${QUICK_ACTIONS[sg.kind]?.label || '🤖 Авто'}</span>
              <span class="ts">${fmtTime(sg.t)}</span>
            </div>
            <div class="card-body">${renderRichText(sg.text)}</div>
          </div>
        `).join('')}
      </div>

      <div class="pip-foot">
        <label>Прозрачность
          <input type="range" min="0.35" max="1" step="0.05"
            value="${state.settings.panelOpacity ?? 1}" data-act="opacity">
        </label>
      </div>
    `;
  }

  privatePanel.root.querySelectorAll('[data-act]').forEach(el => {
    const act = el.dataset.act;
    if (act === 'mic') el.onclick = toggleListening;
    if (act === 'collapse') el.onclick = togglePanelCollapsed;
    if (act === 'ask') el.onclick = () => requestSuggestion(el.dataset.kind);
    if (act === 'opacity') el.oninput = (e) => {
      state.settings.panelOpacity = Number(e.target.value);
      saveSettings(state.settings);
      applyPanelOpacity();
    };
  });

  // прокручиваем к свежей подсказке
  const list = privatePanel.root.querySelector('.pip-suggestions');
  if (list) list.scrollTop = 0;
  void doc;
}
