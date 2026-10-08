from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();a='  function raster(obs,radius,future)';b='''  function clipTrails(heads,bodies) {
    const bins=new Map(),cell=3,key=(x,y)=>x+','+y;let maximumRadius=0,cuts=0;
    for(const b of bodies) {
      maximumRadius=Math.max(maximumRadius,b.physical);
      const k=key(Math.floor(b.x/cell),Math.floor(b.y/cell));if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b);
    }
    for(const head of heads) {
      if(head.invincible || !head.trail?.length)continue;
      const reach=Math.ceil((head.physical+maximumRadius)/cell);
      for(let i=1;i<head.trail.length;i++) {
        const p=head.trail[i];let blocked=!head.boss&&Math.max(Math.abs(p.x),Math.abs(p.y))>48.55-head.physical;
        const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
        for(let dy=-reach;dy<=reach&&!blocked;dy++)for(let dx=-reach;dx<=reach&&!blocked;dx++) {
          for(const b of bins.get(key(cx+dx,cy+dy))??[]) {
            if(b.enemy===head.enemy || b.ttl<p.t+.15)continue;
            if(Math.hypot(p.x-b.x,p.y-b.y)<head.physical+b.physical-.1){blocked=true;break;}
          }
        }
        if(blocked){head.trail=head.trail.slice(0,i+1);head.predictedBarrierTime=p.t;cuts++;break;}
      }
    }
    return cuts;
  }
'''+a;assert a in s;s=s.replace(a,b).replace('headSegments,nearest','headSegments,nearest,clipTrails');p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();Path('work/snake-game/controller-before-trajectory-clipping.js').write_text(s)
s=s.replace('head:true,enemy,score:u(enemy+64)', 'head:true,enemy,physical:physicalRadius-ownRadius,boss:!!byte(enemy+68),score:u(enemy+64)')
s=s.replace('result.push({ x: bx, y: by, radius });','result.push({ x: bx, y: by, radius,enemy,physical:physicalRadius-ownRadius,ttl:(size-j)*f(pre+8)*f(pre+52)/Math.max(1,f(pre+24)*f(pre+48)) });')
a='''    return result;
  }
  function clearance''';b='''    if(topology?.clipTrails) {
      const ownPre=predictor(player),ownBodies=u(ownPre+180),ownItems=u(ownBodies+8),ownSize=Math.min(500,u(ownBodies+12));
      const bodies=result.filter(o=>!o.head);
      for(let j=0;j<ownSize;j++) {
        const part=u(ownItems+16+j*4);if(!part)continue;
        bodies.push({x:f(part+12),y:f(part+16),physical:ownRadius,enemy:player,ttl:(ownSize-j)*f(ownPre+8)*f(ownPre+52)/Math.max(1,speed)});
      }
      const started=performance.now();state.clippedTrajectories=topology.clipTrails(result.filter(o=>o.head),bodies);state.motionComputeMs=performance.now()-started;
    }
    return result;
  }
  function clearance''';assert a in s;s=s.replace(a,b)
s=s.replace('o.score>=500 && !o.invincible', 'o.score>=50 && !o.invincible')
p.write_text(s)
p=Path('work/snake-game/check-topology.cjs');s=p.read_text();s+='''
const straightTrace=()=>Array.from({length:81},(_,i)=>({x:i*.5,y:0,t:i*.1}));
const head=()=>({x:0,y:0,vx:5,vy:0,physical:.5,radius:2,enemy:1,trail:straightTrace()});
let h=head();n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:2,ttl:10}]);assert(h.trail.at(-1).t<1,'Forecasts must stop at a solid body instead of passing through it');
h=head();n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:1,ttl:10}]);assert(h.trail.length===81,'A snake must not collide with its own body');
h=head();n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:2,ttl:.3}]);assert(h.trail.length===81,'A tail that vacates before arrival must not block the forecast');
h={...head(),invincible:true};n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:2,ttl:10}]);assert(h.trail.length===81,'Invincible heads must retain their possible route through bodies');
''';p.write_text(s)
