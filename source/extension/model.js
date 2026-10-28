export const KEY = 'codex_chatgpt_theme';
export const DEFAULTS = Object.freeze({enabled:true, mode:'dark', accent:'#0169cc', sidebarWidth:280, sidebarCollapsed:false, showIdentity:false, pinned:[]});
export const PANELS = Object.freeze([
  ['ai-config-button','回复配置','sliders'], ['sys-settings-button','API 连接','plug'],
  ['advanced-formatting-button','回复格式','text'], ['WI-SP-button','世界书','book'],
  ['user-settings-button','用户设置','settings'], ['backgrounds-button','背景','image'],
  ['extensions-settings-button','扩展','grid'], ['persona-management-button','用户角色','user'],
  ['rightNavHolder','角色管理','users'],
]);
export function normalize(raw = {}) {
  return {...DEFAULTS,...raw, enabled:raw.enabled !== false,
    mode:['light','dark','system'].includes(raw.mode) ? raw.mode : 'dark',
    accent:/^#[\da-f]{6}$/i.test(raw.accent || '') ? raw.accent : DEFAULTS.accent,
    sidebarWidth:Math.min(420,Math.max(230,Number(raw.sidebarWidth) || 280)),
    pinned:Array.isArray(raw.pinned) ? raw.pinned.filter(x=>typeof x==='string') : [],
  };
}
export function foreground(hex) {
  const rgb = hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722 > .179 ? '#111111' : '#ffffff';
}
export function currentIdentity(ctx) {
  if (ctx.groupId != null) return `group:${ctx.groupId}`;
  const char=ctx.characters?.[ctx.characterId];
  return char?.avatar ? `character:${char.avatar}` : '';
}
