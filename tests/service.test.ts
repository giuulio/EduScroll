import test from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import {createService} from '../server/service';
import type {ServiceOptions} from '../server/service';
import type {Paper,FeedResult,TopicOverview} from '../src/types';
import type {GroundedPaper} from '../server/posts';
import {PublicCache} from '../server/cache';

const fakeKey='unit-test-credential-alpha';
const otherKey='unit-test-credential-bravo';
const origin='https://giuulio.github.io';
const paper:Paper={id:'2610.12345v1',title:'Robot learning from video',abstract:'In 15 tests, robots completed 12 tasks after learning from video.',authors:['A Researcher'],published:'2026-10-28',category:'Robotics',url:'https://arxiv.org/abs/2610.12345v1',headline:'',summary:'',whyItMatters:'',tags:[],source:'arxiv',publicationType:'Preprint'};
const publicPaper=(id:string):Paper=>({...paper,id,url:`https://arxiv.org/abs/${id}`});
function written(p:Paper):GroundedPaper{return {...p,headline:'Robots learn actions from video',summary:'In 15 tests, robots completed 12 tasks after learning from video.',whyItMatters:'',tags:['Robotics'],evidence:[p.abstract],visualPreference:'none',contentBasis:'abstract'};}
const fakeClient={models:{retrieve:async()=>({id:'gpt-6.1-terra'})},responses:{parse:async()=>({output_parsed:{paragraphs:['Robots learned actions from video.'],takeaway:'The experiment tested learning from video.',limitation:'No specific limitation was extracted; consult the original source.',sections:['Results']}})}} as unknown as OpenAI;
const baseOptions:ServiceOptions={mode:'hosted',createClient:()=>fakeClient,discovery:async()=>({papers:[paper],nextCursor:1,hasMore:false,mode:'live',snapshot:'test-snapshot'}),writePosts:async(_ai,_model,papers)=>papers.map(written),writeOverview:async()=>undefined,enrichFigure:async()=>undefined,lookupPaper:async()=>paper};
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

