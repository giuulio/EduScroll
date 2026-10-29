import test from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import {createService} from '../server/service';
import type {ServiceOptions} from '../server/service';
import type {Paper,FeedResult} from '../src/types';
import type {GroundedPaper} from '../server/posts';
import {PublicCache} from '../server/cache';

const fakeKey='unit-test-credential-alpha';
const otherKey='unit-test-credential-bravo';
const origin='https://giuulio.github.io';
const paper:Paper={id:'2610.12345v1',title:'Robot learning from video',abstract:'In 15 tests, robots completed 12 tasks after learning from video.',authors:['A Researcher'],published:'2026-10-28',category:'Robotics',url:'https://arxiv.org/abs/2610.12345v1',headline:'',summary:'',whyItMatters:'',tags:[],source:'arxiv',publicationType:'Preprint'};
const publicPaper=(id:string):Paper=>({...paper,id,url:`https://arxiv.org/abs/${id}`});
function written(p:Paper):GroundedPaper{return {...p,headline:'Robots learn actions from video',summary:'In 15 tests, robots completed 12 tasks after learning from video.',whyItMatters:'',tags:['Robotics'],evidence:[p.abstract],visualPreference:'none',contentBasis:'abstract'};}
const fakeClient={models:{retrieve:async()=>({id:'gpt-6.1-terra'})},responses:{parse:async()=>({output_parsed:{paragraphs:['Robots learned actions from video.'],takeaway:'The experiment tested learning from video.',limitation:'No specific limitation was extracted; consult the original source.',sections:['Results']}})}} as unknown as OpenAI;
const baseOptions:ServiceOptions={mode:'hosted',createClient:()=>fakeClient,discovery:async()=>({papers:[paper],nextCursor:1,hasMore:false,mode:'live',snapshot:'test-snapshot'}),writePosts:async(_ai,_model,papers)=>papers.map(written),lookupPaper:async()=>paper};
function request(path:string,body:unknown,key:string|null=fakeKey,extra:{headers?:Record<string,string>;signal?:AbortSignal;host?:string}={}){
 return new Request(`${extra.host??'https://api.example.test'}${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`} :{}),...extra.headers},body:JSON.stringify(body),signal:extra.signal});
}

test('hosted inference never falls back to an owner key and health contains no credentials',async()=>{
 let created=0;const handle=createService({...baseOptions,ownerKey:fakeKey,createClient:()=>{created++;return fakeClient;}});
 const missing=await handle(request('/api/feed',{topic:'robots'},null));assert.equal(missing.status,401);assert.equal(created,0);
 const health=await handle(new Request('https://api.example.test/api/health',{headers:{Origin:origin}}));
 const json=await health.json();assert.equal(json.configured,false);assert.equal(json.byok,true);assert.equal(json.model,'gpt-6.1-terra');assert.ok(!JSON.stringify(json).includes(fakeKey));
 assert.equal(health.headers.get('access-control-allow-origin'),origin);assert.equal(health.headers.get('cache-control'),'no-store');
});

test('hosted API rejects foreign origins and arbitrary models, IDs, URLs and oversized requests before provider access',async()=>{
 let created=0;const handle=createService({...baseOptions,createClient:()=>{created++;return fakeClient;}});
 assert.equal((await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Origin:'https://evil.test'}}))).status,403);
 assert.equal((await handle(request('/api/feed',{topic:'robots',model:'not-a-model'}))).status,400);
 assert.equal((await handle(request('/api/feed',{topic:'robots',upstream:'https://evil.test'}))).status,400);
 assert.equal((await handle(request('/api/paper',{id:'https://evil.test/paper'}))).status,400);
 assert.equal((await handle(request('/api/feed',{topic:'x'.repeat(25000)}))).status,413);
 assert.equal(created,0);
});

test('local server keeps local host/origin checks and supports owner-key configuration only locally',async()=>{
 const handle=createService({...baseOptions,mode:'local',ownerKey:fakeKey});
 assert.equal((await handle(new Request('http://127.0.0.1:3001/api/health',{headers:{Origin:origin}}))).status,403);
 assert.equal((await handle(new Request('http://remote.test/api/health'))).status,403);
 const health=await handle(new Request('http://127.0.0.1:3001/api/health'));assert.equal((await health.json()).configured,true);
 const response=await handle(request('/api/feed',{topic:'robots'},null,{host:'http://127.0.0.1:3001',headers:{Origin:'http://127.0.0.1:5173'}}));assert.equal(response.status,200);
});

