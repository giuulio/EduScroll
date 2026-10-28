import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import {isSingleFigureCaption,loadFigureForVision,generatePosts,postSchema} from '../server/posts';
import type {Paper} from '../src/types';
const illustration={layout:'pipeline' as const,labels:['Watch video','Learn actions','Move robot'],accent:'blue' as const,caption:'A simple illustration of learning robot actions from video.'};
const paper:Paper={id:'2610.12345v1',title:'Robot learning',authors:['Researcher'],published:'2026-10-28',category:'cs.RO',abstract:'Robots learn from video.',url:'https://arxiv.org/abs/2610.12345v1',headline:'',summary:'',whyItMatters:'',tags:[]};
const copy={id:paper.id,headline:'Robots learn by watching videos',summary:'In tests, robots learned new actions by watching people. They could then try those actions in unfamiliar settings.',whyItMatters:'Videos could help robots learn.',tags:['Robotics'],figureIndex:0,figureCaption:'One robot trying a task.',illustration};
test('screens out multi-panel, dense and architecture figures before vision selection',()=>{
 for(const caption of ['Figure 1: (a) Input and (b) output.','Figure 2: Model architecture.','Figure 3: Multiple panels compare results.','Figure 4: Top examples and bottom examples.','Figure 5: Left results and right results.','Figure 6: '+ 'Long caption. '.repeat(50)])assert.equal(isSingleFigureCaption(caption),false);
 assert.equal(isSingleFigureCaption('Figure 1: A photograph of the robot holding a cup.'),true);
});
test('the complete feed post is bounded to tweet length',()=>{
 assert.equal(postSchema.parse(copy).summary,copy.summary);assert.throws(()=>postSchema.parse({...copy,summary:'x'.repeat(281)}));
});
test('preview loading rejects foreign hosts before making a request',async()=>{
 let called=false;const fetcher=(async()=>{called=true;throw new Error('should not fetch');}) as typeof fetch;
 assert.equal(await loadFigureForVision('https://evil.test/picture.png',fetcher),null);assert.equal(called,false);
});
test('preview loading rejects HTML and oversized image responses',async()=>{
 const html=(async()=>new Response('<html/>',{headers:{'content-type':'text/html'}})) as typeof fetch;
 const huge=(async()=>new Response('bytes',{headers:{'content-type':'image/png','content-length':'2000001'}})) as typeof fetch;
 assert.equal(await loadFigureForVision('https://arxiv.org/html/a/fig.png',html),null);assert.equal(await loadFigureForVision('https://arxiv.org/html/a/fig.png',huge),null);
});
test('only a source image with an actual supplied preview may be selected',async()=>{
 const ai={responses:{parse:async()=>({output_parsed:{cards:[copy]}})}} as unknown as OpenAI;
 const sources=new Map([[paper.id,{figures:[{url:'https://arxiv.org/html/a/robot.png',caption:'A photo of one robot holding a cup.'}]}]]);
 const noPreview=await generatePosts(ai,'gpt-6.1-terra',[paper],sources,async()=>null);assert.equal(noPreview[0].figure?.kind,'illustration');
 const withPreview=await generatePosts(ai,'gpt-6.1-terra',[paper],sources,async()=>'data:image/png;base64,test');assert.equal(withPreview[0].figure?.kind,'paper');assert.equal(withPreview[0].figure?.readable,true);
});

import {readFileSync} from 'node:fs';
test('the published demo uses short posts rather than abstract-length paragraphs',()=>{
 const demo=JSON.parse(readFileSync('src/demo.json','utf8')) as Paper[];for(const p of demo){assert.ok(p.summary.length<=280);assert.ok(p.summary.split(/\s+/).length<=40);}
});
