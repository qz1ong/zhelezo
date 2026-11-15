'use strict';
/* Экраны: своя программа, режимы, проверка силы, стартовые показатели */

function modeBadge(mode) {
  return MODES[mode] ? '<span class="badge mode ' + mode + '">' + MODES[mode].name + '</span>' : '';
}

/* ---------- карточка «по программе» на главной ---------- */
function todayPlanCard() {
  const day = nextProgramDay();
  if (!day || S.draft) return '';
  const wp = weekProgress(), t = todayStr();
  const names = dayItems(day).map(it => exById(it.exId).name);
  const doneToday = S.workouts.some(w => w.date === t && !w.test);
  const head = doneToday ? 'Сегодня тренировка уже записана · дальше по программе'
    : wp.done >= wp.plan ? 'Недельный план выполнен · дальше по программе' : 'Сегодня по программе';
  return '<div class="card plan-today"><div class="muted small">' + head + ' · на этой неделе ' + wp.done + ' из ' + wp.plan + '</div>' +
    '<div class="plan-title"><b>' + esc(dayTitle(day)) + '</b>' + modeBadge(day.mode) + '</div>' +
    '<p class="muted small">' + esc(names.slice(0, 5).join(', ')) + (names.length > 5 ? ' и ещё ' + (names.length - 5) : '') + '</p>' +
    '<div class="row-btns"><button class="btn primary small" data-act="progStartDay" data-id="' + esc(day.id) + '">Начать этот день</button>' +
    '<button class="btn small" data-act="openProgram">Программа</button></div></div>';
}

/* ---------- редактор программы ---------- */
function progItemRow(di, it, j) {
  const ex = exById(it.exId);
  if (!ex) return '';
  const v = injuryVerdict(ex);
  const badge = v.level === 3 ? '<span class="badge bad">исключить</span>' : v.level === 2 ? '<span class="badge warn">−' + v.pct + ' %</span>' : '';
  const num = (f, lbl) => '<input type="number" inputmode="numeric" min="1" step="1" aria-label="' + lbl + '" data-pitem="' + di + ':' + j + ':' + f + '" value="' + (it[f] == null ? '' : +it[f]) + '">';
  let plan;
  if (ex.type === 'cardio') plan = '<span class="small">кардио: дистанция и время</span>';
  else if (ex.type === 'time') plan = num('sets', 'Подходы') + '<span class="small">подх. на время</span>';
  else plan = num('sets', 'Подходы') + '<span>×</span>' + num('rmin', 'Повторы от') + '<span>–</span>' + num('rmax', 'Повторы до');
  return '<div class="pitem"><div class="pitem-name"><b>' + esc(ex.name) + '</b>' + badge + '</div>' +
    '<div class="pitem-plan">' + plan + '</div><div class="pitem-btns">' +
    (j ? '<button class="x" data-act="progUp" data-d="' + di + '" data-j="' + j + '" aria-label="Поднять выше">↑</button>' : '') +
    '<button class="x" data-act="progDelItem" data-d="' + di + '" data-j="' + j + '" aria-label="Убрать из программы">✕</button></div></div>';
}

function progDayCard(day, di) {
  const items = day.items.map((it, j) => progItemRow(di, it, j)).join('');
  return '<div class="card pday"><div class="entry-head"><label class="grow">Название дня<input type="text" maxlength="40" data-pday="' + di + '" value="' + esc(day.name) + '" placeholder="День ' + (di + 1) + '"></label>' +
    '<button class="x" data-act="progDelDay" data-d="' + di + '" aria-label="Удалить день">✕</button></div>' +
    '<div class="lbl">Режим</div><div class="chips">' + Object.keys(MODES).map(k => '<button class="' + (day.mode === k ? 'on' : '') + '" data-act="progMode" data-d="' + di + '" data-m="' + k + '">' + MODES[k].name + '</button>').join('') + '</div>' +
    '<p class="muted small">' + MODES[day.mode].desc + '</p>' +
    (items ? '<div class="pitems"><div class="pitem-head muted">подходы × повторы от–до</div>' + items + '</div>' : '<p class="muted">Пока пусто — добавьте упражнения.</p>') +
    '<div class="row-btns"><button class="btn small" data-act="progAddEx" data-d="' + di + '">＋ Упражнение</button>' +
    (dayItems(day).length ? '<button class="btn small primary" data-act="progStartDay" data-id="' + esc(day.id) + '">Начать этот день</button>' : '') + '</div></div>';
}

