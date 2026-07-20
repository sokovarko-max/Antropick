/* ===== Мой Зал — дневник тренировок ===== */
'use strict';

/* ---------- Хранилище ---------- */

const STORAGE_KEY = 'moyzal-v1';

const SEED_EXERCISES = [
  // Грудь
  ['Жим штанги лёжа', 'Грудь'], ['Жим гантелей лёжа', 'Грудь'],
  ['Жим на наклонной скамье', 'Грудь'], ['Разводка гантелей', 'Грудь'],
  ['Сведение в кроссовере', 'Грудь'], ['Отжимания на брусьях', 'Грудь'],
  ['Отжимания от пола', 'Грудь'],
  // Спина
  ['Подтягивания', 'Спина'], ['Тяга верхнего блока', 'Спина'],
  ['Тяга штанги в наклоне', 'Спина'], ['Тяга гантели в наклоне', 'Спина'],
  ['Тяга горизонтального блока', 'Спина'], ['Становая тяга', 'Спина'],
  ['Гиперэкстензия', 'Спина'], ['Шраги с гантелями', 'Спина'],
  // Ноги
  ['Приседания со штангой', 'Ноги'], ['Жим ногами', 'Ноги'],
  ['Выпады с гантелями', 'Ноги'], ['Румынская тяга', 'Ноги'],
  ['Разгибание ног в тренажёре', 'Ноги'], ['Сгибание ног в тренажёре', 'Ноги'],
  ['Подъём на носки', 'Ноги'], ['Ягодичный мост', 'Ноги'],
  // Плечи
  ['Жим штанги стоя', 'Плечи'], ['Жим гантелей сидя', 'Плечи'],
  ['Махи гантелями в стороны', 'Плечи'], ['Махи в наклоне', 'Плечи'],
  ['Тяга штанги к подбородку', 'Плечи'], ['Жим Арнольда', 'Плечи'],
  // Бицепс
  ['Подъём штанги на бицепс', 'Бицепс'], ['Подъём гантелей на бицепс', 'Бицепс'],
  ['Молотки', 'Бицепс'], ['Подъём на скамье Скотта', 'Бицепс'],
  // Трицепс
  ['Французский жим', 'Трицепс'], ['Разгибание на блоке', 'Трицепс'],
  ['Жим узким хватом', 'Трицепс'], ['Разгибание из-за головы', 'Трицепс'],
  // Пресс
  ['Скручивания', 'Пресс'], ['Подъём ног в висе', 'Пресс'],
  ['Планка (секунды)', 'Пресс'], ['Велосипед', 'Пресс'],
  // Кардио
  ['Беговая дорожка (мин)', 'Кардио'], ['Велотренажёр (мин)', 'Кардио'],
  ['Эллипс (мин)', 'Кардио'], ['Скакалка (мин)', 'Кардио'],
];

const GROUP_ORDER = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Бицепс', 'Трицепс', 'Пресс', 'Кардио', 'Другое'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultState() {
  return {
    exercises: SEED_EXERCISES.map(([name, group]) => ({ id: uid() + name.length, name, group, custom: false })),
    workouts: [],   // {id, date, start, end, entries:[{exId, sets:[{w, r, done}]}]}
    active: null,   // текущая тренировка
    weights: [],    // {date, kg}
    programs: [],   // свои программы: {id, name, days:[{name, items:[[exName, sets, reps]]}]}
    watch: [],      // тренировки с Apple Watch: {id, date, type, min, kcal}
    settings: {
      restSec: 90,
      ai: { provider: 'openrouter', key: '', model: '' }, // ключ пользователя, хранится только на телефоне
    },
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.exercises)) {
        const st = Object.assign(defaultState(), s);
        st.settings = Object.assign(defaultState().settings, st.settings);
        if (!st.settings.ai) st.settings.ai = { provider: 'openrouter', key: '', model: '' };
        return st;
      }
    }
  } catch (e) { /* повреждённые данные — начинаем заново */ }
  return defaultState();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Утилиты ---------- */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function exById(id) {
  return state.exercises.find(e => e.id === id);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
}

function fmtShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' мин';
  return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
}

function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// Тоннаж тренировки (кг)
function tonnage(w) {
  let t = 0;
  for (const en of w.entries) for (const s of en.sets) {
    if (s.done && s.w > 0 && s.r > 0) t += s.w * s.r;
  }
  return Math.round(t);
}

function setCount(w) {
  let n = 0;
  for (const en of w.entries) n += en.sets.filter(s => s.done).length;
  return n;
}

// Лучший вес упражнения в тренировке
function bestWeight(w, exId) {
  let best = 0;
  for (const en of w.entries) {
    if (en.exId !== exId) continue;
    for (const s of en.sets) if (s.done && s.w > best) best = s.w;
  }
  return best;
}

// Расчётный 1ПМ по Эпли
function est1rm(w, r) {
  if (!w || !r) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

// Лучший расчётный 1ПМ упражнения в тренировке
function best1rm(w, exId) {
  let best = 0;
  for (const en of w.entries) {
    if (en.exId !== exId) continue;
    for (const s of en.sets) if (s.done) best = Math.max(best, est1rm(s.w, s.r));
  }
  return best;
}

// Объём (тоннаж) упражнения в тренировке
function exVolume(w, exId) {
  let v = 0;
  for (const en of w.entries) {
    if (en.exId !== exId) continue;
    for (const s of en.sets) if (s.done) v += s.w * s.r;
  }
  return v;
}

// Рекорды за всё время по упражнению: лучший вес и лучший расчётный 1ПМ
function bestEver(exId) {
  let w = 0, orm = 0;
  for (const wo of state.workouts) {
    w = Math.max(w, bestWeight(wo, exId));
    orm = Math.max(orm, best1rm(wo, exId));
  }
  return { w, orm };
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch (e) { /* звук недоступен */ }
}

/* Экран не гаснет во время активной тренировки */
let wakeLock = null;

async function requestWakeLock() {
  try {
    if (!wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* не поддерживается или отклонено — не критично */ }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.active) requestWakeLock();
});

/* ---------- Навигация ---------- */

const PAGES = ['workout', 'programs', 'history', 'progress', 'more'];
let currentPage = 'workout';

$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => showPage(tab.dataset.page));
});

function showPage(name) {
  currentPage = name;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === name));
  PAGES.forEach(p => $('#page-' + p).classList.toggle('active', p === name));
  render();
}

function render() {
  if (currentPage === 'workout') renderWorkout();
  if (currentPage === 'programs') renderPrograms();
  if (currentPage === 'history') renderHistory();
  if (currentPage === 'progress') renderProgress();
  if (currentPage === 'more') renderMore();
}

/* Ссылка на видеоинструкцию: поиск техники упражнения на YouTube */
function videoUrl(name) {
  const clean = name.replace(/\s*\(.+?\)\s*/g, ' ').trim();
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(clean + ' техника выполнения');
}

/* ---------- Модальные окна ---------- */

function openModal(html) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-overlay"><div class="modal">${html}</div></div>`;
  $('.modal-overlay', root).addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeModal();
  });
  return $('.modal', root);
}

function closeModal() {
  $('#modal-root').innerHTML = '';
}

/* ---------- Экран «Тренировка» ---------- */

let clockInterval = null;

function renderWorkout() {
  const page = $('#page-workout');
  clearInterval(clockInterval);

  if (state.active) requestWakeLock(); else releaseWakeLock();

  if (!state.active) {
    const last = state.workouts[0];
    page.innerHTML = `
      <h1>Тренировка</h1>
      <button class="btn" id="start-workout">Начать тренировку</button>
      ${last ? `
        <h2>Прошлая тренировка</h2>
        <div class="card">
          <div class="hist-date">${esc(fmtDate(last.date))}</div>
          <div class="hist-meta">
            <span>⏱ ${fmtDuration(last.end - last.start)}</span>
            <span>🏋️ ${tonnage(last).toLocaleString('ru-RU')} кг</span>
            <span>✅ ${setCount(last)} подходов</span>
          </div>
          <div class="hist-detail">${workoutDetailHtml(last)}</div>
        </div>` : `
        <div class="empty-state">
          <div class="big">💪</div>
          <p>Начни первую тренировку —<br>все результаты сохранятся на телефоне.</p>
        </div>`}
    `;
    $('#start-workout').addEventListener('click', startWorkout);
    return;
  }

  // Активная тренировка
  const a = state.active;
  page.innerHTML = `
    <div class="workout-head">
      <h1 style="margin:0">Тренировка</h1>
      <span class="workout-clock" id="workout-clock">0:00</span>
    </div>
    <div id="active-list"></div>
    <button class="btn secondary" id="add-ex" style="margin-bottom:10px">+ Добавить упражнение</button>
    <input type="text" id="workout-note" placeholder="Заметка к тренировке (самочувствие, зал…)"
           value="${esc(a.note || '')}" style="text-align:left;font-weight:400;margin-bottom:10px">
    <button class="btn good" id="finish">Завершить тренировку</button>
    <button class="btn danger-outline" id="cancel" style="margin-top:10px">Отменить</button>
  `;

  const tick = () => {
    const el = $('#workout-clock');
    if (el) el.textContent = fmtClock(Date.now() - a.start);
  };
  tick();
  clockInterval = setInterval(tick, 1000);

  const list = $('#active-list');
  a.entries.forEach((en, i) => list.appendChild(entryCard(en, i)));

  $('#add-ex').addEventListener('click', () => openExercisePicker(addExerciseToActive));
  $('#workout-note').addEventListener('input', e => { a.note = e.target.value; save(); });
  $('#finish').addEventListener('click', finishWorkout);
  $('#cancel').addEventListener('click', () => {
    if (confirm('Отменить тренировку? Данные не сохранятся.')) {
      state.active = null;
      save();
      renderWorkout();
    }
  });
}

function startWorkout() {
  state.active = { start: Date.now(), entries: [] };
  save();
  renderWorkout();
  openExercisePicker(addExerciseToActive);
}

function addExerciseToActive(exId) {
  const prev = lastSetsFor(exId);
  const sets = prev.length
    ? prev.map(s => ({ w: s.w, r: s.r, done: false }))
    : [{ w: 0, r: 0, done: false }, { w: 0, r: 0, done: false }, { w: 0, r: 0, done: false }];
  state.active.entries.push({ exId, sets });
  save();
  renderWorkout();
}

