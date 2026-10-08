const fs=require('fs'),assert=require('assert');global.window={};eval(fs.readFileSync('src/navigation.js','utf8'));const n=window.__snakeTopology;
function arc(r,to=5.25){const a=[];for(let t=0;t<to;t+=.12)a.push({x:r*Math.cos(t),y:r*Math.sin(t),x2:r*Math.cos(Math.min(to,t+.12)),y2:r*Math.sin(Math.min(to,t+.12)),radius:2,physical:.5,ttl:100,enemy:1});return [{head:true,x:r,y:0,vx:0,vy:5,radius:2,enemy:1,maxSpeed:10},...a];}
const large=arc(28);
assert(!n.wrapAt(0,0,large).length,'Fixture must reproduce the old local-radius blind spot');
assert(n.trapAt(0,0,large).length,'A large loop with reachable closure must be recognized before it closes');
assert(!n.trapAt(-40,-40,large).length,'The exterior must remain distinct from potential territory');
const plan=n.analyze(0,0,large,.4);assert(plan.escapePath.length,'An open large ring must retain its real escape');
const exit=plan.escapePath.at(-1);assert(!n.dangerAt(exit.x,exit.y,large).length,'Escape endpoint must be outside every possible ring');
const lines=[{head:true,x:20,y:0,vx:5,vy:0,radius:2,enemy:2,maxSpeed:10},{x:20,y:0,x2:-20,y2:0,radius:2,enemy:2}];assert(!n.trapAt(0,10,lines).length,'A straight body must not invent a polygon');
const failure=JSON.parse(fs.readFileSync('tests/fixtures/failure-safety-2984.json','utf8')).waiting.replay;
assert(n.trapAt(failure.x,failure.y,failure.obs).length,'Fatal captured enclosure must be recognized globally');
const start=performance.now();for(let i=0;i<1000;i++)n.trapAt(failure.x+(i%10),failure.y,failure.obs);console.log({largeThreat:n.trapAt(0,0,large),exit,captured:n.trapAt(failure.x,failure.y,failure.obs),thousandQueriesMs:performance.now()-start});
for(const obs of [large,failure.obs]) {
 const start=performance.now(),mask=n.territoryMask(obs);let misses=0;
 for(let y=-44;y<=44;y+=3)for(let x=-44;x<=44;x+=3)if(n.trapAt(x,y,obs).length&&!mask[n.index(x,y)])misses++;
 assert.equal(misses,0,'Precomputed territory must not miss any exact interior query');console.log({maskAndChecksMs:performance.now()-start});
}
