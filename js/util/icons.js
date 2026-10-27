const wrap = (path, extra = '') =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${path}</svg>`;

export const ICONS = {
  edit:  wrap('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  trash: wrap('<path d="M4 6h16M10 6V4h4v2M6 6l1 14h10l1-14"/>'),
  pin:   wrap('<path d="M9 4h6l-1 7 4 3H6l4-3z"/><path d="M12 14v6"/>'),
};