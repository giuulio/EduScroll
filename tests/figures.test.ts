import test from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import type {Paper} from '../src/types';
import {extractPmcFigures,safeFigureUrl,imageDimensions,validFigureCrop,sourceFigureCandidates,enrichFigure,type FigureDependencies} from '../server/figures';

const pmcid='PMC4853868';
const media='s3://pmc-oa-opendata/PMC4853868.1/heart-fig1.jpg?md5=1234';
const xml='<article><body><fig id="F1"><label>Fig. 1</label><caption><p>A pacemaker device and its electrical response.</p></caption><graphic xlink:href="heart-fig1.jpg"/></fig><fig><caption>Unlisted image must never become a request.</caption><graphic xlink:href="https://evil.test/image.jpg"/></fig></body></article>';
function paper(id:string):Paper{return {id,title:'A self-powered pacemaker',authors:['Researcher'],published:'2026-10-28',category:'Biomedicine',abstract:'A device was tested in pigs.',url:'https://arxiv.org/abs/'+id,headline:'Heartbeats power a pacemaker',summary:'Heartbeats powered a pacemaker in tests in pigs.',whyItMatters:'',tags:['Pacemakers']};}
function png(width=1200,height=800){const bytes=new Uint8Array(32);bytes.set([137,80,78,71,13,10,26,10]);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;}
const selection={index:0,readable:true,confidence:.96,crop:null,panel:'',caption:'The tested pacemaker device.',axesAndLegendRetained:true,singlePanel:true};
function model(responses:unknown[]){let calls=0;const ai={responses:{parse:async(args:any,options:any)=>{assert.equal(args.store,false);assert.equal(args.model,'gpt-6.1-terra');assert.equal(args.input[0].content.at(-1).detail,'high');assert.ok(options.signal===undefined||options.signal instanceof AbortSignal);return {output_parsed:responses[calls++]};}}} as unknown as OpenAI;return {ai,calls:()=>calls};}
function arxivDependencies():FigureDependencies{return {arxivArticle:async()=>({text:'Full source text.',sections:['Results'],figures:[{url:'https://arxiv.org/html/2610.99999/figure.png',caption:'A device photograph and graph showing the pacing result.'}]}),fetcher:(async()=>new Response(png(),{headers:{'content-type':'image/png'}})) as typeof fetch};}

test('JATS captions resolve only to original images declared by the PMC Cloud metadata',()=>{
 const figures=extractPmcFigures(xml,[media,'s3://pmc-oa-opendata/PMC4853868.1/supplement.zip','https://evil.test/image.jpg'],pmcid,1,'CC BY');
 assert.equal(figures.length,1);assert.equal(figures[0].url,'https://pmc-oa-opendata.s3.amazonaws.com/PMC4853868.1/heart-fig1.jpg?md5=1234');assert.equal(figures[0].caption,'A pacemaker device and its electrical response.');assert.equal(figures[0].sourceUrl,'https://pmc.ncbi.nlm.nih.gov/articles/PMC4853868/#F1');assert.equal(figures[0].cropAllowed,true);
 assert.equal(extractPmcFigures(xml,[media],pmcid,1,'CC BY-ND')[0].cropAllowed,false);
 assert.equal(extractPmcFigures(xml,[media],'../../secret',1).length,0);
});

test('source image allowlist rejects foreign hosts, credentials, ports and unexpected paths',()=>{
 assert.equal(safeFigureUrl('https://arxiv.org/html/2610.12345/fig.png'),true);
 assert.equal(safeFigureUrl('https://pmc-oa-opendata.s3.amazonaws.com/PMC4853868.1/heart-fig1.jpg'),true);
 for(const url of ['http://arxiv.org/html/1/a.png','https://arxiv.org:444/html/1/a.png','https://name:password@arxiv.org/html/1/a.png','https://evil.test/a.png','https://pmc-oa-opendata.s3.amazonaws.com/private/a.jpg','https://pmc-oa-opendata.s3.amazonaws.com/PMC4853868.1/file.svg'])assert.equal(safeFigureUrl(url),false,url);
});

test('image header dimensions and crop bounds prevent tiny, distorted or out-of-bounds panels',()=>{
 assert.deepEqual(imageDimensions(png(),'image/png'),{width:1200,height:800});assert.equal(imageDimensions(new Uint8Array(4),'image/png'),undefined);
 const good={x:.1,y:.2,width:.5,height:.5};assert.equal(validFigureCrop(good,1200,800),true);
 for(const crop of [{...good,x:-.1},{...good,x:.8},{...good,width:.15},{...good,height:.15},{...good,width:NaN}])assert.equal(validFigureCrop(crop,1200,800),false);
});

