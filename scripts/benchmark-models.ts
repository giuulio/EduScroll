/** Opt-in writing evaluation. Reads an environment variable, never a .env file. */
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import OpenAI from 'openai';
import {z} from 'zod';
import {zodTextFormat} from 'openai/helpers/zod';
import {editorialVersion,postWritingInstructions} from '../server/editorial';
import type {Paper} from '../src/types';

const allowedModels=['gpt-6.1-terra','gpt-6-luna'] as const;
type Model=typeof allowedModels[number];
const outputSchema=z.object({id:z.string(),headline:z.string().max(100),summary:z.string().max(280),whyItMatters:z.string(),tags:z.array(z.string()).min(1).max(2),evidence:z.array(z.string()).min(1).max(3)});
// Standard per-million token rates checked against the linked official pricing on this date.
const pricing={verifiedOn:'2026-10-29',source:'https://developers.openai.com/api/docs/pricing',rates:{'gpt-6.1-terra':{input:1,cachedInput:.05,output:5},'gpt-6-luna':{input:.1,cachedInput:.01,output:.5}}};
const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
const percentile=(values:number[],p:number)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;

async function main(){
  const args=new Map(process.argv.slice(2).map(arg=>{const i=arg.indexOf('=');return i<0?[arg,'true']:[arg.slice(0,i),arg.slice(i+1)];}));
  if(!args.has('--run')||args.has('--help')){
    console.log('Opt-in writing benchmark. No request was made.\nRun: node --import tsx scripts/benchmark-models.ts --run --models=gpt-6.1-terra,gpt-6-luna --repeats=2\nUse OPENAI_API_KEY from the process environment. Default model: gpt-6.1-terra. Optional --out=/absolute/report.json.');
    return;
  }
  const models=(args.get('--models')??'gpt-6.1-terra').split(',');
  if(!models.length||models.some(model=>!allowedModels.includes(model as Model)))throw new Error('Choose only gpt-6.1-terra or gpt-6-luna.');
  const repeats=Number(args.get('--repeats')??'1');
  if(!Number.isInteger(repeats)||repeats<1||repeats>5)throw new Error('Repeats must be between 1 and 5.');
  const outputPath=args.get('--out')??join(tmpdir(),`eduscroll-benchmark-${Date.now()}.json`);
  if(basename(outputPath).startsWith('.env'))throw new Error('Choose a JSON report path.');
  if(!process.env.OPENAI_API_KEY)throw new Error('Set OPENAI_API_KEY in the process environment before opting in.');
  const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:45000,maxRetries:0});
  const papers=JSON.parse(await readFile(new URL('../src/demo.json',import.meta.url),'utf8')) as Paper[];
  const fixtures=papers;
  const measurements=[];
  for(let repeat=0;repeat<repeats;repeat++)for(const paper of fixtures)for(const model of models as Model[]){
    const started=performance.now();
    try{
      const response=await ai.responses.parse({model,reasoning:{effort:'none'},store:false,instructions:postWritingInstructions+'\nThis writing-only evaluation has no image fields. Return the requested writing and evidence fields only.',input:JSON.stringify({id:paper.id,title:paper.title,abstract:paper.abstract}),text:{format:zodTextFormat(outputSchema,'benchmark_post')},max_output_tokens:1400});
      const elapsedMs=Math.round(performance.now()-started);
      const post=response.output_parsed;
      if(!post)throw new Error('No parsed post.');
      const inputTokens=response.usage?.input_tokens??0;
      const outputTokens=response.usage?.output_tokens??0;
      const cachedInputTokens=response.usage?.input_tokens_details?.cached_tokens??0;
      const rates=pricing.rates[model];
      const estimatedUsd=((inputTokens-cachedInputTokens)*rates.input+cachedInputTokens*rates.cachedInput+outputTokens*rates.output)/1_000_000;
      measurements.push({model,repeat,paperId:paper.id,status:'ok',elapsedMs,inputTokens,cachedInputTokens,outputTokens,estimatedUsd,sourceAbstract:paper.abstract,post,automaticChecks:{idMatches:post.id===paper.id,exactEvidence:post.evidence.every(quote=>quote.length>0&&normalize(paper.abstract).includes(normalize(quote))),characterCount:post.summary.length,wordCount:post.summary.split(/\s+/).length},review:{faithful:null,numbersAndUnitsCorrect:null,comparisonAndSettingPreserved:null,readable:null,interesting:null,notes:''}});
      console.log(`${model}: completed fixture ${fixtures.indexOf(paper)+1}/${fixtures.length}, repeat ${repeat+1}/${repeats}`);
    }catch{
      // Provider errors can contain request headers. Do not print or save error objects.
      measurements.push({model,repeat,paperId:paper.id,status:'failed',elapsedMs:Math.round(performance.now()-started),review:{notes:'Request or parsing failed; inspect provider dashboard without exposing credentials.'}});
      console.log(`${model}: fixture failed; error details suppressed`);
    }
  }
  const summaries=(models as Model[]).map(model=>{
    const rows=measurements.filter(row=>row.model===model);
    const ok=rows.filter(row=>row.status==='ok');
    return {model,requests:rows.length,successes:ok.length,failures:rows.length-ok.length,p50Ms:percentile(ok.map(row=>row.elapsedMs),.5),p95Ms:percentile(ok.map(row=>row.elapsedMs),.95),estimatedTotalUsd:ok.reduce((sum,row)=>sum+(row.estimatedUsd??0),0),inputTokens:ok.reduce((sum,row)=>sum+(row.inputTokens??0),0),outputTokens:ok.reduce((sum,row)=>sum+(row.outputTokens??0),0)};
  });
  await writeFile(outputPath,JSON.stringify({createdAt:new Date().toISOString(),editorialVersion,scope:'Writing-only, one abstract per request. Does not measure retrieval, full-paper expansion, image work, or end-to-end feed speed. Small-sample percentiles are descriptive. Review quality fields before changing the production model.',pricing,summaries,measurements},null,2)+'\n');
  console.log(`Wrote benchmark report to ${outputPath}. Review claim quality before selecting a model.`);
}
main().catch(()=>{console.error('Benchmark stopped. Check arguments, environment key, and report path. No credentials or provider error details were logged.');process.exitCode=1;});
