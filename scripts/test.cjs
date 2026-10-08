const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
process.chdir(path.resolve(__dirname,'..'));let failed=false;
for(const dir of ['src','extension'])for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',path.join(dir,name)],{encoding:'utf8'});if(result.status!==0){failed=true;console.error(result.stderr);}}
const tests=fs.readdirSync('tests').filter(name=>/^check-.*\.cjs$/.test(name)).sort();
for(const name of tests){const result=spawnSync(process.execPath,[path.join('tests',name)],{encoding:'utf8',timeout:30000});if(result.status!==0){failed=true;console.error('FAIL '+name+'\n'+result.stdout+result.stderr);}else console.log('PASS '+name);}
console.log(`${tests.length} regression checks; ${failed?'failures above':'all passed'}.`);process.exitCode=failed?1:0;
