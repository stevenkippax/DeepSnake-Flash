from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js')
s=p.read_text()
pos=s.index('  function tick(t) {')
beam='''  function beamPlan(x,y,heading,speed,yaw,obs,radius,goal) {
    const horizon=2.4,dt=.06,chunk=.30;
    const local=obs.filter(o=>o.head?Math.hypot(o.x-x,o.y-y)<(speed+Math.hypot(o.vx,o.vy))*horizon+o.radius+2:bodyGap(o,x,y)<speed*horizon+2);
    const initial=clearance(x,y,0,local,radius),floor=Math.min(-.35,initial-.25);
    let root={x,y,angle:heading,t:0,minimum:initial,risk:0,first:null,sequence:[]};
    // Committed input is shared by every candidate. Future decisions cannot undo it.
    while(root.t<state.inputDelay-1e-6) {
      const step=Math.min(dt,state.inputDelay-root.t),t=root.t+step;
      const delta=wrap(delayedCommand(t-1e-7,heading,heading)-root.angle);
      root.angle+=Math.max(-yaw*step,Math.min(yaw*step,delta));
      root.x+=Math.cos(root.angle)*speed*step;root.y+=Math.sin(root.angle)*speed*step;root.t=t;
      const d=clearance(root.x,root.y,t,local,radius);root.minimum=Math.min(root.minimum,d);root.risk+=Math.max(0,1.4-d)*step;
    }
    const admissibleFloor=Math.min(floor,root.minimum-.05);
    let beam=[root];
    while(beam.length && beam[0].t<horizon-1e-6) {
      const generated=[];
      for(const parent of beam) {
        const goalAngle=goal?Math.atan2(goal.y-parent.y,goal.x-parent.x):heading;
        const commands=[...[-2.4,-1.2,-.6,0,.6,1.2,2.4].map(d=>boundedTurn(parent.angle+d,parent.angle)),boundedTurn(goalAngle,parent.angle)];
        if(parent.first===null && previousAngle!==null)commands.push(boundedTurn(previousAngle,parent.angle));
        for(const command of commands) {
          const next={...parent,first:parent.first??command,sequence:[...parent.sequence,{t:parent.t,angle:command}]};
          const until=Math.min(horizon,parent.t+chunk);let rejected=false;
          while(next.t<until-1e-6) {
            const step=Math.min(dt,until-next.t),t=next.t+step,delta=wrap(command-next.angle);
            next.angle+=Math.max(-yaw*step,Math.min(yaw*step,delta));
            next.x+=Math.cos(next.angle)*speed*step;next.y+=Math.sin(next.angle)*speed*step;next.t=t;
            const d=clearance(next.x,next.y,t,local,radius);next.minimum=Math.min(next.minimum,d);next.endClear=d;
            next.risk+=Math.max(0,1.4-d)*step*Math.exp(-t*.4);
            if(d<admissibleFloor){rejected=true;break;}
          }
          if(rejected)continue;
          const distance=goal?Math.hypot(goal.x-next.x,goal.y-next.y):0;
          // Safety precedes progress. Continuity applies to the command sent now.
          next.value=Math.min(2,next.minimum)*60+Math.min(3,next.endClear)*8-next.risk*12-distance*2-Math.abs(wrap(next.first-(previousAngle??heading)))*2;
          generated.push(next);
        }
      }
      generated.sort((a,b)=>b.value-a.value);
      const cells=new Set();beam=[];
      for(const next of generated) {
        const key=Math.round(next.x/.65)+','+Math.round(next.y/.65)+','+Math.round(wrap(next.angle)/.5);
        if(cells.has(key))continue;cells.add(key);beam.push(next);if(beam.length>=24)break;
      }
    }
    const best=beam[0];
    return best?{angle:best.first,minimum:best.minimum,hit:horizon,risk:best.risk,goalDistance:goal?Math.hypot(goal.x-best.x,goal.y-best.y):0,px:best.x,py:best.y,beam:true,sequence:best.sequence}:null;
  }
'''
s=s[:pos]+beam+s[pos:]
needle='    previousAngle = best.angle;'
s=s.replace(needle,'''    if(!hunt && (best.escaping || best.hit<2.35 || best.minimum<.1)) {
      const beamStarted=performance.now(),curved=beamPlan(x,y,heading,speed,yaw,obs,radius,waypoint);
      state.beamComputeMs=performance.now()-beamStarted;
      if(curved && (best.escaping || best.hit<2.35 || curved.minimum>=best.minimum)) {
        best=curved;state.beamFrames=(state.beamFrames??0)+1;
      }
    }
'''+needle)
s=s.replace('inputDelay: state.inputDelay, boosting:', 'beam:!!best.beam,beamComputeMs:state.beamComputeMs, inputDelay: state.inputDelay, boosting:')
p.write_text(s)
t=Path('work/snake-game/check-controller-mpc.cjs');a=t.read_text().replace('state,route,clearance,','state,beamPlan,route,clearance,');t.write_text(a)