// Подходы этого упражнения в последней тренировке, где оно было
function lastSetsFor(exId) {
  for (const w of state.workouts) {
    for (const en of w.entries) {
      if (en.exId === exId) {
        const done = en.sets.filter(s => s.done);
        if (done.length) return done;
      }
    }
  }
  return [];
}

function entryCard(entry, idx) {
  const ex = exById(entry.exId);
  const card = document.createElement('div');
  card.className = 'card ex-card';

  const prev = lastSetsFor(entry.exId);
  const prevStr = prev.length
    ? 'Прошлый раз: ' + prev.map(s => `${s.w}×${s.r}`).join(', ')
    : 'Первое выполнение';
  const targetStr = entry.target ? `Цель: ${entry.target} · ` : '';

  card.innerHTML = `
    <div class="ex-title">
      <span>${esc(ex ? ex.name : '?')}</span>
      <span style="white-space:nowrap">
        <button class="icon-btn" data-video title="Видео техники">▶</button>
        <button class="icon-btn" data-del>✕</button>
      </span>
    </div>
    <div class="ex-prev">${esc(targetStr + prevStr)}</div>
    <div class="set-head"><span>#</span><span>Вес, кг</span><span>Повторы</span><span></span></div>
    ${entry.sets.map((s, i) => `
      <div class="set-row" data-set="${i}">
        <span class="set-num">${i + 1}</span>
        <input type="number" inputmode="decimal" step="0.5" min="0" value="${s.w || ''}" placeholder="0" data-w>
        <input type="number" inputmode="numeric" min="0" value="${s.r || ''}" placeholder="0" data-r>
        <button class="set-check ${s.done ? 'done' : ''}" data-check>✓</button>
      </div>`).join('')}
    <div class="row-btns">
      <button class="btn-chip" data-add-set>+ Подход</button>
      <button class="btn-chip" data-rm-set>− Подход</button>
    </div>
  `;

  card.querySelector('[data-video]').addEventListener('click', () => {
    if (ex) window.open(videoUrl(ex.name), '_blank');
  });

  card.querySelector('[data-del]').addEventListener('click', () => {
    if (confirm('Убрать упражнение из тренировки?')) {
      state.active.entries.splice(idx, 1);
      save();
      renderWorkout();
    }
  });

  card.querySelector('[data-add-set]').addEventListener('click', () => {
    const lastSet = entry.sets[entry.sets.length - 1];
    entry.sets.push({ w: lastSet ? lastSet.w : 0, r: lastSet ? lastSet.r : 0, done: false });
    save();
    renderWorkout();
  });

  card.querySelector('[data-rm-set]').addEventListener('click', () => {
    if (entry.sets.length > 1) {
      entry.sets.pop();
      save();
      renderWorkout();
    }
  });

  $$('.set-row', card).forEach(row => {
    const i = +row.dataset.set;
    const set = entry.sets[i];
    row.querySelector('[data-w]').addEventListener('input', e => {
      set.w = parseFloat(e.target.value) || 0;
      save();
    });
    row.querySelector('[data-r]').addEventListener('input', e => {
      set.r = parseInt(e.target.value, 10) || 0;
      save();
    });
    row.querySelector('[data-check]').addEventListener('click', e => {
      set.done = !set.done;
      e.target.classList.toggle('done', set.done);
      save();
      if (set.done) startRestTimer();
    });
  });

  return card;
}

function finishWorkout() {
  const a = state.active;
  const hasWork = a.entries.some(en => en.sets.some(s => s.done));
  if (!hasWork && !confirm('Нет выполненных подходов. Всё равно завершить?')) return;

  // отбрасываем пустые упражнения и невыполненные нулевые подходы
  const entries = a.entries
    .map(en => ({ exId: en.exId, sets: en.sets.filter(s => s.done || s.w > 0 || s.r > 0) }))
    .filter(en => en.sets.length > 0);

  // личные рекорды: сравниваем с лучшими результатами до этой тренировки
  const prevBests = new Map();
  for (const en of entries) {
    if (!prevBests.has(en.exId)) prevBests.set(en.exId, bestEver(en.exId));
  }

  const workout = {
    id: uid(),
    date: new Date().toISOString(),
    start: a.start,
    end: Date.now(),
    entries,
    note: (a.note || '').trim(),
  };
  state.workouts.unshift(workout);

  const prs = [];
  for (const [exId, prev] of prevBests) {
    const w = bestWeight(workout, exId);
    if (w > prev.w && prev.w > 0) {
      const ex = exById(exId);
      prs.push(`${ex ? ex.name : ''} — ${w} кг`);
    }
  }

  state.active = null;
  stopRestTimer();
  save();
  if (prs.length) {
    toast(`🏆 Новый рекорд! ${prs.join(' · ')}`);
  } else {
    toast('Тренировка сохранена 💪');
  }
  renderWorkout();
}

/* ---------- Таймер отдыха ---------- */

/* Таймер считает от абсолютного времени: не сбивается, если iOS
   приостановила страницу в фоне — при возврате сразу сработает. */
let restEndAt = 0;
let restInterval = null;

function startRestTimer() {
  restEndAt = Date.now() + state.settings.restSec * 1000;
  $('#rest-timer').classList.remove('hidden');
  updateRestUI();
  clearInterval(restInterval);
  restInterval = setInterval(tickRest, 500);
}

function tickRest() {
  if (Date.now() >= restEndAt) { finishRest(); return; }
  updateRestUI();
}

function finishRest() {
  stopRestTimer();
  beep();
  vibrate([200, 100, 200]);
  toast('Отдых окончен — следующий подход!');
  notifyRestDone();
}

function stopRestTimer() {
  clearInterval(restInterval);
  restInterval = null;
  $('#rest-timer').classList.add('hidden');
}

function updateRestUI() {
  const left = Math.max(0, Math.round((restEndAt - Date.now()) / 1000));
  const m = Math.floor(left / 60), s = left % 60;
  $('#rest-time').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

$('#rest-plus').addEventListener('click', () => {
  restEndAt += 15000;
  updateRestUI();
});
$('#rest-skip').addEventListener('click', stopRestTimer);

/* Системное уведомление об окончании отдыха. На заблокированном iPhone
   iOS сама дублирует его на Apple Watch. Требует установленного PWA
   (значок на экране «Домой») и разрешения на уведомления. */
async function notifyRestDone() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Отдых окончен 💪', {
      body: 'Пора делать следующий подход!',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'rest-done',
      vibrate: [200, 100, 200],
    });
  } catch (e) { /* уведомления недоступны — звук и баннер уже сработали */ }
}

/* ---------- Выбор упражнения ---------- */

function openExercisePicker(onPick) {
  const modal = openModal(`
    <div class="modal-head">
      <h2>Выбери упражнение</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="search-row">
      <input type="text" placeholder="Поиск…" data-search>
      <button class="btn-chip accent" data-new>+ Новое</button>
    </div>
    <div class="modal-body" data-list></div>
  `);

  const listEl = $('[data-list]', modal);
  const searchEl = $('[data-search]', modal);

  function draw(filter = '') {
    const f = filter.trim().toLowerCase();
    const groups = new Map();
    for (const ex of state.exercises) {
      if (f && !ex.name.toLowerCase().includes(f)) continue;
      if (!groups.has(ex.group)) groups.set(ex.group, []);
      groups.get(ex.group).push(ex);
    }
    let html = '';
    for (const g of GROUP_ORDER) {
      if (!groups.has(g)) continue;
      html += `<div class="group-title">${esc(g)}</div>`;
      html += groups.get(g)
        .map(ex => `<div class="ex-item" data-id="${ex.id}"><span>${esc(ex.name)}</span><button class="icon-btn" data-video title="Видео техники">▶</button></div>`)
        .join('');
    }
    listEl.innerHTML = html || '<div class="empty-state">Ничего не найдено</div>';
    $$('.ex-item', listEl).forEach(item => {
      item.addEventListener('click', e => {
        const ex = exById(item.dataset.id);
        if (e.target.closest('[data-video]')) {
          if (ex) window.open(videoUrl(ex.name), '_blank');
          return;
        }
        closeModal();
        onPick(item.dataset.id);
      });
    });
  }

  draw();
  searchEl.addEventListener('input', () => draw(searchEl.value));
  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-new]', modal).addEventListener('click', () => openNewExercise(onPick));
}

