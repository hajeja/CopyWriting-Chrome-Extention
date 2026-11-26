const assert=require('node:assert/strict');
const {createPanel,tick,deferred}=require('./panel-harness.cjs');
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await tick();}throw new Error('Expected asynchronous stage was not reached.');}
async function ready(){const panel=createPanel();await panel.ready();await panel.project();panel.nodes.apiKey.value='test-key';return panel;}
function navigate(panel,{id=panel.state.tab.id,url=panel.state.tab.url,reload=false}={}){
  const changedTab=id!==panel.state.tab.id;
  panel.state.tab={id,url};
  return changedTab?panel.events.activated.emit({tabId:id,windowId:1}):panel.events.updated.emit(id,reload?{status:'loading'}:{url});
}
(async()=>{
  const panel=await ready();
  await panel.page();assert.equal(panel.nodes.preview.hidden,false);assert.equal(panel.nodes.previewItems.children.length,2);assert.equal(panel.state.requests.length,0);
  await panel.click('sendReview');assert(panel.text().includes('Banner Alpha'));assert(panel.text().includes('Banner Beta'));assert(panel.text().includes('Keep'));
  const payload=panel.state.requests[0].payload,input=JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(input.sharedProjectContext.domain,'supplier');assert.equal(input.sharedProjectContext.projectContext,'Confirmed shared context');
  assert(payload.systemInstruction.parts[0].text.includes('supplier-guideline-03'));
  const locate=panel.nodes.results.children.find(node=>node.tag==='article').children.find(node=>node.tag==='button');await locate.handlers.click();
  assert.equal(panel.state.injections.at(-1).args[0],'banner-token');
  const projectId=panel.ctx.memory.snapshot().project.id;
  await navigate(panel,{id:13,url:'https://example.test/invoice'});assert.equal(panel.text(),'');assert.equal(panel.nodes.preview.hidden,true);assert.equal(panel.ctx.memory.snapshot().project.id,projectId);
  const injectionsAfterNavigation=panel.state.injections.length;await locate.handlers.click();assert.equal(panel.state.injections.length,injectionsAfterNavigation);assert.equal(panel.nodes.auditStatus.textContent,'');
  await panel.selected();assert(panel.text().includes('Selected Alpha'));assert.equal(panel.state.requests.length,2);
  await panel.page();assert.equal(panel.text(),'');assert.equal(panel.nodes.previewItems.children.length,2);assert.equal(panel.ctx.session.capture().mode,'page');
  await panel.click('sendReview');assert(!panel.text().includes('Selected Alpha'));
  await navigate(panel,{url:'https://example.test/purchase-orders'});assert.equal(panel.text(),'');assert.equal(panel.nodes.preview.hidden,true);
  await panel.selected();panel.click('resetWorkspace');
  assert.equal(panel.text(),'');assert.equal(panel.nodes.previewItems.children.length,0);assert.equal(panel.nodes.domain.value,'');assert.equal(panel.ctx.session.capture().project,null);
  assert.equal(panel.nodes.auditWorkspace.hidden,true);assert.equal(panel.state.store.projectMemoryV2.length,1);

  // Reset aborts a pending review; even a fetch mock ignoring AbortSignal cannot restore results.
  const resetting=await ready();const delayed=deferred();resetting.state.reviewGate=delayed;
  const oldReview=resetting.selected();await until(()=>delayed.answer);
  resetting.click('resetWorkspace');assert(resetting.state.requests[0].signal.aborted);
  delayed.resolve(delayed.answer);await oldReview;
  assert.equal(resetting.text(),'');assert.equal(resetting.nodes.auditStatus.textContent,'');assert.equal(resetting.nodes.auditWorkspace.hidden,true);

  // A late old response/finally cannot overwrite or unlock a newer in-flight audit.
  const racing=await ready();const first=deferred();racing.state.reviewGate=first;
  const firstRun=racing.selected();await until(()=>first.answer);
  await navigate(racing,{id:88,url:'https://example.test/new'});await tick();
  const second=deferred();racing.state.reviewGate=second;
  const secondRun=racing.selected();await until(()=>second.answer);
  first.resolve(first.answer);await firstRun;assert.equal(racing.nodes.audit.disabled,true);assert.equal(racing.nodes.sendReview.disabled,true);
  second.resolve(second.answer);await secondRun;assert.match(racing.nodes.auditStatus.textContent,/Audit complete/);assert.equal(racing.nodes.audit.disabled,true);

  // URL changes and same-URL document reloads invalidate pending responses.
  for(const reload of [false,true]){
    const moving=await ready(),gate=deferred();moving.state.reviewGate=gate;
    const run=moving.selected();await until(()=>gate.answer);
    await navigate(moving,{url:reload?moving.state.tab.url:'https://example.test/another',reload});
    gate.resolve(gate.answer);await run;assert.equal(moving.text(),'');assert.equal(moving.nodes.auditStatus.textContent,'');
    assert.equal(moving.ctx.memory.snapshot().project.tribe,'supplier');
  }

  // Switching audit modes cancels an old AI call and leaves only the banner preview.
  const modes=await ready(),modeGate=deferred();modes.state.reviewGate=modeGate;
  const selectedRun=modes.selected();await until(()=>modeGate.answer);
  await modes.page();assert.equal(modes.nodes.preview.hidden,false);assert.equal(modes.text(),'');
  modeGate.resolve(modeGate.answer);await selectedRun;assert.equal(modes.nodes.preview.hidden,false);assert.equal(modes.text(),'');

  // A delayed extraction cannot recreate a preview after Reset.
  const extracting=await ready(),extractGate=deferred();extracting.state.injectionGate=extractGate;
  const extraction=extracting.page();await until(()=>extracting.state.injections.length>0);extracting.click('resetWorkspace');
  extractGate.resolve([{result:{token:'late',total:1,items:[{id:0,text:'Stale banner'}]}}]);await extraction;
  assert.equal(extracting.nodes.preview.hidden,true);assert.equal(extracting.nodes.previewItems.children.length,0);

  // A project change cancels the old review and selects the new tribe's Foundation.
  const projects=await ready(),projectGate=deferred();projects.state.reviewGate=projectGate;
  const oldProjectRun=projects.selected();await until(()=>projectGate.answer);
  await projects.project('buyer','Buyer App','Buyer-only facts');projectGate.resolve(projectGate.answer);await oldProjectRun;
  assert.equal(projects.text(),'');projects.state.reviewGate=null;await projects.selected();
  const buyerPayload=projects.state.requests.at(-1).payload,buyerInput=JSON.parse(buyerPayload.contents[0].parts[0].text);
  assert.equal(buyerInput.sharedProjectContext.domain,'buyer');assert.equal(buyerInput.sharedProjectContext.projectContext,'Buyer-only facts');
  assert(buyerPayload.systemInstruction.parts[0].text.includes('buyer-playbook-25'));assert(!buyerPayload.systemInstruction.parts[0].text.includes('supplier-guideline-03'));
  projects.click('editProject');projects.nodes.projectShared.value='Latest Buyer facts';await projects.click('saveProject');assert.equal(projects.text(),'');
  await projects.selected();assert.equal(JSON.parse(projects.state.requests.at(-1).payload.contents[0].parts[0].text).sharedProjectContext.projectContext,'Latest Buyer facts');

  // Late errors do not replace Reset's empty status.
  const failing=await ready(),failure=deferred();failing.state.reviewGate=failure;
  const failureRun=failing.selected();await until(()=>failure.answer);failing.click('resetWorkspace');failure.reject(Error('late failure'));await failureRun;
  assert.equal(failing.nodes.auditStatus.textContent,'');

  // Source verification also catches a changed URL even if its Chrome event is delayed.
  const missedEvent=await ready(),missed=deferred();missedEvent.state.reviewGate=missed;
  const missedRun=missedEvent.selected();await until(()=>missed.answer);missedEvent.state.tab.url='https://example.test/no-event';missed.resolve(missed.answer);await missedRun;
  assert.equal(missedEvent.text(),'');

  // Supported failures stay explicit and do not send data.
  const restricted=await ready();await navigate(restricted,{url:'chrome://extensions/'});await restricted.page();assert.match(restricted.nodes.auditStatus.textContent,/restricted/);assert.equal(restricted.state.requests.length,0);
  const sheets=await ready();await navigate(sheets,{url:'https://docs.google.com/spreadsheets/d/example/edit'});sheets.mode('selected');await sheets.click('audit');assert.equal(sheets.state.requests.length,0);assert.equal(sheets.state.injections.length,0);
  const missing=await ready();missing.state.missingFoundation=true;await missing.page();assert.match(missing.nodes.auditStatus.textContent,/Foundation is unavailable/);assert.equal(missing.state.requests.length,0);
  console.log('Full project/audit flow, preview approval, tribe isolation, Locate, page/tab/mode/project/reset invalidation and late success/error/extraction races verified with mocked Chrome and Gemini APIs.');
})().catch(error=>{console.error(error);process.exitCode=1;});
