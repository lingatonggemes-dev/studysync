import { notesStore, searchNotes, sortNotes } from '../data/notes.js';
import { formatDate } from '../util/dates.js';
import { escapeHtml } from '../util/html.js';
import { ICONS } from '../util/icons.js';
import { toast } from './toast.js';
import { confirmDialog } from './confirm.js';

export function initNotesView(root) {
  let activeId = null;
  let saveTimer = null;
  let query = '';

  root.innerHTML = `
    <div class="page-toolbar">
      <h2 class="page-heading">Notes</h2>
      <button class="btn" data-add type="button">+ New note</button>
    </div>
    <div class="notes-layout">
      <aside class="glass notes-list-pane">
        <input type="search" placeholder="Search notes…" data-search aria-label="Search notes" />
        <div class="notes-list" data-list></div>
      </aside>
      <section class="glass notes-editor-pane" data-editor></section>
    </div>
  `;

  const listEl = root.querySelector('[data-list]');
  const editorEl = root.querySelector('[data-editor]');
  const searchEl = root.querySelector('[data-search]');

  root.querySelector('[data-add]').addEventListener('click', () => {
    const note = notesStore.add({ title: 'Untitled note', body: '', subject: '', pinned: false });
    activeId = note.id;
    renderEditor();
  });

  searchEl.addEventListener('input', () => {
    query = searchEl.value.trim();
    renderList();
  });

  function renderList() {
    const all = sortNotes(notesStore.all());
    if (!all.length) {
      listEl.innerHTML = `<p class="muted notes-list-empty">No notes yet.</p>`;
      return;
    }
    const filtered = searchNotes(all, query);
    if (!filtered.length) {
      listEl.innerHTML = `<p class="muted notes-list-empty">No matches for "${escapeHtml(query)}".</p>`;
      return;
    }
    listEl.innerHTML = filtered.map((n) => `
      <button class="note-row ${n.id === activeId ? 'is-active' : ''}"
              data-note="${n.id}" type="button">
        <div class="note-row-head">
          <span class="note-row-title">${escapeHtml(n.title || 'Untitled note')}</span>
          ${n.pinned ? `<span class="note-pin" aria-label="Pinned">${ICONS.pin}</span>` : ''}
        </div>
        <div class="note-row-meta muted">
          ${n.subject ? escapeHtml(n.subject) + ' · ' : ''}
          ${escapeHtml(formatDate(new Date(n.updatedAt).toISOString().slice(0, 10)))}
        </div>
      </button>
    `).join('');

    listEl.querySelectorAll('[data-note]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeId = btn.dataset.note;
        renderList();
        renderEditor();
      });
    });
  }

  function renderEditor() {
    if (!activeId) {
      editorEl.innerHTML = `<div class="empty-state"><p class="muted">Select a note or create a new one.</p></div>`;
      return;
    }
    const note = notesStore.byId(activeId);
    if (!note) {
      activeId = null;
      editorEl.innerHTML = `<div class="empty-state"><p class="muted">Note not found.</p></div>`;
      return;
    }

    editorEl.innerHTML = `
      <div class="editor-toolbar">
        <span class="save-status muted" data-status>Saved</span>
        <div class="row-actions">
          <button class="icon-btn" data-pin aria-label="${note.pinned ? 'Unpin' : 'Pin'} note" type="button">${ICONS.pin}</button>
          <button class="icon-btn icon-btn-danger" data-delete aria-label="Delete note" type="button">${ICONS.trash}</button>
        </div>
      </div>
      <input class="editor-title" data-title value="${escapeHtml(note.title)}"
             placeholder="Note title" aria-label="Note title" />
      <input class="editor-subject" data-subject value="${escapeHtml(note.subject || '')}"
             placeholder="Subject (optional)" aria-label="Subject" />
      <textarea class="editor-body" data-body placeholder="Start writing…"
                aria-label="Note body">${escapeHtml(note.body || '')}</textarea>
    `;

    const titleEl = editorEl.querySelector('[data-title]');
    const subjectEl = editorEl.querySelector('[data-subject]');
    const bodyEl = editorEl.querySelector('[data-body]');
    const statusEl = editorEl.querySelector('[data-status]');
    const noteId = activeId;               // captured — survives note switches

    const flush = () => {
      if (!notesStore.byId(noteId)) return;
      notesStore.update(noteId, {
        title: titleEl.value.trim() || 'Untitled note',
        subject: subjectEl.value.trim(),
        body: bodyEl.value,
      });
      statusEl.textContent = 'Saved';
    };

    const schedule = () => {
      statusEl.textContent = 'Saving…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 500);
    };

    [titleEl, subjectEl, bodyEl].forEach((el) => {
      el.addEventListener('input', schedule);
      el.addEventListener('blur', () => { clearTimeout(saveTimer); flush(); });
    });

    editorEl.querySelector('[data-pin]').addEventListener('click', () => {
      const current = notesStore.byId(noteId);
      if (!current) return;
      notesStore.update(noteId, { pinned: !current.pinned });
      renderEditor();
    });

    editorEl.querySelector('[data-delete]').addEventListener('click', async () => {
      const current = notesStore.byId(noteId);
      if (!current) return;
      const ok = await confirmDialog({
        title: 'Delete note?',
        message: `"${current.title || 'Untitled note'}" will be removed.`,
        confirmText: 'Delete',
      });
      if (ok) {
        notesStore.remove(noteId);
        activeId = null;
        renderEditor();
        toast('Note deleted');
      }
    });

    titleEl.focus();
  }

  notesStore.subscribe(renderList);
  renderList();
  renderEditor();
}