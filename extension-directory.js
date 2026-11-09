const drawers = 'details, .inline-drawer';
const headings = 'h1,h2,h3,h4,h5,h6,[role="heading"]';
const actions = 'button,[role="button"],a[href],input[type="button"],input[type="submit"],.menu_button';
const headerSelector = 'summary,header,.inline-drawer-header,.inline-drawer-toggle,[aria-expanded],' + headings;
const ignored = 'script,style,template,link,meta,hr,[hidden],input[type="hidden"]';
const structural = {childList:true, attributes:true, attributeFilter:['aria-label','title','hidden']};
const labelChanges = {...structural, subtree:true, characterData:true};

function contentChildren(el) {
  return [...el.children].filter(child => !child.matches(ignored));
}

function labelOf(el) {
  const explicit = el.getAttribute('aria-label')?.trim();
  if (explicit) return explicit;
  const label = el.querySelector('b,strong') || el;
  const copy = label.cloneNode(true);
  copy.querySelectorAll('script,style,[hidden],[aria-hidden="true"],.notes-link,.inline-drawer-icon').forEach(child => child.remove());
  return copy.textContent.replace(/\s+/g, ' ').trim() || el.getAttribute('title')?.trim() ||
    (el.matches('input[type="button"],input[type="submit"]') ? el.value : '');
}

// Follow document order so an unmarked caption above a form wins over a
// heading buried in that form. Icon-only launchers can supply an accessible name.
function leadingLabel(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === 1) {
        if (node.matches(ignored + ',[aria-hidden="true"],svg')) return NodeFilter.FILTER_REJECT;
        return node.matches(headerSelector + ',' + actions + ',label,[aria-label],iframe[title]') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  return walker.nextNode();
}

function describe(root, observer) {
  if (root.hidden) observer.observe(root, {attributes:true, attributeFilter:['hidden']});
  if (root.matches(ignored)) return [];
  // ST sometimes puts several independent drawers inside one extension_container.
  // Keep a panel's descendants together once we reach its own title or control.
  let el = root;
  let title;
  for (;;) {
    observer.observe(el, structural);
    if (el.matches('details')) {
      title = el.querySelector(':scope > summary');
      break;
    }
    title = el.matches(headerSelector + ',' + actions) ? el
      : contentChildren(el).find(child => child.matches(headerSelector));
    if (title || el.matches(drawers) || el.hasAttribute('aria-label')) break;
    const children = contentChildren(el);
    if (children.length > 1 && children.every(child => child.matches(drawers))) {
      return children.flatMap(child => describe(child, observer));
    }
    if (children.length !== 1 || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) break;
    el = children[0];
  }

  if (!title && el.hasAttribute('aria-label')) title = el;
  const lead = title || leadingLabel(el);
  title = lead?.nodeType === 1 ? lead : null;
  let name = title ? labelOf(title) : lead?.textContent.trim().replace(/\s+/g, ' ').slice(0, 100);
  const labelElement = title || lead?.parentElement;
  if (labelElement && labelElement !== el) {
    for (let parent = labelElement.parentElement; parent && parent !== el; parent = parent.parentElement) observer.observe(parent, structural);
  }
  if (labelElement) observer.observe(labelElement, labelChanges);
  if (!name) {
    // Empty host slots are populated later. A non-standard editor can still
    // be reached by its text, container ID, or the fallback directory entry.
    observer.observe(el, labelChanges);
    const controls = actions + ',details,input:not([type="hidden"]),select,textarea,iframe,canvas,svg,img';
    const hasContent = el.shadowRoot || el.matches(controls) || el.querySelector(controls);
    if (!hasContent) return [];
    name = el.getAttribute('title') || root.id || el.id || '扩展设置';
  }
  const header = title?.closest('.inline-drawer-header,.inline-drawer-toggle');
  const toggle = header?.matches('.inline-drawer-toggle') ? header : header?.querySelector('.inline-drawer-toggle');
  const details = title?.parentElement?.matches('details') && title.matches('summary') ? title.parentElement : null;
  // Only an explicitly named opener can be invoked from the directory. Other
  // controls (including single save/delete buttons) stay in their own settings.
  const isOpener = !details && !header && title?.matches('button,[role="button"]') &&
    /^[^\p{L}\p{N}]*(?:打开|開啟|打開|open\b|launch\b)/iu.test(name) &&
    (root === title || root.querySelectorAll(actions + ',input:not([type="hidden"]),select,textarea').length === 1);
  return [{ root, name, toggle, details, launcher: isOpener ? title : null }];
}

