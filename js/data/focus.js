import { createStore } from './store.js';
import { read, write } from '../storage.js';
import { toISO } from '../util/dates.js';

/* ---------- Settings ---------- */

const DEFAULT_SETTINGS = {
  focus: 25,      // minutes
  short: 5,
  long: 15,
  longEvery: 4,   // long break after every N focus sessions
  sound: true,
};

export function loadSettings() {
  const raw = read('focusSettings', null);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    focus:     clampInt(raw.focus,     1, 120, DEFAULT_SETTINGS.focus),
    short:     clampInt(raw.short,     1, 60,  DEFAULT_SETTINGS.short),
    long:      clampInt(raw.long,      1, 90,  DEFAULT_SETTINGS.long),
    longEvery: clampInt(raw.longEvery, 1, 12,  DEFAULT_SETTINGS.longEvery),
    sound:     typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
  };
}

export function saveSettings(s) {
  write('focusSettings', s);
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/* ---------- Cycle counter (persists across reloads) ---------- */

export function loadCycle() {
  const raw = read('focusCycle', null);
  return raw && typeof raw.completedInCycle === 'number'
    ? { completedInCycle: Math.max(0, Math.floor(raw.completedInCycle)) }
    : { completedInCycle: 0 };
}

export function saveCycle(c) {
  write('focusCycle', c);
}

/* ---------- Sessions ---------- */

export const sessionsStore = createStore('focusSessions');

export function logFocusSession({ mode, durationMinutes, taskId = null, subject = '' }) {
  if (mode !== 'focus' || durationMinutes <= 0) return null;
  const endedAt = Date.now();
  return sessionsStore.add({
    mode,
    durationMinutes,
    startedAt: endedAt - durationMinutes * 60_000,
    endedAt,
    taskId,
    subject,
  });
}

export function focusStatsToday(sessions = sessionsStore.all()) {
  const today = toISO(new Date());
  const todaySessions = sessions.filter(
    (s) => toISO(new Date(s.endedAt)) === today
  );
  const totalMinutes = todaySessions.reduce((a, s) => a + (s.durationMinutes || 0), 0);
  return { count: todaySessions.length, totalMinutes };
}

export function recentFocusSessions(sessions = sessionsStore.all(), limit = 5) {
  return sessions
    .filter((s) => s.mode === 'focus')
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, limit);
}