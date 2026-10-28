// Presentation only. Native generation/stop state and reasoning remain authoritative.
export function mountActivity(context) {
 const ctx=context(),chat=document.querySelector('#chat'),stop=document.querySelector('#mes_stop');
 const row=document.createElement('div');row.className='cg-activity';row.hidden=true;
 row.setAttribute('role','status');row.setAttribute('aria-live','polite');row.setAttribute('aria-atomic','true');
 const label=document.createElement('span');label.className='cg-activity-label';label.textContent='Working';row.append(label);
 document.querySelector('#form_sheld').prepend(row);
 let ignored=false,frame=null,current=null,thinkingLabel=null,disposed=false;
 const listeners=[];
 function clearThinking(){current?.classList.remove('cg-thinking');thinkingLabel?.remove();thinkingLabel=null;current=null;}
 function sync(){
  frame=null;if(disposed)return;
  const running=!ignored&&Boolean(stop?.getClientRects().length);
  const c=context(),message=c.chat.at(-1),id=c.chat.length-1;
  const details=running&&message&&!message.is_user&&!message.is_system?chat.querySelector(`.mes[mesid="${id}"] .mes_reasoning_details[data-state="thinking"]`):null;
  const visible=Boolean(details?.getClientRects().length);
  if(current!==(visible?details:null)){clearThinking();if(visible){current=details;thinkingLabel=document.createElement('span');thinkingLabel.className='cg-thinking-label';thinkingLabel.textContent='Thinking';details.querySelector('.mes_reasoning_header')?.prepend(thinkingLabel);details.classList.add('cg-thinking');}}
  const hidden=!running||visible;if(row.hidden!==hidden)row.hidden=hidden;
 }
 function schedule(){if(!disposed&&frame===null)frame=requestAnimationFrame(sync);}
 function on(name,fn){const event=ctx.eventTypes[name];if(event){ctx.eventSource.on(event,fn);listeners.push(()=>ctx.eventSource.removeListener(event,fn));}}
 on('GENERATION_STARTED',(type,options={},dryRun=false)=>{ignored=dryRun||type==='quiet'||type==='impersonate';schedule();});
 const end=()=>{ignored=true;clearThinking();row.hidden=true;};
 on('GENERATION_ENDED',end);on('GENERATION_STOPPED',end);on('CHAT_CHANGED',end);
 on('STREAM_REASONING_DONE',schedule);on('CHARACTER_MESSAGE_RENDERED',schedule);
 const observer=new MutationObserver(schedule);
 observer.observe(chat,{subtree:true,childList:true,attributes:true,attributeFilter:['data-state','data-reasoning-state']});
 if(stop)observer.observe(stop,{attributes:true,attributeFilter:['style','class']});
 sync();
 return ()=>{disposed=true;observer.disconnect();if(frame!==null)cancelAnimationFrame(frame);listeners.forEach(fn=>fn());clearThinking();row.remove();};
}
