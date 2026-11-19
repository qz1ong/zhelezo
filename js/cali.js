'use strict';
/* Калистеника: навыки со своим весом и лестницы этапов к ним.
   Этап засчитывается сам, когда в дневнике есть подход с нужным результатом; можно отметить и вручную (S.cali). */

/* Упражнения этапов. cali:true — в общем списке упражнений они видны по поиску и в разделе «Калистеника». */
const CALI_EXERCISES = [
  // тяги
  E('k_aus_row', 'Австралийские подтягивания', 'back', 'bw', { elbow: 1, shoulder: 1, upper_back: 1 }, { bwf: 0.5 }),
  E('k_neg_pull', 'Негативные подтягивания', 'back', 'bw', { elbow: 2, shoulder: 2, upper_back: 1 }, { bwf: 1 }),
  E('k_chest_pull', 'Подтягивания к груди', 'back', 'bw', { elbow: 3, shoulder: 2, upper_back: 2 }, { bwf: 1 }),
  E('k_archer_pull', 'Подтягивания лучником', 'back', 'bw', { elbow: 3, shoulder: 3, upper_back: 2 }, { bwf: 1 }),
  E('k_oap_neg', 'Негатив на одной руке', 'back', 'bw', { elbow: 3, shoulder: 3, upper_back: 2 }, { bwf: 1 }),
  E('k_oap', 'Подтягивание на одной руке', 'back', 'bw', { elbow: 3, shoulder: 3, upper_back: 2 }, { bwf: 1 }),
  E('k_bar_dip', 'Отжимания на перекладине (прямые брусья)', 'triceps', 'bw', { shoulder: 2, elbow: 2, wrist: 2 }, { bwf: 0.9 }),
  E('k_mu_neg', 'Негативный выход силой', 'back', 'bw', { shoulder: 3, elbow: 3, wrist: 2 }, { bwf: 1 }),
  E('k_muscleup', 'Выход силой на перекладине', 'back', 'bw', { shoulder: 3, elbow: 3, wrist: 2, upper_back: 2 }, { bwf: 1 }),
  E('k_fl_tuck', 'Передний вис в группировке', 'back', 'time', { shoulder: 2, elbow: 2, lower_back: 1 }),
  E('k_fl_adv', 'Передний вис: продвинутая группировка', 'back', 'time', { shoulder: 2, elbow: 2, lower_back: 1 }),
  E('k_fl_leg', 'Передний вис на одной ноге', 'back', 'time', { shoulder: 3, elbow: 2, lower_back: 2 }),
  E('k_fl_str', 'Передний вис ноги врозь', 'back', 'time', { shoulder: 3, elbow: 2, lower_back: 2 }),
  E('k_fl', 'Передний вис', 'back', 'time', { shoulder: 3, elbow: 3, lower_back: 2 }),
  E('k_skin_cat', 'Выкрут на перекладине («скин зе кэт»)', 'shoulders', 'bw', { shoulder: 3, elbow: 2 }, { bwf: 0.8 }),
  E('k_bl_tuck', 'Задний вис в группировке', 'back', 'time', { shoulder: 3, elbow: 3 }),
  E('k_bl_adv', 'Задний вис: продвинутая группировка', 'back', 'time', { shoulder: 3, elbow: 3 }),
  E('k_bl_str', 'Задний вис ноги врозь', 'back', 'time', { shoulder: 3, elbow: 3, lower_back: 1 }),
  E('k_bl', 'Задний вис', 'back', 'time', { shoulder: 3, elbow: 3, lower_back: 1 }),
  // жимы
  E('k_incline_pu', 'Отжимания с упором на возвышение', 'chest', 'bw', { shoulder: 1, elbow: 1, wrist: 2, chest: 1 }, { bwf: 0.5 }),
  E('k_diamond_pu', 'Алмазные отжимания', 'triceps', 'bw', { elbow: 3, wrist: 3, shoulder: 1 }, { bwf: 0.65 }),
  E('k_archer_pu', 'Отжимания лучником', 'chest', 'bw', { shoulder: 2, elbow: 2, wrist: 3, chest: 2 }, { bwf: 0.8 }),
  E('k_one_pu', 'Отжимания на одной руке', 'chest', 'bw', { shoulder: 3, elbow: 3, wrist: 3, chest: 2 }, { bwf: 0.8 }),
  E('k_bench_dip', 'Обратные отжимания от скамьи', 'triceps', 'bw', { shoulder: 2, elbow: 2, wrist: 2 }, { bwf: 0.5 }),
  E('k_dip_neg', 'Негативные отжимания на брусьях', 'chest', 'bw', { shoulder: 3, elbow: 2, wrist: 2, chest: 2 }, { bwf: 1 }),
  E('k_pike_pu', 'Пайк-отжимания', 'shoulders', 'bw', { shoulder: 2, wrist: 2, elbow: 1, neck: 1 }, { bwf: 0.6 }),
  E('k_elev_pike', 'Пайк-отжимания с ногами на возвышении', 'shoulders', 'bw', { shoulder: 3, wrist: 2, elbow: 2, neck: 1 }, { bwf: 0.75 }),
  E('k_wall_hspu', 'Отжимания в стойке у стены', 'shoulders', 'bw', { shoulder: 3, wrist: 3, elbow: 2, neck: 2 }, { bwf: 0.95 }),
  E('k_hspu', 'Отжимания в стойке без опоры', 'shoulders', 'bw', { shoulder: 3, wrist: 3, elbow: 2, neck: 2 }, { bwf: 1 }),
  E('k_pl_lean', 'Наклоны в планш (упор лёжа, плечи вперёд)', 'shoulders', 'time', { wrist: 3, shoulder: 2, elbow: 2 }),
  E('k_frog', 'Лягушка (упор коленями в локти)', 'shoulders', 'time', { wrist: 3, shoulder: 2, elbow: 2 }),
  E('k_pl_tuck', 'Планш в группировке', 'shoulders', 'time', { wrist: 3, shoulder: 3, elbow: 2 }),
  E('k_pl_adv', 'Планш: продвинутая группировка', 'shoulders', 'time', { wrist: 3, shoulder: 3, elbow: 3 }),
  E('k_pl_str', 'Планш ноги врозь', 'shoulders', 'time', { wrist: 3, shoulder: 3, elbow: 3, lower_back: 1 }),
  E('k_pl', 'Планш', 'shoulders', 'time', { wrist: 3, shoulder: 3, elbow: 3, lower_back: 1 }),
  // статика и баланс
  E('k_wall_hs', 'Стойка на руках у стены', 'shoulders', 'time', { wrist: 3, shoulder: 2, neck: 1 }),
  E('k_hs', 'Стойка на руках без опоры', 'shoulders', 'time', { wrist: 3, shoulder: 2, neck: 1 }),
  E('k_tuck_ls', 'Уголок в группировке', 'core', 'time', { wrist: 2, hip: 1 }),
  E('k_ls', 'Уголок (L-sit)', 'core', 'time', { wrist: 2, hip: 2, elbow: 1 }),
  E('k_vsit', 'V-сит', 'core', 'time', { wrist: 3, hip: 2, shoulder: 2 }),
  E('k_side_plank', 'Боковая планка', 'core', 'time', { shoulder: 1 }),
  E('k_flag_vert', 'Вертикальный флаг', 'core', 'time', { shoulder: 3, wrist: 2, elbow: 2 }),
  E('k_flag_tuck', 'Флаг в группировке', 'core', 'time', { shoulder: 3, wrist: 2, elbow: 2, lower_back: 1 }),
  E('k_flag_str', 'Флаг ноги врозь', 'core', 'time', { shoulder: 3, wrist: 2, elbow: 2, lower_back: 2 }),
  E('k_flag', 'Человек-флаг', 'core', 'time', { shoulder: 3, wrist: 2, elbow: 2, lower_back: 2 }),
  // ноги
  E('k_air_squat', 'Приседания без веса', 'legs', 'bw', { knee: 1, hip: 1 }, { bwf: 0.65 }),
  E('k_split_squat', 'Болгарские выпады без веса', 'legs', 'bw', { knee: 2, hip: 1 }, { bwf: 0.7 }),
  E('k_box_pistol', 'Пистолетик на скамью', 'legs', 'bw', { knee: 2, hip: 1, ankle: 1 }, { bwf: 0.8 }),
  E('k_pistol', 'Пистолетик', 'legs', 'bw', { knee: 3, hip: 2, ankle: 2 }, { bwf: 0.85 }),
  E('k_nordic_neg', 'Негативные скандинавские сгибания', 'legs', 'bw', { knee: 3 }, { bwf: 0.6 }),
  E('k_nordic', 'Скандинавские сгибания', 'legs', 'bw', { knee: 3 }, { bwf: 0.7 }),
  // пресс
  E('k_knee_raise', 'Подъём коленей в висе', 'core', 'bw', { shoulder: 1, hip: 1 }, { bwf: 0.3 }),
  E('k_t2b', 'Ноги к перекладине', 'core', 'bw', { shoulder: 1, lower_back: 1, hip: 2 }, { bwf: 0.45 }),
  E('k_df_tuck', 'Флаг дракона в группировке (негатив)', 'core', 'bw', { lower_back: 2, neck: 2, shoulder: 2 }, { bwf: 0.5 }),
  E('k_df_neg', 'Негативный флаг дракона', 'core', 'bw', { lower_back: 3, neck: 2, shoulder: 2 }, { bwf: 0.6 }),
  E('k_df', 'Флаг дракона', 'core', 'bw', { lower_back: 3, neck: 2, shoulder: 2 }, { bwf: 0.6 })
];
for (const ex of CALI_EXERCISES) { ex.cali = true; EXERCISES.push(ex); }

