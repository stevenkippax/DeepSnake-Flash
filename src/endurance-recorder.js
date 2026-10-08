/* Read-only endurance recorder. Score milestones never stop steering. */
(() => {
  const old=window.__snakeGoalMonitor;old?.stop?.();
  const R=window.__snakeReader,M=unityInstance.Module;
  const state={running:true,target:50000,status:'watching',receipt:old?.receipt,best:old?.best??0,milestones:old?.milestones??[],ended:old?.ended};
  window.__snakeGoalMonitor=state;
  state.stop=()=>{state.running=false;cancelAnimationFrame(state.frame);};
  function tick(t) {
    if(!state.running)return;state.frame=requestAnimationFrame(tick);
    const core=R.u(window.__snakeRuntime.core+12),player=R.u(window.__snakeRuntime.registry+12);
    if(core!==0||!player){
      if(state.lastPlaying&&(core===1||core===6)&&!state.ended)state.ended={score:state.lastPlaying.score,best:state.best,core,time:new Date().toISOString(),elapsed:state.lastPlaying.elapsed};
      if(state.ended)state.status='run-ended';return;
    }
    const score=R.u(player+64);state.best=Math.max(state.best,score);
    state.lastPlaying={score,elapsed:window.__snakeWorldController?.last?.elapsed};
    const milestone=Math.floor(score/10000)*10000;
    if(milestone>=50000&&!state.milestones.some(r=>r.target===milestone)){
      const record={target:milestone,score,corePlaying:true,inputSending:!!M.HEAPU8[R.u(player+216)+30],time:new Date().toISOString(),t,elapsed:state.lastPlaying.elapsed};
      state.milestones.push(record);if(!state.receipt)state.receipt=record;
    }
    state.status=state.receipt?'playing-beyond-target':'watching';
  }
  state.frame=requestAnimationFrame(tick);return 'Continuous endurance recorder installed';
})();
