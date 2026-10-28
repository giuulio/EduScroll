import type { Paper } from './types';

export interface IllustrationSpec {
  layout: 'pipeline' | 'network' | 'layers' | 'comparison' | 'orbit';
  labels: string[];
  accent: 'purple' | 'blue' | 'green' | 'orange' | 'pink';
  caption: string;
}
const palettes = {
  purple: ['#7354c8', '#e6ddf7', '#f5f1fb'],
  blue: ['#3778b2', '#d8eaf8', '#eff6fb'],
  green: ['#41856a', '#d6ebe0', '#eff7f2'],
  orange: ['#b96c3c', '#f4dfcd', '#fcf5ef'],
  pink: ['#b65880', '#f1dbe5', '#fcf0f5'],
};
function escapeXml(s: string) { return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!); }
export function illustrationFigure(spec: IllustrationSpec): NonNullable<Paper['figure']> {
  const [ink, fill, bg] = palettes[spec.accent] ?? palettes.purple;
  const labels = Array.from({length:3}, (_,i) => escapeXml((spec.labels[i] ?? 'Research').slice(0,26)));
  const text = (x:number,y:number,label:string,size=20) => `<text x="${x}" y="${y}" text-anchor="middle" fill="${ink}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="500">${label}</text>`;
  const node = (x:number,y:number,r=42) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="2.5"/>`;
  const arrow = (x1:number,y1:number,x2:number,y2:number) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${ink}" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>`;
  let art='';
  switch(spec.layout){
    case 'network': {
      const pts=[[180,125],[320,80],[460,125],[450,245],[320,290],[190,245]];
      art=pts.map(([x,y],i)=>`<path d="M320 185L${x} ${y}M${x} ${y}L${pts[(i+1)%6][0]} ${pts[(i+1)%6][1]}" stroke="${ink}" opacity=".35" stroke-width="2"/>`).join('');
      art+=pts.map(([x,y])=>node(x,y,23)).join('')+node(320,185,42)+`<circle cx="320" cy="185" r="12" fill="${ink}"/>`;
      art+=text(160,335,labels[0],18)+text(320,365,labels[1],18)+text(480,335,labels[2],18);break;
    }
    case 'layers':
      art=[0,1,2].map(i=>`<path d="M150 ${150+i*68}L320 ${85+i*68}L490 ${150+i*68}L320 ${215+i*68}Z" fill="${i%2?bg:fill}" stroke="${ink}" stroke-width="2.5"/>`+text(320,158+i*68,labels[i],19)).join('');break;
    case 'comparison':
      art=`<rect x="76" y="82" width="216" height="224" rx="22" fill="${fill}"/><rect x="348" y="82" width="216" height="224" rx="22" fill="${fill}"/>`;
      art+=Array.from({length:9},(_,i)=>`<circle cx="${130+(i%3)*53}" cy="${130+Math.floor(i/3)*57}" r="12" fill="${ink}" opacity=".5"/>`).join('');
      art+=`<path d="M391 194L430 145L476 235L513 176" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
      art+=text(184,342,labels[0],19)+text(456,342,labels[1],19)+text(320,382,labels[2],17);break;
    case 'orbit':
      art=`<ellipse cx="320" cy="195" rx="203" ry="85" fill="none" stroke="${ink}" stroke-width="2" transform="rotate(-25 320 195)" opacity=".4"/><ellipse cx="320" cy="195" rx="203" ry="85" fill="none" stroke="${ink}" stroke-width="2" transform="rotate(25 320 195)" opacity=".4"/>`;
      art+=node(320,195,61)+node(144,136,23)+node(486,263,23)+`<circle cx="320" cy="195" r="24" fill="${ink}" opacity=".65"/>`;
      art+=text(135,88,labels[0],19)+text(493,330,labels[1],19)+text(320,375,labels[2],18);break;
    default:
      art=arrow(163,190,270,190)+arrow(371,190,477,190)+node(112,190)+node(320,190)+node(528,190);
      art+=`<path d="M100 178h24v24h-24zM307 190l13-17 13 17-13 17z" fill="none" stroke="${ink}" stroke-width="3"/><path d="M515 190l9 10 18-22" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
      art+=text(112,280,labels[0],18)+text(320,280,labels[1],18)+text(528,280,labels[2],18);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 1L6 4L0 7" fill="none" stroke="${ink}" stroke-width="1.5"/></marker></defs><rect width="640" height="420" rx="20" fill="${bg}"/>${art}<text x="30" y="35" fill="${ink}" opacity=".6" font-family="Arial,Helvetica,sans-serif" font-size="10" letter-spacing="2">CONCEPT ILLUSTRATION</text></svg>`;
  return {url:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,caption:spec.caption,kind:'illustration'};
}
// For old bookmarks and a source image that fails to load, retain an honest conceptual cover.
// Live cards and the current demo provide their own Terra-authored IllustrationSpec.
export function fallbackSpec(p:Paper):IllustrationSpec {
  return p.illustration ?? {layout:'pipeline',labels:[p.tags[0]??'Research','New approach','What changes'],accent:'purple',caption:`Concept illustration for ${p.headline}. Not an experimental result.`};
}
export function ensureVisual(p:Paper):Paper {
  return {...p,illustration:fallbackSpec(p),figure:p.figure?{...p.figure,kind:p.figure.kind??'paper'}:illustrationFigure(fallbackSpec(p))};
}
