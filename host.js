// Internal ST imports are isolated here; verified against ST 1.19 and TT's ST 1.18 snapshot.
export const context = () => window.SillyTavern.getContext();
export async function pastChats() {
  const ctx=context(), characterId=ctx.characterId, groupId=ctx.groupId;
  if(groupId == null && characterId == null) return [];
  const {timestampToMoment}=await import('/scripts/utils.js');
  let chats;
  if(groupId != null) {
    const {getGroupPastChats}=await import('/scripts/group-chats.js');
    chats=await getGroupPastChats(groupId);
  } else {
    const {getPastCharacterChats}=await import('/script.js');
    chats=await getPastCharacterChats(characterId);
  }
  return chats.map(chat=>({...chat,lastTime:Number(timestampToMoment(chat.last_mes).valueOf())||0}));
}
export async function openCharacter(avatar) {
  const ctx=context(), id=ctx.characters.findIndex(c=>c.avatar===avatar);
  if(id<0) throw new Error('这个角色已不存在。');
  await ctx.selectCharacterById(id,{switchMenu:false});
}
export async function openChat(name, groupId) {
  const ctx=context();
  if(groupId != null) await openGroup(groupId,name);
  else await ctx.openCharacterChat(name.replace(/\.jsonl$/i,''));
}
export async function openGroup(groupId, name) {
  const native=await import('/scripts/group-chats.js');
  const group=context().groups.find(g=>String(g.id)===String(groupId));
  if(!group)throw new Error('这个群聊已不存在。');
  // ST openGroupChat only loads a file; openGroupById also sets selected_group.
  if(String(context().groupId)!==String(group.id))await native.openGroupById(group.id);
  if(String(context().groupId)!==String(group.id))throw new Error('群聊尚未切换，请等待保存结束后重试。');
  if(name&&context().chatId!==name)await context().openGroupChat(group.id,name);
}
export function busy() {
  return Boolean((typeof context().isGenerating==='function'&&context().isGenerating()) || document.querySelector('#mes_stop')?.getClientRects().length || document.querySelector('.edit_textarea, .reasoning_edit_textarea'));
}
export function assertIdle() {
  if(busy())throw new Error('请先结束生成或消息编辑，再执行此操作。');
  if(document.querySelector('#send_textarea')?.value.trim())throw new Error('输入框还有草稿，请先处理草稿。');
}
export function selectionToken() {
  const ctx=context();return JSON.stringify([ctx.characters[ctx.characterId]?.avatar,ctx.groupId,ctx.chatId]);
}
export function assertSelection(token) {
  assertIdle();
  if(selectionToken()!==token)throw new Error('当前对话已变化，操作已取消，请重新选择。');
}
export async function confirmDelete(entry) {
  const {Popup,POPUP_TYPE}=await import('/scripts/popup.js');
  const content=document.createElement('div'),description=document.createElement('p');
  description.textContent=entry.kind==='character'?`删除角色「${entry.name}」？此操作无法撤销。`:`永久删除聊天「${entry.name}」？此操作无法撤销。`;
  content.append(description);
  const checkbox=document.createElement('input');checkbox.type='checkbox';
  if(entry.kind==='character'){
    const label=document.createElement('label');label.className='checkbox_label';
    label.append(checkbox,document.createTextNode('同时删除这个角色的全部聊天（包括已归档聊天）'));content.append(label);
    const note=document.createElement('p');note.textContent='默认保留聊天文件；重新导入同一头像文件名的角色卡后可找回。只想收起角色时，请使用归档。';content.append(note);
  }
  const heading=document.createElement('h3');heading.textContent='确认删除';content.prepend(heading);
  const confirmed=await new Popup(content,POPUP_TYPE.CONFIRM,'',{okButton:'删除',cancelButton:'取消'}).show();
  return confirmed?{deleteChats:checkbox.checked}:null;
}
export async function removeEntry(entry, options, token) {
  const native=await import('/script.js');
  const groupNative=entry.kind==='chat'&&entry.groupId!=null?await import('/scripts/group-chats.js'):null;
  assertSelection(token);
  if(native.isGenerating?.())throw new Error('请先结束生成，再执行删除。');
  if(entry.kind==='character'){
    if(typeof native.deleteCharacter!=='function')throw new Error('此宿主不支持快捷删除角色，请使用原生角色管理。');
    if(!context().characters.some(c=>c.avatar===entry.avatar))throw new Error('这个角色已不存在。');
    if(!await native.deleteCharacter(entry.avatar,options))throw new Error('角色未删除，已保留侧栏状态。');
    return;
  }
  if(entry.kind!=='chat')throw new Error('请在原生群聊管理中删除群聊。');
  const ctx=context(),isGroup=entry.groupId!=null;
  const id=()=>context().characters.findIndex(c=>c.avatar===entry.avatar);
  if(isGroup?!ctx.groups.some(g=>String(g.id)===String(entry.groupId)):id()<0)throw new Error('聊天所属角色或群聊已不存在。');
  const remove=isGroup?groupNative.deleteGroupChatByName:native.deleteCharacterChatByName;
  if(typeof remove!=='function'||typeof native.closeCurrentChat!=='function')throw new Error('此宿主不支持快捷删除聊天，请使用原生聊天管理。');
  const active=ctx.chatId===entry.name&&(isGroup?String(ctx.groupId)===String(entry.groupId):ctx.groupId==null&&ctx.characters[ctx.characterId]?.avatar===entry.avatar);
  // Native delete-by-name updates the persisted selection, but does not replace
  // the visible chat. Close first so deleted messages cannot be autosaved back.
  let closed=false,deleted=false,returned=false,closedToken;
  const event=ctx.eventTypes[isGroup?'GROUP_CHAT_DELETED':'CHAT_DELETED'];
  const group=isGroup?ctx.groups.find(g=>String(g.id)===String(entry.groupId)):null;
  const originalIndex=group?.chats.indexOf(entry.name);
  const onDeleted=name=>{if(name===entry.name)deleted=true;};
  ctx.eventSource.on(event,onDeleted);
  try{
    if(active){
      if(!await native.closeCurrentChat())throw new Error('当前聊天无法关闭，已取消删除。');
      closed=true;closedToken=selectionToken();assertIdle();
    }
    await remove(isGroup?entry.groupId:id(),entry.name);
    returned=true;
    if(!deleted)throw new Error('聊天未删除，请检查连接后重试。');
  }finally{
    ctx.eventSource.removeListener(event,onDeleted);
    // The native group helper removes the index entry before checking HTTP success.
    if(group&&returned&&!deleted&&originalIndex>=0&&!group.chats.includes(entry.name))group.chats.splice(originalIndex,0,entry.name);
    // Never steal focus from a different conversation chosen while awaiting I/O.
    if(closed&&selectionToken()===closedToken&&!native.isGenerating?.()&&!busy()&&!document.querySelector('#send_textarea')?.value.trim()){
      if(isGroup){
        const group=context().groups.find(g=>String(g.id)===String(entry.groupId));
        if(group?.chats.includes(group.chat_id))await openGroup(group.id,group.chat_id);
        else if(group&&deleted){await groupNative.createNewGroupChat(group.id);await openGroup(group.id,group.chat_id);}
      }
      else if(id()>=0)await openCharacter(entry.avatar);
    }
  }
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
