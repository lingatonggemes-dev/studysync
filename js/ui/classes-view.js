import { classesStore, validateClass, groupByDay, CLASS_TYPES } from '../data/classes.js';
import { DAYS } from '../util/dates.js';
import { escapeHtml } from '../util/html.js';
import { ICONS } from '../util/icons.js';
import { toast } from './toast.js';
import { confirmDialog } from './confirm.js';

export function initClassesView(root) {
  root.innerHTML = `
    <div class="page-toolbar">
      <h2 class="page-heading">My Classes</h2>
      <button class="btn" data-add type="button">+ Add class</button>
    </div>
    <div data-content></div>
    <dialog class="glass dialog" data-dialog></dialog>
  `;

  const content = root.querySelector('[data-content]');
  const dialog = root.querySelector('[data-dialog]');

  root.querySelector('[data-add]').addEventListener('click', () => openForm(null));

  function openForm(item) {
    const isEdit = Boolean(item);
    const c = item ?? {
      subject: '', day: new Date().getDay(),
      startTime: '09:00', endTime: '10:00',
      location: '', instructor: '', type: 'lecture',
    };

    dialog.innerHTML = `
      <form method="dialog" class="form" novalidate>
        <h2 class="dialog-title">${isEdit ? 'Edit class' : 'Add class'}</h2>

        <label class="field">
          <span>Subject</span>
          <input name="subject" required value="${escapeHtml(c.subject)}" autocomplete="off" />
        </label>

        <div class="form-row">
          <label class="field">
            <span>Day</span>
            <select name="day">
              ${DAYS.map((d, i) => `<option value="${i}" ${i === c.day ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Type</span>
            <select name="type">
              ${CLASS_TYPES.map((t) => `<option value="${t.id}" ${t.id === c.type ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span>Start</span>
            <input type="time" name="startTime" required value="${escapeHtml(c.startTime)}" />
          </label>
          <label class="field">
            <span>End</span>
            <input type="time" name="endTime" required value="${escapeHtml(c.endTime)}" />
          </label>
        </div>

        <label class="field">
          <span>Room / link</span>
          <input name="location" value="${escapeHtml(c.location || '')}" autocomplete="off" />
        </label>

        <label class="field">
          <span>Instructor</span>
          <input name="instructor" value="${escapeHtml(c.instructor || '')}" autocomplete="off" />
        </label>

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
        subject: String(fd.get('subject') || '').trim(),
        day: Number(fd.get('day')),
        startTime: String(fd.get('startTime')),
        endTime: String(fd.get('endTime')),
        location: String(fd.get('location') || '').trim(),
        instructor: String(fd.get('instructor') || '').trim(),
        type: String(fd.get('type')),
      };
      const errors = validateClass(data);
      if (Object.keys(errors).length) {
        errEl.textContent = Object.values(errors)[0];
        errEl.hidden = false;
        return;
      }
      if (isEdit) { classesStore.update(item.id, data); toast('Class updated'); }
      else        { classesStore.add(data);                toast('Class added'); }
      dialog.close();
    });

    dialog.showModal();
    form.querySelector('input[name="subject"]').focus();
  }

  function render() {
    const list = classesStore.all();

    if (!list.length) {
      content.innerHTML = `
        <div class="glass empty-state">
          <h2>No classes yet</h2>
          <p class="muted">Add your first class to start building your weekly timetable.</p>
          <button class="btn" data-add-empty type="button">+ Add your first class</button>
        </div>
      `;
      content.querySelector('[data-add-empty]').addEventListener('click', () => openForm(null));
      return;
    }

    const groups = groupByDay(list);
    content.innerHTML = `
      <div class="week-grid">
        ${groups.map((g) => `
          <section class="glass day-column">
            <header class="day-header">${g.label}</header>
            ${g.items.length
              ? g.items.map(classItemHtml).join('')
              : '<p class="muted day-empty">No classes</p>'}
          </section>
        `).join('')}
      </div>
    `;

    content.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = classesStore.byId(btn.dataset.edit);
        if (item) openForm(item);
      });
    });
    content.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = classesStore.byId(btn.dataset.delete);
        if (!item) return;
        const ok = await confirmDialog({
          title: 'Delete class?',
          message: `${item.subject} — ${DAYS[item.day]} ${item.startTime}–${item.endTime} will be removed.`,
          confirmText: 'Delete',
        });
        if (ok) { classesStore.remove(item.id); toast('Class deleted'); }
      });
    });
  }

  function classItemHtml(c) {
    const typeLabel = CLASS_TYPES.find((t) => t.id === c.type)?.label ?? '';
    const meta = [typeLabel, c.location, c.instructor].filter(Boolean).map(escapeHtml).join(' · ');
    return `
      <article class="class-item">
        <div class="class-time">${escapeHtml(c.startTime)}–${escapeHtml(c.endTime)}</div>
        <div class="class-info">
          <div class="class-subject">${escapeHtml(c.subject)}</div>
          ${meta ? `<div class="class-meta muted">${meta}</div>` : ''}
        </div>
        <div class="row-actions">
          <button class="icon-btn" data-edit="${c.id}" aria-label="Edit ${escapeHtml(c.subject)}" type="button">${ICONS.edit}</button>
          <button class="icon-btn icon-btn-danger" data-delete="${c.id}" aria-label="Delete ${escapeHtml(c.subject)}" type="button">${ICONS.trash}</button>
        </div>
      </article>
    `;
  }

  classesStore.subscribe(render);
  render();
}