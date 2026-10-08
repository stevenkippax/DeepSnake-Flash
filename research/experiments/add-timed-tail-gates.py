from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();anchor='  function analyze(x,y,obs,radius,speed=5,delay=.15) {'
insert='''  function timedExit(x,y,obs,radius,current,future,speed=5,delay=.15) {
    const start=nearest(current,x,y),oldRegion=current.labels[start];
    if(start<0||!obs.some(o=>!o.head&&o.ttl<6&&Math.hypot(o.x-x,o.y-y)<32+o.radius))return [];
    const cell=4,bins=new Map(),heads=obs.filter(o=>o.head),key=(x,y)=>x+','+y;
    for(const o of obs)if(!o.head) {
      const r=o.radius+.5;
      for(let cy=Math.floor((Math.min(o.y,o.y2??o.y)-r)/cell);cy<=Math.floor((Math.max(o.y,o.y2??o.y)+r)/cell);cy++)for(let cx=Math.floor((Math.min(o.x,o.x2??o.x)-r)/cell);cx<=Math.floor((Math.max(o.x,o.x2??o.x)+r)/cell);cx++) {
        const k=key(cx,cy);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);
      }
    }
    const limit=window.__snakeRuntime?.arenaLimit??46,dt=.2,layers=32;
    function safe(i,t) {
      const p=position(i);if(limit-radius-Math.max(Math.abs(p.x),Math.abs(p.y))<.4)return false;
      for(const o of bins.get(key(Math.floor(p.x/cell),Math.floor(p.y/cell)))??[]) {
        if(t>(o.ttl??Infinity)+.5)continue;
        const dx=(o.x2??o.x)-o.x,dy=(o.y2??o.y)-o.y,den=dx*dx+dy*dy,q=den?Math.max(0,Math.min(1,((p.x-o.x)*dx+(p.y-o.y)*dy)/den)):0;
        if(Math.hypot(p.x-o.x-q*dx,p.y-o.y-q*dy)-o.radius<.3)return false;
      }
      return heads.every(o=>headClearance(o,p.x,p.y,t)>=.5);
    }
    const totalStates=total*layers,parent=new Int32Array(totalStates);parent.fill(-1);
    const queue=[],arrival=new Map(),initial=start;parent[initial]=initial;arrival.set(initial,delay);queue.push(initial);
    let read=0,found=-1;
    while(read<queue.length&&read<18000) {
      const state=queue[read++],i=state%total,t=arrival.get(state),p=position(i);
      if(current.labels[i]!==oldRegion&&future.labels[i]>=0&&future.regions[future.labels[i]].area>=Math.max(80,(current.regions[oldRegion]?.area??0)*1.2)&&Math.hypot(p.x-x,p.y-y)>5) {found=state;break;}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const j=index(p.x+dx,p.y+dy);if(j<0)continue;
        const when=t+Math.hypot(dx,dy)/speed,layer=Math.ceil(when/dt);if(when>6||layer>=layers)continue;
        const next=layer*total+j;if(parent[next]>=0||!safe(j,when))continue;
        if(dx&&dy&&(!safe(index(p.x+dx,p.y),when)||!safe(index(p.x,p.y+dy),when)))continue;
        parent[next]=state;arrival.set(next,when);queue.push(next);
      }
    }
    if(found<0)return [];
    const path=[];for(let s=found;s!==initial;s=parent[s]){const p=position(s%total);path.push({...p,arrival:arrival.get(s)});}return path.reverse();
  }
'''
s=s.replace(anchor,insert+anchor)
s=s.replace("const waiting=((closing", "if(!escapePath.length&&room&&area<Math.max(600,(current.largest?.area??0)*.6)) {\n      const candidate=timedExit(x,y,obs,radius,current,future,speed,delay);\n      const oldOwners=new Set(surrounding.map(o=>o.enemy));\n      if(candidate.length&&!dangerAt(candidate.at(-1).x,candidate.at(-1).y,obs).some(o=>!oldOwners.has(o.enemy)))escapePath=candidate;\n    }\n    const waiting=((closing")
s=s.replace("nearest,clipTrails};", "nearest,clipTrails,timedExit};")
p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text()
s=s.replace("for(const o of bodyBins.get(k)??[])d=Math.min(d,bodyGap(o,px,py));", "for(const o of bodyBins.get(k)??[])if(t<=(o.ttl??Infinity)+.5)d=Math.min(d,bodyGap(o,px,py));")
s=s.replace("navigation?.surrounding?.length)&&exitPath.length>0", "navigation?.surrounding?.length||exitPath.some(p=>p.arrival!==undefined))&&exitPath.length>0")
s=s.replace("largestAccessibleFutureArea:navigation.largestAccessibleFutureArea,closing", "largestAccessibleFutureArea:navigation.largestAccessibleFutureArea,largestFutureArea:navigation.largestFutureArea,closing")
p.write_text(s)
