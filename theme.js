// Inspect the applied theme, never our manifest stylesheet (which is always loaded).
// The signature also recognizes existing 0.1.x themes and renamed copies.
export function isCodexTheme(css) {
 return typeof css==='string'
  && /\/\*\s*Codex\s*\/\s*ChatGPT\s+\d+\.\d+/i.test(css)
  && /body\.cg-active\s*\{/.test(css)
  && /--cg-surface-page\s*:/.test(css);
}

const selector='#custom-style, #tts-preview-style';
export function currentThemeMatches(doc=document) {
 const usable=style=>style&&!style.disabled&&!style.sheet?.disabled&&(!style.media||matchMedia(style.media).matches);
 // Workbench previews temporarily replace native CSS; another work must not
 // inherit this companion UI from the saved Codex theme underneath it.
 const preview=doc.getElementById('tts-preview-style');
 if(usable(preview)&&preview.textContent.trim())return isCodexTheme(preview.textContent);
 const native=doc.getElementById('custom-style');
 return Boolean(usable(native)&&isCodexTheme(native.textContent));
}

export function watchTheme(onChange) {
 const relevant=node=>Boolean(node?.matches?.(selector)||node?.parentElement?.matches(selector)||node?.querySelector?.(selector));
 const observer=new MutationObserver(records=>{
  if(records.some(record=>relevant(record.target)||[...record.addedNodes,...record.removedNodes].some(relevant)))onChange();
 });
 // Both hosts replace #custom-style contents when selecting/editing themes.
 // Watching the head also covers replacement/removal and workbench previews.
 observer.observe(document.head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['media','disabled']});
 return ()=>observer.disconnect();
}