const CALI_CATS = { pull: 'Тяги', push: 'Жимы', static: 'Статика', legs: 'Ноги', core: 'Пресс' };
const CALI_DIFF = ['', 'Новичок', 'Базовый', 'Средний', 'Продвинутый', 'Элита'];

/* stages: [упражнение, цель] — цель в повторах подряд или в секундах удержания */
const CALI_SKILLS = [
  { id: 'pullups', name: 'Подтягивания', cat: 'pull', diff: 1,
    text: 'Главное упражнение турника. Если пока не получается ни разу — начните с австралийских подтягиваний и медленных негативов (опускание за 3–5 секунд).',
    stages: [['k_aus_row', 12], ['k_neg_pull', 5], ['pullup', 1], ['pullup', 5], ['pullup', 10], ['pullup', 15], ['pullup', 20]] },
  { id: 'pushups', name: 'Отжимания', cat: 'push', diff: 1,
    text: 'Корпус прямой, локти под углом около 45° к телу. Когда 25 раз даются легко, переходите к вариантам с бо́льшей нагрузкой на одну руку.',
    stages: [['k_incline_pu', 15], ['pushup', 10], ['pushup', 25], ['k_diamond_pu', 15], ['k_archer_pu', 8], ['k_one_pu', 1], ['k_one_pu', 5]] },
  { id: 'dips', name: 'Брусья', cat: 'push', diff: 2,
    text: 'Опускайтесь до угла 90° в локтях, плечи не заваливайте вперёд. Плечи болят — остановитесь на обратных отжиманиях и негативах.',
    stages: [['k_bench_dip', 15], ['k_dip_neg', 5], ['dips', 5], ['dips', 12], ['dips', 20], ['dips', 30]] },
  { id: 'toes', name: 'Ноги к перекладине', cat: 'core', diff: 2,
    text: 'Поднимайте ноги без раскачки, за счёт пресса. Сначала колени, затем прямые ноги до 90°, потом до касания перекладины.',
    stages: [['plank', 60], ['k_knee_raise', 12], ['leg_raise', 10], ['k_t2b', 5], ['k_t2b', 15]] },
  { id: 'lsit', name: 'Уголок (L-sit)', cat: 'static', diff: 2,
    text: 'Упор на брусьях или на полу, плечи опущены, ноги прямые и параллельны полу. Тренируйте подходами по 5–10 секунд.',
    stages: [['k_tuck_ls', 15], ['k_ls', 10], ['k_ls', 30], ['k_vsit', 5], ['k_vsit', 15]] },
  { id: 'pistol', name: 'Пистолетик', cat: 'legs', diff: 3,
    text: 'Приседание на одной ноге, вторая вытянута вперёд. Нужны сила, баланс и подвижность голеностопа — пятка не отрывается от пола.',
    stages: [['k_air_squat', 30], ['k_split_squat', 12], ['k_box_pistol', 8], ['k_pistol', 1], ['k_pistol', 5], ['k_pistol', 10]] },
  { id: 'handstand', name: 'Стойка на руках', cat: 'static', diff: 3,
    text: 'Начните у стены животом к стене — так корпус учится держать прямую линию. Баланс ловите пальцами рук. Перед каждой тренировкой разминайте запястья.',
    stages: [['k_wall_hs', 30], ['k_wall_hs', 60], ['k_hs', 5], ['k_hs', 15], ['k_hs', 30], ['k_hs', 60]] },
  { id: 'backlever', name: 'Задний вис', cat: 'pull', diff: 3,
    text: 'Самый доступный из «висов». Сильно нагружает бицепс и плечо — заходите в позицию медленно и только после разминки.',
    stages: [['k_skin_cat', 5], ['k_bl_tuck', 15], ['k_bl_adv', 10], ['k_bl_str', 8], ['k_bl', 5], ['k_bl', 15]] },
  { id: 'frontlever', name: 'Передний вис', cat: 'pull', diff: 4,
    text: 'Тело горизонтально лицом вверх, руки прямые. Тянете перекладину вниз к бёдрам, лопатки сведены и опущены. Тренируйте 4–6 подходов по 5–10 секунд.',
    stages: [['k_fl_tuck', 15], ['k_fl_adv', 10], ['k_fl_leg', 10], ['k_fl_str', 8], ['k_fl', 3], ['k_fl', 10]] },
  { id: 'muscleup', name: 'Выход силой', cat: 'pull', diff: 4,
    text: 'Нужны взрывные подтягивания к груди и сильные отжимания на прямых брусьях. Ключ — быстрый переход кистей поверх перекладины.',
    stages: [['k_chest_pull', 5], ['k_bar_dip', 10], ['k_mu_neg', 3], ['k_muscleup', 1], ['k_muscleup', 5], ['k_muscleup', 10]] },
  { id: 'hspu', name: 'Отжимания в стойке', cat: 'push', diff: 4,
    text: 'Вертикальный жим своим весом. Пайк-отжимания постепенно переводят нагрузку на плечи; голова опускается чуть впереди кистей.',
    stages: [['k_pike_pu', 10], ['k_elev_pike', 8], ['k_wall_hspu', 3], ['k_wall_hspu', 10], ['k_hspu', 1], ['k_hspu', 5]] },
  { id: 'dragon', name: 'Флаг дракона', cat: 'core', diff: 4,
    text: 'Лёжа на скамье, держитесь руками за опору за головой и опускаете прямое тело на лопатках. Поясница не прогибается.',
    stages: [['k_df_tuck', 5], ['k_df_neg', 5], ['k_df', 3], ['k_df', 8]] },
  { id: 'nordic', name: 'Скандинавские сгибания', cat: 'legs', diff: 4,
    text: 'Стоя на коленях с закреплёнными пятками, медленно опускаетесь вперёд. Лучшая защита задней поверхности бедра от травм.',
    stages: [['k_nordic_neg', 5], ['k_nordic', 1], ['k_nordic', 5], ['k_nordic', 10]] },
  { id: 'planche', name: 'Планш', cat: 'push', diff: 5,
    text: 'Тело параллельно полу, опора только на прямые руки. Годы работы: начните с наклонов и лягушки, запястья и локти разминайте особенно тщательно.',
    stages: [['k_pl_lean', 30], ['k_frog', 30], ['k_pl_tuck', 10], ['k_pl_adv', 8], ['k_pl_str', 5], ['k_pl', 3]] },
  { id: 'flag', name: 'Человек-флаг', cat: 'static', diff: 5,
    text: 'Держитесь за вертикальную опору: нижняя рука толкает, верхняя тянет. Сначала вертикальный флаг, потом опускайте ноги к горизонтали.',
    stages: [['k_side_plank', 60], ['k_flag_vert', 10], ['k_flag_tuck', 5], ['k_flag_str', 5], ['k_flag', 3], ['k_flag', 10]] },
  { id: 'oap', name: 'Подтягивание на одной руке', cat: 'pull', diff: 5,
    text: 'Вершина силы на турнике. Пока нет 15 чистых подтягиваний, за этот навык браться рано.',
    stages: [['pullup', 15], ['k_archer_pull', 5], ['k_oap_neg', 3], ['k_oap', 1], ['k_oap', 3]] }
];
function caliSkill(id) { return CALI_SKILLS.find(s => s.id === id) || null; }

