// Chat filenames are only unique within their owner. JSON tuples avoid delimiter collisions.
export const chatKey = (owner, name) => `chat:${JSON.stringify([owner, name.replace(/\.jsonl$/i, '')])}`;
export function chatRef(key) {
  if (!key.startsWith('chat:')) return null;
  try { const value=JSON.parse(key.slice(5)); return Array.isArray(value)&&value.length===2&&value.every(v=>typeof v==='string')?value:null; } catch { return null; }
}
export function setFlag(settings, field, key, value) {
  settings[field]=settings[field].filter(item=>item!==key);
  if(value)settings[field].push(key);
  if(field==='archived'&&value)settings.pinned=settings.pinned.filter(item=>item!==key);
  if(field==='pinned'&&value)settings.archived=settings.archived.filter(item=>item!==key);
}
export function forgetEntry(settings, key, includeChats=false) {
  for(const field of ['pinned','archived'])settings[field]=settings[field].filter(item=>item!==key&&(!includeChats||chatRef(item)?.[0]!==key));
}
export function renameEntry(settings, oldKey, newKey) {
  for(const field of ['pinned','archived'])settings[field]=[...new Set(settings[field].map(key=>{
    if(key===oldKey)return newKey;
    const chat=chatRef(key);return chat?.[0]===oldKey?chatKey(newKey,chat[1]):key;
  }))];
}
