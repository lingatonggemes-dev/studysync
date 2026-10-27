import { createStore } from './store.js';

export const notesStore = createStore('notes');

export function validateNote(d) {
  const e = {};
  if (!d.title?.trim()) e.title = 'Title is required.';
  return e;
}

export function searchNotes(list, query) {
  if (!query) return list.slice();
  const q = query.toLowerCase();
  return list.filter((n) =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.body || '').toLowerCase().includes(q) ||
    (n.subject || '').toLowerCase().includes(q)
  );
}

export function sortNotes(list) {
  return list.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}