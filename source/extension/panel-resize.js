// One edge handle follows the active native drawer. Its content stays native.
export function mountPanelResize({panels,getWidth,setWidth,save}) {
  const controller=new AbortController(),signal=controller.signal;
  const grip=document.createElement('div');grip.className='cg-panel-resize';grip.hidden=true;grip.tabIndex=0;
  grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');
  grip.setAttribute('aria-label','抽屉宽度');grip.title='拖动调整宽度（480–1100px），双击恢复默认；方向键微调';
  document.body.append(grip);
  let active,dragging=false,right=0,frame=0;
  // --cg-nav-space may be a calc(). Actual panel geometry is the final limit.
  function limits(){
    const nav=document.querySelector('.cg-sidebar'),rail=document.querySelector('.cg-rail');
    const navRight=document.body.classList.contains('cg-collapsed')?(rail?.getBoundingClientRect().right||0):(nav?.getBoundingClientRect().right||0);
    return {min:480,max:Math.min(1100,Math.max(480,innerWidth-navRight-24))};
  }
  function update(){
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      active=panels.find(panel=>panel.classList.contains('openDrawer')&&panel.getClientRects().length);
      grip.hidden=!active||innerWidth<=1000;
      if(grip.hidden){if(dragging)finish();return;}
      const rect=active.getBoundingClientRect(),range=limits();
      grip.style.left=(rect.left-6)+'px';grip.style.top=(rect.top+14)+'px';grip.style.height=Math.max(0,rect.height-28)+'px';
      grip.setAttribute('aria-valuemin',String(range.min));grip.setAttribute('aria-valuemax',String(range.max));grip.setAttribute('aria-valuenow',String(Math.round(rect.width)));grip.setAttribute('aria-valuetext',Math.round(rect.width)+' 像素');
    });
  }
  function finish(){if(!dragging)return;dragging=false;document.body.classList.remove('cg-panel-resizing');save();}
  grip.addEventListener('pointerdown',event=>{
    if(event.button!==0||!active)return;
    event.preventDefault();event.stopPropagation();right=active.getBoundingClientRect().right;dragging=true;
    document.body.classList.add('cg-panel-resizing');grip.setPointerCapture(event.pointerId);grip.focus();
  },{signal});
  // Native drawers close on html mousedown/touchstart; this is their own edge.
  for(const event of ['mousedown','touchstart'])grip.addEventListener(event,e=>e.stopPropagation(),{signal});
  grip.addEventListener('pointermove',event=>{if(!dragging)return;const range=limits();setWidth(Math.max(range.min,Math.min(range.max,right-event.clientX)));update();},{signal});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])grip.addEventListener(event,finish,{signal});
  grip.addEventListener('dblclick',()=>{setWidth(760);save();update();},{signal});
  grip.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();const range=limits();
    const width=active?.getBoundingClientRect().width||getWidth();
    setWidth(event.key==='Home'?range.min:event.key==='End'?range.max:Math.max(range.min,Math.min(range.max,width+(event.key==='ArrowLeft'?20:-20))));save();update();
  },{signal});
  window.addEventListener('resize',update,{signal});
  const observer=new ResizeObserver(update);panels.forEach(panel=>observer.observe(panel));
  update();
  return {update,destroy(){finish();cancelAnimationFrame(frame);controller.abort();observer.disconnect();grip.remove();document.body.classList.remove('cg-panel-resizing');}};
}
