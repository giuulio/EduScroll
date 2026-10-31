import test from 'node:test';
import assert from 'node:assert/strict';
import {dateBounds,matchesDate,queryConcepts,deduplicatePapers,rankPapers,relevanceScore,fuzzyWordMatch,matchesTopic} from '../src/discovery';
import {discover,getDiscoveredPaper,discoveredPaperId,europePmcQuery,parseEuropePmc,parseOpenAlex} from '../server/discovery';
import type {Paper} from '../src/types';

const now=new Date('2026-03-01T00:15:00Z');
const paper=(id:string,title:string,published='2026-02-28',extra:Partial<Paper>={}):Paper=>({id,title,published,authors:[],category:'Research',abstract:title,url:`https://arxiv.org/abs/${id}`,headline:'',summary:'',whyItMatters:'',tags:[],...extra});

test('date ranges use Monday and calendar months at UTC boundaries',()=>{
 assert.deepEqual(dateBounds('today',now),{from:'2026-03-01',to:'2026-03-01'});
 assert.deepEqual(dateBounds('week',now),{from:'2026-02-23',to:'2026-03-01'});
 assert.deepEqual(dateBounds('month',now),{from:'2026-03-01',to:'2026-03-01'});
 assert.deepEqual(dateBounds('any',now),{to:'2026-03-01'});
 assert.equal(matchesDate('2026-02-28','month',now),false);
 assert.equal(matchesDate('2026-03-02','any',now),false);
 assert.equal(matchesDate('2026-02-30','any',now),false);
 assert.equal(matchesDate('2024-02-29','any',now),true);
 assert.equal(matchesDate('2026','today',now),false);
});

test('free-form search keeps subjects and expands bounded synonym groups',()=>{
 assert.deepEqual(queryConcepts('novel nanotech for pacemakers'),[['nanotechnology','nanomaterial','nanoscale','nanogenerator','nanowire','nanoparticle'],['pacemaker','cardiac pacing']]);
 assert.deepEqual(queryConcepts('AI ai'),[['artificial intelligence','machine learning']]);
 assert.equal(queryConcepts('the latest research').length,0);
 const query=europePmcQuery('pacemakers','week',now);
 assert.match(query,/FIRST_PDATE:\[2026-02-23 TO 2026-03-01\]/);
 assert.match(query,/SRC:MED OR SRC:PMC OR SRC:PPR/);
});

test('DOIs, normalized titles, and arXiv versions deduplicate across providers',()=>{
 const papers=[paper('2610.00001v1','A cardiac pacing result'),paper('2610.00001v2','A cardiac pacing result'),paper('epmc:MED:123','A cardiac pacing result','2026-02-28',{source:'europepmc',doi:'10.1234/test'}),paper('openalex:W123','Alternate published title','2026-02-28',{source:'openalex',doi:'https://doi.org/10.1234/test'})];
 assert.equal(deduplicatePapers(papers).length,1);
});

test('best-match ranking values relevance and latest sorting respects publication date',()=>{
 const relevant=paper('2610.00001','Nanoscale pacemaker coating','2025-10-01');
 const recent=paper('2610.00002','Robots navigate buildings','2026-03-01');
 assert.equal(rankPapers([recent,relevant],'nanotech for pacemakers','relevance',now)[0].id,relevant.id);
 assert.equal(rankPapers([relevant,recent],'nanotech for pacemakers','latest',now)[0].id,recent.id);
 assert.equal(rankPapers([relevant],'nanotech for pacemakers','relevance',now)[0].rankingReason,'Strong topic match');
});

test('generic typo tolerance accepts a misspelling or letter swap without changing short words',()=>{
 assert.equal(fuzzyWordMatch('quantum','quantmu'),true);
 assert.equal(fuzzyWordMatch('cardiac','cardac'),true);
 assert.equal(fuzzyWordMatch('brain','train'),true);
 assert.equal(fuzzyWordMatch('cat','bat'),false);
 assert.equal(fuzzyWordMatch('quantum','pancake'),false);
 assert.ok(relevanceScore(paper('2610.00001','Quantum sensing'),'quantmu sensing')>.9);
});

test('topic acceptance requires all concepts in public evidence and does not confuse Roman with Raman',()=>{
 assert.equal(matchesTopic(paper('1','Bright-state Raman atom optics','2026-02-28',{abstract:'A concrete model of scattering.'}),'Roman concrete'),false);
 assert.equal(matchesTopic(paper('2','Holy Roman Empire','2026-02-28',{abstract:'An executioner worked in a medieval town.'}),'Roman concrete'),false);
 assert.equal(matchesTopic(paper('3','Roman concrete durability','2026-02-28',{abstract:'Ancient concrete repairs small cracks.'}),'Roman concrete'),true);
 assert.equal(matchesTopic(paper('4','Optical cardiovascular biosensors'),'nanotech for pacemakers'),false);
 assert.equal(matchesTopic(paper('5','Nanogenerators for cardiac pacing'),'nanotech for pacemakers'),true);
 assert.equal(matchesTopic(paper('6','Quantum sensing'),'quantmu sensing'),true);
 assert.equal(queryConcepts('large language model hallucinations').length,2);
});