test('biomedical figure extraction uses DOI/PMCID lookup and official cloud APIs, without scraping article pages',async()=>{
 const visited:string[]=[];
 const fetcher=(async(input:string|URL|Request)=>{
  const url=String(input);visited.push(url);
  if(url.startsWith('https://www.ebi.ac.uk/'))return Response.json({resultList:{result:[{id:'27137910',doi:'10.1186/s13287-016-0326-z',pmcid}]}});
  if(url.includes('list-type=2'))return new Response('<ListBucketResult><CommonPrefixes><Prefix>PMC4853868.1/</Prefix></CommonPrefixes></ListBucketResult>');
  if(url.includes('.json'))return Response.json({pmcid,version:1,is_pmc_openaccess:true,is_retracted:false,license_code:'CC BY',media_urls:[media],xml_url:'s3://pmc-oa-opendata/PMC4853868.1/PMC4853868.1.xml'});
  if(url.endsWith('.xml'))return new Response(xml);
  throw new Error('Unexpected fetch');
 }) as typeof fetch;
 const result=await sourceFigureCandidates({...paper('openalex:W123456'),source:'openalex',doi:'10.1186/s13287-016-0326-z'},undefined,{fetcher});assert.equal(result.length,1);assert.equal(visited.length,4);assert.ok(visited.every(url=>!url.includes('pmc.ncbi.nlm.nih.gov/articles/')));
});

test('a whole readable figure is selected from a real supplied preview and retains attribution',async()=>{
 const {ai,calls}=model([selection]);const result=await enrichFigure(ai,'gpt-6.1-terra',paper('2610.99901'),undefined,arxivDependencies());assert.equal(calls(),1);assert.equal(result?.kind,'paper');assert.equal(result?.readable,true);assert.equal(result?.width,1200);assert.match(result!.sourceUrl!,/^https:\/\/arxiv.org\/html\//);assert.equal(result?.crop,undefined);
});

test('a proposed crop requires independent confirmation and keeps original image and caption provenance',async()=>{
 const crop={x:.1,y:.2,width:.5,height:.5};const {ai,calls}=model([{...selection,crop,panel:'Panel B'},{readable:true,singlePanel:true,axesAndLegendRetained:true,confidence:.98}]);
 const result=await enrichFigure(ai,'gpt-6.1-terra',paper('2610.99902'),undefined,arxivDependencies());assert.equal(calls(),2);assert.deepEqual(result?.crop,crop);assert.equal(result?.panel,'Panel B');assert.equal(result?.url,'https://arxiv.org/html/2610.99999/figure.png');assert.match(result!.originalCaption!,/device photograph/);
});

test('crowded figures and crops that lose axes, fail reinspection or lie outside the image are rejected',async()=>{
 const fixtures=[{...selection,readable:false},{...selection,crop:{x:.8,y:.1,width:.5,height:.5}},{...selection,axesAndLegendRetained:false},{...selection,crop:{x:.1,y:.2,width:.5,height:.5}}];
 for(const [index,choice] of fixtures.entries()){
  const {ai}=model([choice,{readable:true,singlePanel:true,axesAndLegendRetained:false,confidence:.99}]);assert.equal(await enrichFigure(ai,'gpt-6.1-terra',paper(`2610.9991${index}`),undefined,arxivDependencies()),undefined);
 }
});

test('oversized or non-image responses never enter the vision request',async()=>{
 for(const [index,response] of [new Response('<html>blocked</html>',{headers:{'content-type':'text/html'}}),new Response(png(),{headers:{'content-type':'image/png','content-length':'1500001'}})].entries()){
  const {ai,calls}=model([selection]);const dependencies={...arxivDependencies(),fetcher:(async()=>response) as typeof fetch};assert.equal(await enrichFigure(ai,'gpt-6.1-terra',paper(`2610.9992${index}`),undefined,dependencies),undefined);assert.equal(calls(),0);
 }
});

test('cancellation stops source/vision work and never becomes a silent missing-image result',async()=>{
 const controller=new AbortController();controller.abort(new DOMException('Stopped','AbortError'));const {ai,calls}=model([selection]);await assert.rejects(()=>enrichFigure(ai,'gpt-6.1-terra',paper('2610.99930'),controller.signal,arxivDependencies()),{name:'AbortError'});assert.equal(calls(),0);
});


test('official PMC binary/octet-stream media is accepted only when its magic bytes and dimensions prove it is an image',async()=>{
 const jpeg=new Uint8Array(32);jpeg.set([255,216,255,192,0,17,8,3,32,4,176,3]);
 assert.deepEqual(imageDimensions(jpeg,'image/jpeg'),{width:1200,height:800});
 const dependencies={...arxivDependencies(),fetcher:(async()=>new Response(jpeg,{headers:{'content-type':'binary/octet-stream','content-length':String(jpeg.length)}})) as typeof fetch};
 const {ai,calls}=model([selection]);const result=await enrichFigure(ai,'gpt-6.1-terra',paper('2610.99940'),undefined,dependencies);assert.equal(result?.kind,'paper');assert.equal(calls(),1);
 const bad={...arxivDependencies(),fetcher:(async()=>new Response('<html>not an image</html>',{headers:{'content-type':'binary/octet-stream'}})) as typeof fetch};
 const rejected=model([selection]);assert.equal(await enrichFigure(rejected.ai,'gpt-6.1-terra',paper('2610.99941'),undefined,bad),undefined);assert.equal(rejected.calls(),0);
});
