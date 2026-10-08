from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();Path('work/snake-game/navigation-before-trap-territory.js').write_text(s)
insert='''  // A head may close onto any reachable point of its own body. Each prefix
  // plus that closing chord is a potential enclosure, regardless of its scale.
  function trapAt(x,y,obs) {
    const groups=new Map(),heads=new Map();
    for(const o of obs)if(o.head)heads.set(o.enemy,o);else{if(!groups.has(o.enemy))groups.set(o.enemy,[]);groups.get(o.enemy).push(o);}
    const result=[];
    for(const [enemy,segments] of groups) {
      const h=heads.get(enemy)??segments[0];if(!h)continue;
      const reach=(h.maxSpeed??10)*3.5,hx=h.x-x,hy=h.y-y;
      let ax=hx,ay=hy,sweep=0,length=0;
      for(const o of segments) {
        if(o.x2===undefined)continue;
        for(const p of [{x:o.x,y:o.y},{x:o.x2,y:o.y2}]) {
          const bx=p.x-x,by=p.y-y;
          sweep+=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);length+=Math.hypot(bx-ax,by-ay);ax=bx;ay=by;
          const distance=Math.hypot(p.x-h.x,p.y-h.y);
          if(length<16 || distance>reach || length<distance*1.25)continue;
          const winding=sweep+Math.atan2(bx*hy-by*hx,bx*hx+by*hy);
          if(Math.abs(winding)>Math.PI) {
            result.push({enemy,potentialLoop:true,closureDistance:distance,closureSeconds:distance/(h.maxSpeed??10),length,radius:Math.hypot(bx,by)});break;
          }
        }
        if(result.at(-1)?.enemy===enemy)break;
      }
    }
    return result;
  }
  function dangerAt(x,y,obs) {return [...trapAt(x,y,obs),...wrapAt(x,y,obs)].filter((o,i,a)=>a.findIndex(b=>b.enemy===o.enemy)===i);}
'''
s=s.replace('  function analyze(',insert+'  function analyze(')
s=s.replace('const surrounding=wrapAt(x,y,obs);','const surrounding=dangerAt(x,y,obs);')
a='''escapePath=routeTo(current,start,i=>{const p=position(i);return Math.hypot(p.x-x,p.y-y)>=outside;},'''
b='''escapePath=routeTo(current,start,i=>{const p=position(i);return current.clear[i]>=1.5 && Math.hypot(p.x-x,p.y-y)>=4 && !dangerAt(p.x,p.y,obs).length;},'''
assert a in s;s=s.replace(a,b)
s=s.replace('window.__snakeTopology={wrapAt,','window.__snakeTopology={trapAt,dangerAt,wrapAt,')
p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();Path('work/snake-game/controller-before-trap-territory.js').write_text(s)
s=s.replace('topology?.wrapAt(', 'topology?.dangerAt(')
s=s.replace("if(Math.hypot(evacuation.goal.x-x,evacuation.goal.y-y)<2) {", "if(Math.hypot(evacuation.goal.x-x,evacuation.goal.y-y)<2 && !topology.dangerAt(x,y,obs).length) {")
s=s.replace('if(path.length)evacuation.path=path;', 'if(path.length && !topology.dangerAt(evacuation.goal.x,evacuation.goal.y,obs).length)evacuation.path=path;')
p.write_text(s)
