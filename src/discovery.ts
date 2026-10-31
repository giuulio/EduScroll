import type {Paper} from './types';

export type DateRange='today'|'week'|'month'|'any';
export type SortOrder='relevance'|'latest';

/** Publication filters use UTC calendar dates, independently of browser timezone. */
export function dateBounds(range:DateRange,now=new Date()):{from?:string;to:string}{
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 const to=end.toISOString().slice(0,10);
 if(range==='any')return {to};
 if(range==='week')end.setUTCDate(end.getUTCDate()-((end.getUTCDay()+6)%7));
 if(range==='month')end.setUTCDate(1);
 return {from:end.toISOString().slice(0,10),to};
}

export function matchesDate(value:string,range:DateRange,now=new Date()):boolean{
 const {from,to}=dateBounds(range,now);
 const day=value.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return range==='any'&&/^\d{4}$/.test(value)&&Number(value)<=now.getUTCFullYear();
 const parsed=new Date(`${day}T00:00:00Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)return false;
 return day<=to&&(!from||day>=from);
}

export function normalizedText(value:string):string{
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
}

const stopWords=new Set('a an and are as at be by can could do does for from how i in into is it latest me new novel of on or papers research recent show some studies study that the their these this to using want what with'.split(' '));
const synonyms:Record<string,string[]>={
 ai:['artificial intelligence','machine learning'],
 llm:['large language model','language model','llm'],llms:['large language model','language model','llm'],
 nanotech:['nanotechnology','nanomaterial','nanoscale','nanogenerator','nanowire','nanoparticle'],nanotechnology:['nanotechnology','nanomaterial','nanoscale','nanogenerator','nanowire','nanoparticle'],
 nanomaterials:['nanomaterial','nanotechnology','nanoscale'],
 pacemaker:['pacemaker','cardiac pacing'],pacemakers:['pacemaker','cardiac pacing'],
 robotics:['robot','robotics'],robots:['robot','robotics'],robot:['robot','robotics'],
 batteries:['battery','batteries'],battery:['battery','batteries'],
 cancer:['cancer','tumor','tumour'],tumor:['tumor','tumour','cancer'],tumour:['tumor','tumour','cancer'],
 ageing:['ageing','aging'],aging:['ageing','aging'],
 solar:['solar','photovoltaic'],photovoltaics:['photovoltaic','solar'],
 neurotech:['neurotechnology','brain computer interface'],
 hallucinations:['hallucination','fabricated content','factual error'],hallucination:['hallucination','fabricated content','factual error'],
};

/** Keep independent concepts ANDed while accepting synonyms within a concept. */
export function queryConcepts(topic:string):string[][]{
 // A named concept counts once, rather than letting generic words swamp its subject.
 const words=normalizedText(topic).replace(/\blarge language models?\b/g,'llm').replace(/\bartificial intelligence\b/g,'ai').split(' ').filter(Boolean);
 const concepts=words.filter(w=>!stopWords.has(w)).slice(0,8).map(word=>synonyms[word]??[word]);
 const unique=new Set<string>();
 return concepts.filter(group=>{const key=group.join('|');if(unique.has(key))return false;unique.add(key);return true;});
}

/** Retrieval services can match full text or merely similar topics. Require visible evidence for every concept. */
export function matchesTopic(paper:Paper,topic:string):boolean{
 const groups=queryConcepts(topic);const text=normalizedText(`${paper.title} ${paper.abstract}`);
 return groups.length>0&&groups.every(group=>group.some(term=>termMatches(text,term,7)));
}

function termMatches(text:string,term:string,minimumFuzzyLength=5):boolean{
 const normalized=normalizedText(term);
 // Prefix matching admits plurals and common endings without matching inside words.
 return text.split(' ').some((_,i,words)=>normalized.split(' ').every((part,j)=>{
  const word=words[i+j]??'';return word===part||(word.startsWith(part)&&/^(?:s|es|ed|ing|al|ic|s?based)$/.test(word.slice(part.length)))||(Math.min(word.length,part.length)>=minimumFuzzyLength&&fuzzyWordMatch(word,part));
 }));
}

/** A single typo or swapped adjacent letters is tolerated in words of five letters. */
export function fuzzyWordMatch(left:string,right:string):boolean{
 if(left===right)return true;
 if(Math.min(left.length,right.length)<5||Math.abs(left.length-right.length)>1)return false;
 const rows:number[][]=[Array.from({length:right.length+1},(_,i)=>i)];
 for(let i=1;i<=left.length;i++){
  const row=[i];let minimum=i;
  for(let j=1;j<=right.length;j++){
   let value=Math.min(rows[i-1][j]+1,row[j-1]+1,rows[i-1][j-1]+(left[i-1]===right[j-1]?0:1));
   if(i>1&&j>1&&left[i-1]===right[j-2]&&left[i-2]===right[j-1])value=Math.min(value,rows[i-2][j-2]+1);
   row[j]=value;minimum=Math.min(minimum,value);
  }
  if(minimum>1)return false;
  rows.push(row);
 }
 return rows[left.length][right.length]<=1;
}

export function relevanceScore(paper:Paper,topic:string):number{
 const groups=queryConcepts(topic);if(!groups.length)return 0;
 const title=normalizedText(`${paper.title} ${paper.headline}`);
 const text=normalizedText(`${paper.abstract} ${paper.summary} ${paper.tags.join(' ')}`);
 return groups.reduce((score,group)=>score+(group.some(term=>termMatches(title,term))?3:group.some(term=>termMatches(text,term))?1:0),0)/(groups.length*3);
}

export function paperIdentity(id:string):string{
 return /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/.test(id)?id.replace(/v\d+$/,''):id;
}

export function deduplicatePapers(papers:Paper[]):Paper[]{
 const seen=new Set<string>();
 return papers.filter(paper=>{
  const keys=[`id:${paperIdentity(paper.id)}`,`title:${normalizedText(paper.title)}`,...(paper.doi?[`doi:${paper.doi.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//,'')}`]:[])];
  const duplicate=keys.some(key=>seen.has(key));
  keys.forEach(key=>seen.add(key));return !duplicate;
 });
}

/** Ranking is deterministic: relevance first, modest freshness, then source diversity. */
export function rankPapers(papers:Paper[],topic:string,sort:SortOrder,now=new Date()):Paper[]{
 const candidates=deduplicatePapers(papers).map(paper=>{
  const relevance=relevanceScore(paper,topic);
  const timestamp=new Date(paper.published).getTime();
  const age=Number.isFinite(timestamp)?Math.max(0,(now.getTime()-timestamp)/86400000):3650;
  return {paper,relevance,timestamp:Number.isFinite(timestamp)?timestamp:0,score:relevance*.88+(.12/(1+age/30))};
 });
 const ranked:Paper[]=[];const counts=new Map<string,number>();
 while(candidates.length){
  candidates.sort((a,b)=>sort==='latest'?b.timestamp-a.timestamp||b.relevance-a.relevance||a.paper.id.localeCompare(b.paper.id):
   (b.score-(counts.get(b.paper.source??'arxiv')??0)*.012)-(a.score-(counts.get(a.paper.source??'arxiv')??0)*.012)||b.timestamp-a.timestamp||a.paper.id.localeCompare(b.paper.id));
  const selected=candidates.shift()!;const source=selected.paper.source??'arxiv';counts.set(source,(counts.get(source)??0)+1);
  ranked.push({...selected.paper,rankingReason:sort==='latest'?'Newest publication first':selected.relevance>=.66?'Strong topic match':selected.relevance>0?'Related to your topic':'Matched by source search'});
 }
 return ranked;
}
