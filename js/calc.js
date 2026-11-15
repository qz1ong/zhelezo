'use strict';
/* Расчёты: 1ПМ, статистика, рейтинги силы и выносливости, травмы, рекомендации */

/* ---------- вес тела ---------- */
function sortedWeights() { return S.weights.slice().sort((a, b) => a.date.localeCompare(b.date)); }
function bwAt(date) {
  const ws = sortedWeights();
  if (!ws.length) return null;
  let res = null;
  for (const w of ws) { if (w.date <= date) res = w.kg; }
  return res == null ? ws[0].kg : res;
}
function currentBW() { return bwAt(todayStr()); }

/* ---------- подходы ---------- */
/* Формула Эпли. Для штанги повторы свыше 12 не учитываем: оценка становится завышенной. */
function e1rm(w, r) {
  if (!(w > 0) || !(r > 0)) return 0;
  if (r === 1) return w;
  return w * (1 + Math.min(r, 12) / 30);
}

function isValidSet(ex, s) {
  if (!s) return false;
  if (ex.type === 'w' || ex.type === 'bw') return (+s.r || 0) > 0;
  if (ex.type === 'time') return (+s.sec || 0) > 0;
  return (+s.km || 0) > 0 || (+s.min || 0) > 0;
}

function setText(ex, s) {
  if (ex.type === 'w') return fmtNum(+s.w || 0, 2) + '×' + s.r;
  if (ex.type === 'bw') return (+s.w > 0 ? '+' + fmtNum(+s.w, 2) + ' кг ×' : '') + s.r;
  if (ex.type === 'time') return fmtSec(+s.sec);
  const parts = [];
  if (+s.km > 0) parts.push(fmtNum(+s.km, 2) + ' км');
  if (+s.min > 0) parts.push(fmtNum(+s.min, 1) + ' мин');
  return parts.join(' за ');
}

function emptyStats(type) {
  return { type, sets: 0, reps: 0, volume: 0, best1rm: 0, maxW: 0, maxReps: 0, sec: 0, maxSec: 0, km: 0, min: 0, speed: 0 };
}

function addSetsToStats(st, ex, sets, bw) {
  for (const s of sets) {
    if (!isValidSet(ex, s)) continue;
    st.sets++;
    if (ex.type === 'w') {
      const w = +s.w || 0, r = +s.r;
      st.reps += r; st.volume += w * r;
      st.best1rm = Math.max(st.best1rm, e1rm(w, r));
      st.maxW = Math.max(st.maxW, w); st.maxReps = Math.max(st.maxReps, r);
    } else if (ex.type === 'bw') {
      const add = +s.w || 0, r = +s.r;
      st.reps += r; st.maxReps = Math.max(st.maxReps, r); st.maxW = Math.max(st.maxW, add);
      if (bw) {
        const load = bw * (ex.bwf == null ? 0.7 : ex.bwf) + add;
        st.volume += load * r;
        st.best1rm = Math.max(st.best1rm, r === 1 ? load : load * (1 + r / 30));
      }
    } else if (ex.type === 'time') {
      const sec = +s.sec;
      st.sec += sec; st.maxSec = Math.max(st.maxSec, sec);
    } else {
      const km = +s.km || 0, min = +s.min || 0;
      st.km += km; st.min += min;
      if (km > 0 && min > 0) st.speed = Math.max(st.speed, km / (min / 60));
    }
  }
  return st;
}

function entryStats(entry, date) {
  const ex = exById(entry.exId);
  if (!ex) return null;
  return addSetsToStats(emptyStats(ex.type), ex, entry.sets || [], bwAt(date));
}

function workoutVolume(w) {
  let v = 0;
  for (const en of w.entries) { const st = entryStats(en, w.date); if (st) v += st.volume; }
  return v;
}
function workoutSetCount(w) {
  let n = 0;
  for (const en of w.entries) { const st = entryStats(en, w.date); if (st) n += st.sets; }
  return n;
}

/* История одного упражнения: по одной точке на день */
function exHistory(exId, excludeWorkoutId) {
  const ex = exById(exId);
  if (!ex) return [];
  const byDate = new Map();
  for (const w of sortedWorkouts()) {
    if (excludeWorkoutId && w.id === excludeWorkoutId) continue;
    for (const en of w.entries) {
      if (en.exId !== exId) continue;
      const sets = (en.sets || []).filter(s => isValidSet(ex, s));
      if (!sets.length) continue;
      if (!byDate.has(w.date)) byDate.set(w.date, { date: w.date, sets: [], st: emptyStats(ex.type) });
      const rec = byDate.get(w.date);
      rec.sets = rec.sets.concat(sets);
      addSetsToStats(rec.st, ex, sets, bwAt(w.date));
    }
  }
  return Array.from(byDate.values());
}

function usedExerciseIds() {
  const count = {};
  for (const w of S.workouts) for (const en of w.entries) {
    if (exById(en.exId)) count[en.exId] = (count[en.exId] || 0) + 1;
  }
  return Object.keys(count).sort((a, b) => count[b] - count[a]);
}

/* ---------- рейтинги ---------- */
function scoreFrom(val, th) {
  if (!(val > 0)) return 0;
  if (val < th[0]) return 20 * val / th[0];
  for (let i = 0; i < 4; i++) {
    if (val < th[i + 1]) return 20 * (i + 1) + 20 * (val - th[i]) / (th[i + 1] - th[i]);
  }
  return 100;
}
function levelIndex(score) { return score == null ? 0 : Math.min(5, Math.floor(score / 20)); }
function levelName(score) { return score == null ? 'Нет данных' : LEVELS[levelIndex(score)]; }

function sexKey() { return S.profile.sex === 'f' ? 'f' : 'm'; }
function ageAt(date) {
  const y = +S.profile.birthYear;
  return y ? parseD(date).getFullYear() - y : null;
}
/* После 40 лет нормативы смягчаются на 1 % за год, максимум на 30 % */
function ageFactor(date) {
  const a = ageAt(date);
  if (!a || a <= 40) return 1;
  return Math.min(1.3, 1 + (a - 40) * 0.01);
}

const RATING_WINDOW = 180; // дней: рейтинг отражает текущую форму

