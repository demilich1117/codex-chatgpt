import {KEY,DEFAULTS,PANELS,normalize,foreground,currentIdentity} from './model.js';
import {context,pastChats,openCharacter,openChat,busy,clickNative} from './host.js';
import {icon} from './icons.js';
import {mountActivity} from './activity.js';

let settings, controller, observer, roots=[], subscriptions=[], modeQuery, mobileQuery;
let historyGeneration=0, sidebar, header, search, navBody, historyList, title, appearance, panelReturn=null;
const $=s=>document.querySelector(s);
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
const listen=(el,event,fn)=>el.addEventListener(event,fn,{signal:controller.signal});
function button(label,glyph,fn,cls='cg-button') {
 const b=node('button',cls);b.type='button';b.title=label;b.setAttribute('aria-label',label);
 if(glyph)b.append(icon(glyph));if(!['cg-icon','cg-dismiss','cg-swatch'].includes(cls))b.append(node('span','',label));
 listen(b,'click',e=>{e.stopPropagation();Promise.resolve(fn?.(e)).catch(report);});return b;
}
function report(e){window.toastr?.warning(e.message || String(e),'Codex / ChatGPT');console.warn('[codex-chatgpt]',e);}
function save(){context().extensionSettings[KEY]={...context().extensionSettings[KEY],...settings};context().saveSettingsDebounced();}
function setAppearance(){
 const body=document.body;body.dataset.cgMode=settings.mode==='system'?(modeQuery.matches?'dark':'light'):settings.mode;
 body.style.setProperty('--cg-accent',settings.accent);body.style.setProperty('--cg-on-accent',foreground(settings.accent));
 body.style.setProperty('--cg-sidebar-width',`${settings.sidebarWidth}px`);
 body.classList.toggle('cg-collapsed',settings.sidebarCollapsed);
 body.classList.toggle('cg-identities',settings.showIdentity);
}
function setSidebar(open,focus=true){
 if(mobileQuery.matches){document.body.classList.toggle('cg-nav-open',open);sidebar.inert=!open;$('#sheld').inert=open;}
 else {settings.sidebarCollapsed=!open;save();setAppearance();sidebar.inert=!open;}
 $('[data-cg-menu]')?.setAttribute('aria-expanded',String(open));
 if(open&&focus)(mobileQuery.matches?sidebar.querySelector('button'):search).focus();else if(!open&&focus)$('[data-cg-menu]')?.focus();
}
function closeNative(){
 for(const [id] of PANELS){const p=$(`#${id} > .drawer-content`);if(p?.classList.contains('openDrawer'))clickNative(`#${id} > .drawer-toggle`);}
}
function openPanel(id,trigger){
 appearance.hidden=true;closeNative();panelReturn=trigger||document.activeElement;
 if(mobileQuery.matches)setSidebar(false,false);
 const panel=$(`#${id} > .drawer-content`);
 if(!panel)throw new Error('原生面板在此宿主中不可用。');
 clickNative(`#${id} > .drawer-toggle`);
 requestAnimationFrame(()=>panel.querySelector('.cg-panel-header button')?.focus());
}
function returnFocus(){if(mobileQuery.matches&&sidebar.contains(panelReturn))setSidebar(true,false);if(panelReturn?.getClientRects().length&&!panelReturn.closest('[hidden]'))panelReturn.focus();else $('[data-cg-menu]')?.focus();}
function closePanel(){closeNative();document.body.classList.remove('cg-panel-open');returnFocus();}
function closeAppearance(){appearance.hidden=true;returnFocus();}
function navigate(fn){
 if(busy())throw new Error('请先结束生成或消息编辑，再切换对话。');
 if($('#send_textarea')?.value.trim())throw new Error('输入框还有草稿，请先处理草稿再切换。');
 return Promise.resolve(fn()).then(()=>{if(mobileQuery.matches)setSidebar(false,false);});
}
function openNativeAction(selector){clickNative(selector);if(mobileQuery.matches)setSidebar(false,false);}
function buildPanels(){
 for(const [id,label] of PANELS){
  const panel=$(`#${id} > .drawer-content`);if(!panel)continue;
  const bar=node('div','cg-panel-header');bar.append(button('返回','arrow',closePanel,'cg-icon'),node('strong','',label));
  panel.prepend(bar);roots.push(bar);panel.classList.add('cg-native-panel');
 }
 observer=new MutationObserver(()=>{
  const open=PANELS.some(([id])=>$(`#${id} > .drawer-content`)?.classList.contains('openDrawer'));
  document.body.classList.toggle('cg-panel-open',open);
  for(const b of document.querySelectorAll('[data-cg-panel]'))b.setAttribute('aria-expanded',String($(`#${b.dataset.cgPanel} > .drawer-content`)?.classList.contains('openDrawer')||false));
 });
 for(const [id] of PANELS){const p=$(`#${id} > .drawer-content`);if(p)observer.observe(p,{attributes:true,attributeFilter:['class']});}
}
function buildAppearance(){
 appearance=node('section','cg-appearance');appearance.id='cg-appearance';appearance.hidden=true;
 appearance.setAttribute('role','dialog');appearance.setAttribute('aria-modal','true');appearance.setAttribute('aria-label','外观');
 appearance.setAttribute('data-tt-mobile-surface','fullscreen-window');
 const bar=node('div','cg-panel-header');bar.append(button('返回聊天','arrow',closeAppearance,'cg-icon'),node('strong','','外观'));appearance.append(bar);
 const body=node('div','cg-appearance-body');body.append(node('h1','','外观'),node('p','cg-muted','桌面 Codex · 手机 ChatGPT'));
 const modes=node('div','cg-mode-options');
 for(const [value,label] of [['system','跟随系统'],['light','浅色'],['dark','深色']]){
  const b=button(label,null,()=>{settings.mode=value;save();setAppearance();refresh();},'cg-mode');b.dataset.mode=value;
  b.prepend(node('span',`cg-mode-preview cg-preview-${value}`));modes.append(b);
 }body.append(modes);
 const colors=node('div','cg-setting-row');colors.append(node('span','','强调色'));const swatches=node('div','cg-swatches');
 for(const color of ['#0169cc','#777777','#21834c','#f4c344','#c8588d','#e6802c','#9566d6']){
  const b=button(`强调色 ${color}`,null,()=>{settings.accent=color;save();setAppearance();refresh();},'cg-swatch');b.style.backgroundColor=color;b.dataset.color=color;swatches.append(b);
 }colors.append(swatches);body.append(colors);
 const custom=node('label','cg-setting-row');custom.append(node('span','','自定义颜色'));const picker=node('input');picker.type='color';picker.value=settings.accent;picker.setAttribute('aria-label','自定义强调色');listen(picker,'input',()=>{settings.accent=picker.value;setAppearance();refresh();});listen(picker,'change',save);custom.append(picker);body.append(custom);
 const identity=node('label','cg-setting-row');identity.append(node('span','','逐条显示头像与名字'));const check=node('input');check.type='checkbox';check.checked=settings.showIdentity;listen(check,'change',()=>{settings.showIdentity=check.checked;save();setAppearance();});identity.append(check);body.append(identity,node('p','cg-muted','群聊始终保留每位发言者的身份。'));
 body.append(button('打开完整用户设置','settings',e=>openPanel('user-settings-button',e.currentTarget)));
 appearance.append(body);document.body.append(appearance);roots.push(appearance);
 function refresh(){for(const b of modes.children)b.setAttribute('aria-pressed',String(b.dataset.mode===settings.mode));for(const b of swatches.children)b.setAttribute('aria-pressed',String(b.dataset.color===settings.accent));picker.value=settings.accent;}
 refresh();
}
function showAppearance(e){panelReturn=e?.currentTarget||document.activeElement;closeNative();if(mobileQuery.matches)setSidebar(false,false);appearance.hidden=false;appearance.querySelector('button').focus();}
function renderNavigation(){
 const ctx=context(),query=search.value.trim().toLocaleLowerCase(),active=currentIdentity(ctx);
 navBody.replaceChildren();
 const items=[...ctx.characters.map(c=>({key:`character:${c.avatar}`,name:c.name,fn:()=>openCharacter(c.avatar)})),...ctx.groups.map(g=>({key:`group:${g.id}`,name:g.name,fn:()=>ctx.openGroupChat(g.id,g.chat_id)}))];
 for(const [heading,itemsInGroup] of [['置顶',items.filter(i=>settings.pinned.includes(i.key))],['角色与群聊',items.filter(i=>!settings.pinned.includes(i.key))]]){
  const list=itemsInGroup.filter(i=>i.name.toLocaleLowerCase().includes(query));if(!list.length)continue;
  navBody.append(node('h2','cg-section-label',heading));
  for(const item of list){
   const row=node('div','cg-nav-row');row.classList.toggle('cg-selected',item.key===active);
   const b=button(item.name,item.key.startsWith('group:')?'users':'chat',()=>navigate(item.fn));b.setAttribute('aria-current',item.key===active?'page':'false');
   const pin=button(settings.pinned.includes(item.key)?'取消置顶':'置顶','pin',()=>{settings.pinned=settings.pinned.includes(item.key)?settings.pinned.filter(k=>k!==item.key):[...settings.pinned,item.key];save();renderNavigation();},'cg-icon');pin.classList.add('cg-pin');pin.setAttribute('aria-pressed',String(settings.pinned.includes(item.key)));row.append(b,pin);navBody.append(row);
  }
 }
 if(!navBody.children.length)navBody.append(node('p','cg-empty',query?'没有匹配的角色或群聊':'从角色管理选择或创建角色。'));
 document.body.classList.toggle('cg-group',ctx.groupId!=null);
 const name=ctx.groupId!=null?ctx.groups.find(g=>String(g.id)===String(ctx.groupId))?.name:ctx.characters[ctx.characterId]?.name;
 title.textContent=name||'新对话';title.title=ctx.chatId||'新对话';
}
async function renderHistory(){
 const generation=++historyGeneration,identity=currentIdentity(context());historyList.replaceChildren(node('p','cg-empty','正在读取聊天列表…'));
 try{
  const chats=await pastChats();if(generation!==historyGeneration||identity!==currentIdentity(context())||!controller)return;
  historyList.replaceChildren();const ctx=context(),query=search.value.trim().toLocaleLowerCase();
  for(const chat of chats.filter(c=>c.file_name?.toLocaleLowerCase().includes(query)).slice(0,30)){
   const name=chat.file_name.replace(/\.jsonl$/i,''),b=button(name,'chat',()=>navigate(()=>openChat(name,ctx.groupId)));
   b.classList.toggle('cg-selected',name===ctx.chatId);historyList.append(b);
  }
  if(!historyList.children.length)historyList.append(node('p','cg-empty',query?'没有匹配的聊天':'当前角色还没有历史聊天。'));
 }catch(e){if(generation===historyGeneration)historyList.replaceChildren(button('读取失败，点击重试','history',renderHistory));console.warn(e);}
}
function mount(){
 if(controller)return;
 settings=normalize(context().extensionSettings[KEY]);controller=new AbortController();modeQuery=matchMedia('(prefers-color-scheme: dark)');mobileQuery=matchMedia('(max-width: 1000px)');
 const controls=node('div','cg-extension-controls');controls.append(node('h4','','Codex / ChatGPT'));
 const enabled=node('label','checkbox_label');const cb=node('input');cb.type='checkbox';cb.checked=settings.enabled;enabled.append(cb,node('span','','启用界面'));controls.append(enabled);$('#extensions_settings2')?.append(controls);roots.push(controls);
 listen(cb,'change',()=>{settings.enabled=cb.checked;save();const target=cb.checked;unmount();settings=normalize({...settings,enabled:target});mount();});
 if(!settings.enabled)return;
 document.body.classList.add('cg-active');setAppearance();
 const rail=node('nav','cg-rail');rail.setAttribute('aria-label','快捷导航');
 rail.append(button('展开或收起侧栏','panel',()=>setSidebar(settings.sidebarCollapsed),'cg-icon'),button('角色与群聊','users',e=>openPanel('rightNavHolder',e.currentTarget),'cg-icon'),button('历史聊天','history',()=>openNativeAction('#option_select_chat'),'cg-icon'),button('扩展','grid',e=>openPanel('extensions-settings-button',e.currentTarget),'cg-icon'),button('外观','settings',showAppearance,'cg-icon'));
 sidebar=node('aside','cg-sidebar');sidebar.id='cg-sidebar';sidebar.setAttribute('aria-label','侧栏');
 const top=node('div','cg-sidebar-heading');top.append(node('strong','cg-brand','Codex'),button('收起侧栏','panel',()=>setSidebar(false),'cg-icon'));sidebar.append(top);
 const searchLabel=node('label','cg-search');searchLabel.append(icon('search'));search=node('input');search.type='search';search.placeholder='搜索角色与当前聊天';search.setAttribute('aria-label','搜索角色与当前聊天');searchLabel.append(search);sidebar.append(searchLabel);
 const scroll=node('div','cg-sidebar-scroll');
 scroll.append(button('角色与群聊','users',e=>openPanel('rightNavHolder',e.currentTarget)),button('管理当前聊天','history',()=>openNativeAction('#option_select_chat')));
 navBody=node('div');scroll.append(navBody,node('h2','cg-section-label','当前角色的聊天'));historyList=node('div','cg-history');scroll.append(historyList);
 const functions=node('details','cg-functions');functions.open=true;const summary=node('summary','cg-section-label','酒馆功能');functions.append(summary);
 for(const [id,label,glyph]of PANELS){const b=button(label,glyph,e=>openPanel(id,e.currentTarget));b.dataset.cgPanel=id;b.setAttribute('aria-expanded','false');functions.append(b);}scroll.append(functions);sidebar.append(scroll);
 const footer=node('div','cg-sidebar-footer');footer.append(button('新对话','compose',()=>navigate(()=>openNativeAction('#option_start_new_chat')),'cg-new-chat'),button('外观','settings',showAppearance,'cg-icon'));sidebar.append(footer);
 const grip=node('div','cg-resize');grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');grip.setAttribute('aria-label','侧栏宽度');
 listen(grip,'pointerdown',e=>{grip.setPointerCapture(e.pointerId);});listen(grip,'pointermove',e=>{if(grip.hasPointerCapture(e.pointerId)){settings.sidebarWidth=normalize({sidebarWidth:e.clientX-48}).sidebarWidth;setAppearance();}});listen(grip,'pointerup',save);listen(grip,'keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();settings.sidebarWidth=normalize({sidebarWidth:settings.sidebarWidth+(e.key==='ArrowRight'?10:-10)}).sidebarWidth;setAppearance();save();}});sidebar.append(grip);
 header=node('header','cg-header');const menu=button('打开侧栏','menu',()=>setSidebar(!document.body.classList.contains('cg-nav-open')),'cg-icon');menu.dataset.cgMenu='';menu.setAttribute('aria-controls','cg-sidebar');menu.setAttribute('aria-expanded','false');title=node('strong','cg-chat-title','新对话');header.append(menu,title,button('会话操作','more',()=>clickNative('#options_button'),'cg-icon'));
 const shade=button('关闭侧栏',null,()=>setSidebar(false),'cg-dismiss');shade.tabIndex=-1;
 document.body.append(rail,sidebar,header,shade);roots.push(rail,sidebar,header,shade);
 buildPanels();buildAppearance();subscriptions.push(mountActivity(context));
 listen(search,'input',()=>{renderNavigation();renderHistory();});listen(modeQuery,'change',setAppearance);
 const resize=()=>{document.body.classList.remove('cg-nav-open');$('#sheld').inert=false;sidebar.inert=mobileQuery.matches||settings.sidebarCollapsed;$('.cg-brand').textContent=mobileQuery.matches?'ChatGPT':'Codex';};listen(mobileQuery,'change',resize);resize();
 listen(document,'keydown',e=>{
  // A native popup owns its Escape/Tab; do not also close the drawer beneath it.
  if(e.target.closest?.('dialog,.select2-container')||document.querySelector('dialog[open],.select2-container--open'))return;
  if(e.key==='Escape'){if(!appearance.hidden)closeAppearance();else if(document.body.classList.contains('cg-panel-open'))closePanel();else if(document.body.classList.contains('cg-nav-open'))setSidebar(false);}
  if(e.key==='Tab'){
   const surface=!appearance.hidden?appearance:mobileQuery.matches&&document.body.classList.contains('cg-nav-open')?sidebar:null;
   if(!surface)return;const controls=[...surface.querySelectorAll('button,input,select,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled);
   const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 });
 const ctx=context(),update=()=>{renderNavigation();renderHistory();};
 for(const key of ['CHAT_CHANGED','CHARACTER_EDITED','CHARACTER_DELETED','GROUP_UPDATED','CHAT_RENAMED','CHAT_DELETED']){const event=ctx.eventTypes[key];if(event){ctx.eventSource.on(event,update);subscriptions.push(()=>ctx.eventSource.removeListener(event,update));}}
 renderNavigation();renderHistory();
}
function unmount(){
 historyGeneration++;controller?.abort();controller=null;observer?.disconnect();observer=null;
 subscriptions.splice(0).forEach(fn=>fn());roots.splice(0).forEach(el=>el.remove());
 for(const el of document.querySelectorAll('.cg-native-panel'))el.classList.remove('cg-native-panel');
 document.body.classList.remove('cg-active','cg-collapsed','cg-nav-open','cg-panel-open','cg-identities','cg-group');
 if($('#sheld'))$('#sheld').inert=false;
 delete document.body.dataset.cgMode;for(const key of ['--cg-accent','--cg-on-accent','--cg-sidebar-width'])document.body.style.removeProperty(key);
}
export function disable(){unmount();}
export function enable(){mount();}
await (window.__TAURITAVERN__?.ready ?? window.__TAURITAVERN_MAIN_READY__);
const ctx=context();ctx.eventSource.on(ctx.eventTypes.APP_READY,mount);
// Extension enable hooks cover an already ready page; initial load waits for the host.
