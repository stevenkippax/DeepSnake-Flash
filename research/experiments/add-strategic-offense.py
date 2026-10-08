from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js')
s=p.read_text()
s=s.replace("'journal','journalAt'", "'journal','journalAt','rivalMemory','deathHints','strategyEvents','strategyCounters'")
s=s.replace("const visited=new Map();let visitRefresh=0;", "const visited=new Map();let visitRefresh=0;\n  let strategic=null,strategyRefresh=0;const rivalMemory=new Map(oldController?.rivalMemory??[]);let deathHints=oldController?.deathHints??[];")
anchor='  function predatorRisk(x,y,obs) {'
insert='''  // A persistent map objective sits above local steering. Disappearance is only
  // a search hint; observed rich food is required to call it a death harvest.
  function observeRivals(obs,foods,t) {
    const present=new Set(obs.filter(o=>o.head).map(o=>o.enemy));
    for(const [enemy,old] of rivalMemory)if(!present.has(enemy)) {
      if(t-old.seen<2500 && old.score>=500) {
        deathHints.push({enemy,score:old.score,points:old.points,until:t+18000});
        state.strategyCounters??={};state.strategyCounters.rivalDisappearances=(state.strategyCounters.rivalDisappearances??0)+1;
      }
      rivalMemory.delete(enemy);
    }
    for(const head of obs)if(head.head) {
      const body=obs.filter(o=>!o.head&&o.enemy===head.enemy);
      const stride=Math.max(1,Math.ceil(body.length/24));
      rivalMemory.set(head.enemy,{score:head.score,seen:t,points:[{x:head.x,y:head.y},...body.filter((o,i)=>i%stride===0).map(o=>({x:o.x,y:o.y}))]});
    }
    deathHints=deathHints.filter(h=>h.until>t&&!present.has(h.enemy));
    state.rivalMemory=[...rivalMemory];state.deathHints=deathHints;
  }
  function pickHarvest(x,y,heading,foods,obs,nav,speed,t) {
    if(!nav||nav.confined)return null;
    const start=topology.nearest(nav.current,x,y),room=nav.current.labels[start];
    const clusters=new Map();
    for(const item of foods) {
      if(item.scale<=.07)continue;
      const i=topology.index(item.x,item.y);if(i<0||nav.current.labels[i]!==room)continue;
      const k=Math.floor(item.x/8)+','+Math.floor(item.y/8);
      const c=clusters.get(k)??{items:[],x:0,y:0};c.items.push(item);c.x+=item.x;c.y+=item.y;clusters.set(k,c);
    }
    let best=null;
    for(const [key,c] of clusters) {
      if(c.items.length<3)continue;
      c.x/=c.items.length;c.y/=c.items.length;
      const linked=deathHints.some(h=>h.points.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<8));
      const distance=Math.hypot(c.x-x,c.y-y);
      const recent=visited.get(Math.floor(c.x/6)+','+Math.floor(c.y/6));
      const revisit=recent!==undefined&&state.now-recent<12&&!linked?.65:1;
      const value=c.items.length*8*(linked?1.8:1)*revisit/(2+distance/speed);
      const sticky=strategic?.kind==='harvest'&&strategic.key===key&&t<strategic.until?1.35:1;
      if(best&&value*sticky<=best.value)continue;
      const ranked=c.items.slice().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
      for(const item of ranked.slice(0,5)) {
        const goal=topology.index(item.x,item.y);
        const route=topology.routeTo(nav.current,start,i=>i===goal,(i,when)=>{
          const p=topology.position(i);return obs.filter(o=>o.head).every(o=>topology.headClearance(o,p.x,p.y,when)>=.3);
        },speed,state.inputDelay+.15);
        if(!route.length||topology.dangerAt(item.x,item.y,obs).length)continue;
        best={kind:'harvest',key,goal:item,path:route,value:value*sticky,rich:c.items.length,confirmedDeath:linked,until:t+12000};break;
      }
    }
    return best;
  }
  function pickPressure(x,y,heading,length,ownScore,obs,nav,speed,yaw,radius,t) {
    if(ownScore<800||length<35||nav?.confined)return null;
    let best=null;
    for(const head of obs) {
      if(!head.head||head.invincible||head.score<80||head.score>ownScore*.75||(head.length??0)>length*.8)continue;
      const distance=Math.hypot(head.x-x,head.y-y);if(distance<7||distance>35)continue;
      const at=headAt(head,1),a=Math.atan2(head.vy,head.vx);
      // Establish a flank ahead of the rival rather than coil at our own head.
      for(const side of [-1,1]) {
        const flank=Math.max(5,Math.min(9,length/(6*Math.PI)));
        const goal={x:at.x+Math.cos(a)*5-Math.sin(a)*flank*side,y:at.y+Math.sin(a)*5+Math.cos(a)*flank*side};
        if(Math.max(Math.abs(goal.x),Math.abs(goal.y))>arenaLimit-radius-3||topology?.dangerAt(goal.x,goal.y,obs).length)continue;
        const angle=Math.atan2(goal.y-y,goal.x-x),preview=route(x,y,heading,angle,speed,yaw,obs,radius,goal);
        if(preview.hit<2.35||preview.minimum<.6||endpointArea(preview)<Math.max(80,(nav?.largestAccessibleFutureArea??0)*.3))continue;
        const value=head.score/(4+Math.hypot(goal.x-x,goal.y-y))+Math.min(length/(head.length??1),5)*8-Math.abs(wrap(angle-heading))*8;
        if(!best||value>best.value)best={kind:'pressure',enemy:head.enemy,enemyScore:head.score,goal,value,until:t+1500};
      }
    }
    return best;
  }
'''
s=s.replace(anchor,insert+anchor)
s=s.replace("if(length<20 && o.score<500)continue;", "if(length<20 && o.score<500)continue;\n      // Size advantage changes strategy, never collision geometry.\n      if(state.score>=800 && o.score<state.score*.75 && length<(state.ownLength??0)*.8)continue;")
s=s.replace("const victims=obs.filter(o=>o.head && o.score>=50", "const victims=obs.filter(o=>o.head && o.score>=50 && o.score<(state.score??0)*.75")
s=s.replace("if(maximum<2) return null;", "if(maximum<6) return null;")
s=s.replace("Math.min(maximum,5),Math.min(maximum,3)","Math.min(maximum,6)")
s=s.replace("const fullObs = obstacles(player, x, y, radius,speed);", "state.ownLength=u(u(pre+180)+12)*f(pre+8)*scale;\n    const fullObs = obstacles(player, x, y, radius,speed);")
s=s.replace("const rescueOwners=new Set((navigation?.surrounding??[]).map(o=>o.enemy));", "const rescueOwners=new Set((navigation?.surrounding??[]).map(o=>o.enemy));\n    if(constrained&&!rescueOwners.size)for(const o of fullObs)if(o.head)rescueOwners.add(o.enemy);")
s=s.replace("const rescueOpportunity=urgent && !evacuating", "const rescueOpportunity=(urgent||constrained) && !evacuating")
s=s.replace("if (t - foodRefresh > 160) { cachedFood = food(); foodRefresh = t; }", "if (t - foodRefresh > 160) { cachedFood = food(); foodRefresh = t; observeRivals(fullObs,cachedFood,t); }")
s=s.replace("const bodyLength=u(u(pre+180)+12)*f(pre+8)*scale;", "const bodyLength=state.ownLength;\n    if(t-strategyRefresh>600) {\n      const harvest=!evacuating&&!constrained?pickHarvest(x,y,heading,cachedFood,fullObs,navigation,baseSpeed,t):null;\n      strategic=harvest??(!urgent&&!constrained?pickPressure(x,y,heading,bodyLength,state.score,obs,navigation,baseSpeed,yaw,radius,t):null);\n      strategyRefresh=t;state.strategy=strategic;\n      if(strategic){state.strategyCounters??={};state.strategyCounters[strategic.kind]=(state.strategyCounters[strategic.kind]??0)+1;}\n    }\n    if(strategic&&t<strategic.until&&!evacuating&&!constrained&&!urgent) {waypoint=strategic.path?.length?pathPoint(x,y,strategic.path):strategic.goal;path=strategic.path??[];}\n    else if(evacuating||urgent||constrained)strategic=null;")
s=s.replace("if(!evacuating && !urgent && !orbit && u(player+64)>=600", "if(!strategic && !evacuating && !urgent && !orbit && u(player+64)>=600")
s=s.replace("t-orbit.started>60000", "t-orbit.started>18000")
s=s.replace("orbit.sweep>14*Math.PI", "orbit.sweep>2.4*Math.PI")
s=s.replace("if(hunt && t>hunt.until)hunt=null;", "if(strategic?.kind==='harvest'){orbit=null;orbiting=false;}\n    if(hunt && t>hunt.until)hunt=null;")
s=s.replace("if(!evacuating && (!urgent || rescueOpportunity) && !orbiting", "if(!evacuating && (!urgent || rescueOpportunity) && !orbiting && !(strategic?.kind==='harvest'&&strategic.rich>=6)")
s=s.replace("const nextMode=evacuating?'escape-pocket':hunt?'intercept':orbiting?'cage-opponent'", "const nextMode=evacuating?'escape-pocket':hunt?'intercept':orbiting?'cage-opponent'")
s=s.replace("retreating?'space-retreat':exploring?'explore'", "retreating?'space-retreat':strategic?.kind==='harvest'?'harvest-drop':strategic?.kind==='pressure'?'pressure-rival':exploring?'explore'")
s=s.replace("nearestThreat: obs.reduce", "strategy:state.strategy, nearestThreat: obs.reduce")
p.write_text(s)
