from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text().replace('let refuge=null,refugeUntil=0;', 'let refuge=null,refugeUntil=0,evacuation=currentPlayer===oldController?.last?.player?oldController.evacuation??null:null;')
a=s.index('  function tick(t) {')
s=s[:a]+'''  function commitEvacuation(x,y,t,nav) {
    if(nav.surrounding?.length && nav.escapePath.length && !evacuation) {
      evacuation={origin:{x,y},goal:nav.escapePath.at(-1),path:nav.escapePath,started:t,enemy:nav.surrounding.map(o=>o.enemy)};
    }
    if(!evacuation)return nav.escapePath;
    if(!nav.surrounding?.length && Math.hypot(evacuation.goal.x-x,evacuation.goal.y-y)<2) {evacuation=null;return nav.escapePath;}
    const path=topology.routeTo(nav.current,topology.nearest(nav.current,x,y),i=>i===topology.index(evacuation.goal.x,evacuation.goal.y));
    if(path.length)evacuation.path=path;
    state.evacuation=evacuation;
    return evacuation.path;
  }
'''+s[a:]
s=s.replace('exploration=null;lastGainAt=0;', 'exploration=null;evacuation=null;state.evacuation=null;lastGainAt=0;')
s=s.replace('    const evacuating=!!(navigation?.closing||navigation?.pinched||navigation?.surrounding?.length)&&navigation.escapePath.length>0;', '    const exitPath=navigation?commitEvacuation(x,y,t,navigation):[];\n    const evacuating=!!(evacuation||navigation?.closing||navigation?.pinched||navigation?.surrounding?.length)&&exitPath.length>0;')
s=s.replace('const urgent=!!(navigation?.closing||navigation?.pinched||navigation?.surrounding?.length);','const urgent=!!(evacuation||navigation?.closing||navigation?.pinched||navigation?.surrounding?.length);')
s=s.replace("const escapeGuide=evacuating?{kind:'path',points:navigation.escapePath}","const escapeGuide=evacuating?{kind:'path',points:exitPath}")
s=s.replace('if(evacuating)waypoint=pathPoint(x,y,navigation.escapePath);','if(evacuating)waypoint=pathPoint(x,y,exitPath);')
s=s.replace('if(!nav.surrounding?.length && Math.hypot(evacuation.goal.x-x,evacuation.goal.y-y)<2) {evacuation=null;', 'if(!nav.surrounding?.length && Math.hypot(evacuation.goal.x-x,evacuation.goal.y-y)<2) {evacuation=null;state.evacuation=null;')
p.write_text(s)
