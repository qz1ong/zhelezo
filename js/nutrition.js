'use strict';
/* Цель, питание и калории, первый запуск, готовые программы */

/* ---------- расчёты ---------- */
/* Сколько тренировок в неделю на самом деле: по записям за 4 недели, иначе по программе или анкете */
function weeklyRate() {
  const from = addDays(todayStr(), -27);
  const n = S.workouts.filter(w => !w.test && w.date >= from).length;
  if (n) return n / 4;
  return S.program ? S.program.perWeek : (+S.profile.perWeek || 0);
}

/* Норма калорий: обмен по формуле Миффлина — Сан Жеора × активность, с поправкой на цель */
function energyPlan() {
  const p = S.profile, bw = currentBW(), h = +p.height, age = ageAt(todayStr());
  const res = { ok: false, missing: [] };
  if (!bw) res.missing.push('вес');
  if (!h) res.missing.push('рост');
  if (!age) res.missing.push('год рождения');
  if (res.missing.length) return res;
  const female = sexKey() === 'f';
  const bmr = 10 * bw + 6.25 * h - 5 * age + (female ? -161 : 5);
  const rate = weeklyRate();
  const af = rate >= 5 ? 1.7 : rate >= 3 ? 1.55 : rate >= 1 ? 1.4 : 1.3;
  const tdee = bmr * af;
  const g = GOALS[p.goal];
  const minor = age < 18;
  let k = g ? g.kcal : 0;
  if (minor && k < 0) k = 0;                       // до 18 лет дефицит не предлагаем
  const floor = female ? 1200 : 1500;              // ниже этого норму не опускаем
  const auto = Math.max(floor, Math.round(tdee * (1 + k) / 50) * 50);
  const custom = +p.kcalTarget >= 800 && +p.kcalTarget <= 6000 ? Math.round(+p.kcalTarget) : 0;
  return {
    ok: true, bw, bmr: Math.round(bmr), af, rate, tdee: Math.round(tdee / 10) * 10, auto, target: custom || auto, custom: !!custom,
    protein: Math.round(bw * (g ? g.protein : 1.6) / 5) * 5, minor, goal: g ? p.goal : ''
  };
}

function foodDay(date) {
  const list = S.food.filter(f => f.date === date);
  return {
    list, kcal: list.reduce((s, f) => s + (+f.kcal || 0), 0),
    protein: list.reduce((s, f) => s + (+f.protein || 0), 0), hasProtein: list.some(f => +f.protein > 0)
  };
}
/* Средние за последние days дней до сегодняшнего (он ещё не закончен); в расчёт идут только дни с записями */
function foodStats(days) {
  const t = todayStr();
  let logged = 0, kcal = 0, pDays = 0, prot = 0;
  for (let i = 1; i <= days; i++) {
    const d = foodDay(addDays(t, -i));
    if (!d.list.length) continue;
    logged++; kcal += d.kcal;
    if (d.hasProtein) { pDays++; prot += d.protein; }
  }
  return { logged, avgKcal: logged ? kcal / logged : 0, proteinDays: pDays, avgProtein: pDays ? prot / pDays : 0 };
}
/* Куда идёт вес: наклон линии по записям за 4 недели, кг в неделю */
function weightTrend() {
  const from = addDays(todayStr(), -28);
  const ws = sortedWeights().filter(w => w.date >= from);
  if (ws.length < 2) return null;
  const span = daysDiff(ws[0].date, ws[ws.length - 1].date);
  if (span < 10) return null;
  const xs = ws.map(w => daysDiff(ws[0].date, w.date)), ys = ws.map(w => w.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
  return den ? { perWeek: num / den * 7, span, n: ws.length } : null;
}
function signed(v, digits) { return (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v), digits == null ? 1 : digits); }

/* Какой режим подходит под выбранный тип тренировок и цель */
function suggestedMode() {
  if (MODES[S.profile.focus]) return S.profile.focus;
  return 'mid';
}

