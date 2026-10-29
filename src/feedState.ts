import type {Paper,PaperFigure,FigureCrop} from './types';
export function validCrop(crop:FigureCrop|undefined):crop is FigureCrop {
 return !!crop&&[crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)&&crop.x>=0&&crop.y>=0&&crop.width>=.12&&crop.height>=.12&&crop.x+crop.width<=1.001&&crop.y+crop.height<=1.001;
}
export function preferredFigure(...figures:(PaperFigure|undefined)[]):PaperFigure|undefined{return figures.find(figure=>figure?.kind==='paper')??figures.find(Boolean);}
/** Media may arrive before text, after text, or before the final ranked result. */
export function mergePaper(previous:Paper|undefined,incoming:Paper):Paper {
 const figure=preferredFigure(incoming.figure,previous?.figure);
 return {...previous,...incoming,...(figure?{figure}:{}),...(figure?.kind==='paper'?{visualPreference:undefined}:{})};
}
export function mergePapers(previous:Paper[],incoming:Paper[]):Paper[]{
 const byId=new Map(previous.map(p=>[p.id,p]));for(const paper of incoming)byId.set(paper.id,mergePaper(byId.get(paper.id),paper));return [...byId.values()];
}
export function withFigure(paper:Paper,figure:PaperFigure):Paper{return {...paper,figure,...(figure.kind==='paper'?{visualPreference:undefined}:{})};}
