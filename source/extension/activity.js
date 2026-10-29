import {formatDuration,generationDuration} from './message-state.js';

// Display native generation time without writing any message metadata.
export function mountActivity(context) {
 const ctx=context(),chat=document.querySelector('#chat'),stop=document.querySelector('#mes_stop');
 const row=document.createElement('div');row.className='cg-activity';row.hidden=true;
 row.setAttribute('role','status');row.setAttribute('aria-live','polite');
 const label=document.createElement('span');label.className='cg-activity-label';row.append(label);
 document.querySelector('#form_sheld').prepend(row);
 let ignored=false,frame=null,disposed=false,started=null,timer=null;
 const listeners=[],labels=new Map();
 const write=(element,text)=>{if(element.textContent!==text)element.textContent=text;};
 function clear(){for(const [mes,item]of labels){item.label.remove();item.details?.classList.remove('cg-work-duration','cg-thinking');labels.delete(mes);}}
 function sync(){
  frame=null;if(disposed)return;
  const running=!ignored&&Boolean(stop?.getClientRects().length);
  const c=context(),elapsed=started!==null?Date.now()-started:null;
  if(!running&&timer){clearInterval(timer);timer=null;}
  if(running&&!timer)timer=setInterval(schedule,1000);
  let runningInMessage=false;
  for(const [mes,item]of labels)if(!chat.contains(mes)){item.label.remove();labels.delete(mes);}
  for(const mes of chat.querySelectorAll(':scope > .mes')){
   const id=Number(mes.getAttribute('mesid')),message=c.chat[id];
   if(!message||message.is_user||message.is_system){const old=labels.get(mes);if(old){old.label.remove();old.details?.classList.remove('cg-work-duration','cg-thinking');labels.delete(mes);}continue;}
   const isCurrent=running&&id===c.chat.length-1;
   const details=mes.querySelector('.mes_reasoning_details'),hasReasoning=Boolean(message.extra?.reasoning||details?.dataset.hasContent==='true'||details?.dataset.state==='hidden'||details?.dataset.state==='thinking');
   const target=hasReasoning?details?.querySelector('.mes_reasoning_header'):null;
   const duration=isCurrent?elapsed:generationDuration(message);
   let item=labels.get(mes);
   if(item&&(item.target!==target||!mes.contains(item.label))){item.label.remove();item.details?.classList.remove('cg-work-duration','cg-thinking');labels.delete(mes);item=null;}
   if(!target&&(isCurrent||duration===null)){if(item){item.label.remove();labels.delete(mes);}continue;}
   if(!item){
    const text=document.createElement('span');text.className=target?'cg-work-label':'cg-work-summary';
    if(target){target.prepend(text);details.classList.add('cg-work-duration');}else mes.querySelector('.mes_text')?.before(text);
    item={label:text,target,details:target?details:null};labels.set(mes,item);
   }
   const formatted=formatDuration(duration);write(item.label,`${isCurrent?'Working':'Worked'}${formatted===null?'':` for ${formatted}`}`);
   item.details?.classList.toggle('cg-thinking',isCurrent);
   if(isCurrent&&target&&details.getClientRects().length)runningInMessage=true;
  }
  row.hidden=!running||runningInMessage;
  if(!row.hidden)write(label,`Working${elapsed===null?'':` for ${formatDuration(elapsed)}`}`);
 }
 function schedule(){if(!disposed&&frame===null)frame=requestAnimationFrame(sync);}
 function on(name,fn){const event=ctx.eventTypes[name];if(event){ctx.eventSource.on(event,fn);listeners.push(()=>ctx.eventSource.removeListener(event,fn));}}
 on('GENERATION_STARTED',(type,options={},dryRun=false)=>{ignored=dryRun||type==='quiet'||type==='impersonate';started=ignored?null:Date.now();schedule();});
 const end=()=>{ignored=true;started=null;clearInterval(timer);timer=null;row.hidden=true;schedule();};
 on('GENERATION_ENDED',end);on('GENERATION_STOPPED',end);on('CHAT_CHANGED',()=>{clear();end();});
 for(const name of ['STREAM_REASONING_DONE','CHARACTER_MESSAGE_RENDERED','MESSAGE_SWIPED','MESSAGE_UPDATED','MESSAGE_DELETED'])on(name,schedule);
 const observer=new MutationObserver(schedule);
 observer.observe(chat,{subtree:true,childList:true,attributes:true,attributeFilter:['data-state','data-reasoning-state','data-duration','data-has-content','mesid','is_user','is_system']});
 if(stop)observer.observe(stop,{attributes:true,attributeFilter:['style','class']});
 sync();
 return ()=>{disposed=true;observer.disconnect();if(frame!==null)cancelAnimationFrame(frame);clearInterval(timer);listeners.forEach(fn=>fn());clear();row.remove();};
}
