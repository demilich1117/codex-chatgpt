import {icon} from './icons.js';
import {assertIdle,clickNative} from './host.js';
import {canRegenerate} from './message-state.js';

// Move original toolbars intact, preserving native handlers and relative children.
export function mountMessageControls(context) {
 const chat=document.querySelector('#chat');if(!chat)return ()=>{};
 const controller=new AbortController(),records=new Map(),ctx=context(),listeners=[];
 let frame=0,disposed=false;
 function sync(){
  frame=0;if(disposed)return;
  for(const [mes,record]of records)if(!chat.contains(mes)){record.footer.remove();records.delete(mes);}
  const data=context().chat;
  for(const mes of chat.querySelectorAll(':scope > .mes')){
   const block=mes.querySelector('.mes_block');if(!block)continue;
   let record=records.get(mes);
   if(record&&!block.contains(record.footer)){records.delete(mes);record=null;}
   if(!record){
    const footer=document.createElement('div');footer.className='cg-message-actions';const moved=[];
    for(const element of block.querySelectorAll('.ch_name > .mes_buttons,.ch_name > .mes_edit_buttons')){
     const anchor=document.createComment('cg-toolbar-position');element.before(anchor);moved.push({element,anchor});footer.append(element);
    }
    if(!moved.length)continue;
    block.append(footer);record={footer,moved};records.set(mes,record);
   }
   const index=Number(mes.getAttribute('mesid')),available=canRegenerate(data,index);
   const toolbar=record.footer.querySelector('.mes_buttons');
   if(available&&toolbar&&!record.regenerate){
    const button=document.createElement('button');button.type='button';button.className='mes_button cg-regenerate';button.title='重新生成';button.setAttribute('aria-label','重新生成');button.append(icon('retry'));toolbar.append(button);record.regenerate=button;
    button.addEventListener('click',event=>{
     event.preventDefault();event.stopPropagation();
     try{
      assertIdle();const current=context();
      if(!mes.isConnected||!canRegenerate(current.chat,Number(mes.getAttribute('mesid'))))throw Error('只能重新生成当前对话的最后一条角色回复。');
      if(current.onlineStatus==='no_connection')throw Error('请先连接生成模型。');
      clickNative('#option_regenerate');
     }catch(error){window.toastr?.info(error.message);}
    },{signal:controller.signal});
   }
   if(!available&&record.regenerate){record.regenerate.remove();record.regenerate=null;}
  }
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(sync);}
 const observer=new MutationObserver(schedule);observer.observe(chat,{childList:true,subtree:true,attributes:true,attributeFilter:['mesid','is_user','is_system']});
 for(const name of ['CHAT_CHANGED','MESSAGE_RECEIVED','CHARACTER_MESSAGE_RENDERED','USER_MESSAGE_RENDERED','MESSAGE_DELETED','MESSAGE_SWIPED','GENERATION_ENDED']){
  const event=ctx.eventTypes[name];if(event){ctx.eventSource.on(event, schedule);listeners.push(()=>ctx.eventSource.removeListener(event,schedule));}
 }
 sync();
 return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controller.abort();listeners.forEach(fn=>fn());for(const {footer,moved,regenerate}of records.values()){regenerate?.remove();for(const {element,anchor}of moved){if(anchor.parentNode)anchor.replaceWith(element);}footer.remove();}records.clear();};
}
