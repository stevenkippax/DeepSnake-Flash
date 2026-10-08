from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();Path('work/snake-game/controller-before-physics-interception-buffer.js').write_text(s)
a='  function pickIntercept(';b='''  function attackObstacles(obs,enemy) {
    return obs.map(o=>o.head && o.enemy===enemy?{...o,radius:(o.radius-1.7)+.35+Math.hypot(o.vx,o.vy)*state.inputDelay}:o);
  }
'''+a;assert a in s;s=s.replace(a,b)
s=s.replace('if(arrival>tau-.7)continue;', 'const lead=Math.max(.35,(head.radius-1.7+.5)/v);\n        if(arrival>tau-lead)continue;')
s=s.replace('baseSpeed*2,yaw,obs,radius,waypoint,null,{startDelay:alignTime', 'baseSpeed*2,yaw,attackObstacles(obs,head.enemy),radius,waypoint,null,{startDelay:alignTime')
s=s.replace('if(preview.hit<2.35 || preview.minimum<.8)', 'if(preview.hit<2.35 || preview.minimum<.4)')
s=s.replace('tau,arrival,alignTime,boostSeconds,minimum:', 'tau,arrival,lead,alignTime,boostSeconds,minimum:')
s=s.replace('const desiredRoute = route(x, y, heading, desired, planningSpeed, yaw, obs,', 'const planObs=hunt?attackObstacles(obs,hunt.enemy):obs;\n    const desiredRoute = route(x, y, heading, desired, planningSpeed, yaw, planObs,')
s=s.replace('route(x, y, heading, angle, planningSpeed, yaw, obs,', 'route(x, y, heading, angle, planningSpeed, yaw, planObs,')
p.write_text(s)
p=Path('work/snake-game/check-controller-mpc.cjs');s=p.read_text().replace('cutoff.arrival<=cutoff.tau-.7 && cutoff.minimum>=.8', 'cutoff.arrival<=cutoff.tau-cutoff.lead && cutoff.minimum>=.4');s=s.replace('staged.alignTime>d.state.inputDelay', 'staged.alignTime>d.state.inputDelay');p.write_text(s)
