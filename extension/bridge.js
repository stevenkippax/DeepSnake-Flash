/* Extension transport. All execution is local to the selected Snake.io tab. */
(() => {
  const runtimeFiles=['runtime/runtime-reader.js','runtime/navigation.js','runtime/controller.js','runtime/session-observer.js','runtime/endurance-recorder.js'];
  function snapshot() {
    const ready=typeof unityInstance!=='undefined'&&!!unityInstance?.Module?.HEAPU32;
    const pilot=window.__snakeWorldController,reader=window.__snakeReader,run=window.__snakeGoalMonitor;
    const core=reader&&window.__snakeRuntime?reader.u(window.__snakeRuntime.core+12):null;
    return {ready,running:!!pilot?.running,status:pilot?.status??'idle',core,score:pilot?.score??0,best:Math.max(pilot?.best??0,run?.best??0),mode:pilot?.mode??null,elapsed:pilot?.last?.elapsed??0,milestones:run?.milestones??[],ended:run?.ended??null};
  }
  function stopInPage() {
    window.__snakeWorldController?.stop?.();window.__snakeWorldPilot?.stop?.();
    window.__snakeGoalMonitor?.stop?.();window.__snakeSessionRecovery?.stop?.();
    return {running:false};
  }
  function allowed(url) {
    try {const parsed=new URL(url);return parsed.protocol==='https:'&&['snake.io','www.snake.io'].includes(parsed.hostname);}catch{return false;}
  }
  async function currentTab() {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!allowed(tab.url))throw new Error('Open snake.io in the active tab first.');
    return tab;
  }
  async function assertTab(tabId) {
    const tab=await chrome.tabs.get(tabId);
    if(!allowed(tab.url))throw new Error('Open snake.io in the active tab first.');
  }
  async function execute(tabId,func) {
    await assertTab(tabId);
    const [result]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func});
    if(!result||result.error)throw new Error(result?.error??'The game did not return a status.');
    return result.result;
  }
  async function read(tabId) {return execute(tabId,snapshot);}
  async function start(tabId) {
    const before=await read(tabId);
    if(before.running)return before;
    if(!before.ready)throw new Error('Let the game finish loading, then press Start again.');
    await assertTab(tabId);
    const results=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:runtimeFiles});
    const failed=results.find(row=>row.error);if(failed)throw new Error(failed.error);
    const after=await read(tabId);if(!after.running)throw new Error('The controller could not start. The game build may have changed.');
    return after;
  }
  async function stop(tabId) {await execute(tabId,stopInPage);return read(tabId);}
  window.DeepSnakeBridge={allowed,currentTab,read,start,stop,runtimeFiles};
})();
