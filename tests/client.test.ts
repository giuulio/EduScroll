import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleFeed} from '../src/api';
test('demo respects publication dates and labels wider-date fallback',()=>{
 const now=new Date('2026-10-29T12:00:00Z');
 const today=sampleFeed('artificial intelligence',0,'today','latest',now);
 assert.equal(today.expanded,true);assert.equal(today.requestedRange,'today');assert.equal(today.effectiveRange,'any');assert.match(today.message!,/fixed 27 Oct/);
 assert.ok(today.papers.every(p=>p.published.startsWith('2026-10-27')));
 const month=sampleFeed('artificial intelligence',0,'month','latest',now);assert.equal(month.expanded,false);assert.ok(month.papers.length>0);
});
test('demo never fills an unrelated free-form query with random papers',()=>{
 const result=sampleFeed('nanotech for pacemakers',0,'any');assert.equal(result.papers.length,0);assert.match(result.message!,/Connect your key/);
});
