const fs=require('fs'),assert=require('assert'),{performance}=require('perf_hooks');
const bytes=new ArrayBuffer(4096);
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]};
global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};
global.requestAnimationFrame=()=>1;
eval(fs.readFileSync('src/navigation.js','utf8'));
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.debug={state,safetyPlan,commandHistory,pickIntercept};return 'installed';"));
const {state,safetyPlan,commandHistory}=window.debug;state.now=1;state.inputDelay=.15;

state.now=1;state.inputDelay=.1;commandHistory.push({t:.5,angle:Math.PI/2});
const obs=[{head:true,x:12,y:0,vx:-5,vy:0,radius:2.3,physical:.3,maxSpeed:10,enemy:1,score:8000,length:400,tailSeconds:80},{x:13,y:0,x2:28,y2:0,radius:1.8,physical:.3,enemy:1,ttl:100}];
for(let a=0;a<5.3;a+=.1)obs.push({x:28*Math.cos(a),y:28*Math.sin(a),x2:28*Math.cos(Math.min(5.3,a+.1)),y2:28*Math.sin(Math.min(5.3,a+.1)),radius:1.8,physical:.3,enemy:1,ttl:100});
assert(window.__snakeTopology.dangerAt(0,-8,obs).length,'Fixture must have an enclosing owner');
const candidate=window.debug.pickIntercept(0,-8,Math.PI/2,5,10.472,obs,.3,100,new Set([1]));
assert(candidate && candidate.enemy===1,'A reachable enclosing head must remain an eligible escape interception');
assert(window.__snakeTopology.dangerAt(candidate.waypoint.x,candidate.waypoint.y,obs).length,'The tactical escape must remain possible within its existing enclosure');
const plan=safetyPlan(0,-8,Math.PI/2,10,10.472,obs,.3,candidate.angle,candidate.waypoint,null,5,false,{startDelay:candidate.alignTime,before:5,until:candidate.alignTime+1.5+.1,after:5},true);
assert(plan.safeContinuation && Math.abs(plan.angle-candidate.angle)<.01,'The attack must retain its proven first crossing under the shared speed schedule');
console.log({candidate:{angle:candidate.angle,tau:candidate.tau,arrival:candidate.arrival},safe:plan.safeContinuation,angle:plan.angle,minimum:plan.minimum});