function openNewExercise(onPick) {
  const modal = openModal(`
    <div class="modal-head">
      <h2>Новое упражнение</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="form-row">
      <label>Название</label>
      <input type="text" data-name placeholder="Например: Жим в хаммере">
    </div>
    <div class="form-row">
      <label>Группа мышц</label>
      <select data-group>
        ${GROUP_ORDER.map(g => `<option>${esc(g)}</option>`).join('')}
      </select>
    </div>
    <button class="btn" data-save>Сохранить</button>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-save]', modal).addEventListener('click', () => {
    const name = $('[data-name]', modal).value.trim();
    if (!name) { toast('Введи название'); return; }
    const ex = { id: uid(), name, group: $('[data-group]', modal).value, custom: true };
    state.exercises.push(ex);
    save();
    closeModal();
    toast('Упражнение добавлено');
    if (onPick) onPick(ex.id); else render();
  });
}

/* ---------- Экран «История» ---------- */

const expanded = new Set();

function renderHistory() {
  const page = $('#page-history');
  if (!state.workouts.length && !state.watch.length) {
    page.innerHTML = `<h1>История</h1>
      <div class="empty-state"><div class="big">📖</div><p>Здесь появятся твои тренировки.</p></div>`;
    return;
  }

  // объединяем тренировки в зале и тренировки с Apple Watch
  const items = [
    ...state.workouts.map(w => ({ kind: 'gym', date: w.date, w })),
    ...state.watch.map(w => ({ kind: 'watch', date: w.date, w })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  page.innerHTML = `<h1>История</h1>` + items.map(it => it.kind === 'watch' ? `
    <div class="card hist-card" data-watch="${it.w.id}">
      <div class="hist-date">⌚ ${esc(it.w.type)}</div>
      <div class="hist-meta" style="flex-wrap:wrap">
        <span>${esc(fmtDate(it.w.date))}</span>
        ${it.w.min ? `<span>⏱ ${it.w.min} мин</span>` : ''}
        ${it.w.kcal ? `<span>🔥 ${it.w.kcal} ккал</span>` : ''}
        ${it.w.hr ? `<span>❤️ ${it.w.hr}${it.w.hrMax ? '–' + it.w.hrMax : ''}</span>` : ''}
        ${it.w.km ? `<span>📏 ${it.w.km} км</span>` : ''}
      </div>
    </div>` : `
    <div class="card hist-card" data-id="${it.w.id}">
      <div class="hist-date">${esc(fmtDate(it.w.date))}</div>
      <div class="hist-meta">
        <span>⏱ ${fmtDuration(it.w.end - it.w.start)}</span>
        <span>🏋️ ${tonnage(it.w).toLocaleString('ru-RU')} кг</span>
        <span>✅ ${setCount(it.w)} подходов</span>
      </div>
      ${expanded.has(it.w.id) ? `
        <div class="hist-detail">
          ${it.w.note ? `<div class="sub" style="margin-bottom:8px">📝 ${esc(it.w.note)}</div>` : ''}
          ${workoutDetailHtml(it.w)}
          <div class="settings-row" style="margin-top:8px">
            <button class="btn secondary" data-repeat style="padding:10px;font-size:14px">Повторить</button>
            <button class="btn danger-outline" data-del style="padding:10px;font-size:14px">Удалить</button>
          </div>
        </div>` : ''}
    </div>`).join('');

  $$('.hist-card[data-watch]', page).forEach(card => {
    card.addEventListener('click', () => {
      if (confirm('Удалить эту тренировку с часов из истории?')) {
        state.watch = state.watch.filter(w => w.id !== card.dataset.watch);
        save();
        renderHistory();
      }
    });
  });

  $$('.hist-card[data-id]', page).forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', e => {
      if (e.target.closest('[data-del]')) {
        if (confirm('Удалить тренировку из истории?')) {
          state.workouts = state.workouts.filter(w => w.id !== id);
          expanded.delete(id);
          save();
          renderHistory();
        }
        return;
      }
      if (e.target.closest('[data-repeat]')) {
        const w = state.workouts.find(x => x.id === id);
        if (!w) return;
        if (state.active && !confirm('Уже идёт тренировка. Начать новую вместо неё?')) return;
        state.active = {
          start: Date.now(),
          entries: w.entries.map(en => ({
            exId: en.exId,
            sets: en.sets.map(s => ({ w: s.w, r: s.r, done: false })),
          })),
        };
        save();
        showPage('workout');
        toast('Прошлая тренировка загружена');
        return;
      }
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      renderHistory();
    });
  });
}

function workoutDetailHtml(w) {
  return w.entries.map(en => {
    const ex = exById(en.exId);
    const sets = en.sets.filter(s => s.done).map(s => `${s.w}×${s.r}`).join(', ');
    return `<div class="hist-ex"><b>${esc(ex ? ex.name : 'Упражнение')}</b><span>${esc(sets || '—')}</span></div>`;
  }).join('');
}

/* ---------- Библиотека упражнений (модальное окно) ---------- */

function openExerciseLibrary() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>Упражнения</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="search-row">
      <input type="text" placeholder="Поиск…" data-search>
      <button class="btn-chip accent" data-new>+ Новое</button>
    </div>
    <div class="modal-body" data-list></div>
  `);

  const listEl = $('[data-list]', modal);
  const searchEl = $('[data-search]', modal);

  function draw(filter = '') {
    const f = filter.trim().toLowerCase();
    const groups = new Map();
    for (const ex of state.exercises) {
      if (f && !ex.name.toLowerCase().includes(f)) continue;
      if (!groups.has(ex.group)) groups.set(ex.group, []);
      groups.get(ex.group).push(ex);
    }
    let html = '';
    for (const g of GROUP_ORDER) {
      if (!groups.has(g)) continue;
      html += `<div class="group-title">${esc(g)}</div>`;
      html += groups.get(g).map(ex => {
        const n = state.workouts.filter(w => w.entries.some(en => en.exId === ex.id)).length;
        return `<div class="ex-item" data-id="${ex.id}">
          <span>${esc(ex.name)}<span class="sub">${n ? ' · ' + n + ' трен.' : ''}</span></span>
          <span style="white-space:nowrap">
            <button class="icon-btn" data-video title="Видео техники">▶</button>
            ${ex.custom ? '<button class="icon-btn" data-del>🗑</button>' : ''}
          </span>
        </div>`;
      }).join('');
    }
    listEl.innerHTML = html || '<div class="empty-state">Ничего не найдено</div>';

    $$('.ex-item', listEl).forEach(item => {
      item.addEventListener('click', e => {
        const ex = exById(item.dataset.id);
        if (!ex) return;
        if (e.target.closest('[data-video]')) {
          window.open(videoUrl(ex.name), '_blank');
          return;
        }
        if (e.target.closest('[data-del]')) {
          if (confirm(`Удалить «${ex.name}»?`)) {
            state.exercises = state.exercises.filter(x => x.id !== ex.id);
            save();
            draw(searchEl.value);
          }
          return;
        }
        // переход к графику прогресса по упражнению
        const used = state.workouts.some(w => w.entries.some(en => en.exId === ex.id));
        if (used) {
          closeModal();
          progressExId = ex.id;
          showPage('progress');
        } else {
          window.open(videoUrl(ex.name), '_blank');
        }
      });
    });
  }

  draw();
  searchEl.addEventListener('input', () => draw(searchEl.value));
  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-new]', modal).addEventListener('click', () => openNewExercise(() => openExerciseLibrary()));
}

/* ---------- Экран «Прогресс» ---------- */

let progressExId = null;
let progressMetric = 'w'; // 'w' — вес, 'orm' — расч. 1ПМ, 'vol' — объём

// Понедельник недели, к которой относится дата
function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// Сколько недель подряд (включая текущую) была хотя бы одна тренировка
function weekStreak() {
  const weeks = new Set(state.workouts.map(w => weekStart(new Date(w.date)).getTime()));
  if (!weeks.size) return 0;
  let cursor = weekStart(new Date()).getTime();
  const WEEK = 7 * 24 * 3600 * 1000;
  if (!weeks.has(cursor)) cursor -= WEEK; // текущая неделя ещё может быть впереди
  let n = 0;
  while (weeks.has(cursor)) { n++; cursor -= WEEK; }
  return n;
}