export function mountExtensionDirectory() {
  const panel = document.querySelector('#rm_extensions_block');
  const columns = panel ? [...panel.querySelectorAll('#extensions_settings, #extensions_settings2')] : [];
  if (!columns.length) return () => {};
  const tools = document.createElement('div');
  tools.className = 'cg-extension-directory';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = '搜索扩展设置';
  input.setAttribute('aria-label', input.placeholder);
  const list = document.createElement('div');
  list.className = 'cg-extension-list';
  const empty = document.createElement('p');
  empty.textContent = '没有匹配的扩展设置';
  const buttons = new Map();
  let items = new Map(), selected = null, full = false, frame = 0;
  const path = new Set();

  function button(name, fn) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = name;
    el.addEventListener('click', fn);
    return el;
  }
  const back = button('返回扩展列表', () => {
    const previous = selected;
    selected = null;
    show();
    (buttons.get(previous) || input).focus();
  });
  const toggle = button('完整设置', () => {
    full = !full;
    selected = null;
    show();
    if (!full) input.focus();
  });
  toggle.setAttribute('aria-label','显示完整扩展设置');
  tools.append(back, input, toggle, list, empty);
  columns[0].before(tools);

  function filter() {
    const query = input.value.trim().toLocaleLowerCase();
    let matches = 0;
    for (const [el, {name}] of items) {
      const match = name.toLocaleLowerCase().includes(query);
      buttons.get(el).hidden = !match;
      if (match) matches++;
    }
    empty.hidden = Boolean(selected || full || matches);
  }
  function clearPath() {
    for (const node of path) node.classList.remove('cg-extension-parent', 'cg-extension-current');
    path.clear();
  }
  function show() {
    clearPath();
    for (let node = selected; node && node !== panel; node = node.parentElement) {
      node.classList.add(node === selected ? 'cg-extension-current' : 'cg-extension-parent');
      path.add(node);
      if (columns.includes(node)) break;
    }
    const directory = !selected && !full;
    input.hidden = list.hidden = !directory;
    back.hidden = !selected;
    toggle.setAttribute('aria-pressed', String(full));
    toggle.textContent = full ? '返回分类' : '完整设置';
    panel.classList.toggle('cg-extension-index', directory);
    panel.classList.toggle('cg-extension-detail', Boolean(selected));
    filter();
  }
  function open(el) {
    const item = items.get(el);
    if (!item) return;
    selected = el;
    show();
    if (item.details) item.details.open = true;
    if (item.toggle?.querySelector('.inline-drawer-icon.down')) item.toggle.click();
    back.focus();
    if (item.launcher && !item.launcher.matches(':disabled,[aria-disabled="true"]')) item.launcher.click();
  }

  function index() {
    observer.disconnect();
    const next = new Map();
    for (const col of columns) {
      observer.observe(col, {childList:true});
      for (const root of col.children) {
        for (const item of describe(root, observer)) next.set(item.root, item);
      }
    }
    for (const [el, choice] of buttons) {
      if (!next.has(el)) { choice.remove(); buttons.delete(el); }
    }
    let i = 0;
    for (const [el, {name}] of next) {
      let choice = buttons.get(el);
      if (!choice) {
        choice = button(name, () => open(el));
        buttons.set(el, choice);
      }
      if (choice.textContent !== name) choice.textContent = name;
      if (list.children[i] !== choice) list.insertBefore(choice, list.children[i] || null);
      i++;
    }
    items = next;
    const removed = selected && !items.has(selected);
    if (removed) selected = null;
    show();
    if (removed) input.focus();
  }
  function schedule() {
    if (frame || !panel.classList.contains('openDrawer')) return;
    frame = requestAnimationFrame(() => { frame = 0; index(); });
  }
  const observer = new MutationObserver(schedule);
  let wasOpen = panel.classList.contains('openDrawer');
  const panelObserver = new MutationObserver(() => {
    const open = panel.classList.contains('openDrawer');
    if (open && !wasOpen) schedule();
    wasOpen = open;
  });
  panelObserver.observe(panel, {attributes:true, attributeFilter:['class']});
  input.addEventListener('input', filter);
  index();
  return () => {
    observer.disconnect();
    panelObserver.disconnect();
    cancelAnimationFrame(frame);
    clearPath();
    panel.classList.remove('cg-extension-index', 'cg-extension-detail');
    tools.remove();
  };
}
