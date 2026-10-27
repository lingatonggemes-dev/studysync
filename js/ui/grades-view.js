import { schemesStore, subjectsStore, assessmentsStore, initDefaultSchemes, calculateSubjectGrade } from '../data/grades.js';
import { escapeHtml } from '../util/html.js';
import { ICONS } from '../util/icons.js';
import { toast } from './toast.js';
import { confirmDialog } from './confirm.js';

export function initGradesView(root) {
  initDefaultSchemes();
  let activeSubjectId = null;

  root.innerHTML = `
    <div class="page-toolbar">
      <h2 class="page-heading">Grade Garden</h2>
      <div style="display:flex; gap:var(--space-2);">
        <button class="btn btn-ghost" data-manage-schemes type="button">⚙ Grading Systems</button>
        <button class="btn" data-add-subject type="button">+ Add Subject</button>
      </div>
    </div>
    <div class="grades-layout">
      <aside class="glass subjects-pane" data-subjects-list></aside>
      <section class="glass subject-detail" data-subject-detail>
        <div class="empty-state"><p class="muted">Select a subject to view grades.</p></div>
      </section>
    </div>
    <dialog class="glass dialog" data-dialog></dialog>
  `;

  const subjectsList = root.querySelector('[data-subjects-list]');
  const detailPane = root.querySelector('[data-subject-detail]');
  const dialog = root.querySelector('[data-dialog]');

  /* --- Render Subjects --- */
  function renderSubjects() {
    const subjects = subjectsStore.all();
    if (!subjects.length) {
      subjectsList.innerHTML = `<p class="muted notes-list-empty">No subjects yet.</p>`;
      return;
    }
    subjectsList.innerHTML = subjects.map(s => {
      const calc = calculateSubjectGrade(s.id);
      return `
        <button class="subject-row ${s.id === activeSubjectId ? 'is-active' : ''}" data-subject="${s.id}">
          <div class="subject-info">
            <span class="subject-name">${escapeHtml(s.name)}</span>
            <span class="muted" style="font-size:11px;">${calc.status}</span>
          </div>
          <span class="subject-grade">${calc.finalGrade}</span>
        </button>
      `;
    }).join('');

    subjectsList.querySelectorAll('[data-subject]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSubjectId = btn.dataset.subject;
        renderSubjects();
        renderDetail();
      });
    });
  }

  /* --- Render Detail --- */
  function renderDetail() {
    if (!activeSubjectId) return;
    const subject = subjectsStore.byId(activeSubjectId);
    if (!subject) return;

    const calc = calculateSubjectGrade(subject.id);
    const assessments = assessmentsStore.all().filter(a => a.subjectId === subject.id);
    const scheme = schemesStore.byId(subject.schemeId) || { name: 'Unknown Scheme' };

    detailPane.innerHTML = `
      <header class="detail-header">
        <div>
          <h2 style="margin:0;">${escapeHtml(subject.name)}</h2>
          <p class="muted" style="font-size:var(--fs-1);">Grading: ${escapeHtml(scheme.name)}</p>
        </div>
        <div class="grade-highlight">
          <span class="dashboard-num" style="margin:0;">${calc.finalGrade}</span>
          <span class="muted">${calc.percent}%</span>
        </div>
      </header>

      <div class="category-weights">
        ${(subject.categories || []).map(c => `
          <span class="pill">${escapeHtml(c.name)}: ${c.weight}%</span>
        `).join('')}
      </div>

      <div class="assessments-section">
        <div class="page-toolbar">
          <h3 class="card-title" style="margin:0;">Assessments</h3>
          <button class="btn btn-ghost" data-add-score type="button">+ Add Score</button>
        </div>
        ${assessments.length === 0 ? '<p class="muted">No scores entered yet.</p>' : `
          <div class="assessment-list">
            ${assessments.map(a => `
              <div class="assessment-item">
                <span class="pill">${escapeHtml(a.category)}</span>
                <div class="assessment-name">${escapeHtml(a.title)}</div>
                <div class="assessment-score">${a.score} / ${a.maxScore}</div>
                <button class="icon-btn icon-btn-danger" data-del-score="${a.id}">${ICONS.trash}</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    detailPane.querySelector('[data-add-score]').addEventListener('click', () => openScoreDialog(subject));
    detailPane.querySelectorAll('[data-del-score]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'Delete score?', message: 'This cannot be undone.' });
        if (ok) { assessmentsStore.remove(btn.dataset.delScore); renderSubjects(); renderDetail(); }
      });
    });
  }

  /* --- Add Subject (Dynamic Categories) --- */
  root.querySelector('[data-add-subject]').addEventListener('click', () => {
    const schemes = schemesStore.all();
    
    // Helper to generate a category row
    const makeCategoryRow = (name = '', weight = '') => `
      <div class="form-row category-row" style="align-items:center; margin-bottom: var(--space-2);">
        <input name="catName" placeholder="e.g., Recitation" value="${escapeHtml(name)}" class="field" style="padding:0.55rem; flex: 2;" required />
        <input type="number" name="catWeight" placeholder="20" value="${weight}" class="field" style="padding:0.55rem; flex: 1;" required min="1" max="100" />
        <button type="button" class="icon-btn icon-btn-danger" data-remove-cat aria-label="Remove category">${ICONS.trash}</button>
      </div>
    `;

    dialog.innerHTML = `
      <form method="dialog" class="form" novalidate>
        <h2 class="dialog-title">Add Subject</h2>
        <label class="field">
          <span>Subject Name</span>
          <input name="name" required placeholder="e.g., Data Structures" autocomplete="off" />
        </label>
        <label class="field">
          <span>Grading System</span>
          <select name="schemeId">
            ${schemes.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </label>
        
        <div style="margin-top:var(--space-3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-2);">
            <span style="font-size:var(--fs-1); color:var(--text-muted); font-weight:500;">Categories & Weights (Must equal 100%)</span>
            <button type="button" class="btn btn-ghost" style="padding: 0.2rem 0.6rem; font-size: 11px;" data-add-cat>+ Add Category</button>
          </div>
          
          <div data-categories style="display:flex; flex-direction:column;">
            <!-- Default Rows -->
            ${makeCategoryRow('Quizzes', '30')}
            ${makeCategoryRow('Exams', '70')}
          </div>
        </div>

        <div class="dialog-actions" style="margin-top:var(--space-5);">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn">Save Subject</button>
        </div>
      </form>
    `;

    const form = dialog.querySelector('form');
    const catContainer = form.querySelector('[data-categories]');

    // Add new row
    form.querySelector('[data-add-cat]').addEventListener('click', () => {
      catContainer.insertAdjacentHTML('beforeend', makeCategoryRow());
    });

    // Remove row (event delegation)
    catContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-cat]');
      if (btn) {
        const row = btn.closest('.category-row');
        if (catContainer.querySelectorAll('.category-row').length > 1) {
          row.remove();
        } else {
          toast('You need at least one category.', { type: 'error' });
        }
      }
    });

    form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      
      // Get all dynamic rows
      const catNames = fd.getAll('catName').map(n => n.trim());
      const catWeights = fd.getAll('catWeight').map(w => Number(w));
      
      let totalWeight = 0;
      const categories = [];

      for (let i = 0; i < catNames.length; i++) {
        if (!catNames[i]) {
          toast('Category names cannot be empty.', { type: 'error' });
          return;
        }
        if (isNaN(catWeights[i]) || catWeights[i] <= 0) {
          toast('Category weights must be greater than 0.', { type: 'error' });
          return;
        }
        totalWeight += catWeights[i];
        categories.push({ name: catNames[i], weight: catWeights[i] });
      }

      if (totalWeight !== 100) {
        toast(`Weights must equal exactly 100%. Current total: ${totalWeight}%`, { type: 'error' });
        return;
      }

      subjectsStore.add({
        name: fd.get('name').trim(),
        schemeId: fd.get('schemeId'),
        categories: categories
      });
      
      dialog.close();
      renderSubjects();
      toast('Subject added');
    });

    dialog.showModal();
  });

  /* --- Add Score --- */
  function openScoreDialog(subject) {
    dialog.innerHTML = `
      <form method="dialog" class="form" novalidate>
        <h2 class="dialog-title">Add Assessment</h2>
        <label class="field">
          <span>Category</span>
          <select name="category">
            ${subject.categories.map(c => `<option value="${c.name}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Title</span>
          <input name="title" required placeholder="e.g., Quiz 1" autocomplete="off" />
        </label>
        <div class="form-row">
          <label class="field">
            <span>Score</span>
            <input type="number" name="score" required min="0" step="any" />
          </label>
          <label class="field">
            <span>Max Score</span>
            <input type="number" name="maxScore" required min="1" step="any" value="100" />
          </label>
        </div>
        <div class="dialog-actions" style="margin-top:var(--space-5);">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn">Save Score</button>
        </div>
      </form>
    `;
    const form = dialog.querySelector('form');
    form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      assessmentsStore.add({
        subjectId: subject.id,
        category: fd.get('category'),
        title: fd.get('title').trim(),
        score: Number(fd.get('score')),
        maxScore: Number(fd.get('maxScore')),
      });
      dialog.close();
      renderSubjects();
      renderDetail();
      toast('Score added');
    });
    dialog.showModal();
  }

  /* --- Manage Schemes --- */
  root.querySelector('[data-manage-schemes]').addEventListener('click', () => {
    const schemes = schemesStore.all();
    dialog.innerHTML = `
      <div class="form">
        <h2 class="dialog-title">Grading Systems</h2>
        <div style="max-height:300px; overflow-y:auto; margin-bottom:var(--space-3);">
          ${schemes.map(s => `
            <div class="assessment-item" style="margin-bottom:var(--space-2);">
              <div class="assessment-name">${escapeHtml(s.name)}</div>
              <div class="muted" style="font-size:11px;">High: ${s.highest} | Low: ${s.lowest}</div>
            </div>
          `).join('')}
        </div>
        <p class="note">If your school's scale isn't here, create a custom one.</p>
        <form id="scheme-form" class="form" novalidate style="border-top:1px solid var(--border); padding-top:var(--space-3);">
          <label class="field"><span>Name</span><input name="name" required placeholder="e.g., My Univ Scale" autocomplete="off" /></label>
          <div class="form-row">
            <label class="field"><span>Highest Grade</span><input type="number" name="highest" required step="any" value="1.0" /></label>
            <label class="field"><span>Lowest/Fail Grade</span><input type="number" name="lowest" required step="any" value="4.0" /></label>
          </div>
          <label class="field" style="flex-direction:row; align-items:center; gap:var(--space-3);">
            <input type="checkbox" name="isInverted" />
            <span>My school uses a 4.00 to 1.00 scale (4.00 is highest)</span>
          </label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" data-cancel>Close</button>
            <button type="submit" class="btn">Add System</button>
          </div>
        </form>
      </div>
    `;
    dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    dialog.querySelector('#scheme-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      schemesStore.add({
        name: fd.get('name').trim(),
        highest: Number(fd.get('highest')),
        lowest: Number(fd.get('lowest')),
        passing: Number(fd.get('highest')) > 4 ? 75 : (fd.get('isInverted') === 'on' ? 2.0 : 3.0),
        isInverted: fd.get('isInverted') === 'on'
      });
      dialog.close();
      toast('Scheme added');
    });
    dialog.showModal();
  });

  subjectsStore.subscribe(renderSubjects);
  assessmentsStore.subscribe(() => { renderSubjects(); renderDetail(); });
  renderSubjects();
  if (activeSubjectId) renderDetail();
}