import { escapeHtml } from '../util/html.js';

export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Delete',
  cancelText = 'Cancel',
} = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'glass dialog';
    dlg.innerHTML = `
      <h2 class="dialog-title">${escapeHtml(title)}</h2>
      <p class="dialog-message">${escapeHtml(message)}</p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-cancel>${escapeHtml(cancelText)}</button>
        <button type="button" class="btn btn-danger" data-confirm>${escapeHtml(confirmText)}</button>
      </div>
    `;
    document.body.appendChild(dlg);

    dlg.addEventListener('close', () => {
      const ok = dlg.returnValue === 'confirm';
      dlg.remove();
      resolve(ok);
    });
    dlg.querySelector('[data-cancel]').addEventListener('click', () => {
      dlg.returnValue = 'cancel';
      dlg.close();
    });
    dlg.querySelector('[data-confirm]').addEventListener('click', () => {
      dlg.returnValue = 'confirm';
      dlg.close();
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      dlg.returnValue = 'cancel';
      dlg.close();
    });

    dlg.showModal();
  });
}