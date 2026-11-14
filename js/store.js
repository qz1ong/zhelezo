'use strict';
/* Хранилище: всё лежит в localStorage устройства, без сервера */

const STORE_KEY = 'zhelezo.v1';

function defaultState() {
  return {
    v: 1,
    profile: { name: '', sex: 'm', birthYear: null, height: null },
    weights: [],          // {date, kg}
    workouts: [],         // {id, date, note, entries:[{exId, sets:[...]}]}
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
  for (const k of ['weights', 'workouts', 'customExercises', 'injuries']) {
    if (!Array.isArray(st[k])) st[k] = [];
  }
  return st;
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
