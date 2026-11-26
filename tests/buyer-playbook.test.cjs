const assert=require('node:assert/strict'),fs=require('node:fs');
const {createPanel}=require('./panel-harness.cjs');
const source=JSON.parse(fs.readFileSync('foundation/buyer-guidelines-v0.1.1-pilot-approved.json','utf8'));
function rules(payload){const prompt=payload.systemInstruction.parts[0].text;return JSON.parse(prompt.slice(prompt.lastIndexOf('FOUNDATION:')+prompt.slice(prompt.lastIndexOf('FOUNDATION:')).indexOf('\n')+1,prompt.lastIndexOf('\nUse the Foundation')));}
(async()=>{
 const panel=createPanel();await panel.ready();await panel.project('buyer','Buyer','Buyer notifications');panel.nodes.apiKey.value='test-key';
 panel.state.selectionText='😊 Pesananmu sudah sampai';
 // Fixture response tests the existing response/rendering pipeline, not live model judgment.
 panel.state.reviewResponse=[{id:0,decision:'Rewrite',ruleChecks:source.domains.buyer.guidelines.map(rule=>({ruleId:rule.id,outcome:rule.id==='buyer-playbook-21'?'issue':'met',finding:rule.id==='buyer-playbook-21'?'Emoji placement: Letakkan emoji di akhir copy.':''})),findings:['Emoji placement: Letakkan emoji di akhir copy.'],suggestion:'Pesananmu sudah sampai 😊',openQuestion:'',uxTreatment:'-'}];
 await panel.selected();
 const manual=panel.state.requests.at(-1).payload,view=rules(manual);
 assert.equal(view.version,'0.2.0-playbook-replacement');assert.equal(view.guidelines.length,25);
 assert.deepEqual(view.guidelines.map(rule=>rule.rule),source.domains.buyer.guidelines.map(rule=>rule.rule));
 assert.match(view.guidelines.find(rule=>rule.id==='buyer-playbook-21').rule,/end of title or body/);
 assert.match(view.guidelines.find(rule=>rule.id==='buyer-playbook-22').rule,/one emoji/);
 assert.match(view.guidelines.find(rule=>rule.id==='buyer-playbook-22').rule,/half the time/);
 assert.equal(JSON.parse(manual.contents[0].parts[0].text).elements[0].text,'😊 Pesananmu sudah sampai');
 assert(panel.text().includes('Emoji placement'));assert(panel.text().includes('Pesananmu sudah sampai 😊'));
 panel.state.reviewResponse=null;panel.state.bannerText='Pesananmu sudah sampai 😊';
 await panel.page();await panel.click('sendReview');
 assert.deepEqual(rules(panel.state.requests.at(-1).payload).guidelines,view.guidelines);
 panel.state.selectionText='Pesananmu sudah sampai 😊';
 for(const tribe of ['supplier','mitra','buyer']){
   await panel.project(tribe,tribe,'Confirmed context');await panel.selected();
   const scoped=rules(panel.state.requests.at(-1).payload);
   assert.equal(scoped.domain,tribe);assert.equal(scoped.guidelines.length,{supplier:4,mitra:9,buyer:25}[tribe]);
   assert(scoped.guidelines.every(rule=>rule.id.startsWith(tribe+'-')));
   if(tribe!=='buyer')assert(!scoped.guidelines.some(rule=>rule.id==='buyer-playbook-21'));
 }
 console.log('All 25 exact Buyer rules, emoji placement/quantity/frequency, both audit-mode payloads, fixture findings/rendering and tribe-switch isolation verified. Live AI judgment not tested.');
})().catch(error=>{console.error(error);process.exitCode=1;});
