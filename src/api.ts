import type {Paper,FeedResult,Detail} from './types';
import demoData from './demo.json';
export const demoPapers=demoData as Paper[];
export function apiBase(){return '';}
export async function request<T>(path:string,body?:unknown):Promise<T>{
 const token=sessionStorage.getItem('eduscroll-token');
 const r=await fetch(`${apiBase()}${path}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(150000)});
 const json=await r.json().catch(()=>({error:'The backend did not return a valid response. Check Connection settings.'}));
 if(!r.ok)throw new Error(json.error??'The request failed. Please try again.');return json;
}
export async function isLive(){
 if(!apiBase()&&!import.meta.env.DEV)return false;
 let health:{configured:boolean};
 try{health=await request<{configured:boolean}>('/api/health');}catch{if(!apiBase())return false;throw new Error('The local backend is unavailable. Start npm run dev.');}
 if(!health.configured&&apiBase())throw new Error('The backend is online but its OpenAI key is not configured. Add it to the server .env.');
 return health.configured;
}
export function sampleFeed(topic:string,cursor:number):FeedResult{
 const q=topic.toLowerCase().trim();
 const broad=/^(ai|artificial intelligence|research|everything|surprise me|machine learning|new research)$/i.test(q);
 const terms=q.split(/\s+/).filter(w=>w.length>2);
 const matches=broad?demoPapers:demoPapers.filter(p=>terms.some(t=>`${p.title} ${p.headline} ${p.tags.join(' ')} ${p.summary}`.toLowerCase().includes(t)));
 return {papers:matches.slice(cursor,cursor+10),nextCursor:cursor+10,hasMore:cursor+10<matches.length,mode:'demo'};
}
export async function getFeed(topic:string,days:number,cursor:number,exclude:string[],mode:'live'|'demo'):Promise<FeedResult>{
 if(mode==='live')return request('/api/feed',{topic,days,cursor,exclude});
 return sampleFeed(topic,cursor);
}
export async function getDetail(paper:Paper,mode:'live'|'demo'):Promise<Detail>{
 if(mode==='live')return request('/api/paper',{id:paper.id});
 return {paragraphs:[paper.summary,paper.whyItMatters],takeaway:paper.whyItMatters,limitation:'This demo explanation uses the abstract. Connect a backend to generate an explanation from the full paper.',basis:'demo',sections:['Abstract'],figure:paper.figure};
}
