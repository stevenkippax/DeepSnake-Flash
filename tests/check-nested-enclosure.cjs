const fs=require('fs'),assert=require('assert');global.window={};eval(fs.readFileSync('src/navigation.js','utf8'));const n=window.__snakeTopology;
function ring(r,to,enemy){const parts=[];for(let t=0;t<to;t+=.1)parts.push({x:r*Math.cos(t),y:r*Math.sin(t),x2:r*Math.cos(Math.min(to,t+.1)),y2:r*Math.sin(Math.min(to,t+.1)),radius:1.5,physical:.5,ttl:100,enemy});return [{head:true,x:r,y:0,vx:0,vy:5,radius:1.5,enemy,maxSpeed:10},...parts];}
const outer=ring(28,Math.PI*2,1),inner=ring(8,5.1,2),obs=[...outer,...inner];
assert(n.dangerAt(0,0,obs).length===2,'Fixture must contain nested threats');
const result=n.analyze(0,0,obs,.3),exit=result.escapePath.at(-1);
assert(exit,'A closed outer ring must not suppress the open inner-ring escape');
assert.deepEqual(result.escapeEnemies,[2],'Escape commitment must target the inner owner');
const threats=n.dangerAt(exit.x,exit.y,obs).map(o=>o.enemy);
assert(threats.includes(1)&&!threats.includes(2),'The exit must leave the inner ring while acknowledging the enclosing outer ring');
console.log({exit,threats,steps:result.escapePath.length});
