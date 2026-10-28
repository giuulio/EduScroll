export interface Paper {
 id:string; title:string; authors:string[]; published:string; updated?:string; category:string; abstract:string; url:string;
 headline:string; summary:string; whyItMatters:string; tags:string[];
 figure?:{url:string;caption:string;page?:number};
}
export interface Detail { paragraphs:string[]; takeaway:string; limitation:string; basis:'full-text'|'abstract'|'demo'; sections:string[]; figure?:Paper['figure']; }
export interface FeedResult {papers:Paper[]; nextCursor:number; hasMore:boolean; mode:'live'|'demo'; message?:string;}
