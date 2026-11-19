'use strict';
/* Серии недель и награды. Награды считаются по записям; полученная остаётся навсегда (S.badges). */

/* ---------- серии ---------- */
/* Неделя засчитана, если в ней была хотя бы одна тренировка. Текущая неделя серию не рвёт, пока не закончилась. */
function weekStreak() {
  const weeks = Array.from(new Set(S.workouts.map(w => weekStart(w.date)))).sort();
  if (!weeks.length) return { cur: 0, best: 0, thisWeek: false };
  let best = 1, run = 1;
  for (let i = 1; i < weeks.length; i++) {
    run = daysDiff(weeks[i - 1], weeks[i]) === 7 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const set = new Set(weeks), tw = weekStart(todayStr()), thisWeek = set.has(tw);
  let cur = 0, w = thisWeek ? tw : addDays(tw, -7);
  while (set.has(w)) { cur++; w = addDays(w, -7); }
  return { cur, best, thisWeek };
}
/* Недели, в которых выполнено плановое число тренировок по программе */
function planWeeks() {
  if (!S.program) return { total: 0, best: 0 };
  const cnt = {};
  for (const w of S.workouts) if (w.dayId) { const k = weekStart(w.date); cnt[k] = (cnt[k] || 0) + 1; }
  const weeks = Object.keys(cnt).filter(k => cnt[k] >= S.program.perWeek).sort();
  let best = weeks.length ? 1 : 0, run = 1;
  for (let i = 1; i < weeks.length; i++) {
    run = daysDiff(weeks[i - 1], weeks[i]) === 7 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { total: weeks.length, best };
}

/* ---------- что уже достигнуто ---------- */
function badgeCtx() {
  const bestRatio = id => exHistory(id).reduce((m, h) => { const bw = bwAt(h.date); return bw && h.st.best1rm ? Math.max(m, h.st.best1rm / bw) : m; }, 0);
  const bestStat = (id, f) => exHistory(id).reduce((m, h) => Math.max(m, h.st[f]), 0);
  const real = S.workouts.filter(w => !w.test);
  let tons = 0, km = 0;
  for (const w of real) {
    tons += workoutVolume(w);
    for (const en of w.entries) {
      const ex = exById(en.exId);
      if (ex && ex.type === 'cardio') for (const s of en.sets) km += +s.km || 0;
    }
  }
  const ts = tests(), p = S.profile, bw = currentBW(), kg = +p.goalKg;
  const sk = weekStreak(), pw = planWeeks(), cs = caliSummary();
  return {
    cali: cs.by, caliStages: cs.stages, caliAll: cs.stages >= cs.total ? 1 : 0,
    sex: sexKey(), count: real.length, tons: tons / 1000, streak: sk.best, km,
    bench: bestRatio('bench'), squat: bestRatio('squat'), deadlift: bestRatio('deadlift'),
    pull: bestStat('pullup', 'maxReps'), push: bestStat('pushup', 'maxReps'), plank: bestStat('plank', 'maxSec'),
    score: strengthRating().score || 0,
    planTotal: pw.total, planBest: pw.best, tests: ts.length,
    testGain: ts.length >= 2 && (testSummary(ts[ts.length - 1]).score || 0) > (testSummary(ts[0]).score || 0) ? 1 : 0,
    foodDays: new Set(S.food.map(f => f.date)).size, weights: S.weights.length,
    goalDone: bw && kg && ((p.goal === 'lose' && bw <= kg) || (p.goal === 'gain' && bw >= kg)) ? 1 : 0,
    healed: S.injuries.filter(i => i.status === 'healed').length
  };
}

/* ---------- список наград ----------
   tier — уровень сложности: 1 лёгкая (бронза), 2 средняя (серебро), 3 сложная (золото), 4 легендарная.
   cur — сколько сейчас, need — сколько нужно. */
const BADGE_GROUPS = { work: 'Тренировки', streak: 'Серии', tons: 'Тоннаж', power: 'Сила', cali: 'Калистеника', plan: 'План', health: 'Питание и здоровье' };
const BADGE_TIERS = {
  1: { name: 'Лёгкие', one: 'лёгкая', desc: 'Первые шаги — получаются за первые недели' },
  2: { name: 'Средние', one: 'средняя', desc: 'Нужны месяцы регулярных тренировок' },
  3: { name: 'Сложные', one: 'сложная', desc: 'Год и больше упорной работы' },
  4: { name: 'Легендарные', one: 'легендарная', desc: 'Уровень, до которого доходят единицы' }
};
const caliB = (id, tier, skill, k, name, desc) => B(id, 'cali', tier, name, desc, c => c.cali[skill] || 0, k, { unit: 'этапов' });
const lvlRatio = (key, i) => c => STD[c.sex][key][i];
const ratioDesc = (key, i) => c => 'Расчётный максимум от ×' + fmtNum(STD[c.sex][key][i], 2) + ' веса тела';
function B(id, group, tier, name, desc, cur, need, opt) {
  return Object.assign({ id, group, tier, name, desc, cur, need }, opt || {});
}
const BADGES = [
  B('w1', 'work', 1, 'Первый шаг', 'Записать первую тренировку', c => c.count, 1),
  B('w10', 'work', 1, 'Втянулся', '10 тренировок', c => c.count, 10),
  B('w25', 'work', 2, 'Четверть сотни', '25 тренировок', c => c.count, 25),
  B('w50', 'work', 2, 'Полсотни', '50 тренировок', c => c.count, 50),
  B('w100', 'work', 3, 'Сотня', '100 тренировок', c => c.count, 100),
  B('w250', 'work', 3, 'Железный характер', '250 тренировок', c => c.count, 250),
  B('w500', 'work', 4, 'Легенда зала', '500 тренировок', c => c.count, 500),

  B('s2', 'streak', 1, 'Две недели подряд', 'Тренироваться 2 недели без пропуска', c => c.streak, 2),
  B('s4', 'streak', 1, 'Месяц без пропусков', '4 недели подряд', c => c.streak, 4),
  B('s8', 'streak', 2, 'Два месяца', '8 недель подряд', c => c.streak, 8),
  B('s12', 'streak', 2, 'Квартал', '12 недель подряд', c => c.streak, 12),
  B('s26', 'streak', 3, 'Полгода', '26 недель подряд', c => c.streak, 26),
  B('s52', 'streak', 3, 'Год без пропусков', '52 недели подряд', c => c.streak, 52),
  B('s104', 'streak', 4, 'Два года без пропусков', '104 недели подряд', c => c.streak, 104),

  B('t10', 'tons', 1, '10 тонн', 'Поднять 10 тонн за всё время', c => c.tons, 10, { unit: 'т', digits: 1 }),
  B('t50', 'tons', 1, '50 тонн', 'Поднять 50 тонн', c => c.tons, 50, { unit: 'т', digits: 1 }),
  B('t100', 'tons', 2, '100 тонн', 'Поднять 100 тонн', c => c.tons, 100, { unit: 'т', digits: 0 }),
  B('t500', 'tons', 3, '500 тонн', 'Поднять 500 тонн', c => c.tons, 500, { unit: 'т', digits: 0 }),
  B('t1000', 'tons', 3, 'Тысяча тонн', 'Поднять 1000 тонн', c => c.tons, 1000, { unit: 'т', digits: 0 }),
  B('t2500', 'tons', 4, '2500 тонн', 'Поднять 2500 тонн', c => c.tons, 2500, { unit: 'т', digits: 0 }),

  B('bench', 'power', 2, 'Жим: «Опытный»', ratioDesc('bench', 2), c => c.bench, lvlRatio('bench', 2), { digits: 2, unit: '× веса' }),
  B('squat', 'power', 2, 'Присед: «Опытный»', ratioDesc('squat', 2), c => c.squat, lvlRatio('squat', 2), { digits: 2, unit: '× веса' }),
  B('dead', 'power', 2, 'Становая: «Опытный»', ratioDesc('deadlift', 2), c => c.deadlift, lvlRatio('deadlift', 2), { digits: 2, unit: '× веса' }),
  B('bench5', 'power', 4, 'Жим: «Элита»', ratioDesc('bench', 4), c => c.bench, lvlRatio('bench', 4), { digits: 2, unit: '× веса' }),
  B('squat5', 'power', 4, 'Присед: «Элита»', ratioDesc('squat', 4), c => c.squat, lvlRatio('squat', 4), { digits: 2, unit: '× веса' }),
  B('dead5', 'power', 4, 'Становая: «Элита»', ratioDesc('deadlift', 4), c => c.deadlift, lvlRatio('deadlift', 4), { digits: 2, unit: '× веса' }),
  B('pull20', 'power', 3, '20 подтягиваний', '20 раз в одном подходе', c => c.pull, 20),
  B('plank5', 'power', 3, 'Планка 5 минут', 'Простоять 300 секунд', c => c.plank, 300, { unit: 'сек' }),
  B('pull1', 'power', 1, 'Первое подтягивание', 'Подтянуться хотя бы раз', c => c.pull, 1),
  B('pull10', 'power', 2, '10 подтягиваний', '10 раз в одном подходе', c => c.pull, 10),
  B('push30', 'power', 1, '30 отжиманий', '30 раз в одном подходе', c => c.push, 30),
  B('plank2', 'power', 1, 'Планка 2 минуты', 'Простоять 120 секунд', c => c.plank, 120, { unit: 'сек' }),
  B('lvl40', 'power', 1, 'Рейтинг силы 40', 'Уровень «Любитель»', c => c.score, 40),
  B('lvl60', 'power', 2, 'Рейтинг силы 60', 'Уровень «Опытный»', c => c.score, 60),
  B('lvl80', 'power', 3, 'Рейтинг силы 80', 'Уровень «Продвинутый»', c => c.score, 80),

  B('c1', 'cali', 1, 'Первый элемент', 'Освоить первый этап любого навыка', c => c.caliStages, 1, { unit: 'этапов' }),
  B('c10', 'cali', 1, 'Уличный атлет', '10 этапов калистеники', c => c.caliStages, 10, { unit: 'этапов' }),
  B('c30', 'cali', 2, 'Мастер турника', '30 этапов калистеники', c => c.caliStages, 30, { unit: 'этапов' }),
  B('c60', 'cali', 3, 'Хозяин своего веса', '60 этапов калистеники', c => c.caliStages, 60, { unit: 'этапов' }),
  B('call', 'cali', 4, 'Всё освоено', 'Пройти все этапы всех навыков', c => c.caliAll, 1),
  caliB('k_pull', 1, 'pullups', 3, 'Первое подтягивание', 'Навык «Подтягивания», этап 3'),
  caliB('k_ls', 2, 'lsit', 2, 'Уголок', 'L-сит 10 секунд'),
  caliB('k_pistol', 2, 'pistol', 4, 'Пистолетик', 'Присесть на одной ноге'),
  caliB('k_hs', 3, 'handstand', 4, 'Стойка без опоры', 'Стойка на руках 15 секунд'),
  caliB('k_mu', 3, 'muscleup', 4, 'Выход силой', 'Первый выход на перекладину'),
  caliB('k_bl', 3, 'backlever', 5, 'Задний вис', 'Полный задний вис 5 секунд'),
  caliB('k_fl', 4, 'frontlever', 5, 'Передний вис', 'Полный передний вис 3 секунды'),
  caliB('k_pl', 4, 'planche', 6, 'Планш', 'Полный планш 3 секунды'),
  caliB('k_flag', 4, 'flag', 5, 'Человек-флаг', 'Полный флаг 3 секунды'),
  caliB('k_oap', 4, 'oap', 4, 'Одной рукой', 'Подтянуться на одной руке'),

  B('p1', 'plan', 1, 'Неделя по плану', 'Выполнить все тренировки программы за неделю', c => c.planTotal, 1),
  B('p4', 'plan', 2, 'Месяц по плану', '4 недели подряд по программе', c => c.planBest, 4),
  B('test1', 'plan', 1, 'Точка отсчёта', 'Пройти проверку силы', c => c.tests, 1),
  B('test2', 'plan', 2, 'Рост подтверждён', 'Повторная проверка лучше первой', c => c.testGain, 1),

  B('f7', 'health', 1, 'Неделя учёта', 'Записывать питание 7 дней', c => c.foodDays, 7),
  B('f30', 'health', 2, 'Месяц учёта', 'Записывать питание 30 дней', c => c.foodDays, 30),
  B('bw8', 'health', 1, 'Под контролем', '8 записей веса', c => c.weights, 8),
  B('goal', 'health', 3, 'Цель по весу', 'Дойти до желаемого веса', c => c.goalDone, 1),
  B('km50', 'health', 2, '50 км кардио', 'Набрать 50 км за всё время', c => c.km, 50, { unit: 'км', digits: 1 }),
  B('heal', 'health', 1, 'Вернулся в строй', 'Вылечить травму и отметить это', c => c.healed, 1)
];

function badgeState() {
  const c = badgeCtx();
  const val = v => typeof v === 'function' ? v(c) : v;
  return BADGES.map(b => {
    const cur = b.cur(c) || 0, need = val(b.need);
    return { b, name: val(b.name), desc: val(b.desc), cur, need, earned: cur >= need || (b.id in S.badges), date: S.badges[b.id] || null };
  });
}

/* Отмечает только что полученные награды. silent — без окна (первый запуск, демо, загрузка копии). */
function checkBadges(silent) {
  const fresh = badgeState().filter(x => x.cur >= x.need && !(x.b.id in S.badges));
  const first = !S.badgesInit;       // записи велись до появления наград — отмечаем без даты и без салюта
  if (!fresh.length && !first) return;
  for (const x of fresh) S.badges[x.b.id] = first ? null : todayStr();
  S.badgesInit = true;
  persist();
  if (fresh.length && !first && !silent) announceBadges(fresh);
}

/* ---------- отрисовка ---------- */
const BADGE_GLYPH = {
  work: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  streak: '<path d="M12 3c1 3.5 5 5 5 9.5a5 5 0 0 1-10 0c0-1.8.8-3 1.8-4 .4 1.5 1.2 2.2 2 2.5C10.5 8.5 11 6 12 3z"/>',
  tons: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
  power: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5c0 3 1.5 4 3 4M16 6h3c0 3-1.5 4-3 4M12 13v4M8.5 20h7"/>',
  cali: '<path d="M3 4h18M8 4v6M16 4v6"/><circle cx="8" cy="14.5" r="4"/><circle cx="16" cy="14.5" r="4"/>',
  plan: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v3M16 3v3M4 10h16M9 15l2 2 4-4"/>',
  health: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'
};
function badgeIcon(b) {
  return '<svg class="bdg-ic" viewBox="0 0 48 48" aria-hidden="true"><circle class="bdg-bg" cx="24" cy="24" r="21"/><g transform="translate(12 12)">' + BADGE_GLYPH[b.group] + '</g></svg>';
}
function badgeTile(x) {
  const b = x.b, num = v => fmtNum(Math.min(v, x.need), b.digits == null ? 0 : b.digits);
  const foot = x.earned
    ? '<div class="bdg-foot">' + (x.date ? fmtDate(x.date, true) : 'получена') + '</div>'
    : '<div class="bar"><i style="width:' + Math.min(100, 100 * x.cur / x.need) + '%"></i></div><div class="bdg-foot">' + num(x.cur) + ' из ' + fmtNum(x.need, b.digits == null ? 0 : b.digits) + (b.unit ? ' ' + b.unit : '') + '</div>';
  return '<div class="bdg t' + b.tier + (x.earned ? '' : ' locked') + '"><em class="tier-tag">' + BADGE_TIERS[b.tier].one + '</em>' + badgeIcon(b) + '<b>' + x.name + '</b><span>' + x.desc + '</span>' + foot + '</div>';
}

function weekDotsHtml() {
  const t = todayStr(), from = weekStart(t);
  const days = new Set(S.workouts.filter(w => w.date >= from).map(w => w.date));
  return '<div class="week-dots">' + ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((n, i) => {
    const d = addDays(from, i);
    return '<span class="' + (days.has(d) ? 'on' : '') + (d === t ? ' today' : '') + (d > t ? ' later' : '') + '"><i></i>' + n + '</span>';
  }).join('') + '</div>';
}
function streakTitle(sk) {
  return sk.cur ? sk.cur + ' ' + plural(sk.cur, 'неделя', 'недели', 'недель') + ' подряд' : 'Начните новую серию';
}

/* Карточка на главной: серия недель, дни этой недели, число наград */
function streakCard() {
  if (!S.workouts.length) return '';
  const sk = weekStreak(), st = badgeState();
  return '<button class="card streak-card" data-act="openBadges"><div class="streak-top"><svg class="flame" viewBox="0 0 24 24" aria-hidden="true">' + BADGE_GLYPH.streak + '</svg>' +
    '<span><b>' + streakTitle(sk) + '</b><span class="muted small">лучшая серия — ' + sk.best + ' · наград ' + st.filter(x => x.earned).length + ' из ' + st.length + '</span></span></div>' +
    weekDotsHtml() + '</button>';
}

/* Экран «Награды» в разделе «Прогресс» */
function progBadges() {
  const st = badgeState(), sk = weekStreak();
  const got = st.filter(x => x.earned).length;
  const near = st.filter(x => !x.earned && x.cur > 0).sort((a, b) => b.cur / b.need - a.cur / a.need).slice(0, 2);
  let html = '<div class="stats"><div><b>' + got + ' из ' + st.length + '</b><span>наград получено</span></div>' +
    '<div><b>' + sk.cur + '</b><span>' + plural(sk.cur, 'неделя', 'недели', 'недель') + ' подряд сейчас</span></div>' +
    '<div><b>' + sk.best + '</b><span>лучшая серия</span></div></div>' +
    '<div class="card">' + weekDotsHtml() + '<p class="muted small">Неделя идёт в серию, если в ней была хотя бы одна тренировка. Серия не рвётся, пока текущая неделя не закончилась.</p></div>';
  // уровни сложности: сколько получено на каждом
  html += '<h2>Уровни сложности</h2><div class="card tiers">' + [1, 2, 3, 4].map(t => {
    const list = st.filter(x => x.b.tier === t), g = list.filter(x => x.earned).length;
    return '<div class="tier-row t' + t + '"><span class="tier-dot"></span><span><b>' + BADGE_TIERS[t].name + '</b><small>' + BADGE_TIERS[t].desc + '</small></span>' +
      '<span class="tier-num">' + g + ' / ' + list.length + '</span><div class="bar"><i style="width:' + (100 * g / list.length) + '%"></i></div></div>';
  }).join('') + '</div>';
  if (near.length) html += '<h2>Уже близко</h2><div class="bdg-grid">' + near.map(badgeTile).join('') + '</div>';
  const byTier = UI.bdgView === 'tier';
  html += '<div class="seg mt">' + [['group', 'По темам'], ['tier', 'По сложности']].map(v =>
    '<button class="' + ((v[0] === 'tier') === byTier ? 'on' : '') + '" data-act="bdgView" data-v="' + v[0] + '">' + v[1] + '</button>').join('') + '</div>';
  const sections = byTier ? [1, 2, 3, 4].map(t => [BADGE_TIERS[t].name, x => x.b.tier === t])
    : Object.keys(BADGE_GROUPS).map(g => [BADGE_GROUPS[g], x => x.b.group === g]);
  for (const sec of sections) {
    const list = st.filter(sec[1]);
    if (byTier) list.sort((a, b) => (b.earned - a.earned) || Object.keys(BADGE_GROUPS).indexOf(a.b.group) - Object.keys(BADGE_GROUPS).indexOf(b.b.group));
    html += '<h2>' + sec[0] + ' · ' + list.filter(x => x.earned).length + ' из ' + list.length + '</h2><div class="bdg-grid">' + list.map(badgeTile).join('') + '</div>';
  }
  return html;
}

function announceBadges(list) {
  const names = list.map(x => '«' + x.name + '»').join(', ');
  if (modalOpen()) { toast((list.length > 1 ? 'Новые награды: ' : 'Новая награда: ') + names); return; }
  openModal('<div class="sheet-head"><h3>' + (list.length > 1 ? 'Новые награды' : 'Новая награда') + '</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<div class="bdg-new">' + list.slice(0, 4).map(x => '<div class="bdg t' + x.b.tier + '">' + badgeIcon(x.b) + '<b>' + x.name + '</b><span>' + x.desc + '</span></div>').join('') + '</div>' +
    (list.length > 4 ? '<p class="muted small">И ещё ' + (list.length - 4) + ' — смотрите в разделе наград.</p>' : '') +
    '<div class="row-btns end"><button class="btn" data-act="openBadges">Все награды</button><button class="btn primary" data-act="closeModal">Отлично</button></div>');
  celebrate();
}

const BADGE_ACT = {
  openBadges: () => { closeModal(); UI.seg = 'badges'; go('progress'); },
  bdgView: el => { UI.bdgView = el.dataset.v; render(); }
};
