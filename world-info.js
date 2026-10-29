// Organize existing world-info controls without copying their data or save logic.
export function mountWorldInfo() {
 const panel=document.querySelector('#WorldInfo'),popup=panel?.querySelector('#world_popup'),list=popup?.querySelector('#world_popup_entries_list'),global=panel?.querySelector('#wiTopBlock'),selector=popup?.querySelector('#world_editor_select');
 if(!list||!global||!selector)return ()=>{};
 const controller=new AbortController(),signal=controller.signal,moves=[],created=[],classes=[],attributes=[],entries=new Map();
 let disposed=false,frame=0,active=null,book=selector.value,fingerprint='',fullList=false,listScroll=0;
 const followedNavigation=new WeakSet();
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 const addClass=(el,cls)=>{if(el){el.classList.add(cls);classes.push([el,cls]);}};
 function move(el,parent,records=moves){if(!el)return;const anchor=document.createComment('cg-world-position');el.before(anchor);records.push({el,anchor});parent.append(el);}
 function button(text,fn,cls='cg-world-button'){const el=node('button',cls,text);el.type='button';el.addEventListener('click',fn,{signal});return el;}
 function menu(parent,label,items,records=moves,owned=created){
  const details=node('details','cg-world-menu'),summary=node('summary','',label),body=node('div','cg-world-menu-body');details.append(summary,body);parent.append(details);owned.push(details);
  for(const [el,text]of items){if(!el)continue;move(el,body,records);const caption=node('span','cg-world-action-label',text);el.append(caption);owned.push(caption);for(const name of ['role','tabindex'])attributes.push([el,name,el.getAttribute(name)]);el.setAttribute('role','button');el.tabIndex=0;el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();el.click();}},{signal});}
  body.addEventListener('click',()=>{details.open=false;},{signal});return details;
 }
 addClass(panel,'cg-world');addClass(popup,'cg-world-library-panel');
 const tabs=node('nav','cg-world-tabs');tabs.setAttribute('aria-label','世界书页面');
 function showTab(which){
  panel.classList.toggle('cg-world-global',which==='global');
  editTab.setAttribute('aria-pressed',String(which==='entries'));globalTab.setAttribute('aria-pressed',String(which==='global'));
  if(which==='global'){const toggle=global.querySelector('.inline-drawer-toggle');if(toggle?.querySelector('.down'))toggle.click();}
 }
 const editTab=button('条目编辑',()=>showTab('entries')),globalTab=button('全局设置',()=>showTab('global'));tabs.append(editTab,globalTab);
 panel.querySelector('.cg-panel-header')?.after(tabs);created.push(tabs);
 move(panel.querySelector('#WI_panel_pin_div'),tabs);
 const library=selector.parentElement,tools=popup.querySelector('#world_info_search')?.parentElement;
 addClass(library,'cg-world-library');addClass(tools,'cg-world-tools');
 const caption=node('label','cg-world-caption','编辑世界书');caption.htmlFor='world_editor_select';library.prepend(caption);created.push(caption);
 menu(library,'书籍操作',[
  ['world_import_button','导入世界书'],['world_popup_export','导出世界书'],['world_popup_name_button','重命名'],['world_duplicate','复制世界书'],['world_popup_delete','删除世界书…']
 ].map(([id,text])=>[popup.querySelector('#'+id),text]));
 const newEntry=popup.querySelector('#world_popup_new');if(newEntry){const text=node('span','cg-world-action-label','新建条目');newEntry.append(text);created.push(text);}
 if(tools)menu(tools,'更多',[
  ['OpenAllWIEntries','展开全部条目'],['CloseAllWIEntries','折叠全部条目'],['world_backfill_memos','用关键词补全标题'],['world_apply_current_sorting','按当前排序更新优先级…'],['world_refresh','刷新']
 ].map(([id,text])=>[popup.querySelector('#'+id),text]));
 const workspace=node('div','cg-world-workspace'),outline=node('nav','cg-world-outline'),detailBar=node('div','cg-world-detailbar');
 outline.setAttribute('aria-label','当前页世界书条目');
 const count=node('span','cg-world-count'),back=button('‹ 条目列表',()=>{panel.classList.remove('cg-world-detail');panel.scrollTop=listScroll;outline.querySelector('[aria-current="true"]')?.focus({preventScroll:true});});
 const mode=button('完整列表',()=>setMode(!fullList));mode.title='完整列表保留原生展开、折叠和拖动排序';
 detailBar.append(back,count,mode);list.before(detailBar,workspace);move(list,workspace);workspace.prepend(outline);created.push(detailBar,workspace);
 function setMode(value){fullList=value;panel.classList.toggle('cg-world-full-list',value);mode.textContent=value?'专注编辑':'完整列表';mode.setAttribute('aria-pressed',String(value));schedule();}
 for(const id of ['OpenAllWIEntries','CloseAllWIEntries'])popup.querySelector('#'+id)?.addEventListener('click',()=>setMode(true),{signal,capture:true});
 const empty=node('p','cg-world-empty');workspace.append(empty);created.push(empty);
 function enhance(entry){
  let record=entries.get(entry);if(!record){
   record={moves:[],created:[]};entries.set(entry,record);
   const header=entry.querySelector('.inline-drawer-header');
   if(header)menu(header,'更多',[
    [entry.querySelector('.move_entry_button'),'移动或复制到其他书…'],[entry.querySelector('.duplicate_entry_button'),'复制条目'],[entry.querySelector('.delete_entry_button'),'删除条目…']
   ],record.moves,record.created);
  }
  const editor=entry.querySelector('.world_entry_edit');
  if(editor&&!record.editor){
   record.editor=editor;
   const advanced=node('details','cg-wi-advanced'),summary=node('summary','','触发与插入设置'),body=node('div','cg-wi-advanced-body');advanced.append(summary,body);editor.append(advanced);record.created.push(advanced);
   const section=(title,element)=>{if(!element)return;const label=node('h4','cg-wi-section-title',title);body.append(label);record.created.push(label);move(element,body,record.moves);};
   section('插入位置与优先级',entry.querySelector('.WIEnteryHeaderControls'));
   section('匹配规则',editor.querySelector('[name="perEntryOverridesBlock"]'));
   const recursion=editor.querySelector('[name="excludeRecursion"]')?.closest('label')?.parentElement?.parentElement;
   if(recursion?.querySelector('[name="ignoreBudget"]'))section('递归与预算',recursion);
   const groups=[...editor.children].find(el=>el.querySelector('[name="groupWeight"]'));
   const filters=[...editor.children].find(el=>el.querySelector('[name="characterFilter"]'));
   section('分组与时效',groups);section('角色与生成筛选',filters);
   move(editor.querySelector(':scope > .inline-drawer'),body,record.moves);
  }
 }
 function select(entry,fromClick=false){
  active=entry.getAttribute('uid');if(fromClick){listScroll=panel.scrollTop;panel.classList.add('cg-world-detail');if(panel.classList.contains('cg-world-narrow'))panel.scrollTop+=detailBar.getBoundingClientRect().top-panel.getBoundingClientRect().top-70;}
  for(const item of list.querySelectorAll(':scope > .world_entry'))item.classList.toggle('cg-wi-selected',item===entry);
  if(!fullList){const toggle=entry.querySelector('.inline-drawer-header > .world_entry_thin_controls > .inline-drawer-toggle');if(toggle?.classList.contains('down'))toggle.click();}
  schedule();
 }
 function sync(){
  frame=0;if(disposed)return;
  if(selector.value!==book){book=selector.value;active=null;fingerprint='';panel.classList.remove('cg-world-detail');}
  const current=[...list.querySelectorAll(':scope > .world_entry')];
  if(current.some(entry=>!entries.has(entry)))fingerprint='';
  for(const [entry]of entries)if(!list.contains(entry))entries.delete(entry);
  current.forEach(enhance);
  const navigated=current.find(entry=>entry.classList.contains('flash')&&!followedNavigation.has(entry));
  if(navigated){followedNavigation.add(navigated);active=navigated.getAttribute('uid');panel.classList.add('cg-world-detail');}
  let selected=current.find(e=>e.getAttribute('uid')===active);
  if(!selected&&current.length){selected=current[0];active=selected.getAttribute('uid');}
  if(selected&&!fullList)selectWithoutSchedule(selected);
  const items=current.map(entry=>({entry,uid:entry.getAttribute('uid'),title:entry.querySelector('[name="comment"]')?.value||entry.querySelector('[name="comment"]')?.getAttribute('placeholder')||'未命名条目',disabled:entry.classList.contains('disabledWIEntry'),state:entry.querySelector('[name="entryStateSelector"]')?.value}));
  const key=JSON.stringify(items.map(({uid,title,disabled,state})=>[uid,title,disabled,state]));
  if(key!==fingerprint){
   fingerprint=key;outline.replaceChildren();
   for(const item of items){
    const row=button('',()=>select(item.entry,true),'cg-world-entry');row.dataset.uid=item.uid;row.title=item.title;
    row.append(node('span','cg-world-entry-title',item.title),node('small','cg-world-entry-meta',`${item.disabled?'已停用':item.state==='constant'?'常驻':item.state==='vectorized'?'向量匹配':'关键词匹配'} · #${item.uid}`));outline.append(row);
   }
  }
  for(const row of outline.children)row.setAttribute('aria-current',String(row.dataset.uid===active));
  const countText=`本页 ${current.length} 条`;if(count.textContent!==countText)count.textContent=countText;
  empty.hidden=current.length>0;const emptyText=selector.value?'没有匹配的条目，可清空搜索或新建条目。':'选择一本世界书开始编辑，或创建一本新的世界书。';if(empty.textContent!==emptyText)empty.textContent=emptyText;
  detailBar.hidden=!selector.value;workspace.classList.toggle('cg-world-no-entries',!current.length);
 }
 function selectWithoutSchedule(entry){
  for(const item of list.querySelectorAll(':scope > .world_entry'))item.classList.toggle('cg-wi-selected',item===entry);
  if(!panel.classList.contains('cg-world-narrow')||panel.classList.contains('cg-world-detail')){
   const toggle=entry.querySelector('.inline-drawer-header > .world_entry_thin_controls > .inline-drawer-toggle');if(toggle?.classList.contains('down'))toggle.click();
  }
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(sync);}
 popup.addEventListener('input',schedule,{signal});popup.addEventListener('change',schedule,{signal});popup.addEventListener('click',schedule,{signal});
 document.addEventListener('pointerdown',event=>{for(const el of panel.querySelectorAll('.cg-world-menu[open]'))if(!el.contains(event.target))el.open=false;},{signal});
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=panel.querySelector('.cg-world-menu[open]');if(open){event.preventDefault();event.stopImmediatePropagation();open.open=false;open.querySelector('summary').focus();}}},{signal});
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.target.matches?.('.world_entry,[name="comment"]')))schedule();});
 observer.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['class','placeholder']});
 const size=new ResizeObserver(()=>{const narrow=panel.getBoundingClientRect().width<660;panel.classList.toggle('cg-world-narrow',narrow);schedule();});size.observe(panel);
 showTab('entries');sync();
 return ()=>{
  disposed=true;cancelAnimationFrame(frame);observer.disconnect();size.disconnect();controller.abort();
  for(const [entry,record]of entries){for(const {el,anchor}of record.moves)if(anchor.parentNode)anchor.replaceWith(el);record.created.forEach(el=>el.remove());entry.classList.remove('cg-wi-selected');}
  for(const {el,anchor}of moves)if(anchor.parentNode)anchor.replaceWith(el);
  created.forEach(el=>el.remove());classes.forEach(([el,cls])=>el.classList.remove(cls));
  for(const [el,name,value]of attributes)if(value===null)el.removeAttribute(name);else el.setAttribute(name,value);
  panel.classList.remove('cg-world-global','cg-world-narrow','cg-world-detail','cg-world-full-list');
 };
}
