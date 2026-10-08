from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();a='  function pickExplore(';b='''  function predatorRisk(x,y,obs) {
    let risk=0;
    for(const o of obs)if(o.head && o.score>=Math.max(2000,(state.score??0)*2)) {
      risk+=Math.max(0,12-(Math.hypot(o.x-x,o.y-y)-o.radius));
    }
    return risk;
  }
'''+a;assert a in s;s=s.replace(a,b)
s=s.replace("const value=preview.hit*1000000+", "const value=preview.hit*1000000-predatorRisk(preview.px,preview.py,obs)*1000+")
s=s.replace('const actualScore=u(player+64);', 'const actualScore=u(player+64);state.score=actualScore;')
s=s.replace('cachedFood.filter(item=>(topology.regionAt', 'cachedFood.filter(item=>predatorRisk(item.x,item.y,obs)<1 && (topology.regionAt')
s=s.replace('const immediateClearance = clearance(x, y, 0, obs, radius);', 'const immediateClearance = clearance(x, y, 0, obs, radius);\n    const retreating=!evacuating && !waitingForExit && !hunt && !orbiting && predatorRisk(x,y,obs)>1;')
s=s.replace('desiredRoute.hit >= 2.35 && desiredRoute.minimum > .05 &&', 'desiredRoute.hit >= 2.35 && desiredRoute.minimum > .05 && (!retreating || predatorRisk(desiredRoute.px,desiredRoute.py,obs)<.5) &&')
s=s.replace('const score = r.hit * 1000000 + spaceValue +', 'const score = r.hit * 1000000 + spaceValue - (retreating?predatorRisk(r.px,r.py,obs)*1000:0) +')
s=s.replace("hunt?'intercept':orbiting?", "hunt?'intercept':retreating?'space-retreat':orbiting?")
s=s.replace('navigation:state.navigation,\n', 'navigation:state.navigation,predatorRisk:predatorRisk(x,y,obs),\n')
p.write_text(s)
p=Path('work/snake-game/check-controller-mpc.cjs');s=p.read_text().replace('predictHead,visited','predictHead,predatorRisk,visited');a='d.visited.clear();';b=a+'''\nd.state.score=500;
const retreats=d.pickExplore(0,0,Math.PI/2,5,10.472,[{x:0,y:20,radius:3,vx:0,vy:0,head:true,score:5000}],.3);
assert(Math.hypot(retreats.x,retreats.y-20)>18,'Exploration must prefer open space away from a much larger head');
''';assert a in s;s=s.replace(a,b,1);p.write_text(s)