function renderProgress() {
  const page = $('#page-progress');

  // Статистика
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthWorkouts = state.workouts.filter(w => new Date(w.date).getTime() >= monthStart);
  const totalTonnage = state.workouts.reduce((t, w) => t + tonnage(w), 0);
  const week = 7 * 24 * 3600 * 1000;
  const weekWorkouts = state.workouts.filter(w => Date.now() - new Date(w.date).getTime() < week);

  // упражнения, которые реально делались
  const usedExIds = new Set();
  for (const w of state.workouts) for (const en of w.entries) usedExIds.add(en.exId);
  const usedExs = state.exercises.filter(e => usedExIds.has(e.id));
  if (!progressExId || !usedExIds.has(progressExId)) progressExId = usedExs[0] ? usedExs[0].id : null;

  const lastW = state.weights.length ? state.weights[state.weights.length - 1] : null;

  page.innerHTML = `
    <h1>Прогресс</h1>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-value">${state.workouts.length}</div><div class="stat-label">всего тренировок</div></div>
      <div class="stat-tile"><div class="stat-value">${monthWorkouts.length}</div><div class="stat-label">в этом месяце</div></div>
      <div class="stat-tile"><div class="stat-value">${weekWorkouts.length}</div><div class="stat-label">за 7 дней</div></div>
      <div class="stat-tile"><div class="stat-value">${weekStreak()}</div><div class="stat-label">недель подряд</div></div>
      <div class="stat-tile" ${state.watch.length ? '' : 'style="grid-column:1/-1"'}><div class="stat-value">${(totalTonnage / 1000).toFixed(1)} т</div><div class="stat-label">поднято за всё время</div></div>
      ${state.watch.length ? `<div class="stat-tile"><div class="stat-value">⌚ ${state.watch.length}</div><div class="stat-label">тренировок с часов</div></div>` : ''}
    </div>

    <h2>Прогресс упражнения</h2>
    ${usedExs.length ? `
      <select id="progress-ex">
        ${usedExs.map(e => `<option value="${e.id}" ${e.id === progressExId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
      </select>
      <div class="filter-row" style="margin:10px 0 0">
        <button class="btn-chip ${progressMetric === 'w' ? 'accent' : ''}" data-metric="w">Вес</button>
        <button class="btn-chip ${progressMetric === 'orm' ? 'accent' : ''}" data-metric="orm">Расч. 1ПМ</button>
        <button class="btn-chip ${progressMetric === 'vol' ? 'accent' : ''}" data-metric="vol">Объём</button>
      </div>
      <div class="sub" id="ex-record" style="margin-top:8px"></div>
      <div class="chart-wrap" id="ex-chart"></div>` : `
      <div class="card chart-empty">Заверши первую тренировку — здесь появится график лучшего веса по каждому упражнению.</div>`}

    <h2>Объём по неделям</h2>
    <div class="chart-wrap" id="week-chart"></div>

    ${(() => {
      if (!state.watch.length) return '';
      const cutoff = Date.now() - 28 * 24 * 3600 * 1000;
      const recent = state.watch.filter(w => new Date(w.date).getTime() >= cutoff);
      if (!recent.length) return '';
      const mins = recent.reduce((t, w) => t + (w.min || 0), 0);
      const kcal = recent.reduce((t, w) => t + (w.kcal || 0), 0);
      const kms = Math.round(recent.reduce((t, w) => t + (w.km || 0), 0) * 10) / 10;
      const hrs = recent.filter(w => w.hr > 0);
      const avgHr = hrs.length ? Math.round(hrs.reduce((t, w) => t + w.hr, 0) / hrs.length) : 0;
      return `
        <h2>⌚ Здоровье за 4 недели</h2>
        <div class="stat-grid">
          <div class="stat-tile"><div class="stat-value">${mins}</div><div class="stat-label">минут кардио</div></div>
          <div class="stat-tile"><div class="stat-value">${kcal.toLocaleString('ru-RU')}</div><div class="stat-label">ккал сожжено</div></div>
          <div class="stat-tile"><div class="stat-value">${avgHr ? '❤️ ' + avgHr : '—'}</div><div class="stat-label">средний пульс</div></div>
          <div class="stat-tile"><div class="stat-value">${kms ? kms + ' км' : '—'}</div><div class="stat-label">дистанция</div></div>
        </div>`;
    })()}

    <h2>Вес тела</h2>
    <div class="card">
      <div class="settings-row">
        <input type="number" inputmode="decimal" step="0.1" min="0" id="bw-input"
               placeholder="${lastW ? lastW.kg + ' кг' : 'кг'}" style="flex:1">
        <button class="btn" id="bw-add" style="flex:0 0 40%">Записать</button>
      </div>
      <div class="chart-wrap" id="bw-chart"></div>
    </div>
  `;

  // График упражнения
  if (progressExId) {
    drawExerciseChart();
    $('#progress-ex').addEventListener('change', e => {
      progressExId = e.target.value;
      drawExerciseChart();
    });
    $$('[data-metric]', page).forEach(b => {
      b.addEventListener('click', () => {
        progressMetric = b.dataset.metric;
        $$('[data-metric]', page).forEach(x => x.classList.toggle('accent', x === b));
        drawExerciseChart();
      });
    });
  }

  // График объёма по неделям
  drawWeekChart();

  // График веса тела
  drawWeightChart();

  $('#bw-add').addEventListener('click', () => {
    const kg = parseFloat($('#bw-input').value);
    if (!kg || kg <= 0) { toast('Введи вес'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const existing = state.weights.find(w => w.date === today);
    if (existing) existing.kg = kg; else state.weights.push({ date: today, kg });
    state.weights.sort((a, b) => a.date.localeCompare(b.date));
    save();
    toast('Вес записан');
    renderProgress();
  });
}

function drawExerciseChart() {
  const el = $('#ex-chart');
  if (!el) return;

  const metricFn = { w: bestWeight, orm: best1rm, vol: exVolume }[progressMetric];
  const pts = [];
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i];
    const v = metricFn(w, progressExId);
    if (v > 0) pts.push({ label: fmtShortDate(w.date), y: Math.round(v * 10) / 10 });
  }

  const recEl = $('#ex-record');
  if (recEl) {
    const rec = bestEver(progressExId);
    recEl.innerHTML = rec.w > 0
      ? `🏆 Рекорды: <b>${rec.w} кг</b> за подход · расч. 1ПМ <b>${Math.round(rec.orm * 2) / 2} кг</b>`
      : '';
  }

  el.innerHTML = pts.length >= 2
    ? lineChart(pts, 'кг')
    : '<div class="card chart-empty">Нужно минимум две тренировки с этим упражнением.</div>';
  attachChartTooltip(el);
}

function drawWeekChart() {
  const el = $('#week-chart');
  if (!el) return;
  const WEEK = 7 * 24 * 3600 * 1000;
  const thisWeek = weekStart(new Date()).getTime();
  const bars = [];
  for (let i = 7; i >= 0; i--) {
    const start = thisWeek - i * WEEK;
    let vol = 0;
    for (const w of state.workouts) {
      if (weekStart(new Date(w.date)).getTime() === start) vol += tonnage(w);
    }
    bars.push({ label: fmtShortDate(new Date(start).toISOString()), y: vol });
  }
  el.innerHTML = bars.some(b => b.y > 0)
    ? barChart(bars)
    : '<div class="card chart-empty">Здесь появится тоннаж по неделям — общий вес, поднятый за каждую неделю.</div>';
}

/* Столбчатый график недельного объёма (SVG, одна серия) */
function barChart(bars) {
  const W = 520, H = 180;
  const pad = { l: 10, r: 10, t: 24, b: 26 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(...bars.map(b => b.y), 1);
  const gap = 8;
  const bw = (iw - gap * (bars.length - 1)) / bars.length;
  const maxIdx = bars.findIndex(b => b.y === max);

  const rects = bars.map((b, i) => {
    const h = Math.max(b.y > 0 ? 4 : 0, (b.y / max) * ih);
    const x = pad.l + i * (bw + gap);
    const y = pad.t + ih - h;
    // подписываем только максимум и последнюю неделю
    const label = (b.y > 0 && (i === maxIdx || i === bars.length - 1))
      ? `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${b.y >= 1000 ? (b.y / 1000).toFixed(1) + 'т' : b.y}</text>`
      : '';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="var(--accent)"/>${label}`;
  }).join('');

  const axis = `<line x1="${pad.l}" y1="${pad.t + ih}" x2="${W - pad.r}" y2="${pad.t + ih}" stroke="var(--grid)" stroke-width="1"/>`;
  const xLabels = [0, bars.length - 1].map(i =>
    `<text x="${pad.l + i * (bw + gap) + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(bars[i].label)}</text>`).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Объём по неделям, кг">${axis}${rects}${xLabels}</svg>`;
}

function drawWeightChart() {
  const el = $('#bw-chart');
  if (!el) return;
  const pts = state.weights.map(w => ({ label: fmtShortDate(w.date), y: w.kg }));
  el.innerHTML = pts.length >= 2
    ? lineChart(pts, 'кг')
    : (pts.length === 1
      ? `<div class="chart-empty">Текущий вес: <b>${pts[0].y} кг</b>. Записывай регулярно — появится график.</div>`
      : '');
  attachChartTooltip(el);
}

/* ---------- Линейный график (SVG, одна серия) ---------- */

function lineChart(pts, unit) {
  const W = 520, H = 220;

  let min = Math.min(...pts.map(p => p.y));
  let max = Math.max(...pts.map(p => p.y));
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  min -= range * 0.12; max += range * 0.12;

  // подписи оси Y: целые для больших значений, отступ — по ширине самой длинной
  const fmtY = v => max - min >= 20 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  const yLabels = [0, 1, 2, 3].map(g => fmtY(min + ((max - min) / 3) * g));
  const maxLabelLen = Math.max(...yLabels.map(s => s.length));
  const pad = { l: Math.max(40, 14 + maxLabelLen * 7), r: 16, t: 18, b: 30 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

  const x = i => pad.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = v => pad.t + ih - ((v - min) / (max - min)) * ih;

  // сетка: 4 горизонтальные линии
  const gridLines = [];
  for (let g = 0; g <= 3; g++) {
    const v = min + ((max - min) / 3) * g;
    const yy = y(v);
    gridLines.push(`
      <line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${pad.l - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${yLabels[g]}</text>`);
  }

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');

  // подписи оси X: первая, средняя, последняя
  const xIdx = pts.length > 2 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : pts.map((_, i) => i);
  const xLabels = [...new Set(xIdx)].map(i =>
    `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(pts[i].label)}</text>`).join('');

  const last = pts[pts.length - 1];
  const dots = pts.map((p, i) => `
    <circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"
      data-i="${i}" data-label="${esc(p.label)}" data-val="${p.y}"/>
    <circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="14" fill="transparent" data-i="${i}" data-label="${esc(p.label)}" data-val="${p.y}"/>`).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="График, последнее значение ${last.y} ${unit}">
    ${gridLines.join('')}
    ${xLabels}
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text class="chart-tip" x="${Math.min(x(pts.length - 1), W - pad.r - 4)}" y="${Math.max(y(last.y) - 10, 12)}" text-anchor="end">${last.y} ${unit}</text>
    <g data-tooltip style="display:none">
      <rect rx="6" fill="var(--surface-2)" stroke="var(--border)" width="90" height="34"/>
      <text class="chart-tip" font-size="12"></text>
    </g>
  </svg>`;
}

function attachChartTooltip(container) {
  const svg = $('svg.chart', container);
  if (!svg) return;
  const tip = $('[data-tooltip]', svg);
  const tipRect = $('rect', tip);
  const tipText = $('text', tip);

  svg.addEventListener('click', e => {
    const t = e.target.closest('circle[data-i]');
    if (!t) { tip.style.display = 'none'; return; }
    const cx = parseFloat(t.getAttribute('cx'));
    const cy = parseFloat(t.getAttribute('cy'));
    const label = `${t.dataset.label}: ${t.dataset.val}`;
    tipText.textContent = label;
    const tw = Math.max(60, label.length * 7 + 16);
    tipRect.setAttribute('width', tw);
    const tx = Math.min(Math.max(cx - tw / 2, 4), 520 - tw - 4);
    const ty = cy > 60 ? cy - 48 : cy + 14;
    tip.setAttribute('transform', `translate(${tx},${ty})`);
    tipRect.setAttribute('x', 0); tipRect.setAttribute('y', 0);
    tipText.setAttribute('x', tw / 2); tipText.setAttribute('y', 22);
    tipText.setAttribute('text-anchor', 'middle');
    tip.style.display = '';
  });
}

/* ---------- Экран «Программы» ---------- */

let programFilter = 'м';

function renderPrograms() {
  const page = $('#page-programs');
  page.innerHTML = `
    <h1>Программы</h1>
    <div class="filter-row">
      <button class="btn-chip ${programFilter === 'м' ? 'accent' : ''}" data-f="м">Мужские</button>
      <button class="btn-chip ${programFilter === 'ж' ? 'accent' : ''}" data-f="ж">Женские</button>
      <button class="btn-chip ${programFilter === 'мои' ? 'accent' : ''}" data-f="мои">Мои</button>
    </div>
    <div id="program-list"></div>
  `;

  $$('.filter-row .btn-chip', page).forEach(b => {
    b.addEventListener('click', () => {
      programFilter = b.dataset.f;
      renderPrograms();
    });
  });

  const listEl = $('#program-list');

  if (programFilter === 'мои') {
    listEl.innerHTML = `
      <button class="btn" id="new-program" style="margin-bottom:12px">+ Создать программу</button>
      ${state.programs.length ? '' : `<div class="empty-state"><div class="big">📝</div><p>Собери свою программу из любых<br>упражнений — и запускай тренировки в один тап.</p></div>`}
      ${state.programs.map(p => programCardHtml(p, true)).join('')}
    `;
    $('#new-program').addEventListener('click', () => openProgramBuilder(null));
  } else {
    const progs = PROGRAMS.filter(p => p.gender === programFilter);
    listEl.innerHTML = progs.map(p => programCardHtml(p, false)).join('');
  }

  $$('.prog-card', listEl).forEach(card => {
    card.addEventListener('click', () => {
      const custom = card.dataset.custom === '1';
      const prog = custom
        ? state.programs.find(p => p.id === card.dataset.id)
        : PROGRAMS.find(p => p.id === card.dataset.id);
      if (prog) openProgramDetail(prog, custom);
    });
  });
}

function programCardHtml(p, custom) {
  return `
    <div class="card prog-card" data-id="${p.id}" data-custom="${custom ? 1 : 0}">
      <div class="hist-date">${esc(p.name)}</div>
      <div class="hist-meta">
        <span>📅 ${p.days.length} ${dayWord(p.days.length)}</span>
        ${p.level ? `<span>⚡ ${esc(p.level)}</span>` : ''}
      </div>
      ${p.desc ? `<div class="sub" style="margin-top:6px">${esc(p.desc)}</div>` : ''}
    </div>`;
}

function dayWord(n) {
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

function openProgramDetail(prog, custom) {
  const modal = openModal(`
    <div class="modal-head">
      <h2>${esc(prog.name)}</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      ${prog.desc ? `<p class="sub" style="margin-bottom:12px">${esc(prog.desc)}</p>` : ''}
      ${prog.days.map((d, di) => `
        <div class="card">
          <div class="ex-title"><span>${esc(d.name)}</span></div>
          ${d.items.map(([name, sets, reps]) => `
            <div class="prog-ex-row">
              <span>${esc(name)}</span>
              <span style="white-space:nowrap"><b>${sets}×${esc(String(reps))}</b>
                <button class="icon-btn" data-video="${esc(name)}" title="Видео техники">▶</button>
              </span>
            </div>`).join('')}
          <button class="btn" data-start="${di}" style="margin-top:10px;padding:12px;font-size:15px">Начать эту тренировку</button>
        </div>`).join('')}
      ${custom ? `
        <div class="settings-row" style="margin-top:4px">
          <button class="btn secondary" data-edit>Изменить</button>
          <button class="btn danger-outline" data-delete>Удалить</button>
        </div>` : ''}
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);

  $$('[data-video]', modal).forEach(b => {
    b.addEventListener('click', () => window.open(videoUrl(b.dataset.video), '_blank'));
  });

  $$('[data-start]', modal).forEach(b => {
    b.addEventListener('click', () => {
      const day = prog.days[+b.dataset.start];
      if (state.active && !confirm('Уже идёт тренировка. Начать новую вместо неё?')) return;
      startWorkoutFromDay(day);
      closeModal();
    });
  });

  if (custom) {
    $('[data-edit]', modal).addEventListener('click', () => openProgramBuilder(prog));
    $('[data-delete]', modal).addEventListener('click', () => {
      if (confirm(`Удалить программу «${prog.name}»?`)) {
        state.programs = state.programs.filter(p => p.id !== prog.id);
        save();
        closeModal();
        renderPrograms();
      }
    });
  }
}

