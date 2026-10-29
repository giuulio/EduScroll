import test from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import type {Paper} from '../src/types';
import {sourceOverview,validateOverview,generateTopicOverview} from '../server/overview';
const paper:Paper={id:'epmc:MED:123',title:'Robot learning',abstract:'In 15 tests, robots completed 12 tasks after learning from video.',authors:['A Researcher'],published:'2026-10-28',category:'Robotics',url:'https://europepmc.org/article/MED/123',headline:'',summary:'',whyItMatters:'',tags:[]};
const overview={title:'Robot learning',facts:[{text:'Robots completed 12 tasks in 15 tests.',paperIds:[paper.id],evidence:[paper.abstract]}]};
test('instant briefing uses exact source sentences and never invents topic background',()=>{
 const value=sourceOverview([paper]);assert.equal(value?.facts[0].text,paper.abstract);assert.deepEqual(value?.facts[0].paperIds,[paper.id]);assert.equal(sourceOverview([{...paper,abstract:''}]),undefined);
});
test('overview facts require known citations, exact evidence and supported numerical values',()=>{
 assert.equal(validateOverview(overview,[paper]).basis,'retrieved-papers');
 assert.throws(()=>validateOverview({...overview,facts:[{...overview.facts[0],paperIds:['unknown']}]},[paper]),/unknown paper/);
 assert.throws(()=>validateOverview({...overview,facts:[{...overview.facts[0],evidence:['Robots completed all the tasks.']}]},[paper]),/cited source/);
 assert.throws(()=>validateOverview({...overview,facts:[{...overview.facts[0],text:'Robots achieved 100% accuracy.'}]},[paper]),/unsupported number/);
});
test('overview generation is small, independent, uncached by query and cancellation-aware',async()=>{
 const controller=new AbortController();const ai={responses:{parse:async(options:any,context:any)=>{assert.equal(options.reasoning.effort,'none');assert.equal(options.store,false);assert.ok(options.max_output_tokens<=1100);assert.equal(context.signal,controller.signal);assert.ok(!options.input.includes('private search'));return {output_parsed:overview};}}} as unknown as OpenAI;
 const value=await generateTopicOverview(ai,'gpt-6.1-terra',[{...paper,rankingReason:'private search'}],controller.signal);assert.equal(value?.facts.length,1);
});

test('quick overview rejects statistical notation and instant excerpts choose a readable sentence',()=>{
 const source={id:'p1',title:'A pacing result',authors:[],published:'2026-01-01',category:'Health',abstract:'Density rose from 67.7±13.2 to 119.1±22.6 units. A heartbeat-powered device supported pacing in pigs.',url:'https://arxiv.org/abs/2610.12345',headline:'',summary:'',whyItMatters:'',tags:[]};
 const instant=sourceOverview([source]);assert.equal(instant?.facts[0].text,'A heartbeat-powered device supported pacing in pigs.');
 assert.throws(()=>validateOverview({title:'Pacing findings',facts:[{text:'Density rose from 67.7±13.2 to 119.1±22.6 units.',paperIds:['p1'],evidence:['Density rose from 67.7±13.2 to 119.1±22.6 units.']}]},[source]),/technical notation/);
});
