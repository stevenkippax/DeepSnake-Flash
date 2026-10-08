from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();a='  function raster(obs,radius,future)';b='''  function headSegments(o,t) {
    if(!o.trail?.length)return [{x:o.x,y:o.y,dx:o.vx*t,dy:o.vy*t}];
    const segments=[];
    for(let i=1;i<o.trail.length;i++) {
      const a=o.trail[i-1],b=o.trail[i];if(a.t>=t)break;
      const q=Math.min(1,(t-a.t)/(b.t-a.t));segments.push({x:a.x,y:a.y,dx:(b.x-a.x)*q,dy:(b.y-a.y)*q});
    }
    return segments;
  }
  function headClearance(o,x,y,t) {
    let value=Math.hypot(x-o.x,y-o.y)-o.radius;
    if(Math.hypot(x-o.x,y-o.y)>Math.hypot(o.vx,o.vy)*t+o.radius+2)return value;
    const segments=headSegments(o,t);
    for(const a of segments) {
      const den=a.dx*a.dx+a.dy*a.dy,q=den?Math.max(0,Math.min(1,((x-a.x)*a.dx+(y-a.y)*a.dy)/den)):0;
      value=Math.min(value,Math.hypot(x-a.x-q*a.dx,y-a.y-q*a.dy)-o.radius-.2*Math.min(t,1));
    }
    return value;
  }
'''+a;assert a in s;s=s.replace(a,b)
s=s.replace('for(const o of obs) {\n      const dx=o.head?o.vx*future:0,dy=o.head?o.vy*future:0;', 'for(const source of obs) {\n     for(const segment of source.head?headSegments(source,future):[{x:source.x,y:source.y,dx:0,dy:0}]) {\n      const o={...source,x:segment.x,y:segment.y},dx=segment.dx,dy=segment.dy;')
a='''    const labels=new Int32Array(total);''';s=s.replace(a,'    }\n'+a)
a='''          const dx=o.vx*t,dy=o.vy*t,den=dx*dx+dy*dy;
          const q=den?Math.max(0,Math.min(1,((p.x-o.x)*dx+(p.y-o.y)*dy)/den)):0;
          if(Math.hypot(p.x-o.x-q*dx,p.y-o.y-q*dy)<o.radius+.3)return false;''';assert a in s;s=s.replace(a,'          if(headClearance(o,p.x,p.y,t)<.3)return false;')
s=s.replace('analyze,regionAt,raster,routeTo,index,position','analyze,regionAt,raster,routeTo,index,position,headClearance,headSegments');p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();a='  function obstacles(player,';b='''  function predictHead(x,y,vx,vy,targetX,targetY,yaw) {
    const speed=Math.hypot(vx,vy),target=Math.hypot(targetX,targetY)>.5?Math.atan2(targetY,targetX):Math.atan2(vy,vx);
    let angle=Math.atan2(vy,vx);const points=[{x,y,t:0}];
    for(let i=1;i<=80;i++) {
      const delta=wrap(target-angle);angle+=Math.max(-yaw*.1,Math.min(yaw*.1,delta));
      x+=Math.cos(angle)*speed*.1;y+=Math.sin(angle)*speed*.1;points.push({x,y,t:i*.1});
    }
    return points;
  }
'''+a;assert a in s;s=s.replace(a,b)
a='''        result.push({ x: hx, y: hy, radius: physicalRadius + 1.7, vx: f(pre + 68) * f(pre + 24) * f(pre + 48), vy: f(pre + 72) * f(pre + 24) * f(pre + 48), head: true, enemy, score:u(enemy+64), invincible:!!byte(enemy+70) });'''
b='''        const vx=f(pre+68)*f(pre+24)*f(pre+48),vy=f(pre+72)*f(pre+24)*f(pre+48);
        result.push({x:hx,y:hy,radius:physicalRadius+1.7,vx,vy,trail:predictHead(hx,hy,vx,vy,f(pre+32),f(pre+36),f(pre+28)*Math.PI/180),head:true,enemy,score:u(enemy+64),invincible:!!byte(enemy+70)});''';assert a in s;s=s.replace(a,b)
a='''        const dx=o.vx*t,dy=o.vy*t,den=dx*dx+dy*dy;
        const q=den?Math.max(0,Math.min(1,((x-o.x)*dx+(y-o.y)*dy)/den)):0;
        value=Math.min(value,Math.hypot(x-o.x-q*dx,y-o.y-q*dy)-o.radius-.2*Math.min(t,1));''';b='''        if(topology?.headClearance)value=Math.min(value,topology.headClearance(o,x,y,t));
        else {
          const dx=o.vx*t,dy=o.vy*t,den=dx*dx+dy*dy;
          const q=den?Math.max(0,Math.min(1,((x-o.x)*dx+(y-o.y)*dy)/den)):0;
          value=Math.min(value,Math.hypot(x-o.x-q*dx,y-o.y-q*dy)-o.radius-.2*Math.min(t,1));
        }''';assert a in s;s=s.replace(a,b);p.write_text(s)
p=Path('work/snake-game/check-controller-mpc.cjs');s=p.read_text().replace('pickExplore,visited','pickExplore,predictHead,visited');a='const queued=d.route';b='''const turn=d.predictHead(0,0,5,0,0,1,10.472);
assert(turn[10].y>4 && turn[10].x<1,'Known north steering must predict a turn instead of a straight east extrapolation');
'''+a;assert a in s;s=s.replace(a,b);p.write_text(s)
