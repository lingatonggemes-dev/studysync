const ROUTES = {
  dashboard: 'Dashboard',
  classes: 'My Classes',
  tasks: 'Tasks',
  focus: 'Focus Room',
  notes: 'Notes',
  grades: 'Grade Garden',        
  analytics: 'Growth Analytics', 
  theme: 'Theme Studio',
};;

export function initRouter() {
  const go = () => {
    const hash = location.hash.replace('#', '') || 'dashboard';
    const route = Object.prototype.hasOwnProperty.call(ROUTES, hash) ? hash : 'dashboard';

    document.querySelectorAll('.page').forEach((p) => {
      p.hidden = p.id !== `page-${route}`;
    });

    document.querySelectorAll('[data-nav]').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.nav === route);
    });

    document.querySelectorAll('[data-page-title]').forEach((h) => {
      h.textContent = ROUTES[route];
    });

    document.title = `StudySync — ${ROUTES[route]}`;
  };

  window.addEventListener('hashchange', go);
  go();
}