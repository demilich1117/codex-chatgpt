// Preview the divider on its own layer. Reflow the actual form or chat only on release.
export function bindWidthGrip(grip, { range, direction, commit }, signal) {
  let drag = null;
  let frame = 0;

  function cancel() {
    if (!drag) return;
    const { guide, pointerId } = drag;
    drag = null;
    cancelAnimationFrame(frame);
    frame = 0;
    guide.remove();
    if (grip.hasPointerCapture(pointerId)) grip.releasePointerCapture(pointerId);
  }

  function widthAt(x) {
    const { width, min, max, startX } = drag;
    return Math.round(Math.max(min, Math.min(max, width + direction * (x - startX))));
  }

  grip.addEventListener('pointerdown', event => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const bounds = range();
    if (!bounds) return;
    const rect = grip.getBoundingClientRect();
    const guide = document.createElement('div');
    guide.className = 'cg-width-guide';
    guide.setAttribute('aria-hidden', 'true');
    guide.style.left = (rect.left + rect.width / 2 - 1) + 'px';
    guide.style.top = rect.top + 'px';
    guide.style.height = rect.height + 'px';
    document.body.append(guide);
    drag = { ...bounds, startX: event.clientX, x: event.clientX, pointerId: event.pointerId, guide };
    event.preventDefault();
    event.stopPropagation();
    grip.setPointerCapture(event.pointerId);
    grip.focus({ preventScroll: true });
  }, { signal });

  grip.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.pointerId) return;
    drag.x = event.clientX;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const delta = direction * (widthAt(drag.x) - drag.width);
      drag.guide.style.transform = 'translateX(' + delta + 'px)';
    });
  }, { signal });

  grip.addEventListener('pointerup', event => {
    if (event.pointerId !== drag?.pointerId) return;
    const next = widthAt(event.clientX);
    const changed = event.clientX !== drag.startX && next !== Math.round(drag.width);
    cancel();
    if (changed) commit(next);
  }, { signal });
  const cancelPointer = event => { if (event.pointerId === drag?.pointerId) cancel(); };
  grip.addEventListener('pointercancel', cancelPointer, { signal });
  grip.addEventListener('lostpointercapture', cancelPointer, { signal });
  window.addEventListener('blur', cancel, { signal });
  window.addEventListener('resize', cancel, { signal });
  signal.addEventListener('abort', cancel, { once: true });
  return cancel;
}
