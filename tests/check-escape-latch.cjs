const fs=require('fs'),assert=require('assert');global.window={};eval(fs.readFileSync('src/navigation.js','utf8'));
const n=window.__snakeTopology,partial=[];for(let a=0;a<2.8;a+=.1)partial.push({x:8*Math.cos(a),y:8*Math.sin(a),x2:8*Math.cos(a+.1),y2:8*Math.sin(a+.1),radius:2,physical:.5,ttl:30,enemy:1});
const bytes=new ArrayBuffer(4096);Object.assign(window,{__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]});global.unityInstance={Module:{HEAPU8:new Uint8Array(bytes),HEAPU32:new Uint32Array(bytes),HEAPF32:new Float32Array(bytes)}};global.requestAnimationFrame=()=>1;
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';",'window.debug={state,commitEvacuation};return "ok";'));
const d=window.debug,nav=n.analyze(0,0,partial,.4),first=d.commitEvacuation(0,0,0,nav),goal=first.at(-1);
const later=n.analyze(-3,-3,partial,.4);later.surrounding=[];later.escapePath=[];
const still=d.commitEvacuation(-3,-3,1000,later);assert(still.length && still.at(-1).x===goal.x && d.state.evacuation,'A weaker transient wrap signal must not abandon the escape');
const barrier=[...partial,{x:-6,y:-47,x2:-6,y2:47,radius:2,physical:.5,ttl:100,enemy:2}];
const sealed=n.analyze(-3,-3,barrier,.4);sealed.escapePath=[];
const blocked=d.commitEvacuation(-3,-3,2000,sealed,barrier);assert(!blocked.length&&d.state.evacuation.blocked,'A sealed escape must preserve its intent without following an obsolete route');
const reopened=d.commitEvacuation(-3,-3,2500,later);assert(reopened.length&&!d.state.evacuation.blocked,'A reopened route must resume the committed escape');
const outside=n.analyze(goal.x,goal.y,partial,.4);outside.surrounding=[];outside.escapePath=[];
d.commitEvacuation(goal.x,goal.y,3000,outside);assert(!d.state.evacuation,'Reaching the safe destination must release the latch');
console.log('Escape commitment checks passed');

const again=d.commitEvacuation(0,0,4000,nav,partial);assert(again.length);
const clear=n.analyze(0,0,[],.4);d.commitEvacuation(0,0,4500,clear,[]);assert(d.state.evacuation,'A brief missing threat must preserve the escape');
d.commitEvacuation(0,0,6100,clear,[]);assert(!d.state.evacuation,'A persistently vanished threat must release an obsolete goal before reaching it');
console.log('Stable threat-clear release passed');
