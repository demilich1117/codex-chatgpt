// Tavern Helper owns the handles and their document-level pointer events. Keep its
// virtual lists at their starting size while the native window follows the drag.
export function mountFloatingResize() {
  const controller = new AbortController();
  const { signal } = controller;
  let held = null;

  function release(event) {
    if (!held || (event?.pointerId != null && event.pointerId !== held.pointerId)) return;
    const { content } = held;
    content.classList.remove('cg-held-content');
    content.style.removeProperty('--cg-held-width');
    content.style.removeProperty('--cg-held-height');
    held = null;
  }

  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    const handle = event.target.closest?.('.dialog-teleported.dialog-resizable > .absolute[class*="-resize"]');
    if (!handle) return;
    const content = handle.parentElement.querySelector(':scope > .TH-custom-tailwind[role="dialog"] > .flex-1.overflow-hidden');
    if (!content) return;
    release();
    const rect = content.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    held = { content, pointerId: event.pointerId };
    content.style.setProperty('--cg-held-width', rect.width + 'px');
    content.style.setProperty('--cg-held-height', rect.height + 'px');
    content.classList.add('cg-held-content');
  }, { capture: true, signal });

  for (const type of ['pointerup', 'pointercancel']) {
    window.addEventListener(type, release, { capture: true, signal });
  }
  window.addEventListener('blur', release, { signal });
  return () => { controller.abort(); release(); };
}
