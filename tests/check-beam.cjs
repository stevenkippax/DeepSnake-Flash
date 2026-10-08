const fs=require('fs'),assert=require('assert');
const bytes=new ArrayBuffer(4096);
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]};
global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};
global.requestAnimationFrame=()=>1;
const src=fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';",'window.debug={state,beamPlan,route,clearance,commandHistory};return "ok";');eval(src);
const d=window.debug,obs=[{x:-4,y:-6,x2:4,y2:-6,radius:1.5},{x:-4,y:6,x2:4,y2:6,radius:1.5},{x:-4,y:-6,x2:-4,y2:6,radius:1.5},{x:4,y:-6,x2:4,y2:6,radius:1.5}];
d.state.now=1;d.state.inputDelay=.16;
const goal={x:0,y:5};
const linear=d.route(0,0,Math.PI/2,Math.PI/2,5,10.472,obs,.3,goal);
assert(linear.hit<2.35);
const start=performance.now(),curved=d.beamPlan(0,0,Math.PI/2,5,10.472,obs,.3,goal);
assert(curved && curved.hit>=2.35 && curved.minimum>-.35,'Enclosure must admit safe multi-turn motion');
let x=0,y=0,a=Math.PI/2,min=100,count=0;
for(let i=0;i<80;i++) {
 const now=1+i*.1;d.state.now=now;
 const plan=d.beamPlan(x,y,a,5,10.472,obs,.3,goal);
 assert(plan,'Enclosure must remain viable under receding-horizon decisions');
 d.commandHistory.push({t:now,angle:plan.angle});
 for(let j=0;j<5;j++) {
  const t=now+(j+1)*.02,when=t-.16;
  const cmd=d.commandHistory.findLast(c=>c.t<=when)?.angle??a;
  const delta=Math.atan2(Math.sin(cmd-a),Math.cos(cmd-a));a+=Math.max(-10.472*.02,Math.min(10.472*.02,delta));
  x+=Math.cos(a)*.1;y+=Math.sin(a)*.1;min=Math.min(min,d.clearance(x,y,0,obs,.3));
 }
 count++;
}
assert(min>-.6,'Successive delayed decisions must retain the physical margin');
console.log(JSON.stringify({firstPlanMinimum:curved.minimum,firstAngle:curved.angle,sequence:curved.sequence,recedingMinimum:min,steps:count,timeMs:performance.now()-start}));

const harvest=d.beamPlan(0,0,0,5,10.472,[],.3,{x:1,y:0});assert(harvest.goalDistance<.35,'Food must count when crossed, without requiring a return to it at the horizon');