function progSummaryHtml() {
  const ws = programWeekSets();
  const keys = Object.keys(ws).filter(k => ws[k] > 0).sort((a, b) => ws[b] - ws[a]);
  if (!keys.length) return '';
  const max = ws[keys[0]];
  const rem = programRemarks();
  return '<h2>Нагрузка за неделю по программе</h2><div class="card">' +
    keys.map(k => {
      const n = Math.round(ws[k]);
      return '<div class="bar-row"><div class="bar-top"><span>' + (MUSCLES[k] || k) + '</span><span class="muted">≈ ' + n + ' ' + plural(n, 'подход', 'подхода', 'подходов') + '</span></div>' +
        '<div class="bar"><i style="width:' + (100 * ws[k] / max) + '%;background:' + GREEN + '"></i></div></div>';
    }).join('') +
    '<p class="muted small">Дни идут по кругу, тренировок в неделю — ' + S.program.perWeek + '. Ориентир — 10–20 подходов на крупную группу.</p></div>' +
    '<h2>Замечания к программе</h2>' +
    (rem.length ? rem.map(r => recCard(Object.assign({}, r, { act: null }))).join('')
      : '<div class="card rec good"><b>Замечаний нет</b><p>Баланс групп мышц и недельный объём в порядке.</p></div>');
}
function refreshProgSum() {
  const el = $('#prog-sum');
  if (el) el.innerHTML = progSummaryHtml();
}

function viewProgram() {
  const p = S.program;
  if (!p) {
    return '<div class="card empty"><b>Своя программа</b><p class="muted">Впишите дни тренировок и упражнения, для каждого дня выберите режим — «Силовой», «На массу» или «Многоповторка». Приложение подставит подходы и повторы, подскажет рабочие веса и проверит баланс нагрузки.</p>' +
      '<button class="btn primary mt" data-act="progNew">Составить с нуля</button></div>' + templatesHtml();
  }
  return '<div class="card mt"><div class="form-grid"><label>Название<input type="text" maxlength="40" data-prog="name" value="' + esc(p.name) + '" placeholder="Моя программа"></label>' +
    '<label>Тренировок в неделю<select data-prog="perWeek">' + [1, 2, 3, 4, 5, 6, 7].map(n => '<option value="' + n + '"' + (p.perWeek === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div></div>' +
    p.days.map(progDayCard).join('') +
    '<button class="btn dashed big" data-act="progAddDay">＋ Добавить день</button>' +
    '<div id="prog-sum">' + progSummaryHtml() + '</div>' +
    '<div class="row-btns"><button class="btn danger small" data-act="progDelete">Удалить программу</button></div>';
}

/* ---------- режим в тренировке ---------- */
function draftModeCard(d) {
  if (d.test) return '<div class="card"><b>Проверка силы</b><p class="muted small">Вы меняете результаты проверки.</p></div>';
  const day = d.dayId ? programDay(d.dayId) : null;
  const m = MODES[d.mode];
  let note = m ? m.desc : 'Выберите режим — приложение подскажет вес и повторы под него.';
  if (m && d.mode === 'str') note += ' Изолирующие упражнения остаются на 8–12 повторов.';
  if (m && day && d.mode !== day.mode) note += ' Сегодня режим отличается от программы — повторы взяты по режиму.';
  return '<div class="card">' + (day ? '<div class="plan-title"><b>' + esc(dayTitle(day)) + '</b><span class="muted small">по программе</span></div>' : '') +
    '<div class="lbl">Режим тренировки</div><div class="chips">' +
    (day ? '' : '<button class="' + (m ? '' : 'on') + '" data-act="draftMode" data-m="">Без режима</button>') +
    Object.keys(MODES).map(k => '<button class="' + (d.mode === k ? 'on' : '') + '" data-act="draftMode" data-m="' + k + '">' + MODES[k].name + '</button>').join('') +
    '</div><p class="muted small">' + note + '</p></div>';
}
function draftFromDay(day) {
  const d = { id: null, date: todayStr(), note: '', dayId: day.id, mode: day.mode, entries: [] };
  for (const it of dayItems(day)) {
    const ex = exById(it.exId);
    d.entries.push({ exId: ex.id, sets: Array.from({ length: itemPlan(ex, it).sets }, () => blankSet(ex)) });
  }
  return d;
}
/* Под новый режим меняем число пустых подходов; заполненные не трогаем */
function fitSets(d) {
  for (const en of d.entries) {
    const ex = exById(en.exId);
    const p = ex ? planFor(d, ex) : null;
    if (!p || en.sets.some(s => Object.keys(s).some(k => s[k] != null))) continue;
    en.sets = Array.from({ length: p.sets }, () => blankSet(ex));
  }
}
function openStartChooser() {
  const next = nextProgramDay();
  openModal('<div class="sheet-head"><h3>Какая тренировка?</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    filledDays().map(d => {
      const n = dayItems(d).length;
      return '<button class="pick" data-act="progStartDay" data-id="' + esc(d.id) + '"><span><b>' + esc(dayTitle(d)) + '</b><small>' + MODES[d.mode].name + ' · ' + n + ' ' + plural(n, 'упражнение', 'упражнения', 'упражнений') + '</small></span>' +
        (d === next ? '<span class="badge care">по очереди</span>' : '') + '</button>';
    }).join('') +
    '<button class="btn" data-act="startFree">Свободная тренировка</button>');
}

