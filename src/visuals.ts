import type {Paper} from './types';

export const illustrationLayouts=['pipeline','network','layers','comparison','orbit','hexagons','robot','sound','roads','video','device','documents','motion','solar','heart'] as const;
export interface IllustrationSpec {
  layout:typeof illustrationLayouts[number];
  labels:string[];
  accent:'purple'|'blue'|'green'|'orange'|'pink';
  caption:string;
}
const palettes={
  purple:['#7354c8','#e6ddf7','#f5f1fb'], blue:['#3778b2','#d8eaf8','#eff6fb'],
  green:['#41856a','#d6ebe0','#eff7f2'], orange:['#b96c3c','#f4dfcd','#fcf5ef'],
  pink:['#b65880','#f1dbe5','#fcf0f5'],
};
function escapeXml(s:string){return s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}
export function illustrationFigure(spec:IllustrationSpec):NonNullable<Paper['figure']>{
  const [ink,fill,bg]=palettes[spec.accent]??palettes.purple;
  const labels=spec.labels.slice(0,3).map(s=>escapeXml(s.slice(0,16)));
  const text=(x:number,y:number,i:number,size=25)=>labels[i]?`<text x="${x}" y="${y}" text-anchor="middle" fill="${ink}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="500">${labels[i]}</text>`:'';
  const node=(x:number,y:number,r=32)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="3"/>`;
  const path=(d:string,width=4,opacity=1)=>`<path d="${d}" stroke="${ink}" stroke-width="${width}" opacity="${opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const arrow=(x1:number,y1:number,x2:number,y2:number)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${ink}" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`;
  const legend=(y=370)=>labels.map((_,i)=>text(320+(i-(labels.length-1)/2)*190,y,i,labels.length===1?23:18)).join('');
  let art='';
  switch(spec.layout){
    case 'hexagons':{
      const hex=(x:number,y:number)=>`<path d="M${x} ${y-48}l42 24v48l-42 24-42-24v-48Z" fill="${fill}" stroke="${ink}" stroke-width="3"/>`;
      art=[[235,143],[319,143],[403,143],[193,215],[277,215],[361,215],[445,215]].map(([x,y])=>hex(x,y)).join('');
      art+=legend();break;
    }
    case 'robot':
      art=`<rect x="140" y="276" width="195" height="20" rx="10" fill="${fill}"/>`+path('M168 276l42-99 94-47 89 65 47 5',20)+node(210,177,23)+node(304,130,23)+node(393,195,19)+path('M441 183v46m0-23h29m0-18v35',5)+`<rect x="478" y="240" width="39" height="40" rx="6" fill="${fill}" stroke="${ink}" stroke-width="3"/>`+path('M111 300h425',3,.5)+legend();break;
    case 'sound':
      art=`<rect x="102" y="104" width="436" height="188" rx="32" fill="${fill}"/>`+path('M150 175h33l48-38v121l-48-38h-33Z',4)+path('M265 166q45 34 0 68m22-90q75 56 0 112',5)+`<rect x="354" y="141" width="139" height="112" rx="20" fill="${bg}" stroke="${ink}" stroke-width="3"/>`+path('M393 166v49q-17-9-22 5t18 10q10-4 10-18v-31l50-12v38q-20-7-23 8t21 6q9-6 9-19v-45Z',3)+legend();break;
    case 'roads':
      art=path('M105 97l430 211M105 308L535 96M320 74v247',26,.18)+path('M105 97l430 211M105 308L535 96M320 74v247',3,.65)+[[202,145],[425,150],[214,254],[320,198],[320,91],[429,256]].map(([x,y])=>node(x,y,13)).join('')+legend();break;
    case 'video':
      art=`<rect x="111" y="83" width="418" height="238" rx="24" fill="${fill}" stroke="${ink}" stroke-width="3"/><rect x="136" y="109" width="368" height="158" rx="10" fill="${bg}"/>`+path('M170 230l73-63 53 41 80-77 93 99',4,.55)+`<path d="M292 150l62 37-62 37Z" fill="${ink}"/><rect x="137" y="285" width="234" height="7" rx="3" fill="${ink}" opacity=".4"/>`+node(371,288,9)+legend();break;
    case 'device':
      art=`<rect x="232" y="64" width="176" height="260" rx="28" fill="${fill}" stroke="${ink}" stroke-width="4"/><rect x="248" y="96" width="144" height="185" rx="10" fill="${bg}"/><rect x="290" y="78" width="60" height="5" rx="3" fill="${ink}" opacity=".5"/><circle cx="320" cy="301" r="8" fill="${ink}" opacity=".5"/>`+path('M264 253l39-63 24 28 25-47 24 82Z',3)+node(281,132,12)+legend();break;
    case 'documents':
      art=[[-190,-18,0],[0,17,1],[190,-18,2]].map(([dx,dy,i])=>`<g transform="translate(${dx} ${dy})"><rect x="249" y="92" width="142" height="188" rx="15" fill="${i===1?bg:fill}" stroke="${ink}" stroke-width="3"/>${path('M273 132h94M273 158h74M273 184h88M273 210h55',4,.5)}</g>`).join('')+legend();break;
    case 'motion':
      art=`<path d="M153 113l266-27 71 63-264 31Z" fill="${fill}" stroke="${ink}" stroke-width="3"/><path d="M153 113v144l73 62V180m0 139 264-33V149" fill="${bg}" stroke="${ink}" stroke-width="3"/><path d="M226 180l264-31v137l-264 33Z" fill="${fill}" stroke="${ink}" stroke-width="3"/>`+path('M338 213l48-5',8)+arrow(341,288,341,340)+legend(385);break;
    case 'network':{
      const pts=[[170,120],[320,80],[468,130],[447,260],[306,292],[180,250]];
      art=pts.map(([x,y],i)=>path(`M320 185L${x} ${y}M${x} ${y}L${pts[(i+1)%6][0]} ${pts[(i+1)%6][1]}`,2,.35)).join('');
      art+=pts.map(([x,y])=>node(x,y,23)).join('')+node(320,185,42)+legend();break;
    }
    case 'layers':
      art=[0,1,2].map(i=>`<path d="M150 ${133+i*65}L320 ${68+i*65}L490 ${133+i*65}L320 ${198+i*65}Z" fill="${i%2?bg:fill}" stroke="${ink}" stroke-width="3"/>`).join('')+legend();break;
    case 'solar':
      art=node(164,108,36)+[0,1,2].map(i=>arrow(209+i*65,95,270+i*65,181)).join('')+[0,1,2].map(i=>`<path d="M133 ${219+i*29}l235-65 137 75-235 65Z" fill="${i%2?bg:fill}" stroke="${ink}" stroke-width="3"/>`).join('')+legend();break;
    case 'heart':
      // Separate symbols express energy flow; a wire would misleadingly depict a leaded implant.
      art=`<path d="M227 281C193 248 99 190 119 139c15-39 67-46 107-3 40-43 92-36 107 3 20 51-74 109-106 142Z" fill="${fill}" stroke="${ink}" stroke-width="4"/><rect x="426" y="157" width="94" height="69" rx="25" fill="${bg}" stroke="${ink}" stroke-width="3"/>`+arrow(350,190,404,190)+legend();break;
    case 'comparison':
      // Qualitative objects only: fabricated plots would imply evidence we do not have.
      art=`<rect x="86" y="99" width="203" height="196" rx="28" fill="${fill}"/><rect x="351" y="99" width="203" height="196" rx="28" fill="${fill}"/>`+node(187,194,45)+path('M415 194l39-45 40 45-40 45Z',4)+text(187,341,0,20)+text(453,341,1,20)+text(320,383,2,20);break;
    case 'orbit':
      art=`<ellipse cx="320" cy="190" rx="190" ry="78" fill="none" stroke="${ink}" stroke-width="2" transform="rotate(-25 320 190)" opacity=".4"/><ellipse cx="320" cy="190" rx="190" ry="78" fill="none" stroke="${ink}" stroke-width="2" transform="rotate(25 320 190)" opacity=".4"/>`+node(320,190,53)+node(154,134,22)+node(476,251,22)+legend();break;
    default:
      art=arrow(163,175,270,175)+arrow(371,175,477,175)+node(112,175,42)+node(320,175,42)+node(528,175,42)+text(112,272,0,19)+text(320,272,1,19)+text(528,272,2,19);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 1L6 4L0 7" fill="none" stroke="${ink}" stroke-width="1.5"/></marker></defs><rect width="640" height="420" rx="20" fill="${bg}"/>${art}<text x="25" y="32" fill="${ink}" opacity=".6" font-family="Arial,Helvetica,sans-serif" font-size="10" letter-spacing="2">CONCEPT ILLUSTRATION</text></svg>`;
  return {url:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,caption:spec.caption,kind:'illustration',readable:true};
}
export function fallbackSpec(p:Paper):IllustrationSpec{
  return p.illustration??{layout:'layers',labels:[p.tags[0]??'Research'],accent:'purple',caption:`Concept illustration for ${p.headline}. Not an experimental result.`};
}
export function ensureVisual(p:Paper):Paper{
  if(p.visualPreference==='none')return {...p,figure:undefined};
  return {...p,illustration:fallbackSpec(p),figure:p.figure?.readable?{...p.figure,kind:p.figure.kind??'paper'}:illustrationFigure(fallbackSpec(p))};
}