function exIdByName(name) {
  let ex = state.exercises.find(e => e.name === name);
  if (!ex) {
    ex = { id: uid(), name, group: 'Другое', custom: true };
    state.exercises.push(ex);
  }
  return ex.id;
}

function startWorkoutFromDay(day) {
  const entries = day.items.map(([name, sets, reps]) => {
    const exId = exIdByName(name);
    const prev = lastSetsFor(exId);
    const repNum = parseInt(String(reps), 10) || 0;
    const setArr = [];
    for (let i = 0; i < sets; i++) {
      const p = prev[i] || prev[prev.length - 1];
      setArr.push({ w: p ? p.w : 0, r: p ? p.r : repNum, done: false });
    }
    return { exId, sets: setArr, target: `${sets}×${reps}` };
  });
  state.active = { start: Date.now(), entries };
  save();
  showPage('workout');
  toast('Тренировка по программе начата');
}

/* ---- Конструктор своей программы ---- */

let programDraft = null;

function openProgramBuilder(prog) {
  if (prog) {
    // редактирование: глубокая копия
    programDraft = JSON.parse(JSON.stringify(prog));
  } else if (!programDraft) {
    programDraft = { id: uid(), name: '', days: [{ name: 'День 1', items: [] }] };
  }
  drawProgramBuilder();
}

function drawProgramBuilder() {
  const d = programDraft;
  const modal = openModal(`
    <div class="modal-head">
      <h2>${state.programs.some(p => p.id === d.id) ? 'Изменить программу' : 'Новая программа'}</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label>Название программы</label>
        <input type="text" data-name value="${esc(d.name)}" placeholder="Например: Мой сплит">
      </div>
      ${d.days.map((day, di) => `
        <div class="card" data-day="${di}">
          <div class="ex-title">
            <input type="text" data-day-name value="${esc(day.name)}" style="text-align:left;font-weight:700">
            <button class="icon-btn" data-rm-day>✕</button>
          </div>
          ${day.items.map(([name, sets, reps], ii) => `
            <div class="prog-ex-row" data-item="${ii}">
              <span>${esc(name)}</span>
              <span class="prog-ex-inputs">
                <input type="number" inputmode="numeric" min="1" value="${sets}" data-sets> ×
                <input type="text" inputmode="numeric" value="${esc(String(reps))}" data-reps>
                <button class="icon-btn" data-rm-item>✕</button>
              </span>
            </div>`).join('')}
          <button class="btn-chip" data-add-item style="margin-top:8px">+ Упражнение</button>
        </div>`).join('')}
      <button class="btn secondary" data-add-day style="margin-bottom:10px">+ Добавить день</button>
      <button class="btn" data-save-prog>Сохранить программу</button>
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', () => { programDraft = null; closeModal(); });
  $('[data-name]', modal).addEventListener('input', e => { d.name = e.target.value; });

  $$('[data-day]', modal).forEach(dayEl => {
    const di = +dayEl.dataset.day;
    const day = d.days[di];
    $('[data-day-name]', dayEl).addEventListener('input', e => { day.name = e.target.value; });
    $('[data-rm-day]', dayEl).addEventListener('click', () => {
      if (d.days.length <= 1) { toast('Нужен хотя бы один день'); return; }
      d.days.splice(di, 1);
      drawProgramBuilder();
    });
    $('[data-add-item]', dayEl).addEventListener('click', () => {
      openExercisePicker(exId => {
        const ex = exById(exId);
        if (ex) day.items.push([ex.name, 3, '10']);
        drawProgramBuilder();
      });
    });
    $$('[data-item]', dayEl).forEach(itemEl => {
      const ii = +itemEl.dataset.item;
      $('[data-sets]', itemEl).addEventListener('input', e => { day.items[ii][1] = Math.max(1, parseInt(e.target.value, 10) || 1); });
      $('[data-reps]', itemEl).addEventListener('input', e => { day.items[ii][2] = e.target.value; });
      $('[data-rm-item]', itemEl).addEventListener('click', () => {
        day.items.splice(ii, 1);
        drawProgramBuilder();
      });
    });
  });

  $('[data-add-day]', modal).addEventListener('click', () => {
    d.days.push({ name: 'День ' + (d.days.length + 1), items: [] });
    drawProgramBuilder();
  });

  $('[data-save-prog]', modal).addEventListener('click', () => {
    if (!d.name.trim()) { toast('Введи название программы'); return; }
    if (!d.days.some(day => day.items.length)) { toast('Добавь хотя бы одно упражнение'); return; }
    const idx = state.programs.findIndex(p => p.id === d.id);
    if (idx >= 0) state.programs[idx] = d; else state.programs.push(d);
    save();
    programDraft = null;
    programFilter = 'мои';
    closeModal();
    toast('Программа сохранена');
    renderPrograms();
  });
}

/* ---------- Экран «Ещё» ---------- */

function renderMore() {
  const page = $('#page-more');
  page.innerHTML = `
    <h1>Ещё</h1>
    <div class="ex-item" id="more-ex"><span>🏋️ Упражнения<span class="sub"> · ${state.exercises.length} с видео</span></span><span class="sub">›</span></div>
    <div class="ex-item" id="more-kbju"><span>🍎 Калькулятор КБЖУ</span><span class="sub">›</span></div>
    <div class="ex-item" id="more-1rm"><span>💪 Калькулятор 1ПМ</span><span class="sub">›</span></div>
    <div class="ex-item" id="more-plates"><span>⚖️ Блины на штангу</span><span class="sub">›</span></div>
    <div class="ex-item" id="more-watch"><span>⌚ Импорт из Apple Watch<span class="sub">${state.watch.length ? ' · ' + state.watch.length : ''}</span></span><span class="sub">›</span></div>
    <div class="ex-item" id="more-ai"><span>🤖 ИИ-тренер<span class="sub">${state.settings.ai && state.settings.ai.key ? ' · подключён' : ' · бесплатно'}</span></span><span class="sub">›</span></div>
    <div class="ex-item" id="more-recipes"><span>🍽️ Книга рецептов<span class="sub"> · ${RECIPES.length} блюд</span></span><span class="sub">›</span></div>
    <div class="ex-item" id="more-kb"><span>📚 База знаний<span class="sub"> · ${ARTICLES.length} статей</span></span><span class="sub">›</span></div>
    <div class="ex-item" id="more-settings"><span>⚙️ Настройки и резервная копия</span><span class="sub">›</span></div>
  `;
  $('#more-ex').addEventListener('click', openExerciseLibrary);
  $('#more-kbju').addEventListener('click', openKbjuCalc);
  $('#more-1rm').addEventListener('click', open1RmCalc);
  $('#more-plates').addEventListener('click', openPlateCalc);
  $('#more-watch').addEventListener('click', openWatchImport);
  $('#more-ai').addEventListener('click', openAiCoach);
  $('#more-recipes').addEventListener('click', () => openRecipes());
  $('#more-kb').addEventListener('click', openKnowledgeBase);
  $('#more-settings').addEventListener('click', openSettings);
}

/* ---- Калькулятор КБЖУ (Миффлин — Сан-Жеор) ---- */

function openKbjuCalc() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>Калькулятор КБЖУ</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label>Пол</label>
        <select data-sex><option value="m">Мужской</option><option value="f">Женский</option></select>
      </div>
      <div class="settings-row" style="margin-bottom:12px">
        <div style="flex:1"><label class="sub" style="display:block;margin-bottom:6px">Возраст</label><input type="number" inputmode="numeric" data-age placeholder="25"></div>
        <div style="flex:1"><label class="sub" style="display:block;margin-bottom:6px">Рост, см</label><input type="number" inputmode="numeric" data-height placeholder="175"></div>
        <div style="flex:1"><label class="sub" style="display:block;margin-bottom:6px">Вес, кг</label><input type="number" inputmode="decimal" data-weight placeholder="70"></div>
      </div>
      <div class="form-row">
        <label>Активность</label>
        <select data-activity>
          <option value="1.2">Сидячий образ жизни</option>
          <option value="1.375">Тренировки 1–3 раза в неделю</option>
          <option value="1.55" selected>Тренировки 3–5 раз в неделю</option>
          <option value="1.725">Тренировки 6–7 раз в неделю</option>
        </select>
      </div>
      <div class="form-row">
        <label>Цель</label>
        <select data-goal>
          <option value="-0.17">Похудение (−17%)</option>
          <option value="0" selected>Поддержание веса</option>
          <option value="0.12">Набор массы (+12%)</option>
        </select>
      </div>
      <button class="btn" data-calc>Рассчитать</button>
      <div data-result style="margin-top:14px"></div>
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);

  // подставим последний известный вес тела
  const lastW = state.weights.length ? state.weights[state.weights.length - 1].kg : null;
  if (lastW) $('[data-weight]', modal).value = lastW;

  $('[data-calc]', modal).addEventListener('click', () => {
    const sex = $('[data-sex]', modal).value;
    const age = parseFloat($('[data-age]', modal).value);
    const h = parseFloat($('[data-height]', modal).value);
    const w = parseFloat($('[data-weight]', modal).value);
    if (!age || !h || !w) { toast('Заполни возраст, рост и вес'); return; }

    const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'm' ? 5 : -161);
    const tdee = bmr * parseFloat($('[data-activity]', modal).value);
    const goal = parseFloat($('[data-goal]', modal).value);
    const kcal = Math.round(tdee * (1 + goal));

    const protein = Math.round(w * (goal < 0 ? 2 : 1.8));
    const fat = Math.round(w * 1);
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

    $('[data-result]', modal).innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile"><div class="stat-value">${kcal.toLocaleString('ru-RU')}</div><div class="stat-label">ккал в день</div></div>
        <div class="stat-tile"><div class="stat-value">${protein} г</div><div class="stat-label">белки</div></div>
        <div class="stat-tile"><div class="stat-value">${fat} г</div><div class="stat-label">жиры</div></div>
        <div class="stat-tile"><div class="stat-value">${carbs} г</div><div class="stat-label">углеводы</div></div>
      </div>
      <p class="sub">Расчёт по формуле Миффлина — Сан-Жеора. Это ориентир: следи за весом 2–3 недели и корректируй калории по факту.</p>
    `;
  });
}

