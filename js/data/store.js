import { read, write } from '../storage.js';

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function createStore(name) {
  let items = read(name, []);
  if (!Array.isArray(items)) items = [];

  const listeners = new Set();

  function persist() {
    write(name, items);
    listeners.forEach((fn) => {
      try { fn(items); } catch (err) { console.error(`[store:${name}]`, err); }
    });
  }

  return {
    all: () => items.slice(),
    byId: (id) => items.find((i) => i.id === id) ?? null,

    add(data) {
      const now = Date.now();
      const item = { id: uid(), createdAt: now, updatedAt: now, ...data };
      items = [item, ...items];
      persist();
      return item;
    },

    update(id, patch) {
      let updated = null;
      items = items.map((it) => {
        if (it.id !== id) return it;
        updated = { ...it, ...patch, id, updatedAt: Date.now() };
        return updated;
      });
      if (updated) persist();
      return updated;
    },

    remove(id) {
      const before = items.length;
      items = items.filter((it) => it.id !== id);
      if (items.length !== before) persist();
      return items.length !== before;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}