/* Советы по цели: темп изменения веса и соответствие программы цели */
function goalAdvice() {
  const out = [];
  const p = S.profile, g = GOALS[p.goal], bw = currentBW();
  if (!g) {
    out.push({ k: 'info', act: 'openGoal', title: 'Выберите цель', text: 'Похудеть, набрать массу или держать форму — от цели зависят норма калорий и советы по тренировкам.' });
    return out;
  }
  const kg = +p.goalKg;
  if (bw && kg && ((p.goal === 'lose' && bw <= kg) || (p.goal === 'gain' && bw >= kg))) {
    out.push({ k: 'good', act: 'openGoal', title: 'Цель по весу достигнута', text: 'Сейчас ' + fmtNum(bw, 1) + ' кг при цели ' + fmtNum(kg, 1) + ' кг. Переключите цель на «Держать форму», чтобы закрепить результат.' });
    return out;
  }
  const tr = weightTrend();
  if (!tr) {
    out.push({ k: 'info', go: 'profile', title: 'Взвешивайтесь раз в неделю', text: 'Утром, натощак, в один и тот же день. По двум-трём записям за месяц будет видно, идёте ли вы к цели.' });
  } else if (bw) {
    const w = tr.perWeek, rate = signed(w, 2) + ' кг в неделю';
    if (p.goal === 'lose') {
      if (w > -0.1 && tr.span >= 14) out.push({ k: 'warn', act: 'openFood', title: 'Вес не снижается', text: 'За последние недели: ' + rate + '. Уберите 150–200 ккал в день (сладкие напитки, перекусы) или добавьте две кардио-сессии по 30 минут.' });
      else if (w < -bw * 0.01) out.push({ k: 'warn', act: 'openFood', title: 'Вес уходит слишком быстро', text: rate + ' — это больше 1 % веса тела. Так вместе с жиром теряются мышцы и сила. Добавьте 200–300 ккал в день.' });
      else if (w <= -0.1) out.push({ k: 'good', title: 'Хороший темп похудения', text: rate + '. Сила при таком темпе сохраняется — продолжайте.' });
    } else if (p.goal === 'gain') {
      if (w < 0.05 && tr.span >= 14) out.push({ k: 'warn', act: 'openFood', title: 'Вес не растёт', text: 'За последние недели: ' + rate + '. Добавьте 150–200 ккал в день: стакан молока и банан, горсть орехов или порция крупы.' });
      else if (w > bw * 0.006) out.push({ k: 'warn', act: 'openFood', title: 'Вес растёт слишком быстро', text: rate + '. Быстрее 0,5 % веса тела в неделю — это в основном жир. Убавьте 150–200 ккал в день.' });
      else if (w >= 0.05) out.push({ k: 'good', title: 'Хороший темп набора', text: rate + '. Прибавка идёт без лишнего жира — продолжайте.' });
    } else if (Math.abs(w) > 0.3) {
      out.push({ k: 'info', act: 'openFood', title: 'Вес понемногу ' + (w > 0 ? 'растёт' : 'снижается'), text: rate + '. Если хотите держать вес, ' + (w > 0 ? 'уберите' : 'добавьте') + ' около 150 ккал в день.' });
    } else {
      out.push({ k: 'good', title: 'Вес стабилен', text: rate + ' — в пределах обычных колебаний.' });
    }
  }
  const modes = filledDays().map(d => d.mode);
  if (modes.length && modes.every(m => m === 'hi')) {
    if (p.goal === 'lose') out.push({ k: 'info', act: 'openProgram', title: 'На похудении нужны и тяжёлые подходы', text: 'В программе только многоповторка. Оставьте базовые упражнения в режиме «Силовой» или «На массу» — тяжёлая работа говорит телу сохранять мышцы при дефиците калорий.' });
    if (p.goal === 'gain') out.push({ k: 'info', act: 'openProgram', title: 'Для набора массы лучше 8–12 повторов', text: 'В программе только многоповторка. Переведите базовые упражнения в режим «На массу» — в нём мышцы растут быстрее.' });
  }
  if (p.goal === 'lose' && S.workouts.length >= 4) {
    const cardio = enduranceRating().items.find(i => i.key === 'cardio');
    if (cardio && !cardio.has) out.push({ k: 'info', title: 'Добавьте кардио к похудению', text: 'Две сессии по 20–30 минут в неделю (ходьба в горку, велотренажёр) дают дополнительный расход и почти не мешают восстановлению.' });
  }
  return out;
}

