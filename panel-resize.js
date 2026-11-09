import { bindWidthGrip } from './width-grip.js';

// One edge handle follows the open native drawer.
export function mountPanelResize({ panels, getWidth, setWidth, save }) {
  const controller = new AbortController();
  const { signal } = controller;
  const grip = document.createElement('div');
  grip.className = 'cg-panel-resize';
  grip.hidden = true;
  grip.tabIndex = 0;
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'vertical');
  grip.setAttribute('aria-label', '抽屉宽度');
  grip.title = '拖动调整宽度（480–1100px），双击恢复默认；方向键微调';
  document.body.append(grip);
  let active = null;
  let frame = 0;

  function range(rect = active?.getBoundingClientRect()) {
    if (!rect) return null;
    const nav = document.querySelector(document.body.classList.contains('cg-collapsed') ? '.cg-rail' : '.cg-sidebar');
    const navRight = nav?.getBoundingClientRect().right || 0;
    return {
      width: rect.width || getWidth(),
      min: 480,
      max: Math.min(1100, Math.max(480, innerWidth - navRight - 24)),
    };
  }

  function commit(width) {
    setWidth(width);
    save();
  }
  const cancelDrag = bindWidthGrip(grip, { range, direction: -1, commit }, signal);

  function update() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const next = innerWidth > 1000 ? panels.find(panel => panel.classList.contains('openDrawer') && panel.getClientRects().length) || null : null;
      if (next !== active) cancelDrag();
      active = next;
      grip.hidden = !active;
      if (!active) return;
      const rect = active.getBoundingClientRect();
      const { min, max } = range(rect);
      const width = Math.round(rect.width);
      grip.style.left = (rect.left - 6) + 'px';
      grip.style.top = (rect.top + 14) + 'px';
      grip.style.height = Math.max(0, rect.height - 28) + 'px';
      grip.setAttribute('aria-valuemin', String(min));
      grip.setAttribute('aria-valuemax', String(max));
      grip.setAttribute('aria-valuenow', String(width));
      grip.setAttribute('aria-valuetext', width + ' 像素');
    });
  }

  // ST treats presses outside a drawer as a request to close it.
  for (const event of ['mousedown', 'touchstart']) {
    grip.addEventListener(event, e => e.stopPropagation(), { signal });
  }
  grip.addEventListener('dblclick', () => commit(760), { signal });
  grip.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const bounds = range();
    if (!bounds) return;
    event.preventDefault();
    const { width, min, max } = bounds;
    const next = event.key === 'Home' ? min : event.key === 'End' ? max : width + (event.key === 'ArrowLeft' ? 20 : -20);
    commit(Math.round(Math.max(min, Math.min(max, next))));
  }, { signal });
  window.addEventListener('resize', update, { signal });
  const observer = new ResizeObserver(update);
  panels.forEach(panel => observer.observe(panel));
  update();
  return {
    update,
    destroy() {
      controller.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      grip.remove();
    },
  };
}
