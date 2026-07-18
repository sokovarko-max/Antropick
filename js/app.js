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
    settings: { restSec: 90 },
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.exercises)) return Object.assign(defaultState(), s);
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

  state.workouts.unshift({
    id: uid(),
    date: new Date().toISOString(),
    start: a.start,
    end: Date.now(),
    entries,
  });
  state.active = null;
  stopRestTimer();
  save();
  toast('Тренировка сохранена 💪');
  renderWorkout();
}

/* ---------- Таймер отдыха ---------- */

let restLeft = 0;
let restInterval = null;

function startRestTimer() {
  restLeft = state.settings.restSec;
  $('#rest-timer').classList.remove('hidden');
  updateRestUI();
  clearInterval(restInterval);
  restInterval = setInterval(() => {
    restLeft--;
    if (restLeft <= 0) {
      stopRestTimer();
      beep();
      vibrate([200, 100, 200]);
      toast('Отдых окончен — следующий подход!');
      return;
    }
    updateRestUI();
  }, 1000);
}

function stopRestTimer() {
  clearInterval(restInterval);
  restInterval = null;
  $('#rest-timer').classList.add('hidden');
}

function updateRestUI() {
  const m = Math.floor(restLeft / 60), s = restLeft % 60;
  $('#rest-time').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

$('#rest-plus').addEventListener('click', () => {
  restLeft += 15;
  updateRestUI();
});
$('#rest-skip').addEventListener('click', stopRestTimer);

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
  if (!state.workouts.length) {
    page.innerHTML = `<h1>История</h1>
      <div class="empty-state"><div class="big">📖</div><p>Здесь появятся твои тренировки.</p></div>`;
    return;
  }

  page.innerHTML = `<h1>История</h1>` + state.workouts.map(w => `
    <div class="card hist-card" data-id="${w.id}">
      <div class="hist-date">${esc(fmtDate(w.date))}</div>
      <div class="hist-meta">
        <span>⏱ ${fmtDuration(w.end - w.start)}</span>
        <span>🏋️ ${tonnage(w).toLocaleString('ru-RU')} кг</span>
        <span>✅ ${setCount(w)} подходов</span>
      </div>
      ${expanded.has(w.id) ? `
        <div class="hist-detail">
          ${workoutDetailHtml(w)}
          <button class="btn danger-outline" data-del style="margin-top:8px;padding:10px;font-size:14px">Удалить тренировку</button>
        </div>` : ''}
    </div>`).join('');

  $$('.hist-card', page).forEach(card => {
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
      <div class="stat-tile"><div class="stat-value">${(totalTonnage / 1000).toFixed(1)} т</div><div class="stat-label">поднято за всё время</div></div>
    </div>

    <h2>Рабочий вес</h2>
    ${usedExs.length ? `
      <select id="progress-ex">
        ${usedExs.map(e => `<option value="${e.id}" ${e.id === progressExId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
      </select>
      <div class="chart-wrap" id="ex-chart"></div>` : `
      <div class="card chart-empty">Заверши первую тренировку — здесь появится график лучшего веса по каждому упражнению.</div>`}

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
  }

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
  const pts = [];
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i];
    const best = bestWeight(w, progressExId);
    if (best > 0) pts.push({ label: fmtShortDate(w.date), y: best });
  }
  el.innerHTML = pts.length >= 2
    ? lineChart(pts, 'кг')
    : '<div class="card chart-empty">Нужно минимум две тренировки с этим упражнением.</div>';
  attachChartTooltip(el);
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
  const pad = { l: 40, r: 16, t: 18, b: 30 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

  let min = Math.min(...pts.map(p => p.y));
  let max = Math.max(...pts.map(p => p.y));
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  min -= range * 0.12; max += range * 0.12;

  const x = i => pad.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = v => pad.t + ih - ((v - min) / (max - min)) * ih;

  // сетка: 4 горизонтальные линии
  const gridLines = [];
  for (let g = 0; g <= 3; g++) {
    const v = min + ((max - min) / 3) * g;
    const yy = y(v);
    gridLines.push(`
      <line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${pad.l - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.round(v * 10) / 10}</text>`);
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
    <div class="ex-item" id="more-kb"><span>📚 База знаний<span class="sub"> · ${ARTICLES.length} статей</span></span><span class="sub">›</span></div>
    <div class="ex-item" id="more-settings"><span>⚙️ Настройки и резервная копия</span><span class="sub">›</span></div>
  `;
  $('#more-ex').addEventListener('click', openExerciseLibrary);
  $('#more-kbju').addEventListener('click', openKbjuCalc);
  $('#more-1rm').addEventListener('click', open1RmCalc);
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
