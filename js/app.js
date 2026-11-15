'use strict';
/* Интерфейс: экраны, формы и обработчики */

const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ACC = '#ff7a1a', BLUE = '#4ea8ff', GREEN = '#34d399';

const UI = { tab: 'home', seg: 'ex', logSeg: 'hist', progEx: null, metric: null, range: 90, open: {}, pick: { q: '', m: '', day: null } };
let deferredInstall = null;
let confirmCb = null;

/* ---------- базовые вещи ---------- */
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 3000);
}
function persist() {
  if (!save()) toast('Не удалось сохранить: память браузера недоступна');
}
function go(tab) { UI.tab = tab; render(); window.scrollTo(0, 0); enterAnim(); }

/* ---------- анимации ---------- */
const calmMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* Появление экрана: блоки поднимаются по очереди. Только при смене экрана, не при каждой перерисовке. */
function enterAnim() {
  const v = $('#view');
  v.classList.remove('enter');
  void v.offsetWidth;            // перезапуск анимации
  v.classList.add('enter');
  clearTimeout(enterAnim._t);
  enterAnim._t = setTimeout(() => v.classList.remove('enter'), 1200);
  countUp(v);
}
/* Числа в кольцах рейтинга набегают от нуля */
function countUp(root) {
  if (calmMotion()) return;
  root.querySelectorAll('.ring-num').forEach(el => {
    const to = parseInt(el.textContent, 10);
    if (!(to > 0)) return;
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 750);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
/* Салют при новом рекорде */
function celebrate() {
  if (calmMotion() || !document.body.animate) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  document.body.appendChild(box);
  const colors = [ACC, BLUE, GREEN, '#fbbf24', '#f472b6'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('i');
    p.style.background = colors[i % colors.length];
    p.style.left = (50 + (Math.random() - 0.5) * 30) + '%';
    box.appendChild(p);
    const dx = (Math.random() - 0.5) * 340, dy = -(140 + Math.random() * 260), rot = (Math.random() - 0.5) * 900;
    p.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + dx * 0.7 + 'px, ' + dy + 'px) rotate(' + rot * 0.5 + 'deg)', opacity: 1, offset: 0.35 },
      { transform: 'translate(' + dx + 'px, ' + (dy + 520) + 'px) rotate(' + rot + 'deg)', opacity: 0 }
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2, .6, .4, 1)', fill: 'forwards' });
  }
  setTimeout(() => box.remove(), 2500);
}

function openModal(html) {
  $('#modal-root').innerHTML = '<div class="backdrop" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true">' + html + '</div></div>';
  document.body.classList.add('noscroll');
  countUp($('#modal-root'));
}
/* Окно не исчезает мгновенно, а уезжает; если сразу открыть новое, оно просто заменит уходящее */
function closeModal() {
  const el = $('#modal-root').firstElementChild;
  if (el && !el.classList.contains('out')) {
    if (calmMotion()) el.remove();
    else {
      el.classList.add('out');
      setTimeout(() => { if (el.parentNode) el.remove(); }, 190);
    }
  }
  document.body.classList.remove('noscroll');
  confirmCb = null;
}
function modalOpen() {
  const el = $('#modal-root').firstElementChild;
  return !!el && !el.classList.contains('out');
}
function confirmBox(title, text, yes, cb, danger) {
  openModal('<h3>' + esc(title) + '</h3><p class="muted">' + esc(text) + '</p>' +
    '<div class="row-btns end"><button class="btn" data-act="closeModal">Отмена</button>' +
    '<button class="btn ' + (danger ? 'danger solid' : 'primary') + '" data-act="confirmYes">' + esc(yes) + '</button></div>');
  confirmCb = cb;
}