/* ---- Калькулятор 1ПМ (формула Эпли) ---- */

function open1RmCalc() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>Калькулятор 1ПМ</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <p class="sub" style="margin-bottom:12px">Введи вес и число повторов из тяжёлого рабочего подхода — получишь расчётный одноповторный максимум и проценты для программ.</p>
      <div class="settings-row" style="margin-bottom:12px">
        <div style="flex:1"><label class="sub" style="display:block;margin-bottom:6px">Вес, кг</label><input type="number" inputmode="decimal" data-w placeholder="80"></div>
        <div style="flex:1"><label class="sub" style="display:block;margin-bottom:6px">Повторы</label><input type="number" inputmode="numeric" data-r placeholder="8"></div>
      </div>
      <button class="btn" data-calc>Рассчитать</button>
      <div data-result style="margin-top:14px"></div>
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);

  $('[data-calc]', modal).addEventListener('click', () => {
    const w = parseFloat($('[data-w]', modal).value);
    const r = parseInt($('[data-r]', modal).value, 10);
    if (!w || !r) { toast('Введи вес и повторы'); return; }
    if (r > 12) { toast('Для точности используй подход до 12 повторов'); }

    const orm = w * (1 + r / 30); // Эпли
    const rows = [
      [95, '1–2 повтора'], [90, '3–4 повтора'], [85, '5–6 повторов'],
      [80, '7–8 повторов'], [75, '9–10 повторов'], [70, '10–12 повторов'],
      [60, '15+ повторов'], [50, 'разминка'],
    ];
    $('[data-result]', modal).innerHTML = `
      <div class="stat-tile" style="margin-bottom:12px">
        <div class="stat-value">${(Math.round(orm * 2) / 2).toLocaleString('ru-RU')} кг</div>
        <div class="stat-label">расчётный 1ПМ</div>
      </div>
      ${rows.map(([pct, use]) => `
        <div class="prog-ex-row">
          <span>${pct}% <span class="sub">· ${use}</span></span>
          <b>${(Math.round(orm * pct / 100 * 2) / 2).toLocaleString('ru-RU')} кг</b>
        </div>`).join('')}
    `;
  });
}

/* ---- Блины на штангу ---- */

function openPlateCalc() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>Блины на штангу</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <p class="sub" style="margin-bottom:12px">Введи целевой вес — покажу, какие блины повесить с каждой стороны грифа.</p>
      <div class="settings-row" style="margin-bottom:12px">
        <div style="flex:1"><label class="sub" style="display:block;margin-bottom:6px">Целевой вес, кг</label><input type="number" inputmode="decimal" data-target placeholder="80"></div>
        <div style="flex:1"><label class="sub" style="display:block;margin-bottom:6px">Гриф, кг</label>
          <select data-bar><option value="20" selected>20 (олимпийский)</option><option value="15">15 (женский)</option><option value="10">10 (лёгкий)</option><option value="7">7 (EZ-гриф)</option></select>
        </div>
      </div>
      <button class="btn" data-calc>Рассчитать</button>
      <div data-result style="margin-top:14px"></div>
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);

  $('[data-calc]', modal).addEventListener('click', () => {
    const target = parseFloat($('[data-target]', modal).value);
    const bar = parseFloat($('[data-bar]', modal).value);
    const out = $('[data-result]', modal);
    if (!target) { toast('Введи целевой вес'); return; }
    if (target < bar) {
      out.innerHTML = `<p class="sub">Целевой вес меньше веса грифа (${bar} кг) — работай с пустым грифом.</p>`;
      return;
    }
    const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
    let perSide = (target - bar) / 2;
    const used = [];
    for (const p of PLATES) {
      while (perSide >= p - 1e-9) { used.push(p); perSide -= p; }
    }
    const achieved = target - perSide * 2;
    out.innerHTML = `
      <div class="stat-tile" style="margin-bottom:12px">
        <div class="stat-value">${used.length ? used.join(' + ') : '—'}</div>
        <div class="stat-label">кг с каждой стороны</div>
      </div>
      <p class="sub">${perSide > 1e-9
        ? `Точно ${target} кг стандартными блинами не собрать. Ближайший вес: <b>${Math.round(achieved * 100) / 100} кг</b> (гриф ${bar} + блины).`
        : `Итого на штанге: <b>${target} кг</b> (гриф ${bar} кг + ${used.length ? used.map(p => p + '×2').join(' + ') : 'без блинов'}).`}</p>
    `;
  });
}

/* ---- ИИ-тренер (бесплатные модели через ключ пользователя) ---- */

let aiChat = []; // история диалога в рамках сессии: {role: 'user'|'assistant', text}

// Сводка данных пользователя для контекста ИИ
function aiContext() {
  const lines = ['Данные из дневника тренировок пользователя:'];

  const recent = state.workouts.slice(0, 5);
  if (recent.length) {
    lines.push('Последние тренировки в зале:');
    for (const w of recent) {
      const exs = w.entries.map(en => {
        const ex = exById(en.exId);
        const top = en.sets.filter(s => s.done).sort((a, b) => b.w - a.w)[0];
        return `${ex ? ex.name : '?'} ${top ? top.w + 'кг×' + top.r : ''}`;
      }).join(', ');
      lines.push(`- ${fmtShortDate(w.date)}: ${exs}${w.note ? ' (заметка: ' + w.note + ')' : ''}`);
    }
  } else {
    lines.push('Тренировок в зале пока не записано.');
  }

  const usedIds = [...new Set(state.workouts.flatMap(w => w.entries.map(en => en.exId)))].slice(0, 8);
  if (usedIds.length) {
    lines.push('Рекорды: ' + usedIds.map(id => {
      const ex = exById(id);
      const r = bestEver(id);
      return `${ex ? ex.name : '?'} ${r.w}кг`;
    }).join(', '));
  }

  if (state.weights.length) {
    const last = state.weights[state.weights.length - 1];
    lines.push(`Вес тела: ${last.kg} кг (${last.date}).`);
  }
  if (state.watch.length) {
    lines.push(`Кардио с Apple Watch за всё время: ${state.watch.length} тренировок.`);
  }
  lines.push(`Серия: ${weekStreak()} недель подряд с тренировками.`);
  return lines.join('\n');
}

const AI_SYSTEM = 'Ты — дружелюбный персональный тренер в приложении «Мой Зал». Отвечай по-русски, кратко и по делу, без markdown-разметки. Давай практичные советы по тренировкам, прогрессии нагрузок, технике и питанию с учётом данных дневника пользователя. Ты не врач: при боли или травме советуй обратиться к специалисту.';