/* Советы по питанию: средние калории и белок против нормы */
function nutritionAdvice() {
  const out = [];
  const plan = energyPlan();
  if (!plan.ok) {
    out.push({ k: 'info', go: 'profile', title: 'Нужны данные для расчёта нормы', text: 'Укажите в профиле: ' + plan.missing.join(', ') + '. После этого появятся норма калорий и белка.' });
    return out.concat(goalAdvice().filter(r => r.act === 'openGoal'));
  }
  const g = GOALS[plan.goal];
  if (plan.minor && S.profile.goal === 'lose') {
    out.push({ k: 'info', title: 'Дефицит калорий до 18 лет — только с врачом', text: 'Организм ещё растёт, поэтому норма показана без дефицита. Лучший путь — регулярные тренировки и обычная еда без сладких напитков.' });
  }
  const st = foodStats(7);
  if (!st.logged) {
    out.push({ k: 'info', title: 'Записывайте, когда удобно', text: 'Вести питание необязательно. Но даже три-четыре записанных дня покажут, сколько вы едите на самом деле, — и совет станет точным.' });
  } else if (st.logged < 3) {
    out.push({ k: 'info', title: 'Пока мало записей', text: 'Записано дней за неделю: ' + st.logged + '. После трёх дней сравню среднее с вашей нормой.' });
  } else {
    const avg = Math.round(st.avgKcal / 10) * 10, diff = avg - plan.target, t = plan.target;
    const base = 'В среднем ' + fmtNum(avg, 0) + ' ккал в день при норме ' + fmtNum(t, 0) + '. ';
    if (avg < plan.bmr * 0.85) {
      out.push({ k: 'danger', title: 'Слишком мало еды', text: base + 'Это ниже того, что тело тратит в покое (' + fmtNum(plan.bmr, 0) + ' ккал). Так падает сила и теряются мышцы. Если вы записываете всё — прибавьте еду.' });
    } else if (plan.goal === 'lose') {
      if (diff > t * 0.1) out.push({ k: 'warn', title: 'Калорий больше, чем нужно для похудения', text: base + 'Лишние ' + fmtNum(diff, 0) + ' ккал проще всего убрать за счёт сладких напитков, соусов и перекусов.' });
      else if (diff < -t * 0.2) out.push({ k: 'warn', title: 'Дефицит слишком большой', text: base + 'Жёсткий дефицит трудно выдержать, и он бьёт по силе. Добавьте ' + fmtNum(-diff - t * 0.05, 0) + ' ккал — худеть будете чуть медленнее, но без срывов.' });
      else out.push({ k: 'good', title: 'Калории в норме для похудения', text: base + 'Держите этот уровень и следите за весом раз в неделю.' });
    } else if (plan.goal === 'gain') {
      if (diff < -t * 0.1) out.push({ k: 'warn', title: 'Для набора не хватает калорий', text: base + 'Не хватает около ' + fmtNum(-diff, 0) + ' ккал. Добавьте один плотный перекус: творог с бананом, бутерброд с сыром, орехи.' });
      else if (diff > t * 0.2) out.push({ k: 'warn', title: 'Калорий заметно больше нормы', text: base + 'Избыток сверх 10–15 % уходит в жир, а не в мышцы. Убавьте около ' + fmtNum(diff - t * 0.05, 0) + ' ккал.' });
      else out.push({ k: 'good', title: 'Калории в норме для набора', text: base + 'Теперь главное — прибавлять веса на тренировках.' });
    } else if (Math.abs(diff) > t * 0.15) {
      out.push({ k: 'info', title: 'Калории ' + (diff > 0 ? 'выше' : 'ниже') + ' расхода', text: base + (g ? 'Для удержания веса держитесь ближе к норме.' : 'Это ваш примерный расход; выберите цель, чтобы норма учитывала её.') });
    } else {
      out.push({ k: 'good', title: 'Калории на уровне расхода', text: base + 'Вес при таком питании должен стоять на месте.' });
    }
    if (st.proteinDays >= 3) {
      const ap = Math.round(st.avgProtein);
      if (ap < plan.protein * 0.8) out.push({ k: 'warn', title: 'Мало белка', text: 'В среднем ' + ap + ' г в день при цели ' + plan.protein + ' г. Добавьте порцию творога, яйца, курицу, рыбу или бобовые — белок нужен мышцам для восстановления' + (plan.goal === 'lose' ? ' и помогает дольше не чувствовать голод.' : '.') });
      else out.push({ k: 'good', title: 'Белка достаточно', text: 'В среднем ' + ap + ' г в день при цели ' + plan.protein + ' г.' });
    } else {
      out.push({ k: 'info', title: 'Отмечайте и белок', text: 'Ваша цель — около ' + plan.protein + ' г в день. Если вписывать граммы белка вместе с калориями, приложение подскажет, хватает ли его.' });
    }
  }
  return out.concat(goalAdvice());
}

