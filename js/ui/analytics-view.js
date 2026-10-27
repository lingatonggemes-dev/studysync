import { getLast7DaysData, getOverallStats } from '../data/analytics.js';
import { sessionsStore } from '../data/focus.js';
import { tasksStore } from '../data/tasks.js';

export function initAnalyticsView(root) {
  root.innerHTML = `
    <div class="page-toolbar">
      <h2 class="page-heading">Growth Analytics</h2>
    </div>
    
    <div class="grid" style="margin-bottom:var(--space-5);">
      <article class="glass card">
        <h3 class="card-title">Task Completion</h3>
        <p class="dashboard-num" data-stat-tasks>0%</p>
        <p class="muted">of all tasks finished</p>
      </article>
      <article class="glass card">
        <h3 class="card-title">Total Focus Time</h3>
        <p class="dashboard-num" data-stat-focus>0h</p>
        <p class="muted">all-time study hours</p>
      </article>
    </div>

    <div class="glass card">
      <h3 class="card-title" style="margin-bottom:var(--space-4);">Focus Minutes (Last 7 Days)</h3>
      <div class="bar-chart" data-chart-focus></div>
    </div>
  `;

  const statTasks = root.querySelector('[data-stat-tasks]');
  const statFocus = root.querySelector('[data-stat-focus]');
  const chartFocus = root.querySelector('[data-chart-focus]');

  function render() {
    const overall = getOverallStats();
    statTasks.textContent = `${overall.taskCompletion}%`;
    statFocus.textContent = `${overall.totalFocusHours}h`;

    const days = getLast7DaysData();
    const maxMins = Math.max(...days.map(d => d.focusMins), 30); // minimum scale of 30

    chartFocus.innerHTML = days.map(d => {
      const heightPct = (d.focusMins / maxMins) * 100;
      return `
        <div class="bar-col">
          <div class="bar-wrap">
            <div class="bar" style="height: ${heightPct}%"></div>
          </div>
          <span class="bar-label">${d.label}</span>
          <span class="bar-value muted">${d.focusMins}m</span>
        </div>
      `;
    }).join('');
  }

  sessionsStore.subscribe(render);
  tasksStore.subscribe(render);
  render();
}