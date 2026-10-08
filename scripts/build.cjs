const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),src=path.join(root,'src'),ext=path.join(root,'extension'),dist=path.join(root,'dist');
fs.mkdirSync(dist,{recursive:true});fs.mkdirSync(path.join(ext,'runtime'),{recursive:true});
const sources=['runtime-reader.js','navigation.js','controller.js','session-observer.js','endurance-recorder.js'];
for(const name of sources)fs.copyFileSync(path.join(src,name),path.join(ext,'runtime',name));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(ext,'LICENSE'));
fs.writeFileSync(path.join(ext,'INSTALL.txt'),'DeepSnake Flash\n\n1. Open chrome://extensions (or edge://extensions).\n2. Enable Developer mode.\n3. Load unpacked and select this folder.\n4. Open https://snake.io and let the game load.\n5. Open the extension, press Start autopilot, close its panel, then choose normal Play.\n\nThe popup has Stop and Download run data. Keep the game visible and focused.\nSource: https://github.com/stevenkippax/DeepSnake-Flash\n');
const bundle='/* DeepSnake Flash v1.0.0 — MIT License. Copyright (c) 2026 Steven Kippax. */\n(()=>{\nif(window.__snakeWorldController?.running){console.info("DeepSnake Flash is already running; preserving the active controller.");return;}\nif(typeof unityInstance==="undefined"||!unityInstance?.Module?.HEAPU32)throw new Error("Load Snake.io before starting DeepSnake Flash.");\n'+sources.map(name=>fs.readFileSync(path.join(src,name),'utf8')).join('\n')+'\n})();\n';
fs.writeFileSync(path.join(dist,'deepsnake-flash.js'),bundle);
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function files(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(item=>item.isDirectory()?files(path.join(dir,item.name),prefix+item.name+'/'):[{name:prefix+item.name,bytes:fs.readFileSync(path.join(dir,item.name))}]);}
const local=[],central=[];let offset=0;
for(const entry of files(ext)){
 const name=Buffer.from(entry.name),crc=crc32(entry.bytes),lh=Buffer.alloc(30);
 lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x800,6);lh.writeUInt16LE(33,12);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(entry.bytes.length,18);lh.writeUInt32LE(entry.bytes.length,22);lh.writeUInt16LE(name.length,26);
 local.push(lh,name,entry.bytes);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x800,8);ch.writeUInt16LE(33,14);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(entry.bytes.length,20);ch.writeUInt32LE(entry.bytes.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);central.push(ch,name);offset+=lh.length+name.length+entry.bytes.length;
}
const cd=Buffer.concat(central),end=Buffer.alloc(22),count=central.length/2;end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
fs.writeFileSync(path.join(dist,'deepsnake-flash-extension.zip'),Buffer.concat([...local,cd,end]));
fs.writeFileSync(path.join(dist,'SHA256SUMS.txt'),['deepsnake-flash-extension.zip','deepsnake-flash.js'].map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,name))).digest('hex')+'  '+name).join('\n')+'\n');console.log('Built extension ZIP, standalone script, and checksums.');