/* ---------- экран «Питание» ---------- */
function foodRing(eaten, target) {
  const r = 42, c = 2 * Math.PI * r, p = target ? Math.min(1, eaten / target) : 0;
  return '<svg class="ring-svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="9"/>' +
    (p > 0 ? '<circle class="ring-arc" style="--c:' + c.toFixed(1) + '" cx="50" cy="50" r="' + r + '" fill="none" stroke="' + GREEN + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/>' : '') +
    '<text x="50" y="54" text-anchor="middle" class="food-num">' + fmtNum(eaten, 0) + '</text><text x="50" y="68" text-anchor="middle" class="food-sub">ккал</text></svg>';
}

function viewFood() {
  const t = todayStr();
  const date = DATE_RE.test(UI.foodDate || '') && UI.foodDate <= t ? UI.foodDate : t;
  const plan = energyPlan(), day = foodDay(date);
  let side;
  if (plan.ok) {
    const left = plan.target - day.kcal;
    side = '<b class="food-left">' + (left >= 0 ? 'Осталось ' + fmtNum(left, 0) : 'Сверх нормы ' + fmtNum(-left, 0)) + ' ккал</b>' +
      '<div class="muted small">Норма ' + fmtNum(plan.target, 0) + ' ккал' + (plan.custom ? ' · своя' : GOALS[plan.goal] ? ' · ' + GOALS[plan.goal].name.toLowerCase() : '') + '</div>' +
      '<div class="bar-top mt"><span class="small">Белок</span><span class="muted">' + (day.hasProtein ? fmtNum(day.protein, 0) : '—') + ' / ' + plan.protein + ' г</span></div>' +
      '<div class="bar"><i style="width:' + Math.min(100, 100 * day.protein / plan.protein) + '%;background:' + BLUE + '"></i></div>';
  } else {
    side = '<b class="food-left">Норма пока не посчитана</b><p class="muted small">Укажите в профиле: ' + plan.missing.join(', ') + '.</p>' +
      '<button class="btn small mt" data-act="go" data-tab="profile">Открыть профиль</button>';
  }
  const rows = day.list.map(f => '<div class="wk-ex"><span>' + esc(f.note || 'Запись') + '</span><span><b>' + fmtNum(+f.kcal, 0) + ' ккал</b>' +
    (+f.protein > 0 ? ' <span class="muted">· белок ' + fmtNum(+f.protein, 0) + ' г</span>' : '') +
    ' <button class="x" data-act="delFood" data-id="' + esc(f.id) + '" aria-label="Удалить запись">✕</button></span></div>').join('');

  const bars = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i), pd = parseD(d);
    bars.push({ label: pd.getDate() + '.' + String(pd.getMonth() + 1).padStart(2, '0'), y: Math.round(foodDay(d).kcal), tip: fmtDate(d) });
  }
  CHARTS.food = { type: 'bar', color: GREEN, unit: 'ккал', height: 190, bars, line: plan.ok ? plan.target : 0, empty: 'За две недели записей нет' };

  const adv = nutritionAdvice();
  const how = plan.ok
    ? '<p>Обмен в покое по формуле Миффлина — Сан Жеора: ' + fmtNum(plan.bmr, 0) + ' ккал. С учётом активности (тренировок в неделю: ' + fmtNum(plan.rate, 1) + ', коэффициент ' + plan.af + ') расход — около ' + fmtNum(plan.tdee, 0) + ' ккал.</p>' +
      '<p>' + (GOALS[plan.goal] ? 'Цель «' + GOALS[plan.goal].name + '»: ' + (GOALS[plan.goal].kcal ? signed(GOALS[plan.goal].kcal * 100, 0) + ' % к расходу' : 'без поправки') + ' — ' + fmtNum(plan.auto, 0) + ' ккал.' : 'Цель не выбрана, поэтому норма равна расходу.') +
      ' Белок — ' + (GOALS[plan.goal] ? GOALS[plan.goal].protein : 1.6) + ' г на килограмм веса.</p>'
    : '<p>Норма считается по росту, весу, возрасту, полу и числу тренировок в неделю.</p>';

  return '<header class="top"><h1>Питание</h1><div class="muted">Вести необязательно — записывайте, когда хочется</div></header>' +
    '<div class="card"><div class="food-top">' + foodRing(day.kcal, plan.ok ? plan.target : 0) + '<div>' + side + '</div></div></div>' +
    '<div class="card"><div class="form-grid"><label>Калории, ккал<input type="number" inputmode="numeric" min="1" max="10000" id="f-kcal" placeholder="450"></label>' +
    '<label>Белок, г — по желанию<input type="number" inputmode="decimal" min="0" max="500" id="f-prot" placeholder="30"></label>' +
    '<label>Что это<input type="text" id="f-note" maxlength="60" placeholder="Обед"></label>' +
    '<label>День<input type="date" data-ui="foodDate" value="' + date + '" max="' + t + '"></label></div>' +
    '<div class="chips">' + MEALS.map(m => '<button data-act="foodMeal" data-m="' + m + '">' + m + '</button>').join('') + '</div>' +
    '<div class="row-btns"><button class="btn primary" data-act="addFood">Записать</button></div></div>' +
    (rows ? '<h2>' + (date === t ? 'Сегодня' : fmtDateLong(date)) + '</h2><div class="card">' + rows + '</div>' : '') +
    '<h2>Калории за 14 дней</h2><div class="card"><div class="chart" data-chart="food"></div>' + (plan.ok ? '<p class="muted small">Пунктир — ваша норма.</p>' : '') + '</div>' +
    '<h2>Советы</h2>' + adv.map(recCard).join('') +
    '<details class="card"><summary>Как считается норма</summary>' + how +
    '<label>Своя норма, ккал — если знаете точнее<input type="number" inputmode="numeric" min="800" max="6000" data-profile="kcalTarget" value="' + (+S.profile.kcalTarget || '') + '" placeholder="' + (plan.ok ? plan.auto : '') + '"></label></details>' +
    '<p class="disclaimer">Расчёты приблизительные и не заменяют врача или диетолога. При беременности, болезнях и расстройствах пищевого поведения питание подбирает специалист.</p>';
}