test('connection validates only an allowlisted model, isolates keys and redacts provider error text',async()=>{
 const used:string[]=[];const models:string[]=[];
 const handle=createService({...baseOptions,createClient:key=>{used.push(key);return {models:{retrieve:async(model:string)=>{models.push(model);if(key===otherKey)throw Object.assign(new Error(`provider request included ${otherKey}`),{status:401});return {id:model};}}} as unknown as OpenAI;}});
 const connected=await handle(request('/api/connection',{model:'gpt-6-luna'}));assert.deepEqual(await connected.json(),{ok:true,model:'gpt-6-luna'});
 const rejected=await handle(request('/api/connection',{},otherKey));assert.equal(rejected.status,401);assert.ok(!(await rejected.text()).includes(otherKey));
 assert.deepEqual(used,[fakeKey,otherKey]);assert.deepEqual(models,['gpt-6-luna','gpt-6.1-terra']);
});

test('NDJSON delivers first three cards before waiting for the next batch, with snapshot metadata intact',async()=>{
 let finishLast!:()=>void;const lastBatch=new Promise<void>(resolve=>{finishLast=resolve;});const calls:number[]=[];
 const papers=[paper,publicPaper('2610.12346v1'),publicPaper('2610.12347v1'),publicPaper('2610.12348v1')];
 const handle=createService({...baseOptions,discovery:async()=>({papers,nextCursor:4,hasMore:true,mode:'live',snapshot:'stable-order',requestedRange:'today',effectiveRange:'any',expanded:true,message:'Showing older matches.'}),writePosts:async(_ai,_model,batch)=>{calls.push(batch.length);if(calls.length===2)await lastBatch;return batch.map(written);}});
 const response=await handle(request('/api/feed',{topic:'robots',range:'today'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));assert.match(response.headers.get('content-type')??'',/ndjson/);
 const reader=response.body!.getReader();const decoder=new TextDecoder();const lines:string[]=[];let text='';
 while(lines.filter(line=>JSON.parse(line).type==='card').length<3){const chunk=await reader.read();assert.equal(chunk.done,false);text+=decoder.decode(chunk.value,{stream:true});const split=text.split('\n');text=split.pop()!;lines.push(...split.filter(Boolean));}
 assert.equal(lines.some(line=>JSON.parse(line).type==='complete'),false);finishLast();
 for(;;){const chunk=await reader.read();if(chunk.done)break;text+=decoder.decode(chunk.value,{stream:true});}
 lines.push(...text.split('\n').filter(Boolean));const events=lines.map(line=>JSON.parse(line));
 assert.deepEqual(calls,[3,1]);assert.equal(events.filter(event=>event.type==='card').length,4);
 const result=events.find(event=>event.type==='complete').result as FeedResult;assert.equal(result.snapshot,'stable-order');assert.equal(result.expanded,true);assert.equal(result.papers.length,4);assert.equal(result.nextCursor,4);
});

test('stream cancellation propagates to active writing and does not start later batches',async()=>{
 let started!:()=>void;const writing=new Promise<void>(resolve=>{started=resolve;});let stopped!:()=>void;const aborted=new Promise<void>(resolve=>{stopped=resolve;});let calls=0;
 const handle=createService({...baseOptions,discovery:async()=>({papers:[paper,publicPaper('2610.12346'),publicPaper('2610.12347'),publicPaper('2610.12348')],nextCursor:4,hasMore:false,mode:'live'}),writePosts:async(_ai,_model,_papers,signal)=>{calls++;started();await new Promise<void>((_resolve,reject)=>signal!.addEventListener('abort',()=>{stopped();reject(new DOMException('Stopped','AbortError'));},{once:true}));return [];}});
 const response=await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));const reader=response.body!.getReader();await writing;await reader.cancel();await aborted;assert.equal(calls,1);
});

