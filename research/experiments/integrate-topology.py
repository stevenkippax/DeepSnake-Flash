from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text()
def rep(a,b):
 global s
 assert a in s,a[:80]
 s=s.replace(a,b)
rep('let hunt=null;', 'let hunt=null, navigation=null, navigationRefresh=0;\n  const topology=window.__snakeTopology;\n  function endpointArea(route) {return navigation && topology ? topology.regionAt(navigation.future,route.px,route.py)?.area ?? 0 : 8281;}')
rep('const trapped=obs.filter(o=>o.head && Math.hypot(o.x-cx,o.y-cy)<r-1).length;', 'const victims=obs.filter(o=>o.head && o.score>=500 && !o.invincible && Math.hypot(o.x-cx,o.y-cy)<r-1).map(o=>o.enemy);\n      if(!victims.length)continue;\n      const trapped=victims.length;')
rep('sweep:0};', 'sweep:0,victims,started:state.now*1000,lastProgress:state.now*1000};')
rep('if (Math.hypot(hx - x, hy - y) < 18)', 'if (Number.isFinite(hx+hy) && Math.abs(hx)<55 && Math.abs(hy)<55)')
rep('if (Math.hypot(bx - x, by - y) > 18) continue;', 'if (!Number.isFinite(bx+by) || Math.abs(bx)>55 || Math.abs(by)>55) continue;')
rep('orbit=null; hunt=null; commandHistory.length=0;', 'orbit=null; hunt=null; navigation=null; navigationRefresh=0; commandHistory.length=0;')
rep('const obs = obstacles(player, x, y, radius,speed);', '''const fullObs = obstacles(player, x, y, radius,speed);
    const obs=fullObs.filter(o=>Math.hypot(o.x-x,o.y-y)<(o.head?60:32)+o.radius);
    if(topology && (!navigation || t-navigationRefresh>500)) {
      const started=performance.now();navigation=topology.analyze(x,y,fullObs,radius);navigationRefresh=t;
      state.navigation={currentArea:navigation.currentArea,futureArea:navigation.futureArea,closing:navigation.closing,confined:navigation.confined,escapePathLength:navigation.escapePath.length,computeMs:performance.now()-started};
    }
    const evacuating=!!navigation?.closing&&navigation.escapePath.length>0;
    const waitingForExit=!!navigation?.waitLoop&&!evacuating;
    if(evacuating||waitingForExit){orbit=null;hunt=null;state.orbitRetry=t+10000;}
''')
rep('if(!orbit && u(player+64)>=600', 'if(!evacuating && !waitingForExit && !orbit && u(player+64)>=600')
rep('orbit.sweep+=orbit.sign*wrap(theta-orbit.angle);orbit.angle=theta;', '''const advance=orbit.sign*wrap(theta-orbit.angle);
      orbit.sweep+=advance;orbit.angle=theta;
      if(advance>.01)orbit.lastProgress=t;
      const victimsRemain=obs.some(o=>o.head && orbit.victims?.includes(o.enemy) && Math.hypot(o.x-orbit.cx,o.y-orbit.cy)<orbit.r-1);
      const exhausted=!victimsRemain || t-orbit.started>60000 || t-orbit.lastProgress>3000;''')
rep('if(harvest.length>=5 || noYield ||', 'if(exhausted || harvest.length>=5 || noYield ||')
rep('if(!orbiting && !hunt', 'if(!evacuating && !waitingForExit && !orbiting && !hunt')
rep('if(hunt)waypoint=hunt.waypoint;', '''if(hunt)waypoint=hunt.waypoint;
    const escapeGuide=evacuating?{kind:'path',points:navigation.escapePath}:waitingForExit?navigation.waitLoop:null;
    if(evacuating)waypoint=pathPoint(x,y,navigation.escapePath);
    else if(waitingForExit)waypoint=orbitPoint(x,y,navigation.waitLoop);''')
rep("const guide=hunt?null:orbiting?orbit:path.length>1?{kind:'path',points:path}:null;", "const guide=escapeGuide ?? (hunt?null:orbiting?orbit:path.length>1?{kind:'path',points:path}:null);")
rep('desiredRoute.hit >= 2.35 && desiredRoute.minimum > .05 ?', 'desiredRoute.hit >= 2.35 && desiredRoute.minimum > .05 && (waitingForExit || endpointArea(desiredRoute)>=80) ?')
rep('const score = r.hit * 100000 +', 'const regionArea=endpointArea(r);\n      const spaceValue=waitingForExit?0:(regionArea>=80?100000:regionArea*1000)+Math.min(400,regionArea)*5;\n      const score = r.hit * 1000000 + spaceValue +')
rep('const canBoost=!orbiting', 'const canBoost=!orbiting && !waitingForExit')
rep('if(canBoost && foodAhead>=4)', 'if(canBoost && (foodAhead>=4 || evacuating))')
rep("state.mode=hunt?'intercept':orbiting?'orbit':safeBoost?'cruise-boost':'forage';", "state.mode=evacuating?'escape-pocket':waitingForExit?'wait-for-exit':hunt?'intercept':orbiting?'cage-opponent':safeBoost?'cruise-boost':'forage';")
rep('pathLength: path.length,', 'pathLength: path.length, navigation:state.navigation,')
p.write_text(s)
q=Path('work/snake-game/check-controller-mpc.cjs');s=q.read_text()
s=s.replace('const loop=d.pickOrbit(0,0,0,40,[],.3);','assert.equal(d.pickOrbit(0,0,0,40,[],.3),null,"Empty space must never trigger circling");\nconst victim={x:0,y:40/(3*Math.PI),radius:1,head:true,vx:0,vy:0,score:500,enemy:1};\nconst loop=d.pickOrbit(0,0,0,40,[victim],.3);')
s=s.replace('d.pickOrbit(43,0,0,40,[],.3)','d.pickOrbit(43,0,0,40,[{...victim,x:43}],.3)')
s=s.replace('d.pickOrbit(0,0,0,40,[{x:0,y:0,radius:2}],.3)','d.pickOrbit(0,0,0,40,[victim,{x:0,y:0,radius:2}],.3)')
s=s.replace('[{x:0,y:40,radius:2},{x:0,y:-40,radius:2}],.3)', '[{...victim,y:8,radius:1.5},{x:0,y:40,radius:2},{x:0,y:-40,radius:2}],.3)')
q.write_text(s)
