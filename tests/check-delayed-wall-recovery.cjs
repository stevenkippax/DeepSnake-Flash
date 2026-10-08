const fs=require('fs'),assert=require('assert'),{performance}=require('perf_hooks');
const bytes=new ArrayBuffer(4096);
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]};
global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};
global.requestAnimationFrame=()=>1;global.cancelAnimationFrame=()=>{};
eval(fs.readFileSync('src/navigation.js','utf8'));
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.debug={state,safetyPlan,commandHistory};return 'installed';"));
const {state,safetyPlan,commandHistory}=window.debug;state.now=1;state.inputDelay=.15;

window.__snakeRuntime.arenaLimit=48;
// Reload so the controller captures the measured arena limit.
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.wallDebug={state,safetyPlan,commandHistory};return 'installed';"));
const D=window.wallDebug;D.state.inputDelay=.3;
for(const start of [{x:44.9,y:-46.67,a:-.16},{x:47,y:0,a:0},{x:46,y:46,a:Math.PI/4}]) {
 let {x,y,a}=start,min=Infinity;
 D.commandHistory.length=0;D.commandHistory.push({t:.5,angle:a});
 for(let i=0;i<100;i++) {
  const now=1+i*.05;D.state.now=now;
  const plan=D.safetyPlan(x,y,a,5,10.472,[],.273,start.a,{x:44,y:-44});
  D.commandHistory.push({t:now,angle:plan.angle});
  for(let j=0;j<5;j++) {
   const t=now+(j+1)*.01,cmd=D.commandHistory.findLast(c=>c.t<=t-.3)?.angle??a;
   a+=Math.max(-.10472,Math.min(.10472,Math.atan2(Math.sin(cmd-a),Math.cos(cmd-a))));
   x+=Math.cos(a)*.05;y+=Math.sin(a)*.05;
   min=Math.min(min,50-.273-Math.max(Math.abs(x),Math.abs(y)));
  }
 }
 assert(min>0,'Delayed replans must recover before the physical wall: '+JSON.stringify({start,min,x,y}));
 console.log({start,min,x,y});
}
