import {KEY,DEFAULTS,PANELS,SIDEBAR_PREVIEW_LIMIT,normalize,foreground,currentIdentity,recentChats} from './model.js';
import {context,pastChats,openCharacter,openChat,openGroup,busy,clickNative,assertIdle,selectionToken,assertSelection,confirmDelete,removeEntry} from './host.js';
import {chatKey,setFlag,forgetEntry,renameEntry} from './sidebar-state.js';
import {icon} from './icons.js';
import {mountActivity} from './activity.js';
import {currentThemeMatches,watchTheme} from './theme.js';
import {mountPanelResize} from './panel-resize.js';
import {mountMessageControls} from './message-controls.js';
import {mountWorldInfo} from './world-info.js';

let settings, controller, observer, roots=[], subscriptions=[], modeQuery, mobileQuery;
let historyGeneration=0, sidebar, header, search, navBody, historyList, title, appearance, panelReturn=null;
const expandedLists=new Set();
let historyIdentity='', actionMenu=null, actionTrigger=null, deleting=false;
let lifecycle, settingsRoot, themeStatus, stopWatchingTheme, extensionEnabled=true;
let panelResize;
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
 body.style.setProperty('--cg-panel-width',`${settings.panelWidth}px`);
 body.classList.toggle('cg-collapsed',settings.sidebarCollapsed);
 body.classList.toggle('cg-identities',settings.showIdentity);
 panelResize?.update();
}
function setSidebar(open,focus=true){
 closeActions(false);
 if(mobileQuery.matches){document.body.classList.toggle('cg-nav-open',open);sidebar.inert=!open;$('#sheld').inert=open;}
 else {settings.sidebarCollapsed=!open;save();setAppearance();sidebar.inert=!open;}
 $('[data-cg-menu]')?.setAttribute('aria-expanded',String(open));
 if(open&&focus)(mobileQuery.matches?sidebar.querySelector('button'):search).focus();else if(!open&&focus)$('[data-cg-menu]')?.focus();
}
function closeNative(){
 for(const [id] of PANELS){const p=$(`#${id} > .drawer-content`);if(p?.classList.contains('openDrawer'))clickNative(`#${id} > .drawer-toggle`);}
}
function openPanel(id,trigger){
 const panel=$('#'+id+' > .drawer-content');
 if(!panel)throw new Error('原生面板在此宿主中不可用。');
 appearance.hidden=true;panelReturn=trigger||document.activeElement;
 // Test the requested drawer before closing others: a second click is a close.
 if(panel.classList.contains('openDrawer')){closePanel();return;}
 closeNative();
 if(mobileQuery.matches)setSidebar(false,false);
 clickNative(`#${id} > .drawer-toggle`);
 requestAnimationFrame(()=>panel.querySelector('.cg-panel-header button')?.focus());
}
function returnFocus(){if(mobileQuery.matches&&sidebar.contains(panelReturn))setSidebar(true,false);if(panelReturn?.getClientRects().length&&!panelReturn.closest('[hidden]'))panelReturn.focus();else $('[data-cg-menu]')?.focus();}
function closePanel(){closeNative();document.body.classList.remove('cg-panel-open');returnFocus();}
function closeAppearance(){appearance.hidden=true;returnFocus();}
function navigate(fn){
 if(deleting)throw new Error('正在处理删除，请稍候。');
 closeActions(false);
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
 panelResize=mountPanelResize({panels:PANELS.map(([id])=>$(`#${id} > .drawer-content`)).filter(Boolean),getWidth:()=>settings.panelWidth,setWidth:value=>{settings.panelWidth=normalize({panelWidth:value}).panelWidth;setAppearance();},save});
 subscriptions.push(()=>{panelResize?.destroy();panelResize=null;});
 observer=new MutationObserver(()=>{
  const open=PANELS.some(([id])=>$(`#${id} > .drawer-content`)?.classList.contains('openDrawer'));
  document.body.classList.toggle('cg-panel-open',open);
  for(const b of document.querySelectorAll('[data-cg-panel]'))b.setAttribute('aria-expanded',String($(`#${b.dataset.cgPanel} > .drawer-content`)?.classList.contains('openDrawer')||false));
  panelResize?.update();
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
function panelButton(label,glyph,id,cls='cg-button'){
 const b=button(label,glyph,e=>openPanel(id,e.currentTarget),cls);
 // ST closes drawers on html mousedown/touchstart before click. These proxies
 // are drawer controls too; contain only their press, preserving outside close.
 for(const event of ['mousedown','touchstart'])listen(b,event,e=>e.stopPropagation());
 b.dataset.cgPanel=id;b.setAttribute('aria-expanded',String($('#'+id+' > .drawer-content')?.classList.contains('openDrawer')||false));
 return b;
}
function section(key,label,count){
 const details=node('details','cg-nav-section');details.dataset.cgSection=key;
 details.open=Boolean(search.value.trim())||!settings.collapsedSections[key];
 const summary=node('summary','cg-section-label',label);
 if(count!=null)summary.append(node('span','cg-section-count',String(count)));
 details.append(summary);
 // Summary click runs before the native open state flips, including keyboard
 // activation. Save synchronously so a following search cannot swallow toggle.
 listen(summary,'click',event=>{
  if(event.defaultPrevented||search.value.trim())return;
  settings.collapsedSections[key]=details.open;save();
 });
 return details;
}
function appendLimited(parent,key,items,render){
 const limit=search.value.trim()?items.length:SIDEBAR_PREVIEW_LIMIT;
 items.slice(0,limit).forEach(item=>parent.append(render(item)));
 if(items.length<=limit)return;
 const extra=node('div','cg-section-extra');extra.id='cg-extra-'+key;extra.hidden=!expandedLists.has(key);
 items.slice(limit).forEach(item=>extra.append(render(item)));
 const more=button('',null,()=>{extra.hidden=!extra.hidden;if(extra.hidden)expandedLists.delete(key);else expandedLists.add(key);update();});
 more.classList.add('cg-section-more');more.dataset.cgMore=key;more.setAttribute('aria-controls',extra.id);
 function update(){const label=extra.hidden?'显示全部（'+items.length+'）':'收起更多';more.textContent=label;more.title=label;more.setAttribute('aria-label',label);more.setAttribute('aria-expanded',String(!extra.hidden));}
 update();parent.append(extra,more);
}
function closeActions(focus=true){
 const trigger=actionTrigger;actionMenu?.remove();actionMenu=null;actionTrigger=null;
 trigger?.setAttribute('aria-expanded','false');if(focus&&trigger?.isConnected)trigger.focus();
}
function focusEntry(key){
 const row=[...sidebar.querySelectorAll('[data-cg-entry]')].find(el=>el.dataset.cgEntry===key);
 const target=row?.getClientRects().length?row.querySelector('.cg-row-actions'):search;target?.focus();
}
function refreshEntries(){if(!controller)return;renderNavigation();return renderHistory();}
async function deleteFromSidebar(entry){
 if(deleting)return;
 assertIdle();const token=selectionToken(),signal=controller.signal;deleting=true;
 try{
  const options=await confirmDelete(entry);if(!options||signal.aborted)return;
  assertSelection(token);await removeEntry(entry,options,token);
  forgetEntry(settings,entry.key,entry.kind==='character'&&options.deleteChats);save();
 }finally{deleting=false;if(!signal.aborted){await refreshEntries();search.focus();}}
}
function showActions(entry,trigger){
 if(actionTrigger===trigger){closeActions();return;}
 closeActions(false);actionTrigger=trigger;trigger.setAttribute('aria-expanded','true');
 const menu=node('div','cg-actions-menu');actionMenu=menu;menu.id='cg-actions-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',entry.name+'的操作');
 const add=(label,glyph,fn,danger=false)=>{
  const b=button(label,glyph,async()=>{closeActions();await fn();});b.setAttribute('role','menuitem');if(danger)b.classList.add('cg-danger');menu.append(b);
 };
 if(mobileQuery.matches){
  const archived=settings.archived.includes(entry.key),pinned=settings.pinned.includes(entry.key);
  const toggle=async(field,value)=>{setFlag(settings,field,entry.key,value);save();await refreshEntries();focusEntry(entry.key);};
  if(!archived)add(pinned?'取消置顶':'置顶','pin',()=>toggle('pinned',!pinned));
  add(archived?'取消归档':'归档',archived?'restore':'archive',()=>toggle('archived',!archived));
 }
 if(entry.kind==='group')add('管理群聊','users',()=>navigate(async()=>{await entry.fn();openPanel('rightNavHolder',trigger);}));
 else add(entry.kind==='character'?'删除角色…':'删除聊天…','trash',()=>deleteFromSidebar(entry),true);
 sidebar.append(menu);
 const rect=trigger.getBoundingClientRect(),box=menu.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(rect.right-box.width,innerWidth-box.width-8))+'px';
 menu.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-box.height-8))+'px';
 menu.querySelector('button').focus();
 listen(menu,'keydown',event=>{
  const controls=[...menu.querySelectorAll('button')],index=controls.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();event.stopPropagation();controls[event.key==='Home'?0:event.key==='End'?controls.length-1:(index+(event.key==='ArrowDown'?1:controls.length-1))%controls.length].focus();
  }
  if(event.key==='Escape'||event.key==='Tab'){if(event.key==='Escape')event.preventDefault();event.stopPropagation();closeActions();}
 });
}
function entryRow(entry,selected=false){
 const row=node('div','cg-nav-row');row.dataset.cgEntry=entry.key;row.dataset.pinned=String(settings.pinned.includes(entry.key));row.classList.toggle('cg-selected',selected);
 const b=button(entry.name,entry.kind==='group'?'users':'chat',()=>navigate(entry.fn));b.setAttribute('aria-current',selected?'page':'false');
 row.append(b);
 const archived=settings.archived.includes(entry.key),pinned=settings.pinned.includes(entry.key);
 const quick=(label,glyph,field,value)=>{
  const control=button(label+'：'+entry.name,glyph,async()=>{closeActions(false);setFlag(settings,field,entry.key,value);save();await refreshEntries();focusEntry(entry.key);},'cg-icon');
  control.classList.add('cg-quick-action');control.dataset.cgAction=field;
  if(field==='pinned')control.setAttribute('aria-pressed',String(pinned));
  row.append(control);
 };
 if(!archived)quick(pinned?'取消置顶':'置顶','pin','pinned',!pinned);
 quick(archived?'取消归档':'归档',archived?'restore':'archive','archived',!archived);
 const more=button(entry.name+'的更多操作','more',e=>showActions(entry,e.currentTarget),'cg-icon');more.classList.add('cg-row-actions');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','cg-actions-menu');row.append(more);return row;
}
function renderNavigation(){
 closeActions(false);
 const ctx=context(),query=search.value.trim().toLocaleLowerCase(),active=currentIdentity(ctx);
 navBody.replaceChildren();
 const items=[...ctx.characters.map(c=>({key:'character:'+c.avatar,kind:'character',avatar:c.avatar,name:c.name,fn:()=>openCharacter(c.avatar),lastTime:c.date_last_chat||0})),...ctx.groups.map(g=>({key:'group:'+g.id,kind:'group',groupId:g.id,name:g.name,fn:()=>{const group=context().groups.find(item=>String(item.id)===String(g.id));if(!group)throw new Error('这个群聊已不存在。');return openGroup(group.id,group.chat_id);},lastTime:g.date_last_chat||0}))];
 const available=items.filter(i=>!settings.archived.includes(i.key));
 for(const [key,heading,itemsInGroup] of [['pinned','置顶',available.filter(i=>settings.pinned.includes(i.key))],['characters','角色与群聊',available.filter(i=>!settings.pinned.includes(i.key)).sort((a,b)=>b.lastTime-a.lastTime)],['archived','已归档角色与群聊',items.filter(i=>settings.archived.includes(i.key))]]){
  const list=itemsInGroup.filter(i=>i.name.toLocaleLowerCase().includes(query));if(!list.length)continue;
  const group=section(key,heading,list.length);
  if(key==='archived')group.append(node('p','cg-archive-note','角色和聊天文件均保留，可随时取消归档。'));
  appendLimited(group,key,list,item=>entryRow(item,item.key===active));navBody.append(group);
 }
 if(!navBody.children.length)navBody.append(node('p','cg-empty',query?'没有匹配的角色或群聊':'从角色管理选择或创建角色。'));
 document.body.classList.toggle('cg-group',ctx.groupId!=null);
 const name=ctx.groupId!=null?ctx.groups.find(g=>String(g.id)===String(ctx.groupId))?.name:ctx.characters[ctx.characterId]?.name;
 title.textContent=name||'新对话';title.title=ctx.chatId||'新对话';
}
async function renderHistory(){
 const generation=++historyGeneration,identity=currentIdentity(context());
 if(identity!==historyIdentity){for(const key of ['history','pinnedHistory','archivedHistory'])expandedLists.delete(key);historyIdentity=identity;}
 closeActions(false);
 const group=section('history','最近聊天');
 group.title='当前角色或群聊的最近聊天';historyList.replaceChildren(group);
 const loading=node('p','cg-empty','正在读取聊天列表…');group.append(loading);
 try{
  const chats=await pastChats();if(generation!==historyGeneration||identity!==currentIdentity(context())||!controller)return;
  const ctx=context(),query=search.value.trim().toLocaleLowerCase(),avatar=ctx.characters[ctx.characterId]?.avatar,groupId=ctx.groupId;
  const list=recentChats(chats,ctx.chatId).filter(c=>c.file_name.toLocaleLowerCase().includes(query)).map(chat=>{
   const name=chat.file_name.replace(/\.jsonl$/i,'');return {name,key:chatKey(identity,name),kind:'chat',avatar,groupId,fn:()=>{
    if(currentIdentity(context())!==identity)throw new Error('聊天所属角色已变化，请重新选择。');return openChat(name,groupId);
   }};
  });
  historyList.replaceChildren();
  for(const [key,label,items] of [
   ['pinnedHistory','置顶聊天',list.filter(i=>settings.pinned.includes(i.key)&&!settings.archived.includes(i.key))],
   ['history','最近聊天',list.filter(i=>!settings.pinned.includes(i.key)&&!settings.archived.includes(i.key))],
   ['archivedHistory','已归档聊天',list.filter(i=>settings.archived.includes(i.key))]]){
   if(!items.length&&key!=='history')continue;
   const sectionNode=section(key,label,items.length);sectionNode.title='当前角色或群聊的聊天';
   appendLimited(sectionNode,key,items,entry=>entryRow(entry,entry.name===ctx.chatId));
   if(!items.length)sectionNode.append(node('p','cg-empty',query?'没有匹配的聊天':'暂无未置顶、未归档的聊天。'));
   historyList.append(sectionNode);
  }
 }catch(e){if(generation===historyGeneration&&controller){loading.remove();group.append(button('读取失败，点击重试','history',renderHistory));}console.warn(e);}
}
function mount(){
 if(controller)return;
 controller=new AbortController();modeQuery=matchMedia('(prefers-color-scheme: dark)');mobileQuery=matchMedia('(max-width: 1000px)');
 document.body.classList.add('cg-active');setAppearance();
 for(const file of ['sidebar.css','messages.css','world-info.css']){const styles=node('link');styles.rel='stylesheet';styles.href=new URL('./'+file,import.meta.url).href;document.head.append(styles);roots.push(styles);}
 const rail=node('nav','cg-rail');rail.setAttribute('aria-label','快捷导航');
 rail.append(button('展开或收起侧栏','panel',()=>setSidebar(settings.sidebarCollapsed),'cg-icon'),panelButton('角色与群聊','users','rightNavHolder','cg-icon'),button('历史聊天','history',()=>openNativeAction('#option_select_chat'),'cg-icon'),panelButton('扩展','grid','extensions-settings-button','cg-icon'),button('外观','settings',showAppearance,'cg-icon'));
 sidebar=node('aside','cg-sidebar');sidebar.id='cg-sidebar';sidebar.setAttribute('aria-label','侧栏');
 const top=node('div','cg-sidebar-heading');top.append(node('strong','cg-brand','Codex'),button('收起侧栏','panel',()=>setSidebar(false),'cg-icon'));sidebar.append(top);
 const searchLabel=node('label','cg-search');searchLabel.append(icon('search'));search=node('input');search.type='search';search.placeholder='搜索角色与当前聊天';search.setAttribute('aria-label','搜索角色与当前聊天');searchLabel.append(search);sidebar.append(searchLabel);
 const scroll=node('div','cg-sidebar-scroll');
 listen(scroll,'scroll',()=>closeActions(false));listen(window,'resize',()=>closeActions(false));
 listen(document,'pointerdown',event=>{if(actionMenu&&!actionMenu.contains(event.target)&&!actionTrigger?.contains(event.target))closeActions(false);});
 scroll.append(panelButton('角色与群聊','users','rightNavHolder'),button('管理当前聊天','history',()=>openNativeAction('#option_select_chat')));
 navBody=node('div');scroll.append(navBody);historyList=node('div','cg-history');scroll.append(historyList);
 const functions=section('functions','酒馆功能');functions.classList.add('cg-functions');
 for(const [id,label,glyph]of PANELS)functions.append(panelButton(label,glyph,id));scroll.append(functions);sidebar.append(scroll);
 const footer=node('div','cg-sidebar-footer');footer.append(button('新对话','compose',()=>navigate(()=>openNativeAction('#option_start_new_chat')),'cg-new-chat'),button('外观','settings',showAppearance,'cg-icon'));sidebar.append(footer);
 const grip=node('div','cg-resize');grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');grip.setAttribute('aria-label','侧栏宽度');
 listen(grip,'pointerdown',e=>{grip.setPointerCapture(e.pointerId);});listen(grip,'pointermove',e=>{if(grip.hasPointerCapture(e.pointerId)){settings.sidebarWidth=normalize({sidebarWidth:e.clientX-48}).sidebarWidth;setAppearance();}});listen(grip,'pointerup',save);listen(grip,'keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();settings.sidebarWidth=normalize({sidebarWidth:settings.sidebarWidth+(e.key==='ArrowRight'?10:-10)}).sidebarWidth;setAppearance();save();}});sidebar.append(grip);
 header=node('header','cg-header');const menu=button('打开侧栏','menu',()=>setSidebar(!document.body.classList.contains('cg-nav-open')),'cg-icon');menu.dataset.cgMenu='';menu.setAttribute('aria-controls','cg-sidebar');menu.setAttribute('aria-expanded','false');title=node('strong','cg-chat-title','新对话');header.append(menu,title,button('会话操作','more',()=>clickNative('#options_button'),'cg-icon'));
 const shade=button('关闭侧栏',null,()=>setSidebar(false),'cg-dismiss');shade.tabIndex=-1;
 document.body.append(rail,sidebar,header,shade);roots.push(rail,sidebar,header,shade);
 buildPanels();buildAppearance();subscriptions.push(mountMessageControls(context),mountActivity(context),mountWorldInfo());
 listen(search,'input',()=>{renderNavigation();renderHistory();});listen(modeQuery,'change',setAppearance);
 const resize=()=>{document.body.classList.remove('cg-nav-open');$('#sheld').inert=false;sidebar.inert=mobileQuery.matches||settings.sidebarCollapsed;$('.cg-brand').textContent=mobileQuery.matches?'ChatGPT':'Codex';};listen(mobileQuery,'change',resize);resize();
 listen(document,'keydown',e=>{
  // A native popup owns its Escape/Tab; do not also close the drawer beneath it.
  if(e.target.closest?.('dialog,.select2-container')||document.querySelector('dialog[open],.select2-container--open'))return;
  if(e.key==='Escape'){if(actionMenu){closeActions();return;}if(!appearance.hidden)closeAppearance();else if(document.body.classList.contains('cg-panel-open'))closePanel();else if(document.body.classList.contains('cg-nav-open'))setSidebar(false);}
  if(e.key==='Tab'){
   const surface=!appearance.hidden?appearance:mobileQuery.matches&&document.body.classList.contains('cg-nav-open')?sidebar:null;
   if(!surface)return;const controls=[...surface.querySelectorAll('button,input,select,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled);
   const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 });
 const ctx=context(),update=()=>{renderNavigation();renderHistory();};
 const on=(key,fn)=>{const event=ctx.eventTypes[key];if(event){ctx.eventSource.on(event,fn);subscriptions.push(()=>ctx.eventSource.removeListener(event,fn));}};
 on('CHAT_RENAMED',data=>{const owner=data.groupId!=null?'group:'+data.groupId:'character:'+data.avatarId;renameEntry(settings,chatKey(owner,data.oldFileName),chatKey(owner,data.newFileName));save();update();});
 on('CHARACTER_RENAMED',(oldAvatar,newAvatar)=>{renameEntry(settings,'character:'+oldAvatar,'character:'+newAvatar);save();update();});
 for(const key of ['CHAT_CHANGED','CHARACTER_EDITED','CHARACTER_DELETED','GROUP_UPDATED','CHAT_DELETED','GROUP_CHAT_DELETED']){const event=ctx.eventTypes[key];if(event){ctx.eventSource.on(event,update);subscriptions.push(()=>ctx.eventSource.removeListener(event,update));}}
 renderNavigation();renderHistory();
}
function unmount(){
 if(!controller)return;
 closeActions(false);historyGeneration++;historyIdentity='';expandedLists.clear();controller?.abort();controller=null;observer?.disconnect();observer=null;
 subscriptions.splice(0).forEach(fn=>fn());roots.splice(0).forEach(el=>el.remove());
 for(const el of document.querySelectorAll('.cg-native-panel'))el.classList.remove('cg-native-panel');
 document.body.classList.remove('cg-active','cg-collapsed','cg-nav-open','cg-panel-open','cg-identities','cg-group');
 if($('#sheld'))$('#sheld').inert=false;
 delete document.body.dataset.cgMode;for(const key of ['--cg-accent','--cg-on-accent','--cg-sidebar-width','--cg-panel-width'])document.body.style.removeProperty(key);
}
function syncTheme(){
 if(!lifecycle)return;
 const matches=currentThemeMatches();
 themeStatus.textContent=!settings.enabled?'界面已手动关闭。':matches?'已启用 Codex / ChatGPT 界面。':'当前不是 Codex / ChatGPT 美化，界面未启动；切回后自动启用。';
 if(settings.enabled&&matches)mount();else unmount();
}
function start(){
 if(lifecycle)return;
 settings=normalize(context().extensionSettings[KEY]);lifecycle=new AbortController();
 settingsRoot=node('div','cg-extension-controls');settingsRoot.append(node('h4','','Codex / ChatGPT'));
 const enabled=node('label','checkbox_label'),cb=node('input');cb.type='checkbox';cb.checked=settings.enabled;
 enabled.append(cb,node('span','','启用界面'));settingsRoot.append(enabled,node('p','','仅在使用 Codex / ChatGPT 美化时启动。'));
 themeStatus=node('p');themeStatus.setAttribute('role','status');settingsRoot.append(themeStatus);$('#extensions_settings2')?.append(settingsRoot);
 cb.addEventListener('change',()=>{settings.enabled=cb.checked;save();syncTheme();},{signal:lifecycle.signal});
 stopWatchingTheme=watchTheme(syncTheme);syncTheme();
}
export function disable(){
 extensionEnabled=false;stopWatchingTheme?.();stopWatchingTheme=null;lifecycle?.abort();lifecycle=null;
 settingsRoot?.remove();settingsRoot=null;unmount();
}
export function enable(){extensionEnabled=true;start();}
await (window.__TAURITAVERN__?.ready ?? window.__TAURITAVERN_MAIN_READY__);
const ctx=context();ctx.eventSource.on(ctx.eventTypes.APP_READY,()=>{if(extensionEnabled)start();});
// Extension enable hooks cover an already ready page; initial load waits for the host.
