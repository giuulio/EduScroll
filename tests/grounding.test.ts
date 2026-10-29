import test from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import type {Paper} from '../src/types';
import {validateGroundedPost,generateTextPosts,sourceExcerptPost} from '../server/posts';

const abstract='In 15 test scans, the system reduced reconstruction error by 29.3% against the comparison method with the same memory budget.';
const paper:Paper={id:'2610.12345',title:'Surface reconstruction',abstract,authors:['Researcher'],published:'2026-10-28',category:'Computer vision',url:'https://arxiv.org/abs/2610.12345',headline:'',summary:'',whyItMatters:'',tags:[]};
const card={id:paper.id,headline:'Surface pieces reduce errors in test scans',summary:'Across 15 test scans, surface pieces cut reconstruction error by 29.3% using the same memory as the comparison method.',whyItMatters:'The comparison kept the memory budget fixed.',tags:['Computer vision'],evidence:[abstract],visualPreference:'illustration' as const,illustration:{layout:'hexagons' as const,labels:['Surface pieces'],accent:'blue' as const,caption:'Conceptual surface pieces.'}};

test('grounded posts retain exact evidence passages and reject invented numerical claims',()=>{
 assert.deepEqual(validateGroundedPost(card,paper).evidence,[abstract]);
 assert.throws(()=>validateGroundedPost({...card,summary:'The system eliminated 99% of errors.'},paper),/numerical claim/);
 assert.throws(()=>validateGroundedPost({...card,evidence:['Across 15 scans, the system was perfect.']},paper),/passage/);
 assert.throws(()=>validateGroundedPost({...card,id:'different-paper'},paper),/ID/);
});

test('unsupported model output falls back to a labeled source excerpt without another provider call',async()=>{
 let calls=0;const ai={responses:{parse:async()=>{calls++;return {output_parsed:{cards:[{...card,summary:'The system eliminated 99% of errors.'}]}};}}} as unknown as OpenAI;
 const [post]=await generateTextPosts(ai,'gpt-6.1-terra',[paper]);assert.equal(calls,1);assert.equal(post.contentBasis,'source-excerpt');assert.equal(post.summary,abstract);assert.deepEqual(post.evidence,[abstract]);assert.equal(post.visualPreference,'none');
});

test('papers with no abstract do not trigger inference or fabricate a title-based finding',async()=>{
 let calls=0;const ai={responses:{parse:async()=>{calls++;throw new Error('should not run');}}} as unknown as OpenAI;
 const empty={...paper,abstract:''};assert.deepEqual(await generateTextPosts(ai,'gpt-6.1-terra',[empty]),[]);assert.equal(calls,0);assert.throws(()=>sourceExcerptPost(empty),/no abstract/);
});

test('fast generation uses abstract-only context, low output bounds, no stored response and a cancellation signal',async()=>{
 const cancellation=new AbortController();let receivedSignal:AbortSignal|undefined;
 const ai={responses:{parse:async(options:any,requestOptions:any)=>{assert.equal(options.reasoning.effort,'none');assert.equal(options.store,false);assert.ok(options.max_output_tokens<3000);assert.ok(typeof options.input==='string');assert.ok(!options.input.includes('rankingReason'));receivedSignal=requestOptions.signal;return {output_parsed:{cards:[card]}};}}} as unknown as OpenAI;
 const [post]=await generateTextPosts(ai,'gpt-6.1-terra',[{...paper,rankingReason:'Matches a private search'}],cancellation.signal);assert.equal(post.contentBasis,'abstract');assert.equal(receivedSignal,cancellation.signal);
});
