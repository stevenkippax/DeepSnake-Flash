from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();start=s.index('  function headSegments(');end=s.index('  function clipTrails',start)
s=s[:start]+'''  function headSegments(o,t) {
    if(t<=0)return [{x:o.x,y:o.y,dx:0,dy:0}];
    const earliest=Math.max(0,t-(o.tailSeconds??Infinity));
    if(!o.trail?.length)return [{x:o.x+o.vx*earliest,y:o.y+o.vy*earliest,dx:o.vx*(t-earliest),dy:o.vy*(t-earliest)}];
    const segments=[];
    for(let i=1;i<o.trail.length;i++) {
      const a=o.trail[i-1],b=o.trail[i];if(a.t>=t)break;if(b.t<earliest)continue;
      const lo=Math.max(0,(earliest-a.t)/(b.t-a.t)),hi=Math.min(1,(t-a.t)/(b.t-a.t));
      segments.push({x:a.x+(b.x-a.x)*lo,y:a.y+(b.y-a.y)*lo,dx:(b.x-a.x)*(hi-lo),dy:(b.y-a.y)*(hi-lo)});
    }
    const last=o.trail.at(-1);
    if(last.t<t)segments.push({x:last.x,y:last.y,dx:0,dy:0});
    return segments;
  }
  function headClearance(o,x,y,t) {
    let value=Infinity;
    for(const segment of headSegments(o,t)) {
      const ax=segment.x,ay=segment.y,dx=segment.dx,dy=segment.dy,den=dx*dx+dy*dy;
      const q=den?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/den)):0;
      value=Math.min(value,Math.hypot(x-ax-q*dx,y-ay-q*dy)-o.radius-.2*Math.min(t,1));
    }
    return value;
  }
'''+s[end:]
s=s.replace('    for(const source of obs) {','    for(const source of obs) {\n     if(!source.head && source.ttl!==undefined && future>source.ttl+.25)continue;')
p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text()
s=s.replace('      const points=[];','      const head=result.find(o=>o.head&&o.enemy===enemy);if(head)head.tailSeconds=size*f(pre+8)*f(pre+52)/Math.max(1,f(pre+24))+.3;\n      const points=[];')
s=s.replace('      value = Math.min(value, bodyGap(o,x,y));','      if(!o.head && o.ttl!==undefined && t>o.ttl+.25)continue;\n      if(!o.head || t===0)value = Math.min(value, bodyGap(o,x,y));')
p.write_text(s)
