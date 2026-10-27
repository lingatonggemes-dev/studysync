import { createTimer } from '../util/timer.js';
import {
  loadSettings, saveSettings, loadCycle, saveCycle,
  sessionsStore, logFocusSession, focusStatsToday, recentFocusSessions,
} from '../data/focus.js';
import { tasksStore } from '../data/tasks.js';
import { escapeHtml } from '../util/html.js';
import { relativeDay } from '../util/dates.js';
import { toast } from './toast.js';

const RING_RADIUS = 100;
const RING_CIRC = 2 * Math.PI * RING_RADIUS; // ≈ 628.32

const MODE_LABEL = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };

const TICK_MESSAGES = {
  focus: 'Ready to focus',
  short: 'Time for a short break',
  long:  'Time for a long break',
};

/* ---------- Audio (pre-warmed, never autoplay) ---------- */

let audioCtx = null;
function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playChime(kind = 'complete') {
  const ctx = ensureAudio();
  if (!ctx) return;
  const notes = kind === 'break'
    ? [523.25, 659.25, 783.99]     // C5 E5 G5
    : [659.25, 783.99, 987.77];    // E5 G5 B5
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const t = now + i * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.5);
  });
}

/* ---------- View ---------- */

export function initFocusView(root) {
  let settings = loadSettings();
  let cycle = loadCycle();
  let selectedTaskId = '';

  root.innerHTML = `
    <div class="page-toolbar">
      <h2 class="page-heading">Focus Room</h2>
      <button class="btn btn-ghost" data-settings type="button">⚙ Settings</button>
    </div>

    <div class="focus-layout">
      <section class="glass focus-card">
        <div class="mode-tabs" role="tablist" aria-label="Timer mode">
          ${Object.entries(MODE_LABEL).map(([id, label]) => `
            <button class="mode-tab" data-mode="${id}" role="tab" type="button">
              ${label}
            </button>
          `).join('')}
        </div>

        <div class="timer-wrap">
          <svg class="timer-ring" viewBox="0 0 220 220" aria-hidden="true">
            <circle class="ring-track" cx="110" cy="110" r="${RING_RADIUS}" />
            <circle class="ring-progress" cx="110" cy="110" r="${RING_RADIUS}"
                    stroke-dasharray="${RING_CIRC}" stroke-dashoffset="0" data-ring />
          </svg>
          <div class="timer-center">
            <span class="timer-display" data-time>25:00</span>
            <span class="timer-status" data-status>Ready to focus</span>
          </div>
        </div>

        <div class="timer-controls">
          <button class="btn btn-lg" data-primary type="button">Start</button>
          <button class="btn btn-ghost" data-reset type="button">Reset</button>
          <button class="btn btn-ghost" data-skip type="button">Skip</button>
        </div>

        <label class="field">
          <span>Working on (optional)</span>
          <select data-task-select>
            <option value="">— None —</option>
          </select>
        </label>
      </section>

      <aside class="glass focus-stats">
        <h3 class="card-title">Today</h3>
        <p class="dashboard-num" data-today-min>0<span class="unit">min</span></p>
        <p class="muted" data-today-count>0 focus sessions</p>

        <h3 class="card-title" style="margin-top: var(--space-5);">Recent sessions</h3>
        <ul class="session-list" data-sessions></ul>
      </aside>
    </div>

    <dialog class="glass dialog" data-dialog></dialog>
    <p class="sr-only" aria-live="polite" data-live></p>
  `;

  const timeEl = root.querySelector('[data-time]');
  const statusEl = root.querySelector('[data-status]');
  const ringEl = root.querySelector('[data-ring]');
  const primaryBtn = root.querySelector('[data-primary]');
  const resetBtn = root.querySelector('[data-reset]');
  const skipBtn = root.querySelector('[data-skip]');
  const modeTabs = root.querySelectorAll('[data-mode]');
  const taskSelect = root.querySelector('[data-task-select]');
  const todayMinEl = root.querySelector('[data-today-min]');
  const todayCountEl = root.querySelector('[data-today-count]');
  const sessionsEl = root.querySelector('[data-sessions]');
  const settingsBtn = root.querySelector('[data-settings]');
  const dialog = root.querySelector('[data-dialog]');
  const liveEl = root.querySelector('[data-live]');

  /* ----- Timer ----- */

  const timer = createTimer({
    onTick: render,
    onComplete: handleComplete,
  });

  function durationFor(mode) {
    return settings[mode] * 60_000;
  }

  function setMode(mode, { quiet = false } = {}) {
    timer.setMode(mode, durationFor(mode));
    selectedTaskId = '';           // reset association on mode change
    taskSelect.value = '';
    if (!quiet) announce(`${MODE_LABEL[mode]} — ready`);
    renderTabs();
  }

  function renderTabs() {
    const current = timer.getState().mode;
    modeTabs.forEach((btn) => {
      const on = btn.dataset.mode === current;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    });
  }

  function render(s) {
    // Time display
    const totalSec = Math.ceil(s.remainingMs / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    timeEl.textContent = `${mm}:${ss}`;

    // Ring
    const progress = s.durationMs ? 1 - s.remainingMs / s.durationMs : 0;
    ringEl.style.strokeDashoffset = String(RING_CIRC * (1 - progress));

    // Status
    if (s.state === 'running') statusEl.textContent = `${MODE_LABEL[s.mode]} in progress…`;
    else if (s.state === 'paused') statusEl.textContent = 'Paused';
    else if (s.state === 'completed') statusEl.textContent = 'Session complete';
    else statusEl.textContent = TICK_MESSAGES[s.mode];

    // Primary button label
    if (s.state === 'running') primaryBtn.textContent = 'Pause';
    else if (s.state === 'paused') primaryBtn.textContent = 'Resume';
    else if (s.state === 'completed') primaryBtn.textContent = 'Start again';
    else primaryBtn.textContent = 'Start';

    renderTabs();
  }

  function announce(text) {
    if (liveEl) liveEl.textContent = text;
  }

  function handleComplete({ mode, durationMs }) {
    if (settings.sound) playChime(mode === 'focus' ? 'complete' : 'break');

    if (mode === 'focus') {
      const mins = Math.round(durationMs / 60_000);
      const selectedTask = selectedTaskId
        ? tasksStore.byId(selectedTaskId)
        : null;

      logFocusSession({
        mode: 'focus',
        durationMinutes: mins,
        taskId: selectedTaskId || null,
        subject: selectedTask?.subject || '',
      });

      cycle.completedInCycle += 1;
      saveCycle(cycle);
      announce(`Focus session complete — ${mins} minutes logged`);

      // Decide next phase
      const nextIsLong = cycle.completedInCycle % settings.longEvery === 0;
      setMode(nextIsLong ? 'long' : 'short');
    } else {
      announce('Break complete — ready to focus');
      setMode('focus');
    }

    // Fire a task-store change so the dashboard picks up the new stat
    sessionsStore.all();
    renderSidebar();
    // Notify the rest of the app (main.js subscribes to this)
    document.dispatchEvent(new CustomEvent('focuschange'));
  }

  /* ----- UI events ----- */

  primaryBtn.addEventListener('click', () => {
    ensureAudio();                       // unlock audio on the first gesture
    const s = timer.getState();
    if (s.state === 'running') timer.pause();
    else if (s.state === 'paused') timer.start();
    else timer.start();
  });

  resetBtn.addEventListener('click', () => {
    timer.reset();
    announce('Timer reset');
  });

  skipBtn.addEventListener('click', () => {
    const s = timer.getState();
    if (s.mode === 'focus') {
      const nextIsLong = (cycle.completedInCycle + 1) % settings.longEvery === 0;
      // Skipping does NOT count as completed — decide based on current cycle
      const nextLong = cycle.completedInCycle > 0 && cycle.completedInCycle % settings.longEvery === 0;
      setMode(nextLong ? 'long' : 'short');
    } else {
      setMode('focus');
    }
    announce('Skipped to next phase');
  });

  modeTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (timer.getState().state === 'running') {
        toast('Pause the timer before switching modes', { type: 'error' });
        return;
      }
      setMode(btn.dataset.mode);
    });
  });

  taskSelect.addEventListener('change', () => {
    selectedTaskId = taskSelect.value;
    if (selectedTaskId) {
      const task = tasksStore.byId(selectedTaskId);
      if (task) toast(`Focusing on: ${task.title}`);
    }
  });

  /* ----- Settings dialog ----- */

  settingsBtn.addEventListener('click', () => {
    dialog.innerHTML = `
      <form method="dialog" class="form" novalidate>
        <h2 class="dialog-title">Focus settings</h2>

        <div class="form-row">
          <label class="field">
            <span>Focus (min)</span>
            <input type="number" name="focus" min="1" max="120" value="${settings.focus}" />
          </label>
          <label class="field">
            <span>Short break (min)</span>
            <input type="number" name="short" min="1" max="60" value="${settings.short}" />
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span>Long break (min)</span>
            <input type="number" name="long" min="1" max="90" value="${settings.long}" />
          </label>
          <label class="field">
            <span>Long break every N focus</span>
            <input type="number" name="longEvery" min="1" max="12" value="${settings.longEvery}" />
          </label>
        </div>

        <label class="field" style="flex-direction: row; align-items: center; gap: var(--space-3);">
          <input type="checkbox" name="sound" ${settings.sound ? 'checked' : ''} />
          <span>Play a gentle chime when a session ends</span>
        </label>

        <p class="note">Skipping a session does not add it to your history.</p>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn">Save</button>
        </div>
      </form>
    `;
    const form = dialog.querySelector('form');
    form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const next = {
        focus:     clamp(Number(fd.get('focus')),     1, 120, settings.focus),
        short:     clamp(Number(fd.get('short')),     1, 60,  settings.short),
        long:      clamp(Number(fd.get('long')),      1, 90,  settings.long),
        longEvery: clamp(Number(fd.get('longEvery')), 1, 12,  settings.longEvery),
        sound:     fd.get('sound') === 'on',
      };
      settings = next;
      saveSettings(settings);
      // If currently idle, adopt the new duration immediately
      const s = timer.getState();
      if (s.state === 'idle' || s.state === 'completed') {
        setMode(s.mode, { quiet: true });
      }
      dialog.close();
      toast('Settings saved');
    });
    dialog.showModal();
  });

  function clamp(v, min, max, fallback) {
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  /* ----- Task dropdown ----- */

  function renderTaskOptions() {
    const open = tasksStore.all().filter((t) => !t.done);
    const previous = taskSelect.value;
    taskSelect.innerHTML = `
      <option value="">— None —</option>
      ${open.map((t) => `
        <option value="${t.id}">${escapeHtml(t.title)}${t.subject ? ' · ' + escapeHtml(t.subject) : ''}</option>
      `).join('')}
    `;
    if (previous && open.some((t) => t.id === previous)) {
      taskSelect.value = previous;
      selectedTaskId = previous;
    } else {
      selectedTaskId = '';
    }
  }

  /* ----- Sidebar (today / recent) ----- */

  function renderSidebar() {
    const stats = focusStatsToday();
    todayMinEl.innerHTML = `${stats.totalMinutes}<span class="unit">min</span>`;
    todayCountEl.textContent = stats.count === 1
      ? '1 focus session'
      : `${stats.count} focus sessions`;

    const recent = recentFocusSessions();
    if (!recent.length) {
      sessionsEl.innerHTML = `<li class="muted" style="font-size: var(--fs-1);">No sessions yet — your first one starts today.</li>`;
      return;
    }
    sessionsEl.innerHTML = recent.map((s) => {
      const time = new Date(s.endedAt).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit',
      });
      const dateLabel = relativeDay(new Date(s.endedAt).toISOString().slice(0, 10));
      return `
        <li class="session-item">
          <span class="session-dot"></span>
          <div>
            <div class="session-title">
              ${s.durationMinutes} min focus
              ${s.subject ? `<span class="muted">· ${escapeHtml(s.subject)}</span>` : ''}
            </div>
            <div class="session-meta muted">${escapeHtml(dateLabel)} · ${time}</div>
          </div>
        </li>
      `;
    }).join('');
  }

  /* ----- Visibility sync (the spec's key requirement) ----- */

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) timer.forceSync();
  });

  /* ----- Wiring ----- */

  tasksStore.subscribe(renderTaskOptions);
  sessionsStore.subscribe(renderSidebar);

  // Initial state
  setMode('focus', { quiet: true });
  renderTaskOptions();
  renderSidebar();
}