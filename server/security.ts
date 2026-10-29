export const allowedModels=['gpt-6.1-terra','gpt-6-luna'] as const;
export type Model=(typeof allowedModels)[number];
export const localOrigins=['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:5174','http://localhost:5174'];
export const hostedOrigins=['https://giuulio.github.io',...localOrigins];

export class ServiceError extends Error {
 constructor(public status:number,message:string){super(message);}
}

/** Provider errors must never be echoed: they may include request data or credentials. */
export function safeError(error:unknown):{status:number;error:string}{
 if(error instanceof ServiceError)return {status:error.status,error:error.message};
 const e=error as {status?:number;name?:string};
 if(e?.name==='TimeoutError')return {status:408,error:'This request took too long. Try again; completed posts have been cached.'};
 if(e?.name==='AbortError')return {status:408,error:'The request was stopped. Try again when you are ready.'};
 if(e?.status===401||e?.status===403)return {status:401,error:'The OpenAI key was rejected or cannot use this model. Check the key and model access.'};
 if(e?.status===429)return {status:429,error:'The OpenAI account has reached a usage or rate limit. Wait a little or check its API billing.'};
 if(e?.status===409)return {status:409,error:'This feed expired or changed. Search again to refresh its results.'};
 if(e?.status===404)return {status:404,error:'This paper could not be found at its original source.'};
 if(e?.status===400)return {status:400,error:'Enter a research topic with a subject to search.'};
 return {status:502,error:'We could not prepare this research right now. Please try again.'};
}

type Counter={count:number;active:number;expires:number};
/** Bounded, short-lived counters; credential identities are SHA-256 digests only. */
export class RequestLimits {
 private counters=new Map<string,Counter>();
 private active=0;
 acquire(ip:string,identity:string):()=>void {
  const now=Date.now();
  for(const [key,value] of this.counters)if(value.expires<=now&&value.active===0)this.counters.delete(key);
  const keys=[`ip:${ip}`,`key:${identity}`];
  const items=keys.map(key=>{
   let item=this.counters.get(key);
   if(!item||item.expires<=now){item={count:0,active:item?.active??0,expires:now+10*60*1000};this.counters.set(key,item);}
   return item;
  });
  if(this.active>=12||items.some(item=>item.active>=2))throw new ServiceError(429,'Two requests are already running. Let one finish or stop it before starting another.');
  if(items[0].count>=90||items[1].count>=45)throw new ServiceError(429,'This session has reached its request limit. Try again in a few minutes.');
  if(this.counters.size>2000){for(const [key,item] of this.counters){if(item.active===0&&!keys.includes(key)){this.counters.delete(key);if(this.counters.size<=1800)break;}}}
  this.active++;for(const item of items){item.count++;item.active++;}
  let released=false;return ()=>{if(released)return;released=true;this.active--;for(const item of items)item.active--;};
 }
}

export async function boundedJson(request:Request,limit=24_000,signal?:AbortSignal):Promise<unknown>{
 signal?.throwIfAborted();
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ServiceError(415,'Send a JSON request.');
 if(Number(request.headers.get('content-length')??0)>limit)throw new ServiceError(413,'That request is too large. Try a shorter topic.');
 if(!request.body)throw new ServiceError(400,'A request body is required.');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let length=0;
 const cancel=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{for(;;){const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new ServiceError(413,'That request is too large. Try a shorter topic.');}chunks.push(value);}}
 finally{signal?.removeEventListener('abort',cancel);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ServiceError(400,'The request is not valid JSON.');}
}