/* ---------- проверка силы ---------- */
function openTestForm() {
  const bw = currentBW();
  let rows = '';
  for (const t of TEST_ITEMS) {
    const ex = exById(t.id), v = injuryVerdict(ex), name = KEY_NAMES[ex.key] || ex.name;
    const warn = v.level === 3 ? '<span class="badge bad">пропустите — травма</span>' : v.level === 2 ? '<span class="badge warn">осторожно — травма</span>' : '';
    const inp = (f, ph) => '<input type="number" inputmode="decimal" step="any" min="0" data-test="' + t.id + ':' + f + '" placeholder="' + ph + '" aria-label="' + name + ': ' + ph + '">';
    rows += '<div class="trow"><div class="trow-name"><b>' + name + '</b>' + warn + '</div><div class="trow-in">' +
      (t.kind === 'w' ? inp('w', 'вес, кг') + '<span>×</span>' + inp('r', 'повторы') : t.kind === 'r' ? inp('r', 'максимум повторов') : inp('sec', 'время, сек')) + '</div></div>';
  }
  openModal('<div class="sheet-head"><h3>Проверка силы</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<p class="muted small">Разомнитесь и сделайте по одному подходу с чистой техникой. Поднимать максимум на один раз не нужно: возьмите вес, который осилите на 3–8 повторов, — максимум приложение рассчитает само. Что не делаете — оставьте пустым. Результаты можно вписать и по памяти, поставив нужную дату.</p>' +
    '<div class="form-grid mt"><label>Дата<input type="date" id="t-date" value="' + todayStr() + '" max="' + todayStr() + '"></label>' +
    '<label>Вес тела в этот день, кг<input type="number" inputmode="decimal" step="0.1" min="30" max="300" id="t-bw" value="' + (bw || '') + '"></label></div>' +
    '<div class="trows mt">' + rows + '</div>' +
    '<button class="btn primary big" data-act="saveTest">Сохранить и посмотреть результат</button>');
}

