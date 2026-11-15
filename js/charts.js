'use strict';
/* Графики на SVG без сторонних библиотек: работают офлайн */

let CHARTS = {};   // id -> конфигурация, заполняется при отрисовке экрана

function niceTicks(min, max, n) {
  if (min === max) { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
  const step0 = (max - min) / (n || 4);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}

function chartEmpty(text) {
  return '<div class="chart-empty">' + (text || 'Пока нет данных для графика') + '</div>';
}

/* cfg: {type:'line', series:[{name,color,pts:[{x:'ГГГГ-ММ-ДД', y}]}], unit, zero} */
function drawLine(cfg, W, H) {
  const series = cfg.series.filter(s => s.pts.length);
  if (!series.length) return { html: chartEmpty(cfg.empty), hit: null };
  const m = { l: 44, r: 14, t: 12, b: 26 };
  const all = [].concat.apply([], series.map(s => s.pts));
  const xs = all.map(p => parseD(p.x).getTime());
  let x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
  const ys = all.map(p => p.y);
  const sc = niceTicks(cfg.zero ? 0 : Math.min.apply(null, ys), Math.max.apply(null, ys), 4);
  const px = t => m.l + (t - x0) / (x1 - x0) * (W - m.l - m.r);
  const py = v => H - m.b - (v - sc.lo) / (sc.hi - sc.lo) * (H - m.t - m.b);

  let g = '';
  for (const tk of sc.ticks) {
    const y = py(tk).toFixed(1);
    g += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '"/>';
    g += '<text class="axis" x="' + (m.l - 8) + '" y="' + (+y + 4) + '" text-anchor="end">' + fmtNum(tk, 1) + '</text>';
  }
  const nx = W < 420 ? 3 : 5;
  for (let i = 0; i < nx; i++) {
    const t = x0 + (x1 - x0) * i / (nx - 1);
    const anchor = i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle';
    g += '<text class="axis" x="' + px(t).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + fmtDate(iso(new Date(t))) + '</text>';
  }

  const hit = [];
  series.forEach((s, si) => {
    const pts = s.pts.map(p => ({ X: px(parseD(p.x).getTime()), Y: py(p.y), p, s }));
    const d = pts.map((q, i) => (i ? 'L' : 'M') + q.X.toFixed(1) + ' ' + q.Y.toFixed(1)).join(' ');
    if (series.length === 1 && pts.length > 1) {
      const base = (H - m.b).toFixed(1);
      g += '<path d="' + d + ' L' + pts[pts.length - 1].X.toFixed(1) + ' ' + base + ' L' + pts[0].X.toFixed(1) + ' ' + base + ' Z" class="area" fill="' + s.color + '" opacity="0.13"/>';
    }
    // pathLength="1" — чтобы линия «рисовалась» одной и той же анимацией при любой длине
    g += '<path class="ln" pathLength="1" d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    if (pts.length <= 45) {
      for (const q of pts) g += '<circle class="dot" cx="' + q.X.toFixed(1) + '" cy="' + q.Y.toFixed(1) + '" r="3.2" fill="var(--bg)" stroke="' + s.color + '" stroke-width="2"/>';
    }
    for (const q of pts) hit.push(q);
  });
  g += '<line class="cursor" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" style="display:none"/>';

  let legend = '';
  if (series.length > 1) {
    legend = '<div class="legend">' + series.map(s => '<span><i style="background:' + s.color + '"></i>' + s.name + '</span>').join('') + '</div>';
  }
  return {
    html: legend + '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg><div class="tip" style="display:none"></div>',
    hit
  };
}