function strengthRating(asOf) {
  asOf = asOf || todayStr();
  const from = addDays(asOf, -RATING_WINDOW);
  const sex = sexKey(), af = ageFactor(asOf);
  const best = {};
  for (const w of S.workouts) {
    if (w.date > asOf || w.date < from) continue;
    const bw = bwAt(w.date);
    if (!bw) continue;
    for (const en of w.entries) {
      const ex = exById(en.exId);
      if (!ex || !ex.key || !STD[sex][ex.key]) continue;
      const st = entryStats(en, w.date);
      if (!st || !st.best1rm) continue;
      const ratio = st.best1rm / bw;
      if (!best[ex.key] || ratio > best[ex.key].ratio) best[ex.key] = { ratio, e1rm: st.best1rm, date: w.date, bw };
    }
  }
  const items = Object.keys(STD[sex]).map(k => {
    const b = best[k], th = STD[sex][k];
    const score = b ? scoreFrom(b.ratio * af, th) : null;
    let next = null;
    if (b && score < 100) {
      const li = levelIndex(score);           // следующий порог — th[li]
      const bwNow = bwAt(asOf) || b.bw;
      next = { level: LEVELS[li + 1], e1rm: th[li] / af * bwNow, reps: Math.max(1, Math.ceil((th[li] / af - 1) * 30 - 1e-9)) };
    }
    return { key: k, name: KEY_NAMES[k], has: !!b, score, ratio: b ? b.ratio : null, e1rm: b ? b.e1rm : null, date: b ? b.date : null, next };
  });
  const have = items.filter(i => i.has);
  const score = have.length ? have.reduce((s, i) => s + i.score, 0) / have.length : null;
  return { score, items, count: have.length };
}

function enduranceRating(asOf) {
  asOf = asOf || todayStr();
  const from = addDays(asOf, -RATING_WINDOW), from28 = addDays(asOf, -27);
  const sex = sexKey(), af = ageFactor(asOf);
  const val = { pushup: 0, pullup: 0, plank: 0, run: 0, cardio: 0, capacity: 0 };
  let cardioMin = 0, tonnage = 0, recent = 0;
  for (const w of S.workouts) {
    if (w.date > asOf || w.date < from) continue;
    const in28 = w.date >= from28;
    if (in28) recent++;
    for (const en of w.entries) {
      const ex = exById(en.exId);
      if (!ex) continue;
      const st = entryStats(en, w.date);
      if (!st || !st.sets) continue;
      if (ex.id === 'pushup') val.pushup = Math.max(val.pushup, st.maxReps);
      if (ex.id === 'pullup') val.pullup = Math.max(val.pullup, st.maxReps);
      if (ex.id === 'plank') val.plank = Math.max(val.plank, st.maxSec);
      if (ex.id === 'run') {
        for (const s of en.sets) {
          if (+s.km >= 2 && +s.min > 0) val.run = Math.max(val.run, s.km / (s.min / 60));
        }
      }
      if (in28) {
        if (ex.type === 'cardio') cardioMin += st.min;
        else if (ex.muscle === 'cardio' && ex.type === 'time') cardioMin += st.sec / 60;
        tonnage += st.volume;
      }
    }
  }
  val.cardio = cardioMin / 4;
  const bw = bwAt(asOf);
  val.capacity = bw && recent ? tonnage / 4 / bw : 0;

  const items = Object.keys(END_ITEMS).map(k => {
    const th = ESTD[sex][k], v = val[k], has = v > 0;
    const score = has ? scoreFrom(v * af, th) : null;
    let next = null;
    if (has && score < 100) { const li = levelIndex(score); next = { level: LEVELS[li + 1], value: th[li] / af }; }
    return Object.assign({ key: k, has, score, value: v, next }, END_ITEMS[k]);
  });
  const have = items.filter(i => i.has);
  const score = have.length ? have.reduce((s, i) => s + i.score, 0) / have.length : null;
  return { score, items, count: have.length };
}

/* История рейтингов по датам тренировок (не больше ~40 точек) */
function ratingHistory() {
  let dates = Array.from(new Set(S.workouts.map(w => w.date))).sort();
  if (dates.length > 40) {
    const step = dates.length / 40, pick = [];
    for (let i = 0; i < 40; i++) pick.push(dates[Math.floor(i * step)]);
    pick.push(dates[dates.length - 1]);
    dates = Array.from(new Set(pick));
  }
  const str = [], end = [];
  for (const d of dates) {
    const a = strengthRating(d).score, b = enduranceRating(d).score;
    if (a != null) str.push({ x: d, y: Math.round(a * 10) / 10 });
    if (b != null) end.push({ x: d, y: Math.round(b * 10) / 10 });
  }
  return { str, end };
}

/* ---------- объём ---------- */
function weeklyStats(nWeeks) {
  const thisWeek = weekStart(todayStr());
  const weeks = [];
  for (let i = nWeeks - 1; i >= 0; i--) weeks.push({ start: addDays(thisWeek, -7 * i), volume: 0, workouts: 0 });
  const idx = new Map(weeks.map((w, i) => [w.start, i]));
  for (const w of S.workouts) {
    const i = idx.get(weekStart(w.date));
    if (i == null) continue;
    weeks[i].volume += workoutVolume(w);
    weeks[i].workouts++;
  }
  return weeks;
}

function muscleSets(days) {
  const from = addDays(todayStr(), -(days - 1));
  const res = {};
  for (const w of S.workouts) {
    if (w.date < from) continue;
    for (const en of w.entries) {
      const ex = exById(en.exId);
      const st = entryStats(en, w.date);
      if (!ex || !st) continue;
      res[ex.muscle] = (res[ex.muscle] || 0) + st.sets;
    }
  }
  return res;
}

/* ---------- травмы ---------- */
function activeInjuries() { return S.injuries.filter(i => i.status === 'active'); }

/* 0 — можно, 1 — осторожно, 2 — снизить вес, 3 — исключить */
function levelFor(ex, inj) {
  const st = (ex.stress || {})[inj.area] || 0;
  if (!st) return 0;
  const v = st + (+inj.severity || 1);
  return v >= 5 ? 3 : v === 4 ? 2 : v === 3 ? 1 : 0;
}
function reducePct(inj) { return { 1: 20, 2: 40, 3: 50 }[inj.severity] || 30; }

function injuryVerdict(ex) {
  let worst = { level: 0, inj: null, pct: 0 };
  for (const inj of activeInjuries()) {
    const level = levelFor(ex, inj);
    if (level > worst.level) worst = { level, inj, pct: level === 2 ? reducePct(inj) : 0 };
  }
  return worst;
}

function injuryTitle(inj) {
  const side = { l: 'слева', r: 'справа', b: 'с обеих сторон' }[inj.side];
  return AREAS[inj.area] + (side ? ' (' + side + ')' : '');
}