function render() {
  CHARTS = {};
  const views = { home: viewHome, log: viewLog, edit: viewEdit, progress: viewProgress, injuries: viewInjuries, profile: viewProfile };
  if (UI.tab === 'edit' && !S.draft) UI.tab = 'log';
  $('#view').innerHTML = views[UI.tab]();
  const navTab = UI.tab === 'edit' ? 'log' : UI.tab;
  document.querySelectorAll('#nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === navTab));
  mountCharts();
  if (UI.tab === 'edit') updRest();
}

/* ---------- Главная ---------- */
function ratingCard(label, rt, color) {
  return '<button class="card ring-card" data-act="openRating">' + ringSvg(rt.score, color) +
    '<span class="ring-txt"><b>' + label + '</b><span>' + levelName(rt.score) + '</span></span></button>';
}
function recCard(r) {
  const act = r.act ? ' data-act="' + r.act + '"' : r.go ? ' data-act="go" data-tab="' + r.go + '"' : '';
  return '<div class="card rec ' + r.k + '"' + act + (act ? ' role="button" tabindex="0"' : '') + '><b>' + esc(r.title) + '</b><p>' + esc(r.text) + '</p></div>';
}

function viewHome() {
  const t = todayStr();
  const sr = strengthRating(), er = enduranceRating();
  const ws = sortedWorkouts();
  const within = n => ws.filter(w => { const d = daysDiff(w.date, t); return d >= 0 && d < n; });
  const in7 = within(7), in30 = within(30);
  const ton7 = in7.reduce((s, w) => s + workoutVolume(w), 0);
  const recs = recommendations();
  const last = ws[ws.length - 1];
  const name = (S.profile.name || '').trim();
  return '<header class="top"><div><div class="muted">' + fmtDateLong(t) + '</div><h1>' + (name ? 'Привет, ' + esc(name) + '!' : 'Железо') + '</h1></div></header>' +
    '<button class="btn primary big" data-act="startWorkout">' + (S.draft ? 'Продолжить тренировку' : 'Начать тренировку') + '</button>' +
    todayPlanCard() +
    '<div class="grid2">' + ratingCard('Сила', sr, ACC) + ratingCard('Выносливость', er, BLUE) + '</div>' +
    '<div class="stats">' +
    '<div><b>' + in7.length + '</b><span>' + plural(in7.length, 'тренировка', 'тренировки', 'тренировок') + ' за 7 дней</span></div>' +
    '<div><b>' + in30.length + '</b><span>за 30 дней</span></div>' +
    '<div><b>' + fmtNum(ton7 / 1000, 1) + ' т</b><span>тоннаж за 7 дней</span></div></div>' +
    '<h2>Рекомендации</h2>' +
    (recs.length ? recs.map(recCard).join('') : '<div class="card muted">Замечаний нет — продолжайте в том же духе.</div>') +
    (last ? '<h2>Последняя тренировка</h2>' + workoutCard(last, true) : '');
}

/* ---------- Дневник ---------- */
function workoutCard(w, forceOpen) {
  const open = forceOpen || UI.open[w.id];
  const vol = workoutVolume(w), nsets = workoutSetCount(w);
  const exs = w.entries.filter(en => exById(en.exId));
  const id = esc(w.id);
  const day = w.dayId ? programDay(w.dayId) : null;
  const tag = w.test ? 'Проверка силы · ' : (day ? esc(dayTitle(day)) + ' · ' : '') + (MODES[w.mode] ? MODES[w.mode].name.toLowerCase() + ' · ' : '');
  let html = '<div class="card wk"><div class="wk-head"' + (forceOpen ? '' : ' data-act="toggleWk" data-id="' + id + '" role="button" tabindex="0"') + '>' +
    '<div><b>' + fmtDateLong(w.date) + '</b><div class="muted">' + tag + exs.length + ' ' + plural(exs.length, 'упражнение', 'упражнения', 'упражнений') +
    ' · ' + nsets + ' ' + plural(nsets, 'подход', 'подхода', 'подходов') + (vol ? ' · ' + fmtNum(vol, 0) + ' кг' : '') + '</div></div>' +
    (forceOpen ? '' : '<span class="chev' + (open ? ' up' : '') + '">›</span>') + '</div>';
  if (open) {
    html += '<div class="wk-body' + (UI.fresh === w.id ? ' fresh' : '') + '">' + (w.note ? '<p class="note">' + esc(w.note) + '</p>' : '');
    for (const en of exs) {
      const ex = exById(en.exId);
      const sets = (en.sets || []).filter(s => isValidSet(ex, s));
      html += '<div class="wk-ex"><span>' + esc(ex.name) + '</span><span class="muted">' + sets.map(s => setText(ex, s)).join(', ') + '</span></div>';
    }
    html += '<div class="row-btns">' + (w.test ? '<button class="btn small" data-act="testResult" data-id="' + id + '">Результат</button>'
      : '<button class="btn small" data-act="repeatWk" data-id="' + id + '">Повторить</button>') +
      '<button class="btn small" data-act="editWk" data-id="' + id + '">Изменить</button>' +
      '<button class="btn small danger" data-act="delWk" data-id="' + id + '">Удалить</button></div></div>';
  }
  return html + '</div>';
}

function viewLog() {
  const ws = sortedWorkouts().reverse();
  let html = '<header class="top"><h1>Дневник</h1></header>' +
    '<div class="seg">' + [['hist', 'История'], ['prog', 'Программа']].map(t => '<button class="' + (UI.logSeg === t[0] ? 'on' : '') + '" data-act="logSeg" data-seg="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
  if (UI.logSeg === 'prog') return html + viewProgram();
  html += '<button class="btn primary big mt" data-act="startWorkout">' + (S.draft ? 'Продолжить тренировку' : 'Новая тренировка') + '</button>';
  if (!ws.length) {
    return html + '<div class="card empty"><b>Здесь будет история тренировок</b><p class="muted">Начните первую тренировку или загрузите демо-данные в профиле, чтобы посмотреть, как всё выглядит.</p></div>';
  }
  let month = '';
  for (const w of ws) {
    const d = parseD(w.date);
    const m = MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear();
    if (m !== month) { month = m; html += '<h2>' + m + '</h2>'; }
    html += workoutCard(w, false);
  }
  return html;
}

/* ---------- Редактор тренировки ---------- */
const SET_FIELDS = {
  w: [['w', 'Вес, кг'], ['r', 'Повторы']],
  bw: [['w', 'Доп. вес, кг'], ['r', 'Повторы']],
  time: [['sec', 'Время, сек']],
  cardio: [['km', 'Дистанция, км'], ['min', 'Время, мин']]
};

function entryCard(en, i) {
  const ex = exById(en.exId);
  if (!ex) return '';
  const fields = SET_FIELDS[ex.type];
  const hint = exerciseHint(en.exId, S.draft.id, S.draft.test ? null : planFor(S.draft, ex));
  let html = '<div class="card entry"><div class="entry-head"><div><b>' + esc(ex.name) + '</b><div class="muted">' + (MUSCLES[ex.muscle] || '') + '</div></div>' +
    '<button class="x" data-act="delEntry" data-i="' + i + '" aria-label="Убрать упражнение">✕</button></div>';
  if (hint.injury) html += '<div class="hint inj l' + hint.injury.level + '">' + esc(hint.injury.text) + '</div>';
  if (hint.plan) html += '<div class="hint plan">' + esc(hint.plan) + '</div>';
  if (hint.last) html += '<div class="hint">' + esc(hint.last) + '</div>';
  if (hint.target && !S.draft.test) html += '<div class="hint target">' + esc(hint.target) + '</div>';
  html += '<div class="sets c' + fields.length + '"><div class="set head"><span>№</span>' + fields.map(f => '<span>' + f[1] + '</span>').join('') + '<span></span></div>';
  const prev = hint.lastSets;
  en.sets.forEach((s, j) => {
    const ps = prev.length ? prev[Math.min(j, prev.length - 1)] : null;   // прошлый результат — серой подсказкой
    html += '<div class="set' + (isValidSet(ex, s) ? ' done' : '') + '"><span class="n">' + (j + 1) + '</span>' +
      fields.map(f => '<input type="number" inputmode="decimal" step="any" min="0" aria-label="' + f[1] + '" data-set="' + i + ':' + j + ':' + f[0] + '" value="' + (s[f[0]] == null ? '' : s[f[0]]) + '" placeholder="' + (ps && ps[f[0]] ? ps[f[0]] : '') + '">').join('') +
      '<button class="x" data-act="delSet" data-i="' + i + '" data-j="' + j + '" aria-label="Удалить подход">✕</button></div>';
  });
  html += '</div><button class="btn small" data-act="addSet" data-i="' + i + '">＋ Подход</button></div>';
  return html;
}

function viewEdit() {
  const d = S.draft;
  const sug = MODES[d.mode] && !d.test ? MODES[d.mode].rest : 0;   // отдых, подходящий режиму
  return '<header class="top row"><h1>' + (d.id ? 'Изменение' : 'Тренировка') + '</h1><button class="btn small" data-act="cancelDraft">Отмена</button></header>' +
    '<div class="card form-grid"><label>Дата<input type="date" data-draft="date" value="' + esc(d.date) + '" max="' + todayStr() + '"></label>' +
    '<label>Заметка<input type="text" data-draft="note" value="' + esc(d.note || '') + '" placeholder="Самочувствие, сон, настроение"></label></div>' +
    draftModeCard(d) +
    '<div class="card rest"><span>Отдых</span><div class="chips">' + [60, 90, 120, 180].map(s => '<button' + (s === sug ? ' class="sug"' : '') + ' data-act="rest" data-sec="' + s + '">' + s + ' с</button>').join('') +
    '</div><b id="rest-out"></b><div class="rest-bar"><i id="rest-bar"></i></div></div>' +
    d.entries.map(entryCard).join('') +
    '<button class="btn dashed big" data-act="pickEx">＋ Добавить упражнение</button>' +
    '<div class="savebar"><button class="btn primary big" data-act="saveDraft">Сохранить тренировку</button></div>';
}

const REST = { end: 0, total: 0, int: null };
function updRest() {
  const el = $('#rest-out'), bar = $('#rest-bar');
  const left = Math.ceil((REST.end - Date.now()) / 1000);
  if (REST.end && left <= 0) {
    clearInterval(REST.int); REST.end = 0;
    if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
    toast('Отдых закончен — следующий подход');
    const card = $('.rest');
    if (card) { card.classList.remove('ping'); void card.offsetWidth; card.classList.add('ping'); }
  }
  if (el) el.textContent = REST.end ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : '';
  if (bar) bar.style.width = REST.end && REST.total ? Math.max(0, Math.min(100, (REST.end - Date.now()) / REST.total * 100)) + '%' : '0%';
}

/* ---------- Выбор упражнения ---------- */
/* day — номер дня программы, если упражнение добавляют в программу, а не в тренировку */
function openPicker(day) {
  UI.pick = { q: '', m: '', day: day == null ? null : day };
  openModal('<div class="sheet-head"><h3>' + (day == null ? 'Упражнение' : 'Упражнения в программу') + '</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<input id="pick-q" type="search" placeholder="Поиск по названию" autocomplete="off">' +
    '<div class="chips scroll" id="pick-m"></div><div id="pick-list" class="list"></div>' +
    (day == null ? '<button class="btn" data-act="newExForm">＋ Своё упражнение</button>'
      : '<div class="row-btns"><button class="btn" data-act="newExForm">＋ Своё упражнение</button><button class="btn primary" data-act="closeModal">Готово</button></div>'));
  renderPickList();
}
function renderPickList() {
  const box = $('#pick-list'), chips = $('#pick-m');
  if (!box) return;
  const q = UI.pick.q.trim().toLowerCase(), m = UI.pick.m;
  chips.innerHTML = '<button class="' + (m ? '' : 'on') + '" data-act="pickMuscle" data-m="">Все</button>' +
    Object.keys(MUSCLES).map(k => '<button class="' + (m === k ? 'on' : '') + '" data-act="pickMuscle" data-m="' + k + '">' + MUSCLES[k] + '</button>').join('');
  const item = e => {
    const v = injuryVerdict(e);
    const badge = v.level === 3 ? '<span class="badge bad">исключить</span>' : v.level === 2 ? '<span class="badge warn">−' + v.pct + ' %</span>' : v.level === 1 ? '<span class="badge care">осторожно</span>' : '';
    return '<button class="pick" data-act="addEx" data-id="' + esc(e.id) + '"><span><b>' + esc(e.name) + '</b><small>' + (MUSCLES[e.muscle] || '') + (e.custom ? ' · своё' : '') + '</small></span>' + badge + '</button>';
  };
  const list = allExercises().filter(e => (!m || e.muscle === m) && (!q || e.name.toLowerCase().includes(q)));
  const recent = (!q && !m) ? usedExerciseIds().slice(0, 6).map(exById).filter(Boolean) : [];
  let html = '';
  if (recent.length) html += '<div class="list-h">Частые</div>' + recent.map(item).join('') + '<div class="list-h">Все упражнения</div>';
  html += list.length ? list.map(item).join('') : '<div class="muted pad">Ничего не найдено. Создайте своё упражнение кнопкой ниже.</div>';
  box.innerHTML = html;
}
function openCustomExForm() {
  const name = UI.pick.q.trim();
  const toProg = UI.pick.day != null;
  openModal('<div class="sheet-head"><h3>Своё упражнение</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<label>Название<input id="cx-name" type="text" maxlength="60" value="' + esc(name) + '"></label>' +
    '<div class="form-grid"><label>Группа мышц<select id="cx-muscle">' + Object.keys(MUSCLES).map(k => '<option value="' + k + '">' + MUSCLES[k] + '</option>').join('') + '</select></label>' +
    '<label>Как считать<select id="cx-type">' + Object.keys(TYPES).map(k => '<option value="' + k + '">' + TYPES[k] + '</option>').join('') + '</select></label></div>' +
    '<div class="lbl">Какие зоны нагружает (нужно для советов при травмах)</div>' +
    '<div class="checks">' + Object.keys(AREAS).map(k => '<label><input type="checkbox" name="cx-area" value="' + k + '"><span>' + AREAS[k] + '</span></label>').join('') + '</div>' +
    '<button class="btn primary big" data-act="saveCustomEx">' + (toProg ? 'Создать и добавить в программу' : 'Создать и добавить') + '</button>');
}

/* ---------- Прогресс ---------- */
const METRICS = {
  w: [['best1rm', 'Расчётный 1ПМ', 'кг'], ['maxW', 'Макс. вес', 'кг'], ['volume', 'Тоннаж', 'кг'], ['maxReps', 'Макс. повторов', '']],
  bw: [['maxReps', 'Макс. повторов', ''], ['reps', 'Всего повторов', ''], ['maxW', 'Доп. вес', 'кг']],
  time: [['maxSec', 'Лучшее время', 'сек'], ['sec', 'Суммарно', 'сек']],
  cardio: [['km', 'Дистанция', 'км'], ['speed', 'Скорость', 'км/ч'], ['min', 'Время', 'мин']]
};
const RANGES = [[30, '1 мес'], [90, '3 мес'], [180, '6 мес'], [365, 'Год'], [0, 'Всё']];

function viewProgress() {
  const tabs = [['ex', 'Упражнения'], ['rating', 'Рейтинг'], ['volume', 'Объём']];
  return '<header class="top"><h1>Прогресс</h1></header>' +
    '<div class="seg">' + tabs.map(t => '<button class="' + (UI.seg === t[0] ? 'on' : '') + '" data-act="seg" data-seg="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
    (UI.seg === 'ex' ? progEx() : UI.seg === 'rating' ? progRating() : progVolume());
}

function progEx() {
  const ids = usedExerciseIds();
  if (!ids.length) return '<div class="card empty"><b>Графиков пока нет</b><p class="muted">Они появятся после первой записанной тренировки.</p></div>';
  if (!UI.progEx || !ids.includes(UI.progEx)) UI.progEx = ids[0];
  const ex = exById(UI.progEx);
  const ms = METRICS[ex.type];
  if (!ms.some(m => m[0] === UI.metric)) UI.metric = ms[0][0];
  const metric = ms.find(m => m[0] === UI.metric);
  const histAll = exHistory(ex.id);
  const from = UI.range ? addDays(todayStr(), -UI.range) : '0000-00-00';
  const hist = histAll.filter(h => h.date >= from);
  const val = h => Math.round(h.st[metric[0]] * 10) / 10;
  const pts = hist.map(h => ({ x: h.date, y: val(h) })).filter(p => p.y > 0);
  CHARTS.ex = { type: 'line', series: [{ name: metric[1], color: ACC, pts }], unit: metric[2], empty: 'За этот период записей нет' };

  const groups = {};
  for (const id of ids) { const e = exById(id); (groups[e.muscle] = groups[e.muscle] || []).push(e); }
  let options = '';
  for (const m of Object.keys(MUSCLES)) {
    if (!groups[m]) continue;
    options += '<optgroup label="' + MUSCLES[m] + '">' + groups[m].map(e => '<option value="' + esc(e.id) + '"' + (e.id === ex.id ? ' selected' : '') + '>' + esc(e.name) + '</option>').join('') + '</optgroup>';
  }
  const record = Math.max.apply(null, histAll.map(val));
  let change = '—';
  if (pts.length >= 2 && pts[0].y > 0) {
    const pct = (pts[pts.length - 1].y - pts[0].y) / pts[0].y * 100;
    change = (pct > 0 ? '+' : '') + fmtNum(pct, 1) + ' %';
  }
  const unit = metric[2] ? ' ' + metric[2] : '';
  let rows = '';
  for (const h of hist.slice().reverse().slice(0, 10)) {
    rows += '<div class="wk-ex"><span>' + fmtDate(h.date) + '</span><span class="muted">' + h.sets.map(s => setText(ex, s)).join(', ') + '</span></div>';
  }
  return '<div class="card"><label>Упражнение<select data-ui="progEx">' + options + '</select></label>' +
    '<div class="chips">' + ms.map(m => '<button class="' + (m[0] === UI.metric ? 'on' : '') + '" data-act="metric" data-m="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
    '<div class="chart" data-chart="ex"></div>' +
    '<div class="chips">' + RANGES.map(r => '<button class="' + (UI.range === r[0] ? 'on' : '') + '" data-act="range" data-r="' + r[0] + '">' + r[1] + '</button>').join('') + '</div></div>' +
    '<div class="stats"><div><b>' + fmtNum(record, 1) + unit + '</b><span>рекорд</span></div>' +
    '<div><b>' + change + '</b><span>за период</span></div>' +
    '<div><b>' + hist.length + '</b><span>' + plural(hist.length, 'тренировка', 'тренировки', 'тренировок') + '</span></div></div>' +
    (rows ? '<h2>Последние записи</h2><div class="card">' + rows + '</div>' : '');
}

function ratingBars(items, color, valText, nextText) {
  return items.map(it => {
    let sub = '';
    if (!it.has) sub = '<div class="bar-sub">' + esc(it.test ? 'Чтобы учесть: ' + it.test : 'Запишите это упражнение, чтобы оно попало в рейтинг') + '</div>';
    else if (it.next) sub = '<div class="bar-sub">До уровня «' + it.next.level + '»: ' + nextText(it) + '</div>';
    return '<div class="bar-row"><div class="bar-top"><span>' + it.name + '</span><span class="muted">' + (it.has ? valText(it) : 'нет данных') + '</span></div>' +
      '<div class="bar"><i style="width:' + (it.has ? Math.max(3, it.score) : 0) + '%;background:' + color + '"></i></div>' + sub + '</div>';
  }).join('');
}

function progRating() {
  const sr = strengthRating(), er = enduranceRating(), h = ratingHistory();
  CHARTS.rating = { type: 'line', series: [{ name: 'Сила', color: ACC, pts: h.str }, { name: 'Выносливость', color: BLUE, pts: h.end }], unit: '', empty: 'График появится после нескольких тренировок' };
  const noBW = !currentBW();
  return (noBW ? '<div class="card rec info" data-act="go" data-tab="profile" role="button" tabindex="0"><b>Нужен вес тела</b><p>Рейтинг силы считается относительно веса тела — укажите его в профиле.</p></div>' : '') +
    '<div class="card"><div class="rating-head">' + ringSvg(sr.score, ACC) + '<div><h3>Сила</h3><div class="lvl">' + levelName(sr.score) + '</div>' +
    '<p class="muted">Среднее по базовым движениям: расчётный максимум на 1 повтор относительно веса тела.</p></div></div>' +
    ratingBars(sr.items, ACC,
      it => (it.key === 'pullup' ? '' : fmtNum(it.e1rm, 0) + ' кг · ') + '×' + fmtNum(it.ratio, 2) + ' веса тела · ' + levelName(it.score),
      it => it.key === 'pullup' ? it.next.reps + ' ' + plural(it.next.reps, 'повтор', 'повтора', 'повторов') + ' без отягощения' : '1ПМ ' + fmtNum(it.next.e1rm, 0) + ' кг') +
    '<div class="row-btns"><button class="btn small" data-act="openTest">Пройти проверку силы</button></div></div>' +
    '<div class="card"><div class="rating-head">' + ringSvg(er.score, BLUE) + '<div><h3>Выносливость</h3><div class="lvl">' + levelName(er.score) + '</div>' +
    '<p class="muted">Повторы со своим весом, планка, бег, объём кардио и силовой работы за неделю.</p></div></div>' +
    ratingBars(er.items, BLUE,
      it => fmtNum(it.value, 1) + ' ' + it.unit + ' · ' + levelName(it.score),
      it => fmtNum(it.next.value, 1) + ' ' + it.unit) + '</div>' +
    '<h2>Как менялся рейтинг</h2><div class="card"><div class="chart" data-chart="rating"></div></div>' +
    '<details class="card"><summary>Как это считается</summary>' +
    '<p>Каждый показатель переводится в баллы от 0 до 100 по нормативам для вашего пола. Каждые 20 баллов — новый уровень: ' + LEVELS.slice(1).join(' → ') + '.</p>' +
    '<p>Расчётный максимум (1ПМ) считается по формуле Эпли: вес × (1 + повторы / 30). В зачёт идёт лучший результат за последние ' + RATING_WINDOW + ' дней, поэтому после долгого перерыва рейтинг снижается.</p>' +
    '<p>После 40 лет нормативы смягчаются на 1 % за каждый год. Нормативы — усреднённые ориентиры для любителей, а не спортивные разряды.</p></details>';
}

function progVolume() {
  const weeks = weeklyStats(12);
  const lbl = s => { const d = parseD(s); return d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0'); };
  CHARTS.vol = { type: 'bar', color: ACC, unit: 'кг', empty: 'Нет силовых тренировок за 12 недель',
    bars: weeks.map(w => ({ label: lbl(w.start), y: Math.round(w.volume), tip: 'неделя с ' + fmtDate(w.start) })) };
  CHARTS.freq = { type: 'bar', color: BLUE, unit: '', height: 170, empty: 'Нет тренировок за 12 недель',
    bars: weeks.map(w => ({ label: lbl(w.start), y: w.workouts, tip: 'тренировок, неделя с ' + fmtDate(w.start) })) };
  const ms = muscleSets(28);
  const keys = Object.keys(ms).filter(k => ms[k] > 0).sort((a, b) => ms[b] - ms[a]);
  const max = keys.length ? ms[keys[0]] : 1;
  const balance = keys.length ? keys.map(k => '<div class="bar-row"><div class="bar-top"><span>' + (MUSCLES[k] || k) + '</span><span class="muted">' + ms[k] + ' ' + plural(ms[k], 'подход', 'подхода', 'подходов') + '</span></div>' +
    '<div class="bar"><i style="width:' + (100 * ms[k] / max) + '%;background:' + GREEN + '"></i></div></div>').join('') : '<p class="muted">За последние 4 недели тренировок нет.</p>';
  return '<h2>Тоннаж по неделям</h2><div class="card"><div class="chart" data-chart="vol"></div><p class="muted small">Сумма «вес × повторы» по всем силовым упражнениям.</p></div>' +
    '<h2>Тренировок в неделю</h2><div class="card"><div class="chart" data-chart="freq"></div></div>' +
    '<h2>Нагрузка по группам за 4 недели</h2><div class="card">' + balance + '</div>';
}

/* ---------- Травмы ---------- */
function exNames(list) { return list.map(e => esc(e.name)).join(', '); }

function injuryCard(inj) {
  const id = esc(inj.id);
  const days = Math.max(0, daysDiff(inj.date, todayStr()));
  const sev = SEVERITY[inj.severity] || SEVERITY[1];
  const stage = injuryStage(inj), plan = injuryPlan(inj), info = AREA_INFO[inj.area] || { tips: [], red: '' };
  const pains = (inj.pain || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const today = pains.find(p => p.date === todayStr());
  let chart = '';
  if (pains.length >= 2) {
    CHARTS['pain_' + inj.id] = { type: 'line', zero: true, height: 150, unit: '/ 10', series: [{ name: 'Боль', color: '#f87171', pts: pains.map(p => ({ x: p.date, y: p.level })) }] };
    chart = '<div class="chart" data-chart="pain_' + id + '"></div>';
  }
  let pain = '<div class="lbl">Боль сегодня: 0 — нет, 10 — невыносимая</div><div class="pain">';
  for (let n = 0; n <= 10; n++) pain += '<button class="' + (today && today.level === n ? 'on' : '') + '" data-act="pain" data-id="' + id + '" data-v="' + n + '">' + n + '</button>';
  pain += '</div>';
  return '<div class="card inj-card s' + inj.severity + '"><div class="entry-head"><div><h3>' + esc(injuryTitle(inj)) + '</h3>' +
    '<div class="muted">с ' + fmtDate(inj.date) + ' · ' + days + ' ' + plural(days, 'день', 'дня', 'дней') + '</div></div><span class="badge sev' + inj.severity + '">' + sev.name + '</span></div>' +
    (inj.note ? '<p class="note">' + esc(inj.note) + '</p>' : '') +
    '<div class="rec ' + stage.k + ' inner"><b>' + stage.title + '</b><p>' + esc(stage.text) + '</p></div>' +
    pain + chart +
    '<details open><summary>Что делать</summary><ul>' + info.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    (info.red ? '<p class="red-flag">' + esc(info.red) + '</p>' : '') + '</details>' +
    (plan.avoid.length ? '<details><summary>Исключить · ' + plan.avoid.length + '</summary><p>' + exNames(plan.avoid) + '</p></details>' : '') +
    (plan.reduce.length ? '<details><summary>Снизить вес на ' + plan.pct + ' % · ' + plan.reduce.length + '</summary><p>' + exNames(plan.reduce) + '</p><p class="muted">Лёгкий вес, 12–15 повторов, медленное опускание. Появилась боль — подход закончен.</p></details>' : '') +
    (plan.care.length ? '<details><summary>С осторожностью · ' + plan.care.length + '</summary><p>' + exNames(plan.care) + '</p></details>' : '') +
    (plan.alts.length ? '<details><summary>Чем заменить</summary>' + plan.alts.map(a => '<p><b>' + MUSCLES[a.muscle] + ':</b> ' + exNames(a.list) + '</p>').join('') + '</details>' : '') +
    '<div class="row-btns"><button class="btn small good" data-act="healInjury" data-id="' + id + '">Зажило</button>' +
    '<button class="btn small" data-act="editInjury" data-id="' + id + '">Изменить</button>' +
    '<button class="btn small danger" data-act="delInjury" data-id="' + id + '">Удалить</button></div></div>';
}

function viewInjuries() {
  const act = activeInjuries();
  const old = S.injuries.filter(i => i.status !== 'active').sort((a, b) => b.date.localeCompare(a.date));
  let html = '<header class="top"><h1>Травмы</h1></header>' +
    '<button class="btn primary big" data-act="newInjury">＋ Добавить травму</button>';
  if (!act.length) {
    html += '<div class="card empty"><b>Активных травм нет</b><p class="muted">Если что-то заболит — добавьте сюда. Приложение пометит опасные упражнения, предложит замены и подскажет, когда возвращать нагрузку.</p></div>';
  }
  html += act.map(injuryCard).join('');
  if (old.length) {
    html += '<h2>История</h2>';
    for (const inj of old) {
      const id = esc(inj.id);
      html += '<div class="card wk-ex old-inj"><span><b>' + esc(injuryTitle(inj)) + '</b><br><span class="muted">' + fmtDate(inj.date, true) + (inj.endDate ? ' — ' + fmtDate(inj.endDate, true) : '') + '</span></span>' +
        '<span class="row-btns"><button class="btn small" data-act="reopenInjury" data-id="' + id + '">Снова болит</button><button class="btn small danger" data-act="delInjury" data-id="' + id + '">Удалить</button></span></div>';
    }
  }
  return html + '<p class="disclaimer">Советы носят общий характер и не заменяют осмотр врача. При острой боли, отёке или онемении прекратите тренировку и обратитесь к специалисту.</p>';
}

function openInjuryForm(id) {
  const inj = id ? S.injuries.find(i => i.id === id) : null;
  const sev = inj ? +inj.severity : 2;
  openModal('<div class="sheet-head"><h3>' + (inj ? 'Изменить травму' : 'Новая травма') + '</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<div class="form-grid"><label>Что болит<select id="inj-area">' + Object.keys(AREAS).map(k => '<option value="' + k + '"' + (inj && inj.area === k ? ' selected' : '') + '>' + AREAS[k] + '</option>').join('') + '</select></label>' +
    '<label>Сторона<select id="inj-side">' + [['', 'не важно'], ['l', 'слева'], ['r', 'справа'], ['b', 'с обеих сторон']].map(o => '<option value="' + o[0] + '"' + (inj && inj.side === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label></div>' +
    '<div class="lbl">Тяжесть</div><div class="radio">' + [1, 2, 3].map(n => '<label><input type="radio" name="inj-sev" value="' + n + '"' + (sev === n ? ' checked' : '') + '><span><b>' + SEVERITY[n].name + '</b><small>' + SEVERITY[n].desc + '</small></span></label>').join('') + '</div>' +
    '<label>Когда началось<input type="date" id="inj-date" value="' + esc(inj ? inj.date : todayStr()) + '" max="' + todayStr() + '"></label>' +
    '<label>Заметка<textarea id="inj-note" rows="2" maxlength="300" placeholder="Как получена, что провоцирует боль">' + esc(inj ? inj.note : '') + '</textarea></label>' +
    '<button class="btn primary big" data-act="saveInjury" data-id="' + (inj ? esc(inj.id) : '') + '">Сохранить</button>');
}

/* ---------- Профиль ---------- */
function bmiHtml() {
  const bw = currentBW(), h = +S.profile.height;
  if (!bw || !h) return '<span class="muted">Укажите рост и вес — посчитаю индекс массы тела.</span>';
  const bmi = bw / Math.pow(h / 100, 2);
  const cat = bmi < 18.5 ? 'ниже нормы' : bmi < 25 ? 'норма' : bmi < 30 ? 'выше нормы' : 'значительно выше нормы';
  return 'ИМТ <b>' + fmtNum(bmi, 1) + '</b> — ' + cat + '. <span class="muted">У людей с развитой мускулатурой ИМТ завышает оценку.</span>';
}

function viewProfile() {
  const p = S.profile;
  const ws = sortedWeights();
  CHARTS.bw = { type: 'line', unit: 'кг', series: [{ name: 'Вес', color: GREEN, pts: ws.map(w => ({ x: w.date, y: w.kg })) }], empty: 'Добавьте вес, чтобы увидеть график' };
  const lastW = ws.slice().reverse().slice(0, 5);
  const online = location.protocol.indexOf('http') === 0;
  let install;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) install = '<p class="muted">Приложение уже установлено на это устройство.</p>';
  else if (deferredInstall) install = '<button class="btn primary" data-act="install">Установить приложение</button>';
  else if (online) install = '<p class="muted">Android: меню браузера Chrome (⋮) → «Добавить на главный экран». ПК: значок установки в адресной строке Chrome или Edge.</p>';
  else install = '<p class="muted">Сейчас приложение открыто как файл. Чтобы установить его на телефон, страницу нужно разместить в интернете — это бесплатно и делается один раз.</p>';
  return '<header class="top"><h1>Профиль</h1></header>' +
    '<div class="card"><div class="form-grid"><label>Имя<input type="text" data-profile="name" maxlength="30" value="' + esc(p.name) + '"></label>' +
    '<label>Пол<select data-profile="sex"><option value="m"' + (p.sex !== 'f' ? ' selected' : '') + '>Мужской</option><option value="f"' + (p.sex === 'f' ? ' selected' : '') + '>Женский</option></select></label>' +
    '<label>Год рождения<input type="number" inputmode="numeric" data-profile="birthYear" min="1930" max="' + new Date().getFullYear() + '" value="' + (p.birthYear || '') + '"></label>' +
    '<label>Рост, см<input type="number" inputmode="numeric" data-profile="height" min="100" max="250" value="' + (p.height || '') + '"></label></div>' +
    '<p id="bmi" class="small">' + bmiHtml() + '</p></div>' +
    startCardHtml() + testCardHtml() + progressTableHtml() +
    '<h2>Вес тела</h2><div class="card"><div class="form-grid three"><label>Вес, кг<input type="number" inputmode="decimal" step="0.1" min="30" max="300" id="w-kg" placeholder="' + (currentBW() || '80') + '"></label>' +
    '<label>Дата<input type="date" id="w-date" value="' + todayStr() + '" max="' + todayStr() + '"></label>' +
    '<button class="btn primary" data-act="addWeight">Записать</button></div>' +
    '<div class="chart" data-chart="bw"></div>' +
    lastW.map(w => '<div class="wk-ex"><span>' + fmtDate(w.date, true) + '</span><span><b>' + fmtNum(w.kg, 1) + ' кг</b> <button class="x" data-act="delWeight" data-date="' + esc(w.date) + '" aria-label="Удалить запись">✕</button></span></div>').join('') + '</div>' +
    '<h2>Установка</h2><div class="card">' + install + '</div>' +
    '<h2>Данные</h2><div class="card"><p class="muted">Всё хранится только на этом устройстве. Чтобы перенести записи с телефона на ПК или обратно, сохраните копию и загрузите её на другом устройстве.</p>' +
    '<div class="row-btns"><button class="btn" data-act="export">Сохранить копию</button><button class="btn" data-act="import">Загрузить копию</button>' +
    '<button class="btn" data-act="demo">Демо-данные</button><button class="btn danger" data-act="wipe">Стереть всё</button></div>' +
    '<input type="file" id="imp" accept="application/json,.json" hidden></div>';
}

/* ---------- экспорт / импорт ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(Object.assign({}, S, { draft: null }), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zhelezo-' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function sanitizeImport(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.workouts)) return null;
  const st = normalizeState(obj);
  st.draft = null;
  st.workouts = st.workouts.filter(w => w && DATE_RE.test(w.date) && Array.isArray(w.entries)).map(w => {
    const o = {
      id: String(w.id || uid()), date: w.date, note: String(w.note || ''),
      entries: w.entries.filter(en => en && Array.isArray(en.sets)).map(en => ({ exId: String(en.exId), sets: en.sets.filter(s => s && typeof s === 'object') }))
    };
    if (w.dayId) o.dayId = String(w.dayId);
    if (MODES[w.mode]) o.mode = w.mode;
    if (w.test) o.test = true;
    return o;
  });
  st.measures = st.measures.filter(m => m && DATE_RE.test(m.date)).map(m => {
    const o = { date: m.date };
    for (const k of Object.keys(GIRTHS)) if (+m[k] > 0) o[k] = +m[k];
    return o;
  });
  if (!DATE_RE.test(st.profile.startDate || '')) st.profile.startDate = null;
  if (!EXPERIENCE[st.profile.exp]) st.profile.exp = '';
  st.weights = st.weights.filter(w => w && DATE_RE.test(w.date) && +w.kg > 0).map(w => ({ date: w.date, kg: +w.kg }));
  st.injuries = st.injuries.filter(i => i && DATE_RE.test(i.date) && AREAS[i.area]).map(i => Object.assign({}, i, {
    id: String(i.id || uid()), severity: Math.min(3, Math.max(1, +i.severity || 1)),
    pain: (Array.isArray(i.pain) ? i.pain : []).filter(p => p && DATE_RE.test(p.date)).map(p => ({ date: p.date, level: Math.min(10, Math.max(0, +p.level || 0)) }))
  }));
  st.customExercises = st.customExercises.filter(e => e && e.id && e.name && MUSCLES[e.muscle] && TYPES[e.type]).map(e => Object.assign({}, e, { id: String(e.id), name: String(e.name), custom: true, stress: e.stress && typeof e.stress === 'object' ? e.stress : {} }));
  return st;
}
function importFile(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let st = null;
    try { st = sanitizeImport(JSON.parse(fr.result)); } catch (e) { st = null; }
    if (!st) { toast('Это не похоже на копию данных приложения'); return; }
    confirmBox('Загрузить копию?', 'В файле ' + st.workouts.length + ' ' + plural(st.workouts.length, 'тренировка', 'тренировки', 'тренировок') + '. Текущие данные на этом устройстве будут заменены.', 'Заменить', () => {
      S = st; persist(); closeModal(); go('home'); toast('Данные загружены');
    });
  };
  fr.readAsText(file);
}

/* ---------- действия ---------- */
function blankSet(ex, prev) {
  const s = {};
  for (const f of SET_FIELDS[ex.type]) s[f[0]] = prev && prev[f[0]] != null ? prev[f[0]] : null;
  return s;
}
function cleanSet(ex, s) {
  if (ex.type === 'w' || ex.type === 'bw') return { w: +s.w || 0, r: Math.round(+s.r) };
  if (ex.type === 'time') return { sec: +s.sec };
  return { km: +s.km || 0, min: +s.min || 0 };
}
function startDraft(d) {
  const begin = () => { S.draft = d; persist(); closeModal(); go('edit'); };
  if (S.draft && S.draft.entries.length) confirmBox('Заменить текущую тренировку?', 'У вас есть несохранённая тренировка. Она будет удалена.', 'Заменить', begin, true);
  else begin();
}
/* Новое упражнение в тренировке: столько пустых подходов, сколько задаёт план */
function addDraftEntry(ex) {
  const d = S.draft, en = { exId: ex.id, sets: [] };
  d.entries.push(en);
  const p = d.test ? null : planFor(d, ex);
  en.sets = Array.from({ length: p ? p.sets : 1 }, () => blankSet(ex));
}
function findWorkout(id) { return S.workouts.find(w => String(w.id) === id); }
function findInjury(id) { return S.injuries.find(i => String(i.id) === id); }

const ACT = {
  go: el => go(el.dataset.tab),
  closeModal: () => closeModal(),
  confirmYes: () => { const cb = confirmCb; if (cb) cb(); },
  openRating: () => { UI.seg = 'rating'; go('progress'); },
  seg: el => { UI.seg = el.dataset.seg; render(); enterAnim(); },
  metric: el => { UI.metric = el.dataset.m; render(); },
  range: el => { UI.range = +el.dataset.r; render(); },

  startWorkout: () => {
    if (S.draft) { go('edit'); return; }
    if (filledDays().length) { openStartChooser(); return; }   // есть программа — спрашиваем, какой день
    S.draft = { id: null, date: todayStr(), note: '', entries: [] };
    persist(); go('edit');
  },
  cancelDraft: () => {
    const drop = () => { S.draft = null; persist(); closeModal(); go('log'); };
    if (S.draft && S.draft.entries.length) confirmBox('Отменить тренировку?', 'Введённые подходы не сохранятся.', 'Не сохранять', drop, true);
    else drop();
  },
  pickEx: () => openPicker(),
  pickMuscle: el => { UI.pick.m = el.dataset.m; renderPickList(); },
  newExForm: () => openCustomExForm(),
  addEx: el => {
    const ex = exById(el.dataset.id);
    if (!ex) return;
    if (UI.pick.day != null) {   // добавляем в день программы; окно остаётся открытым, чтобы набрать несколько
      const day = S.program && S.program.days[UI.pick.day];
      if (!day) return;
      if (day.items.some(it => it.exId === ex.id)) { toast('Уже есть в этом дне: ' + ex.name); return; }
      if (day.items.length >= 30) { toast('В одном дне может быть не больше 30 упражнений'); return; }
      day.items.push(Object.assign({ exId: ex.id }, modeDefaults(ex, day.mode)));
      persist(); render(); toast('Добавлено: ' + ex.name);
      return;
    }
    if (!S.draft) return;
    addDraftEntry(ex);
    persist(); closeModal(); render();
    const cards = document.querySelectorAll('.entry');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ block: 'center' });
  },
  saveCustomEx: () => {
    const name = $('#cx-name').value.trim();
    if (!name) { toast('Введите название'); return; }
    const stress = {};
    document.querySelectorAll('input[name="cx-area"]:checked').forEach(c => { stress[c.value] = 2; });
    const ex = { id: 'c_' + uid(), name, muscle: $('#cx-muscle').value, type: $('#cx-type').value, stress, custom: true, bwf: 0.7 };
    S.customExercises.push(ex);
    const day = UI.pick.day != null && S.program ? S.program.days[UI.pick.day] : null;
    if (day) day.items.push(Object.assign({ exId: ex.id }, modeDefaults(ex, day.mode)));
    else if (S.draft && UI.pick.day == null) addDraftEntry(ex);
    persist(); closeModal(); render();
  },
  addSet: el => {
    const en = S.draft.entries[+el.dataset.i], ex = exById(en.exId);
    en.sets.push(blankSet(ex, en.sets[en.sets.length - 1]));
    persist(); render();
  },
  delSet: el => { S.draft.entries[+el.dataset.i].sets.splice(+el.dataset.j, 1); persist(); render(); },
  delEntry: el => { S.draft.entries.splice(+el.dataset.i, 1); persist(); render(); },
  rest: el => {
    clearInterval(REST.int);
    REST.total = (+el.dataset.sec) * 1000;
    REST.end = Date.now() + REST.total;
    REST.int = setInterval(updRest, 250);
    updRest();
  },
  saveDraft: () => {
    const d = S.draft, entries = [];
    for (const en of d.entries) {
      const ex = exById(en.exId);
      if (!ex) continue;
      const sets = en.sets.filter(s => isValidSet(ex, s)).map(s => cleanSet(ex, s));
      if (sets.length) entries.push({ exId: en.exId, sets });
    }
    if (!entries.length) { toast('Заполните хотя бы один подход'); return; }
    const date = DATE_RE.test(d.date) && d.date <= todayStr() ? d.date : todayStr();
    let w = d.id ? S.workouts.find(x => x.id === d.id) : null;
    if (w) { w.date = date; w.note = d.note || ''; w.entries = entries; }
    else { w = { id: uid(), date, note: d.note || '', entries }; S.workouts.push(w); }
    if (d.dayId) w.dayId = d.dayId; else delete w.dayId;
    if (MODES[d.mode] && !w.test) w.mode = d.mode; else delete w.mode;
    S.draft = null;
    persist();
    const prs = w.test ? [] : workoutPRs(w);
    UI.open = {}; UI.open[w.id] = true;
    UI.logSeg = 'hist';
    go('log');
    if (prs.length) celebrate();
    toast(prs.length ? 'Сохранено. Новый рекорд: ' + prs[0] + (prs.length > 1 ? ' и ещё ' + (prs.length - 1) : '') : 'Тренировка сохранена');
  },

  toggleWk: el => {
    UI.open[el.dataset.id] = !UI.open[el.dataset.id];
    UI.fresh = UI.open[el.dataset.id] ? el.dataset.id : null;   // раскрывается с анимацией только эта карточка
    render();
    UI.fresh = null;
  },
  repeatWk: el => {
    const w = findWorkout(el.dataset.id);
    if (!w) return;
    const d = { id: null, date: todayStr(), note: '', entries: JSON.parse(JSON.stringify(w.entries)) };
    if (w.dayId && programDay(w.dayId)) d.dayId = w.dayId;
    if (MODES[w.mode]) d.mode = w.mode;
    startDraft(d);
  },
  editWk: el => {
    const w = findWorkout(el.dataset.id);
    if (w) startDraft(JSON.parse(JSON.stringify(w)));
  },
  delWk: el => {
    const w = findWorkout(el.dataset.id);
    if (!w) return;
    confirmBox('Удалить тренировку?', fmtDateLong(w.date) + ' — запись исчезнет из истории и графиков.', 'Удалить', () => {
      S.workouts = S.workouts.filter(x => x !== w); persist(); closeModal(); render();
    }, true);
  },

  newInjury: () => openInjuryForm(null),
  editInjury: el => openInjuryForm(el.dataset.id),
  saveInjury: el => {
    const sevEl = $('input[name="inj-sev"]:checked');
    const date = $('#inj-date').value;
    const data = {
      area: $('#inj-area').value, side: $('#inj-side').value, severity: sevEl ? +sevEl.value : 2,
      date: DATE_RE.test(date) ? date : todayStr(), note: $('#inj-note').value.trim()
    };
    const inj = el.dataset.id ? findInjury(el.dataset.id) : null;
    if (inj) Object.assign(inj, data);
    else S.injuries.push(Object.assign({ id: uid(), status: 'active', endDate: null, pain: [] }, data));
    persist(); closeModal(); render();
    if (!inj) toast('Травма добавлена — опасные упражнения помечены');
  },
  pain: el => {
    const inj = findInjury(el.dataset.id);
    if (!inj) return;
    const t = todayStr();
    inj.pain = (inj.pain || []).filter(p => p.date !== t);
    inj.pain.push({ date: t, level: +el.dataset.v });
    persist(); render();
  },
  healInjury: el => {
    const inj = findInjury(el.dataset.id);
    if (!inj) return;
    inj.status = 'healed'; inj.endDate = todayStr();
    persist(); render();
    toast('Отлично! Возвращайте веса постепенно, за 2–3 тренировки');
  },
  reopenInjury: el => {
    const inj = findInjury(el.dataset.id);
    if (!inj) return;
    inj.status = 'active'; inj.endDate = null;
    persist(); render();
  },
  delInjury: el => {
    const inj = findInjury(el.dataset.id);
    if (!inj) return;
    confirmBox('Удалить запись о травме?', injuryTitle(inj) + ' — вместе с дневником боли.', 'Удалить', () => {
      S.injuries = S.injuries.filter(x => x !== inj); persist(); closeModal(); render();
    }, true);
  },

  addWeight: () => {
    const kg = parseFloat($('#w-kg').value), date = $('#w-date').value;
    if (!(kg >= 30 && kg <= 300)) { toast('Введите вес от 30 до 300 кг'); return; }
    if (!DATE_RE.test(date) || date > todayStr()) { toast('Проверьте дату'); return; }
    S.weights = S.weights.filter(w => w.date !== date);
    S.weights.push({ date, kg: Math.round(kg * 10) / 10 });
    persist(); render(); toast('Вес записан');
  },
  delWeight: el => { S.weights = S.weights.filter(w => w.date !== el.dataset.date); persist(); render(); },

  export: () => exportData(),
  import: () => $('#imp').click(),
  demo: () => {
    const load = () => { S = buildDemoState(); persist(); closeModal(); UI.progEx = null; go('home'); toast('Загружены демо-данные за 12 недель'); };
    if (S.workouts.length || S.weights.length) confirmBox('Загрузить демо-данные?', 'Текущие тренировки, программа, вес, замеры и травмы будут заменены примером. Сначала сохраните копию, если они нужны.', 'Заменить', load, true);
    else load();
  },
  wipe: () => confirmBox('Стереть все данные?', 'Тренировки, программа, вес, замеры, травмы и свои упражнения будут удалены с этого устройства без возможности восстановления.', 'Стереть', () => {
    S = defaultState(); persist(); closeModal(); UI.progEx = null; go('home'); toast('Данные удалены');
  }, true),
  install: () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall = null;
    render();
  }
};
Object.assign(ACT, PROG_ACT);   // программа, режимы, проверка силы, стартовые показатели

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (a === 'backdrop') { if (e.target === el) closeModal(); return; }
  if (ACT[a]) ACT[a](el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOpen()) { closeModal(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.set && S.draft) {
    const p = el.dataset.set.split(':');
    const en = S.draft.entries[+p[0]];
    if (!en || !en.sets[+p[1]]) return;
    const v = el.value === '' ? null : Number(el.value);
    en.sets[+p[1]][p[2]] = v == null || isNaN(v) || v < 0 ? null : v;
    persist();
    const row = el.closest('.set'), ex = exById(en.exId);   // заполненный подход отмечается зелёным
    if (row && ex) {
      const ok = isValidSet(ex, en.sets[+p[1]]);
      if (ok && !row.classList.contains('done')) row.classList.add('just');
      row.classList.toggle('done', ok);
    }
  } else if (el.dataset.draft && S.draft) {
    S.draft[el.dataset.draft] = el.value;
    persist();
  } else if (el.id === 'pick-q') {
    UI.pick.q = el.value;
    renderPickList();
  } else if (el.dataset.pitem && S.program) {
    // подходы и повторы в программе: сохраняем сразу, экран не перерисовываем, чтобы не сбить ввод
    const p = el.dataset.pitem.split(':');
    const day = S.program.days[+p[0]], it = day && day.items[+p[1]];
    if (!it || !['sets', 'rmin', 'rmax'].includes(p[2])) return;
    const v = el.value === '' ? NaN : Math.round(Number(el.value));
    it[p[2]] = v >= 1 && v <= 100 ? v : null;
    persist();
    refreshProgSum();
  } else if (el.dataset.pday != null && S.program) {
    const day = S.program.days[+el.dataset.pday];
    if (day) { day.name = el.value; persist(); }
  } else if (el.dataset.prog === 'name' && S.program) {
    S.program.name = el.value;
    persist();
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.profile) {
    const k = el.dataset.profile;
    let v = el.value;
    if (k === 'birthYear' || k === 'height') v = v === '' ? null : +v;
    S.profile[k] = v;
    persist();
    const b = $('#bmi');
    if (b) b.innerHTML = bmiHtml();
  } else if (el.dataset.prog === 'perWeek' && S.program) {
    S.program.perWeek = clampInt(el.value, 1, 7, 3);
    persist();
    refreshProgSum();
  } else if (el.dataset.ui) {
    UI[el.dataset.ui] = el.value;
    render();
  } else if (el.id === 'imp') {
    importFile(el.files[0]);
    el.value = '';
  }
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  if (UI.tab === 'profile') render();
});
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
enterAnim();
