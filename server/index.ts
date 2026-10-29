import 'dotenv/config';
import express from 'express';
import {createService} from './service';
import {allowedModels} from './security';
import type {Model} from './security';

const app=express();const port=Number(process.env.PORT??3001);const host='127.0.0.1';
const defaultModel=allowedModels.includes(process.env.OPENAI_MODEL as Model)?process.env.OPENAI_MODEL as Model:'gpt-6.1-terra';
const handle=createService({mode:'local',ownerKey:process.env.OPENAI_API_KEY,localAccessToken:process.env.API_ACCESS_TOKEN,defaultModel});
app.disable('x-powered-by');
app.use(express.raw({type:()=>true,limit:'24kb'}));
app.use(async(req,res)=>{
 const cancellation=new AbortController();
 req.on('aborted',()=>cancellation.abort());
 res.on('close',()=>{if(!res.writableEnded)cancellation.abort();});
 const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);}
 try{
  const request=new Request(`http://${req.headers.host??`${host}:${port}`}${req.originalUrl}`,{method:req.method,headers,signal:cancellation.signal,...(!['GET','HEAD'].includes(req.method)&&req.body?.length?{body:new Uint8Array(req.body)}:{})});
  const response=await handle(request,{ip:req.socket.remoteAddress??'local'});
  res.status(response.status);response.headers.forEach((value,key)=>res.setHeader(key,value));
  if(!response.body){res.end();return;}
  const reader=response.body.getReader();
  for(;;){const {done,value}=await reader.read();if(done)break;if(cancellation.signal.aborted){await reader.cancel();break;}res.write(value);}
  res.end();
 }catch{if(!res.headersSent)res.status(502).json({error:'The local request could not be completed. Please retry.'});else res.end();}
});
app.use((_error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(413).json({error:'That request is too large. Try a shorter topic.'}));
app.listen(port,host,()=>console.log(`EduScroll API: http://${host}:${port}`));