function lastPain(inj) {
  const p = (inj.pain || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  return p.length ? p[p.length - 1] : null;
}

/* Что исключить, что облегчить и чем заменить при конкретной травме */
function injuryPlan(inj) {
  const avoid = [], reduce = [], care = [];
  for (const ex of allExercises()) {
    const l = levelFor(ex, inj);
    if (l === 3) avoid.push(ex); else if (l === 2) reduce.push(ex); else if (l === 1) care.push(ex);
  }
  const muscles = Array.from(new Set(avoid.concat(reduce).map(e => e.muscle)));
  const alts = [];
  for (const m of muscles) {
    const safe = allExercises().filter(e => e.muscle === m && injuryVerdict(e).level === 0).slice(0, 4);
    if (safe.length) alts.push({ muscle: m, list: safe });
  }
  return { avoid, reduce, care, alts, pct: reducePct(inj) };
}

/* Этап восстановления по дневнику боли */
function injuryStage(inj) {
  const days = daysDiff(inj.date, todayStr());
  const lp = lastPain(inj);
  const pains = (inj.pain || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (lp && lp.level >= 7) {
    return { k: 'danger', title: 'Стоп-нагрузка', text: 'Боль ' + lp.level + '/10 — это много. Уберите любую нагрузку на эту зону и покажитесь врачу.' };
  }
  if (inj.severity >= 2 && days >= 21 && (!lp || lp.level >= 4)) {
    return { k: 'danger', title: 'Пора к специалисту', text: 'Прошло ' + days + ' ' + plural(days, 'день', 'дня', 'дней') + ', а улучшения не видно. Запишитесь к спортивному врачу или физиотерапевту.' };
  }
  if (lp && lp.level >= 4) {
    return { k: 'warn', title: 'Щадящий режим', text: 'Делайте только те упражнения, которые не вызывают боли. Всё из списка «Исключить» — под запретом, остальное — лёгкий вес и 12–15 повторов.' };
  }
  if (lp && lp.level >= 1) {
    return { k: 'info', title: 'Постепенное возвращение', text: 'Возвращайте нагрузку ступенями: 50 % → 70 % → 85 % → 100 % рабочего веса, по неделе на ступень. Если боль растёт — шаг назад.' };
  }
  if (lp && lp.level === 0) {
    const zeros = pains.filter(p => p.level === 0);
    const firstZero = zeros.length ? zeros[0].date : lp.date;
    let lastNonZero = null;
    for (const p of pains) if (p.level > 0) lastNonZero = p.date;
    const cleanSince = lastNonZero ? pains.find(p => p.date > lastNonZero).date : firstZero;
    if (daysDiff(cleanSince, todayStr()) >= 7) {
      return { k: 'good', title: 'Похоже, зажило', text: 'Боли нет уже неделю и больше. Можно отметить травму как восстановленную и вернуться к полным весам за 2–3 тренировки.' };
    }
    return { k: 'good', title: 'Боли нет', text: 'Хороший знак. Продержитесь без боли неделю на лёгких весах, затем возвращайте рабочие.' };
  }
  return { k: 'info', title: 'Отмечайте боль', text: 'Ставьте оценку боли после тренировок — по ней приложение подскажет, когда можно возвращать нагрузку.' };
}

/* ---------- подсказка в тренировке ---------- */
function weightStep(ex) {
  return (ex.muscle === 'legs' || ex.muscle === 'glutes' || ex.key === 'deadlift') ? 5 : 2.5;
}
function roundTo(v, step) { return Math.round(v / step) * step; }

/* ---------- программа и режимы ---------- */
function isCompound(ex) { return COMPOUND.includes(ex.id); }

/* Что подставить упражнению в выбранном режиме */
function modeDefaults(ex, mode) {
  const m = MODES[mode] || MODES.mid;
  if (ex.type === 'cardio') return { sets: 1, rmin: 0, rmax: 0 };
  if (ex.type === 'time') return { sets: 3, rmin: 0, rmax: 0 };
  // в силовом режиме изолирующие упражнения остаются на 8–12: тяжёлый вес в них бьёт по суставам
  if (mode === 'str' && !isCompound(ex)) return { sets: 3, rmin: 8, rmax: 12 };
  return { sets: m.sets, rmin: m.rmin, rmax: m.rmax };
}
/* План по строке программы; в поле могло остаться пустое или перепутанное значение */
function itemPlan(ex, it) {
  const sets = clampInt(it.sets, 1, 12, 3);
  if (ex.type === 'time' || ex.type === 'cardio') return { sets, rmin: 0, rmax: 0 };
  const a = clampInt(it.rmin, 1, 100, 8), b = clampInt(it.rmax, 1, 100, a);
  return { sets, rmin: Math.min(a, b), rmax: Math.max(a, b) };
}
function repsText(p) { return p.rmin === p.rmax ? String(p.rmin) : p.rmin + '–' + p.rmax; }
function planMode(p) { return !p.rmax ? null : p.rmax <= 6 ? 'str' : p.rmin >= 12 ? 'hi' : 'mid'; }
function planText(ex, p) {
  if (ex.type === 'cardio') return null;
  const sets = p.sets + ' ' + plural(p.sets, 'подход', 'подхода', 'подходов');
  if (ex.type === 'time') return 'План: ' + sets;
  return 'План: ' + p.sets + ' × ' + repsText(p) + ' · отдых ' + MODES[planMode(p)].restText;
}

function programDays() { return S.program ? S.program.days : []; }
function programDay(id) { return programDays().find(d => d.id === id) || null; }
function dayItems(day) { return day.items.filter(it => exById(it.exId)); }
function dayTitle(day) { return (day.name || '').trim() || 'День ' + (programDays().indexOf(day) + 1); }
function filledDays() { return programDays().filter(d => dayItems(d).length); }

/* План упражнения в тренировке d (черновик или запись): из дня программы или из выбранного режима */
function planFor(d, ex) {
  if (!d) return null;
  const day = d.dayId ? programDay(d.dayId) : null;
  const item = day ? day.items.find(it => it.exId === ex.id) : null;
  if (item && (!d.mode || d.mode === day.mode)) return itemPlan(ex, item);
  if (MODES[d.mode]) return modeDefaults(ex, d.mode);
  return null;
}
/* По какому плану упражнение делается сейчас: по последней тренировке, иначе по программе */
function currentPlan(exId) {
  const ex = exById(exId);
  if (!ex) return null;
  const ws = sortedWorkouts();
  for (let i = ws.length - 1; i >= 0; i--) {
    if (ws[i].test || !ws[i].entries.some(en => en.exId === exId)) continue;
    const p = planFor(ws[i], ex);
    if (p) return p;
    break;
  }
  for (const day of programDays()) {
    const it = day.items.find(x => x.exId === exId);
    if (it) return itemPlan(ex, it);
  }
  return null;
}

function lastProgramWorkout() {
  const ws = sortedWorkouts();
  for (let i = ws.length - 1; i >= 0; i--) if (ws[i].dayId && programDay(ws[i].dayId)) return ws[i];
  return null;
}
/* Дни идут по кругу: следующий после последнего выполненного */
function nextProgramDay() {
  const days = filledDays();
  if (!days.length) return null;
  const lw = lastProgramWorkout();
  if (!lw) return days[0];
  const all = programDays(), i = all.findIndex(d => d.id === lw.dayId);
  for (let k = 1; k <= all.length; k++) {
    const d = all[(i + k) % all.length];
    if (dayItems(d).length) return d;
  }
  return days[0];
}
function weekProgress() {
  const from = weekStart(todayStr());
  return { done: S.workouts.filter(w => w.dayId && programDay(w.dayId) && w.date >= from).length, plan: S.program ? S.program.perWeek : 0 };
}

/* Сколько подходов в неделю программа даёт каждой группе мышц */
function programWeekSets() {
  const days = filledDays(), res = {};
  if (!days.length) return res;
  const k = S.program.perWeek / days.length;
  for (const d of days) for (const it of dayItems(d)) {
    const ex = exById(it.exId);
    if (ex.muscle === 'cardio') continue;
    res[ex.muscle] = (res[ex.muscle] || 0) + itemPlan(ex, it).sets * k;
  }
  return res;
}

/* Замечания к самой программе: травмы, баланс, объём, режимы */
function programRemarks() {
  const out = [];
  const days = programDays();
  if (!days.length) return out;
  const filled = filledDays();

  const bad = [], soft = [];
  for (const d of filled) for (const it of dayItems(d)) {
    const ex = exById(it.exId), v = injuryVerdict(ex);
    if (v.level === 3 && !bad.some(b => b.ex === ex)) bad.push({ ex, inj: v.inj });
    if (v.level === 2 && !soft.some(b => b.ex === ex)) soft.push({ ex, pct: v.pct });
  }
  if (bad.length) {
    const alts = [];
    for (const m of Array.from(new Set(bad.map(b => b.ex.muscle)))) {
      const safe = allExercises().filter(e => e.muscle === m && injuryVerdict(e).level <= 1).slice(0, 2);
      if (safe.length) alts.push(MUSCLES[m].toLowerCase() + ' — ' + safe.map(e => e.name).join(', '));
    }
    out.push({ k: 'danger', act: 'openProgram', title: 'В программе есть упражнения под запретом',
      text: 'Пока травма не зажила, уберите: ' + bad.map(b => b.ex.name).join(', ') + '.' + (alts.length ? ' Чем заменить: ' + alts.join('; ') + '.' : '') });
  }
  if (soft.length) {
    out.push({ k: 'warn', act: 'openProgram', title: 'Часть программы — в щадящем режиме',
      text: soft.map(b => b.ex.name + ' (−' + b.pct + ' %)').join(', ') + '. Из-за травмы берите вес меньше и делайте 12–15 повторов, даже если день силовой.' });
  }

  const empty = days.filter(d => !dayItems(d).length);
  if (empty.length) {
    out.push({ k: 'info', act: 'openProgram', title: 'Есть пустые дни',
      text: 'Добавьте упражнения: ' + empty.map(dayTitle).join(', ') + '. Пустые дни в очередь тренировок не попадают.' });
  }
  if (!filled.length) return out;

  const ws = programWeekSets();
  const g = k => ws[k] || 0, rd = v => Math.round(v);
  const push = g('chest') + g('shoulders') + g('triceps');
  const pull = g('back') + g('biceps');
  const legs = g('legs') + g('glutes') + g('calves');
  const total = push + pull + legs + g('core');
  const legInj = activeInjuries().some(i => ['knee', 'hip', 'ankle', 'lower_back'].includes(i.area));
  const major = [['chest', 'грудь', g('chest')], ['back', 'спину', g('back')], ['legs', 'ноги', legs]];

  const missing = major.filter(m => m[2] === 0 && !(m[0] === 'legs' && legInj));
  if (missing.length) {
    out.push({ k: 'warn', act: 'openProgram', title: 'В программе нет упражнений на ' + missing.map(m => m[1]).join(' и '),
      text: 'Без них тело развивается неравномерно, а рейтинг силы остаётся неполным.' });
  }
  if (pull > 0 && push + pull >= 10 && push > pull * 1.5) {
    out.push({ k: 'warn', act: 'openProgram', title: 'В программе жимов больше, чем тяг',
      text: 'В неделю выходит около ' + rd(push) + ' ' + plural(rd(push), 'подхода', 'подходов', 'подходов') + ' на жимовые группы против ' + rd(pull) + ' на тяговые. Добавьте тяги — так плечи и осанка будут здоровее.' });
  }
  if (legs > 0 && total >= 15 && legs < total * 0.18 && !legInj) {
    out.push({ k: 'warn', act: 'openProgram', title: 'В программе мало работы на ноги',
      text: 'На ноги приходится ' + rd(100 * legs / total) + ' % подходов. Ориентир — 25–35 %.' });
  }
  // перебор считаем по самой группе: ягодицы и икры к ногам здесь не прибавляем
  const over = [['chest', '', g('chest')], ['back', '', g('back')], ['legs', '', g('legs')]].filter(m => m[2] > 24);
  if (over.length) {
    out.push({ k: 'warn', act: 'openProgram', title: 'Слишком большой объём',
      text: over.map(m => MUSCLES[m[0]] + ' — около ' + rd(m[2])).join(', ') + ' подходов в неделю. Обычно хватает 10–20 на группу: сверх этого растёт усталость, а не результат.' });
  }
  const low = major.filter(m => m[2] > 0 && m[2] < 6);
  if (low.length) {
    out.push({ k: 'info', act: 'openProgram', title: 'Маловато объёма',
      text: low.map(m => MUSCLES[m[0]] + ' — около ' + rd(m[2])).join(', ') + ' подходов в неделю. Для роста группе обычно нужно от 8–10. Добавьте подход или упражнение.' });
  }
  const heavy = filled.filter(d => dayItems(d).reduce((s, it) => s + itemPlan(exById(it.exId), it).sets, 0) > 26);
  if (heavy.length) {
    out.push({ k: 'warn', act: 'openProgram', title: 'Перегруженный день: ' + heavy.map(dayTitle).join(', '),
      text: 'В нём больше 26 подходов. После 20–25 качество работы падает — разнесите упражнения по дням.' });
  }

  const modes = filled.map(d => d.mode);
  if (modes.every(m => m === 'str') && S.program.perWeek >= 4) {
    out.push({ k: 'warn', act: 'openProgram', title: 'Все дни силовые',
      text: 'Тяжёлая работа на 4–6 повторов ' + S.program.perWeek + ' ' + plural(S.program.perWeek, 'раз', 'раза', 'раз') + ' в неделю плохо восстанавливается. Сделайте один-два дня «На массу» или «Многоповторку».' });
  }
  if (modes.every(m => m === 'hi')) {
    out.push({ k: 'info', act: 'openProgram', title: 'Только многоповторка',
      text: 'Выносливость и техника растут, а максимальная сила — медленно. Если цель — сила, переведите день с базовыми упражнениями в силовой режим.' });
  }
  if (S.profile.exp === 'new' && modes.includes('str')) {
    out.push({ k: 'info', act: 'openProgram', title: 'Силовой режим при небольшом стаже',
      text: 'Первые полгода лучше работать на 8–12 повторов: техника закрепляется на умеренных весах, а сила всё равно растёт.' });
  }
  return out;
}

/* Рабочий вес по расчётному максимуму: сколько можно поднять на reps повторов */
function niceW(v) { return v < 20 ? Math.round(v) : roundTo(v, 2.5); }
function weightForReps(oneRm, reps) { return niceW(oneRm / (1 + reps / 30)); }
function refMax(hist) {
  const h = hist.slice(-3);
  return h.length ? Math.max.apply(null, h.map(x => x.st.best1rm)) : 0;
}

/* Цель на тренировку по плану: {status, w, text}
   up — пора добавить вес, switch — вес пересчитан под другой диапазон, rep — добавить повтор, hold — добрать минимум */
function planTarget(ex, plan, hist) {
  const last = hist.length ? hist[hist.length - 1] : null;
  const rng = repsText(plan);
  if (ex.type === 'time') {
    return last ? { status: 'rep', text: fmtSec(last.st.maxSec + 5) + ' в лучшем подходе' } : null;
  }
  if (ex.type === 'bw') {
    if (!last) return { status: 'new', text: rng + ' ' + plural(plan.rmax, 'повтор', 'повтора', 'повторов') + ' в подходе' };
    const best = last.st.maxReps;
    if (best >= plan.rmax) return { status: 'up', text: 'добавьте отягощение 2,5–5 кг и работайте на ' + rng + ' — верх диапазона взят' };
    if (best + 1 < plan.rmin) return { status: 'rep', text: (best + 1) + ' ' + plural(best + 1, 'повтор', 'повтора', 'повторов') + ' в лучшем подходе. До плановых ' + rng + ' пока далеко — делайте подходы почти до отказа' };
    return { status: 'rep', text: (best + 1) + ' ' + plural(best + 1, 'повтор', 'повтора', 'повторов') + ' в лучшем подходе (план ' + rng + ')' };
  }
  if (ex.type !== 'w') return null;
  if (!last || !(last.st.maxW > 0)) {
    return { status: 'new', text: 'подберите вес, с которым ' + plan.rmax + '-й повтор даётся тяжело, но техника не ломается' };
  }
  const top = last.st.maxW, step = weightStep(ex);
  const topSets = last.sets.filter(s => (+s.w || 0) === top);
  const minR = Math.min.apply(null, topSets.map(s => +s.r));
  const ref = refMax(hist), calc = weightForReps(ref, plan.rmax);
  const recalc = w => ({ status: 'switch', w, text: fmtNum(w, 2) + ' кг × ' + rng + ' — вес подобран под этот диапазон по вашему расчётному максимуму ' + fmtNum(ref, 0) + ' кг' });
  if (minR >= plan.rmax) {
    if (minR > plan.rmax + 3) return recalc(Math.max(top + step, calc));
    if (topSets.length >= Math.min(2, plan.sets)) return { status: 'up', w: top + step, top, minR, n: topSets.length, text: fmtNum(top + step, 2) + ' кг × ' + rng + ' — пора добавить вес' };
    return { status: 'hold', w: top, text: fmtNum(top, 2) + ' кг × ' + rng + ' во всех ' + plan.sets + ' подходах, потом добавите вес' };
  }
  if (minR < plan.rmin) {
    const w = Math.min(top - step, calc);
    if (minR < plan.rmin - 2 && w > 0) return recalc(w);
    return { status: 'hold', w: top, text: fmtNum(top, 2) + ' кг × ' + plan.rmin + ' в каждом подходе — доберите нижнюю границу плана' };
  }
  return { status: 'rep', w: top, text: fmtNum(top, 2) + ' кг × ' + (minR + 1) + ' — добавьте повтор; на ' + plan.rmax + ' повторах прибавите вес' };
}

/* ---------- проверка силы ---------- */
function tests() { return sortedWorkouts().filter(w => w.test); }

/* Разбор одной проверки: уровни по каждому упражнению и сравнение с предыдущей */
function testSummary(w) {
  const sex = sexKey(), af = ageFactor(w.date), bw = bwAt(w.date);
  const earlier = tests().filter(x => x.date < w.date);
  const prev = earlier.length ? earlier[earlier.length - 1] : null;
  const rows = [];
  for (const en of w.entries) {
    const ex = exById(en.exId), st = entryStats(en, w.date);
    if (!ex || !st || !st.sets) continue;
    const pe = prev ? prev.entries.find(x => x.exId === en.exId) : null;
    const pst = pe ? entryStats(pe, prev.date) : null;
    const row = { ex, name: KEY_NAMES[ex.key] || ex.name, result: en.sets.filter(s => isValidSet(ex, s)).map(s => setText(ex, s)).join(', '), score: null, strength: false, delta: null };
    if (ex.type === 'w') {
      row.e1rm = st.best1rm;
      row.ratio = bw ? st.best1rm / bw : null;
      if (pst) row.delta = { v: st.best1rm - pst.best1rm, unit: 'кг' };
      row.work = { str: weightForReps(st.best1rm, 6), mid: weightForReps(st.best1rm, 12), hi: weightForReps(st.best1rm, 20) };
    } else if (ex.type === 'bw') {
      row.reps = st.maxReps;
      row.ratio = bw && st.best1rm ? st.best1rm / bw : null;
      if (pst) row.delta = { v: st.maxReps - pst.maxReps, unit: 'повт.' };
    } else {
      row.sec = st.maxSec;
      if (pst) row.delta = { v: st.maxSec - pst.maxSec, unit: 'сек' };
    }
    if (ex.key && STD[sex][ex.key]) {
      row.strength = true;
      if (row.ratio) row.score = scoreFrom(row.ratio * af, STD[sex][ex.key]);
    } else if (ESTD[sex][ex.id]) {
      row.score = scoreFrom((ex.type === 'time' ? st.maxSec : st.maxReps) * af, ESTD[sex][ex.id]);
    }
    rows.push(row);
  }
  const str = rows.filter(r => r.strength && r.score != null);
  const score = str.length ? str.reduce((s, r) => s + r.score, 0) / str.length : null;
  const weak = str.length >= 2 ? str.slice().sort((a, b) => a.score - b.score)[0] : null;
  const strong = str.length >= 2 ? str.slice().sort((a, b) => b.score - a.score)[0] : null;
  return { rows, score, bw, prev, weak, strong: strong && weak && strong.score - weak.score >= 12 ? strong : null };
}

/* Старт → сейчас: вес, базовые упражнения, обхваты */
function sortedMeasures() { return S.measures.slice().sort((a, b) => a.date.localeCompare(b.date)); }
function startVsNow() {
  const rows = [];
  const ws = sortedWeights();
  if (ws.length) rows.push({ name: 'Вес тела', unit: 'кг', a: ws[0].kg, b: ws[ws.length - 1].kg, date: ws[0].date, digits: 1, single: ws.length === 1 });
  for (const t of TEST_ITEMS) {
    const ex = exById(t.id), h = exHistory(t.id);
    if (!ex || !h.length) continue;
    const f = t.kind === 'w' ? 'best1rm' : t.kind === 'r' ? 'maxReps' : 'maxSec';
    rows.push({
      name: (KEY_NAMES[ex.key] || ex.name) + (t.kind === 'w' ? ', 1ПМ' : ''), unit: t.kind === 'w' ? 'кг' : t.kind === 'r' ? 'повт.' : 'сек',
      a: h[0].st[f], b: Math.max.apply(null, h.slice(-3).map(x => x.st[f])), date: h[0].date, digits: 0, single: h.length === 1, lift: true
    });
  }
  const ms = sortedMeasures();
  for (const k of Object.keys(GIRTHS)) {
    const have = ms.filter(m => +m[k] > 0);
    if (have.length) rows.push({ name: GIRTHS[k], unit: 'см', a: +have[0][k], b: +have[have.length - 1][k], date: have[0].date, digits: 1, single: have.length === 1 });
  }
  return rows;
}

/* plan — {sets, rmin, rmax} из программы или режима; без него работает общее правило */
function exerciseHint(exId, excludeWorkoutId, plan) {
  const ex = exById(exId);
  if (!ex) return null;
  const hist = exHistory(exId, excludeWorkoutId);
  const v = injuryVerdict(ex);
  const res = { last: null, lastSets: [], target: null, injury: null, plan: plan ? planText(ex, plan) : null };
  const last = hist.length ? hist[hist.length - 1] : null;
  if (last) res.lastSets = last.sets;
  if (last) res.last = 'В прошлый раз (' + fmtDate(last.date) + '): ' + last.sets.map(s => setText(ex, s)).join(', ');

  if (v.level === 3) {
    res.injury = { level: 3, text: 'Лучше исключить: травма — ' + injuryTitle(v.inj).toLowerCase() };
  } else if (v.level === 2) {
    let t = 'Снизьте нагрузку на ' + v.pct + ' % — травма: ' + injuryTitle(v.inj).toLowerCase();
    if (last && ex.type === 'w' && last.st.maxW > 0) t += '. Не тяжелее ' + fmtNum(roundTo(last.st.maxW * (1 - v.pct / 100), 2.5), 1) + ' кг, 12–15 повторов без боли';
    res.injury = { level: 2, text: t };
  } else if (v.level === 1) {
    res.injury = { level: 1, text: 'Осторожно, упражнение задевает травмированную зону: ' + injuryTitle(v.inj).toLowerCase() };
  }

  if (plan && v.level < 2) {
    const tg = planTarget(ex, plan, hist);
    if (tg) res.target = 'Цель: ' + tg.text;
  } else if (last && v.level < 2) {
    if (ex.type === 'w' && last.st.maxW > 0) {
      const top = last.st.maxW;
      const topSets = last.sets.filter(s => (+s.w || 0) === top);
      const minR = Math.min.apply(null, topSets.map(s => +s.r));
      if (topSets.length >= 2 && minR >= 10) res.target = 'Цель: ' + fmtNum(top + weightStep(ex), 2) + ' кг × 6–8 — пора добавить вес';
      else res.target = 'Цель: ' + fmtNum(top, 2) + ' кг × ' + (minR + 1) + ' — добавьте повтор';
    } else if (ex.type === 'bw') {
      res.target = 'Цель: ' + (last.st.maxReps + 1) + ' ' + plural(last.st.maxReps + 1, 'повтор', 'повтора', 'повторов') + ' в лучшем подходе';
    } else if (ex.type === 'time') {
      res.target = 'Цель: ' + fmtSec(last.st.maxSec + 5);
    }
  }
  return res;
}

/* Рекорды, поставленные в конкретной тренировке */
function workoutPRs(w) {
  const prs = [];
  const seen = new Set();
  for (const en of w.entries) {
    const ex = exById(en.exId);
    if (!ex || seen.has(en.exId)) continue;
    seen.add(en.exId);
    const hist = exHistory(en.exId).filter(h => h.date <= w.date);
    const cur = hist.find(h => h.date === w.date);
    const prev = hist.filter(h => h.date < w.date);
    if (!cur || !prev.length) continue;
    const metric = ex.type === 'w' ? 'best1rm' : ex.type === 'bw' ? 'maxReps' : ex.type === 'time' ? 'maxSec' : 'km';
    const prevBest = Math.max.apply(null, prev.map(h => h.st[metric]));
    if (cur.st[metric] > prevBest * 1.001) prs.push(ex.name);
  }
  return prs;
}

/* ---------- общие рекомендации ---------- */
function recommendations() {
  const out = [];
  const t = todayStr();
  const ws = sortedWorkouts();

  // травмы — в первую очередь
  for (const inj of activeInjuries()) {
    const stage = injuryStage(inj);
    out.push({ k: stage.k === 'good' ? 'good' : stage.k === 'danger' ? 'danger' : 'warn', title: 'Травма: ' + injuryTitle(inj).toLowerCase() + ' — ' + stage.title.toLowerCase(), text: stage.text, go: 'injuries' });
  }
  // нарушения ограничений за последние 14 дней
  const broken = new Map();
  for (const w of ws) {
    if (daysDiff(w.date, t) > 14) continue;
    for (const en of w.entries) {
      const ex = exById(en.exId);
      if (!ex) continue;
      for (const inj of activeInjuries()) {
        if (w.date >= inj.date && levelFor(ex, inj) === 3) broken.set(ex.id, { ex, inj });
      }
    }
  }
  if (broken.size) {
    const names = Array.from(broken.values()).slice(0, 3).map(b => b.ex.name).join(', ');
    out.push({ k: 'danger', title: 'Вы нагружали травмированную зону', text: 'За последние две недели в тренировках было: ' + names + '. При активной травме эти упражнения стоит убрать — откройте раздел «Травмы», там есть замены.', go: 'injuries' });
  }

  if (!ws.length) {
    out.push({ k: 'info', title: 'Запишите первую тренировку', text: 'Нажмите «Начать тренировку», добавьте упражнения и подходы — графики и рейтинги появятся автоматически.' });
  }
  if (!S.weights.length) {
    out.push({ k: 'info', title: 'Укажите вес тела', text: 'Рейтинг силы считается относительно веса тела. Добавьте его в профиле.', go: 'profile' });
  }
  // цель: темп изменения веса и соответствие программы цели (похвалу оставляем для экрана питания)
  for (const r of goalAdvice()) if (r.k !== 'good' && r.title !== 'Взвешивайтесь раз в неделю') out.push(r);

  // своя программа и проверка силы
  const filled = filledDays();
  if (!S.program) {
    out.push({ k: 'info', act: 'openProgram', title: 'Составьте свою программу', text: 'Впишите дни и упражнения, выберите режим — силовой или многоповторку. Приложение будет подсказывать веса и повторы под ваш план.' });
  } else {
    let nWarn = 0;   // на главной — запреты и два самых важных замечания, остальное видно в самой программе
    for (const r of programRemarks()) if (r.k === 'danger' || (r.k === 'warn' && nWarn++ < 2)) out.push(r);
  }
  const ts = tests();
  if (!ts.length) {
    out.push({ k: 'info', act: 'openTest', title: 'Пройдите проверку силы', text: 'Несколько базовых упражнений — и приложение определит ваш стартовый уровень и подберёт рабочие веса под каждый режим.' });
  } else {
    const tWeeks = Math.floor(daysDiff(ts[ts.length - 1].date, t) / 7);
    if (tWeeks >= 8) out.push({ k: 'info', act: 'openTest', title: 'Пора повторить проверку силы', text: 'С прошлой проверки ' + plural(tWeeks, 'прошла', 'прошло', 'прошло') + ' ' + tWeeks + ' ' + plural(tWeeks, 'неделя', 'недели', 'недель') + '. Повторите её — увидите, насколько выросли показатели.' });
  }
  if (!ws.length) return out;

  // выполнение программы
  const lp = lastProgramWorkout();
  if (lp && daysDiff(lp.date, t) <= 10) {
    const day = programDay(lp.dayId);
    const doneIds = lp.entries.map(en => en.exId);
    const skipped = dayItems(day).filter(it => !doneIds.includes(it.exId) && injuryVerdict(exById(it.exId)).level < 3).map(it => exById(it.exId).name);
    if (skipped.length) out.push({ k: 'info', act: 'openProgram', title: 'День программы выполнен не полностью', text: fmtDate(lp.date) + ', «' + dayTitle(day) + '»: пропущено — ' + skipped.slice(0, 4).join(', ') + '. Если упражнение не подходит, замените его в программе, чтобы план совпадал с тем, что вы делаете.' });
  }
  if (lp && filled.length && daysDiff(lp.date, t) <= 14) {
    const wp = weekProgress();
    const wd = (parseD(t).getDay() + 6) % 7;
    const daysLeft = 7 - wd - (ws.some(w => w.date === t && !w.test) ? 1 : 0);
    const left = wp.plan - wp.done;
    if (left > 0 && left > daysLeft) out.push({ k: 'warn', title: 'Неделя идёт с отставанием от программы', text: 'По плану ' + wp.plan + ' ' + plural(wp.plan, 'тренировка', 'тренировки', 'тренировок') + ' в неделю, сделано ' + wp.done + ', а дней осталось ' + daysLeft + '. Не навёрстывайте двумя тренировками в день — просто продолжайте по очереди.' });
  }

  // режим
  const last = ws[ws.length - 1];
  const gap = daysDiff(last.date, t);
  const n7 = ws.filter(w => { const d = daysDiff(w.date, t); return d >= 0 && d < 7; }).length;
  if (gap >= 14) out.push({ k: 'warn', title: 'Перерыв ' + gap + ' ' + plural(gap, 'день', 'дня', 'дней'), text: 'После паузы начните с 80–85 % прежних весов и вернитесь к рабочим за 1–2 недели.' });
  else if (gap >= 7) out.push({ k: 'info', title: 'Неделя без тренировок', text: 'Последняя тренировка была ' + fmtDate(last.date) + '. Для роста силы каждой группе мышц нужна нагрузка хотя бы раз в 5–7 дней.' });
  if (n7 >= 6) out.push({ k: 'warn', title: 'Мало отдыха', text: n7 + ' тренировок за 7 дней. Оставьте хотя бы 1–2 дня полного отдыха — мышцы растут во время восстановления.' });

  // рекорды последней тренировки
  const prs = workoutPRs(last);
  if (prs.length && gap <= 7) out.push({ k: 'good', title: 'Новый рекорд!', text: fmtDate(last.date) + ': ' + prs.slice(0, 4).join(', ') + '.' });

  // прогрессия и плато
  let nUp = 0, nPlateau = 0;
  for (const id of usedExerciseIds()) {
    const ex = exById(id);
    if (!ex || ex.type !== 'w') continue;
    const hist = exHistory(id);
    const lastH = hist[hist.length - 1];
    if (daysDiff(lastH.date, t) > 21) continue;
    if (injuryVerdict(ex).level >= 2) continue;
    const plan = currentPlan(id);
    if (plan) {
      const tg = planTarget(ex, plan, hist);
      if (tg && tg.status === 'up' && nUp < 3) {
        nUp++;
        out.push({ k: 'good', title: 'Пора добавить вес: ' + ex.name, text: 'По плану ' + repsText(plan) + ' повторов, а вы сделали ' + tg.n + ' ' + plural(tg.n, 'подход', 'подхода', 'подходов') + ' по ' + tg.minR + ' с ' + fmtNum(tg.top, 2) + ' кг. В следующий раз — ' + fmtNum(tg.w, 2) + ' кг на ' + repsText(plan) + '.' });
        continue;
      }
    }
    const top = lastH.st.maxW;
    const topSets = lastH.sets.filter(s => (+s.w || 0) === top);
    const minR = Math.min.apply(null, topSets.map(s => +s.r));
    if (!plan && top > 0 && topSets.length >= 2 && minR >= 10 && nUp < 3) {
      nUp++;
      out.push({ k: 'good', title: 'Пора добавить вес: ' + ex.name, text: 'Вы сделали ' + topSets.length + ' ' + plural(topSets.length, 'подход', 'подхода', 'подходов') + ' по ' + minR + ' и больше повторов с ' + fmtNum(top, 2) + ' кг. В следующий раз попробуйте ' + fmtNum(top + weightStep(ex), 2) + ' кг на 6–8 повторов.' });
      continue;
    }
    if (hist.length >= 6 && nPlateau < 2) {
      const a = Math.max.apply(null, hist.slice(-3).map(h => h.st.best1rm));
      const b = Math.max.apply(null, hist.slice(-6, -3).map(h => h.st.best1rm));
      if (a <= b * 1.005) {
        nPlateau++;
        out.push({ k: 'warn', title: 'Плато: ' + ex.name, text: 'Расчётный максимум не растёт уже 6 тренировок. Сделайте разгрузочную неделю (−10–15 % веса) или ' + (
          !plan ? 'смените диапазон повторов: например, 5 × 5 вместо 3 × 10.'
          : planMode(plan) === 'str' ? 'на 3–4 недели переведите упражнение в режим «На массу» (8–12 повторов), затем вернитесь к силовому.'
          : planMode(plan) === 'hi' ? 'на 3–4 недели переведите упражнение в силовой режим (4–6 повторов).'
          : 'на 3–4 недели смените режим: силовой (4–6 повторов) или многоповторка (15–20).') });
      }
    }
  }

  // баланс мышечных групп за 4 недели
  const ms = muscleSets(28);
  const g = k => ms[k] || 0;
  const push = g('chest') + g('shoulders') + g('triceps');
  const pull = g('back') + g('biceps');
  const legs = g('legs') + g('glutes') + g('calves');
  const total = push + pull + legs + g('core');
  if (total >= 30) {
    const kneeOrBack = activeInjuries().some(i => ['knee', 'hip', 'ankle', 'lower_back'].includes(i.area));
    if (push > pull * 1.5) out.push({ k: 'warn', title: 'Жимов больше, чем тяг', text: 'За 4 недели: ' + push + ' подходов на жимовые группы против ' + pull + ' на тяговые. Перекос ведёт к сутулости и болям в плечах — добавьте тяги.' });
    if (legs < total * 0.18 && !kneeOrBack) out.push({ k: 'warn', title: 'Мало работы на ноги', text: 'На ноги приходится ' + Math.round(100 * legs / total) + ' % подходов. Ориентир — 25–35 %.' });
  }
  const er = enduranceRating();
  const cardio = er.items.find(i => i.key === 'cardio');
  if (ws.length >= 6 && cardio && !cardio.has) {
    out.push({ k: 'info', title: 'Добавьте кардио', text: 'За 4 недели нет ни одной кардио-сессии. 2 раза по 20–30 минут в неделю улучшают восстановление между подходами и рейтинг выносливости.' });
  }
  return out;
}

/* ---------- демо-данные ---------- */
function buildDemoState() {
  const st = defaultState();
  st.profile = Object.assign({}, S.profile);
  if (!st.profile.height) st.profile.height = 180;
  if (!st.profile.birthYear) st.profile.birthYear = new Date().getFullYear() - 27;
  const t = todayStr();
  const start = weekStart(addDays(t, -7 * 11));
  const r25 = v => Math.round(v / 2.5) * 2.5;
  const mk = (exId, sets) => ({ exId, sets });
  const wsets = (w, reps) => reps.map(r => ({ w, r }));
  for (let wk = 0; wk < 12; wk++) {
    const mon = addDays(start, wk * 7);
    const odd = wk % 2;
    st.weights.push({ date: mon, kg: Math.round((78 + wk * 0.22) * 10) / 10 });
    const days = [
      { d: 0, entries: [
        mk('bench', wsets(r25(60 + wk * 2), odd ? [8, 8, 7] : [8, 7, 6])),
        mk('ohp', wsets(r25(35 + wk * 1), [8, 7, 6])),
        mk('dips', [{ w: 0, r: 6 + Math.floor(wk / 2) }, { w: 0, r: 5 + Math.floor(wk / 2) }]),
        mk('pushdown', wsets(r25(20 + wk * 0.9), [12, 12, 10])),
        mk('pushup', [{ w: 0, r: 20 + wk }])
      ] },
      { d: 2, entries: [
        mk('deadlift', wsets(r25(90 + wk * 3.5), [5, 5, 5])),
        mk('pullup', [{ w: 0, r: 5 + Math.floor(wk / 2) }, { w: 0, r: 4 + Math.floor(wk / 2) }, { w: 0, r: 4 + Math.floor(wk / 3) }]),
        mk('bb_row', wsets(r25(50 + wk * 1.8), [10, 9, 8])),
        mk('db_curl', wsets(12 + Math.floor(wk / 3) * 2, [12, 10, 10])),
        mk('plank', [{ sec: 60 + wk * 7 }])
      ] },
      { d: 4, entries: [
        mk('squat', wsets(r25(70 + wk * 3), odd ? [6, 6, 5] : [8, 7, 6])),
        mk('leg_press', wsets(r25(120 + wk * 5), [12, 10, 10])),
        mk('rdl', wsets(r25(60 + wk * 2.2), [10, 10, 8])),
        mk('calf_raise', wsets(r25(60 + wk * 1.8), [15, 12, 12]))
      ] }
    ];
    if (odd) days.push({ d: 5, entries: [mk('run', [{ km: 3 + Math.floor(wk / 4), min: Math.round((3 + Math.floor(wk / 4)) * (6.5 - wk * 0.08) * 10) / 10 }])] });
    for (const day of days) {
      const date = addDays(mon, day.d);
      if (date > t) continue;
      const w = { id: 'demo' + wk + '_' + day.d, date, note: '', entries: day.entries };
      const pd = { 0: 'demoA', 2: 'demoB', 4: 'demoC' }[day.d];
      if (pd) { w.dayId = pd; w.mode = pd === 'demoB' ? 'str' : 'mid'; }
      st.workouts.push(w);
    }
  }
  st.weights = st.weights.filter(w => w.date <= t);

  const it = (exId, sets, rmin, rmax) => ({ exId, sets, rmin, rmax });
  st.program = { name: 'Три дня в неделю', perWeek: 3, days: [
    { id: 'demoA', name: 'Грудь и плечи', mode: 'mid', items: [it('bench', 3, 8, 12), it('ohp', 3, 8, 12), it('dips', 2, 8, 12), it('pushdown', 3, 8, 12), it('pushup', 1, 8, 12)] },
    { id: 'demoB', name: 'Спина', mode: 'str', items: [it('deadlift', 3, 4, 6), it('pullup', 3, 4, 6), it('bb_row', 3, 4, 6), it('db_curl', 3, 8, 12), it('plank', 1, 0, 0)] },
    { id: 'demoC', name: 'Ноги', mode: 'mid', items: [it('squat', 3, 8, 12), it('leg_press', 3, 8, 12), it('rdl', 3, 8, 12), it('calf_raise', 3, 8, 12)] }
  ] };
  // цель и питание: набор массы, записи о еде почти за все последние дни
  Object.assign(st.profile, { goal: 'gain', focus: 'mid', goalKg: 84, perWeek: 3, onboarded: true });
  const meals = [['Завтрак', 720, 34], ['Обед', 1000, 50], ['Ужин', 880, 46], ['Перекус', 420, 20]];
  for (let i = 9; i >= 0; i--) {
    if (i === 6 || i === 3) continue;
    meals.forEach((m, j) => {
      if (i === 0 && j > 1) return;   // сегодня день ещё не закончен
      st.food.push({ id: 'demoF' + i + '_' + j, date: addDays(t, -i), kcal: m[1] + ((i * 37 + j * 53) % 9 - 4) * 20, protein: m[2] + (i + j) % 5 - 2, note: m[0] });
    });
  }
  const t0 = addDays(start, -2);
  st.profile.startDate = t0;
  if (!st.profile.exp) st.profile.exp = 'mid';
  st.weights.unshift({ date: t0, kg: 77.8 });
  st.measures = [{ date: t0, chest: 98, waist: 84, biceps: 34, thigh: 55 }, { date: t, chest: 100.5, waist: 83, biceps: 35.5, thigh: 57 }];
  st.workouts.unshift({ id: 'demoTest', date: t0, note: 'Проверка силы', test: true, entries: [
    mk('bench', [{ w: 55, r: 5 }]), mk('squat', [{ w: 65, r: 5 }]), mk('deadlift', [{ w: 85, r: 5 }]),
    mk('ohp', [{ w: 32.5, r: 5 }]), mk('bb_row', [{ w: 45, r: 8 }]),
    mk('pullup', [{ w: 0, r: 4 }]), mk('pushup', [{ w: 0, r: 18 }]), mk('plank', [{ sec: 55 }])
  ] });
  return st;
}
