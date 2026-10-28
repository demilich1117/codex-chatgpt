// Internal ST imports are isolated here; verified against ST 1.19 and TT's ST 1.18 snapshot.
export const context = () => window.SillyTavern.getContext();
export async function pastChats() {
  const ctx=context();
  if(ctx.groupId != null) return (ctx.groups.find(g=>String(g.id)===String(ctx.groupId))?.chats || []).map(name=>({file_name:name}));
  if(ctx.characterId == null) return [];
  const {getPastCharacterChats}=await import('/script.js');
  return getPastCharacterChats(ctx.characterId);
}
export async function openCharacter(avatar) {
  const ctx=context(), id=ctx.characters.findIndex(c=>c.avatar===avatar);
  if(id<0) throw new Error('这个角色已不存在。');
  await ctx.selectCharacterById(id,{switchMenu:false});
}
export async function openChat(name, groupId) {
  const ctx=context();
  if(groupId != null) await ctx.openGroupChat(groupId,name);
  else await ctx.openCharacterChat(name.replace(/\.jsonl$/i,''));
}
export function busy() {
  return Boolean(document.querySelector('#mes_stop')?.getClientRects().length || document.querySelector('.edit_textarea'));
}
export function clickNative(selector) {
  const el=document.querySelector(selector);
  if(!el) throw new Error('此宿主没有这个原生入口。');
  // The options anchor is hidden by this theme. ST otherwise treats its forwarded
  // click as outside the menu (the hidden anchor cannot be hovered or focused).
  // Contain only this synthetic click; subsequent outside clicks remain native.
  if(selector === '#options_button') {
    const contain = event => event.stopPropagation();
    el.addEventListener('click', contain, {once:true});
    try { el.click(); } finally { el.removeEventListener('click', contain); }
    return;
  }
  el.click();
}
