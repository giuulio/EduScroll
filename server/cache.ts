/** Small, bounded caches for public paper content. Never put credentials or queries here. */
export class PublicCache<T> {
 private values=new Map<string,{expires:number;value:T}>();
 constructor(private limit:number,private ttl:number){}
 get(key:string):T|undefined {
  const entry=this.values.get(key);if(!entry)return;
  if(entry.expires<=Date.now()){this.values.delete(key);return;}
  this.values.delete(key);this.values.set(key,entry);return entry.value;
 }
 set(key:string,value:T){
  this.values.delete(key);
  if(this.values.size>=this.limit)this.values.delete(this.values.keys().next().value!);
  this.values.set(key,{expires:Date.now()+this.ttl,value});
 }
 get size(){return this.values.size;}
}

export async function digest(value:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
