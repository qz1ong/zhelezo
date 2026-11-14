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

function exerciseHint(exId, excludeWorkoutId) {
  const ex = exById(exId);
  if (!ex) return null;
  const hist = exHistory(exId, excludeWorkoutId);
  const v = injuryVerdict(ex);
  const res = { last: null, lastSets: [], target: null, injury: null };
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

  if (last && v.level < 2) {
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
  if (!ws.length) return out;

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
    const top = lastH.st.maxW;
    const topSets = lastH.sets.filter(s => (+s.w || 0) === top);
    const minR = Math.min.apply(null, topSets.map(s => +s.r));
    if (top > 0 && topSets.length >= 2 && minR >= 10 && nUp < 3) {
      nUp++;
      out.push({ k: 'good', title: 'Пора добавить вес: ' + ex.name, text: 'Вы сделали ' + topSets.length + ' ' + plural(topSets.length, 'подход', 'подхода', 'подходов') + ' по ' + minR + ' и больше повторов с ' + fmtNum(top, 2) + ' кг. В следующий раз попробуйте ' + fmtNum(top + weightStep(ex), 2) + ' кг на 6–8 повторов.' });
      continue;
    }
    if (hist.length >= 6 && nPlateau < 2) {
      const a = Math.max.apply(null, hist.slice(-3).map(h => h.st.best1rm));
      const b = Math.max.apply(null, hist.slice(-6, -3).map(h => h.st.best1rm));
      if (a <= b * 1.005) {
        nPlateau++;
        out.push({ k: 'warn', title: 'Плато: ' + ex.name, text: 'Расчётный максимум не растёт уже 6 тренировок. Сделайте разгрузочную неделю (−10–15 % веса) или смените диапазон повторов: например, 5 × 5 вместо 3 × 10.' });
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
      st.workouts.push({ id: 'demo' + wk + '_' + day.d, date, note: '', entries: day.entries });
    }
  }
  st.weights = st.weights.filter(w => w.date <= t);
  return st;
}
