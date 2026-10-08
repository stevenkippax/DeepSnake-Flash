/* Normal UI recovery for the shipped snake.io client.
   Reads game state; uses mouse events on the already-observed Play, Next,
   and decline-revive buttons. Never changes game memory or network data. */
(() => {
  window.__snakeSessionRecovery?.stop();
  const R = window.__snakeReader;
  const state = { running: true, actions: [], status: 'watching', lastState: null, since: performance.now(), lastAction: 0 };
  window.__snakeSessionRecovery = state;
  let down = false, point = null;
  function mouse(kind, x, y, buttons) {
    const canvas = document.getElementById('unity-canvas');
    canvas.dispatchEvent(new MouseEvent(kind, {clientX:x,clientY:y,button:0,buttons,bubbles:true}));
  }
  function release() { if(down && point) mouse('mouseup',point.x,point.y,0); down=false; }
  state.stop = () => {state.running=false;cancelAnimationFrame(state.frame);release();};
  function press(name, fx, fy, now) {
    const canvas = document.getElementById('unity-canvas'), rect=canvas.getBoundingClientRect();
    point={x:rect.x+rect.width*fx,y:rect.y+rect.height*fy};
    canvas.focus(); mouse('mousemove',point.x,point.y,0);
    state.actions.push({name,t:now}); state.lastAction=now;
    setTimeout(()=>{if(!state.running)return;down=true;mouse('mousedown',point.x,point.y,1);setTimeout(release,90);},90);
  }
  function tick(t) {
    if(!state.running)return;
    state.frame=requestAnimationFrame(tick);
    if(window.__snakeWorldController?.goalObserved){state.status='target-observed';return;}
    const core=R.u(window.__snakeRuntime.core+12);
    if(core!==state.lastState){state.lastState=core;state.since=t;}
    if(location.hash.includes('goog_fullscreen')){state.status='waiting-for-ad';return;}
    if(!window.__snakeWorldController?.running){state.status='controller-stopped';return;}
    if(core===0){state.status='playing';return;}
    if(t-state.since<1800 || t-state.lastAction<2500 || down){state.status='waiting-for-ui';return;}
    // Coordinates are proportions of the observed Unity canvas at normal zoom.
    if(core===6){state.status='declining-revive';press('decline-revive',.755,.390,t);}
    else if(core===4){state.status='results-next';press('results-next',.500,.875,t);}
    else if(core===2){state.status='normal-play';press('normal-play',.610,.475,t);}
    else state.status='waiting-for-game';
  }
  state.frame=requestAnimationFrame(tick);
  return 'Normal session recovery installed';
})();
