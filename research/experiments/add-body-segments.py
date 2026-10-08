from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();Path('work/snake-game/controller-before-multistep.js').write_text(s)
a='  function obstacles(player,';b='''  function bodyGap(o,x,y) {
    const dx=(o.x2??o.x)-o.x,dy=(o.y2??o.y)-o.y,den=dx*dx+dy*dy;
    const q=den?Math.max(0,Math.min(1,((x-o.x)*dx+(y-o.y)*dy)/den)):0;
    return Math.hypot(x-o.x-q*dx,y-o.y-q*dy)-o.radius;
  }
  function bodySegments(points,radius,physical,enemy) {
    if(!points.length)return [];
    const result=[];let anchor=points[0],last=anchor,samples=[anchor];
    function emit(){result.push({x:anchor.x,y:anchor.y,x2:last.x,y2:last.y,radius:radius+.12,physical:physical+.12,enemy,ttl:anchor.ttl});}
    for(let i=1;i<points.length;i++) {
      const p=points[i],segment={x:anchor.x,y:anchor.y,x2:p.x,y2:p.y,radius:0};
      if(Math.hypot(p.x-anchor.x,p.y-anchor.y)>6 || samples.some(a=>bodyGap(segment,a.x,a.y)>.12)) {emit();anchor=last;samples=[last];}
      samples.push(p);last=p;
    }
    emit();return result;
  }
'''+a;assert a in s;s=s.replace(a,b)
s=s.replace('      let previous = null;','      const points=[];')
a='''        if (previous && Math.hypot(bx - previous.x, by - previous.y) < radius * .55) continue;
        result.push({ x: bx, y: by, radius,enemy,physical:physicalRadius-ownRadius,ttl:(size-j)*f(pre+8)*f(pre+52)/Math.max(1,f(pre+24)*f(pre+48)) });
        previous = { x: bx, y: by };''';b='''        points.push({x:bx,y:by,ttl:(size-j)*f(pre+8)*f(pre+52)/Math.max(1,f(pre+24))});''';assert a in s;s=s.replace(a,b)
a='''      }
    }
    if(topology?.clipTrails)''';b='''      }
      result.push(...bodySegments(points,radius,physicalRadius-ownRadius,enemy));
    }
    if(topology?.clipTrails)''';assert a in s;s=s.replace(a,b,1)
s=s.replace('/Math.max(1,speed)});', '/Math.max(1,f(ownPre+24))});')
s=s.replace('Math.hypot(x - o.x, y - o.y) - o.radius', 'bodyGap(o,x,y)',1)
s=s.replace('const lx = Math.max(0, Math.ceil((o.x - reach - ox) / step));', 'const lx = Math.max(0, Math.ceil((Math.min(o.x,o.x2??o.x) - reach - ox) / step));')
s=s.replace('const hx = Math.min(width - 1, Math.floor((o.x + reach - ox) / step));', 'const hx = Math.min(width - 1, Math.floor((Math.max(o.x,o.x2??o.x) + reach - ox) / step));')
s=s.replace('const ly = Math.max(0, Math.ceil((o.y - reach - oy) / step));', 'const ly = Math.max(0, Math.ceil((Math.min(o.y,o.y2??o.y) - reach - oy) / step));')
s=s.replace('const hy = Math.min(width - 1, Math.floor((o.y + reach - oy) / step));', 'const hy = Math.min(width - 1, Math.floor((Math.max(o.y,o.y2??o.y) + reach - oy) / step));')
s=s.replace('Math.hypot(ox + col * step - o.x, oy + row * step - o.y) - o.radius', 'bodyGap(o,ox+col*step,oy+row*step)')
s=s.replace('const gap = Math.hypot(x-o.x,y-o.y)-o.radius;', 'const gap = bodyGap(o,x,y);')
p.write_text(s)
p=Path('outputs/snake-navigation.js');s=p.read_text();Path('work/snake-game/navigation-before-segments.js').write_text(s)
s=s.replace('''const k=key(Math.floor(b.x/cell),Math.floor(b.y/cell));if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b);''','''for(let y=Math.floor((Math.min(b.y,b.y2??b.y)-b.physical)/cell);y<=Math.floor((Math.max(b.y,b.y2??b.y)+b.physical)/cell);y++)for(let x=Math.floor((Math.min(b.x,b.x2??b.x)-b.physical)/cell);x<=Math.floor((Math.max(b.x,b.x2??b.x)+b.physical)/cell);x++) {
        const k=key(x,y);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b);
      }''')
s=s.replace('Math.ceil((head.physical+maximumRadius)/cell)', 'Math.ceil(head.physical/cell)')
s=s.replace('if(Math.hypot(p.x-b.x,p.y-b.y)<head.physical+b.physical-.1)', '''const dx=(b.x2??b.x)-b.x,dy=(b.y2??b.y)-b.y,den=dx*dx+dy*dy,q=den?Math.max(0,Math.min(1,((p.x-b.x)*dx+(p.y-b.y)*dy)/den)):0;
            if(Math.hypot(p.x-b.x-q*dx,p.y-b.y-q*dy)<head.physical+b.physical-.1)''')
s=s.replace('[{x:source.x,y:source.y,dx:0,dy:0}]', '[{x:source.x,y:source.y,dx:(source.x2??source.x)-source.x,dy:(source.y2??source.y)-source.y}]')
p.write_text(s)
p=Path('work/snake-game/check-controller-mpc.cjs');s=p.read_text().replace('predictHead,predatorRisk,visited','predictHead,predatorRisk,bodyGap,bodySegments,visited');s+='''
const capsules=d.bodySegments([{x:0,y:0,ttl:10},{x:1,y:0,ttl:9},{x:2,y:0,ttl:8},{x:2,y:1,ttl:7},{x:2,y:2,ttl:6}],2,1,1);
assert(capsules.length===2 && d.bodyGap(capsules[0],1,0)<-2,'Straight body runs must remain continuous and preserve bends');
''';p.write_text(s)
