import {createService} from '../server/service';
const handle=createService({mode:'hosted'});
export default {
 async fetch(request:Request){
  if(request.method==='GET'&&new URL(request.url).pathname==='/')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EduScroll research service</title><style>body{font:17px system-ui;background:#19151c;color:#e9deef;max-width:38rem;margin:15vh auto;padding:24px;line-height:1.7}a{color:#d9b9ed}h1{font-weight:550}</style><h1>EduScroll research service</h1><p>The API is online. Live research uses your own OpenAI key for each request.</p><p><a href="https://giuulio.github.io/EduScroll/">Open EduScroll →</a></p></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'",'Cache-Control':'public, max-age=300'}});
  return handle(request,{ip:request.headers.get('cf-connecting-ip')??'unknown'});
 }
};
