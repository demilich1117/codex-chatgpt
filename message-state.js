export function formatDuration(milliseconds) {
 if(!Number.isFinite(milliseconds)||milliseconds<0)return null;
 const seconds=Math.floor(milliseconds/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;
 return [hours?`${hours}h`:null,hours||minutes?`${minutes}m`:null,`${rest}s`].filter(Boolean).join(' ');
}
export function generationDuration(message) {
 if(message?.gen_started==null||message?.gen_finished==null)return null;
 const duration=new Date(message.gen_finished).getTime()-new Date(message.gen_started).getTime();
 return Number.isFinite(duration)&&duration>=0?duration:null;
}
export function canRegenerate(chat,index) {
 if(!Array.isArray(chat))return false;
 const message=chat[index];
 return Number.isInteger(index)&&index===chat.length-1&&Boolean(message)&&!message.is_user&&!message.is_system&&!message.extra?.tool_invocations?.length;
}