test('NDJSON delivers the first card before waiting for the rest, with snapshot metadata intact',async()=>{
 let finishLast!:()=>void;const lastBatch=new Promise<void>(resolve=>{finishLast=resolve;});const calls:number[]=[];
 const papers=[paper,publicPaper('2610.12346v1'),publicPaper('2610.12347v1'),publicPaper('2610.12348v1')];
 const handle=createService({...baseOptions,discovery:async()=>({papers,nextCursor:4,hasMore:true,mode:'live',snapshot:'stable-order',requestedRange:'today',effectiveRange:'any',expanded:true,message:'Showing older matches.'}),writePosts:async(_ai,_model,batch)=>{calls.push(batch.length);if(calls.length===2)await lastBatch;return batch.map(written);}});
 const response=await handle(request('/api/feed',{topic:'robots',range:'today'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));assert.match(response.headers.get('content-type')??'',/ndjson/);
 const reader=response.body!.getReader();const decoder=new TextDecoder();const lines:string[]=[];let text='';
 while(lines.filter(line=>JSON.parse(line).type==='card').length<1){const chunk=await reader.read();assert.equal(chunk.done,false);text+=decoder.decode(chunk.value,{stream:true});const split=text.split('\n');text=split.pop()!;lines.push(...split.filter(Boolean));}
 assert.equal(lines.some(line=>JSON.parse(line).type==='complete'),false);
 assert.equal(lines.map(line=>JSON.parse(line)).find(event=>event.type==='metadata').message,'Showing older matches.');finishLast();
 for(;;){const chunk=await reader.read();if(chunk.done)break;text+=decoder.decode(chunk.value,{stream:true});}
 lines.push(...text.split('\n').filter(Boolean));const events=lines.map(line=>JSON.parse(line));
 assert.deepEqual(calls,[1,3]);assert.equal(events.filter(event=>event.type==='card').length,4);
 const result=events.find(event=>event.type==='complete').result as FeedResult;assert.equal(result.snapshot,'stable-order');assert.equal(result.expanded,true);assert.equal(result.papers.length,4);assert.equal(result.nextCursor,4);
});

test('stream cancellation stops both active text workers and does not start queued batches',async()=>{
 let started!:()=>void;const writing=new Promise<void>(resolve=>{started=resolve;});let stopped!:()=>void;const aborted=new Promise<void>(resolve=>{stopped=resolve;});let calls=0;
 const handle=createService({...baseOptions,discovery:async()=>({papers:[paper,...Array.from({length:6},(_,i)=>publicPaper(`2610.${12346+i}`))],nextCursor:4,hasMore:false,mode:'live'}),writePosts:async(_ai,_model,_papers,signal)=>{calls++;started();await new Promise<void>((_resolve,reject)=>signal!.addEventListener('abort',()=>{stopped();reject(new DOMException('Stopped','AbortError'));},{once:true}));return [];}});
 const response=await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));const reader=response.body!.getReader();await writing;await reader.cancel();await aborted;assert.equal(calls,2);
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


const sourceFigure:NonNullable<Paper['figure']>={url:'https://arxiv.org/html/2610.12345v1/figure.png',caption:'The tested robot holding a cup.',kind:'paper',readable:true,crop:{x:.05,y:.1,width:.6,height:.75},sourceUrl:paper.url,panel:'a'};
function overviewFor(p:Paper):TopicOverview{return {title:'Robot learning results',basis:'retrieved-papers',facts:[{text:'Robots completed 12 tasks in 15 tests.',paperIds:[p.id],evidence:[p.abstract]}]};}
async function streamEvents(response:Response){return (await response.text()).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}

test('source briefing is instant and overview refinement runs concurrently with text',async()=>{
 let releaseText!:()=>void;const textGate=new Promise<void>(resolve=>{releaseText=resolve;});
 let releaseOverview!:()=>void;const overviewGate=new Promise<void>(resolve=>{releaseOverview=resolve;});
 let textStarted=false,overviewStarted=false;let markStarted!:()=>void;const bothStarted=new Promise<void>(resolve=>{markStarted=resolve;});
 const handle=createService({...baseOptions,writePosts:async(_ai,_model,batch)=>{textStarted=true;await textGate;return batch.map(written);},writeOverview:async()=>{overviewStarted=true;markStarted();await overviewGate;return overviewFor(paper);}});
 const response=await handle(request('/api/feed',{topic:'robotics'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));
 const reader=response.body!.getReader();const decoder=new TextDecoder();let content='';
 while(!content.includes('"type":"overview"')){const chunk=await reader.read();assert.equal(chunk.done,false);content+=decoder.decode(chunk.value);}
 await bothStarted;assert.equal(textStarted,true);assert.equal(overviewStarted,true);assert.equal(content.includes('"type":"card"'),false);
 const instant=content.split('\n').filter(Boolean).map(line=>JSON.parse(line)).find(event=>event.type==='overview');assert.equal(instant.overview.sources[0].url,paper.url);
 releaseOverview();
 while(!content.includes('Robot learning results')){const chunk=await reader.read();assert.equal(chunk.done,false);content+=decoder.decode(chunk.value);}
 assert.equal(content.includes('"type":"card"'),false);releaseText();
 for(;;){const chunk=await reader.read();if(chunk.done)break;content+=decoder.decode(chunk.value);}
 const complete=content.split('\n').filter(Boolean).map(line=>JSON.parse(line)).find(event=>event.type==='complete');assert.equal(complete.result.overview.title,'Robot learning results');
});

test('text cards arrive before slow figure selection and late crop patches survive complete',async()=>{
 let releaseFigure!:()=>void;const gate=new Promise<void>(resolve=>{releaseFigure=resolve;});let selecting=false;
 const handle=createService({...baseOptions,enrichFigure:async()=>{selecting=true;await gate;return sourceFigure;}});
 const response=await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));const reader=response.body!.getReader();const decoder=new TextDecoder();let content='';
 while(!content.includes('"type":"card"')){const chunk=await reader.read();assert.equal(chunk.done,false);content+=decoder.decode(chunk.value);}
 assert.equal(selecting,true);assert.equal(content.includes('"type":"complete"'),false);
 while(!content.includes('"type":"posts-ready"')){const chunk=await reader.read();assert.equal(chunk.done,false);content+=decoder.decode(chunk.value);}
 const early=content.split('\n').filter(Boolean).map(line=>JSON.parse(line)).find(event=>event.type==='posts-ready');assert.equal(early.result.nextCursor,1);assert.equal(early.result.papers.length,1);assert.equal(content.includes('"type":"figure"'),false);releaseFigure();
 for(;;){const chunk=await reader.read();if(chunk.done)break;content+=decoder.decode(chunk.value);}
 const events=content.split('\n').filter(Boolean).map(line=>JSON.parse(line));assert.deepEqual(events.find(event=>event.type==='figure').figure.crop,sourceFigure.crop);
 const final=events.find(event=>event.type==='complete').result.papers[0];assert.equal(final.figure.kind,'paper');assert.equal(final.visualPreference,undefined);
});

