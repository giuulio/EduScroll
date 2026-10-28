import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

test('inference stays local and a missing key fails safely',async()=>{
 const port=34000+Math.floor(Math.random()*1000);
 const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:String(port),OPENAI_API_KEY:'',API_ACCESS_TOKEN:'',ALLOWED_ORIGINS:'http://127.0.0.1:5173'},stdio:'ignore'});
 const url=`http://127.0.0.1:${port}`;
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(url+'/api/health')).ok){ready=true;break;}}catch{}await delay(100);}
  assert.ok(ready,'test server should start');
  const health=await (await fetch(url+'/api/health')).json();assert.equal(health.configured,false);
  const blocked=await fetch(url+'/api/feed',{method:'POST',headers:{Origin:'https://giuulio.github.io','Content-Type':'application/json'},body:JSON.stringify({topic:'robotics'})});assert.equal(blocked.status,403);
  const missing=await fetch(url+'/api/feed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:'robotics'})});assert.equal(missing.status,503);assert.match((await missing.json()).error,/OPENAI_API_KEY/);
  const invalid=await fetch(url+'/api/paper',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'https://evil.test'})});assert.equal(invalid.status,400);
 }finally{child.kill('SIGTERM');}
});
