import {watchMessageRows} from './message-rows.js';
import {formatDuration,generationDuration} from './message-state.js';

// Display native generation time without writing any message metadata.
export function mountActivity(context) {
 const ctx=context(),chat=document.querySelector('#chat'),stop=document.querySelector('#mes_stop');
 const row=document.createElement('div');row.className='cg-activity';row.hidden=true;
 row.setAttribute('role','status');row.setAttribute('aria-live','polite');
 const label=document.createElement('span');label.className='cg-activity-label';row.append(label);
 document.querySelector('#form_sheld').prepend(row);
 let ignored=false,started=null,timer=null;
 const listeners=[],labels=new Map();
 const write=(element,text)=>{if(element.textContent!==text)element.textContent=text;};
 function remove(mes){const item=labels.get(mes);if(!item)return;item.label.remove();item.details?.classList.remove('cg-work-duration','cg-thinking');labels.delete(mes);}
 function sync(rows){
  const running=!ignored&&Boolean(stop?.getClientRects().length);
  const c=context(),elapsed=started!==null?Date.now()-started:null;
  if(!running&&timer){clearInterval(timer);timer=null;}
  if(running&&!timer)timer=setInterval(()=>watcher.schedule(),1000);
  let runningInMessage=false;
  for(const mes of rows){
   const id=Number(mes.getAttribute('mesid')),message=c.chat[id];
   if(!message||message.is_user||message.is_system){remove(mes);continue;}
   const isCurrent=running&&id===c.chat.length-1;
   const details=mes.querySelector('.mes_reasoning_details'),hasReasoning=Boolean(message.extra?.reasoning||details?.dataset.hasContent==='true'||details?.dataset.state==='hidden'||details?.dataset.state==='thinking');
   const target=hasReasoning?details?.querySelector('.mes_reasoning_header'):null;
   const duration=isCurrent?elapsed:generationDuration(message);
   let item=labels.get(mes);
   if(item&&(item.target!==target||!mes.contains(item.label))){remove(mes);item=null;}
   if(!target&&(isCurrent||duration===null)){remove(mes);continue;}
   if(!item){
    const text=document.createElement('span');text.className=target?'cg-work-label':'cg-work-summary';
    if(target){target.prepend(text);details.classList.add('cg-work-duration');}else mes.querySelector('.mes_text')?.before(text);
    item={label:text,target,details:target?details:null};labels.set(mes,item);
   }
   const formatted=formatDuration(duration);write(item.label,`${isCurrent?'Working':'Worked'}${formatted===null?'':` for ${formatted}`}`);
   item.details?.classList.toggle('cg-thinking',isCurrent);
   if(isCurrent&&target&&details.getClientRects().length)runningInMessage=true;
  }
  const hide=!running||runningInMessage;
  if(row.hidden!==hide)row.hidden=hide;
  if(!row.hidden)write(label,`Working${elapsed===null?'':` for ${formatDuration(elapsed)}`}`);
 }
 const watcher=watchMessageRows(chat,{
  attributes:['data-state','data-duration','data-reasoning-state','data-has-content','mesid','is_user','is_system'],
  structure:'.mes,.mes_block,.mes_reasoning_details,.mes_reasoning_summary,.mes_reasoning_header_block,.mes_reasoning_header',sync,remove,
 });
 function on(name,fn){const event=ctx.eventTypes[name];if(event){ctx.eventSource.on(event,fn);listeners.push(()=>ctx.eventSource.removeListener(event,fn));}}
 on('GENERATION_STARTED',(type,options={},dryRun=false)=>{ignored=dryRun||type==='quiet'||type==='impersonate';started=ignored?null:Date.now();watcher.schedule();});
 const end=()=>{ignored=true;started=null;clearInterval(timer);timer=null;row.hidden=true;watcher.schedule();};
 on('GENERATION_ENDED',end);on('GENERATION_STOPPED',end);on('CHAT_CHANGED',()=>{end();watcher.refresh();});
 for(const name of ['STREAM_REASONING_DONE','CHARACTER_MESSAGE_RENDERED','MESSAGE_SWIPED','MESSAGE_UPDATED','MESSAGE_DELETED'])on(name,watcher.updateMessage);
 const observer=new MutationObserver(watcher.schedule);
 if(stop)observer.observe(stop,{attributes:true,attributeFilter:['style','class']});
 return ()=>{observer.disconnect();watcher.disconnect();clearInterval(timer);listeners.forEach(fn=>fn());for(const mes of labels.keys())remove(mes);row.remove();};
}
