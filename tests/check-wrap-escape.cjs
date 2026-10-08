const fs=require('fs'),assert=require('assert');global.window={};eval(fs.readFileSync('src/navigation.js','utf8'));const n=window.__snakeTopology;
function arc(from,to,r,enemy=1){const s=[];for(let a=from;a<to;a+=.1){const b=Math.min(to,a+.1);s.push({x:r*Math.cos(a),y:r*Math.sin(a),x2:r*Math.cos(b),y2:r*Math.sin(b),radius:2,physical:.5,ttl:30,enemy});}return s;}
const partial=arc(0,2.8,8),wrap=n.wrapAt(0,0,partial);
assert(wrap.length===1,'A curved partial enclosure must be detected before a full ring');
const plan=n.analyze(0,0,partial,.4);
assert(plan.surrounding.length && plan.escapePath.length && !plan.confined,'Escape must begin while the region remains connected to open space');
const exit=plan.escapePath.at(-1);assert(Math.hypot(exit.x,exit.y)>=12,'Escape must leave the developing ring, rather than choose another point within it');
const line=[{x:-15,y:8,x2:15,y2:8,radius:2,physical:.5,ttl:30,enemy:1}];assert.equal(n.wrapAt(0,0,line).length,0,'A straight passing body is not a surrounding arc');
const closed=n.analyze(0,0,arc(0,Math.PI*2,6),.4);assert(closed.surrounding.length && !closed.escapePath.length,'A sealed ring must not invent an exit');
const recorded=JSON.parse(fs.readFileSync('tests/fixtures/failure-nyc-3195.json','utf8')).waiting.replay;
assert(n.wrapAt(recorded.x,recorded.y,recorded.obs).length>0,'The recorded fatal enclosure must be recognized');
console.log(JSON.stringify({partialRing:wrap,firstExit:plan.escapePath[0],exit,closedArea:closed.currentArea,recordedThreats:n.wrapAt(recorded.x,recorded.y,recorded.obs)}));
