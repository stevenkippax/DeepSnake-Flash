from pathlib import Path
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text();Path('work/snake-game/controller-before-staged-hunts.js').write_text(s)
a='  function pickIntercept(';b='''  function headAt(head,t) {
    if(!head.trail?.length)return {x:head.x+head.vx*t,y:head.y+head.vy*t};
    for(let i=1;i<head.trail.length;i++)if(head.trail[i].t>=t) {
      const a=head.trail[i-1],b=head.trail[i],q=(t-a.t)/(b.t-a.t);return {x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q};
    }
    return head.trail.at(-1);
  }
'''+a;assert a in s;s=s.replace(a,b)
s=s.replace('for(const tau of [1.2,1.5,1.8,2.1])', 'for(const tau of [1.2,1.5,1.8,2.1,2.5,3,3.6])')
s=s.replace('const cx=head.x+head.vx*tau,cy=head.y+head.vy*tau;', 'const at=headAt(head,tau),next=headAt(head,tau+.1),cx=at.x,cy=at.y;')
s=s.replace('if(turn>.25 || Math.abs(Math.sin(angle-Math.atan2(head.vy,head.vx)))<.75)', 'if(turn>1.4 || Math.abs(Math.sin(angle-Math.atan2(next.y-cy,next.x-cx)))<.75)')
s=s.replace('const arrival=state.inputDelay+turn/yaw+(distance<=baseSpeed*2?distance/(baseSpeed*2):1+(distance-baseSpeed*2)/baseSpeed);', 'const alignTime=state.inputDelay+turn/yaw,boostSeconds=1.5;\n        const arrival=alignTime+(distance<=baseSpeed*2*boostSeconds?distance/(baseSpeed*2):boostSeconds+(distance-baseSpeed*2*boostSeconds)/baseSpeed);')
s=s.replace('Math.min(tau,1+state.inputDelay)', 'Math.min(tau,boostSeconds+alignTime)').replace('Math.max(arrival,1+state.inputDelay)', 'Math.max(arrival,boostSeconds+alignTime)')
s=s.replace('{startDelay:state.inputDelay,before:baseSpeed,until:1+state.inputDelay,after:baseSpeed}', '{startDelay:alignTime,before:baseSpeed,until:boostSeconds+alignTime,after:baseSpeed}')
s=s.replace('tau,arrival,minimum:preview.minimum,value}', 'tau,arrival,alignTime,boostSeconds,minimum:preview.minimum,value}')
s=s.replace('hunt={...candidate,until:t+1000}', 'hunt={...candidate,alignDeadline:t+(candidate.alignTime+.18)*1000,until:t+(candidate.alignTime+candidate.boostSeconds)*1000}')
s=s.replace('startDelay:state.boosting?0:state.inputDelay', 'startDelay:hunt.boostStartedAt?0:Math.max(0,(hunt.alignDeadline-t)/1000-.18)')
s=s.replace('if(hunt && !huntBoost){hunt=null;state.huntRetry=t+2000;}', '''if(huntBoost && !hunt.boostStartedAt){hunt.boostStartedAt=t;hunt.until=t+hunt.boostSeconds*1000;}
    if(hunt && !huntBoost && (hunt.boostStartedAt || t>hunt.alignDeadline)) {hunt=null;state.huntRetry=t+2000;state.interceptsAborted=(state.interceptsAborted??0)+1;}''')
s=s.replace('const safeBoost=huntBoost || canBoost', 'const safeBoost=huntBoost || !hunt && canBoost')
p.write_text(s)
p=Path('work/snake-game/check-controller-mpc.cjs');s=p.read_text();a="assert.equal(d.pickIntercept(-6,0,0,5,10.472,[{...crossingHead,invincible:true}]";b="""const staged=d.pickIntercept(-6,0,.6,5,10.472,[crossingHead],.3,20);
assert(staged && staged.alignTime>d.state.inputDelay,'A safe crossing should allow an alignment phase before boosting');
"""+a;assert a in s;s=s.replace(a,b);p.write_text(s)