function openTestResult(id) {
  const w = findWorkout(id);
  if (!w) return;
  const sm = testSummary(w);
  const delta = r => r.delta && Math.abs(r.delta.v) >= 0.5 ? '<span class="' + (r.delta.v > 0 ? 'up' : 'down') + '">' + (r.delta.v > 0 ? '+' : '−') + fmtNum(Math.abs(r.delta.v), 0) + ' ' + r.delta.unit + '</span>' : '';
  const rows = sm.rows.map(r => {
    const lvl = r.score != null ? ' · ' + levelName(r.score) : '';
    let val;
    if (r.ex.type === 'w') val = esc(r.result) + ' → 1ПМ ' + fmtNum(r.e1rm, 0) + ' кг' + (r.ratio ? ' · ×' + fmtNum(r.ratio, 2) : '') + lvl;
    else if (r.ex.type === 'bw') val = r.reps + ' ' + plural(r.reps, 'повтор', 'повтора', 'повторов') + lvl;
    else val = fmtSec(r.sec) + lvl;
    return '<div class="bar-row"><div class="bar-top"><span>' + r.name + delta(r) + '</span><span class="muted">' + val + '</span></div>' +
      '<div class="bar"><i style="width:' + (r.score != null ? Math.max(3, r.score) : 0) + '%;background:' + (r.strength ? ACC : BLUE) + '"></i></div>' +
      (r.work ? '<div class="bar-sub">Рабочий вес: силовой ' + fmtNum(r.work.str, 1) + ' кг · на массу ' + fmtNum(r.work.mid, 1) + ' кг · многоповторка ' + fmtNum(r.work.hi, 1) + ' кг</div>' : '') + '</div>';
  }).join('');
  let notes = '';
  if (!sm.bw) notes += '<div class="rec info inner"><b>Нужен вес тела</b><p>Уровень считается относительно веса тела — добавьте его в профиле.</p></div>';
  if (sm.weak) notes += '<div class="rec warn inner"><b>Слабое звено: ' + sm.weak.name.toLowerCase() + '</b><p>Уровень ниже остальных. Ставьте это упражнение первым в тренировке и ведите его в силовом режиме.</p></div>';
  if (sm.strong) notes += '<div class="rec good inner"><b>Сильная сторона: ' + sm.strong.name.toLowerCase() + '</b><p>Здесь результат заметно выше остальных.</p></div>';
  openModal('<div class="sheet-head"><h3>Результат проверки</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<div class="rating-head">' + ringSvg(sm.score, ACC) + '<div><div class="lvl">' + levelName(sm.score) + '</div>' +
    '<p class="muted">' + fmtDate(w.date, true) + (sm.bw ? ' · вес тела ' + fmtNum(sm.bw, 1) + ' кг' : '') + (sm.prev ? '<br>Изменения — к проверке ' + fmtDate(sm.prev.date, true) : '') + '</p></div></div>' +
    rows + notes +
    '<p class="muted small">Рабочий вес — с чего начать в каждом режиме: силовой 4–6 повторов, на массу 8–12, многоповторка 15–20. Дальше приложение ведёт прогрессию по вашим записям.</p>' +
    (S.program ? '<button class="btn primary big" data-act="closeModal">Готово</button>'
      : '<button class="btn primary big" data-act="openProgram">Составить программу</button>'));
}

function testCardHtml() {
  const ts = tests().reverse();
  let html = '<h2>Проверка силы</h2><div class="card">';
  if (!ts.length) {
    html += '<p class="muted" style="margin-top:0">Базовая проверка: жим лёжа, присед, становая, жим стоя, тяга, подтягивания, отжимания и планка. По ней приложение определит стартовый уровень и подберёт рабочие веса под каждый режим.</p>';
  }
  for (const w of ts.slice(0, 5)) {
    const sm = testSummary(w), id = esc(w.id);
    html += '<div class="wk-ex"><span><b>' + fmtDate(w.date, true) + '</b><br><span class="muted small">' + (sm.score != null ? 'Сила ' + Math.round(sm.score) + ' · ' + levelName(sm.score) : sm.rows.length + ' ' + plural(sm.rows.length, 'упражнение', 'упражнения', 'упражнений')) + '</span></span>' +
      '<span class="row-btns" style="margin-top:0"><button class="btn small" data-act="testResult" data-id="' + id + '">Результат</button>' +
      '<button class="x" data-act="delWk" data-id="' + id + '" aria-label="Удалить проверку">✕</button></span></div>';
  }
  return html + '<div class="row-btns"><button class="btn primary" data-act="openTest">' + (ts.length ? 'Новая проверка' : 'Пройти проверку') + '</button></div></div>';
}