test('a backend deadline aborts active work and sends an actionable stream error',async()=>{
 let stopped=false;const handle=createService({...baseOptions,requestTimeoutMs:50,writePosts:async(_ai,_model,_papers,signal)=>{await new Promise<void>((_resolve,reject)=>signal!.addEventListener('abort',()=>{stopped=true;reject(signal!.reason);},{once:true}));return [];}});
 const keepAlive=setTimeout(()=>{},200);
 try{const response=await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));assert.equal(stopped,true);assert.equal(events.some(event=>event.type==='complete'),false);assert.match(events.find(event=>event.type==='error').error,/took too long/);}finally{clearTimeout(keepAlive);}
});

test('public post cache reuses paper content across visitors but invalidates model and source changes',async()=>{
 let count=0;let evidence=paper.abstract;let reason='First query';const seen:string[]=[];
 const handle=createService({...baseOptions,createClient:key=>{seen.push(key);return fakeClient;},discovery:async()=>({papers:[{...paper,abstract:evidence,rankingReason:reason}],nextCursor:1,hasMore:false,mode:'live'}),writePosts:async(_ai,_model,batch)=>{count++;return batch.map(written);}});
 await handle(request('/api/feed',{topic:'robots'}));reason='Second query';
 const cached=await handle(request('/api/feed',{topic:'video'},otherKey));assert.equal((await cached.json()).papers[0].rankingReason,'Second query');assert.equal(count,1);
 await handle(request('/api/feed',{topic:'robots',model:'gpt-6-luna'}));assert.equal(count,2);
 evidence='In 16 tests, robots completed 13 tasks after learning from video.';await handle(request('/api/feed',{topic:'robots'}));assert.equal(count,3);assert.deepEqual(seen,[fakeKey,otherKey,fakeKey,fakeKey]);
});

test('non-arXiv details use honest abstract labels and never fetch an arbitrary full-text URL',async()=>{
 let fullTextCalls=0;const handle=createService({...baseOptions,lookupPaper:async()=>({...paper,id:'epmc:MED:123',source:'europepmc'}),fullText:async()=>{fullTextCalls++;throw new Error('should not fetch');}});
 const response=await handle(request('/api/paper',{id:'epmc:MED:123'}));const detail=await response.json();assert.equal(detail.basis,'abstract');assert.deepEqual(detail.sections,['Abstract']);assert.equal(fullTextCalls,0);
});

test('missing abstracts are skipped truthfully without paying for title-only inference',async()=>{
 let writes=0;const handle=createService({...baseOptions,discovery:async()=>({papers:[{...paper,abstract:''}],nextCursor:1,hasMore:false,mode:'live'}),writePosts:async()=>{writes++;return [];}});
 const response=await handle(request('/api/feed',{topic:'robots'}));const feed=await response.json();assert.deepEqual(feed.papers,[]);assert.match(feed.message,/no usable abstract/);assert.equal(feed.nextCursor,1);assert.equal(writes,0);
});

test('expired source snapshots return a restart action without leaking arbitrary source messages',async()=>{
 const handle=createService({...baseOptions,discovery:async()=>{throw Object.assign(new Error('Untrusted provider text'),{status:409});}});
 const response=await handle(request('/api/feed',{topic:'robots',snapshot:'expired'}));assert.equal(response.status,409);assert.match((await response.json()).error,/Search again/);
});

test('per-visitor concurrency rejects a third active request and releases slots on completion',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let arrivals=0;let ready!:()=>void;const entered=new Promise<void>(resolve=>{ready=resolve;});
 const handle=createService({...baseOptions,createClient:()=>({models:{retrieve:async()=>{arrivals++;if(arrivals===2)ready();await gate;return {id:'gpt-6.1-terra'};}}}) as unknown as OpenAI});
 const first=handle(request('/api/connection',{}),{ip:'same-visitor'});const second=handle(request('/api/connection',{}),{ip:'same-visitor'});await entered;
 assert.equal((await handle(request('/api/connection',{}),{ip:'same-visitor'})).status,429);release();assert.equal((await first).status,200);assert.equal((await second).status,200);assert.equal((await handle(request('/api/connection',{}),{ip:'same-visitor'})).status,200);
});

test('bounded public caches evict older entries rather than grow indefinitely',()=>{
 const cache=new PublicCache<number>(2,60000);cache.set('paper-a',1);cache.set('paper-b',2);assert.equal(cache.get('paper-a'),1);cache.set('paper-c',3);assert.equal(cache.size,2);assert.equal(cache.get('paper-b'),undefined);assert.equal(cache.get('paper-a'),1);
});
