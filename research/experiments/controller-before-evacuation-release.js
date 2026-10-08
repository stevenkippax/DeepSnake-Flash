/* Reads the local Unity client's predicted state; sends ordinary mouse movement.
   It never writes game memory, scores, physics, rewards, or network packets.
   Runtime addresses are discovered from the current client before installation. */
(() => {
  window.__snakeWorldPilot && (window.__snakeWorldPilot.running = false);
  const oldController = window.__snakeWorldController;
  oldController?.stop();
  const R = window.__snakeReader, M = unityInstance.Module;
  const registry = window.__snakeRuntime?.registry ?? 53628928;
  const state = { running: true, ticks: oldController?.ticks ?? 0, best: oldController?.best ?? 0, runs: oldController?.runs ?? [], firstWaiting:oldController?.firstWaiting, goalObserved: !!oldController?.goalObserved, status: 'waiting' };
  for(const key of ['dyingFlagFrames','firstDyingFlag','maxScoreWithDyingFlag','dashFrames','boostEpisodes','navigationEvents','interceptsStarted','modeCounts','evacuationEvents','journal','journalAt'])if(oldController?.[key]!==undefined)state[key]=oldController[key];
  window.__snakeWorldController = state;
  function boost(active) {
    if (!!state.boosting === active) return;
    const canvas = document.getElementById('unity-canvas');
    const rect = canvas.getBoundingClientRect(), angle = previousAngle ?? state.last?.command ?? 0;
    const clientX = rect.x + rect.width / 2 + 220 * Math.cos(angle), clientY = rect.y + rect.height / 2 - 220 * Math.sin(angle);
    canvas.dispatchEvent(new MouseEvent(active ? 'mousedown' : 'mouseup', { clientX, clientY, bubbles: true, button: 0, buttons: active ? 1 : 0 }));
    state.boosting = active;
    if(active)state.boostEpisodes=(state.boostEpisodes??0)+1;
  }
  state.stop = () => { boost(false); state.running = false; cancelAnimationFrame(state.frame); };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const f = p => M.HEAPF32[p >>> 2], u = p => M.HEAPU32[p >>> 2];
  const byte = p => M.HEAPU8[p];
  const boundedTurn = (a, heading) => heading + Math.max(-Math.PI + .12, Math.min(Math.PI - .12, wrap(a - heading)));
  const commandHistory = (oldController?.trace ?? []).slice(-35).filter(r => Number.isFinite(r.timestamp)).map(r => ({t:r.timestamp,angle:r.command}));
  function delayedCommand(future, heading, command) {
    if (future >= state.inputDelay) return command;
    const when = state.now + future - state.inputDelay;
    for (let i=commandHistory.length-1;i>=0;i--) if(commandHistory[i].t<=when) return commandHistory[i].angle;
    return heading;
  }
  let last=0, previousPlayer=0, previousAngle=null;
  const currentPlayer=u(registry+12);
  if (currentPlayer && currentPlayer===oldController?.last?.player && u(window.__snakeRuntime.core+12)===0) {
    previousPlayer=currentPlayer; previousAngle=oldController.last.command; state.runStart=oldController.runStart;
  }
  let target = null, foodRefresh = 0, cachedFood = [], pathRefresh = 0, path = [];
  let orbit = currentPlayer===oldController?.last?.player ? oldController.orbit ?? null : null;
  let refuge=null,refugeUntil=0,evacuation=currentPlayer===oldController?.last?.player?oldController.evacuation??null:null;
  let hunt=null, navigation=null, navigationRefresh=0, exploration=null, explorationUntil=0, lastGainAt=0, progressScore=0, exploreUntil=0;
  const visited=new Map();let visitRefresh=0;
  const topology=window.__snakeTopology;let arenaLimit=window.__snakeRuntime?.arenaLimit??46;
  function endpointArea(route) {return navigation && topology ? topology.regionAt(navigation.future,route.px,route.py)?.area ?? 0 : 8281;}
  function headAt(head,t) {
    if(!head.trail?.length)return {x:head.x+head.vx*t,y:head.y+head.vy*t};
    for(let i=1;i<head.trail.length;i++)if(head.trail[i].t>=t) {
      const a=head.trail[i-1],b=head.trail[i],q=(t-a.t)/(b.t-a.t);return {x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q};
    }
    return head.trail.at(-1);
  }
  function attackObstacles(obs,enemy) {
    return obs.map(o=>o.head && o.enemy===enemy?{...o,radius:(o.radius-1.7)+.35+Math.hypot(o.vx,o.vy)*state.inputDelay}:o);
  }
  function pickIntercept(x,y,heading,baseSpeed,yaw,obs,radius,length) {
    let best=null;const diagnostics={eligibleHeads:0,geometry:0,arrival:0,tail:0,safe:0};
    for(const head of obs) {
      if(!head.head || head.score<50 || head.invincible)continue;
      diagnostics.eligibleHeads++;
      const v=Math.hypot(head.vx,head.vy);
      if(v<1 || Math.hypot(head.x-x,head.y-y)-head.radius<4.5)continue;
      for(const tau of [1.2,1.5,1.8,2.1,2.5,3,3.6]) {
        if(head.predictedBarrierTime && tau>=head.predictedBarrierTime-.2)continue;
        const at=headAt(head,tau),next=headAt(head,tau+.1),cx=at.x,cy=at.y;
        const distance=Math.hypot(cx-x,cy-y),angle=Math.atan2(cy-y,cx-x),turn=Math.abs(wrap(angle-heading));
        if(turn>2.9 || Math.abs(Math.sin(angle-Math.atan2(next.y-cy,next.x-cx)))<.75)continue;
        diagnostics.geometry++;
        const alignTime=state.inputDelay+turn/yaw,boostSeconds=1.5;
        const arrival=alignTime+(distance<=baseSpeed*2*boostSeconds?distance/(baseSpeed*2):boostSeconds+(distance-baseSpeed*2*boostSeconds)/baseSpeed);
        const lead=Math.max(.35,(head.radius-1.7+.5)/v);
        if(arrival>tau-lead)continue;
        diagnostics.arrival++;
        const remainingFast=Math.max(0,Math.min(tau,boostSeconds+alignTime)-arrival);
        const afterCross=remainingFast*baseSpeed*2+Math.max(0,tau-Math.max(arrival,boostSeconds+alignTime))*baseSpeed;
        if(length<afterCross+2*radius)continue;
        diagnostics.tail++;
        const waypoint={x:cx+Math.cos(angle)*6,y:cy+Math.sin(angle)*6};
        const preview=route(x,y,heading,angle,baseSpeed*2,yaw,attackObstacles(obs,head.enemy),radius,waypoint,null,{startDelay:alignTime,before:baseSpeed,until:boostSeconds+alignTime,after:baseSpeed});
        if(preview.hit<2.35 || preview.minimum<.4 || topology?.dangerAt(waypoint.x,waypoint.y,obs).length)continue;
        diagnostics.safe++;
        const value=head.score/(tau+.5)+Math.min(3,preview.minimum)*50;
        if(!best||value>best.value)best={enemy:head.enemy,enemyScore:head.score,angle,waypoint,cross:{x:cx,y:cy},tau,arrival,lead,alignTime,boostSeconds,minimum:preview.minimum,value};
      }
    }
    state.huntDiagnostics=diagnostics;return best;
  }
  function pickOrbit(x,y,heading,length,obs,radius) {
    const maximum=Math.min(20,length/(3*Math.PI));
    if(maximum<2) return null;
    let best=null;
    for(const r of [...new Set([maximum,Math.min(maximum,8),Math.min(maximum,5),Math.min(maximum,3)])]) {
    for(const sign of [-1,1]) {
      const cx=x-sign*Math.sin(heading)*r,cy=y+sign*Math.cos(heading)*r;
      if(Math.max(Math.abs(cx),Math.abs(cy))+r+radius>44)continue;
      let minimum=Infinity;
      for(let i=0;i<48;i++)minimum=Math.min(minimum,clearance(cx+r*Math.cos(i*Math.PI/24),cy+r*Math.sin(i*Math.PI/24),0,obs,radius));
      if(minimum<.8)continue;
      const victims=obs.filter(o=>o.head && o.score>=50 && !o.invincible && Math.hypot(o.x-cx,o.y-cy)<r-1).map(o=>o.enemy);
      if(!victims.length)continue;
      const trapped=victims.length;
      const score=trapped*30+r*2+Math.min(8,minimum)-Math.hypot(cx,cy)*.1;
      if(!best||score>best.score)best={cx,cy,r,sign,score,minimum,angle:Math.atan2(y-cy,x-cx),sweep:0,victims,started:state.now*1000,lastProgress:state.now*1000};
    }
    }
    return best;
  }
  function predatorRisk(x,y,obs) {
    let risk=0;
    for(const o of obs)if(o.head) {
      // Surrounding ability depends on available body length, not our score.
      const length=o.length??((o.tailSeconds??0)-.3)*5;
      if(length<20 && o.score<500)continue;
      const range=Math.max(8,Math.min(18,length>0?length/Math.PI:12));
      risk+=Math.max(0,range-(Math.hypot(o.x-x,o.y-y)-o.radius));
    }
    return risk;
  }
  function pickExplore(x,y,heading,speed,yaw,obs,radius) {
    let best=null;
    for(let i=-8;i<=8;i++) {
      const angle=boundedTurn(heading+i*Math.PI/8,heading);
      const point={x:Math.max(-42,Math.min(42,x+Math.cos(angle)*14)),y:Math.max(-42,Math.min(42,y+Math.sin(angle)*14))};
      if(Math.hypot(point.x-x,point.y-y)<6 || topology?.dangerAt(point.x,point.y,obs).length)continue;
      const preview=route(x,y,heading,angle,speed,yaw,obs,radius,point);
      const area=endpointArea(preview),recent=visited.get(Math.floor(point.x/6)+','+Math.floor(point.y/6));
      const revisited=recent===undefined?0:Math.max(0,30-(state.now-recent));
      const value=preview.hit*1000000-predatorRisk(preview.px,preview.py,obs)*1000+(area>=80?100000:area*1000)+Math.min(4,preview.minimum)*30-revisited*10-Math.abs(wrap(angle-heading))*4;
      if(!best||value>best.value)best={...point,value,preview};
    }
    return best;
  }
  function predictor(player) { return u(u(u(player + 212) + 12) + 368); }
  function food() {
    const result = [];
    for (const row of window.__snakePelletRenderers) {
      const dict = u(row.p + 44), entries = u(dict + 12);
      const count = Math.min(10000, u(dict + 16));
      for (let i = 0; i < count; i++) {
        const entry = entries + 16 + i * 16;
        if (M.HEAP32[entry >>> 2] < 0) continue;
        const value = u(entry + 12), collectible = u(value + 12);
        if (!value || !collectible || byte(collectible + 8) || byte(collectible + 9) || byte(collectible + 10)) continue;
        const render = u(value + 8), x = f(render + 8), y = f(render + 12), scale = f(render + 20);
        if (Number.isFinite(x + y) && Math.abs(x) < 50 && Math.abs(y) < 50)
          result.push({ id: value, x, y, scale });
      }
    }
    return result;
  }
  const bodyMargin=(speed,delay)=>Math.max(1.5,Math.min(2,speed*delay+.4));
  function predictHead(x,y,vx,vy,targetX,targetY,yaw) {
    const speed=Math.hypot(vx,vy),target=Math.hypot(targetX,targetY)>.5?Math.atan2(targetY,targetX):Math.atan2(vy,vx);
    let angle=Math.atan2(vy,vx);const points=[{x,y,t:0}];
    for(let i=1;i<=80;i++) {
      const delta=wrap(target-angle);angle+=Math.max(-yaw*.1,Math.min(yaw*.1,delta));
      x+=Math.cos(angle)*speed*.1;y+=Math.sin(angle)*speed*.1;points.push({x,y,t:i*.1});
    }
    return points;
  }
  function bodyGap(o,x,y) {
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
  function obstacles(player, x, y, ownRadius, speed) {
    const list = u(registry + 16), array = u(list + 8), count = Math.min(100, u(list + 12));
    const result = [];
    for (let i = 0; i < count; i++) {
      const enemy = u(array + 16 + i * 4);
      if (enemy === player || !enemy) continue;
      const pre = predictor(enemy);
      if (!pre) continue;
      const physicalRadius=ownRadius+.258*f(pre+52);
      const radius = physicalRadius + bodyMargin(speed,state.inputDelay);
      const hx = f(pre + 56), hy = f(pre + 60);
      if (Number.isFinite(hx+hy) && Math.abs(hx)<55 && Math.abs(hy)<55) {
        const vx=f(pre+68)*f(pre+24)*f(pre+48),vy=f(pre+72)*f(pre+24)*f(pre+48);
        result.push({x:hx,y:hy,radius:physicalRadius+1.7,vx,vy,trail:predictHead(hx,hy,vx,vy,f(pre+32),f(pre+36),f(pre+28)*Math.PI/180),head:true,enemy,physical:physicalRadius-ownRadius,boss:!!byte(enemy+68),score:u(enemy+64),maxSpeed:2*f(pre+24),invincible:!!byte(enemy+70)});
      }
      const bodies = u(pre + 180), items = u(bodies + 8), size = Math.min(500, u(bodies + 12));
      const head=result.find(o=>o.head&&o.enemy===enemy);if(head){head.length=size*f(pre+8)*f(pre+52);head.tailSeconds=head.length/Math.max(1,f(pre+24))+.3;}
      const points=[];
      for (let j = 0; j < size; j++) {
        const body = u(items + 16 + j * 4);
        if (!body) continue;
        const bx = f(body + 12), by = f(body + 16);
        if (!Number.isFinite(bx+by) || Math.abs(bx)>55 || Math.abs(by)>55) continue;
        points.push({x:bx,y:by,ttl:(size-j)*f(pre+8)*f(pre+52)/Math.max(1,f(pre+24))});
      }
      result.push(...bodySegments(points,radius,physicalRadius-ownRadius,enemy));
    }
    if(topology?.clipTrails) {
      const ownPre=predictor(player),ownBodies=u(ownPre+180),ownItems=u(ownBodies+8),ownSize=Math.min(500,u(ownBodies+12));
      const bodies=result.filter(o=>!o.head);
      for(let j=0;j<ownSize;j++) {
        const part=u(ownItems+16+j*4);if(!part)continue;
        bodies.push({x:f(part+12),y:f(part+16),physical:ownRadius,enemy:player,ttl:(ownSize-j)*f(ownPre+8)*f(ownPre+52)/Math.max(1,f(ownPre+24))});
      }
      const started=performance.now();state.clippedTrajectories=topology.clipTrails(result.filter(o=>o.head),bodies);state.motionComputeMs=performance.now()-started;
    }
    return result;
  }
  function clearance(x, y, t, obs, radius) {
    let value = arenaLimit - radius - Math.max(Math.abs(x), Math.abs(y));
    for (const o of obs) {
      if(!o.head && o.ttl!==undefined && t>o.ttl+.25)continue;
      if(!o.head || t===0)value = Math.min(value, bodyGap(o,x,y));
      if (o.head && t < .7) {
        value = Math.min(value, Math.hypot(x - o.x, y - o.y) - o.radius - Math.hypot(o.vx, o.vy) * t);
      }
      if(o.head && t>0) {
        if(topology?.headClearance)value=Math.min(value,topology.headClearance(o,x,y,t));
        else {
          const dx=o.vx*t,dy=o.vy*t,den=dx*dx+dy*dy;
          const q=den?Math.max(0,Math.min(1,((x-o.x)*dx+(y-o.y)*dy)/den)):0;
          value=Math.min(value,Math.hypot(x-o.x-q*dx,y-o.y-q*dy)-o.radius-.2*Math.min(t,1));
        }
      }
    }
    return value;
  }
  function escape(x, y, heading, speed, yaw, obs, radius) {
    let best = null;
    const initial = clearance(x, y, 0, obs, radius);
    for (let i = -18; i <= 18; i++) {
      const command = boundedTurn(heading + i * Math.PI / 18, heading);
      let px = x, py = y, angle = heading, exit = 2.5, worst = initial, end = initial;
      for (let t = .05; t <= 2.5; t += .05) {
        const delta = wrap(delayedCommand(t, heading, command) - angle);
        angle += Math.max(-yaw * .05, Math.min(yaw * .05, delta));
        px += Math.cos(angle) * speed * .05; py += Math.sin(angle) * speed * .05;
        end = clearance(px, py, t, obs, radius); worst = Math.min(worst, end);
        if (end > .8) { exit = t; break; }
      }
      const hardRisk = Math.max(0, Math.min(initial, -.6) - worst);
      const score = -hardRisk*1000000 + (2.5 - exit) * 1000 + (end - initial) * 60 + (worst - initial) * 40 - Math.abs(wrap(command - heading));
      if (!best || score > best.score) best = { angle: command, score, minimum: worst, hit: exit, escaping: true, px, py };
    }
    return best;
  }
  function findPath(x, y, heading, obs, radius, foods,insideSealedPocket=false) {
    const currentHazards=insideSealedPocket?new Set(topology?.dangerAt(x,y,obs).map(o=>o.enemy)??[]):null;
    const step = .5, width = 85, half = 42, total = width * width;
    const ox = Math.round(x / step) * step - half * step;
    const oy = Math.round(y / step) * step - half * step;
    const clear = new Float32Array(total), distance = new Float64Array(total);
    const parent = new Int32Array(total); distance.fill(Infinity); parent.fill(-1);
    for (let row = 0; row < width; row++) for (let col = 0; col < width; col++)
      clear[row * width + col] = arenaLimit - radius - Math.max(Math.abs(ox + col * step), Math.abs(oy + row * step));
    for (const o of obs) {
      const reach = o.radius + 1.7;
      const lx = Math.max(0, Math.ceil((Math.min(o.x,o.x2??o.x) - reach - ox) / step));
      const hx = Math.min(width - 1, Math.floor((Math.max(o.x,o.x2??o.x) + reach - ox) / step));
      const ly = Math.max(0, Math.ceil((Math.min(o.y,o.y2??o.y) - reach - oy) / step));
      const hy = Math.min(width - 1, Math.floor((Math.max(o.y,o.y2??o.y) + reach - oy) / step));
      for (let row = ly; row <= hy; row++) for (let col = lx; col <= hx; col++) {
        const index = row * width + col;
        clear[index] = Math.min(clear[index], bodyGap(o,ox+col*step,oy+row*step));
      }
    }
    const start = half * width + half, heap = [];
    function push(index, cost) {
      let i = heap.length; heap.push({ index, cost });
      while (i > 0) { const p = (i - 1) >>> 1; if (heap[p].cost <= cost) break; heap[i] = heap[p]; i = p; }
      heap[i] = { index, cost };
    }
    function pop() {
      const first = heap[0], last = heap.pop(); if (!heap.length) return first;
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
        if (last.cost <= heap[child].cost) break; heap[i] = heap[child]; i = child;
      }
      heap[i] = last; return first;
    }
    distance[start] = 0; push(start, 0);
    const directions = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    while (heap.length) {
      const node = pop(); if (node.cost !== distance[node.index] || node.cost > 45) continue;
      const row = Math.floor(node.index / width), col = node.index % width;
      for (const [dc, dr] of directions) {
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= width || nc < 0 || nc >= width) continue;
        const index = nr * width + nc;
        if (clear[index] < -.25 || (dc && dr && (clear[row * width + nc] < -.25 || clear[nr * width + col] < -.25))) continue;
        const cost = node.cost + step * Math.hypot(dc, dr) * (1 + 2 / Math.max(.25, clear[index] + .7));
        if (cost < distance[index]) { distance[index] = cost; parent[index] = node.index; push(index, cost); }
      }
    }
    const bins=new Map(), key=(a,b)=>a+','+b;
    for(const item of foods){const k=key(Math.floor(item.x/3),Math.floor(item.y/3));bins.set(k,(bins.get(k)??0)+(item.scale>.07?8:1));}
    let goal = null, best = Infinity, goalIndex = -1;
    for (const item of foods) {
      const col = Math.round((item.x - ox) / step), row = Math.round((item.y - oy) / step);
      if (col < 1 || row < 1 || col >= width - 1 || row >= width - 1) continue;
      const index = row * width + col;
      if (index === start || clear[index] < -.15 || distance[index] > 40) continue;
      const value = item.scale > .07 ? 8 : 1;
      const bx=Math.floor(item.x/3),by=Math.floor(item.y/3);let density=0;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)density+=(bins.get(key(bx+dx,by+dy))??0)/(1+dx*dx+dy*dy);
      const turnCost=2*Math.abs(wrap(Math.atan2(item.y-y,item.x-x)-heading));
      const clusterValue=value*(1+Math.min(5,Math.sqrt(density)/6));
      const cost = (distance[index] + .8 + turnCost) / clusterValue - (target?.id === item.id ? .15 : 0);
      if (cost < best && (insideSealedPocket?topology?.dangerAt(item.x,item.y,obs).every(o=>currentHazards.has(o.enemy)):!topology?.dangerAt(item.x,item.y,obs).length)) { best = cost; goal = item; goalIndex = index; }
    }
    if (!goal) return { target: null, path: [] };
    const result = [], seen = new Set();
    for (let index = goalIndex; index !== start && index >= 0 && !seen.has(index); index = parent[index]) {
      seen.add(index); result.push({ x: ox + index % width * step, y: oy + Math.floor(index / width) * step });
    }
    result.reverse(); result.push({ x: goal.x, y: goal.y });
    return { target: goal, path: result };
  }
  function orbitPoint(px,py,loop) {
    const theta=Math.atan2(py-loop.cy,px-loop.cx)+loop.sign*Math.min(.4,1.5/loop.r);
    return {x:loop.cx+loop.r*Math.cos(theta),y:loop.cy+loop.r*Math.sin(theta)};
  }
  function pathPoint(x,y,points) {
    let nearest=0,distance=Infinity;
    for(let i=0;i<points.length;i++) {
      const d=Math.hypot(points[i].x-x,points[i].y-y);
      if(d<distance){distance=d;nearest=i;}
    }
    return points[Math.min(points.length-1,nearest+2)];
  }
  function route(x, y, heading, command, speed, yaw, obs, radius, goal, guide=null, speedProfile=null) {
    let px = x, py = y, angle = heading, minimum = 100, hit = 2.4, risk = 0;
    let goalDistance = goal ? Math.hypot(goal.x - x, goal.y - y) : 0;
    for (let t = .08; t <= 2.4; t += .08) {
      let desired = delayedCommand(t, heading, command);
      if(guide && t>state.inputDelay+.16) {
        const point=guide.kind==='path'?pathPoint(px,py,guide.points):orbitPoint(px,py,guide);
        desired=Math.atan2(point.y-py,point.x-px);
      }
      const delta = wrap(desired - angle);
      angle += Math.max(-yaw * .08, Math.min(yaw * .08, delta));
      const stepSpeed=speedProfile && t<(speedProfile.startDelay??0)?speedProfile.before:speedProfile && t>speedProfile.until?speedProfile.after:speed;
      px += Math.cos(angle) * stepSpeed * .08;
      py += Math.sin(angle) * stepSpeed * .08;
      const d = clearance(px, py, t, obs, radius);
      minimum = Math.min(minimum, d);
      risk += Math.max(0, 1.4 - d) * Math.exp(-t);
      if (goal) goalDistance = Math.min(goalDistance, Math.hypot(goal.x - px, goal.y - py));
      if (d < -.25) { hit = t; break; }
    }
    return { minimum, hit, risk, goalDistance, px, py };
  }
  function beamPlan(x,y,heading,speed,yaw,obs,radius,goal,guide=null) {
    const horizon=2.4,dt=.06,chunk=.30;
    const local=obs.filter(o=>o.head?Math.hypot(o.x-x,o.y-y)<(speed+Math.hypot(o.vx,o.vy))*horizon+o.radius+2:bodyGap(o,x,y)<speed*horizon+2);
    const initial=clearance(x,y,0,local,radius),floor=Math.min(-.35,initial-.25);
    let root={x,y,angle:heading,t:0,minimum:initial,risk:0,first:null,goalDistance:goal?Math.hypot(goal.x-x,goal.y-y):0,sequence:[]};
    // Committed input is shared by every candidate. Future decisions cannot undo it.
    while(root.t<state.inputDelay-1e-6) {
      const step=Math.min(dt,state.inputDelay-root.t),t=root.t+step;
      const delta=wrap(delayedCommand(t-1e-7,heading,heading)-root.angle);
      root.angle+=Math.max(-yaw*step,Math.min(yaw*step,delta));
      root.x+=Math.cos(root.angle)*speed*step;root.y+=Math.sin(root.angle)*speed*step;root.t=t;
      const d=clearance(root.x,root.y,t,local,radius);root.minimum=Math.min(root.minimum,d);root.risk+=Math.max(0,1.4-d)*step;
    }
    const admissibleFloor=Math.min(floor,root.minimum-.05);
    let beam=[root];
    while(beam.length && beam[0].t<horizon-1e-6) {
      const generated=[];
      for(const parent of beam) {
        const reference=guide?(guide.kind==='path'?pathPoint(parent.x,parent.y,guide.points):orbitPoint(parent.x,parent.y,guide)):goal;
        const goalAngle=reference?Math.atan2(reference.y-parent.y,reference.x-parent.x):heading;
        const commands=[...[-2.4,-1.2,-.6,0,.6,1.2,2.4].map(d=>boundedTurn(parent.angle+d,parent.angle)),boundedTurn(goalAngle,parent.angle)];
        if(parent.first===null && previousAngle!==null)commands.push(boundedTurn(previousAngle,parent.angle));
        for(const command of commands) {
          const next={...parent,first:parent.first??command,sequence:[...parent.sequence,{t:parent.t,angle:command}]};
          const until=Math.min(horizon,parent.t+chunk);let rejected=false;
          while(next.t<until-1e-6) {
            const step=Math.min(dt,until-next.t),t=next.t+step,delta=wrap(command-next.angle);
            next.angle+=Math.max(-yaw*step,Math.min(yaw*step,delta));
            next.x+=Math.cos(next.angle)*speed*step;next.y+=Math.sin(next.angle)*speed*step;next.t=t;
            const d=clearance(next.x,next.y,t,local,radius);next.minimum=Math.min(next.minimum,d);next.endClear=d;
            next.risk+=Math.max(0,1.4-d)*step*Math.exp(-t*.4);
            if(goal)next.goalDistance=Math.min(next.goalDistance,Math.hypot(goal.x-next.x,goal.y-next.y));
            if(d<admissibleFloor){rejected=true;break;}
          }
          if(rejected)continue;
          const distance=next.goalDistance;
          const area=navigation && !navigation.confined?endpointArea({px:next.x,py:next.y}):null;
          const space=area===null?0:area>=Math.max(80,navigation.largestAccessibleFutureArea*.3)?1000:Math.min(999,area);
          // Safety precedes progress. Continuity applies to the command sent now.
          next.value=space-predatorRisk(next.x,next.y,local)*1000+Math.min(2,next.minimum)*60+Math.min(3,next.endClear)*8-next.risk*12-distance*8-Math.abs(wrap(next.first-(previousAngle??heading)))*2;
          if(next.t>=horizon-1e-6 && topology?.dangerAt(next.x,next.y,obs).length)next.value-=500000;
          generated.push(next);
        }
      }
      generated.sort((a,b)=>b.value-a.value);
      const cells=new Set();beam=[];
      for(const next of generated) {
        const key=Math.round(next.x/.65)+','+Math.round(next.y/.65)+','+Math.round(wrap(next.angle)/.5);
        if(cells.has(key))continue;cells.add(key);beam.push(next);if(beam.length>=24)break;
      }
    }
    const best=beam[0];
    return best?{angle:best.first,minimum:best.minimum,hit:horizon,risk:best.risk,goalDistance:best.goalDistance,px:best.x,py:best.y,endClear:best.endClear,beam:true,sequence:best.sequence}:null;
  }
  // Independent safety filter. The task planner proposes a move; this search
  // requires a continuation, using original obstacles even during an attack.
  // A full-horizon result is conditional on the model, not an invulnerability claim.
  function safetyPlan(x,y,heading,speed,yaw,obs,radius,proposed,goal,guide=null,queuedSpeed=speed,emergency=false) {
    const horizon=emergency?3:6,dt=emergency?.05:.1,chunk=emergency?.15:.5;
    const initialOwners=new Set((topology?.dangerAt(x,y,obs)??[]).map(o=>o.enemy));
    const local=obs.filter(o=>o.head?Math.hypot(o.x-x,o.y-y)<(speed+(o.maxSpeed??10))*horizon+o.radius+2:bodyGap(o,x,y)<speed*horizon+3);
    const heads=local.filter(o=>o.head),cell=4,key=(x,y)=>x+','+y;
    function binsFor(capsules) {
      const bins=new Map();
      for(const o of capsules) {
        const reach=o.radius+1;
        for(let cy=Math.floor((Math.min(o.y,o.y2??o.y)-reach)/cell);cy<=Math.floor((Math.max(o.y,o.y2??o.y)+reach)/cell);cy++)for(let cx=Math.floor((Math.min(o.x,o.x2??o.x)-reach)/cell);cx<=Math.floor((Math.max(o.x,o.x2??o.x)+reach)/cell);cx++) {
          const k=key(cx,cy);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);
        }
      }
      return bins;
    }
    const bodyBins=binsFor(local.filter(o=>!o.head));
    const futureBins=Array.from({length:61},(_,k)=>{
      const capsules=[],when=k*.1;
      for(const o of heads) {
        const parts=topology?.headSegments?topology.headSegments({...o,tailSeconds:(o.tailSeconds??Infinity)+.1},when):[{x:o.x,y:o.y,dx:o.vx*when,dy:o.vy*when}];
        let last=null;
        for(const part of parts) {
          const end={x:part.x+part.dx,y:part.y+part.dy};
          const dx=last?last.x2-last.x:0,dy=last?last.y2-last.y:0;
          if(last&&Math.hypot(last.x2-part.x,last.y2-part.y)<.001&&Math.abs(dx*part.dy-dy*part.dx)<.001&&dx*part.dx+dy*part.dy>=0){last.x2=end.x;last.y2=end.y;}
          else {last={x:part.x,y:part.y,x2:end.x,y2:end.y,radius:o.radius+.2*Math.min(when,1)+Math.min(3,when*.4)+(o.maxSpeed??10)*.1};capsules.push(last);}
        }
      }
      return binsFor(capsules);
    });
    function safeClear(px,py,t) {
      let d=Math.min(1,arenaLimit-radius-Math.max(Math.abs(px),Math.abs(py)));
      const k=key(Math.floor(px/cell),Math.floor(py/cell));
      for(const o of bodyBins.get(k)??[])d=Math.min(d,bodyGap(o,px,py));
      if(t>0)for(const o of futureBins[Math.min(60,Math.ceil(t*10-1e-7))].get(k)??[])d=Math.min(d,bodyGap(o,px,py));
      if(t<=.65)for(const o of heads)d=Math.min(d,Math.hypot(px-o.x,py-o.y)-o.radius-(o.maxSpeed??Math.max(10,Math.hypot(o.vx,o.vy)))*t);
      return d-.15;
    }
    const initial=safeClear(x,y,0);let floor=Math.min(0,initial-.05);
    let root={x,y,angle:heading,t:0,minimum:initial,first:null,sequence:[],goalDistance:goal?Math.hypot(goal.x-x,goal.y-y):0};
    function advance(parent,command,until,queued=false,recover=false) {
      const next={...parent,sequence:parent.sequence,first:parent.first??command};
      while(next.t<until-1e-6) {
        const step=Math.min(queued?.02:dt,until-next.t),when=next.t+step;
        const desired=queued?delayedCommand(when-1e-7,heading,command):command;
        const moveSpeed=queued?queuedSpeed:speed;
        const delta=wrap(desired-next.angle),sign=Math.sign(delta),turnTime=Math.min(step,Math.abs(delta)/yaw),oldAngle=next.angle;
        next.angle+=sign*yaw*turnTime;
        if(turnTime>1e-8) {next.x+=moveSpeed*(Math.sin(next.angle)-Math.sin(oldAngle))/(sign*yaw);next.y+=moveSpeed*(Math.cos(oldAngle)-Math.cos(next.angle))/(sign*yaw);}
        next.x+=Math.cos(next.angle)*moveSpeed*(step-turnTime);next.y+=Math.sin(next.angle)*moveSpeed*(step-turnTime);next.t=when;
        const d=safeClear(next.x,next.y,when);next.minimum=Math.min(next.minimum,d);
        if(goal)next.goalDistance=Math.min(next.goalDistance,Math.hypot(goal.x-next.x,goal.y-next.y));
        if(d<floor){next.failed=true;if(!queued && !recover)break;}
      }
      return next;
    }
    root=advance(root,heading,state.inputDelay,true);root.first=null;
    const queuedUnsafe=!!root.failed;delete root.failed;floor=Math.min(floor,root.minimum-.05);
    // If already committed to danger, still choose the longest survival route.
    // The filter never fabricates a safe option when every continuation fails.
    let beam=[root],survivors=[],fallback=null,expanded=0;
    while(beam.length && beam[0].t<horizon-1e-6) {
      const generated=[];
      for(const parent of beam) {
        const ref=guide?(guide.kind==='path'?pathPoint(parent.x,parent.y,guide.points):orbitPoint(parent.x,parent.y,guide)):goal;
        const toward=ref?Math.atan2(ref.y-parent.y,ref.x-parent.x):heading;
        const controls=parent.first===null?[proposed,heading,...Array.from({length:16},(_,i)=>boundedTurn(heading+(i-8)*Math.PI/8,heading))]:[parent.angle,parent.angle-1.2,parent.angle+1.2,parent.angle-2.4,parent.angle+2.4,toward];
        for(const command of controls) {
          const next=advance(parent,command,Math.min(horizon,parent.t+(parent.first===null?(emergency?.1:.25):chunk)));expanded++;
          next.sequence=[...parent.sequence,{t:parent.t,angle:command}];
          const terminalThreats=next.t>=horizon-1e-6?(topology?.dangerAt(next.x,next.y,obs)??[]):[];
          const wrapped=emergency?terminalThreats.length>0:terminalThreats.some(o=>!initialOwners.has(o.enemy));
          const danger=predatorRisk(next.x,next.y,local);
          const progress=ref?Math.hypot(ref.x-next.x,ref.y-next.y):next.goalDistance;
          next.value=(wrapped?-100000:0)-(emergency?0:terminalThreats.length)*20000-danger*150+Math.min(.8,next.minimum)*10000-progress*5-Math.abs(wrap(next.first-proposed))*2;
          if(next.failed) {
            if(!fallback||next.t>fallback.t+.05||Math.abs(next.t-fallback.t)<=.05&&next.minimum>fallback.minimum)fallback=next;
          } else generated.push(next);
        }
      }
      generated.sort((a,b)=>b.value-a.value);
      const cells=new Set(),firstCounts=new Map();beam=[];
      for(const next of generated) {
        const first=Math.round(wrap(next.first)/.4),key=Math.round(next.x)+','+Math.round(next.y)+','+Math.round(wrap(next.angle)/.7)+','+first;
        if(cells.has(key)||(firstCounts.get(first)??0)>=4)continue;
        cells.add(key);firstCounts.set(first,(firstCounts.get(first)??0)+1);beam.push(next);if(beam.length>=18)break;
      }
      if(beam[0]?.t>=horizon-1e-6)survivors=beam;
    }
    if((!survivors.length || queuedUnsafe || survivors[0].minimum<0) && !emergency && obs.some(o=>!o.head && Number.isFinite(o.physical))) {
      // Emergency tier preserves actual body geometry plus a reserve. It is
      // invoked only after every full-buffer continuation has failed.
      const actual=obs.map(o=>!o.head && Number.isFinite(o.physical)?{...o,radius:o.physical+radius+.35}:o);
      const rescue=safetyPlan(x,y,heading,speed,yaw,actual,radius,proposed,goal,guide,queuedSpeed,true);
      return {...rescue,safeContinuation:false,emergencyContinuation:rescue.safeContinuation,emergencyMinimum:rescue.minimum,nominalMinimum:root.minimum};
    }
    const nearProposed=survivors.filter(n=>Math.abs(wrap(n.first-proposed))<.12 && n.minimum>=Math.min(.6,(survivors[0]?.minimum??0)-.15) && !(emergency?topology?.dangerAt(n.x,n.y,obs).length:topology?.dangerAt(n.x,n.y,obs).some(o=>!initialOwners.has(o.enemy))));
    let recovery=null;
    if(!survivors.length && arenaLimit-radius-Math.max(Math.abs(x),Math.abs(y))<queuedSpeed*(state.inputDelay+.5)+.5) {
      // A buffer violation is not a physical impact. Simulate complete turns,
      // rather than comparing candidates after their first rejected step.
      const inward=Math.atan2(-root.y,-root.x);
      for(const command of [inward,proposed,...Array.from({length:32},(_,i)=>heading+i*Math.PI/16)]) {
        const next=advance(root,command,Math.min(horizon,root.t+3),false,true);
        next.sequence=[{t:root.t,angle:command}];
        next.endClearance=safeClear(next.x,next.y,next.t);
        const recovering=next.minimum*10000+next.endClearance*100-Math.hypot(next.x,next.y)*.1;
        if(!recovery || recovering>recovery.recoveryValue)recovery={...next,recoveryValue:recovering};
      }
    }
    const chosen=nearProposed[0]??survivors[0]??recovery??fallback??root;
    return {angle:chosen.first??proposed,minimum:chosen.minimum,hit:chosen.t,px:chosen.x,py:chosen.y,risk:0,goalDistance:chosen.goalDistance,recovery:!!recovery,endClearance:chosen.endClearance,
      safeContinuation:!queuedUnsafe&&survivors.length>0&&chosen.minimum>=0,alternatives:new Set(survivors.map(n=>Math.round(wrap(n.first)/.4))).size,expanded,sequence:chosen.sequence,queuedUnsafe,queuedPosition:{x:root.x,y:root.y,t:root.t}};
  }
  function commitEvacuation(x,y,t,nav,obs=[],speed=5) {
    if(nav.surrounding?.length && nav.escapePath.length && !evacuation) {
      evacuation={origin:{x,y},goal:nav.escapePath.at(-1),path:nav.escapePath,started:t,enemy:nav.escapeEnemies?.length?nav.escapeEnemies:nav.surrounding.map(o=>o.enemy)};
      state.evacuationEvents??=[];state.evacuationEvents.push({event:'begin',score:state.score,t,x,y,goal:evacuation.goal,currentArea:nav.currentArea,surrounding:nav.surrounding});if(state.evacuationEvents.length>40)state.evacuationEvents.shift();
    }
    if(!evacuation)return nav.escapePath;
    if(Math.hypot(evacuation.goal.x-x,evacuation.goal.y-y)<2 && !topology.dangerAt(x,y,obs).some(o=>evacuation.enemy.includes(o.enemy))) {
      state.evacuationEvents??=[];state.evacuationEvents.push({event:'reached-exit',score:state.score,t,x,y,origin:evacuation.origin,currentArea:nav.currentArea,surrounding:nav.surrounding});if(state.evacuationEvents.length>40)state.evacuationEvents.shift();
      evacuation=null;state.evacuation=null;
      if(nav.surrounding?.length && nav.escapePath.length)return commitEvacuation(x,y,t,nav,obs,speed);
      return nav.escapePath;
    }
    const heads=obs.filter(o=>o.head);
    const path=topology.routeTo(nav.current,topology.nearest(nav.current,x,y),i=>i===topology.index(evacuation.goal.x,evacuation.goal.y),(i,when)=>{const p=topology.position(i);return heads.every(o=>topology.headClearance(o,p.x,p.y,when)>=.3);},speed,(state.inputDelay??.15)+.15);
    if(path.length && !topology.dangerAt(evacuation.goal.x,evacuation.goal.y,obs).some(o=>evacuation.enemy.includes(o.enemy))){evacuation.path=path;evacuation.blocked=false;}
    else if(nav.escapePath.length){evacuation.path=nav.escapePath;evacuation.goal=nav.escapePath.at(-1);evacuation.enemy=nav.escapeEnemies?.length?nav.escapeEnemies:nav.surrounding.map(o=>o.enemy);evacuation.blocked=false;}
    else {evacuation.path=[];evacuation.blocked=true;}
    state.evacuation=evacuation;
    return evacuation.path;
  }
  function tick(t) {
    if (!state.running) return;
    state.frame = requestAnimationFrame(tick);
    if (t - last < 40) return;
    last = t; state.now=t/1000;
    const player = u(registry + 12);
    const coreState = u(window.__snakeRuntime.core + 12);
    const unityFocus = window.__snakeFocusGetter ? M.asm.Dk.get(window.__snakeFocusGetter.fn)(window.__snakeFocusGetter.m) : 1;
    if (!player || coreState !== 0 || !byte(u(player + 216) + 30) || location.hash.includes('goog_fullscreen')) {
      state.reason = { coreState, unityFocus, player, dying:player?!!byte(player+69):false, actualScore:player?u(player+64):null, sending: player ? byte(u(player + 216) + 30) : 0, hash: location.hash, t };
      if (state.status === "playing") state.firstWaiting = { ...state.reason, last: state.last, replay:state.replay };
      if (previousPlayer) state.runs.push({ score: state.score, ticks: state.ticks });
      previousPlayer = 0; target = null; previousAngle = null; path = []; orbit=null; hunt=null; navigation=null; navigationRefresh=0; exploration=null;evacuation=null;state.evacuation=null;lastGainAt=0;progressScore=0;exploreUntil=0;visited.clear(); commandHistory.length=0;
      boost(false);state.safetyBoost=false;state.safety=null;state.safetyLast=0;
      state.status = 'waiting'; return;
    }
    const pre = predictor(player);
    if (!pre) return;
    if(byte(player+69)) {
      state.dyingFlagFrames=(state.dyingFlagFrames??0)+1;
      state.firstDyingFlag??={score:u(player+64),t,coreState,sending:byte(u(player+216)+30)};
      state.maxScoreWithDyingFlag=Math.max(state.maxScoreWithDyingFlag??0,u(player+64));
    }
    if(byte(player+204))state.dashFrames=(state.dashFrames??0)+1;
    if (!window.__snakePelletRenderers.length && t - foodRefresh > 1000) R.refreshRenderers?.();
    if (player !== previousPlayer) { previousPlayer = player; state.runStart = t; R.refreshRenderers?.();const measured=R.refreshArena?.();if(measured){window.__snakeRuntime.arena=measured;window.__snakeRuntime.arenaInnerEdge=measured.inner;arenaLimit=window.__snakeRuntime.arenaLimit=Math.floor(measured.inner);} }
    const x = f(pre + 56), y = f(pre + 60), heading = Math.atan2(f(pre + 72), f(pre + 68));
    const scale = f(pre + 52), radius = .258 * scale, actualSpeed = f(pre + 24) * f(pre + 48), baseSpeed=f(pre + 24);
    const speed=state.boosting?Math.max(actualSpeed,baseSpeed*2):actualSpeed;
    const yaw = f(pre + 28) * Math.PI / 180;
    if (!Number.isFinite(x + y + heading + speed) || speed < .1 || speed > 30) return;
    const lag = u(u(player + 32) + 12);
    state.inputDelay = lag ? Math.max(.06, Math.min(.6, f(lag + 36) / 1000 + .02)) : .16;
    const fullObs = obstacles(player, x, y, radius,speed);
    const actualScore=u(player+64);state.score=actualScore;
    if(!lastGainAt || actualScore>progressScore){lastGainAt=t;progressScore=actualScore;}
    if(t-visitRefresh>1000){visited.set(Math.floor(x/6)+','+Math.floor(y/6),state.now);visitRefresh=t;for(const [k,v] of visited)if(state.now-v>60)visited.delete(k);}
    if(t-lastGainAt>20000 && !orbit && !hunt){exploreUntil=t+5000;lastGainAt=t;state.stallRecoveries=(state.stallRecoveries??0)+1;}
    const obs=fullObs.filter(o=>Math.hypot(o.x-x,o.y-y)<(o.head?60:32)+o.radius);
    if(topology && (!navigation || t-navigationRefresh>500)) {
      const started=performance.now();navigation=topology.analyze(x,y,fullObs,radius,baseSpeed,state.inputDelay+.15);navigationRefresh=t;
      state.navigation={currentArea:navigation.currentArea,futureArea:navigation.futureArea,largestAccessibleFutureArea:navigation.largestAccessibleFutureArea,closing:navigation.closing,pinched:navigation.pinched,surrounding:navigation.surrounding,wideArea:navigation.wideArea,wideAccessibleArea:navigation.wideAccessibleArea,confined:navigation.confined,escapePathLength:navigation.escapePath.length,computeMs:performance.now()-started};
    }
    const exitPath=navigation?commitEvacuation(x,y,t,navigation,fullObs,baseSpeed):[];
    const evacuating=!!(evacuation||navigation?.closing||navigation?.pinched||navigation?.surrounding?.length)&&exitPath.length>0;
    const constrained=!!navigation?.waiting&&!evacuating;
    let waitingForExit=constrained;
    const urgent=!!(evacuation||navigation?.closing||navigation?.pinched||navigation?.surrounding?.length);
    if(evacuating||urgent){orbit=null;hunt=null;state.orbitRetry=t+10000;}

    if (t - foodRefresh > 160) { cachedFood = food(); foodRefresh = t; }
    if (t - pathRefresh > 250) {
      const viableFood=navigation && !navigation.confined ? cachedFood.filter(item=>predatorRisk(item.x,item.y,obs)<1 && (topology.regionAt(navigation.future,item.x,item.y)?.area??0)>=Math.max(80,navigation.largestAccessibleFutureArea*.3)):cachedFood;
      const found = findPath(x, y, heading, obs, radius, viableFood,constrained); target = found.target; path = found.path; pathRefresh = t;
    }
    waitingForExit=constrained&&!target;
    let waypoint = target;
    const exploring=t<exploreUntil || !target;
    if(exploring && !evacuating && !waitingForExit) {
      if(!exploration || t>explorationUntil || Math.hypot(exploration.x-x,exploration.y-y)<2) {
        exploration=pickExplore(x,y,heading,speed,yaw,obs,radius);explorationUntil=t+4000;
      }
      waypoint=exploration;path=[];
    } else exploration=null;
    if (path.length) {
      waypoint=pathPoint(x,y,path);
    }
    const bodyLength=u(u(pre+180)+12)*f(pre+8)*scale;
    if(!evacuating && !urgent && !orbit && u(player+64)>=600 && t>(state.orbitRetry??0)) {
      orbit=pickOrbit(x,y,heading,bodyLength,obs,radius);
      state.orbitRetry=t+10000;
    }
    let orbiting=false;
    if(orbit) {
      const theta=Math.atan2(y-orbit.cy,x-orbit.cx);
      const advance=orbit.sign*wrap(theta-orbit.angle);
      orbit.sweep+=advance;orbit.angle=theta;
      if(advance>.01)orbit.lastProgress=t;
      const victimsRemain=obs.some(o=>o.head && orbit.victims?.includes(o.enemy) && Math.hypot(o.x-orbit.cx,o.y-orbit.cy)<orbit.r-1);
      const exhausted=!victimsRemain || t-orbit.started>60000 || t-orbit.lastProgress>3000;
      const harvest=cachedFood.filter(item=>item.scale>.07 && (Math.hypot(item.x-orbit.cx,item.y-orbit.cy)<orbit.r+.5 || Math.hypot(item.x-x,item.y-y)<8));
      const noYield=orbit.sweep>14*Math.PI && cachedFood.every(item=>item.scale<=.07 || Math.hypot(item.x-x,item.y-y)>8);
      if(exhausted || harvest.length>=5 || noYield || Math.hypot(x-orbit.cx,y-orbit.cy)>orbit.r+4) {
        orbit=null;state.orbitRetry=t+15000;
      } else {
        waypoint=orbitPoint(x,y,orbit);
        orbiting=true;
      }
    }
    if(hunt && t>hunt.until)hunt=null;
    if(!evacuating && !urgent && !orbiting && !hunt && !state.boosting && u(player+64)>=100 && t>(state.huntRetry??0)) {
      const huntStarted=performance.now();
      const candidate=pickIntercept(x,y,heading,baseSpeed,yaw,obs,radius,bodyLength);
      state.huntComputeMs=performance.now()-huntStarted;
      if(candidate){hunt={...candidate,alignDeadline:t+(candidate.alignTime+.18)*1000,until:t+(candidate.alignTime+candidate.boostSeconds)*1000};state.interceptsStarted=(state.interceptsStarted??0)+1;}
      state.huntRetry=t+250;
    }
    if(hunt)waypoint=hunt.waypoint;
    let refugePath=[];
    if(waitingForExit && !orbiting && !hunt) {
      const here=topology.regionAt(navigation.current,x,y),there=refuge?topology.regionAt(navigation.current,refuge.x,refuge.y):null;
      if(!refuge || t>refugeUntil || Math.hypot(refuge.x-x,refuge.y-y)<2 || here?.id!==there?.id) {
        refuge=navigation.shelterPath.at(-1)??null;refugeUntil=t+4000;
      }
      if(refuge)refugePath=topology.routeTo(navigation.current,topology.nearest(navigation.current,x,y),i=>i===topology.index(refuge.x,refuge.y));
    } else refuge=null;
    const escapeGuide=evacuating?{kind:'path',points:exitPath}:refugePath.length?{kind:'path',points:refugePath}:null;
    if(evacuating)waypoint=pathPoint(x,y,exitPath);
    else if(refugePath.length)waypoint=pathPoint(x,y,refugePath);
    const desiredBase = waypoint ? Math.atan2(waypoint.y - y, waypoint.x - x) :
      Math.hypot(x, y) > 32 ? Math.atan2(-y, -x) : heading;
    const desired=boundedTurn(desiredBase,heading);
    const guide=escapeGuide ?? (hunt?null:orbiting?orbit:path.length>1?{kind:'path',points:path}:null);
    const planningSpeed=hunt?baseSpeed*2:speed;
    const motionProfile=hunt?{startDelay:hunt.boostStartedAt?0:Math.max(0,(hunt.alignDeadline-t)/1000-.18),before:actualSpeed,until:(hunt.until-t)/1000+state.inputDelay,after:baseSpeed}:null;
    const candidates = [desired, heading, boundedTurn(previousAngle ?? heading,heading)];
    for (let i = -11; i <= 11; i++) candidates.push(heading + i * Math.PI / 12);
    candidates.push(heading-Math.PI+.12,heading+Math.PI-.12);
    const immediateClearance = clearance(x, y, 0, obs, radius);
    const currentOwners=new Set((topology?.dangerAt(x,y,fullObs)??[]).map(o=>o.enemy));
    const retreating=!evacuating && !waitingForExit && !hunt && !orbiting && predatorRisk(x,y,obs)>1;
    const planObs=hunt?attackObstacles(obs,hunt.enemy):obs;
    const desiredRoute = route(x, y, heading, desired, planningSpeed, yaw, planObs, radius, waypoint,guide,motionProfile);
    let best = immediateClearance < .4 ? escape(x, y, heading, speed, yaw, obs, radius) :
      desiredRoute.hit >= 2.35 && desiredRoute.minimum > .05 && !topology?.dangerAt(desiredRoute.px,desiredRoute.py,obs).some(o=>!currentOwners.has(o.enemy)) && (!retreating || predatorRisk(desiredRoute.px,desiredRoute.py,obs)<.5) && (constrained || endpointArea(desiredRoute)>=Math.max(80,(navigation?.largestAccessibleFutureArea??0)*.3)) ? { angle: desired, score: Infinity, ...desiredRoute } : null;
    for (const angle of best ? [] : candidates) {
      const r = route(x, y, heading, angle, planningSpeed, yaw, planObs, radius, waypoint,Math.abs(wrap(angle-desired))<.25?guide:null,motionProfile);
      const regionArea=endpointArea(r);
      const spaceValue=constrained?0:(regionArea>=80?100000:regionArea*1000)+Math.min(400,regionArea)*5;
      const entryTrap=r.hit>=2.35 && topology?.dangerAt(r.px,r.py,obs).some(o=>!currentOwners.has(o.enemy))?500000:0;
      const score = (r.hit>=2.35?10000000:0) + r.hit * 1000000 - entryTrap + spaceValue - (retreating?predatorRisk(r.px,r.py,obs)*1000:0) + Math.min(2, r.minimum) * 8 - r.risk * 5 -
        Math.abs(wrap(angle - desired)) * 20 - Math.abs(wrap(angle - (previousAngle ?? heading))) * .5 -
        (waypoint ? r.goalDistance * 40 : Math.max(0, Math.hypot(r.px, r.py) - 35));
      if (!best || score > best.score) best = { angle, score, ...r };
    }
    if(!hunt && (best.escaping || best.hit<2.35 || best.minimum<.1)) {
      const beamStarted=performance.now(),curved=beamPlan(x,y,heading,speed,yaw,obs,radius,escapeGuide?escapeGuide.points.at(-1):target??waypoint,guide);
      state.beamComputeMs=performance.now()-beamStarted;
      if(curved && curved.minimum>=best.minimum-.05 && (best.escaping || best.hit<2.35 || curved.minimum>=best.minimum)) {
        best=curved;state.beamFrames=(state.beamFrames??0)+1;
      }
    }
    if(!state.safetyLast || t-state.safetyLast>110 || immediateClearance<1) {
      const shieldStarted=performance.now();
      let filtered=safetyPlan(x,y,heading,actualSpeed,yaw,fullObs,radius,best.angle,escapeGuide?escapeGuide.points.at(-1):waypoint,guide);
      state.safetyBoost=false;
      if(state.score>=50 && (evacuating || retreating) && (evacuating || !constrained)) {
        const fast=safetyPlan(x,y,heading,baseSpeed*2,yaw,fullObs,radius,best.angle,escapeGuide?escapeGuide.points.at(-1):waypoint,guide,actualSpeed);
        if(fast.safeContinuation && fast.minimum>=.1 && (!filtered.safeContinuation || fast.minimum>=filtered.minimum-.05)) {filtered=fast;state.safetyBoost=true;}
      }
      state.safety={...filtered,computeMs:performance.now()-shieldStarted};state.safetyLast=t;
      state.safetyOverrides=(state.safetyOverrides??0)+(Math.abs(wrap(filtered.angle-best.angle))>.12?1:0);
      state.safetyAngle=filtered.angle;
      if(!filtered.safeContinuation || Math.abs(wrap(filtered.angle-best.angle))>.12){hunt=null;orbit=null;orbiting=false;state.boostUntil=0;}
    }
    if(state.safety && (Math.abs(wrap(state.safetyAngle-best.angle))>.12 || !state.safety.safeContinuation))best={...best,angle:state.safetyAngle,shield:true};
    previousAngle = best.angle;
    commandHistory.push({t:state.now,angle:best.angle});
    while(commandHistory.length && commandHistory[0].t<state.now-1.5)commandHistory.shift();
    const cruise = route(x,y,heading,best.angle,Math.max(actualSpeed,baseSpeed*2),yaw,obs,radius,waypoint,null,{until:.5+state.inputDelay,after:baseSpeed});
    const aligned=Math.abs(wrap(best.angle-heading))<.30;
    const headFree=obs.filter(o=>o.head).every(o=>Math.hypot(o.x-x,o.y-y)>o.radius+8);
    const foodAhead=cachedFood.filter(item=>Math.hypot(item.x-x,item.y-y)<10 && Math.abs(wrap(Math.atan2(item.y-y,item.x-x)-best.angle))<.45).length;
    const recentStable=commandHistory.slice(-5).every(c=>Math.abs(wrap(c.angle-best.angle))<.25);
    const canBoost=!orbiting && !constrained && u(player+64)>=50 && aligned && recentStable && headFree && immediateClearance>2.5 && cruise.hit>=2.35 && cruise.minimum>1;
    if(canBoost && (foodAhead>=4 || evacuating)) state.boostUntil=t+500;
    const huntBoost=!!hunt && aligned && Math.abs(wrap(best.angle-hunt.angle))<.25 && immediateClearance>2.5 && best.hit>=2.35 && best.minimum>.3;
    if(huntBoost && !hunt.boostStartedAt){hunt.boostStartedAt=t;hunt.until=t+hunt.boostSeconds*1000;}
    if(hunt && !huntBoost && (hunt.boostStartedAt || t>hunt.alignDeadline)) {hunt=null;state.huntRetry=t+2000;state.interceptsAborted=(state.interceptsAborted??0)+1;}
    let safeBoost=(huntBoost || !hunt && canBoost && t<(state.boostUntil??0)) && !best.shield && !!state.safety?.safeContinuation;
    if(safeBoost && (!state.boostSafety || t-state.boostSafetyAt>110)) {
      state.boostSafety=safetyPlan(x,y,heading,baseSpeed*2,yaw,fullObs,radius,best.angle,waypoint,guide,actualSpeed);state.boostSafetyAt=t;
    }
    safeBoost=safeBoost && !!state.boostSafety?.safeContinuation && Math.abs(wrap(state.boostSafety.angle-best.angle))<.12;
    safeBoost=safeBoost || !!state.safetyBoost && !!state.safety?.safeContinuation && (evacuating || retreating);
    boost(safeBoost);
    const nextMode=evacuating?'escape-pocket':hunt?'intercept':orbiting?'cage-opponent':waitingForExit?'trapped-patrol':constrained?'pocket-forage':retreating?'space-retreat':exploring?'explore':safeBoost?'cruise-boost':'forage';
    if(nextMode!==state.mode && (nextMode==='escape-pocket'||nextMode==='trapped-patrol'||state.mode==='escape-pocket'||state.mode==='trapped-patrol')) {
      state.navigationEvents??=[];state.navigationEvents.push({t,score:u(player+64),from:state.mode,to:nextMode,x,y,...state.navigation});if(state.navigationEvents.length>30)state.navigationEvents.shift();
    }
    state.mode=nextMode;state.modeCounts??={};state.modeCounts[nextMode]=(state.modeCounts[nextMode]??0)+1;state.orbit=orbit;state.hunt=hunt;
    const canvas = document.getElementById('unity-canvas'), rect = canvas.getBoundingClientRect();
    const clientX = rect.x + rect.width / 2 + 220 * Math.cos(best.angle);
    const clientY = rect.y + rect.height / 2 - 220 * Math.sin(best.angle);
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true, pointerId: 1, pointerType: 'mouse', buttons: state.boosting ? 1 : 0 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true, buttons: state.boosting ? 1 : 0 }));
    state.score = u(player + 64); state.best = Math.max(state.best, state.score);
    state.status = 'playing'; state.ticks++;
    state.last = { timestamp: state.now, player, coreState, reportedDying:!!byte(player+69), unityFocus, senderDirection: [f(u(player + 216) + 76), f(u(player + 216) + 80)], inputId: byte(u(player + 216) + 28), focus: document.hasFocus(), x, y, heading, command: best.angle, speed:actualSpeed, plannedSpeed:speed, yaw, scale, mode:state.mode, foodAhead,
      shield:!!best.shield,safety:state.safety,beam:!!best.beam,beamComputeMs:state.beamComputeMs, inputDelay: state.inputDelay, boosting: !!state.boosting, actualDashing: !!byte(player + 204), clearance: best.minimum, immediateClearance, escaping: !!best.escaping, hit: best.hit, obstacles: obs.length, foods: cachedFood.length, pathLength: path.length, navigation:state.navigation,predatorRisk:predatorRisk(x,y,obs),
      nearestThreat: obs.reduce((a,o) => { const gap = bodyGap(o,x,y); return !a || gap < a.gap ? {...o,gap} : a; }, null), target, elapsed: (t - state.runStart) / 1000 };
    state.replay={x,y,heading,speed,yaw,radius,inputDelay:state.inputDelay,obs,foods:cachedFood,command:best.angle};
    if(!state.journalAt || t-state.journalAt>2000) {
      state.journal??=[];state.journal.push({t,score:state.score,mode:state.mode,navigation:state.navigation,replay:state.replay,evacuation:state.evacuation,safety:state.safety});if(state.journal.length>70)state.journal.shift();state.journalAt=t;
    }
    state.trace ??= []; state.trace.push({ ...state.last, score: state.score }); if (state.trace.length > 200) state.trace.shift();
    if (state.score >= 50000) state.goalObserved = true;
  }
  state.frame = requestAnimationFrame(tick);
  return 'World-state controller installed';
})();
