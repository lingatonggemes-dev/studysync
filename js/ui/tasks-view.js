import { tasksStore, validateTask, filterTasks, sortTasks, taskStats, PRIORITIES } from '../data/tasks.js';
import { relativeDay, isOverdue } from '../util/dates.js';
import { escapeHtml } from '../util/html.js';
import { ICONS } from '../util/icons.js';
import { toast } from './toast.js';
import { confirmDialog } from './confirm.js';

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'today',     label: 'Today' },
  { id: 'upcoming',  label: 'Upcoming' },
  { id: 'overdue',   label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
];

export function initTasksView(root) {
  let currentFilter = 'all';

  root.innerHTML = `
    <div class="page-toolbar">
      <h2 class="page-heading">Tasks</h2>
      <button class="btn" data-add type="button">+ New task</button>
    </div>
    <div class="filter-row" role="tablist" aria-label="Task filters">
      ${FILTERS.map((f) => `
        <button class="chip ${f.id === 'all' ? 'is-active' : ''}" role="tab"
                data-filter="${f.id}" aria-selected="${f.id === 'all'}" type="button">${f.label}</button>
      `).join('')}
    </div>
    <div data-content></div>
    <dialog class="glass dialog" data-dialog></dialog>
  `;

  const content = root.querySelector('[data-content]');
  const dialog = root.querySelector('[data-dialog]');

  root.querySelector('[data-add]').addEventListener('click', () => openForm(null));

  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => {
        const on = b.dataset.filter === currentFilter;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      render();
    });
  });

  function openForm(item) {
    const isEdit = Boolean(item);
    const t = item ?? { title: '', notes: '', due: '', priority: 'medium', subject: '', duration: '' };

    dialog.innerHTML = `
      <form method="dialog" class="form" novalidate>
        <h2 class="dialog-title">${isEdit ? 'Edit task' : 'New task'}</h2>

        <label class="field">
          <span>Title</span>
          <input name="title" required value="${escapeHtml(t.title)}" autocomplete="off" />
        </label>

        <label class="field">
          <span>Notes</span>
          <textarea name="notes" rows="3">${escapeHtml(t.notes || '')}</textarea>
        </label>

        <div class="form-row">
          <label class="field">
            <span>Due date</span>
            <input type="date" name="due" value="${escapeHtml(t.due || '')}" />
          </label>
          <label class="field">
            <span>Priority</span>
            <select name="priority">
              ${PRIORITIES.map((p) => `<option value="${p.id}" ${p.id === t.priority ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span>Subject / category</span>
            <input name="subject" value="${escapeHtml(t.subject || '')}" autocomplete="off" />
          </label>
          <label class="field">
            <span>Est. minutes</span>
            <input type="number" name="duration" min="0" step="5" value="${t.duration || ''}" />
          </label>
        </div>

        <p class="form-error" data-error hidden></p>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn">Save</button>
        </div>
      </form>
    `;

    const form = dialog.querySelector('form');
    const errEl = dialog.querySelector('[data-error]');
    form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        title: String(fd.get('title') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        due: String(fd.get('due') || '') || null,
        priority: String(fd.get('priority')),
        subject: String(fd.get('subject') || '').trim(),
        duration: fd.get('duration') ? Number(fd.get('duration')) : null,
      };
      const errors = validateTask(data);
      if (Object.keys(errors).length) {
        errEl.textContent = Object.values(errors)[0];
        errEl.hidden = false;
        return;
      }
      if (isEdit) { tasksStore.update(item.id, data); toast('Task updated'); }
      else        { tasksStore.add({ ...data, done: false, subtasks: [] }); toast('Task added'); }
      dialog.close();
    });

    dialog.showModal();
    form.querySelector('input[name="title"]').focus();
  }

  function render() {
    const all = sortTasks(tasksStore.all());

    if (!all.length) {
      content.innerHTML = `
        <div class="glass empty-state">
          <h2>No tasks yet</h2>
          <p class="muted">Create your first task — with due dates, priorities, and notes.</p>
          <button class="btn" data-add-empty type="button">+ Create your first task</button>
        </div>
      `;
      content.querySelector('[data-add-empty]').addEventListener('click', () => openForm(null));
      return;
    }

    const stats = taskStats(all);
    const list = filterTasks(all, currentFilter);

    content.innerHTML = `
      <div class="stat-row">
        <span class="pill">${stats.dueToday} due today</span>
        <span class="pill">${stats.overdue} overdue</span>
        <span class="pill">${stats.done} done</span>
      </div>
      <div class="task-list">
        ${list.length ? list.map(taskItemHtml).join('') : `
          <div class="glass empty-state">
            <p class="muted">Nothing in this filter.</p>
          </div>
        `}
      </div>
    `;

    content.querySelectorAll('[data-toggle]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const item = tasksStore.byId(cb.dataset.toggle);
        if (!item) return;
        tasksStore.update(item.id, { done: cb.checked });
        toast(cb.checked ? 'Task complete' : 'Marked as not done');
      });
    });
    content.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = tasksStore.byId(btn.dataset.edit);
        if (item) openForm(item);
      });
    });
    content.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = tasksStore.byId(btn.dataset.delete);
        if (!item) return;
        const ok = await confirmDialog({
          title: 'Delete task?',
          message: `"${item.title}" will be removed.`,
          confirmText: 'Delete',
        });
        if (ok) { tasksStore.remove(item.id); toast('Task deleted'); }
      });
    });
  }

  function taskItemHtml(t) {
    const overdue = isOverdue(t.due, t.done);
    const due = relativeDay(t.due);
    return `
      <article class="task-item ${t.done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}">
        <label class="task-check">
          <input type="checkbox" data-toggle="${t.id}" ${t.done ? 'checked' : ''}
                 aria-label="Mark ${escapeHtml(t.title)} as done" />
        </label>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span class="priority priority-${t.priority}">${t.priority}</span>
            ${t.subject ? `<span class="muted">${escapeHtml(t.subject)}</span>` : ''}
            <span class="muted ${overdue ? 'is-overdue-text' : ''}">${escapeHtml(due)}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="icon-btn" data-edit="${t.id}" aria-label="Edit task" type="button">${ICONS.edit}</button>
          <button class="icon-btn icon-btn-danger" data-delete="${t.id}" aria-label="Delete task" type="button">${ICONS.trash}</button>
        </div>
      </article>
    `;
  }

  tasksStore.subscribe(render);
  render();
}