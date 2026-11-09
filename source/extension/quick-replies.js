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

  function keepOnScreen() {
    frame = 0;
    if (!panel?.isConnected) return;
    const rect = panel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // A host-saved desktop position can be outside a newly narrowed viewport.
    // Adjust the current element only; the extension still saves user drags.
    const left = Math.max(0, Math.min(rect.left, innerWidth - rect.width));
    const top = Math.max(0, Math.min(rect.top, innerHeight - rect.height));
    if (Math.abs(left - rect.left) > 1) { panel.style.left = left + 'px'; panel.style.right = 'auto'; }
    if (Math.abs(top - rect.top) > 1) { panel.style.top = top + 'px'; panel.style.bottom = 'auto'; }
  }
  function schedule() {
    if (panel && !frame) frame = requestAnimationFrame(keepOnScreen);
  }
  function sync() {
    panel = document.getElementById('qr--popout');
    dock.hidden = !panel;
    schedule();
  }
  dock.addEventListener('click', () => panel?.querySelector('.qr--close')?.click());
  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.id === 'qr--popout'))) sync();
  });
  observer.observe(document.body, { childList: true });
  window.addEventListener('resize', schedule);
  sync();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    dock.remove();
  };
}
