import type {FeedResult,Paper} from '../src/types';
import {dateBounds,matchesDate,normalizedText,paperIdentity,queryConcepts,rankPapers,type DateRange,type SortOrder} from '../src/discovery';
import {clean,getPaper,paperIdPattern,searchArxiv} from './papers';

export interface DiscoveryRequest {
 topic:string;range:DateRange;sort:SortOrder;cursor:number;exclude:string[];snapshot?:string;signal?:AbortSignal;
}
type Snapshot={id:string;topic:string;range:DateRange;sort:SortOrder;papers:Paper[];expires:number;day:string;effectiveRange:DateRange;message?:string;sourceWarnings:string[]};
const snapshots=new Map<string,Snapshot>();
const known=new Map<string,{paper:Paper;expires:number}>();
const snapshotLifetime=15*60*1000;
const pageSize=10;
const epmcPattern=/^epmc:(MED|PMC|PPR):([A-Za-z0-9][A-Za-z0-9._-]{0,79})$/;
const openalexPattern=/^openalex:(W\d+)$/;
export function discoveredPaperId(id:string):boolean{return paperIdPattern.test(id)||epmcPattern.test(id)||openalexPattern.test(id);}

function sourceText(value:unknown):string{return clean(value).replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot);/g,entity=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[entity]??entity)).replace(/\s+/g,' ').trim();}
function doiFor(value:unknown):string|undefined{
 const doi=clean(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
 return /^10\.\d{4,9}\/\S+$/i.test(doi)?doi:undefined;
}
function blankPost(){return {headline:'',summary:'',whyItMatters:'',tags:[] as string[]};}
function remember(papers:Paper[]){for(const paper of papers){known.set(paper.id,{paper,expires:Date.now()+snapshotLifetime});if(known.size>600)known.delete(known.keys().next().value!);}}
function boundedSignal(signal?:AbortSignal){return signal?AbortSignal.any([signal,AbortSignal.timeout(7000)]):AbortSignal.timeout(7000);}
async function sourceJson(url:URL,signal?:AbortSignal):Promise<any>{
 const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EduScroll/0.2 (research discovery prototype)'},signal:boundedSignal(signal)});
 if(!response.ok)throw new Error('Source unavailable.');
 if(Number(response.headers.get('content-length')??0)>4_000_000)throw new Error('Source response is too large.');
 const text=await response.text();if(text.length>4_000_000)throw new Error('Source response is too large.');return JSON.parse(text);
}

export function europePmcQuery(topic:string,range:DateRange,now=new Date()):string{
 const groups=queryConcepts(topic);if(!groups.length)throw new Error('Enter a research topic with a subject to search.');
 const query=groups.map(group=>`(${group.map(term=>`"${term}"`).join(' OR ')})`).join(' AND ');
 const {from,to}=dateBounds(range,now);return `${query} AND (SRC:MED OR SRC:PMC OR SRC:PPR) AND FIRST_PDATE:[${from??'1900-01-01'} TO ${to}]`;
}
export function parseEuropePmc(data:any):Paper[]{
 const entries=Array.isArray(data?.resultList?.result)?data.resultList.result:[];
 return entries.slice(0,50).flatMap((entry:any)=>{
  const source=clean(entry.source);const externalId=clean(entry.id);const id=`epmc:${source}:${externalId}`;
  const title=sourceText(entry.title);if(!epmcPattern.test(id)||!title)return [];
  const doi=doiFor(entry.doi);
  const authors=Array.isArray(entry.authorList?.author)?entry.authorList.author.map((author:any)=>sourceText(author.fullName??`${author.firstName??''} ${author.lastName??''}`)).filter(Boolean).slice(0,12):clean(entry.authorString).split(/,\s*/).filter(Boolean).slice(0,12);
  return [{id,title,authors,published:clean(entry.firstPublicationDate??entry.pubYear),category:'Biomedicine',abstract:sourceText(entry.abstractText).slice(0,18000),url:`https://europepmc.org/article/${source}/${encodeURIComponent(externalId)}`,source:'europepmc' as const,publicationType:Array.isArray(entry.pubTypeList?.pubType)?entry.pubTypeList.pubType.map(sourceText).join(' · '):source==='PPR'?'Preprint':'Research article',...(doi?{doi}:{}),...blankPost()}];
 });
}
async function europePmc(topic:string,range:DateRange,sort:SortOrder,signal?:AbortSignal):Promise<Paper[]>{
 const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
 url.search=new URLSearchParams({query:europePmcQuery(topic,range)+(sort==='latest'?' sort_date:y':''),format:'json',resultType:'core',pageSize:'24'}).toString();
 return parseEuropePmc(await sourceJson(url,signal));
}

function abstractFromIndex(index:unknown):string{
 if(!index||typeof index!=='object')return '';
 const words=new Map<number,string>();
 for(const [word,positions] of Object.entries(index)){if(!Array.isArray(positions))continue;for(const position of positions){if(Number.isInteger(position)&&position>=0&&position<5000)words.set(position,word.slice(0,150));}}
 return Array.from(words).sort((a,b)=>a[0]-b[0]).map(([,word])=>word).join(' ').slice(0,18000);
}
export function parseOpenAlex(data:any):Paper[]{
 const entries=Array.isArray(data?.results)?data.results:[];
 return entries.slice(0,50).flatMap((entry:any)=>{
  const externalId=clean(entry.id).match(/^https:\/\/openalex\.org\/(W\d+)$/)?.[1];
  const title=sourceText(entry.title??entry.display_name);if(!externalId||!title)return [];
  const doi=doiFor(entry.doi);
  return [{id:`openalex:${externalId}`,title,authors:(Array.isArray(entry.authorships)?entry.authorships:[]).map((authorship:any)=>sourceText(authorship.author?.display_name)).filter(Boolean).slice(0,12),published:clean(entry.publication_date??entry.publication_year),category:sourceText(entry.primary_topic?.subfield?.display_name??entry.primary_topic?.display_name)||'Research',abstract:abstractFromIndex(entry.abstract_inverted_index),url:doi?`https://doi.org/${doi}`:`https://openalex.org/${externalId}`,source:'openalex' as const,publicationType:sourceText(entry.type).replaceAll('-',' ')||'Research article',...(doi?{doi}:{}),...blankPost()}];
 });
}
async function openAlex(topic:string,range:DateRange,_sort:SortOrder,signal?:AbortSignal):Promise<Paper[]>{
 const url=new URL('https://api.openalex.org/works');const {from,to}=dateBounds(range);
 const filter=[...(from?[`from_publication_date:${from}`]:[]),`to_publication_date:${to}`].join(',');
 // Semantic search handles unfamiliar concepts and different wording without an LLM call.
 url.search=new URLSearchParams({'search.semantic':topic,filter,per_page:'24',select:'id,doi,title,authorships,publication_date,publication_year,primary_topic,type,abstract_inverted_index'}).toString();
 const deadline=boundedSignal(signal);
 try{return parseOpenAlex(await sourceJson(url,AbortSignal.any([deadline,AbortSignal.timeout(4500)])));}
 catch{
  deadline.throwIfAborted();
  // A text query remains available when semantic search is disabled, busy, or over budget.
  url.searchParams.delete('search.semantic');
  url.searchParams.set('search',queryConcepts(topic).map(group=>`(${group.map(term=>term.includes(' ')?`"${term}"`:term.length>=5?`${term}~1`:term).join(' OR ')})`).join(' AND '));
  return parseOpenAlex(await sourceJson(url,deadline));
 }
}

async function candidates(topic:string,range:DateRange,sort:SortOrder,signal?:AbortSignal){
 const names=['arXiv','Europe PMC','OpenAlex'];
 const results=await Promise.allSettled([searchArxiv(topic,range,sort,signal).then(result=>result.papers),europePmc(topic,range,sort,signal),openAlex(topic,range,sort,signal)]);
 signal?.throwIfAborted();
 const papers:Paper[]=[];const warnings:string[]=[];let successful=0;
 results.forEach((result,index)=>{if(result.status==='fulfilled'){successful++;papers.push(...result.value);}else warnings.push(`${names[index]} is temporarily unavailable.`);});
 return {papers:papers.filter(paper=>matchesDate(paper.published,range)),warnings,successful};
}

function page(snapshot:Snapshot,request:DiscoveryRequest):FeedResult{
 const excluded=new Set(request.exclude.map(paperIdentity));const papers:Paper[]=[];let nextCursor=request.cursor;
 while(nextCursor<snapshot.papers.length&&papers.length<pageSize){const paper=snapshot.papers[nextCursor++];if(!excluded.has(paperIdentity(paper.id)))papers.push(paper);}
 return {papers,nextCursor,hasMore:snapshot.papers.slice(nextCursor).some(paper=>!excluded.has(paperIdentity(paper.id))),mode:'live',snapshot:snapshot.id,requestedRange:snapshot.range,effectiveRange:snapshot.effectiveRange,expanded:snapshot.effectiveRange!==snapshot.range,...(snapshot.message?{message:snapshot.message}:{}),...(snapshot.sourceWarnings.length?{sourceWarnings:snapshot.sourceWarnings}:{})};
}

function recoveredPage(snapshot:Snapshot,request:DiscoveryRequest,recovered:boolean):FeedResult{
 const result=page(snapshot,recovered?{...request,cursor:0}:request);
 if(recovered)result.message=[result.message,'Results refreshed; previously shown papers are excluded.'].filter(Boolean).join(' ');
 return result;
}

export async function discover(request:DiscoveryRequest):Promise<FeedResult>{
 request.signal?.throwIfAborted();
 const topic=request.topic.trim();if(!queryConcepts(topic).length)throw Object.assign(new Error('Enter a research topic with a subject to search.'),{status:400});
 const day=dateBounds('today').to;
 for(const [id,snapshot] of snapshots)if(snapshot.expires<Date.now()||snapshot.day!==day)snapshots.delete(id);
 let recovered=false;
 if(request.snapshot){
  const snapshot=snapshots.get(request.snapshot);
  if(!snapshot)recovered=true;
  else{
   if(snapshot.topic!==normalizedText(topic)||snapshot.range!==request.range||snapshot.sort!==request.sort)throw Object.assign(new Error('The feed changed. Search again to refresh its results.'),{status:409});
   return page(snapshot,request);
  }
 }
 const existing=Array.from(snapshots.values()).find(snapshot=>snapshot.topic===normalizedText(topic)&&snapshot.range===request.range&&snapshot.sort===request.sort);
 if(existing)return recoveredPage(existing,request,recovered);
 const found=await candidates(topic,request.range,request.sort,request.signal);
 if(!found.successful)throw Object.assign(new Error('Research sources are temporarily unavailable. Try again shortly.'),{status:502});
 let papers=found.papers;let effectiveRange=request.range;let message:string|undefined;const sourceWarnings=[...found.warnings];
 if(!papers.length&&request.range!=='any'){
  const expanded=await candidates(topic,'any',request.sort,request.signal);
  sourceWarnings.push(...expanded.warnings);
  if(expanded.papers.length){papers=expanded.papers;effectiveRange='any';const label=request.range==='today'?'today':request.range==='week'?'this week':'this month';message=`No matches ${label}. Showing related research from all dates.`;}
 }
 papers=rankPapers(papers,topic,request.sort);remember(papers);
 const snapshot:Snapshot={id:crypto.randomUUID(),topic:normalizedText(topic),range:request.range,sort:request.sort,papers,expires:Date.now()+snapshotLifetime,day,effectiveRange,message,sourceWarnings:[...new Set(sourceWarnings)]};
 if(snapshots.size>=24)snapshots.delete(snapshots.keys().next().value!);snapshots.set(snapshot.id,snapshot);
 return recoveredPage(snapshot,request,recovered);
}

export async function getDiscoveredPaper(id:string,signal?:AbortSignal):Promise<Paper>{
 signal?.throwIfAborted();if(!discoveredPaperId(id))throw Object.assign(new Error('Invalid paper ID.'),{status:400});
 const hit=known.get(id);if(hit&&hit.expires>Date.now())return hit.paper;if(hit)known.delete(id);
 if(paperIdPattern.test(id))return getPaper(id,signal);
 let papers:Paper[]=[];const epmc=id.match(epmcPattern);const openalex=id.match(openalexPattern);
 if(epmc){const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');url.search=new URLSearchParams({query:`EXT_ID:"${epmc[2]}" AND SRC:${epmc[1]}`,format:'json',resultType:'core',pageSize:'1'}).toString();papers=parseEuropePmc(await sourceJson(url,signal));}
 if(openalex){const url=new URL(`https://api.openalex.org/works/${openalex[1]}`);const result=await sourceJson(url,signal);papers=parseOpenAlex({results:[result]});}
 const paper=papers.find(paper=>paper.id===id);if(!paper)throw Object.assign(new Error('This paper could not be found at its original source.'),{status:404});remember([paper]);return paper;
}