/* Лучшие результаты по всем упражнениям: подряд повторов и секунд удержания */
function caliBest() {
  const best = {};
  for (const w of S.workouts) for (const en of w.entries) {
    const ex = exById(en.exId);
    if (!ex || (ex.type !== 'bw' && ex.type !== 'time')) continue;
    const b = best[en.exId] || (best[en.exId] = 0);
    let m = b;
    for (const s of en.sets || []) m = Math.max(m, ex.type === 'time' ? +s.sec || 0 : +s.r || 0);
    best[en.exId] = m;
  }
  return best;
}
function stageMet(st, best) { return (best[st[0]] || 0) >= st[1]; }
/* Сколько этапов навыка пройдено: по записям (самый дальний выполненный) или по ручной отметке */
function caliProgress(sk, best) {
  let auto = 0;
  sk.stages.forEach((st, i) => { if (stageMet(st, best)) auto = i + 1; });
  const man = clampInt((S.cali || {})[sk.id], 0, sk.stages.length, 0);
  return { done: Math.max(auto, man), auto, man };
}
function caliSummary() {
  const best = caliBest(), by = {};
  let stages = 0, total = 0, full = 0;
  for (const sk of CALI_SKILLS) {
    const p = caliProgress(sk, best);
    by[sk.id] = p.done; stages += p.done; total += sk.stages.length;
    if (p.done >= sk.stages.length) full++;
  }
  return { by, stages, total, full };
}

