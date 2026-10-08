const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=Object.fromEntries(['score','best','mode','status','status-dot','start','stop','export','help'].map(id=>[id,{textContent:'',disabled:false,className:'',addEventListener(type,fn){this[type]=fn;}}]));
let data={ready:true,running:false,status:'playing',score:50711,best:50712,mode:'sweep-map'},exported,anchor,revoked;
const bridge={currentTab:async()=>({id:7}),read:async()=>({...data}),start:async()=>({...data,running:data.running=true}),stop:async()=>({...data,running:data.running=false})};
const context={window:{DeepSnakeBridge:bridge},document:{getElementById:id=>nodes[id],createElement:()=>anchor={click(){this.clicked=true;}}},Blob,Date,setInterval(){},URL:{createObjectURL(blob){exported=blob;return 'blob:receipt';},revokeObjectURL(url){revoked=url;}}};
vm.runInNewContext(fs.readFileSync('extension/popup.js','utf8'),context);
(async()=>{
 await new Promise(setImmediate);
 assert.equal(nodes.score.textContent,'50,711');assert(!nodes.start.disabled&&nodes.stop.disabled);
 await nodes.start.click();assert(nodes.start.disabled&&!nodes.stop.disabled);assert.equal(nodes.status.textContent,'Autopilot active');
 nodes.export.click();assert(anchor.clicked);assert.equal(anchor.download,'deepsnake-flash-run.json');assert.equal(revoked,'blob:receipt');
 const receipt=JSON.parse(await exported.text());assert.equal(receipt.app,'DeepSnake Flash');assert.equal(receipt.version,'1.0.0');assert.equal(receipt.score,50711);assert(receipt.capturedAt&&receipt.running);
 await nodes.stop.click();assert(!nodes.start.disabled&&nodes.stop.disabled);
 bridge.start=async()=>{throw new Error('Game build changed');};
 await nodes.start.click();assert.equal(nodes.status.textContent,'Game build changed','The failure must survive action cleanup');assert(!nodes.start.disabled);
 console.log('Popup state, Start/Stop, compact export and visible failure passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
