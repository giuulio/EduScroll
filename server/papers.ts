import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import type { Paper } from '../src/types';

export const paperIdPattern = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/;
export function clean(value: unknown): string { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
export function baseId(id:string):string{return id.replace(/v\d+$/,'');}
export function queryFor(topic:string, days:number, now=new Date()):string {
 const start=new Date(now.getTime()-(days-1)*86400000).toISOString().slice(0,10).replaceAll('-','');
 const end=now.toISOString().slice(0,10).replaceAll('-','');
 const aliases:Record<string,string>={ai:'artificial intelligence',llm:'large language models',llms:'large language models'};
 const words=(aliases[topic.toLowerCase()]??topic).replace(/[^\p{L}\p{N}\s-]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,10);
 if(!words.length)throw new Error('Enter a research topic.');
 return `(${words.map(w=>`all:${w}`).join(' AND ')}) AND submittedDate:[${start}0000 TO ${end}2359]`;
}
export function parseFeed(xml:string):{papers:Paper[];total:number}{
 const f=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',isArray:n=>['entry','author','category','link'].includes(n)}).parse(xml).feed;
 if(!f)throw new Error('arXiv returned an unreadable feed.');
 const seen=new Set<string>();
 const papers:Paper[]=(f.entry??[]).flatMap((e:any)=>{
  const id=clean(e.id).split('/abs/')[1];if(!id||!paperIdPattern.test(id)||seen.has(baseId(id)))return [];seen.add(baseId(id));
  return [{id,title:clean(e.title),authors:(e.author??[]).map((a:any)=>clean(a.name)),published:e.published,updated:e.updated,category:e['arxiv:primary_category']?.['@_term']??e.category?.[0]?.['@_term']??'Research',abstract:clean(e.summary),url:`https://arxiv.org/abs/${id}`,headline:'',summary:'',whyItMatters:'',tags:[]}];
 });
 return {papers,total:Number(f['opensearch:totalResults']??papers.length)};
}
const sourceHeaders={'User-Agent':'EduScroll/0.1 (research reading prototype)'};
let lastArxiv=0;
let arxivQueue=Promise.resolve();
async function arxivFetch(url:string):Promise<Response>{
 let release!:()=>void;const previous=arxivQueue;arxivQueue=new Promise(r=>{release=r;});await previous;
 try{const wait=3100-(Date.now()-lastArxiv);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastArxiv=Date.now();
 const res=await fetch(url,{headers:sourceHeaders,signal:AbortSignal.timeout(35000)});if(!res.ok)throw new Error(`arXiv is temporarily unavailable (${res.status}). Try again shortly.`);return res;
 }finally{release();}
}
export async function searchPapers(topic:string,days:number,start:number){
 const url=new URL('https://export.arxiv.org/api/query');url.search=new URLSearchParams({search_query:queryFor(topic,days),start:String(start),max_results:'10',sortBy:'submittedDate',sortOrder:'descending'}).toString();
 const {papers,total}=parseFeed(await (await arxivFetch(url.href)).text());return {papers,nextCursor:start+papers.length,hasMore:start+papers.length<total};
}
export async function getPaper(id:string):Promise<Paper>{
 if(!paperIdPattern.test(id))throw new Error('Invalid paper ID.');
 const {papers}=parseFeed(await (await arxivFetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`)).text());
 if(!papers[0])throw new Error('This paper could not be found on arXiv.');return papers[0];
}
export function extractArticle(html:string,id:string){
 const $=cheerio.load(html);$('script,style,nav,footer,.ltx_bibliography,.ltx_authors,.ltx_dates').remove();
 const figures:NonNullable<Paper['figure']>[]=[];
 $('figure').each((_,el)=>{if(figures.length>=8)return;const fig=$(el);const src=fig.find('img').first().attr('src');const caption=clean(fig.find('figcaption').text());if(!src||!caption)return;
  try{const u=new URL(src,`https://arxiv.org/html/${id}`);if(u.protocol==='https:'&&u.hostname==='arxiv.org')figures.push({url:u.href,caption:caption.slice(0,1800)});}catch{}
 });
 const article=$('article.ltx_document').first();const main=article.length?article:$('main').first();
 const sections=main.find('h2,h3').map((_,el)=>clean($(el).text())).get().filter(Boolean).slice(0,30);
 const text=clean(main.text());return {text:text.slice(0,90000),sections,figures};
}
const articleCache=new Map<string,Promise<ReturnType<typeof extractArticle>>>();
export async function articleHtml(id:string){
 if(!paperIdPattern.test(id))throw new Error('Invalid paper ID.');
 if(articleCache.has(id))return articleCache.get(id)!;
 const work=(async()=>{const res=await arxivFetch(`https://arxiv.org/html/${id}`);const result=extractArticle(await res.text(),id);if(result.text.length<2000)throw new Error('HTML unavailable.');return result;})();
 articleCache.set(id,work);if(articleCache.size>100)articleCache.delete(articleCache.keys().next().value!);
 try{return await work;}catch(e){articleCache.delete(id);throw e;}
}
export async function fullPaper(id:string){
 if(!paperIdPattern.test(id))throw new Error('Invalid paper ID.');
 try{return {...await articleHtml(id),pdf:null};}catch{}
 // Some papers have no HTML. Send a bounded PDF to the vision-capable model instead.
 const response=await arxivFetch(`https://arxiv.org/pdf/${id}`);
 if(Number(response.headers.get('content-length')??0)>12_000_000)throw new Error('This PDF is too large to process in the prototype. Open the original paper instead.');
 const reader=response.body!.getReader();const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12_000_000){await reader.cancel();throw new Error('This PDF is too large to process.');}chunks.push(value);}
 const bytes=Buffer.concat(chunks);if(!bytes.subarray(0,5).toString().startsWith('%PDF'))throw new Error('Full text is not available for this paper yet.');
 return {text:'',sections:[] as string[],figures:[] as NonNullable<Paper['figure']>[],pdf:bytes.toString('base64')};
}
