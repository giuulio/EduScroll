import type {IllustrationSpec} from './visuals';
import type {DateRange} from './discovery';
export interface Paper {
 id:string; title:string; authors:string[]; published:string; updated?:string; category:string; abstract:string; url:string;
 headline:string; summary:string; whyItMatters:string; tags:string[];
 source?:'arxiv'|'europepmc'|'openalex'; publicationType?:string; doi?:string; rankingReason?:string;
 evidence?:string[]; editorialVersion?:string; contentBasis?:'abstract'|'source-excerpt'; visualPreference?:'none'|'illustration';
 figure?:{url:string;caption:string;page?:number;kind?:'paper'|'illustration';readable?:boolean};
 illustration?:IllustrationSpec;
}
export interface Detail {paragraphs:string[];takeaway:string;limitation:string;basis:'full-text'|'abstract'|'demo';sections:string[];figure?:Paper['figure'];}
export interface FeedResult {
 papers:Paper[];nextCursor:number;hasMore:boolean;mode:'live'|'demo';message?:string;snapshot?:string;
 requestedRange?:DateRange;effectiveRange?:DateRange;expanded?:boolean;sourceWarnings?:string[];
}
export type ModelName='gpt-6.1-terra'|'gpt-6-luna';
export type FeedEvent={type:'status';message:string}|{type:'card';paper:Paper}|{type:'complete';result:FeedResult}|{type:'error';error:string};
