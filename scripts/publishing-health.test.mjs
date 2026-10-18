import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPage,inspectBacklog,inspectDeployment,run,pages} from './publishing-health.mjs';
test('homepage HTTP 200 is rejected as an article',()=>assert.ok(inspectPage(...pages[0],200,'<h1>Welcome</h1>').some(x=>x.includes('fallback'))));
test('overdue open work alerts, completed or future work does not',()=>{
 const row={title:'Draft',owner:'Team',nextAction:'Review',dueAt:'2026-10-01T00:00:00Z'};
 assert.equal(inspectBacklog([{...row,status:'draft'}],Date.parse('2026-10-18')).length,1);
 assert.equal(inspectBacklog([{...row,status:'published'}],Date.parse('2026-10-18')).length,0);
 assert.equal(inspectBacklog([{...row,status:'draft'}],Date.parse('2026-09-18')).length,0);
});
test('only failed production deployment emits deployment alert',()=>{
 assert.equal(inspectDeployment('error','Production').length,1);
 assert.equal(inspectDeployment('success','Production').length,0);
 assert.equal(inspectDeployment('error','Preview').length,0);
});
test('actual content, metadata and internal links pass',async()=>assert.deepEqual(await run(),[]));
