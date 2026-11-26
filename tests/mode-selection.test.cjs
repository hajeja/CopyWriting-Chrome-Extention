const assert=require('node:assert/strict'),fs=require('node:fs');
const {createPanel,tick,deferred}=require('./panel-harness.cjs');
async function until(fn){for(let n=0;n<200;n++){if(fn())return;await tick();}throw Error('Async stage not reached');}
(async()=>{
 const p=createPanel();await p.ready();await p.project();p.nodes.apiKey.value='test-key';
 assert.equal(p.nodes.modePage.checked,false);assert.equal(p.nodes.modeSelected.checked,false);assert.equal(p.nodes.audit.disabled,true);assert(!p.nodes.auditSelected);
 const html=fs.readFileSync('sidepanel.html','utf8');
 assert(html.includes('Review all copy detected on this page.'));
 assert(html.includes("Select the copy you want to review, right-click, then choose 'Audit Selected Copy' from the menu."));
 assert.equal((html.match(/name="auditMode"/g)||[]).length,2);assert(!/id="mode(?:Page|Selected)"[^>]*\bchecked\b/.test(html));
 await p.click('audit');assert.equal(p.state.requests.length,0);assert.equal(p.state.injections.length,0);
 const projectId=p.ctx.memory.snapshot().project.id,writes=p.state.writes;
 p.mode('page');assert.equal(p.nodes.audit.disabled,false);assert.equal(p.nodes.modeSelected.checked,false);assert.equal(p.state.requests.length,0);
 await p.click('audit');assert.equal(p.nodes.preview.hidden,false);assert.equal(p.nodes.previewItems.children.length,2);assert.equal(p.state.requests.length,0);
 await p.click('sendReview');assert(p.text().includes('Banner Alpha'));assert.equal(p.state.requests.length,1);
 p.mode('selected');assert.equal(p.nodes.audit.disabled,true);assert.equal(p.text(),'');assert.equal(p.nodes.preview.hidden,true);assert.equal(p.nodes.previewItems.children.length,0);
 const calls=p.state.requests.length;await p.click('audit');assert.equal(p.state.requests.length,calls);
 await p.selected();assert.equal(p.state.requests.length,calls+1);assert(p.text().includes('Selected Alpha'));assert.equal(p.nodes.modeSelected.checked,true);assert.equal(p.nodes.audit.disabled,true);
 const revision=p.ctx.session.capture().revision;await p.click('settingsTab');await p.click('projectTab');assert.equal(p.ctx.session.capture().revision,revision);assert.equal(p.nodes.modeSelected.checked,true);
 p.mode('page');assert.equal(p.text(),'');assert.equal(p.nodes.audit.disabled,false);assert.equal(p.ctx.memory.snapshot().project.id,projectId);assert.equal(p.state.writes,writes);assert.equal(p.nodes.apiKey.value,'test-key');
 // The context menu can choose selected mode itself; no Audit Now click follows.
 const duplicate={type:'AUDIT_SELECTED_COPY',text:'Menu copy',source:{tabId:p.state.tab.id,url:p.state.tab.url},requestedAt:Date.now()+10000,requestId:'one-user-action'};
 const before=p.state.requests.length;await Promise.all([p.events.message.emit(duplicate),p.events.message.emit(duplicate)]);
 assert.equal(p.state.requests.length,before+1);assert.equal(p.nodes.modeSelected.checked,true);assert.equal(p.nodes.modePage.checked,false);assert.equal(p.nodes.audit.disabled,true);
 p.mode('page');assert.equal(p.text(),'');
 // Merely switching the radio cancels the request. Its late result cannot restore UI.
 const gate=deferred();p.state.reviewGate=gate;const pending=p.selected();await until(()=>gate.answer);
 const signal=p.state.requests.at(-1).signal;p.mode('page');assert(signal.aborted);assert.equal(p.nodes.audit.disabled,false);
 gate.resolve(gate.answer);await pending;assert.equal(p.text(),'');assert.equal(p.nodes.auditStatus.textContent,'');assert.equal(p.nodes.modePage.checked,true);assert.equal(p.nodes.audit.disabled,false);
 p.click('resetWorkspace');assert.equal(p.nodes.modePage.checked,false);assert.equal(p.nodes.modeSelected.checked,false);assert.equal(p.nodes.audit.disabled,true);assert.equal(p.state.store.projectMemoryV2.length,1);
 console.log('Exact radio copy, initial unselected state, page-only CTA, immediate context-menu audit, deduplication, preserved project/settings and cancelled late responses on radio changes verified.');
})().catch(error=>{console.error(error);process.exitCode=1;});