async function askAi(userText) {
  const ai = state.settings.ai;
  const sys = AI_SYSTEM + '\n\n' + aiContext();
  const history = aiChat.slice(-10);

  if (ai.provider === 'gemini') {
    const model = ai.model || 'gemini-2.5-flash';
    const contents = history.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
    contents.push({ role: 'user', parts: [{ text: userText }] });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(ai.key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    if (!text) throw new Error('Пустой ответ модели');
    return text;
  }

  // OpenRouter (OpenAI-совместимый API)
  const model = ai.model || 'openrouter/free';
  const messages = [{ role: 'system', content: sys }];
  for (const m of history) messages.push({ role: m.role, content: m.text });
  messages.push({ role: 'user', content: userText });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ai.key,
      'HTTP-Referer': location.origin,
      'X-Title': 'Moy Zal',
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Пустой ответ модели');
  return text;
}

function openAiCoach() {
  if (!state.settings.ai.key) { openAiSettings(); return; }

  const modal = openModal(`
    <div class="modal-head">
      <h2>🤖 ИИ-тренер</h2>
      <span>
        <button class="icon-btn" data-settings>⚙️</button>
        <button class="icon-btn" data-close>✕</button>
      </span>
    </div>
    <div class="modal-body ai-chat" data-chat>
      ${aiChat.length ? '' : `<p class="sub" style="margin-bottom:10px">ИИ видит твои последние тренировки, рекорды и вес — спрашивай о своём прогрессе. Быстрые вопросы:</p>
      <div class="ai-quick">
        <button class="btn-chip" data-q="Составь мне тренировку на завтра с учётом моих последних тренировок">Тренировка на завтра</button>
        <button class="btn-chip" data-q="Проанализируй мой прогресс и скажи, что улучшить">Анализ прогресса</button>
        <button class="btn-chip" data-q="Застрял в рабочих весах, как пробить плато?">Как пробить плато</button>
        <button class="btn-chip" data-q="Что поесть до и после тренировки?">Питание вокруг тренировки</button>
      </div>`}
    </div>
    <div class="ai-input-row">
      <input type="text" data-input placeholder="Спроси тренера…" style="text-align:left;font-weight:400">
      <button class="btn" data-send style="width:auto;padding:12px 18px">➤</button>
    </div>
  `);

  const chatEl = $('[data-chat]', modal);
  const inputEl = $('[data-input]', modal);

  function drawMessages() {
    const msgs = aiChat.map(m =>
      `<div class="ai-msg ${m.role}">${esc(m.text).replace(/\n/g, '<br>')}</div>`).join('');
    chatEl.innerHTML = msgs || chatEl.innerHTML;
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  if (aiChat.length) drawMessages();

  async function send(text) {
    text = text.trim();
    if (!text) return;
    inputEl.value = '';
    aiChat.push({ role: 'user', text });
    drawMessages();
    chatEl.insertAdjacentHTML('beforeend', '<div class="ai-msg assistant" data-typing>…</div>');
    chatEl.scrollTop = chatEl.scrollHeight;
    try {
      const answer = await askAi(text);
      aiChat.push({ role: 'assistant', text: answer });
    } catch (err) {
      aiChat.push({ role: 'assistant', text: 'Не получилось связаться с ИИ: ' + err.message + '\nПроверь ключ и интернет в ⚙️ настройках.' });
    }
    drawMessages();
  }

  $$('[data-q]', modal).forEach(b => b.addEventListener('click', () => send(b.dataset.q)));
  $('[data-send]', modal).addEventListener('click', () => send(inputEl.value));
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send(inputEl.value); });
  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-settings]', modal).addEventListener('click', openAiSettings);
}

function openAiSettings() {
  const ai = state.settings.ai;
  const modal = openModal(`
    <div class="modal-head">
      <h2>🤖 Подключение ИИ</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <div class="card article">
        <p>ИИ-тренер работает через <b>бесплатные</b> модели. Нужен свой ключ — он хранится только на этом телефоне:</p>
        <p><b>OpenRouter</b> (рекомендую): зарегистрируйся на openrouter.ai (без карты) → Keys → Create Key. Бесплатные модели, до 50 запросов в день.</p>
        <p><b>Google Gemini</b>: зайди на aistudio.google.com → Get API key. Бесплатный тариф до 1000+ запросов в день.</p>
      </div>
      <div class="form-row">
        <label>Провайдер</label>
        <select data-provider>
          <option value="openrouter" ${ai.provider !== 'gemini' ? 'selected' : ''}>OpenRouter (бесплатные модели)</option>
          <option value="gemini" ${ai.provider === 'gemini' ? 'selected' : ''}>Google Gemini (бесплатный тариф)</option>
        </select>
      </div>
      <div class="form-row">
        <label>API-ключ</label>
        <input type="password" data-key value="${esc(ai.key)}" placeholder="sk-or-… или AIza…">
      </div>
      <div class="form-row">
        <label>Модель (можно оставить пустым)</label>
        <input type="text" data-model value="${esc(ai.model)}" placeholder="openrouter/free или gemini-2.5-flash">
      </div>
      <button class="btn" data-save-ai>Сохранить и открыть чат</button>
      ${ai.key ? '<button class="btn danger-outline" data-unlink style="margin-top:10px">Отключить ИИ</button>' : ''}
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-save-ai]', modal).addEventListener('click', () => {
    ai.provider = $('[data-provider]', modal).value;
    ai.key = $('[data-key]', modal).value.trim();
    ai.model = $('[data-model]', modal).value.trim();
    save();
    if (!ai.key) { toast('Вставь API-ключ'); return; }
    renderMore();
    openAiCoach();
  });
  const unlink = $('[data-unlink]', modal);
  if (unlink) unlink.addEventListener('click', () => {
    ai.key = ''; aiChat = [];
    save();
    renderMore();
    closeModal();
    toast('ИИ отключён');
  });
}

/* ---- Импорт из Apple Watch (экспорт приложения «Здоровье») ---- */

const WATCH_TYPES = {
  Running: 'Бег', Walking: 'Ходьба', Cycling: 'Велосипед', Swimming: 'Плавание',
  Elliptical: 'Эллипс', Rowing: 'Гребля', Hiking: 'Хайкинг', Yoga: 'Йога',
  Pilates: 'Пилатес', StairClimbing: 'Лестница', JumpRope: 'Скакалка',
  TraditionalStrengthTraining: 'Силовая тренировка',
  FunctionalStrengthTraining: 'Функциональная тренировка',
  HighIntensityIntervalTraining: 'ВИИТ', CrossTraining: 'Кросс-тренинг',
  CoreTraining: 'Пресс и кор', Dance: 'Танцы', Boxing: 'Бокс',
  MartialArts: 'Единоборства', Soccer: 'Футбол', Basketball: 'Баскетбол',
  Tennis: 'Теннис', Badminton: 'Бадминтон', TableTennis: 'Настольный теннис',
  Other: 'Тренировка',
};

function healthAttr(tag, name) {
  const m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : '';
}

// "2026-07-18 07:30:21 +0300" → Date
function healthDate(s) {
  const iso = s.trim().replace(' ', 'T').replace(' ', '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}

// Потоковый разбор export.xml: файл может быть в сотни МБ, читаем кусками
async function parseHealthExport(file, progressCb) {
  const CHUNK = 4 * 1024 * 1024, OVERLAP = 16 * 1024;
  const workouts = new Map(); // ключ: startDate|type
  const weights = new Map();  // ключ: YYYY-MM-DD

  for (let pos = 0; pos < file.size; pos += CHUNK) {
    const from = Math.max(0, pos - OVERLAP);
    const text = await file.slice(from, pos + CHUNK).text();
    if (progressCb) progressCb(Math.min(99, Math.round((pos + CHUNK) / file.size * 100)));

    for (const m of text.matchAll(/<Workout\b[^>]*>/g)) {
      const tag = m[0];
      const actRaw = healthAttr(tag, 'workoutActivityType').replace('HKWorkoutActivityType', '');
      const start = healthDate(healthAttr(tag, 'startDate'));
      if (!actRaw || !start) continue;
      const key = start.getTime() + '|' + actRaw;
      if (workouts.has(key)) continue;

      let min = Math.round(parseFloat(healthAttr(tag, 'duration')) || 0);
      const unit = healthAttr(tag, 'durationUnit');
      if (unit === 'sec') min = Math.round(min / 60);

      // вложенная статистика тренировки (новый формат экспорта)
      let block = text.slice(m.index, m.index + 8000);
      const blockEnd = block.indexOf('</Workout>');
      if (blockEnd > 0) block = block.slice(0, blockEnd);

      // калории: старый формат — атрибут, новый — WorkoutStatistics
      let kcal = Math.round(parseFloat(healthAttr(tag, 'totalEnergyBurned')) || 0);
      if (!kcal) {
        const em = block.match(/HKQuantityTypeIdentifierActiveEnergyBurned"[^>]*sum="([0-9.]+)"/);
        if (em) kcal = Math.round(parseFloat(em[1]));
      }

      // пульс: средний и максимальный
      let hr = 0, hrMax = 0;
      const hrTag = block.match(/<WorkoutStatistics[^>]*HKQuantityTypeIdentifierHeartRate[^>]*>/);
      if (hrTag) {
        hr = Math.round(parseFloat(healthAttr(hrTag[0], 'average')) || 0);
        hrMax = Math.round(parseFloat(healthAttr(hrTag[0], 'maximum')) || 0);
      }

      // дистанция: старый формат — атрибут totalDistance, новый — статистика
      let km = parseFloat(healthAttr(tag, 'totalDistance')) || 0;
      let distUnit = healthAttr(tag, 'totalDistanceUnit');
      if (!km) {
        const dTag = block.match(/<WorkoutStatistics[^>]*HKQuantityTypeIdentifierDistance[A-Za-z]*[^>]*>/);
        if (dTag) {
          km = parseFloat(healthAttr(dTag[0], 'sum')) || 0;
          distUnit = healthAttr(dTag[0], 'unit');
        }
      }
      if (distUnit === 'm') km /= 1000;
      else if (/mi/.test(distUnit)) km *= 1.609;
      km = Math.round(km * 100) / 100;

      workouts.set(key, {
        id: 'aw' + start.getTime() + actRaw.length,
        date: start.toISOString(),
        type: WATCH_TYPES[actRaw] || actRaw,
        min, kcal, hr, hrMax, km,
      });
    }

    for (const m of text.matchAll(/<Record\b[^>]*HKQuantityTypeIdentifierBodyMass[^>]*>/g)) {
      const tag = m[0];
      const d = healthDate(healthAttr(tag, 'startDate'));
      let kg = parseFloat(healthAttr(tag, 'value'));
      if (!d || !kg) continue;
      if (/lb/i.test(healthAttr(tag, 'unit'))) kg *= 0.4536;
      weights.set(d.toISOString().slice(0, 10), Math.round(kg * 10) / 10);
    }
  }

  return { workouts: [...workouts.values()], weights };
}

function openWatchImport() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>⌚ Импорт из Apple Watch</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <p class="sub" style="margin-bottom:10px">Apple не даёт веб-приложениям прямой доступ к «Здоровью», но все данные можно перенести файлом за минуту:</p>
      <div class="card article">
        <p>1. Открой приложение <b>Здоровье</b> → нажми на свой аватар → <b>Экспорт медданных</b>.</p>
        <p>2. Сохрани архив в <b>Файлы</b> и нажми на него — он распакуется в папку.</p>
        <p>3. Вернись сюда и выбери файл <b>export.xml</b> из этой папки.</p>
      </div>
      <button class="btn" data-pick>Выбрать export.xml</button>
      <input type="file" data-file accept=".xml,text/xml" style="display:none">
      <div data-status class="sub" style="margin-top:12px"></div>
      ${state.watch.length ? `
        <div class="card" style="margin-top:12px">
          <p class="sub" style="margin-bottom:10px">Импортировано тренировок с часов: <b>${state.watch.length}</b></p>
          <button class="btn danger-outline" data-clear style="padding:10px;font-size:14px">Удалить импортированные</button>
        </div>` : ''}
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-pick]', modal).addEventListener('click', () => $('[data-file]', modal).click());

  const clearBtn = $('[data-clear]', modal);
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (confirm('Удалить все тренировки, импортированные с часов?')) {
      state.watch = [];
      save();
      closeModal();
      toast('Импорт с часов удалён');
      render();
    }
  });

  $('[data-file]', modal).addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const status = $('[data-status]', modal);
    status.textContent = 'Читаю файл…';
    try {
      const { workouts, weights } = await parseHealthExport(file, p => {
        status.textContent = `Читаю файл… ${p}%`;
      });

      const byId = new Map(state.watch.map(w => [w.id, w]));
      const fresh = [];
      for (const w of workouts) {
        const ex = byId.get(w.id);
        if (ex) Object.assign(ex, w); // дозаполняем метрики (пульс, км) в старых записях
        else fresh.push(w);
      }
      state.watch.push(...fresh);
      state.watch.sort((a, b) => b.date.localeCompare(a.date));

      let freshW = 0;
      for (const [date, kg] of weights) {
        const ex = state.weights.find(x => x.date === date);
        if (!ex) { state.weights.push({ date, kg }); freshW++; }
      }
      state.weights.sort((a, b) => a.date.localeCompare(b.date));

      save();
      status.innerHTML = `Готово: <b>${fresh.length}</b> новых тренировок с часов, <b>${freshW}</b> замеров веса. Смотри вкладку «История».`;
      toast('Данные с Apple Watch импортированы ⌚');
    } catch (err) {
      status.textContent = 'Не удалось разобрать файл. Убедись, что выбран export.xml из экспорта «Здоровья».';
    }
    e.target.value = '';
  });
}

/* ---- Книга рецептов ---- */

let recipeCat = 'Все';

function openRecipes() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>🍽️ Книга рецептов</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="search-row">
      <input type="text" placeholder="Поиск блюда или ингредиента…" data-search>
    </div>
    <div class="filter-row" data-cats></div>
    <div class="modal-body" data-list></div>
  `);

  const listEl = $('[data-list]', modal);
  const searchEl = $('[data-search]', modal);
  const catsEl = $('[data-cats]', modal);

  catsEl.innerHTML = ['Все', ...RECIPE_CATS]
    .map(c => `<button class="btn-chip ${c === recipeCat ? 'accent' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');

  function draw() {
    const f = searchEl.value.trim().toLowerCase();
    let list = RECIPES;
    if (recipeCat !== 'Все') list = list.filter(r => r.cat === recipeCat);
    if (f) list = list.filter(r =>
      r.name.toLowerCase().includes(f) || r.ing.some(i => i.toLowerCase().includes(f)));

    if (!list.length) {
      listEl.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
      return;
    }

    // группируем по категориям (когда выбрано «Все»)
    let html = '';
    for (const cat of RECIPE_CATS) {
      const inCat = list.filter(r => r.cat === cat);
      if (!inCat.length) continue;
      if (recipeCat === 'Все') html += `<div class="group-title">${esc(cat)}</div>`;
      html += inCat.map(r => `
        <div class="ex-item recipe-item" data-id="${r.id}">
          <span>${esc(r.name)}${r.k ? `<span class="sub"> · ${r.k[0]} ккал</span>` : ''}</span>
          <span class="sub">›</span>
        </div>`).join('');
    }
    if (!f) html += `<div class="card article" style="margin-top:14px"><div class="group-title" style="margin-top:0">Общие рекомендации</div><p class="sub">${esc(RECIPES_NOTE)}</p></div>`;
    listEl.innerHTML = html;
    $$('.recipe-item', listEl).forEach(item => {
      item.addEventListener('click', () => {
        const r = RECIPES.find(x => x.id === item.dataset.id);
        if (r) openRecipe(r);
      });
    });
  }

  draw();
  searchEl.addEventListener('input', draw);
  $$('[data-cat]', catsEl).forEach(b => b.addEventListener('click', () => {
    recipeCat = b.dataset.cat;
    $$('[data-cat]', catsEl).forEach(x => x.classList.toggle('accent', x === b));
    draw();
  }));
  $('[data-close]', modal).addEventListener('click', closeModal);
}

function openRecipe(r) {
  const kbju = r.k
    ? `<div class="stat-grid" style="margin-bottom:12px">
        <div class="stat-tile"><div class="stat-value">${r.k[0]}</div><div class="stat-label">ккал</div></div>
        <div class="stat-tile"><div class="stat-value">${r.k[1]} г</div><div class="stat-label">белки</div></div>
        <div class="stat-tile"><div class="stat-value">${r.k[2]} г</div><div class="stat-label">жиры</div></div>
        <div class="stat-tile"><div class="stat-value">${r.k[3]} г</div><div class="stat-label">углеводы</div></div>
      </div>`
    : '';

  const modal = openModal(`
    <div class="modal-head">
      <h2>${esc(r.name)}</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <div class="sub" style="margin-bottom:12px">${esc(r.cat)}${r.note ? ' · ' + esc(r.note) : ''}</div>
      ${kbju}
      <div class="group-title">Ингредиенты</div>
      <ul class="recipe-ing">${r.ing.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="group-title">Приготовление</div>
      <ol class="recipe-steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <button class="btn secondary" data-back style="margin-top:14px">← Ко всем рецептам</button>
    </div>
  `);
  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-back]', modal).addEventListener('click', () => openRecipes());
}

/* ---- База знаний ---- */

function openKnowledgeBase() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>База знаний</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      ${ARTICLES.map(a => `<div class="ex-item" data-id="${a.id}"><span>${a.icon} ${esc(a.title)}</span><span class="sub">›</span></div>`).join('')}
    </div>
  `);
  $('[data-close]', modal).addEventListener('click', closeModal);
  $$('.ex-item', modal).forEach(item => {
    item.addEventListener('click', () => {
      const a = ARTICLES.find(x => x.id === item.dataset.id);
      if (a) openArticle(a);
    });
  });
}

function openArticle(a) {
  const modal = openModal(`
    <div class="modal-head">
      <h2>${a.icon} ${esc(a.title)}</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body article">
      ${a.text.split('\n\n').map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
      <button class="btn secondary" data-back style="margin-top:12px">← Ко всем статьям</button>
    </div>
  `);
  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-back]', modal).addEventListener('click', openKnowledgeBase);
}

