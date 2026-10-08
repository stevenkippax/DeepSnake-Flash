from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();Path('work/snake-game/navigation-before-territory-mask.js').write_text(s)
insert='''  function territoryMask(obs) {
    const mask=new Uint8Array(total),groups=new Map(),heads=new Map();
    for(const o of obs)if(o.head)heads.set(o.enemy,o);else{if(!groups.has(o.enemy))groups.set(o.enemy,[]);groups.get(o.enemy).push(o);}
    for(const [enemy,segments] of groups) {
      const h=heads.get(enemy)??segments[0];if(!h)continue;
      const points=[h],reach=(h.maxSpeed??10)*3.5;let length=0;
      for(const o of segments) {
        if(o.x2===undefined)continue;
        for(const p of [{x:o.x,y:o.y},{x:o.x2,y:o.y2}]) {
          const last=points.at(-1),step=Math.hypot(p.x-last.x,p.y-last.y);if(step<.01)continue;
          length+=step;points.push(p);
          const distance=Math.hypot(p.x-h.x,p.y-h.y);if(length<16||distance>reach||length<distance*1.25)continue;
          const low=Math.max(-half,Math.ceil(Math.min(...points.map(p=>p.y)))),high=Math.min(half,Math.floor(Math.max(...points.map(p=>p.y))));
          for(let y=low;y<=high;y++) {
            const cuts=[];
            for(let k=0;k<points.length;k++) {
              const a=points[k],b=points[(k+1)%points.length];
              if(a.y<=y&&b.y>y)cuts.push({x:a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y),sign:1});
              else if(b.y<=y&&a.y>y)cuts.push({x:a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y),sign:-1});
            }
            cuts.sort((a,b)=>a.x-b.x);let winding=0,previous=0;
            for(const cut of cuts) {
              if(winding)for(let x=Math.max(-half,Math.ceil(previous));x<=Math.min(half,Math.floor(cut.x));x++)mask[index(x,y)]=1;
              winding+=cut.sign;previous=cut.x;
            }
          }
        }
      }
    }
    return mask;
  }
'''
s=s.replace('  function analyze(',insert+'  function analyze(')
s=s.replace('const surrounding=dangerAt(x,y,obs);','const surrounding=dangerAt(x,y,obs),territory=surrounding.length?territoryMask(obs):null;')
s=s.replace(' && !dangerAt(p.x,p.y,obs).length;},',' && !territory[i] && !wrapAt(p.x,p.y,obs).length;},')
s=s.replace('return {current,future,surrounding,','return {current,future,territory,surrounding,')
s=s.replace('window.__snakeTopology={trapAt,','window.__snakeTopology={territoryMask,trapAt,')
p.write_text(s)