test('figure selection receives the written post and its patch survives the final result',async()=>{
 const handle=createService({...baseOptions,enrichFigure:async(_ai,_model,post)=>{assert.equal(post.summary,written(paper).summary);return sourceFigure;},writePosts:async(_ai,_model,batch)=>{await new Promise(resolve=>setTimeout(resolve,5));return batch.map(written);}});
 const events=await streamEvents(await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}})));
 assert.equal(events.findIndex(event=>event.type==='figure')>events.findIndex(event=>event.type==='card'),true);
 assert.equal(events.find(event=>event.type==='card').paper.figure,undefined);assert.equal(events.at(-1).result.papers[0].figure.url,sourceFigure.url);
});

test('overview and figure failures do not fail readable posts',async()=>{
 const handle=createService({...baseOptions,enrichFigure:async()=>{throw new Error('Image unavailable');},writeOverview:async()=>{throw new Error('Overview unavailable');}});
 const events=await streamEvents(await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}})));
 assert.equal(events.some(event=>event.type==='error'),false);assert.equal(events.filter(event=>event.type==='card').length,1);assert.equal(events.at(-1).type,'complete');assert.ok(events.at(-1).result.overview);assert.ok(events.some(event=>event.type==='visual-status'&&event.status==='unavailable'));
});

test('media deadline stops active selections and skips queued figures without delaying text',async()=>{
 let started=0,stopped=0;const keepAlive=setTimeout(()=>{},200);
 const handle=createService({...baseOptions,mediaTimeoutMs:15,discovery:async()=>({papers:[paper,publicPaper('2610.12346'),publicPaper('2610.12347')],nextCursor:3,hasMore:false,mode:'live'}),enrichFigure:async(_ai,_model,_paper,signal)=>{started++;await new Promise<void>((_resolve,reject)=>signal!.addEventListener('abort',()=>{stopped++;reject(signal!.reason);},{once:true}));return undefined;}});
 try{const events=await streamEvents(await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}})));assert.equal(started,2);assert.equal(stopped,2);assert.equal(events.filter(event=>event.type==='card').length,3);assert.equal(events.at(-1).type,'complete');assert.equal(events.filter(event=>event.type==='visual-status'&&event.status==='unavailable').length,3);}finally{clearTimeout(keepAlive);}
});


test('a later text batch can finish first without emitting cards out of ranked order',async()=>{
 let releaseFirst!:()=>void;const firstGate=new Promise<void>(resolve=>{releaseFirst=resolve;});
 let laterFinished!:()=>void;const laterDone=new Promise<void>(resolve=>{laterFinished=resolve;});
 let releaseMedia!:()=>void;const mediaGate=new Promise<void>(resolve=>{releaseMedia=resolve;});
 const papers=[paper,publicPaper('2610.12346'),publicPaper('2610.12347'),publicPaper('2610.12348')];
 const handle=createService({...baseOptions,discovery:async()=>({papers,nextCursor:4,hasMore:false,mode:'live'}),writePosts:async(_ai,_model,batch)=>{if(batch[0].id===paper.id)await firstGate;else laterFinished();return batch.map(written);},enrichFigure:async()=>{await mediaGate;return sourceFigure;}});
 const response=await handle(request('/api/feed',{topic:'robots'},fakeKey,{headers:{Accept:'application/x-ndjson'}}));
 await laterDone;await Promise.resolve();releaseMedia();
 const reader=response.body!.getReader();const decoder=new TextDecoder();let content='';
 // Media is released after the later batch completes, giving a deterministic stream marker.
 while(!content.includes('"type":"figure"')){const chunk=await reader.read();assert.equal(chunk.done,false);content+=decoder.decode(chunk.value);}
 assert.equal(content.includes('"type":"card"'),false);
 releaseFirst();for(;;){const chunk=await reader.read();if(chunk.done)break;content+=decoder.decode(chunk.value);}
 const events=content.split('\n').filter(Boolean).map(line=>JSON.parse(line));
 assert.deepEqual(events.filter(event=>event.type==='card').map(event=>event.paper.id),papers.map(p=>p.id));
 assert.deepEqual(events.find(event=>event.type==='complete').result.papers.map((p:Paper)=>p.id),papers.map(p=>p.id));
});