/* ---------- стартовые показатели и замеры ---------- */
function girthInputs(prefix, src) {
  return Object.keys(GIRTHS).map(k => '<label>' + GIRTHS[k] + ', см<input type="number" inputmode="decimal" step="0.1" min="10" max="250" id="' + prefix + k + '" value="' + (src && +src[k] > 0 ? +src[k] : '') + '"></label>').join('');
}
function readGirths(prefix) {
  const m = {};
  for (const k of Object.keys(GIRTHS)) {
    const raw = $('#' + prefix + k).value;
    if (raw === '') continue;
    const v = parseFloat(raw);
    if (!(v >= 10 && v <= 250)) { toast(GIRTHS[k] + ': введите обхват в сантиметрах'); return null; }
    m[k] = Math.round(v * 10) / 10;
  }
  return m;
}
function startCardHtml() {
  const p = S.profile, sd = DATE_RE.test(p.startDate || '') ? p.startDate : '';
  const sw = sd ? S.weights.find(w => w.date === sd) : null;
  const sm = sd ? S.measures.find(m => m.date === sd) : null;
  return '<h2>Стартовые показатели</h2><div class="card"><p class="muted small" style="margin-top:0">С чего вы начинали. От этих цифр считается прогресс «старт → сейчас». Обхваты — по желанию. Стартовую силу задаёт первая проверка силы.</p>' +
    '<div class="form-grid mt"><label>Дата начала<input type="date" id="st-date" value="' + esc(sd || todayStr()) + '" max="' + todayStr() + '"></label>' +
    '<label>Вес на старте, кг<input type="number" inputmode="decimal" step="0.1" min="30" max="300" id="st-kg" value="' + (sw ? +sw.kg : '') + '"></label>' +
    '<label>Стаж тренировок<select data-profile="exp">' + Object.keys(EXPERIENCE).map(k => '<option value="' + k + '"' + ((p.exp || '') === k ? ' selected' : '') + '>' + EXPERIENCE[k] + '</option>').join('') + '</select></label>' +
    girthInputs('st-', sm) + '</div>' +
    '<div class="row-btns"><button class="btn primary" data-act="saveStart">Сохранить</button><button class="btn" data-act="openMeasure">Новые замеры</button></div></div>';
}
function openMeasureForm() {
  openModal('<div class="sheet-head"><h3>Замеры тела</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<p class="muted small">Мерьте в одно и то же время, лучше утром. Заполняйте только то, что измерили.</p>' +
    '<label>Дата<input type="date" id="ms-date" value="' + todayStr() + '" max="' + todayStr() + '"></label>' +
    '<div class="form-grid mt">' + girthInputs('ms-', null) + '</div>' +
    '<button class="btn primary big" data-act="saveMeasure">Записать</button>');
}
function progressTableHtml() {
  const rows = startVsNow();
  if (!rows.length) return '';
  return '<h2>Старт → сейчас</h2><div class="card"><div class="cmp head"><span></span><span>Старт</span><span>Сейчас</span><span>Изменение</span></div>' + rows.map(r => {
    const d = r.b - r.a;
    const ch = r.single || Math.abs(d) < 0.05 ? '<span class="muted">—</span>'
      : '<span' + (r.lift ? ' class="' + (d > 0 ? 'up' : 'down') + '"' : '') + '>' + (d > 0 ? '+' : '−') + fmtNum(Math.abs(d), r.digits) + ' ' + r.unit + '</span>';
    return '<div class="cmp"><span><b>' + r.name + '</b><small class="muted">с ' + fmtDate(r.date, true) + '</small></span><span>' + fmtNum(r.a, r.digits) + '</span><span>' + (r.single ? '—' : fmtNum(r.b, r.digits)) + '</span>' + ch + '</div>';
  }).join('') + '</div>';
}

