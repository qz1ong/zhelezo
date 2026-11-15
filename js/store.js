'use strict';
/* Хранилище: всё лежит в localStorage устройства, без сервера */

const STORE_KEY = 'zhelezo.v1';

function defaultState() {
  return {
    v: 1,
    profile: { name: '', sex: 'm', birthYear: null, height: null, startDate: null, exp: '', goal: '', focus: '', goalKg: null, kcalTarget: null, perWeek: null, onboarded: false },
    food: [],             // {id, date, kcal, protein, note} — записи о еде
    measures: [],         // {date, chest, waist, biceps, thigh} — обхваты в см
    program: null,        // {name, perWeek, days:[{id, name, mode, items:[{exId, sets, rmin, rmax}]}]}
    weights: [],          // {date, kg}
    workouts: [],         // {id, date, note, dayId, mode, test, entries:[{exId, sets:[...]}]}
    customExercises: [],  // как в EXERCISES, с custom:true
    injuries: [],         // {id, area, side, severity, date, status, endDate, note, pain:[{date, level}]}
    draft: null           // незавершённая тренировка
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) { /* повреждённые данные — начинаем с чистого листа */ }
  return defaultState();
}

function normalizeState(obj) {
  const st = Object.assign(defaultState(), obj || {});
  st.profile = Object.assign(defaultState().profile, st.profile || {});
  for (const k of ['weights', 'workouts', 'customExercises', 'injuries', 'measures', 'food']) {
    if (!Array.isArray(st[k])) st[k] = [];
  }
  st.program = normalizeProgram(st.program);
  return st;
}

/* Программа приходит из памяти или из файла-копии — приводим к ожидаемому виду */
function clampInt(v, lo, hi, def) {
  v = Math.round(+v);
  return v >= lo && v <= hi ? v : def;
}
function normalizeProgram(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.days)) return null;
  return {
    name: String(p.name || '').slice(0, 40),
    perWeek: clampInt(p.perWeek, 1, 7, 3),
    days: p.days.filter(d => d && typeof d === 'object').slice(0, 14).map(d => ({
      id: String(d.id || uid()),
      name: String(d.name || '').slice(0, 40),
      mode: MODES[d.mode] ? d.mode : 'mid',
      items: (Array.isArray(d.items) ? d.items : []).filter(it => it && it.exId).slice(0, 30).map(it => ({
        exId: String(it.exId),
        sets: clampInt(it.sets, 1, 12, 3),
        rmin: clampInt(it.rmin, 1, 100, 8),
        rmax: clampInt(it.rmax, 1, 100, 12)
      }))
    }))
  };
}

let S = loadState();
let storageOk = true;

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    storageOk = true;
  } catch (e) {
    storageOk = false;
  }
  return storageOk;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- даты (локальные, формат ГГГГ-ММ-ДД) ---------- */
function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayStr() { return iso(new Date()); }
function parseD(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function addDays(s, n) { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); }
function daysDiff(a, b) { return Math.round((parseD(b) - parseD(a)) / 864e5); }
function weekStart(s) { const d = parseD(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); }

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function fmtDate(s, withYear) {
  const d = parseD(s);
  const y = withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + y;
}
function fmtDateLong(s) {
  const d = parseD(s);
  const wd = WEEKDAYS[d.getDay()];
  return wd[0].toUpperCase() + wd.slice(1) + ', ' + fmtDate(s);
}
function fmtNum(n, digits) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: digits == null ? 1 : digits });
}
function fmtSec(sec) {
  sec = Math.round(sec);
  if (sec < 60) return sec + ' сек';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/* ---------- упражнения ---------- */
function allExercises() { return EXERCISES.concat(S.customExercises); }
function exById(id) {
  return EXERCISES.find(e => e.id === id) || S.customExercises.find(e => e.id === id) || null;
}
function sortedWorkouts() {
  return S.workouts.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
}