/* ---- Настройки ---- */

function openSettings() {
  const modal = openModal(`
    <div class="modal-head">
      <h2>Настройки</h2>
      <button class="icon-btn" data-close>✕</button>
    </div>
    <div class="modal-body">
      <div class="card">
        <label class="sub" style="display:block;margin-bottom:6px">Отдых между подходами: <b data-rest-val>${state.settings.restSec}</b> сек</label>
        <input type="range" min="30" max="300" step="15" value="${state.settings.restSec}" data-rest-range style="width:100%">
      </div>
      <div class="card">
        <p class="sub" style="margin-bottom:10px">Уведомление «Отдых окончен» приходит со звуком, а на заблокированном iPhone дублируется на <b>Apple Watch</b>. Работает в приложении, установленном на экран «Домой».</p>
        <button class="btn secondary" data-notif></button>
      </div>
      <div class="card">
        <p class="sub" style="margin-bottom:10px">Все данные хранятся только на этом телефоне. Сохраняй резервную копию, чтобы не потерять историю.</p>
        <div class="settings-row">
          <button class="btn secondary" data-export>Экспорт данных</button>
          <button class="btn secondary" data-import>Импорт</button>
        </div>
        <input type="file" data-import-file accept=".json" style="display:none">
      </div>
    </div>
  `);

  $('[data-close]', modal).addEventListener('click', closeModal);
  $('[data-rest-range]', modal).addEventListener('input', e => {
    state.settings.restSec = +e.target.value;
    $('[data-rest-val]', modal).textContent = e.target.value;
    save();
  });

  const notifBtn = $('[data-notif]', modal);
  function drawNotifBtn() {
    if (typeof Notification === 'undefined') {
      notifBtn.textContent = 'Уведомления недоступны в этом браузере';
      notifBtn.disabled = true;
    } else if (Notification.permission === 'granted') {
      notifBtn.textContent = '✓ Уведомления об отдыхе включены';
      notifBtn.disabled = true;
    } else if (Notification.permission === 'denied') {
      notifBtn.textContent = 'Запрещены — включи в настройках iPhone для этого приложения';
      notifBtn.disabled = true;
    } else {
      notifBtn.textContent = 'Включить уведомления об отдыхе';
      notifBtn.disabled = false;
    }
  }
  drawNotifBtn();
  notifBtn.addEventListener('click', async () => {
    const perm = await Notification.requestPermission();
    drawNotifBtn();
    if (perm === 'granted') toast('Уведомления включены 🔔');
  });
  $('[data-export]', modal).addEventListener('click', exportData);
  $('[data-import]', modal).addEventListener('click', () => $('[data-import-file]', modal).click());
  $('[data-import-file]', modal).addEventListener('change', importData);
}

/* ---------- Экспорт / импорт ---------- */

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `moyzal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Файл с данными сохранён');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.exercises) || !Array.isArray(data.workouts)) {
        throw new Error('bad format');
      }
      if (!confirm('Заменить текущие данные данными из файла?')) return;
      state = Object.assign(defaultState(), data);
      save();
      toast('Данные восстановлены');
      render();
    } catch (err) {
      toast('Не удалось прочитать файл');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ---------- PWA ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ---------- Старт ---------- */

render();
