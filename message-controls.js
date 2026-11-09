import {watchMessageRows} from './message-rows.js';
import {icon} from './icons.js';
import {assertIdle,clickNative} from './host.js';
import {canRegenerate} from './message-state.js';

// Move original toolbars intact, preserving native handlers and relative children.
export function mountMessageControls(context) {
 const chat=document.querySelector('#chat');if(!chat)return ()=>{};
 const records=new Map(),ctx=context(),listeners=[];
 function restore(mes){
  const record=records.get(mes);if(!record)return;
  record.regenerate?.remove();
  for(const {element,anchor}of record.moved){if(anchor.parentNode)anchor.replaceWith(element);}
  record.footer.remove();records.delete(mes);
 }
 function sync(rows){
  const data=context().chat;
  for(const mes of rows){
   const block=mes.querySelector('.mes_block');if(!block)continue;
   let record=records.get(mes);
   if(record&&!block.contains(record.footer)){restore(mes);record=null;}
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
    });
   }
   if(!available&&record.regenerate){record.regenerate.remove();record.regenerate=null;}
  }
 }
 const watcher=watchMessageRows(chat,{attributes:['mesid','is_user','is_system'],structure:'.mes,.mes_block,.ch_name',sync,remove:restore});
 for(const name of ['CHAT_CHANGED','MESSAGE_RECEIVED','CHARACTER_MESSAGE_RENDERED','USER_MESSAGE_RENDERED','MESSAGE_DELETED','MESSAGE_SWIPED','GENERATION_ENDED']){
  const event=ctx.eventTypes[name];if(event){ctx.eventSource.on(event,watcher.updateMessage);listeners.push(()=>ctx.eventSource.removeListener(event,watcher.updateMessage));}
 }
 return ()=>{watcher.disconnect();listeners.forEach(fn=>fn());for(const mes of records.keys())restore(mes);};
}
