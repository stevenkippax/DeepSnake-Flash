/* Reads the local Unity client's predicted state; sends ordinary mouse movement.
   It never writes game memory, scores, physics, rewards, or network packets.
   Runtime addresses are discovered from the current client before installation. */
(() => {
  window.__snakeWorldPilot && (window.__snakeWorldPilot.running = false);
  const oldController = window.__snakeWorldController;
  oldController?.stop();
  const R = window.__snakeReader, M = unityInstance.Module;
  const registry = window.__snakeRuntime?.registry ?? 53628928;
  const state = { running: true, ticks: oldController?.ticks ?? 0, best: oldController?.best ?? 0, runs: oldController?.runs ?? [], goalObserved: !!oldController?.goalObserved, status: 'waiting' };
  window.__snakeWorldController = state;
  function boost(active) {
    if (!!state.boosting === active) return;
    const canvas = document.getElementById('unity-canvas');
    const rect = canvas.getBoundingClientRect(), angle = previousAngle ?? state.last?.command ?? 0;
    const clientX = rect.x + rect.width / 2 + 220 * Math.cos(angle), clientY = rect.y + rect.height / 2 - 220 * Math.sin(angle);
    canvas.dispatchEvent(new MouseEvent(active ? 'mousedown' : 'mouseup', { clientX, clientY, bubbles: true, button: 0, buttons: active ? 1 : 0 }));
    state.boosting = active;
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
  function obstacles(player, x, y, ownRadius) {
    const list = u(registry + 16), array = u(list + 8), count = Math.min(100, u(list + 12));
    const result = [];
    for (let i = 0; i < count; i++) {
      const enemy = u(array + 16 + i * 4);
      if (enemy === player || !enemy) continue;
      const pre = predictor(enemy);
      if (!pre) continue;
      const radius = ownRadius + .258 * f(pre + 52) + 1.5;
      const hx = f(pre + 56), hy = f(pre + 60);
      if (Math.hypot(hx - x, hy - y) < 18) {
        result.push({ x: hx, y: hy, radius: radius + .2, vx: f(pre + 68) * f(pre + 24) * f(pre + 48), vy: f(pre + 72) * f(pre + 24) * f(pre + 48), head: true });
      }
      const bodies = u(pre + 180), items = u(bodies + 8), size = Math.min(500, u(bodies + 12));
      let previous = null;
      for (let j = 0; j < size; j++) {
        const body = u(items + 16 + j * 4);
        if (!body) continue;
        const bx = f(body + 12), by = f(body + 16);
        if (Math.hypot(bx - x, by - y) > 18) continue;
        if (previous && Math.hypot(bx - previous.x, by - previous.y) < radius * .55) continue;
        result.push({ x: bx, y: by, radius });
        previous = { x: bx, y: by };
      }
    }
    return result;
  }
  function clearance(x, y, t, obs, radius) {
    let value = 46 - radius - Math.max(Math.abs(x), Math.abs(y));
    for (const o of obs) {
      value = Math.min(value, Math.hypot(x - o.x, y - o.y) - o.radius);
      if (o.head && t < .7) {
        value = Math.min(value, Math.hypot(x - o.x, y - o.y) - o.radius - Math.hypot(o.vx, o.vy) * t);
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
        end = clearance(px, py, 0, obs, radius); worst = Math.min(worst, end);
        if (end > .8) { exit = t; break; }
      }
      const hardRisk = Math.max(0, Math.min(initial, -.6) - worst);
      const score = -hardRisk*1000000 + (2.5 - exit) * 1000 + (end - initial) * 60 + (worst - initial) * 40 - Math.abs(wrap(command - heading));
      if (!best || score > best.score) best = { angle: command, score, minimum: worst, hit: exit, escaping: true, px, py };
    }
    return best;
  }
  function findPath(x, y, heading, obs, radius, foods) {
    const step = .5, width = 85, half = 42, total = width * width;
    const ox = Math.round(x / step) * step - half * step;
    const oy = Math.round(y / step) * step - half * step;
    const clear = new Float32Array(total), distance = new Float64Array(total);
    const parent = new Int32Array(total); distance.fill(Infinity); parent.fill(-1);
    for (let row = 0; row < width; row++) for (let col = 0; col < width; col++)
      clear[row * width + col] = 46 - radius - Math.max(Math.abs(ox + col * step), Math.abs(oy + row * step));
    for (const o of obs) {
      const reach = o.radius + 1.7;
      const lx = Math.max(0, Math.ceil((o.x - reach - ox) / step));
      const hx = Math.min(width - 1, Math.floor((o.x + reach - ox) / step));
      const ly = Math.max(0, Math.ceil((o.y - reach - oy) / step));
      const hy = Math.min(width - 1, Math.floor((o.y + reach - oy) / step));
      for (let row = ly; row <= hy; row++) for (let col = lx; col <= hx; col++) {
        const index = row * width + col;
        clear[index] = Math.min(clear[index], Math.hypot(ox + col * step - o.x, oy + row * step - o.y) - o.radius);
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
      if (cost < best) { best = cost; goal = item; goalIndex = index; }
    }
    if (!goal) return { target: null, path: [] };
    const result = [], seen = new Set();
    for (let index = goalIndex; index !== start && index >= 0 && !seen.has(index); index = parent[index]) {
      seen.add(index); result.push({ x: ox + index % width * step, y: oy + Math.floor(index / width) * step });
    }
    result.reverse(); result.push({ x: goal.x, y: goal.y });
    return { target: goal, path: result };
  }
  function route(x, y, heading, command, speed, yaw, obs, radius, goal) {
    let px = x, py = y, angle = heading, minimum = 100, hit = 2.4, risk = 0;
    let goalDistance = goal ? Math.hypot(goal.x - x, goal.y - y) : 0;
    for (let t = .08; t <= 2.4; t += .08) {
      const desired = delayedCommand(t, heading, command);
      const delta = wrap(desired - angle);
      angle += Math.max(-yaw * .08, Math.min(yaw * .08, delta));
      px += Math.cos(angle) * speed * .08;
      py += Math.sin(angle) * speed * .08;
      const d = clearance(px, py, t, obs, radius);
      minimum = Math.min(minimum, d);
      risk += Math.max(0, 1.4 - d) * Math.exp(-t);
      if (goal) goalDistance = Math.min(goalDistance, Math.hypot(goal.x - px, goal.y - py));
      if (d < -.25) { hit = t; break; }
    }
    return { minimum, hit, risk, goalDistance, px, py };
  }
  function tick(t) {
    if (!state.running) return;
    state.frame = requestAnimationFrame(tick);
    if (t - last < 40) return;
    last = t; state.now=t/1000;
    const player = u(registry + 12);
    const coreState = u(window.__snakeRuntime.core + 12);
    const unityFocus = window.__snakeFocusGetter ? M.asm.Dk.get(window.__snakeFocusGetter.fn)(window.__snakeFocusGetter.m) : 1;
    if (!player || coreState !== 0 || byte(player + 69) || !byte(u(player + 216) + 30) || location.hash.includes('goog_fullscreen')) {
      state.reason = { coreState, unityFocus, player, sending: player ? byte(u(player + 216) + 30) : 0, hash: location.hash, t };
      if (state.status === "playing") state.firstWaiting = { ...state.reason, last: state.last, replay:state.replay };
      if (previousPlayer) state.runs.push({ score: state.score, ticks: state.ticks });
      previousPlayer = 0; target = null; previousAngle = null; path = []; commandHistory.length=0;
      boost(false);
      state.status = 'waiting'; return;
    }
    const pre = predictor(player);
    if (!pre) return;
    if (!window.__snakePelletRenderers.length && t - foodRefresh > 1000) R.refreshRenderers?.();
    if (player !== previousPlayer) { previousPlayer = player; state.runStart = t; R.refreshRenderers?.(); }
    const x = f(pre + 56), y = f(pre + 60), heading = Math.atan2(f(pre + 72), f(pre + 68));
    const scale = f(pre + 52), radius = .258 * scale, actualSpeed = f(pre + 24) * f(pre + 48), baseSpeed=f(pre + 24);
    const speed=state.boosting?Math.max(actualSpeed,baseSpeed*2):actualSpeed;
    const yaw = f(pre + 28) * Math.PI / 180;
    if (!Number.isFinite(x + y + heading + speed) || speed < .1 || speed > 30) return;
    const lag = u(u(player + 32) + 12);
    state.inputDelay = lag ? Math.max(.06, Math.min(.6, f(lag + 36) / 1000 + .02)) : .16;
    const obs = obstacles(player, x, y, radius);
    if (t - foodRefresh > 160) { cachedFood = food(); foodRefresh = t; }
    if (t - pathRefresh > 250 || !path.length) {
      const found = findPath(x, y, heading, obs, radius, cachedFood); target = found.target; path = found.path; pathRefresh = t;
    }
    let waypoint = target;
    if (path.length) {
      let nearest = 0, distance = Infinity;
      for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i].x - x, path[i].y - y); if (d < distance) { distance = d; nearest = i; } }
      waypoint = path[Math.min(path.length - 1, nearest + 2)];
    }
    const desiredBase = waypoint ? Math.atan2(waypoint.y - y, waypoint.x - x) :
      Math.hypot(x, y) > 32 ? Math.atan2(-y, -x) : heading + .10;
    const desired=boundedTurn(desiredBase,heading);
    const candidates = [desired, heading, boundedTurn(previousAngle ?? heading,heading)];
    for (let i = -11; i <= 11; i++) candidates.push(heading + i * Math.PI / 12);
    candidates.push(heading-Math.PI+.12,heading+Math.PI-.12);
    const immediateClearance = clearance(x, y, 0, obs, radius);
    const desiredRoute = route(x, y, heading, desired, speed, yaw, obs, radius, waypoint);
    let best = immediateClearance < .4 ? escape(x, y, heading, speed, yaw, obs, radius) :
      desiredRoute.hit >= 2.35 && desiredRoute.minimum > .05 ? { angle: desired, score: Infinity, ...desiredRoute } : null;
    for (const angle of best ? [] : candidates) {
      const r = route(x, y, heading, angle, speed, yaw, obs, radius, waypoint);
      const score = r.hit * 100000 + Math.min(2, r.minimum) * 8 - r.risk * 5 -
        Math.abs(wrap(angle - desired)) * 20 - Math.abs(wrap(angle - (previousAngle ?? heading))) * .5 -
        (waypoint ? r.goalDistance * 40 : Math.max(0, Math.hypot(r.px, r.py) - 35));
      if (!best || score > best.score) best = { angle, score, ...r };
    }
    previousAngle = best.angle;
    commandHistory.push({t:state.now,angle:best.angle});
    while(commandHistory.length && commandHistory[0].t<state.now-1.5)commandHistory.shift();
    const cruise = route(x,y,heading,best.angle,Math.max(actualSpeed,baseSpeed*2),yaw,obs,radius,waypoint);
    const aligned=Math.abs(wrap(best.angle-heading))<.30;
    const headFree=obs.filter(o=>o.head).every(o=>Math.hypot(o.x-x,o.y-y)>o.radius+8);
    const foodAhead=cachedFood.filter(item=>Math.hypot(item.x-x,item.y-y)<10 && Math.abs(wrap(Math.atan2(item.y-y,item.x-x)-best.angle))<.45).length;
    const recentStable=commandHistory.slice(-5).every(c=>Math.abs(wrap(c.angle-best.angle))<.25);
    const canBoost=u(player+64)>=50 && aligned && recentStable && headFree && immediateClearance>2.5 && cruise.hit>=2.35 && cruise.minimum>1;
    if(canBoost && foodAhead>=4) state.boostUntil=t+500;
    const safeBoost=canBoost && t<(state.boostUntil??0);
    boost(safeBoost);
    state.mode=safeBoost?'cruise-boost':'forage';
    const canvas = document.getElementById('unity-canvas'), rect = canvas.getBoundingClientRect();
    const clientX = rect.x + rect.width / 2 + 220 * Math.cos(best.angle);
    const clientY = rect.y + rect.height / 2 - 220 * Math.sin(best.angle);
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true, pointerId: 1, pointerType: 'mouse', buttons: state.boosting ? 1 : 0 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true, buttons: state.boosting ? 1 : 0 }));
    state.score = u(player + 64); state.best = Math.max(state.best, state.score);
    state.status = 'playing'; state.ticks++;
    state.last = { timestamp: state.now, player, coreState, unityFocus, senderDirection: [f(u(player + 216) + 76), f(u(player + 216) + 80)], inputId: byte(u(player + 216) + 28), focus: document.hasFocus(), x, y, heading, command: best.angle, speed:actualSpeed, plannedSpeed:speed, yaw, scale, mode:state.mode, foodAhead,
      inputDelay: state.inputDelay, boosting: !!state.boosting, actualDashing: !!byte(player + 204), clearance: best.minimum, immediateClearance, escaping: !!best.escaping, hit: best.hit, obstacles: obs.length, foods: cachedFood.length, pathLength: path.length,
      nearestThreat: obs.reduce((a,o) => { const gap = Math.hypot(x-o.x,y-o.y)-o.radius; return !a || gap < a.gap ? {...o,gap} : a; }, null), target, elapsed: (t - state.runStart) / 1000 };
    state.replay={x,y,heading,speed,yaw,radius,inputDelay:state.inputDelay,obs,foods:cachedFood,command:best.angle};
    state.trace ??= []; state.trace.push({ ...state.last, score: state.score }); if (state.trace.length > 200) state.trace.shift();
    if (state.score >= 50000) state.goalObserved = true;
  }
  state.frame = requestAnimationFrame(tick);
  return 'World-state controller installed';
})();
