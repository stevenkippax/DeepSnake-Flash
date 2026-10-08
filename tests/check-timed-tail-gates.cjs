const fs=require('fs'),assert=require('assert');
const bytes=new ArrayBuffer(4096);
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64,arenaLimit:48},__snakePelletRenderers:[]};
global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};global.requestAnimationFrame=()=>1;
eval(fs.readFileSync('src/navigation.js','utf8'));
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.debug={state,safetyPlan};return 'installed';"));
const T=window.__snakeTopology,{state,safetyPlan}=window.debug;state.inputDelay=.15;state.now=1;
const ring=[];for(let i=0;i<80;i++){const a=i*2*Math.PI/80,b=(i+1)*2*Math.PI/80;ring.push({x:8*Math.cos(a),y:8*Math.sin(a),x2:8*Math.cos(b),y2:8*Math.sin(b),radius:1,physical:.5,enemy:1,ttl:Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<.35?1:100});}
let current=T.raster(ring,.3,0),future=T.raster(ring,.3,8);
const path=T.timedExit(0,0,ring,.3,current,future,5,.15);
assert(path.length&&path.at(-1).x>9,'An opening tail must yield a time-aware route out of the current component');
for(const point of path){for(const o of ring){if(point.arrival>o.ttl+.5)continue;const dx=o.x2-o.x,dy=o.y2-o.y,q=Math.max(0,Math.min(1,((point.x-o.x)*dx+(point.y-o.y)*dy)/(dx*dx+dy*dy)));assert(Math.hypot(point.x-o.x-q*dx,point.y-o.y-q*dy)-o.radius>=.299,'No path point may cross a body before conservative tail departure');}}
const sealed=ring.map(o=>({...o,ttl:100}));assert(!T.timedExit(0,0,sealed,.3,T.raster(sealed,.3,0),T.raster(sealed,.3,8),5,.15).length,'A non-expiring enclosure must never invent a tail opening');
const wall={x:5,y:-35,x2:5,y2:35,radius:1,physical:.5,enemy:1,ttl:.2};
const clear=safetyPlan(0,0,0,5,10.472,[wall],.3,0,{x:30,y:0});
assert(clear.safeContinuation&&clear.px>20,'The independent safety checker must accept a departed tail rather than pin it forever');
const refill={head:true,x:5,y:10,vx:0,vy:-5,radius:2,maxSpeed:10,physical:.3,enemy:2,tailSeconds:30};
const blocked=safetyPlan(0,0,0,5,10.472,[wall,refill],.3,0,{x:30,y:0});
assert(!blocked.safeContinuation||blocked.px<20||Math.abs(blocked.angle)>.12,'A head refilling that opening must still defeat the straight-tail escape');
console.log({exit:path.at(-1),pathLength:path.length,departedTailEndpoint:clear.px,refill:{safe:blocked.safeContinuation,x:blocked.px,angle:blocked.angle}});
