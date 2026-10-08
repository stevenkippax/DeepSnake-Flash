from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text()
s=s.replace("let strategic=null,strategyRefresh=0;", "let strategic=null,strategyRefresh=0,sweep=null,lastSweepAt=oldController?.lastSweepAt??0;")
anchor='  function pickDeathSearch(x,y,obs,nav,speed,t) {'
insert='''  function tightlyLooping(trace) {
    if(!trace?.length)return false;
    const end=trace.at(-1),rows=trace.filter(r=>r.timestamp>=end.timestamp-7);
    if(rows.length<25||end.timestamp-rows[0].timestamp<4)return false;
    let travel=0,turn=0;
    for(let i=1;i<rows.length;i++){travel+=Math.hypot(rows[i].x-rows[i-1].x,rows[i].y-rows[i-1].y);turn+=Math.abs(wrap(rows[i].heading-rows[i-1].heading));}
    return travel>18&&Math.hypot(end.x-rows[0].x,end.y-rows[0].y)<8&&turn>1.5*Math.PI;
  }
  function pickSweep(x,y,heading,obs,nav,speed,t) {
    if(!nav||nav.confined)return null;
    const start=topology.nearest(nav.current,x,y),room=nav.current.labels[start],candidates=[];
    for(const distance of [26,20,16])for(let i=-6;i<=6;i++) {
      const angle=heading+i*Math.PI/8,turn=Math.abs(wrap(angle-heading));if(turn>2.4)continue;
      const goal={x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance};
      if(Math.max(Math.abs(goal.x),Math.abs(goal.y))>arenaLimit-5)continue;
      const index=topology.index(goal.x,goal.y);
      if(index<0||nav.current.labels[index]!==room||nav.current.clear[index]<1||topology.dangerAt(goal.x,goal.y,obs).length)continue;
      const recent=visited.get(Math.floor(goal.x/6)+','+Math.floor(goal.y/6));
      const revisit=recent===undefined?0:Math.max(0,60-(state.now-recent));
      candidates.push({goal,index,value:distance*2-turn*7-revisit*.8+Math.min(5,nav.current.clear[index])*3});
    }
    candidates.sort((a,b)=>b.value-a.value);
    for(const candidate of candidates.slice(0,8)) {
      const path=topology.routeTo(nav.current,start,i=>i===candidate.index,(i,when)=>{const p=topology.position(i);return obs.filter(o=>o.head).every(o=>topology.headClearance(o,p.x,p.y,when)>=.3);},speed,state.inputDelay+.15);
      if(path.length)return {kind:'sweep-map',goal:candidate.goal,path,origin:{x,y},started:t,until:t+12000};
    }
    return null;
  }
'''
s=s.replace(anchor,insert+anchor)
old="""      const harvest=!evacuating&&!constrained?pickHarvest(x,y,heading,cachedFood,fullObs,navigation,baseSpeed,t):null;
      strategic=harvest??(!urgent&&!constrained?pickDeathSearch(x,y,fullObs,navigation,baseSpeed,t):null)??(!urgent&&!constrained?pickPressure(x,y,heading,bodyLength,state.score,obs,navigation,baseSpeed,yaw,radius,t):null);"""
new="""      const harvest=!evacuating&&!constrained?pickHarvest(x,y,heading,cachedFood,fullObs,navigation,baseSpeed,t):null;
      const looping=tightlyLooping(state.trace);state.tightLoopDetected=looping;
      if(sweep&&(t>sweep.until||Math.hypot(sweep.goal.x-x,sweep.goal.y-y)<3||urgent||constrained))sweep=null;
      if(!sweep&&!urgent&&!constrained&&state.score>=800&&(t-lastSweepAt>25000||looping)&&!(harvest?.rich>=8)) {
        sweep=pickSweep(x,y,heading,fullObs,navigation,baseSpeed,t);
        if(sweep){lastSweepAt=t;state.lastSweepAt=t;state.strategyCounters??={};state.strategyCounters.sweepsStarted=(state.strategyCounters.sweepsStarted??0)+1;}
      }
      if(sweep&&harvest?.rich>=10&&harvest.confirmedDeath)sweep=null;
      strategic=sweep??harvest??(!urgent&&!constrained?pickDeathSearch(x,y,fullObs,navigation,baseSpeed,t):null)??(!urgent&&!constrained?pickPressure(x,y,heading,bodyLength,state.score,obs,navigation,baseSpeed,yaw,radius,t):null);"""
assert old in s;s=s.replace(old,new)
s=s.replace("if(strategic?.kind==='harvest'||strategic?.kind==='seek-drop')", "if(strategic?.kind==='harvest'||strategic?.kind==='seek-drop'||strategic?.kind==='sweep-map')")
s=s.replace("&& !(strategic?.kind==='harvest'&&strategic.rich>=6)", "&& strategic?.kind!=='sweep-map' && !(strategic?.kind==='harvest'&&strategic.rich>=6)")
s=s.replace("strategic?.kind==='seek-drop'?'seek-drop':exploring", "strategic?.kind==='seek-drop'?'seek-drop':strategic?.kind==='sweep-map'?'sweep-map':exploring")
s=s.replace("enemyScore:head.score,goal,value:persistentValue", "enemyScore:head.score,side,goal,value:persistentValue")
s=s.replace("strategic.enemy===head.enemy?1.25:1", "strategic.enemy===head.enemy?(strategic.side===side?1.4:1.1):1")
p.write_text(s)
