import test from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import type {Paper} from '../src/types';
import {selectRelevantPapers} from '../server/relevance';

const paper:Paper={id:'epmc:MED:1',title:'Roman concrete',abstract:'Ancient masonry develops mineral-filled cracks.',authors:[],published:'2026-01-01',category:'Materials',url:'https://europepmc.org/article/MED/1',headline:'',summary:'',whyItMatters:'',tags:[]};

test('topic selection uses bounded source evidence and returns only selected existing papers',async()=>{
 const controller=new AbortController();
 const other={...paper,id:'epmc:MED:2',title:'A French novel'};
 const ai={responses:{parse:async(options:any,request:any)=>{
  assert.equal(options.model,'gpt-6.1-terra');assert.equal(options.store,false);assert.equal(options.reasoning.effort,'none');assert.equal(request.signal,controller.signal);
  const input=JSON.parse(options.input);assert.equal(input.topic,'Roman concrete');assert.equal(input.papers[0].rankingReason,undefined);assert.equal(input.papers[0].abstract.length,3500);
  return {output_parsed:{ids:[paper.id,paper.id]}};
 }}} as unknown as OpenAI;
 const result=await selectRelevantPapers(ai,'gpt-6.1-terra','Roman concrete',[{...paper,abstract:'x'.repeat(5000),rankingReason:'Query-specific ranking'},other],controller.signal);
 assert.deepEqual(result.map(p=>p.id),[paper.id]);
});

test('unknown selections cannot inject papers and empty selections never fill a quota',async()=>{
 let calls=0;let ids:string[]=['invented-id'];
 const ai={responses:{parse:async()=>{calls++;return {output_parsed:{ids}};}}} as unknown as OpenAI;
 await assert.rejects(selectRelevantPapers(ai,'gpt-6.1-terra','Roman concrete',[paper]),/unknown paper/);
 ids=[];assert.deepEqual(await selectRelevantPapers(ai,'gpt-6.1-terra','Roman concrete',[paper]),[]);
 assert.deepEqual(await selectRelevantPapers(ai,'gpt-6.1-terra','Roman concrete',[]),[]);assert.equal(calls,2);
 const controller=new AbortController();controller.abort();
 await assert.rejects(selectRelevantPapers(ai,'gpt-6.1-terra','Roman concrete',[paper],controller.signal),{name:'AbortError'});assert.equal(calls,2);
});