test('OpenAlex retains scholarly articles and preprints but omits generic deposits and non-paper records',()=>{
 const item={id:'https://openalex.org/W1',title:'Quantum error correction',publication_date:'2026-02-28',type:'article'};
 assert.equal(parseOpenAlex({results:[{...item,doi:'https://doi.org/10.5281/zenodo.123'}]}).length,0);
 assert.equal(parseOpenAlex({results:[{...item,type:'dataset'}]}).length,0);
 assert.equal(parseOpenAlex({results:[{...item,primary_location:{source:{type:'repository',display_name:'Generic research uploads'}}}]}).length,0);
 const [preprint]=parseOpenAlex({results:[{...item,primary_location:{source:{type:'repository',display_name:'arXiv (Cornell University)'}}}]});
 assert.equal(preprint.publicationType,'Preprint');
 assert.equal(parseOpenAlex({results:[{...item,primary_location:{source:{type:'journal',display_name:'Physics journal'}}}]}).length,1);
});

test('provider parsers retain original metadata and reject malformed source identifiers',()=>{
 const epmc=parseEuropePmc({resultList:{result:[{source:'MED',id:'123',title:'A <i>small</i> pacemaker',firstPublicationDate:'2026-02-28',doi:'10.1234/pacing',abstractText:'Tested in <b>12</b> mice.',authorList:{author:[{fullName:'A Researcher'}]},pubTypeList:{pubType:['Journal Article']}},{source:'https://evil.test',id:'123',title:'Invalid'}]}});
 assert.equal(epmc.length,1);assert.equal(epmc[0].id,'epmc:MED:123');assert.equal(epmc[0].abstract,'Tested in 12 mice.');assert.equal(epmc[0].publicationType,'Journal Article');
 const oa=parseOpenAlex({results:[{id:'https://openalex.org/W123',title:'Nanoscale coating',publication_date:'2026-02-28',doi:'https://doi.org/10.1234/pacing',abstract_inverted_index:{in:[1],Tested:[0],mice:[3],'12':[2]},authorships:[{author:{display_name:'B Researcher'}}],type:'article'},{id:'https://evil.test/W124',title:'Invalid'}]});
 assert.equal(oa.length,1);assert.equal(oa[0].abstract,'Tested in 12 mice');assert.equal(oa[0].url,'https://doi.org/10.1234/pacing');
 for(const id of ['epmc:MED:123','epmc:PPR:PPR123','openalex:W123','2610.12345v1'])assert.equal(discoveredPaperId(id),true);
 for(const id of ['epmc:MED:../../etc/passwd','openalex:https://evil.test','https://example.com','epmc:XXX:123'])assert.equal(discoveredPaperId(id),false);
});

