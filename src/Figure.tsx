import {useEffect,useState} from 'react';
import type {PaperFigure} from './types';
import {validCrop} from './feedState';
function httpsLink(value:string|undefined){try{const url=new URL(value??'');return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}}
/** The source bitmap is unchanged. A reversible viewport isolates the selected panel. */
export function Figure({figure}:{figure:PaperFigure}){
 const [failed,setFailed]=useState(false);const [showFull,setShowFull]=useState(false);const [size,setSize]=useState({width:figure.width||640,height:figure.height||420});
 useEffect(()=>{setFailed(false);setShowFull(false);setSize({width:figure.width||640,height:figure.height||420});},[figure.url,figure.crop?.x,figure.crop?.y,figure.crop?.width,figure.crop?.height]);
 if(failed)return null;
 const crop=validCrop(figure.crop)&&!showFull?figure.crop:undefined;
 const original=httpsLink(figure.sourceUrl??figure.url);
 const image=<img src={figure.url} alt={figure.caption} width={figure.width||640} height={figure.height||420} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={e=>setSize({width:e.currentTarget.naturalWidth||640,height:e.currentTarget.naturalHeight||420})} onError={()=>setFailed(true)} style={crop?{width:`${100/crop.width}%`,left:`${-100*crop.x/crop.width}%`,top:`${-100*crop.y/crop.height}%`}:undefined}/>;
 return <figure className={`paper-figure ${figure.kind==='illustration'?'is-illustration':''} ${crop?'is-cropped':''}`}>
  {crop?<div className="figure-crop-stage"><div className="figure-crop" style={{aspectRatio:`${size.width*crop.width}/${size.height*crop.height}`,width:`min(100%,${460*size.width*crop.width/(size.height*crop.height)}px)`}}>{image}</div></div>:image}
  <figcaption><div className="figure-caption-top"><span className="figure-source">{figure.kind==='illustration'?'Concept illustration':crop?`${figure.panel||'Selected panel'} · cropped`:'From the paper'}</span><div className="figure-controls">{validCrop(figure.crop)&&<button type="button" onClick={()=>setShowFull(value=>!value)}>{showFull?'Selected panel':'Full figure'}</button>}{figure.kind==='paper'&&original&&<a href={original} target="_blank" rel="noreferrer">Source ↗</a>}</div></div><span className="figure-caption">{figure.caption}</span>{figure.attribution&&<span className="figure-attribution">{figure.attribution}{figure.license?` · ${figure.license}`:''}</span>}{figure.originalCaption&&figure.originalCaption!==figure.caption&&<details className="figure-original-caption"><summary>Original caption</summary><p>{figure.originalCaption}</p></details>}</figcaption>
 </figure>;
}