/* ---------- действия ---------- */
const PROG_ACT = {
  logSeg: el => { UI.logSeg = el.dataset.seg; render(); enterAnim(); },
  openProgram: () => { closeModal(); UI.logSeg = 'prog'; go('log'); },
  progNew: () => { S.program = { name: '', perWeek: 3, days: [{ id: uid(), name: '', mode: 'mid', items: [] }] }; persist(); render(); },
  progAddDay: () => {
    if (S.program.days.length >= 14) { toast('В программе может быть не больше 14 дней'); return; }
    S.program.days.push({ id: uid(), name: '', mode: 'mid', items: [] });
    persist(); render();
    const cards = document.querySelectorAll('.pday');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ block: 'center' });
  },
  progDelDay: el => {
    const day = S.program.days[+el.dataset.d];
    if (!day) return;
    const drop = () => { S.program.days = S.program.days.filter(d => d !== day); persist(); closeModal(); render(); };
    if (day.items.length) confirmBox('Удалить день?', '«' + dayTitle(day) + '» и его упражнения исчезнут из программы. Записанные тренировки останутся.', 'Удалить', drop, true);
    else drop();
  },
  progDelete: () => confirmBox('Удалить программу?', 'Все дни программы будут удалены. Записанные тренировки останутся в дневнике.', 'Удалить', () => {
    S.program = null; persist(); closeModal(); render();
  }, true),
  progMode: el => {
    const day = S.program.days[+el.dataset.d], m = el.dataset.m;
    if (!day || !MODES[m] || day.mode === m) return;
    day.mode = m;
    for (const it of day.items) { const ex = exById(it.exId); if (ex) Object.assign(it, modeDefaults(ex, m)); }
    persist(); render();
    if (day.items.length) toast('Подходы и повторы подставлены под режим «' + MODES[m].name + '»');
  },
  progAddEx: el => openPicker(+el.dataset.d),
  progDelItem: el => {
    const day = S.program.days[+el.dataset.d];
    if (day) { day.items.splice(+el.dataset.j, 1); persist(); render(); }
  },
  progUp: el => {
    const day = S.program.days[+el.dataset.d], j = +el.dataset.j;
    if (!day || j < 1 || !day.items[j]) return;
    const x = day.items[j]; day.items[j] = day.items[j - 1]; day.items[j - 1] = x;
    persist(); render();
  },
  progStartDay: el => {
    const day = programDay(el.dataset.id);
    if (day && dayItems(day).length) startDraft(draftFromDay(day));
  },
  startFree: () => startDraft({ id: null, date: todayStr(), note: '', entries: [] }),
  draftMode: el => {
    if (!S.draft) return;
    if (MODES[el.dataset.m]) S.draft.mode = el.dataset.m; else delete S.draft.mode;
    fitSets(S.draft);
    persist(); render();
  },

  openTest: () => openTestForm(),
  testResult: el => openTestResult(el.dataset.id),
  saveTest: () => {
    const date = $('#t-date').value, bwRaw = $('#t-bw').value, bw = parseFloat(bwRaw);
    if (!DATE_RE.test(date) || date > todayStr()) { toast('Проверьте дату'); return; }
    if (bwRaw !== '' && !(bw >= 30 && bw <= 300)) { toast('Введите вес тела от 30 до 300 кг'); return; }
    const val = (id, f) => { const el = $('[data-test="' + id + ':' + f + '"]'); const v = el ? parseFloat(el.value) : NaN; return v > 0 ? v : 0; };
    const entries = [];
    for (const t of TEST_ITEMS) {
      const ex = exById(t.id), name = KEY_NAMES[ex.key] || ex.name;
      if (t.kind === 'w') {
        const w = val(t.id, 'w'), r = Math.round(val(t.id, 'r'));
        if (!w && !r) continue;
        if (!w || !r) { toast(name + ': укажите и вес, и повторы'); return; }
        if (r > 12) { toast(name + ': для точного расчёта возьмите вес на 12 повторов или меньше'); return; }
        entries.push({ exId: t.id, sets: [{ w, r }] });
      } else if (t.kind === 'r') {
        const r = Math.round(val(t.id, 'r'));
        if (r) entries.push({ exId: t.id, sets: [{ w: 0, r }] });
      } else {
        const sec = Math.round(val(t.id, 'sec'));
        if (sec) entries.push({ exId: t.id, sets: [{ sec }] });
      }
    }
    if (!entries.length) { toast('Заполните хотя бы одно упражнение'); return; }
    if (bwRaw !== '') {
      S.weights = S.weights.filter(x => x.date !== date);
      S.weights.push({ date, kg: Math.round(bw * 10) / 10 });
    }
    S.workouts = S.workouts.filter(x => !(x.test && x.date === date));   // одна проверка в день
    const w = { id: uid(), date, note: 'Проверка силы', test: true, entries };
    S.workouts.push(w);
    persist(); render();
    openTestResult(w.id);
  },

  saveStart: () => {
    const date = $('#st-date').value, kgRaw = $('#st-kg').value, kg = parseFloat(kgRaw);
    if (!DATE_RE.test(date) || date > todayStr()) { toast('Проверьте дату'); return; }
    if (kgRaw !== '' && !(kg >= 30 && kg <= 300)) { toast('Введите вес от 30 до 300 кг'); return; }
    const m = readGirths('st-');
    if (!m) return;
    const old = S.profile.startDate;
    const moved = d => old && old !== date && d === old;   // дату старта передвинули — записи идут за ней
    if (kgRaw !== '') {
      S.weights = S.weights.filter(x => x.date !== date && !moved(x.date));
      S.weights.push({ date, kg: Math.round(kg * 10) / 10 });
    }
    S.measures = S.measures.filter(x => x.date !== date && !moved(x.date));
    if (Object.keys(m).length) S.measures.push(Object.assign({ date }, m));
    S.profile.startDate = date;
    persist(); render(); toast('Стартовые показатели сохранены');
  },
  openMeasure: () => openMeasureForm(),
  saveMeasure: () => {
    const date = $('#ms-date').value;
    if (!DATE_RE.test(date) || date > todayStr()) { toast('Проверьте дату'); return; }
    const m = readGirths('ms-');
    if (!m) return;
    if (!Object.keys(m).length) { toast('Впишите хотя бы один обхват'); return; }
    const old = S.measures.find(x => x.date === date);
    S.measures = S.measures.filter(x => x !== old);
    S.measures.push(Object.assign({}, old || {}, m, { date }));
    persist(); closeModal(); render(); toast('Замеры записаны');
  }
};
