import type {Paper,FeedResult,Detail,ModelName,FeedEvent} from './types';
import type {DateRange,SortOrder} from './discovery';
import {dateBounds,matchesDate,rankPapers,relevanceScore} from './discovery';
import demoData from './demo.json';
import {ensureVisual} from './visuals';
import {hostedApiBase} from './hosting';
export const demoPapers=(demoData as Paper[]).map(ensureVisual);
let sessionKey='';
let localAccessToken='';
export function configureLocalAccessToken(token:string){localAccessToken=token.trim();}
let selectedModel:ModelName='gpt-6.1-terra';
let localConfigured=false;
export function apiBase(){return import.meta.env.DEV?'':hostedApiBase;}
export function hasSessionKey(){return sessionKey.length>0;}
export function activeModel(){return selectedModel;}
export function disconnect(){sessionKey='';localAccessToken='';selectedModel='gpt-6.1-terra';localConfigured=false;}
const endpoint=(path:string)=>`${apiBase()}${path}`;
function headers(extra:Record<string,string>={}){return {...extra,...(localAccessToken?{'X-EduScroll-Access-Token':localAccessToken}:{}),...(sessionKey?{Authorization:`Bearer ${sessionKey}`}:{})};}
async function jsonResponse<T>(response:Response):Promise<T>{
 const body=await response.json().catch(()=>({error:'The research service returned an unreadable response.'}));
 if(!response.ok)throw new Error(body.error??'The research service is unavailable. Please try again.');return body;
}
export async function request<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 if(!import.meta.env.DEV&&!apiBase())throw new Error('The hosted research service is not configured. You can still browse the demo.');
 const response=await fetch(endpoint(path),{method:body?'POST':'GET',headers:headers(body?{'Content-Type':'application/json'}:{}),...(body?{body:JSON.stringify(body)}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000),cache:'no-store'});
 return jsonResponse<T>(response);
}
export async function connect(key:string,model:ModelName='gpt-6.1-terra',signal?:AbortSignal){
 const candidate=key.trim();if(!candidate)throw new Error('Enter your OpenAI API key.');
 if(!import.meta.env.DEV&&!apiBase())throw new Error('The hosted research service is not configured.');
 const response=await fetch(endpoint('/api/connection'),{method:'POST',headers:{...headers({'Content-Type':'application/json'}),Authorization:`Bearer ${candidate}`} ,body:JSON.stringify({model}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),cache:'no-store'});
 await jsonResponse(response);signal?.throwIfAborted();sessionKey=candidate;selectedModel=model;return true;
}
export async function isLive(){
 if(sessionKey)return true;
 if(!import.meta.env.DEV)return false;
 try{localConfigured=(await request<{configured:boolean}>('/api/health')).configured;return localConfigured;}catch{return false;}
}
function demoMatches(topic:string){
 const q=topic.toLowerCase().trim();if(/^(ai|artificial intelligence|research|everything|surprise me|machine learning|new research)$/i.test(q))return demoPapers;
 return demoPapers.filter(p=>relevanceScore(p,topic)>0);
}
export function sampleFeed(topic:string,cursor:number,range:DateRange='any',sort:SortOrder='relevance',now=new Date()):FeedResult{
 const matches=demoMatches(topic);const within=matches.filter(p=>matchesDate(p.published,range,now));
 const expanded=range!=='any'&&within.length===0&&matches.length>0;const list=rankPapers(expanded?matches:within,topic,sort,now);
 return {papers:list.slice(cursor,cursor+10),nextCursor:cursor+10,hasMore:cursor+10<list.length,mode:'demo',requestedRange:range,effectiveRange:expanded?'any':range,expanded,
 message:expanded?'No demo matches in this period. Showing related papers from the fixed 27 Oct 2026 collection.':matches.length?undefined:'No matching papers in this demo collection. Connect your key to search more sources.'};
}
export interface FeedOptions {topic:string;range:DateRange;sort:SortOrder;cursor:number;exclude:string[];mode:'live'|'demo';snapshot?:string;signal?:AbortSignal;onEvent?:(event:FeedEvent)=>void;}
export async function getFeed(options:FeedOptions):Promise<FeedResult>{
 const {topic,range,sort,cursor,exclude,mode,snapshot,signal,onEvent}=options;
 if(mode==='demo'){const result=sampleFeed(topic,cursor,range,sort);onEvent?.({type:'complete',result});return result;}
 const response=await fetch(endpoint('/api/feed'),{method:'POST',headers:headers({'Content-Type':'application/json',Accept:'application/x-ndjson'}),body:JSON.stringify({topic,range,sort,cursor,exclude,snapshot,model:selectedModel}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000),cache:'no-store'});
 if(!response.ok||!response.headers.get('content-type')?.includes('ndjson'))return jsonResponse<FeedResult>(response);
 if(!response.body)throw new Error('The research stream could not be opened.');
 const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let result:FeedResult|undefined;
 function consume(line:string){if(!line.trim())return;const event=JSON.parse(line) as FeedEvent;if(event.type==='error')throw new Error(event.error);if(event.type==='complete')result=event.result;onEvent?.(event);}
 try{for(;;){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let newline;while((newline=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,newline));buffer=buffer.slice(newline+1);}if(done)break;}if(buffer.trim())consume(buffer);}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 if(!result)throw new Error('The research stream stopped early. Please retry.');return result;
}
export async function getDetail(paper:Paper,mode:'live'|'demo',signal?:AbortSignal):Promise<Detail>{
 if(mode==='live')return request('/api/paper',{id:paper.id,model:selectedModel},signal);
 return {paragraphs:[paper.summary],takeaway:paper.whyItMatters,limitation:'This explanation uses the abstract. Check the original publication for the complete methods and results.',basis:'demo',sections:['Abstract'],figure:paper.figure};
}
export const currentDateBounds=dateBounds;
