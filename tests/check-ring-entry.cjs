const fs=require('fs'),assert=require('assert');global.window={};eval(fs.readFileSync('src/navigation.js','utf8'));const n=window.__snakeTopology,arc=[];for(let a=0;a<2.8;a+=.1)arc.push({x:8*Math.cos(a),y:8*Math.sin(a),x2:8*Math.cos(a+.1),y2:8*Math.sin(a+.1),radius:2,physical:.5,ttl:30,enemy:1});
const bytes=new ArrayBuffer(4096);Object.assign(window,{__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]});global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};global.requestAnimationFrame=()=>1;
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';",'window.debug={state,findPath};return "ok";'));window.debug.state.now=1;window.debug.state.inputDelay=.15;
assert(!n.wrapAt(-14,0,arc).length && n.wrapAt(0,0,arc).length);
const selected=window.debug.findPath(-14,0,0,arc,.4,[{id:1,x:-12,y:0,scale:.05},{id:2,x:0,y:0,scale:.08}]);
assert(selected.target?.id===1,'A valuable drop inside the developing ring must not lure the snake through its mouth');
console.log(JSON.stringify({foodOutsideRing:selected.target,pathLength:selected.path.length}));