test('empty today results expand explicitly and snapshot pages remain stable without refetching',async()=>{
 const originalFetch=globalThis.fetch;let calls=0;let textFallbacks=0;const today=dateBounds('today').to;
 globalThis.fetch=async(input)=>{
  calls++;const url=new URL(String(input));
  if(url.hostname==='export.arxiv.org'){
   const strict=(url.searchParams.get('search_query')??'').includes(`${today.replaceAll('-','')}0000`);
   const entries=strict?'':Array.from({length:15},(_,i)=>`<entry><id>http://arxiv.org/abs/2501.${String(i+1).padStart(5,'0')}v1</id><title>Nanomaterial pacemaker coating snapshot fixture cold isolate ${i}</title><published>2025-01-01</published><summary>A coating tested with pacing devices.</summary></entry>`).join('');
   return new Response(`<feed><opensearch:totalResults>${strict?0:15}</opensearch:totalResults>${entries}</feed>`,{headers:{'Content-Type':'application/atom+xml'}});
  }
  if(url.hostname==='www.ebi.ac.uk')return Response.json({resultList:{result:[]}});
  if(url.hostname==='api.openalex.org'){
   if(url.searchParams.has('search.semantic'))return Response.json({error:'Semantic search unavailable'},{status:400});
   assert.ok(url.searchParams.has('search'));textFallbacks++;return Response.json({results:[]});
  }
  throw new Error('Unexpected provider');
 };
 try{
  const first=await discover({topic:'novel nanotech for pacemakers snapshot fixture',range:'today',sort:'relevance',cursor:0,exclude:[]});
  assert.equal(first.papers.length,10);assert.equal(first.expanded,true);assert.equal(first.requestedRange,'today');assert.equal(first.effectiveRange,'any');assert.match(first.message??'',/No matches today/);assert.ok(first.snapshot);assert.equal(first.hasMore,true);
  assert.equal(textFallbacks,2);const afterFirst=calls;
  const second=await discover({topic:'novel nanotech for pacemakers snapshot fixture',range:'today',sort:'relevance',cursor:first.nextCursor,exclude:first.papers.map(p=>p.id),snapshot:first.snapshot});
  assert.equal(calls,afterFirst);assert.equal(second.papers.length,5);assert.equal(second.hasMore,false);assert.equal(second.snapshot,first.snapshot);
  const firstIds=new Set(first.papers.map(p=>p.id));assert.ok(second.papers.every(p=>!firstIds.has(p.id)));
  const recovered=await discover({topic:'novel nanotech for pacemakers snapshot fixture',range:'today',sort:'relevance',cursor:999,exclude:first.papers.map(p=>p.id),snapshot:'evicted-worker-snapshot'});
  assert.equal(calls,afterFirst);assert.equal(recovered.papers.length,5);assert.ok(recovered.papers.every(p=>!firstIds.has(p.id)));
  assert.match(recovered.message??'',/Results refreshed; previously shown papers are excluded\./);assert.match(recovered.message??'',/No matches today/);
  const cold=await discover({topic:'nanotech pacemakers cold isolate fixture',range:'any',sort:'relevance',cursor:999,exclude:first.papers.map(p=>p.id),snapshot:'missing-on-new-worker'});
  assert.equal(cold.papers.length,5);assert.ok(cold.papers.every(p=>!firstIds.has(p.id)));assert.match(cold.message??'',/Results refreshed; previously shown papers are excluded\./);
  const afterRecovery=calls;
  await assert.rejects(discover({topic:'changed topic',range:'today',sort:'relevance',cursor:10,exclude:[],snapshot:first.snapshot}),/feed changed/);
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(discover({topic:'cancelled search',range:'any',sort:'relevance',cursor:0,exclude:[],signal:cancelled.signal}),{name:'AbortError'});
  assert.equal(calls,afterRecovery);
 }finally{globalThis.fetch=originalFetch;}
});

test('intent screening runs before date expansion and empty-abstract records never take a feed slot',async()=>{
 const originalFetch=globalThis.fetch;let checked=0;const today=dateBounds('today').to;
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  if(url.hostname==='export.arxiv.org')return new Response('<feed></feed>');
  if(url.hostname==='api.openalex.org')return Response.json({results:[]});
  if(url.hostname==='www.ebi.ac.uk'){
   const strict=(url.searchParams.get('query')??'').includes(`FIRST_PDATE:[${today}`);
   return Response.json({resultList:{result:strict?[
    {source:'MED',id:'1001',title:'Roman concrete keyword fixture',firstPublicationDate:today,abstractText:''},
    {source:'MED',id:'1002',title:'Roman novels and concrete ideas',firstPublicationDate:today,abstractText:'A literary analysis with matching words used in a different sense.'},
   ]:[{source:'MED',id:'1003',title:'Ancient Roman concrete masonry',firstPublicationDate:'2020-01-01',abstractText:'Researchers examined mineral growth in cracks in ancient Roman concrete masonry.'}]}});
  }
  throw new Error('Unexpected provider');
 };
 try{
  const result=await discover({topic:'Roman concrete intent regression',range:'today',sort:'relevance',cursor:0,exclude:[],selectPapers:async(papers)=>{
   checked++;assert.ok(papers.every(p=>p.abstract.length>=20));return papers.filter(p=>p.id==='epmc:MED:1003');
  }});
  assert.equal(checked,2);assert.equal(result.expanded,true);assert.deepEqual(result.papers.map(p=>p.id),['epmc:MED:1003']);
  const cached=await discover({topic:'Roman concrete intent regression',range:'today',sort:'relevance',cursor:0,exclude:[],snapshot:result.snapshot,selectPapers:async()=>{throw new Error('Do not rescreen cached snapshots');}});
  assert.deepEqual(cached.papers,result.papers);
 }finally{globalThis.fetch=originalFetch;}
});

test('cold Europe PMC lookups use unquoted identifiers so bookmarks work on a fresh server',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('query'),'EXT_ID:987654321 AND SRC:MED');
  return Response.json({resultList:{result:[{id:'987654321',source:'MED',title:'A retained research paper',firstPublicationDate:'2026-01-01',abstractText:'The original public abstract remains available.'}]}});
 };
 try{assert.equal((await getDiscoveredPaper('epmc:MED:987654321')).id,'epmc:MED:987654321');}finally{globalThis.fetch=originalFetch;}
});
