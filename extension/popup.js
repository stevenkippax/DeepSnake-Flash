(() => {
  const bridge=window.DeepSnakeBridge,$=id=>document.getElementById(id);
  let tabId=null,data=null,busy=false;
  function render(state) {
    data=state;$('score').textContent=state.score.toLocaleString();$('best').textContent=state.best.toLocaleString();
    $('mode').textContent=(state.mode??'awaiting game').replaceAll('-',' ');
    $('status').textContent=state.running?(state.status==='playing'?'Autopilot active':'Armed · close panel to give the game focus'):'Autopilot stopped';
    $('status-dot').className=state.running?'active':'';$('start').disabled=busy||state.running;$('stop').disabled=busy||!state.running;$('export').disabled=!state.best;
    if(state.running)$('help').textContent='Close this panel to give the game focus. If you are at the menu, choose normal Play. It keeps steering beyond 50,000.';
  }
  function error(err) {$('status').textContent=err.message;$('status-dot').className='error';$('start').disabled=busy||!tabId;$('stop').disabled=busy||!data?.running;}
  async function refresh() {if(busy||!tabId)return;try{render(await bridge.read(tabId));}catch(err){error(err);}}
  async function action(name) {if(busy||!tabId)return;busy=true;$('start').disabled=true;$('stop').disabled=true;let failure=null;try{render(await bridge[name](tabId));}catch(err){failure=err;}finally{busy=false;if(failure)error(failure);else if(data)render(data);}}
  $('start').addEventListener('click',()=>action('start'));$('stop').addEventListener('click',()=>action('stop'));
  $('export').addEventListener('click',()=>{if(!data)return;const blob=new Blob([JSON.stringify({app:'DeepSnake Flash',version:'1.0.0',capturedAt:new Date().toISOString(),...data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='deepsnake-flash-run.json';a.click();URL.revokeObjectURL(url);});
  (async()=>{try{tabId=(await bridge.currentTab()).id;await refresh();}catch(err){error(err);}})();
  setInterval(refresh,1500);
})();
