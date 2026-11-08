// Each category reveals the original controls in place, including fields added by providers.
const layouts = [
  ['#user-settings-block', [
    ['外观', '#UI-Theme-Block'],
    ['阅读与输入', '#power-user-options-block'],
    ['角色与杂项', '#UI-Customization'],
  ]],
  ['#rm_api_block', [
    ['服务商与模型', ':scope > div:has(#main_api)'],
    ['连接档案', ':scope > div:has(#connection_profiles)'],
    ['密钥管理', ':scope > div:has(#viewSecrets)'],
  ]],
  ['#left-nav-panel', [
    ['预设与常用参数', '#respective-presets-block, #common-gen-settings-block'],
    ['模型参数', '#respective-ranges-and-temps, #advanced-ai-config-block'],
  ]],
  ['#AdvancedFormatting', [
    ['上下文', '#ContextSettings'],
    ['指令模板', '#InstructSettingsColumn'],
    ['系统与推理', '#SystemPromptColumn'],
  ]],
  ['#PersonaManagement', [
    ['身份列表', '.persona_management_left_column'],
    ['当前身份', '.persona_management_current_persona'],
    ['全局设置', '.persona_management_global_settings'],
  ]],
  ['#Backgrounds', [
    ['背景图库', '#bg_tabs, #bg_add_folder_button, #add_background_button_top, .bg-header-row-2, #bg-scroll-top'],
    ['显示与自动选择', '#background_fitting, #auto_background'],
  ]],
  ['#form_create', [
    ['角色设定', '#descriptionWrapper, #spoiler_free_desc, #creators_note_desc_hidden'],
    ['开场白', '#firstMessageWrapper'],
  ]],
];

function button(label, onClick) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function mountPages(root, definitions) {
  const nav = document.createElement('nav');
  nav.className = 'cg-drawer-pages';
  nav.setAttribute('aria-label', '内容分类');
  const all = '全部';
  let active = definitions[0][0];
  const entries = [...definitions, [all]].map(([label, selector]) => {
    const control = button(label, () => select(label));
    nav.append(control);
    return {label, selector, control};
  });
  const marked = new Set();
  function select(label) {
    active = label;
    for (const entry of entries) {
      const elements = entry.selector ? [...root.querySelectorAll(entry.selector)] : [];
      entry.control.hidden = Boolean(entry.selector && !elements.length);
      entry.control.setAttribute('aria-pressed', String(entry.label === active));
      for (const element of elements) {
        marked.add(element);
        element.classList.toggle('cg-category-hidden', active !== all && active !== entry.label);
      }
    }
    root.classList.toggle('cg-categorized', active !== all);
  }
  const header = root.querySelector(':scope > .cg-panel-header, :scope > #avatar-and-name-block');
  if (!header || definitions.filter(([,selector]) => root.querySelector(selector)).length < 2) return () => {};
  header.after(nav);
  select(active);
  // Connection Manager can mount its profile block after this extension.
  const observer = new MutationObserver(() => select(active));
  observer.observe(root, {childList:true});
  const search = root.querySelector('#settingsSearch');
  const showMatches = () => { if (search.value.trim()) select(all); };
  search?.addEventListener('input', showMatches);
  return () => {
    observer.disconnect();
    search?.removeEventListener('input', showMatches);
    for (const element of marked) element.classList.remove('cg-category-hidden');
    root.classList.remove('cg-categorized');
    nav.remove();
  };
}

function mountExtensionDirectory() {
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
  const back = button('返回扩展列表', () => {
    const previous = selected;
    selected = null; full = false;
    render();
    (buttons.get(previous) || input).focus();
  });
  const toggle = button('完整设置', () => {
    full = !full;
    selected = null;
    render();
    if (!full) input.focus();
  });
  toggle.setAttribute('aria-label','显示完整扩展设置');
  tools.append(back, input, toggle, list);
  columns[0].before(tools);
  let full = false, selected = null, frame = 0;
  const buttons = new Map();
  const marked = new Set();
  function render() {
    const items = columns.flatMap(col => [...col.children]).flatMap(el => {
      const title = el.querySelector('.inline-drawer-header b, .inline-drawer-header, h4, h3');
      const name = title?.textContent.trim();
      return name ? [{el, name}] : [];
    });
    if (selected && !items.some(item => item.el === selected)) selected = null;
    const directory = !selected && !full;
    input.hidden = list.hidden = !directory;
    back.hidden = !selected;
    toggle.setAttribute('aria-pressed', String(full));
    toggle.textContent = full ? '返回分类' : '完整设置';
    panel.classList.toggle('cg-extension-index', directory);
    panel.classList.toggle('cg-extension-detail', Boolean(selected));
    let matches = 0;
    const query = input.value.trim().toLocaleLowerCase();
    for (const {el,name} of items) {
      marked.add(el);
      el.classList.toggle('cg-category-hidden', Boolean(selected) && el !== selected);
      let choice = buttons.get(el);
      if (!choice) {
        choice = button(name, () => {
          selected = el;
          render();
          const header = el.querySelector('.inline-drawer-toggle');
          if (header?.querySelector('.inline-drawer-icon.down')) header.click();
          back.focus();
        });
        list.append(choice);
        buttons.set(el, choice);
      }
      if (choice.textContent !== name) choice.textContent = name;
      choice.hidden = !name.toLocaleLowerCase().includes(query);
      if (!choice.hidden) matches++;
    }
    for (const [el,choice] of buttons) {
      if (!columns.some(col => el.parentElement === col)) {
        choice.remove(); buttons.delete(el); marked.delete(el);
        el.classList.remove('cg-category-hidden');
      }
    }
    empty.hidden = !directory || matches > 0;
  }
  const empty = document.createElement('p');
  empty.textContent = '没有匹配的扩展设置';
  list.after(empty);
  input.addEventListener('input',render);
  // Only index installed settings when the drawer is open. Ignore frequent editor updates.
  const update = () => {
    if (!panel.classList.contains('openDrawer') || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  };
  const observer = new MutationObserver(update);
  for (const col of columns) observer.observe(col, {childList:true,subtree:true});
  observer.observe(panel, {attributes:true, attributeFilter:['class']});
  render();
  return () => {
    observer.disconnect(); cancelAnimationFrame(frame);
    for (const item of marked) item.classList.remove('cg-category-hidden');
    panel.classList.remove('cg-extension-index','cg-extension-detail');
    tools.remove();
  };
}

export function mountDrawerPages() {
  const cleanups = layouts.flatMap(([selector,groups]) => {
    const root = document.querySelector(selector);
    return root ? [mountPages(root,groups)] : [];
  });
  cleanups.push(mountExtensionDirectory());
  return () => cleanups.forEach(cleanup => cleanup());
}
