const fs=require('fs'),assert=require('assert'),{performance}=require('perf_hooks');
const bytes=new ArrayBuffer(4096);
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]};
global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};
global.requestAnimationFrame=()=>1;
eval(fs.readFileSync('src/navigation.js','utf8'));
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.debug={state,safetyPlan,commandHistory};return 'installed';"));
const {state,safetyPlan,commandHistory}=window.debug;state.now=1;state.inputDelay=.15;

const pocket=[{x:-2,y:-4,x2:2,y2:-4,radius:1.9,physical:.4,enemy:1},{x:-2,y:4,x2:2,y2:4,radius:1.9,physical:.4,enemy:1},{x:-2,y:-4,x2:-2,y2:4,radius:1.9,physical:.4,enemy:1},{x:2,y:-4,x2:2,y2:4,radius:1.9,physical:.4,enemy:1}];
let x=0,y=0,a=Math.PI/2,min=Infinity,rescues=0;
state.inputDelay=.16;commandHistory.length=0;
for(let i=0;i<120;i++) {
 const now=1+i*.1;state.now=now;
 const plan=safetyPlan(x,y,a,5,10.472,pocket,.3,Math.atan2(2-y,-x),{x:0,y:2});
 rescues+=!!plan.emergencyContinuation;
 assert(!plan.emergencyContinuation||!plan.safeContinuation,'Emergency reserve must not be advertised as full safety');
 commandHistory.push({t:now,angle:plan.angle});
 for(let j=0;j<5;j++) {
  const time=now+(j+1)*.02,cmd=commandHistory.findLast(c=>c.t<=time-.16)?.angle??a;
  a+=Math.max(-.20944,Math.min(.20944,Math.atan2(Math.sin(cmd-a),Math.cos(cmd-a))));x+=Math.cos(a)*.1;y+=Math.sin(a)*.1;
  for(const o of pocket){const dx=o.x2-o.x,dy=o.y2-o.y,q=Math.max(0,Math.min(1,((x-o.x)*dx+(y-o.y)*dy)/(dx*dx+dy*dy)));min=Math.min(min,Math.hypot(x-o.x-q*dx,y-o.y-q*dy)-o.physical-.3);}
 }
}
assert(rescues>0 && min>0,'Emergency tier must preserve actual clearance under repeated delayed control');
console.log({rescues,min,x,y});
