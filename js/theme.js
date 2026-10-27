import { THEMES, DEFAULT_THEME, isValidTheme, getThemeMeta } from './themes.js';
import { read, write } from './storage.js';

export function getActiveTheme() {
  const saved = read('theme');
  return isValidTheme(saved) ? saved : DEFAULT_THEME;
}

export function applyTheme(id, { persist = true } = {}) {
  const theme = isValidTheme(id) ? id : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
  if (persist) write('theme', theme);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  return theme;
}

export function renderThemeStudio(container) {
  const active = document.documentElement.dataset.theme;
  container.innerHTML = '';

  for (const t of THEMES) {
    const isActive = t.id === active;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card' + (isActive ? ' is-active' : '');
    card.dataset.themeId = t.id;
    card.setAttribute('aria-pressed', String(isActive));
    card.setAttribute('aria-label', `Apply ${t.name} theme`);

    card.innerHTML = `
      <div class="theme-swatches" aria-hidden="true">
        ${t.swatches.map((c) => `<span style="background:${c}"></span>`).join('')}
      </div>
      <div class="theme-card-body">
        <span class="theme-name">${t.name}</span>
        <span class="theme-mood">${t.mood}</span>
      </div>
      <span class="theme-check" aria-hidden="true">✓</span>
    `;

    container.appendChild(card);
  }
}

export function syncThemeLabels() {
  const active = document.documentElement.dataset.theme;
  const meta = getThemeMeta(active);

  const label = document.querySelector('[data-theme-label]');
  if (label) label.textContent = meta.name;

  const live = document.querySelector('[data-theme-live]');
  if (live) live.textContent = `${meta.name} theme applied`;

  document.querySelectorAll('.theme-card').forEach((card) => {
    const isActive = card.dataset.themeId === active;
    card.classList.toggle('is-active', isActive);
    card.setAttribute('aria-pressed', String(isActive));
  });
}