/* Карточка цели на главной */
function goalCard() {
  const p = S.profile, g = GOALS[p.goal];
  const plan = energyPlan(), day = foodDay(todayStr()), bw = currentBW();
  if (!g && !day.list.length) return '';
  const tr = weightTrend();
  let line = g ? 'Цель: ' + g.name.toLowerCase() : 'Питание';
  if (bw && g) line += ' · ' + fmtNum(bw, 1) + (+p.goalKg ? ' → ' + fmtNum(+p.goalKg, 1) : '') + ' кг';
  const sub = [];
  if (tr) sub.push(signed(tr.perWeek, 2) + ' кг в неделю');
  if (plan.ok) sub.push(day.list.length ? 'сегодня ' + fmtNum(day.kcal, 0) + ' из ' + fmtNum(plan.target, 0) + ' ккал' : 'норма ' + fmtNum(plan.target, 0) + ' ккал');
  return '<button class="card goal-card" data-act="go" data-tab="food"><b>' + line + '</b>' +
    (sub.length ? '<div class="muted small">' + sub.join(' · ') + '</div>' : '') +
    (plan.ok && day.list.length ? '<div class="bar"><i style="width:' + Math.min(100, 100 * day.kcal / plan.target) + '%;background:' + GREEN + '"></i></div>' : '') + '</button>';
}

