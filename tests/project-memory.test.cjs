const assert=require('node:assert/strict');
const {createPanel,tick}=require('./panel-harness.cjs');
(async()=>{
  const panel=createPanel();await panel.ready();
  assert.equal(panel.nodes.projectFields.hidden,true);assert.equal(panel.nodes.auditWorkspace.hidden,true);
  await panel.selected();assert.equal(panel.state.requests.length,0);assert.equal(panel.state.injections.length,0);
  panel.change('domain','supplier');assert.equal(panel.nodes.projectFields.hidden,true);panel.change('projectChoice','new');assert.equal(panel.nodes.projectFields.hidden,false);
  await panel.project();
  assert.equal(panel.nodes.auditWorkspace.hidden,false);assert.equal(panel.nodes.projectSetup.hidden,true);
  const saved=panel.state.store.projectMemoryV2;
  assert.deepEqual(Object.keys(saved[0]).sort(),['context','id','name','tribe']);
  assert.equal(panel.ctx.memory.snapshot().project.tribe,'supplier');
  assert.equal(panel.state.requests.length,0);assert.equal(panel.state.modelReads,0);
  const id=saved[0].id;
  panel.click('resetWorkspace');assert.equal(panel.nodes.domain.value,'');assert.equal(panel.nodes.projectShared.value,'');assert.equal(panel.nodes.projectName.value,'');
  assert.equal(panel.nodes.auditWorkspace.hidden,true);assert.equal(panel.state.store.projectMemoryV2.length,1);
  panel.change('domain','buyer');assert(!panel.nodes.projectChoice.children.some(option=>option.value===id));
  await panel.project('buyer','Buyer App','Buyer context');
  assert.equal(panel.state.store.projectMemoryV2.length,2);
  const reopened=createPanel(panel.state.store);await reopened.ready();
  assert.equal(reopened.ctx.memory.snapshot().project,null);assert.equal(reopened.nodes.domain.value,'');
  reopened.change('domain','supplier');reopened.change('projectChoice',id);
  assert.equal(reopened.ctx.memory.snapshot().project.context,'Confirmed shared context');
  reopened.click('editProject');reopened.nodes.projectShared.value='Updated business context';await reopened.click('saveProject');
  assert.equal(reopened.ctx.memory.snapshot().project.id,id);assert.equal(reopened.ctx.memory.snapshot().project.context,'Updated business context');
  assert.equal(reopened.state.store.projectMemoryV2.length,2);assert.equal(reopened.state.requests.length,0);
  // Legacy records are archived intact and only assigned to a tribe by explicit Save.
  const legacy={id:'old',name:'Older Portal',shared:'Old context',hosts:['example.test'],routes:[{name:'Invoice',pattern:'/invoice*',context:'Old page context'}]};
  const previous=createPanel({projectMemoryV1:[legacy]});await previous.ready();assert.equal(previous.state.writes,0);
  previous.change('domain','mitra');previous.change('projectChoice','legacy:old');
  assert.equal(previous.nodes.projectShared.value,'Old context');assert.equal(previous.ctx.memory.snapshot().project,null);
  await previous.click('saveProject');assert.deepEqual(previous.state.store.projectMemoryV1,[legacy]);
  assert.deepEqual(previous.state.store.projectMemoryV2,[{id:'old',tribe:'mitra',name:'Older Portal',context:'Old context'}]);
  // Reset during an asynchronous save cannot reactivate a workspace later.
  previous.click('editProject');const save=previous.click('saveProject');previous.ctx.memory.reset();await save;await tick();
  assert.equal(previous.ctx.memory.snapshot().project,null);assert.equal(previous.nodes.projectSetup.hidden,false);
  console.log('Tribe-first setup, four-field persistence, tribe-filtered reload, editing, reset without deletion, and explicit legacy assignment verified.');
})().catch(error=>{console.error(error);process.exitCode=1;});
