/** Private, manual refresh. Never run in the public Pages workflow. */
import 'dotenv/config';
import {readFile,writeFile} from 'node:fs/promises';
import OpenAI from 'openai';
import {articleHtml} from '../server/papers';
import {generatePosts,type FigureSources} from '../server/posts';
import type {Paper} from '../src/types';
async function main(){
 if(!process.env.OPENAI_API_KEY)throw new Error('A local key is required.');
 const papers=JSON.parse(await readFile('src/demo.json','utf8')) as Paper[];
 const sources:FigureSources=new Map();
 for(const [i,p] of papers.entries()){try{sources.set(p.id,await articleHtml(p.id));}catch{}console.log(`Checked source ${i+1}/${papers.length}`);}
 const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:150000,maxRetries:1});
 console.log('Terra is simplifying the posts and inspecting candidate images…');
 const updated=await generatePosts(ai,process.env.OPENAI_MODEL??'gpt-6.1-terra',papers,sources);
 await writeFile('src/demo.json',JSON.stringify(updated,null,2)+'\n');
 console.log(`Updated ${updated.length} concise posts; ${updated.filter(p=>p.figure?.kind==='paper').length} readable source figures.`);
}
main().catch(()=>{console.error('Demo refresh failed. Check local model access or network connectivity. No credentials were logged.');process.exitCode=1;});