function stageGoal(st) {
  const ex = exById(st[0]);
  return ex && ex.type === 'time' ? fmtSec(st[1]) + ' удержания' : st[1] + ' ' + plural(st[1], 'повтор', 'повтора', 'повторов') + ' подряд';
}
function bestText(exId, best) {
  const ex = exById(exId), v = best[exId] || 0;
  if (!v) return 'ещё не записано';
  return 'лучшее: ' + (ex.type === 'time' ? fmtSec(v) : v + ' ' + plural(v, 'повтор', 'повтора', 'повторов'));
}
function diffDots(d) {
  return '<span class="dots" aria-label="Сложность ' + d + ' из 5">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= d ? 'on' : '') + '"></i>').join('') + '</span>';
}

/* ---------- экран ---------- */
function caliCard(sk, best) {
  const p = caliProgress(sk, best), n = sk.stages.length, full = p.done >= n;
  const cur = full ? null : sk.stages[p.done], ex = cur && exById(cur[0]);
  return '<button class="card cali-card d' + sk.diff + (full ? ' full' : '') + '" data-act="caliOpen" data-id="' + sk.id + '">' +
    '<div class="cali-top"><b>' + sk.name + '</b>' + diffDots(sk.diff) + '</div>' +
    '<div class="muted small">' + CALI_DIFF[sk.diff] + ' · ' + CALI_CATS[sk.cat] + '</div>' +
    '<div class="bar"><i style="width:' + (100 * p.done / n) + '%"></i></div>' +
    '<div class="cali-next">' + (full ? '✓ Освоено полностью' : 'Этап ' + (p.done + 1) + ' из ' + n + ': ' + esc(ex.name) + ' — ' + stageGoal(cur)) + '</div></button>';
}

