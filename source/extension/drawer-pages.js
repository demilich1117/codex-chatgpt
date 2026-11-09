import {mountExtensionDirectory} from './extension-directory.js';

// Each category reveals the original controls in place, including fields added by providers.
const layouts = [
  ['#user-settings-block', [
    ['外观', '#UI-Theme-Block'],
    ['阅读与输入', '#power-user-options-block'],
    ['角色与杂项', '#UI-Customization'],
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
  // Keep the chosen category when the host updates a drawer's children.
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

export function mountDrawerPages() {
  const cleanups = layouts.flatMap(([selector,groups]) => {
    const root = document.querySelector(selector);
    return root ? [mountPages(root,groups)] : [];
  });
  cleanups.push(mountExtensionDirectory());
  return () => cleanups.forEach(cleanup => cleanup());
}
