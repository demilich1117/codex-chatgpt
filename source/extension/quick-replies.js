// The host owns popout contents, activation, drag handling and docking state.
export function mountQuickReplies() {
  const form = document.querySelector('#send_form');
  if (!form) return () => {};
  const dock = document.createElement('button');
  dock.type = 'button';
  dock.className = 'cg-qr-dock';
  dock.textContent = '收回快捷回复';
  dock.title = '将快捷回复放回输入框上方';
  dock.hidden = true;
  form.prepend(dock);
  let panel = null;
  let frame = 0;
  const viewport = window.visualViewport;
  const sizeObserver = new ResizeObserver(schedule);
  const gap = 8;

  function placePanel() {
    frame = 0;
    if (!panel?.isConnected) return;
    const anchor = form.getBoundingClientRect();
    const left = (viewport?.offsetLeft ?? 0) + gap;
    const top = (viewport?.offsetTop ?? 0) + gap;
    const width = Math.max(1, (viewport?.width ?? innerWidth) - gap * 2);
    const height = Math.max(1, (viewport?.height ?? innerHeight) - gap * 2);
    const availableWidth = Math.min(anchor.width || width, width);
    const right = Math.min(left + width, Math.max(left + availableWidth, anchor.right));
    // Leave a usable header and reply row when the keyboard or a tall draft fills the screen.
    const bottom = Math.min(top + height, Math.max(top + Math.min(96, height), anchor.top - gap));
    const customX = Number.isFinite(parseFloat(panel.style.left));
    const customY = Number.isFinite(parseFloat(panel.style.top));
    const style = panel.style;
    style.setProperty('--cg-qr-right', customX ? 'auto' : (innerWidth - right) + 'px');
    style.setProperty('--cg-qr-bottom', customY ? 'auto' : (innerHeight - bottom) + 'px');
    style.setProperty('--cg-qr-width', availableWidth + 'px');
    style.setProperty('--cg-qr-max-width', width + 'px');
    const maxHeight = customY ? height : Math.min(448, bottom - top);
    style.setProperty('--cg-qr-max-height', maxHeight + 'px');
    // The host supplies inline coordinates for manually moved windows. Only
    // correct them if they have fallen outside the current visible viewport.
    if (customX || customY) {
      const rect = panel.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(left, Math.min(rect.left, left + width - rect.width));
      const y = Math.max(top, Math.min(rect.top, top + height - rect.height));
      if (customX && Math.abs(rect.left - x) > 1) style.left = x + 'px';
      if (customY && Math.abs(rect.top - y) > 1) style.top = y + 'px';
    }
  }
  function schedule() {
    if (panel && !frame) frame = requestAnimationFrame(placePanel);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    panel = document.getElementById('qr--popout');
    dock.hidden = !panel;
    sizeObserver.disconnect();
    if (panel) {
      sizeObserver.observe(form);
      const chat = form.closest('#sheld');
      if (chat) sizeObserver.observe(chat);
      placePanel();
    }
  }
  dock.addEventListener('click', () => panel?.querySelector('.qr--close')?.click());
  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.id === 'qr--popout'))) sync();
  });
  observer.observe(document.body, { childList: true });
  window.addEventListener('resize', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  sync();
  return () => {
    observer.disconnect();
    sizeObserver.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    dock.remove();
  };
}
