from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();a=s.index('  function analyze(')
s=s[:a]+'''  function wrapAt(x,y,obs) {
    const groups=new Map();
    for(const o of obs)if(!o.head){if(!groups.has(o.enemy))groups.set(o.enemy,[]);groups.get(o.enemy).push(o);}
    const threats=[];
    for(const [enemy,segments] of groups) {
      let lastAngle=null,lastHeading=null,sweep=0,turn=0,arcLength=0,maxRadius=0;
      function reset(){lastAngle=null;lastHeading=null;sweep=0;turn=0;arcLength=0;maxRadius=0;}
      for(const o of segments) {
        if(o.x2===undefined)continue;
        const distance=Math.max(Math.hypot(o.x-x,o.y-y),Math.hypot(o.x2-x,o.y2-y));
        if(distance>22 || o.ttl<2){reset();continue;}
        const begin=Math.atan2(o.y-y,o.x-x),end=Math.atan2(o.y2-y,o.x2-x),heading=Math.atan2(o.y2-o.y,o.x2-o.x);
        if(lastAngle===null)lastAngle=begin;
        const delta=Math.atan2(Math.sin(end-lastAngle),Math.cos(end-lastAngle));
        if(sweep*delta<-.15){reset();lastAngle=begin;}
        sweep+=Math.atan2(Math.sin(end-lastAngle),Math.cos(end-lastAngle));
        if(lastHeading!==null)turn+=Math.atan2(Math.sin(heading-lastHeading),Math.cos(heading-lastHeading));
        arcLength+=Math.hypot(o.x2-o.x,o.y2-o.y);maxRadius=Math.max(maxRadius,distance);
        lastAngle=end;lastHeading=heading;
        if(Math.abs(sweep)>=2 && Math.abs(turn)>=1.2 && sweep*turn>0 && arcLength>=12) {
          threats.push({enemy,sweep,turn,radius:maxRadius,length:arcLength});break;
        }
      }
    }
    return threats;
  }
'''+s[a:]
s=s.replace('    const current=raster(obs,radius,0),future=raster(obs,radius,8);','    const surrounding=wrapAt(x,y,obs);\n    const current=raster(obs,radius,0),future=raster(obs,radius,8);')
s=s.replace('    if(closing || pinched) {','    if(surrounding.length && room) {\n      const outside=Math.max(12,Math.min(24,Math.max(...surrounding.map(o=>o.radius))+4));\n      const heads=obs.filter(o=>o.head);\n      escapePath=routeTo(current,start,i=>{const p=position(i);return Math.hypot(p.x-x,p.y-y)>=outside;},(i,t)=>{const p=position(i);return heads.every(o=>headClearance(o,p.x,p.y,t)>=.3);},speed,delay);\n    }\n    if(!escapePath.length && (closing || pinched)) {')
s=s.replace('const waiting=((closing||pinched)&&!escapePath.length)||confined;', 'const waiting=((closing||pinched||surrounding.length)&&!escapePath.length)||confined;')
s=s.replace('return {current,future,currentArea:', 'return {current,future,surrounding,currentArea:')
s=s.replace('window.__snakeTopology={analyze,', 'window.__snakeTopology={wrapAt,analyze,')
p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text()
s=s.replace('pinched:navigation.pinched,wideArea:', 'pinched:navigation.pinched,surrounding:navigation.surrounding,wideArea:')
s=s.replace('const evacuating=!!(navigation?.closing||navigation?.pinched)&&navigation.escapePath.length>0;', 'const evacuating=!!(navigation?.closing||navigation?.pinched||navigation?.surrounding?.length)&&navigation.escapePath.length>0;')
s=s.replace('const urgent=!!(navigation?.closing||navigation?.pinched);', 'const urgent=!!(navigation?.closing||navigation?.pinched||navigation?.surrounding?.length);')
s=s.replace('if (cost < best) { best = cost;', 'if (cost < best && !topology?.wrapAt(item.x,item.y,obs).length) { best = cost;')
s=s.replace('if(Math.hypot(point.x-x,point.y-y)<6)continue;', 'if(Math.hypot(point.x-x,point.y-y)<6 || topology?.wrapAt(point.x,point.y,obs).length)continue;')
s=s.replace('if(preview.hit<2.35 || preview.minimum<.4)continue;', 'if(preview.hit<2.35 || preview.minimum<.4 || topology?.wrapAt(waypoint.x,waypoint.y,obs).length)continue;')
p.write_text(s)
