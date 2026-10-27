const NS = 'studysync:';

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(NS + key); } catch {}
}

/* --- Phase 5: Export / Import --- */

export function exportAllData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(NS)) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        data[key] = localStorage.getItem(key); // fallback for raw strings
      }
    }
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studysync-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importAllData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    let count = 0;
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(NS)) {
        localStorage.setItem(key, JSON.stringify(value));
        count++;
      }
    }
    return count;
  } catch (e) {
    throw new Error('Invalid backup file format.');
  }
}