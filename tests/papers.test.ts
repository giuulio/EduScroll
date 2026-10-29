import test from 'node:test';
import assert from 'node:assert/strict';
import {queryFor,discoveryQueryFor,parseFeed,extractArticle,paperIdPattern} from '../server/papers';

const now=new Date('2026-10-28T17:00:00Z');
test('today uses today, and a week includes seven calendar dates',()=>{
 assert.match(queryFor('robotics',1,now),/202610280000 TO 202610282359/);
 assert.match(queryFor('robotics',7,now),/202610220000 TO 202610282359/);
});
test('topic input cannot introduce an arXiv field or boolean expression',()=>{
 const query=queryFor('robots") OR cat:secret',7,now);
 assert.ok(!query.includes('cat:secret'));
 assert.match(query,/all:robots AND all:OR AND all:cat AND all:secret/);
 assert.throws(()=>queryFor('!!!',7,now));
});
test('discovery queries use concepts and UTC calendar month boundaries',()=>{
 const query=discoveryQueryFor('novel nanotech for pacemakers','month',now);
 assert.match(query,/all:"nanotechnology" OR all:"nanomaterial" OR all:"nanoscale"/);
 assert.match(query,/all:"pacemaker" OR all:"cardiac pacing"/);
 assert.match(query,/202610010000 TO 202610282359/);
 assert.ok(!query.includes('all:"novel"')&&!query.includes('all:"for"'));
 const injection=discoveryQueryFor('robots") OR cat:secret','any',now);
 assert.ok(!injection.includes('cat:secret'));
 assert.match(injection,/all:"cat"/);
});
test('parses an Atom feed and deduplicates versions of the same paper',()=>{
 const entry=(id:string)=>`<entry><id>http://arxiv.org/abs/${id}</id><title> Test\n paper </title><published>2026-10-28</published><summary>An abstract.</summary><author><name>A Researcher</name></author><category term="cs.AI"/></entry>`;
 const xml=`<feed><opensearch:totalResults>3</opensearch:totalResults>${entry('2610.12345v1')}${entry('2610.12345v2')}${entry('https://evil.test')}</feed>`;
 const {papers,total}=parseFeed(xml);assert.equal(total,3);assert.equal(papers.length,1);assert.equal(papers[0].title,'Test paper');assert.deepEqual(papers[0].authors,['A Researcher']);assert.equal(papers[0].url,'https://arxiv.org/abs/2610.12345v1');
});
test('figures resolve relative to the HTML document and reject third-party URLs',()=>{
 const html='<main><h2>Methods</h2><p>Some evidence.</p><script>ignore this</script><figure><img src="2610.12345v1/x.png"/><figcaption>Result figure.</figcaption></figure><figure><img src="https://evil.test/tracker.png"/><figcaption>Other figure.</figcaption></figure></main>';
 const article=extractArticle(html,'2610.12345v1');assert.equal(article.figures.length,1);assert.equal(article.figures[0].url,'https://arxiv.org/html/2610.12345v1/x.png');assert.deepEqual(article.sections,['Methods']);assert.ok(!article.text.includes('ignore this'));
});
test('only arXiv IDs can be used for full-paper fetching',()=>{
 for(const id of ['2610.12345v1','1706.03762','hep-th/9901001'])assert.ok(paperIdPattern.test(id));
 for(const id of ['../../etc/passwd','https://example.com','2610.12345?redirect=x',''])assert.ok(!paperIdPattern.test(id));
});
