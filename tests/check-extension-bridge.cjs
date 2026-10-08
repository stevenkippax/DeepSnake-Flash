const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const calls=[],stops=[];
let tabUrl='https://snake.io/',running=false;
const page={window:{},unityInstance:{Module:{HEAPU32:new Uint32Array(16)}}};
page.window.__snakeWorldController={running:false,score:50711,best:50712,status:'playing',mode:'sweep-map',last:{elapsed:7706},stop(){stops.push('controller');this.running=false;}};
for(const name of ['__snakeWorldPilot','__snakeGoalMonitor','__snakeSessionRecovery'])page.window[name]={stop(){stops.push(name);}};
page.window.__snakeGoalMonitor.best=50713;page.window.__snakeGoalMonitor.milestones=[{target:50000}];
const context={window:{},URL,chrome:{tabs:{query:async()=>[{id:7,url:tabUrl}],get:async id=>({id,url:tabUrl})},scripting:{executeScript:async options=>{
  calls.push(options);assert.equal(options.target.tabId,7);assert.equal(options.world,'MAIN');
  if(options.files){running=true;page.window.__snakeWorldController.running=true;return [{result:'installed'}];}
  return [{result:vm.runInNewContext('('+options.func.toString()+')()',page)}];
}}}};
vm.runInNewContext(fs.readFileSync('extension/bridge.js','utf8'),context);
const bridge=context.window.DeepSnakeBridge;
(async()=>{
  for(const url of ['https://snake.io/','https://www.snake.io/#x'])assert(bridge.allowed(url));
  for(const url of ['http://snake.io/','https://snake.io.evil.test/','https://example.com/','garbage'])assert(!bridge.allowed(url));
  assert.equal((await bridge.currentTab()).id,7);
  const read=await bridge.read(7);assert.equal(read.score,50711);assert.equal(read.best,50713);
  page.unityInstance=undefined;
  await assert.rejects(bridge.start(7),/finish loading/);assert(!calls.some(c=>c.files));
  page.unityInstance={Module:{HEAPU32:new Uint32Array(16)}};
  const started=await bridge.start(7);assert(started.running&&running);
  const injected=calls.filter(c=>c.files);assert.equal(injected.length,1);assert.deepEqual(Array.from(injected[0].files),['runtime/runtime-reader.js','runtime/navigation.js','runtime/controller.js','runtime/session-observer.js','runtime/endurance-recorder.js']);
  await bridge.start(7);assert.equal(calls.filter(c=>c.files).length,1,'Repeated Start must preserve live gameplay');assert.equal(stops.length,0);
  const stopped=await bridge.stop(7);assert(!stopped.running);assert.deepEqual(stops,['controller','__snakeWorldPilot','__snakeGoalMonitor','__snakeSessionRecovery']);
  tabUrl='https://example.com/';
  const before=calls.length;await assert.rejects(bridge.currentTab(),/Open snake.io/);await assert.rejects(bridge.start(7),/Open snake.io/);await assert.rejects(bridge.stop(7),/Open snake.io/);assert.equal(calls.length,before,'Navigation away must reject all page execution');
  console.log('Extension bridge: readiness, site restriction, ordered injection, duplicate Start, Stop and snapshot passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
