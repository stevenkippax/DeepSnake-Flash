from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js')
s=p.read_text()
Path('work/snake-game/controller-before-safety-shield.js').write_text(s)
needle='  function commitEvacuation('
insert='''  // Independent safety filter. The task planner proposes a move; this search
  // requires a continuation, using original obstacles even during an attack.
  // A full-horizon result is conditional on the model, not an invulnerability claim.
  function safetyPlan(x,y,heading,speed,yaw,obs,radius,proposed,goal,guide=null) {
    const horizon=6,dt=.1,chunk=.5;
    const local=obs.filter(o=>o.head?Math.hypot(o.x-x,o.y-y)<65:bodyGap(o,x,y)<speed*horizon+3);
    function safeClear(px,py,t) {
      let d=46-radius-Math.max(Math.abs(px),Math.abs(py));
      for(const o of local) {
        if(!o.head) {d=Math.min(d,bodyGap(o,px,py));continue;}
        // A rival can boost and change its input. For the next 650 ms use
        // every reachable position, rather than its currently requested turn.
        if(t<=.65)d=Math.min(d,Math.hypot(px-o.x,py-o.y)-o.radius-(o.maxSpeed??Math.max(10,Math.hypot(o.vx,o.vy)))*t);
        if(t>0)d=Math.min(d,(topology?.headClearance(o,px,py,t)??Math.hypot(px-o.x-o.vx*t,py-o.y-o.vy*t)-o.radius)-Math.min(3,t*.4));
        else d=Math.min(d,Math.hypot(px-o.x,py-o.y)-o.radius);
      }
      return d;
    }
    const initial=safeClear(x,y,0),floor=Math.min(0,initial-.05);
    let root={x,y,angle:heading,t:0,minimum:initial,first:null,sequence:[],goalDistance:goal?Math.hypot(goal.x-x,goal.y-y):0};
    function advance(parent,command,until,queued=false) {
      const next={...parent,sequence:parent.sequence,first:parent.first??command};
      while(next.t<until-1e-6) {
        const step=Math.min(dt,until-next.t),when=next.t+step;
        const desired=queued?delayedCommand(when-1e-7,heading,command):command;
        next.angle+=Math.max(-yaw*step,Math.min(yaw*step,wrap(desired-next.angle)));
        next.x+=Math.cos(next.angle)*speed*step;next.y+=Math.sin(next.angle)*speed*step;next.t=when;
        const d=safeClear(next.x,next.y,when);next.minimum=Math.min(next.minimum,d);
        if(goal)next.goalDistance=Math.min(next.goalDistance,Math.hypot(goal.x-next.x,goal.y-next.y));
        if(d<floor){next.failed=true;break;}
      }
      return next;
    }
    root=advance(root,heading,state.inputDelay,true);root.first=null;
    const queuedUnsafe=!!root.failed;delete root.failed;
    // If already committed to danger, still choose the longest survival route.
    // The filter never fabricates a safe option when every continuation fails.
    let beam=[root],survivors=[],fallback=null,expanded=0;
    while(beam.length && beam[0].t<horizon-1e-6) {
      const generated=[];
      for(const parent of beam) {
        const ref=guide?(guide.kind==='path'?pathPoint(parent.x,parent.y,guide.points):orbitPoint(parent.x,parent.y,guide)):goal;
        const toward=ref?Math.atan2(ref.y-parent.y,ref.x-parent.x):heading;
        const controls=parent.first===null?[proposed,heading,...Array.from({length:16},(_,i)=>boundedTurn(heading+(i-8)*Math.PI/8,heading))]:[parent.angle,parent.angle-1.2,parent.angle+1.2,parent.angle-2.4,parent.angle+2.4,toward];
        for(const command of controls) {
          const next=advance(parent,command,Math.min(horizon,parent.t+(parent.first===null?.25:chunk)));expanded++;
          next.sequence=[...parent.sequence,{t:parent.t,angle:command}];
          const wrapped=next.t>=horizon-1e-6 && !!topology?.wrapAt(next.x,next.y,obs).length;
          const danger=predatorRisk(next.x,next.y,local);
          const progress=ref?Math.hypot(ref.x-next.x,ref.y-next.y):next.goalDistance;
          next.value=(wrapped?-100000:0)-danger*150+Math.min(3,next.minimum)*15-progress*5-Math.abs(wrap(next.first-proposed))*2;
          if(next.failed) {
            if(!fallback||next.t>fallback.t+.05||Math.abs(next.t-fallback.t)<=.05&&next.minimum>fallback.minimum)fallback=next;
          } else generated.push(next);
        }
      }
      generated.sort((a,b)=>b.value-a.value);
      const cells=new Set(),firstCounts=new Map();beam=[];
      for(const next of generated) {
        const first=Math.round(wrap(next.first)/.4),key=Math.round(next.x)+','+Math.round(next.y)+','+Math.round(wrap(next.angle)/.7)+','+first;
        if(cells.has(key)||(firstCounts.get(first)??0)>=4)continue;
        cells.add(key);firstCounts.set(first,(firstCounts.get(first)??0)+1);beam.push(next);if(beam.length>=18)break;
      }
      if(beam[0]?.t>=horizon-1e-6)survivors=beam;
    }
    const nearProposed=survivors.filter(n=>Math.abs(wrap(n.first-proposed))<.12 && !topology?.wrapAt(n.x,n.y,obs).length);
    const chosen=nearProposed[0]??survivors[0]??fallback??root;
    return {angle:chosen.first??proposed,minimum:chosen.minimum,hit:chosen.t,px:chosen.x,py:chosen.y,risk:0,goalDistance:chosen.goalDistance,
      safeContinuation:!queuedUnsafe&&survivors.length>0,alternatives:new Set(survivors.map(n=>Math.round(wrap(n.first)/.4))).size,expanded,sequence:chosen.sequence,queuedUnsafe};
  }
'''
s=s.replace(needle,insert+needle)
s=s.replace('score:u(enemy+64),invincible:', 'score:u(enemy+64),maxSpeed:2*f(pre+24),invincible:')
needle='    previousAngle = best.angle;'
insert='''    if(!state.safetyLast || t-state.safetyLast>110 || immediateClearance<1) {
      const shieldStarted=performance.now();
      const filtered=safetyPlan(x,y,heading,actualSpeed,yaw,obs,radius,best.angle,escapeGuide?escapeGuide.points.at(-1):waypoint,guide);
      state.safety={...filtered,computeMs:performance.now()-shieldStarted};state.safetyLast=t;
      state.safetyOverrides=(state.safetyOverrides??0)+(Math.abs(wrap(filtered.angle-best.angle))>.12?1:0);
      state.safetyAngle=filtered.angle;
      if(!filtered.safeContinuation || Math.abs(wrap(filtered.angle-best.angle))>.12){hunt=null;orbit=null;orbiting=false;state.boostUntil=0;}
    }
    if(state.safety && (Math.abs(wrap(state.safetyAngle-best.angle))>.12 || !state.safety.safeContinuation))best={...best,angle:state.safetyAngle,shield:true};
'''
s=s.replace(needle,insert+needle)
s=s.replace('    const safeBoost=huntBoost || !hunt && canBoost && t<(state.boostUntil??0);','    const safeBoost=(huntBoost || !hunt && canBoost && t<(state.boostUntil??0)) && !best.shield && !!state.safety?.safeContinuation;')
s=s.replace('boost(false);\n      state.status', 'boost(false);state.safety=null;state.safetyLast=0;\n      state.status')
s=s.replace('beam:!!best.beam,beamComputeMs:', 'shield:!!best.shield,safety:state.safety,beam:!!best.beam,beamComputeMs:')
p.write_text(s)