function viewCali() {
  const best = caliBest(), sum = caliSummary(), f = UI.caliCat || '';
  const list = CALI_SKILLS.filter(s => !f || s.cat === f);
  const active = CALI_SKILLS.filter(s => sum.by[s.id] > 0 && sum.by[s.id] < s.stages.length)
    .sort((a, b) => sum.by[b.id] / b.stages.length - sum.by[a.id] / a.stages.length).slice(0, 3);
  let html = '<header class="top"><h1>Калистеника</h1><div class="muted">Навыки со своим весом: от первых подтягиваний до планша</div></header>' +
    '<div class="stats"><div><b>' + sum.stages + ' из ' + sum.total + '</b><span>этапов освоено</span></div>' +
    '<div><b>' + active.length + '</b><span>' + plural(active.length, 'навык', 'навыка', 'навыков') + ' в работе</span></div>' +
    '<div><b>' + sum.full + ' из ' + CALI_SKILLS.length + '</b><span>освоено полностью</span></div></div>';
  if (active.length && !f) html += '<h2>Сейчас в работе</h2>' + active.map(s => caliCard(s, best)).join('');
  html += '<h2>Навыки</h2><div class="chips scroll">' + [['', 'Все']].concat(Object.entries(CALI_CATS)).map(c =>
    '<button class="' + (f === c[0] ? 'on' : '') + '" data-act="caliCat" data-c="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
    '<div class="cali-grid">' + list.map(s => caliCard(s, best)).join('') + '</div>' +
    '<details class="card"><summary>Как тренировать навыки</summary>' +
    '<p>Каждый навык — лестница этапов. Этап засчитывается сам, как только в дневнике появится подход с нужным результатом: повторы подряд или секунды удержания.</p>' +
    '<p>Статику (висы, планш, уголок, стойку) делайте в начале тренировки, на свежую голову: 4–6 подходов по 5–10 секунд с отдыхом 2–3 минуты. Повторные элементы — 3–5 подходов, не до отказа.</p>' +
    '<p>2–4 тренировки навыка в неделю достаточно. Перед работой обязательно разомните запястья, локти и плечи: связки крепнут медленнее мышц.</p>' +
    '<p>Сложность: ' + CALI_DIFF.slice(1).map((d, i) => (i + 1) + ' — ' + d.toLowerCase()).join(', ') + '.</p></details>';
  return html;
}

function openCali(id) {
  const sk = caliSkill(id);
  if (!sk) return;
  const best = caliBest(), p = caliProgress(sk, best), n = sk.stages.length;
  const rows = sk.stages.map((st, i) => {
    const ex = exById(st[0]), state = i < p.done ? 'ok' : i === p.done ? 'now' : '';
    return '<div class="stage ' + state + '"><span class="st-ic">' + (state === 'ok' ? '✓' : i + 1) + '</span><span><b>' + esc(ex.name) + '</b>' +
      '<small>' + stageGoal(st) + ' · ' + bestText(st[0], best) + '</small></span>' +
      (state === 'now' || state === 'ok' ? '<button class="btn small" data-act="caliAdd" data-ex="' + st[0] + '">В тренировку</button>' : '') + '</div>';
  }).join('');
  const full = p.done >= n;
  openModal('<div class="sheet-head"><h3>' + sk.name + '</h3><button class="x" data-act="closeModal" aria-label="Закрыть">✕</button></div>' +
    '<div class="cali-meta">' + diffDots(sk.diff) + '<span class="muted">' + CALI_DIFF[sk.diff] + ' · ' + CALI_CATS[sk.cat] + ' · ' + p.done + ' из ' + n + ' ' + plural(n, 'этапа', 'этапов', 'этапов') + '</span></div>' +
    '<p>' + sk.text + '</p><div class="stages">' + rows + '</div>' +
    '<p class="muted small">Этап засчитывается сам по записям в дневнике. Если вы уже умеете больше, чем записано, отметьте этап вручную.</p>' +
    '<div class="row-btns">' +
    (full ? '' : '<button class="btn" data-act="caliMark" data-id="' + sk.id + '">Этап освоен</button>') +
    (p.man > p.auto ? '<button class="btn" data-act="caliUnmark" data-id="' + sk.id + '">Сбросить ручные отметки</button>' : '') +
    '</div>');
}

const CALI_ACT = {
  caliCat: el => { UI.caliCat = el.dataset.c; render(); },
  caliOpen: el => openCali(el.dataset.id),
  caliAdd: el => {
    const ex = exById(el.dataset.ex);
    if (!ex) return;
    if (!S.draft) S.draft = { id: null, date: todayStr(), note: '', entries: [] };
    if (!S.draft.entries.some(en => en.exId === ex.id)) addDraftEntry(ex);
    persist(); closeModal(); go('edit');
    toast('В тренировке: ' + ex.name);
  },
  caliMark: el => {
    const sk = caliSkill(el.dataset.id);
    if (!sk) return;
    const p = caliProgress(sk, caliBest());
    if (!S.cali) S.cali = {};
    S.cali[sk.id] = Math.min(sk.stages.length, p.done + 1);
    persist(); render(); openCali(sk.id);
  },
  caliUnmark: el => {
    if (S.cali) delete S.cali[el.dataset.id];
    persist(); render(); openCali(el.dataset.id);
  }
};
