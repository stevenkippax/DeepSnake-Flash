from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text()
s=s.replace('let hunt=null, navigation=null, navigationRefresh=0;', 'let hunt=null, navigation=null, navigationRefresh=0, exploration=null, explorationUntil=0, lastGainAt=0, progressScore=0, exploreUntil=0;\n  const visited=new Map();let visitRefresh=0;')
a='  function predictor(player)'
b='''  function pickExplore(x,y,heading,speed,yaw,obs,radius) {
    let best=null;
    for(let i=-8;i<=8;i++) {
      const angle=boundedTurn(heading+i*Math.PI/8,heading);
      const point={x:Math.max(-42,Math.min(42,x+Math.cos(angle)*14)),y:Math.max(-42,Math.min(42,y+Math.sin(angle)*14))};
      if(Math.hypot(point.x-x,point.y-y)<6)continue;
      const preview=route(x,y,heading,angle,speed,yaw,obs,radius,point);
      const area=endpointArea(preview),recent=visited.get(Math.floor(point.x/6)+','+Math.floor(point.y/6));
      const revisited=recent===undefined?0:Math.max(0,30-(state.now-recent));
      const value=preview.hit*1000000+(area>=80?100000:area*1000)+Math.min(4,preview.minimum)*30-revisited*10-Math.abs(wrap(angle-heading))*4;
      if(!best||value>best.value)best={...point,value,preview};
    }
    return best;
  }
'''+a
assert a in s;s=s.replace(a,b)
s=s.replace('navigationRefresh=0; commandHistory.length=0;', 'navigationRefresh=0; exploration=null;lastGainAt=0;progressScore=0;exploreUntil=0;visited.clear(); commandHistory.length=0;')
s=s.replace('const obs=fullObs.filter', '''const actualScore=u(player+64);
    if(!lastGainAt || actualScore>progressScore){lastGainAt=t;progressScore=actualScore;}
    if(t-visitRefresh>1000){visited.set(Math.floor(x/6)+','+Math.floor(y/6),state.now);visitRefresh=t;for(const [k,v] of visited)if(state.now-v>60)visited.delete(k);}
    if(t-lastGainAt>20000 && !orbit && !hunt){exploreUntil=t+5000;lastGainAt=t;state.stallRecoveries=(state.stallRecoveries??0)+1;}
    const obs=fullObs.filter''')
s=s.replace('let waypoint = target;', '''let waypoint = target;
    const exploring=t<exploreUntil || !target;
    if(exploring && !evacuating && !waitingForExit) {
      if(!exploration || t>explorationUntil || Math.hypot(exploration.x-x,exploration.y-y)<2) {
        exploration=pickExplore(x,y,heading,speed,yaw,obs,radius);explorationUntil=t+4000;
      }
      waypoint=exploration;path=[];
    } else exploration=null;''')
s=s.replace('heading + .10;', 'heading;')
s=s.replace("orbiting?'cage-opponent':safeBoost?'cruise-boost':'forage'", "orbiting?'cage-opponent':exploring?'explore':safeBoost?'cruise-boost':'forage'")
p.write_text(s)
p=Path('work/snake-game/check-controller-mpc.cjs');s=p.read_text().replace('pickIntercept,commandHistory','pickIntercept,pickExplore,visited,commandHistory');a="const food=d.findPath";b='''const exploring=d.pickExplore(0,0,0,5,10.472,[],.3);
assert(exploring.x>12 && Math.abs(exploring.y)<.01,'Open empty space should choose a fixed forward destination instead of repeated turning');
d.visited.set('2,0',1);
const away=d.pickExplore(0,0,0,5,10.472,[],.3);
assert(Math.abs(away.y)>3,'Exploration should avoid recently visited sectors');
d.visited.clear();
'''+a;assert a in s;s=s.replace(a,b);p.write_text(s)