/* Блок «Цель» в профиле */
function goalProfileHtml() {
  const p = S.profile;
  const opt = (v, label, cur) => '<option value="' + v + '"' + ((cur || '') === v ? ' selected' : '') + '>' + label + '</option>';
  return '<h2>Цель</h2><div class="card"><div class="form-grid">' +
    '<label>Чего хотите<select data-profile="goal">' + opt('', 'не выбрана', p.goal) + Object.keys(GOALS).map(k => opt(k, GOALS[k].name, p.goal)).join('') + '</select></label>' +
    '<label>Желаемый вес, кг<input type="number" inputmode="decimal" step="0.1" min="30" max="300" data-profile="goalKg" value="' + (+p.goalKg || '') + '"></label>' +
    '<label>Тип тренировок<select data-profile="focus">' + opt('', 'не выбран', p.focus) + Object.keys(MODES).map(k => opt(k, MODES[k].name, p.focus)).join('') + '</select></label></div>' +
    '<div class="row-btns"><button class="btn" data-act="openOnboard">Пройти настройку заново</button></div></div>';
}

/* ---------- готовые программы ---------- */
function defaultTemplateId() {
  const n = +S.profile.perWeek || 3;
  return n <= 2 ? 'full2' : n === 3 ? 'full3' : 'ul4';
}
function templatesHtml() {
  const mode = suggestedMode(), def = defaultTemplateId();
  return '<h2>Готовые программы</h2><div class="card"><p class="muted small" style="margin-top:0">Подставлю подходы и повторы под режим «' + MODES[mode].name + '»' + (MODES[S.profile.focus] ? ' — он выбран в профиле' : '') + '. Потом всё можно поменять.</p>' +
    PROGRAM_TEMPLATES.map(tp => '<button class="pick" data-act="useTemplate" data-id="' + tp.id + '"><span><b>' + tp.name + '</b><small>' + tp.desc + '</small></span>' +
      (tp.id === def ? '<span class="badge care">вам подойдёт</span>' : '') + '</button>').join('') + '</div>';
}
function buildFromTemplate(id) {
  const tp = PROGRAM_TEMPLATES.find(x => x.id === id);
  if (!tp) return null;
  const mode = suggestedMode();
  return {
    name: tp.name, perWeek: tp.perWeek,
    days: tp.days.map((d, i) => {
      // четыре тяжёлых дня в неделю плохо восстанавливаются: вторую половину недели делаем «на массу»
      const m = mode === 'str' && tp.days.length >= 4 && i >= 2 ? 'mid' : mode;
      return { id: uid(), name: d.name, mode: m, items: d.items.map(exById).filter(Boolean).map(ex => Object.assign({ exId: ex.id }, modeDefaults(ex, m))) };
    })
  };
}

