const fs=require('fs'),assert=require('assert'),{performance}=require('perf_hooks');
const bytes=new ArrayBuffer(4096);
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]};
global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};
global.requestAnimationFrame=()=>1;
eval(fs.readFileSync('src/navigation.js','utf8'));
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.debug={state,safetyPlan,commandHistory};return 'installed';"));
const {state,safetyPlan,commandHistory}=window.debug;state.now=1;state.inputDelay=.15;

state.now=1;state.inputDelay=.2;commandHistory.push({t:.5,angle:0});
const r=safetyPlan(0,0,0,10,10.472,[],.3,0,{x:40,y:0},null,5,false,{startDelay:.5,before:5,until:2,after:5});
assert(r.safeContinuation && Math.abs(r.angle)<.12,'Planned finite boost must retain its open straight crossing');
assert(Math.abs(r.queuedPosition.x-1)<.01,'The queued prefix must use the observed pre-boost speed');
assert(Math.abs(r.px-37.5)<.55,'Safety prediction must return to normal speed after the planned burst');
console.log({queuedX:r.queuedPosition.x,endpoint:r.px,expected:37.5,angle:r.angle});
