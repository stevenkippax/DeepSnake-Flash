from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();Path('work/snake-game/controller-before-safety-index.js').write_text(s)
a=s.index('    function safeClear(px,py,t) {',s.index('  function safetyPlan'))
b=s.index('    const initial=safeClear',a)
s=s[:a]+'''    const heads=local.filter(o=>o.head),cell=4,key=(x,y)=>x+','+y;
    function binsFor(capsules) {
      const bins=new Map();
      for(const o of capsules) {
        const reach=o.radius+1;
        for(let cy=Math.floor((Math.min(o.y,o.y2??o.y)-reach)/cell);cy<=Math.floor((Math.max(o.y,o.y2??o.y)+reach)/cell);cy++)for(let cx=Math.floor((Math.min(o.x,o.x2??o.x)-reach)/cell);cx<=Math.floor((Math.max(o.x,o.x2??o.x)+reach)/cell);cx++) {
          const k=key(cx,cy);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);
        }
      }
      return bins;
    }
    const bodyBins=binsFor(local.filter(o=>!o.head));
    const futureBins=Array.from({length:61},(_,k)=>{
      const capsules=[],when=k*.1;
      for(const o of heads) {
        const parts=topology?.headSegments?topology.headSegments({...o,tailSeconds:(o.tailSeconds??Infinity)+.1},when):[{x:o.x,y:o.y,dx:o.vx*when,dy:o.vy*when}];
        let last=null;
        for(const part of parts) {
          const end={x:part.x+part.dx,y:part.y+part.dy};
          const dx=last?last.x2-last.x:0,dy=last?last.y2-last.y:0;
          if(last&&Math.hypot(last.x2-part.x,last.y2-part.y)<.001&&Math.abs(dx*part.dy-dy*part.dx)<.001&&dx*part.dx+dy*part.dy>=0){last.x2=end.x;last.y2=end.y;}
          else {last={x:part.x,y:part.y,x2:end.x,y2:end.y,radius:o.radius+.2*Math.min(when,1)+Math.min(3,when*.4)+(o.maxSpeed??10)*.1};capsules.push(last);}
        }
      }
      return binsFor(capsules);
    });
    function safeClear(px,py,t) {
      let d=Math.min(1,46-radius-Math.max(Math.abs(px),Math.abs(py)));
      const k=key(Math.floor(px/cell),Math.floor(py/cell));
      for(const o of bodyBins.get(k)??[])d=Math.min(d,bodyGap(o,px,py));
      if(t>0)for(const o of futureBins[Math.min(60,Math.ceil(t*10-1e-7))].get(k)??[])d=Math.min(d,bodyGap(o,px,py));
      if(t<=.65)for(const o of heads)d=Math.min(d,Math.hypot(px-o.x,py-o.y)-o.radius-(o.maxSpeed??Math.max(10,Math.hypot(o.vx,o.vy)))*t);
      return d-.15;
    }
''' +s[b:]
p.write_text(s)
