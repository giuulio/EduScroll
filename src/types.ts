import type {IllustrationSpec} from './visuals';
import type {DateRange} from './discovery';
export interface FigureCrop {x:number;y:number;width:number;height:number;}
export interface PaperFigure {
 url:string;caption:string;page?:number;width?:number;height?:number;kind?:'paper'|'illustration';readable?:boolean;
 crop?:FigureCrop;sourceUrl?:string;originalCaption?:string;panel?:string;attribution?:string;license?:string;
}
export interface TopicOverview {
 title:string;facts:{text:string;paperIds:string[];evidence?:string[]}[];basis:'retrieved-papers';
 sources?:{id:string;title:string;url:string}[];
}
export interface Paper {
 id:string;title:string;authors:string[];published:string;updated?:string;category:string;abstract:string;url:string;
 headline:string;summary:string;whyItMatters:string;tags:string[];
 source?:'arxiv'|'europepmc'|'openalex';publicationType?:string;doi?:string;pmcid?:string;rankingReason?:string;
 evidence?:string[];editorialVersion?:string;contentBasis?:'abstract'|'source-excerpt';visualPreference?:'none'|'illustration';
 figure?:PaperFigure;illustration?:IllustrationSpec;
}
export interface Detail {paragraphs:string[];takeaway:string;limitation:string;basis:'full-text'|'abstract'|'demo';sections:string[];figure?:Paper['figure'];}
export interface FeedResult {
 papers:Paper[];nextCursor:number;hasMore:boolean;mode:'live'|'demo';message?:string;snapshot?:string;overview?:TopicOverview;
 requestedRange?:DateRange;effectiveRange?:DateRange;expanded?:boolean;sourceWarnings?:string[];
}
export type ModelName='gpt-6.1-terra'|'gpt-6-luna';
export type FeedEvent=
 |{type:'status';message:string}|{type:'card';paper:Paper}|{type:'complete';result:FeedResult}|{type:'error';error:string}
 |{type:'metadata';message?:string;sourceWarnings?:string[]}
 |{type:'posts-ready';result:FeedResult}
 |{type:'overview';overview:TopicOverview}|{type:'figure';id:string;figure:PaperFigure}
 |{type:'visual-status';id:string;status:'loading'|'ready'|'unavailable'};