/* ---------- первый запуск ---------- */
const OB = { step: 0 };
function obHead(step, title, text) {
  return '<div class="ob-dots">' + [0, 1, 2].map(i => '<i class="' + (i <= step ? 'on' : '') + '"></i>').join('') + '</div>' +
    '<h3>' + title + '</h3><p class="muted small">' + text + '</p>';
}
function obRadio(name, options, cur) {
  return '<div class="radio">' + options.map(o => '<label><input type="radio" name="' + name + '" value="' + o[0] + '"' + ((cur || '') === o[0] ? ' checked' : '') + '><span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></label>').join('') + '</div>';
}
function openOnboard(step) {
  const p = S.profile;
  OB.step = step = step || 0;
  const back = step ? '<button class="btn" data-act="obBack">Назад</button>' : '<button class="btn" data-act="obSkip">Пропустить</button>';
  let html;
  if (step === 0) {
    html = obHead(0, 'Добро пожаловать в «Железо»', 'Три коротких шага — и советы подстроятся под вас. Все поля необязательные, потом их можно поменять в профиле.') +
      '<div class="form-grid mt"><label>Имя<input type="text" id="ob-name" maxlength="30" value="' + esc(p.name) + '"></label>' +
      '<label>Пол<select id="ob-sex"><option value="m"' + (p.sex !== 'f' ? ' selected' : '') + '>Мужской</option><option value="f"' + (p.sex === 'f' ? ' selected' : '') + '>Женский</option></select></label>' +
      '<label>Год рождения<input type="number" inputmode="numeric" id="ob-year" min="1930" max="' + new Date().getFullYear() + '" value="' + (p.birthYear || '') + '"></label>' +
      '<label>Рост, см<input type="number" inputmode="numeric" id="ob-height" min="100" max="250" value="' + (p.height || '') + '"></label>' +
      '<label>Вес, кг<input type="number" inputmode="decimal" step="0.1" id="ob-kg" min="30" max="300" value="' + (currentBW() || '') + '"></label></div>';
  } else if (step === 1) {
    html = obHead(1, 'Какая у вас цель?', 'От неё зависят норма калорий и советы по тренировкам.') +
      obRadio('ob-goal', Object.keys(GOALS).map(k => [k, GOALS[k].name, GOALS[k].desc]), p.goal) +
      '<label>Желаемый вес, кг — по желанию<input type="number" inputmode="decimal" step="0.1" id="ob-goalkg" min="30" max="300" value="' + (+p.goalKg || '') + '"></label>';
  } else if (step === 2) {
    html = obHead(2, 'Как хотите тренироваться?', 'Под этот тип приложение подберёт повторы, отдых и рабочие веса.') +
      obRadio('ob-focus', Object.keys(MODES).map(k => [k, MODES[k].name, FOCUS[k]]).concat([['', 'Пока не знаю', 'Начну с 8–12 повторов — это подходит большинству']]), p.focus) +
      '<div class="form-grid mt"><label>Стаж тренировок<select id="ob-exp">' + Object.keys(EXPERIENCE).map(k => '<option value="' + k + '"' + ((p.exp || '') === k ? ' selected' : '') + '>' + EXPERIENCE[k] + '</option>').join('') + '</select></label>' +
      '<label>Тренировок в неделю<select id="ob-week">' + [2, 3, 4, 5, 6].map(n => '<option value="' + n + '"' + ((+p.perWeek || 3) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div>';
  } else {
    const plan = energyPlan(), g = GOALS[p.goal], mode = suggestedMode();
    const tp = PROGRAM_TEMPLATES.find(x => x.id === defaultTemplateId());
    const name = (p.name || '').trim();
    html = '<h3>Готово' + (name ? ', ' + esc(name) : '') + '!</h3>' +
      (g ? '<div class="rec good inner"><b>Цель: ' + g.name.toLowerCase() + '</b><p>' + g.how + '</p></div>' : '') +
      '<div class="stats">' + (plan.ok ? '<div><b>' + fmtNum(plan.target, 0) + '</b><span>ккал в день</span></div><div><b>' + plan.protein + ' г</b><span>белка в день</span></div>' : '') +
      '<div><b>' + MODES[mode].name + '</b><span>режим тренировок</span></div></div>' +
      (plan.ok ? '' : '<p class="muted small">Норму калорий посчитаю, когда в профиле будут ' + plan.missing.join(', ') + '.</p>') +
      '<p class="muted small">Могу сразу собрать программу «' + tp.name + '» в этом режиме — упражнения и повторы потом можно поменять.</p>' +
      '<div class="row-btns end"><button class="btn" data-act="obDone">Начать без программы</button><button class="btn primary" data-act="obProgram">Собрать программу</button></div>';
    openModal(html);
    return;
  }
  openModal(html + '<div class="row-btns end">' + back + '<button class="btn primary" data-act="obNext">Дальше</button></div>');
}
/* Сохраняет поля текущего шага; false — если что-то введено неверно */
function obSave() {
  const p = S.profile;
  const num = (id, lo, hi, label) => {
    const raw = $('#' + id).value;
    if (raw === '') return null;
    const v = parseFloat(raw);
    if (!(v >= lo && v <= hi)) { toast(label + ': проверьте число'); return undefined; }
    return v;
  };
  if (OB.step === 0) {
    const year = num('ob-year', 1930, new Date().getFullYear(), 'Год рождения'), h = num('ob-height', 100, 250, 'Рост'), kg = num('ob-kg', 30, 300, 'Вес');
    if (year === undefined || h === undefined || kg === undefined) return false;
    p.name = $('#ob-name').value.trim(); p.sex = $('#ob-sex').value === 'f' ? 'f' : 'm';
    p.birthYear = year == null ? null : Math.round(year); p.height = h == null ? null : Math.round(h);
    if (kg != null && kg !== currentBW()) {
      const t = todayStr();
      S.weights = S.weights.filter(w => w.date !== t);
      S.weights.push({ date: t, kg: Math.round(kg * 10) / 10 });
      if (!p.startDate) p.startDate = t;
    }
  } else if (OB.step === 1) {
    const kg = num('ob-goalkg', 30, 300, 'Желаемый вес');
    if (kg === undefined) return false;
    const r = $('input[name="ob-goal"]:checked');
    p.goal = r && GOALS[r.value] ? r.value : '';
    p.goalKg = kg;
  } else if (OB.step === 2) {
    const r = $('input[name="ob-focus"]:checked');
    p.focus = r && MODES[r.value] ? r.value : '';
    p.exp = EXPERIENCE[$('#ob-exp').value] ? $('#ob-exp').value : '';
    p.perWeek = clampInt($('#ob-week').value, 1, 7, 3);
  }
  persist();
  return true;
}
function needsOnboard() {
  return !S.profile.onboarded && !S.workouts.length && !S.weights.length && !S.program && !S.food.length;
}

/* ---------- действия ---------- */
const NUTR_ACT = {
  openFood: () => go('food'),
  openGoal: () => go('profile'),
  foodMeal: el => { const n = $('#f-note'); if (n) n.value = el.dataset.m; const k = $('#f-kcal'); if (k) k.focus(); },
  addFood: () => {
    const t = todayStr();
    const date = DATE_RE.test(UI.foodDate || '') && UI.foodDate <= t ? UI.foodDate : t;
    const kcal = Math.round(parseFloat($('#f-kcal').value)), pRaw = $('#f-prot').value, prot = parseFloat(pRaw);
    if (!(kcal >= 1 && kcal <= 10000)) { toast('Введите калории — от 1 до 10 000'); return; }
    if (pRaw !== '' && !(prot >= 0 && prot <= 500)) { toast('Белок: введите граммы, от 0 до 500'); return; }
    S.food.push({ id: uid(), date, kcal, protein: pRaw === '' ? null : Math.round(prot * 10) / 10, note: $('#f-note').value.trim().slice(0, 60) });
    persist(); render(); toast('Записано: ' + fmtNum(kcal, 0) + ' ккал');
  },
  delFood: el => { S.food = S.food.filter(f => String(f.id) !== el.dataset.id); persist(); render(); },

  useTemplate: el => {
    const prog = buildFromTemplate(el.dataset.id);
    if (!prog) return;
    const set = () => { S.program = prog; persist(); closeModal(); UI.logSeg = 'prog'; go('log'); toast('Программа собрана — поправьте под себя'); };
    if (S.program && S.program.days.some(d => d.items.length)) confirmBox('Заменить программу?', 'Текущая программа будет заменена готовой. Записанные тренировки останутся.', 'Заменить', set, true);
    else set();
  },

  openOnboard: () => openOnboard(0),
  obNext: () => { if (obSave()) openOnboard(OB.step + 1); },
  obBack: () => openOnboard(Math.max(0, OB.step - 1)),
  obSkip: () => { S.profile.onboarded = true; persist(); closeModal(); render(); },
  obDone: () => { S.profile.onboarded = true; persist(); closeModal(); go('home'); toast('Настройка сохранена'); },
  obProgram: () => {
    S.profile.onboarded = true;
    const prog = buildFromTemplate(defaultTemplateId());
    if (prog && !(S.program && S.program.days.some(d => d.items.length))) S.program = prog;
    persist(); closeModal(); UI.logSeg = 'prog'; go('log');
    toast('Программа собрана — поправьте под себя');
  }
};
