const fs=require('fs'),assert=require('assert'),{performance}=require('perf_hooks');
const bytes=new ArrayBuffer(4096);
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]};
global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};
global.requestAnimationFrame=()=>1;
eval(fs.readFileSync('src/navigation.js','utf8'));
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.debug={state,safetyPlan,commandHistory};return 'installed';"));
const {state,safetyPlan,commandHistory}=window.debug;state.now=1;state.inputDelay=.15;
let r=safetyPlan(0,0,0,5,10.47,[],.3,0,{x:30,y:0});
assert(r.safeContinuation&&Math.abs(r.angle)<.12,'Open-space task move must retain its six-second continuation');
r=safetyPlan(39,0,0,5,10.47,[],.3,0,{x:45,y:0});
assert(r.safeContinuation&&r.minimum>=0,'Approaching a wall must keep a collision-free turning continuation');
const wall=[{x:3.5,y:-3,x2:3.5,y2:3,radius:1.8,enemy:1}];
r=safetyPlan(0,0,0,5,10.47,wall,.3,0,{x:15,y:0});
assert(r.safeContinuation&&Math.abs(r.angle)>.5,'A proposed attack/food direction into a body must be overridden');
const enemy={head:true,x:9,y:0,vx:0,vy:5,radius:2,maxSpeed:10,enemy:1,length:50,score:500};
r=safetyPlan(0,0,0,5,10.47,[enemy],.3,0,{x:20,y:0});
assert(r.safeContinuation&&Math.abs(r.angle)>.8,'Perpendicular nominal enemy movement must not hide its possible immediate turn toward us');
commandHistory.push({t:.7,angle:0});
r=safetyPlan(44.9,0,0,5,10.47,[],.3,Math.PI,{x:0,y:0});
assert(r.queuedUnsafe||!r.safeContinuation,'Already unavoidable queued wall motion must never be labelled safe');
commandHistory.length=0;
state.inputDelay=.2;commandHistory.push({t:.7,angle:0});
r=safetyPlan(0,0,0,5,10.47,[{x:1.5,y:0,radius:2,enemy:1}],.3,Math.PI,null);
assert(r.queuedUnsafe&&r.sequence[0].t>=.2-1e-6,'Unsafe queued input must be simulated in full before any alternative command');
commandHistory.length=0;state.inputDelay=.15;
const boxed=[{x:-2,y:-2,x2:2,y2:-2,radius:1.5,enemy:1},{x:-2,y:2,x2:2,y2:2,radius:1.5,enemy:1},{x:-2,y:-2,x2:-2,y2:2,radius:1.5,enemy:1},{x:2,y:-2,x2:2,y2:2,radius:1.5,enemy:1}];
r=safetyPlan(0,0,0,5,10.47,boxed,.3,0,{x:20,y:0});
assert(!r.safeContinuation,'No safe continuation in a sealed lethal pocket must be reported honestly');
const captured=JSON.parse(fs.readFileSync('tests/fixtures/failure-nyc-3195.json','utf8'));
console.log('shield checks passed',Object.keys(captured));
const replay=captured.waiting?.replay??captured.waiting?.last?.replay;
console.log('captured keys',Object.keys(captured.waiting??{}));
if(replay){state.inputDelay=replay.inputDelay;const start=performance.now();const result=safetyPlan(replay.x,replay.y,replay.heading,replay.speed,replay.yaw,replay.obs,replay.radius,replay.command,null);console.log({obstacles:replay.obs.length,ms:performance.now()-start,safe:result.safeContinuation,hit:result.hit,expanded:result.expanded});}
// Execute the chosen first commands, including measured input delay, through
// repeated replans. A one-shot collision-free path is insufficient evidence.
state.inputDelay=.16;commandHistory.length=0;
let x=0,y=0,a=Math.PI/2,minimum=Infinity,approved=0;
const pocket=[{x:-4,y:-6,x2:4,y2:-6,radius:1.5,enemy:1},{x:-4,y:6,x2:4,y2:6,radius:1.5,enemy:1},{x:-4,y:-6,x2:-4,y2:6,radius:1.5,enemy:1},{x:4,y:-6,x2:4,y2:6,radius:1.5,enemy:1}];
for(let i=0;i<120;i++) {
 const now=1+i*.1;state.now=now;
 const plan=safetyPlan(x,y,a,5,10.472,pocket,.3,Math.atan2(5-y,-x),{x:0,y:5});
 approved+=plan.safeContinuation?1:0;commandHistory.push({t:now,angle:plan.angle});
 for(let j=0;j<5;j++) {
  const time=now+(j+1)*.02,cmd=commandHistory.findLast(c=>c.t<=time-.16)?.angle??a;
  a+=Math.max(-10.472*.02,Math.min(10.472*.02,Math.atan2(Math.sin(cmd-a),Math.cos(cmd-a))));x+=Math.cos(a)*.1;y+=Math.sin(a)*.1;
  for(const o of pocket){const dx=o.x2-o.x,dy=o.y2-o.y,q=Math.max(0,Math.min(1,((x-o.x)*dx+(y-o.y)*dy)/(dx*dx+dy*dy)));minimum=Math.min(minimum,Math.hypot(x-o.x-q*dx,y-o.y-q*dy)-o.radius);}
 }
}
assert(minimum>=0,'Repeated delayed safety commands must keep the body buffer in a confined pocket');
console.log({recedingMinimum:minimum,approved,steps:120});

state.inputDelay=.2;state.now=1;commandHistory.length=0;commandHistory.push({t:.7,angle:0});
const fast=safetyPlan(0,0,0,10,10.472,[],.3,0,{x:30,y:0},null,5);
assert(Math.abs(fast.queuedPosition.x-1)<.01,'Boost must not accelerate before its queued input can execute');
const runner=safetyPlan(0,0,0,10,10.472,[{head:true,x:-7,y:0,vx:5,vy:0,radius:2,maxSpeed:10,enemy:1}],.3,0,{x:30,y:0},null,5);
assert(runner.safeContinuation,'Boosting away from a pursuer must be considered with full safety margins');
console.log({queuedBoostDistance:fast.queuedPosition.x,escapeBoostSafe:runner.safeContinuation});
