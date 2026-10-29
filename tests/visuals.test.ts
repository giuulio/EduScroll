import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureVisual,illustrationFigure,illustrationLayouts,type IllustrationSpec} from '../src/visuals';
import type {Paper} from '../src/types';
const spec:IllustrationSpec={layout:'pipeline',labels:['Robot videos','Predict motion','Robot actions'],accent:'blue',caption:'Conceptual illustration of learning robot actions from video.'};
const paper:Paper={id:'2610.12345v1',title:'Test paper',authors:['A Researcher'],published:'2026-10-28',category:'cs.RO',abstract:'Evidence.',url:'https://arxiv.org/abs/2610.12345v1',headline:'A robot learns from video',summary:'Researchers test a new approach.',whyItMatters:'Learning from video.',tags:['Robotics'],illustration:spec};
test('a paper without a source figure gets a labelled conceptual fallback',()=>{
 const result=ensureVisual(paper);assert.equal(result.figure?.kind,'illustration');assert.match(result.figure!.url,/^data:image\/svg\+xml/);assert.equal(result.figure?.caption,spec.caption);
});
test('source figures are preserved and labelled as original',()=>{
 const source={url:'https://arxiv.org/html/2610.12345v1/result.png',caption:'Original figure.',readable:true};const result=ensureVisual({...paper,figure:source});assert.equal(result.figure?.url,source.url);assert.equal(result.figure?.kind,'paper');assert.deepEqual(result.illustration,spec);
});
test('all illustration layouts are standalone images and contain no remote dependencies',()=>{
 for(const layout of illustrationLayouts){
  const result=illustrationFigure({...spec,layout});const svg=decodeURIComponent(result.url.split(',').slice(1).join(','));assert.match(svg,/viewBox="0 0 640 420"/);assert.match(svg,/CONCEPT ILLUSTRATION/);assert.ok(!svg.includes('<image'));assert.ok(!svg.includes('href='));assert.match(svg,/<\/svg>$/);
 }
});
test('model-supplied labels cannot inject executable markup',()=>{
 const f=illustrationFigure({...spec,labels:['<script>bad','A & B','"quoted"']});const svg=decodeURIComponent(f.url.split(',').slice(1).join(','));assert.ok(!svg.includes('<script>'));assert.match(svg,/&lt;script&gt;/);assert.match(svg,/A &amp; B/);assert.match(svg,/&quot;quoted&quot;/);
});

import {readFileSync} from 'node:fs';
import {illustrationSchema} from '../server/schemas';
test('published demo cards have either a safe visual or an explicit text-only choice',()=>{
 const demo=JSON.parse(readFileSync('src/demo.json','utf8')) as Paper[];assert.equal(demo.length,20);
 for(const item of demo){assert.ok(item.illustration,`Missing illustration for ${item.id}`);illustrationSchema.parse(item.illustration);const visual=ensureVisual(item).figure;if(item.visualPreference==='none'){assert.equal(visual,undefined);continue;}assert.ok(visual);assert.ok(visual.url.startsWith('https://arxiv.org/')||visual.url.startsWith('data:image/svg+xml'));assert.ok(visual.caption.length>0);}
});

test('text-only preference is preserved instead of forcing a decorative image',()=>{
 assert.equal(ensureVisual({...paper,visualPreference:'none'}).figure,undefined);
 assert.equal(ensureVisual({...paper,visualPreference:'none',figure:illustrationFigure(spec)}).figure,undefined);
});

test('the curated demo mixes subjects and keeps exact evidence for each post',()=>{
 const demo=JSON.parse(readFileSync('src/demo.json','utf8')) as (Paper&{evidence:string[];editorialVersion:string})[];
 const layouts=new Set(demo.filter(p=>p.visualPreference!=='none').map(p=>p.illustration?.layout));
 assert.ok(layouts.size>=8,'demo should explain different subjects with different compositions');
 assert.ok(demo.some(p=>p.visualPreference==='none'),'some posts should stand on their own');
 for(const item of demo){assert.ok(item.evidence.length>=1&&item.evidence.length<=3);assert.ok(item.editorialVersion);for(const quote of item.evidence)assert.ok(item.abstract.includes(quote),`Unmatched evidence for ${item.id}`);}
});

test('unreviewed legacy source diagrams fall back to a simple illustration',()=>{
 const result=ensureVisual({...paper,figure:{url:'https://arxiv.org/html/2610.12345v1/dense.png',caption:'A dense diagram.'}});assert.equal(result.figure?.kind,'illustration');assert.equal(result.figure?.readable,true);
});
