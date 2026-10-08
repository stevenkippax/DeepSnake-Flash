from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();a='''    const p=room?position(room.roomiest):null;
    const waitLoop=waiting&&p&&room.maximumClearance>1.3?{cx:p.x,cy:p.y,r:Math.min(2,room.maximumClearance-.5),sign:1}:null;
    return {current,future,currentArea:area,futureArea:laterArea,largestFutureArea:largest,closing,confined,escapePath,waitLoop};''';b='''    let shelterPath=[];
    if(waiting && room) {
      let goal=-1,best=-Infinity;
      for(let i=0;i<total;i++) {
        if(current.labels[i]!==room.id || current.clear[i]<.6 || i===start)continue;
        const p=position(i),distance=Math.hypot(p.x-x,p.y-y);
        if(distance<3)continue;
        const heads=obs.filter(o=>o.head);
        const threat=heads.reduce((a,o)=>Math.min(a,headClearance(o,p.x,p.y,2)),10);
        const value=Math.min(12,distance)*.8+Math.min(5,current.clear[i])*.4+Math.min(5,threat)*.3;
        if(value>best){best=value;goal=i;}
      }
      if(goal>=0)shelterPath=routeTo(current,start,i=>i===goal);
    }
    return {current,future,currentArea:area,futureArea:laterArea,largestFutureArea:largest,closing,confined,escapePath,waiting,shelterPath};''';assert a in s;s=s.replace(a,b);s=s.replace('headClearance,headSegments','headClearance,headSegments,nearest');p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();s=s.replace('let hunt=null, navigation=null,', 'let refuge=null,refugeUntil=0;\n  let hunt=null, navigation=null,');s=s.replace('waitingForExit=!!navigation?.waitLoop&&!evacuating;', 'waitingForExit=!!navigation?.waiting&&!evacuating;');a="const escapeGuide=evacuating?{kind:'path',points:navigation.escapePath}:waitingForExit?navigation.waitLoop:null;\n    if(evacuating)waypoint=pathPoint(x,y,navigation.escapePath);\n    else if(waitingForExit)waypoint=orbitPoint(x,y,navigation.waitLoop);";b="""let refugePath=[];
    if(waitingForExit) {
      const here=topology.regionAt(navigation.current,x,y),there=refuge?topology.regionAt(navigation.current,refuge.x,refuge.y):null;
      if(!refuge || t>refugeUntil || Math.hypot(refuge.x-x,refuge.y-y)<2 || here?.id!==there?.id) {
        refuge=navigation.shelterPath.at(-1)??null;refugeUntil=t+4000;
      }
      if(refuge)refugePath=topology.routeTo(navigation.current,topology.nearest(navigation.current,x,y),i=>i===topology.index(refuge.x,refuge.y));
    } else refuge=null;
    const escapeGuide=evacuating?{kind:'path',points:navigation.escapePath}:refugePath.length?{kind:'path',points:refugePath}:null;
    if(evacuating)waypoint=pathPoint(x,y,navigation.escapePath);
    else if(refugePath.length)waypoint=pathPoint(x,y,refugePath);""";assert a in s;s=s.replace(a,b);s=s.replace("waitingForExit?'wait-for-exit'", "waitingForExit?'trapped-patrol'");s=s.replace("==='wait-for-exit'", "==='trapped-patrol'");p.write_text(s)
p=Path('work/snake-game/check-topology.cjs');s=p.read_text().replace('!open.waitLoop','!open.waiting').replace('tooLate.waitLoop','tooLate.waiting').replace('shut.waitLoop','shut.shelterPath.length');s=s.replace("const shut=n.analyze", "const shut=n.analyze");s=s.replace("'Already enclosed snake should wait in available space for an opening'", "'Already enclosed snake should choose a route through remaining safe space'");p.write_text(s)
