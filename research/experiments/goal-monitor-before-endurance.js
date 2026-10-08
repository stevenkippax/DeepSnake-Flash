/* Reads the actual score and session state; preserves steering after reaching the target. */
(() => {
  const old=window.__snakeGoalMonitor;
  old?.stop?.();
  if(old)old.running=false;
  const R=window.__snakeReader,M=unityInstance.Module;
  const state={running:true,target:50000,status:'watching',receipt:old?.receipt};
  window.__snakeGoalMonitor=state;
  state.stop=()=>{state.running=false;cancelAnimationFrame(state.frame);};
  function tick(t) {
    if(!state.running)return;
    state.frame=requestAnimationFrame(tick);
    const core=R.u(window.__snakeRuntime.core+12),player=R.u(window.__snakeRuntime.registry+12);
    if(core!==0||!player)return;
    const score=R.u(player+64);
    state.best=Math.max(state.best??0,score);
    if(score<state.target||state.receipt)return;
    state.receipt={target:state.target,score,bonus:R.u(player+76),corePlaying:core===0,
      inputSending:!!M.HEAPU8[R.u(player+216)+30],reportedDying:!!M.HEAPU8[player+69],
      time:new Date().toISOString(),t,elapsed:window.__snakeWorldController?.last?.elapsed,
      normalPlayActions:window.__snakeSessionRecovery?.actions.filter(a=>a.name==='normal-play').length};
    state.stop();state.status='target-observed';
  }
  state.frame=requestAnimationFrame(tick);
  return 'Score goal monitor installed';
})();
