const fs=require('fs'),assert=require('assert');global.window={};eval(fs.readFileSync('src/navigation.js','utf8'));const n=window.__snakeTopology;
const box=[];for(let a=-5;a<=5;a++){box.push({x:-5,y:a,radius:1.3},{x:5,y:a,radius:1.3},{x:a,y:-5,radius:1.3});if(Math.abs(a)>=3)box.push({x:a,y:5,radius:1.3});}
const open=n.analyze(0,0,[],.3);assert(!open.closing&&!open.confined&&!open.waiting,'Open arena must not cause escape or circling');
const trap=n.analyze(0,0,[...box,{x:-14,y:5,vx:5,vy:0,radius:1.3,head:true}],.3);
assert(trap.closing&&trap.escapePath.length,'Closing mouth must trigger an escape while still open');assert(trap.escapePath.at(-1).y>=7,'Escape must leave the predicted pocket');
const tooLate=n.analyze(0,0,[...box,{x:-8,y:5,vx:5,vy:0,radius:1.3,head:true}],.3);
assert(tooLate.closing&&!tooLate.escapePath.length&&tooLate.waiting,'An exit that seals before arrival must not be advertised as an escape');
const shut=n.analyze(0,0,[...box,...[-2,-1,0,1,2].map(x=>({x,y:5,radius:1.3}))],.3);
assert(shut.confined&&shut.shelterPath.length,'Already enclosed snake should choose a route through remaining safe space');assert(n.regionAt(trap.future,0,0).area<80&&n.regionAt(trap.future,0,8).area>1000,'Future endpoint regions must distinguish dead end from open arena');
console.log(JSON.stringify({openArea:open.currentArea,closingPocket:[trap.currentArea,trap.futureArea],escape:trap.escapePath,confinedArea:shut.currentArea,checks:'passed'}));

const curved={x:0,y:0,vx:5,vy:0,radius:1,head:true,trail:[{x:0,y:0,t:0},{x:.25,y:.4,t:.1},{x:.25,y:5,t:1}]};assert(n.raster([curved],.3,0).clear[n.index(0,0)]<0,'Current map must include heads with predicted turns');assert(n.headClearance(curved,.25,4,1)<0&&n.headClearance(curved,4,0,1)>1,'Predicted body trail must follow known turns');

const room=[];for(let a=-10;a<=10;a++)room.push({x:a,y:-10,radius:1.3},{x:a,y:10,radius:1.3},{x:-10,y:a,radius:1.3},{x:10,y:a,radius:1.3});const sector=n.analyze(0,-5,[...room,{x:-11,y:0,vx:5,vy:0,radius:1.3,head:true}],.3);assert(sector.closing&&sector.waiting&&!sector.escapePath.length&&sector.largestAccessibleFutureArea<sector.largestFutureArea/2,'A contracting sealed room must be recognized without advertising an escape into an inaccessible sector');

const straightTrace=()=>Array.from({length:81},(_,i)=>({x:i*.5,y:0,t:i*.1}));
const head=()=>({x:0,y:0,vx:5,vy:0,physical:.5,radius:2,enemy:1,trail:straightTrace()});
let h=head();n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:2,ttl:10}]);assert(h.trail.at(-1).t<1,'Forecasts must stop at a solid body instead of passing through it');
h=head();n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:1,ttl:10}]);assert(h.trail.length===81,'A snake must not collide with its own body');
h=head();n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:2,ttl:.3}]);assert(h.trail.length===81,'A tail that vacates before arrival must not block the forecast');
h={...head(),invincible:true};n.clipTrails([h],[{x:5,y:0,physical:.5,enemy:2,ttl:10}]);assert(h.trail.length===81,'Invincible heads must retain their possible route through bodies');

const fragile=n.analyze(0,0,box,.3);assert(fragile.pinched&&!fragile.closing&&fragile.escapePath.length,'A pocket with a narrow mouth must trigger early relocation before a head starts sealing it');
