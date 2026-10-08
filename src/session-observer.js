/* Read-only session observer. Native browser controls handle UI transitions.
   Synthetic button events were not reliable across the game's revive screens. */
(() => {
  window.__snakeSessionRecovery?.stop();
  const R=window.__snakeReader;
  const state={running:true,actions:[],status:'watching',lastState:null,since:performance.now()};
  window.__snakeSessionRecovery=state;
  state.stop=()=>{state.running=false;cancelAnimationFrame(state.frame);};
  function tick(t) {
    if(!state.running)return;state.frame=requestAnimationFrame(tick);
    const core=R.u(window.__snakeRuntime.core+12);
    if(core!==state.lastState){state.lastState=core;state.since=t;}
    state.stateAge=(t-state.since)/1000;
    state.status=location.hash.includes('goog_fullscreen')?'awaiting-native-ad-close':
      core===0?'playing':core===6?'awaiting-native-decline':core===4?'awaiting-native-next':
      core===2?'awaiting-native-play':core===1001?'awaiting-native-join-recovery':'waiting-for-game';
  }
  state.frame=requestAnimationFrame(tick);
  return 'Native UI session observer installed';
})();