/* cfg: {type:'bar', bars:[{label, y, tip}], color, unit} */
function drawBars(cfg, W, H) {
  const bars = cfg.bars;
  if (!bars.length || !bars.some(b => b.y > 0)) return { html: chartEmpty(cfg.empty), hit: null };
  const m = { l: 44, r: 8, t: 12, b: 26 };
  const sc = niceTicks(0, Math.max(cfg.line || 0, Math.max.apply(null, bars.map(b => b.y))), 4);
  const bw = (W - m.l - m.r) / bars.length;
  const py = v => H - m.b - (v - sc.lo) / (sc.hi - sc.lo) * (H - m.t - m.b);
  let g = '';
  for (const tk of sc.ticks) {
    const y = py(tk).toFixed(1);
    g += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '"/>';
    g += '<text class="axis" x="' + (m.l - 8) + '" y="' + (+y + 4) + '" text-anchor="end">' + fmtNum(tk, 1) + '</text>';
  }
  const hit = [];
  const every = Math.ceil(bars.length / (W < 420 ? 4 : 7));
  bars.forEach((b, i) => {
    const x = m.l + i * bw, w = Math.max(2, bw * 0.68), y = py(b.y), h = H - m.b - y;
    const cx = x + bw / 2;
    if (b.y > 0) g += '<rect class="bar-r" style="animation-delay:' + Math.min(i * 30, 400) + 'ms" x="' + (cx - w / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) + '" rx="4" fill="' + (cfg.color || 'var(--acc)') + '"' + (i === bars.length - 1 ? '' : ' opacity="0.75"') + '/>';
    if (i % every === 0 || i === bars.length - 1) g += '<text class="axis" x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + b.label + '</text>';
    hit.push({ X: cx, Y: y, bar: b });
  });
  if (cfg.line > 0) {   // целевой уровень, например норма калорий
    const ly = py(cfg.line).toFixed(1);
    g += '<line class="target" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + ly + '" y2="' + ly + '"/>';
  }
  return {
    html: '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg><div class="tip" style="display:none"></div>',
    hit
  };
}

function mountCharts() {
  document.querySelectorAll('.chart[data-chart]').forEach(el => {
    const cfg = CHARTS[el.dataset.chart];
    if (!cfg) return;
    const W = Math.max(260, Math.floor(el.clientWidth));
    const H = cfg.height || (W < 420 ? 200 : 250);
    const res = cfg.type === 'bar' ? drawBars(cfg, W, H) : drawLine(cfg, W, H);
    el.innerHTML = res.html;
    el._hit = res.hit; el._cfg = cfg; el._W = W;
  });
}

function chartPointer(ev) {
  const el = ev.target.closest && ev.target.closest('.chart[data-chart]');
  if (!el || !el._hit) return;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
  if (!svg || !tip) return;
  const rect = svg.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  let best = null, bd = Infinity;
  for (const q of el._hit) { const d = Math.abs(q.X - x); if (d < bd) { bd = d; best = q; } }
  if (!best) return;
  const cfg = el._cfg;
  let html;
  if (best.bar) {
    html = '<b>' + fmtNum(best.bar.y, 1) + (cfg.unit ? ' ' + cfg.unit : '') + '</b><span>' + (best.bar.tip || best.bar.label) + '</span>';
  } else {
    const same = el._hit.filter(q => q.p.x === best.p.x);
    html = same.map(q => '<b style="color:' + q.s.color + '">' + fmtNum(q.p.y, 1) + (cfg.unit ? ' ' + cfg.unit : '') + '</b>').join('') + '<span>' + fmtDate(best.p.x, true) + '</span>';
    const cur = svg.querySelector('.cursor');
    if (cur) { cur.setAttribute('x1', best.X); cur.setAttribute('x2', best.X); cur.style.display = ''; }
  }
  tip.innerHTML = html;
  tip.style.display = '';
  const tw = tip.offsetWidth;
  const top = svg.offsetTop;
  tip.style.left = Math.max(0, Math.min(el._W - tw, best.X - tw / 2)) + 'px';
  tip.style.top = Math.max(top, top + best.Y - 58) + 'px';
}
function chartLeave(ev) {
  const el = ev.target.closest && ev.target.closest('.chart[data-chart]');
  if (!el) return;
  const tip = el.querySelector('.tip'), cur = el.querySelector('.cursor');
  if (tip) tip.style.display = 'none';
  if (cur) cur.style.display = 'none';
}

document.addEventListener('pointermove', chartPointer);
document.addEventListener('pointerdown', chartPointer);
document.addEventListener('pointerleave', chartLeave, true);

let _rz = null;
window.addEventListener('resize', () => { clearTimeout(_rz); _rz = setTimeout(mountCharts, 120); });

/* Круговой индикатор рейтинга */
function ringSvg(score, color) {
  const r = 42, c = 2 * Math.PI * r, p = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return '<svg class="ring-svg" viewBox="0 0 100 100">' +
    '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="9"/>' +
    (p > 0 ? '<circle class="ring-arc" style="--c:' + c.toFixed(1) + '" cx="50" cy="50" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/>' : '') +
    '<text x="50" y="58" text-anchor="middle" class="ring-num">' + (score == null ? '—' : Math.round(score)) + '</text></svg>';
}
