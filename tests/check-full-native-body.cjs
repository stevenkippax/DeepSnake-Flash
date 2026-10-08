const fs=require('fs'),assert=require('assert');const bytes=new ArrayBuffer(100000),U=new Uint32Array(bytes),F=new Float32Array(bytes),B=new Uint8Array(bytes);const u=(p,v)=>U[p>>>2]=v,f=(p,v)=>F[p>>>2]=v;
global.window={__snakeReader:{},__snakeRuntime:{registry:32,core:64},__snakePelletRenderers:[]};global.unityInstance={Module:{HEAPU8:B,HEAPU32:U,HEAPF32:F}};global.requestAnimationFrame=()=>1;
u(48,1024);u(1032,2048);u(1036,1);u(2064,4096);u(4308,5000);u(5012,5100);u(5468,5200);
f(5208,.5);f(5224,5);f(5228,600);f(5248,1);f(5252,1);f(5256,30);f(5260,30);f(5268,1);u(5380,5500);u(5508,6000);u(5512,1200);
for(let j=0;j<1200;j++){const p=20000+j*32;u(6016+j*4,p);f(p+12,j<1100?30:0);f(p+16,j<1100?30:(j-1100)*.01);}
eval(fs.readFileSync('src/controller.js','utf8').replace("return 'World-state controller installed';","window.debug={state,obstacles,bodyGap};return 'installed';"));
window.debug.state.inputDelay=.1;const result=window.debug.obstacles(3000,0,0,.258,5);
assert(result.some(o=>!o.head && window.debug.bodyGap(o,0,0)<0),'Collision geometry must include the nearby tail beyond body point 500');
assert(result.find(o=>o.head).length===600,'Full native length must be retained for moving-tail prediction');
console.log({nativePoints:1200,capsules:result.length,tailDetected:true});
