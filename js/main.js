import { applyTheme, getActiveTheme, renderThemeStudio, syncThemeLabels } from './theme.js';
import { initRouter } from './router.js';
import { classesStore, nowNextClass } from './data/classes.js';
import { tasksStore, taskStats } from './data/tasks.js';
import { initClassesView } from './ui/classes-view.js';
import { initTasksView } from './ui/tasks-view.js';
import { initNotesView } from './ui/notes-view.js';
import { DAYS } from './util/dates.js';
import { escapeHtml } from './util/html.js';
import { initFocusView } from './ui/focus-view.js';
import { sessionsStore, focusStatsToday } from './data/focus.js';
import { exportAllData, importAllData, read, write } from './storage.js';
import { toast } from './ui/toast.js';
import { confirmDialog } from './ui/confirm.js';

/* 1. Apply theme (bootstrap already did it — this syncs state) */
applyTheme(getActiveTheme(), { persist: false });

/* 2. Today's date */
const dateEl = document.querySelector('[data-today]');
if (dateEl) {
  dateEl.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

/* 3. Router */
initRouter();

/* 4. Theme Studio */
const grid = document.querySelector('#theme-grid');
if (grid) {
  renderThemeStudio(grid);

  grid.addEventListener('click', (event) => {
    const card = event.target.closest('.theme-card');
    if (!card) return;
    applyTheme(card.dataset.themeId);
  });
}

/* 5. Keep labels / active card in sync on every change */
document.addEventListener('themechange', syncThemeLabels);
syncThemeLabels();
/* ============ 6. Initialize Phase-2 views ============ */
const classesRoot = document.querySelector('#page-classes');
if (classesRoot) initClassesView(classesRoot);

const tasksRoot = document.querySelector('#page-tasks');
if (tasksRoot) initTasksView(tasksRoot);

const notesRoot = document.querySelector('#page-notes');
if (notesRoot) initNotesView(notesRoot);

/* ============ 6b. Focus Room ============ */
const focusRoot = document.querySelector('#page-focus');
if (focusRoot) initFocusView(focusRoot);

/* ============ 7. Live dashboard ============ */
function renderDashboard() {
  const classesEl = document.querySelector('[data-dashboard-classes]');
  const tasksEl = document.querySelector('[data-dashboard-tasks]');
  const focusEl = document.querySelector('[data-dashboard-focus]');
  if (!classesEl || !tasksEl) return;

  /* --- Classes card --- */
  const { current, next } = nowNextClass(classesStore.all());
  if (current) {
    classesEl.innerHTML = `
      <p class="muted">Now</p>
      <p><strong>${escapeHtml(current.subject)}</strong>
         · ${escapeHtml(current.startTime)}–${escapeHtml(current.endTime)}
         ${current.location ? ' · ' + escapeHtml(current.location) : ''}</p>
    `;
  } else if (next) {
    classesEl.innerHTML = `
      <p class="muted">Next class</p>
      <p><strong>${escapeHtml(next.subject)}</strong>
         · ${DAYS[next.day]} ${escapeHtml(next.startTime)}</p>
    `;
  } else {
    classesEl.innerHTML = `
      <p class="muted">No upcoming classes.</p>
      <a class="btn btn-ghost" href="#classes">Add classes</a>
    `;
  }

  /* --- Tasks card --- */
  const s = taskStats(tasksStore.all());
  tasksEl.innerHTML = `
    <p class="dashboard-num">${s.dueToday + s.overdue}</p>
    <p class="muted">${s.dueToday} due today · ${s.overdue} overdue</p>
    <a class="btn" href="#tasks">View tasks</a>
  `;

  /* --- Focus card --- */
  if (focusEl) {
    const focus = focusStatsToday(sessionsStore.all());
    focusEl.innerHTML = `
      <p class="dashboard-num">${focus.totalMinutes}<span style="font-size: var(--fs-2); color: var(--text-muted); margin-left: 4px;">min</span></p>
      <p class="muted">${focus.count} focus session${focus.count === 1 ? '' : 's'} today</p>
      <a class="btn" href="#focus">Open Focus Room</a>
    `;
  }
}

tasksStore.subscribe(renderDashboard);
classesStore.subscribe(renderDashboard);
sessionsStore.subscribe(renderDashboard);
renderDashboard();

import { initGradesView } from './ui/grades-view.js';
import { initAnalyticsView } from './ui/analytics-view.js';

// ... after initNotesView(notesRoot) ...

const gradesRoot = document.querySelector('#page-grades');
if (gradesRoot) initGradesView(gradesRoot);

const analyticsRoot = document.querySelector('#page-analytics');
if (analyticsRoot) initAnalyticsView(analyticsRoot);

/* ============ 8. Phase 5: Appearance & Settings ============ */

// 1. Blur Slider
const blurSlider = document.querySelector('[data-blur-slider]');
const blurVal = document.querySelector('[data-blur-val]');
if (blurSlider) {
  const savedBlur = read('glassBlur', 18);
  blurSlider.value = savedBlur;
  if (blurVal) blurVal.textContent = savedBlur;
  document.documentElement.style.setProperty('--blur', `${savedBlur}px`);

  blurSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    if (blurVal) blurVal.textContent = val;
    document.documentElement.style.setProperty('--blur', `${val}px`);
    write('glassBlur', val);
  });
}

// 2. Reduced Motion Toggle
const motionToggle = document.querySelector('[data-reduce-motion]');
if (motionToggle) {
  const isReduced = read('forceReducedMotion', false);
  motionToggle.checked = isReduced;
  if (isReduced) document.documentElement.classList.add('force-reduce-motion');

  motionToggle.addEventListener('change', (e) => {
    const checked = e.target.checked;
    write('forceReducedMotion', checked);
    document.documentElement.classList.toggle('force-reduce-motion', checked);
  });
}

// 3. Export Data
const exportBtn = document.querySelector('[data-export]');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    exportAllData();
    toast('Backup downloaded successfully');
  });
}

// 4. Import Data
const importInput = document.querySelector('[data-import]');
if (importInput) {
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const ok = await confirmDialog({
        title: 'Import Backup?',
        message: 'This will overwrite your current data. Make sure you exported a backup first!',
        confirmText: 'Import and Reload',
      });

      if (!ok) {
        importInput.value = '';
        return;
      }

      try {
        importAllData(event.target.result);
        window.location.reload(); // Reload to apply all data cleanly
      } catch (err) {
        toast(err.message, { type: 'error' });
        importInput.value = '';
      }
    };
    reader.readAsText(file);
  });
}