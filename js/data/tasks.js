import { createStore } from './store.js';
import { todayISO } from '../util/dates.js';

export const tasksStore = createStore('tasks');

export const PRIORITIES = [
  { id: 'low',    label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high',   label: 'High' },
];

export function validateTask(d) {
  const e = {};
  if (!d.title?.trim()) e.title = 'Title is required.';
  return e;
}

export function taskStats(list) {
  const today = todayISO();
  return {
    total: list.length,
    overdue: list.filter((t) => !t.done && t.due && t.due < today).length,
    dueToday: list.filter((t) => !t.done && t.due === today).length,
    done: list.filter((t) => t.done).length,
  };
}

export function filterTasks(list, filter) {
  const today = todayISO();
  switch (filter) {
    case 'today':     return list.filter((t) => !t.done && t.due === today);
    case 'upcoming':  return list.filter((t) => !t.done && t.due && t.due > today);
    case 'overdue':   return list.filter((t) => !t.done && t.due && t.due < today);
    case 'completed': return list.filter((t) => t.done);
    default:          return list.slice();
  }
}

export function sortTasks(list) {
  const rank = { high: 0, medium: 1, low: 2 };
  return list.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3);
  });
}