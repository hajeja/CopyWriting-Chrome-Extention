const assert=require('node:assert/strict'),fs=require('node:fs'),{createPanel}=require('./panel-harness.cjs');
const source=JSON.parse(fs.readFileSync('foundation/buyer-guidelines-v0.1.1-pilot-approved.json'));
const AIRO='Halo, selamat datang di Astro aku AIRO! 😊 Sekarang kamu bisa belanja 24 jam langsung dari WhatsApp, tanpa perlu buka aplikasi. Tinggal chat barang yang kamu butuhkan. Pesananmu sampai dalam hitungan menit, gratis ongkir!';
const proposed='Halo, selamat datang di Astro. Aku AIRO! Sekarang kamu bisa belanja 24 jam langsung dari WhatsApp, tanpa perlu buka aplikasi. Tinggal chat barang yang kamu butuhkan. Pesananmu sampai dalam hitungan menit, gratis ongkir! 😊';
const checks=issues=>source.domains.buyer.guidelines.map(rule=>({ruleId:rule.id,outcome:issues[rule.id]?'issue':'met',finding:issues[rule.id] || ''}));
const valid={id:0,decision:'Rewrite',findings:['Emoji placement: Pindahkan emoji ke akhir body.','Readability: Pisahkan perkenalan agar mudah dibaca.'],suggestion:proposed,ruleChecks:checks({'buyer-playbook-21':'Emoji placement: Pindahkan emoji ke akhir body.','buyer-playbook-05':'Readability: Pisahkan perkenalan agar mudah dibaca.'})};
(async()=>{
 const p=createPanel();await p.ready();await p.project('buyer','Buyer','WhatsApp greeting. Treat claims as supplied text, not verified promises.');p.nodes.apiKey.value='test-key';
 p.state.selectionText=AIRO;let attempt=0;
 p.state.reviewResponse=()=>[++attempt===1?{id:0,decision:'Rewrite',findings:['Brand name should be ASTRO (all caps).'],suggestion:AIRO.replace('Astro','ASTRO'),ruleChecks:checks({'buyer-playbook-12':'Brand name should be ASTRO (all caps).'})}:valid];
 await p.selected();assert.equal(p.state.requests.length,2);assert(!p.text().includes('Brand name should'));assert(!p.text().includes('ASTRO'));assert(p.text().includes('Emoji placement'));assert(p.text().includes('Readability'));assert(p.text().includes(proposed));
 for(const phrase of ['24 jam','WhatsApp','hitungan menit','gratis ongkir'])assert(proposed.includes(phrase));
 const payload=p.state.requests[0].payload,prompt=payload.systemInstruction.parts[0].text;
 assert(prompt.includes(JSON.stringify(source.domains.buyer.emoji)));assert(prompt.includes('one body message'));assert(!prompt.includes('supplier-guideline'));assert(!prompt.includes('mitra-guideline'));
 for(const rule of source.domains.buyer.guidelines)assert(prompt.includes(rule.rule));
 assert.equal(JSON.parse(payload.contents[0].parts[0].text).elements[0].text,AIRO);
 // A contradictory response is never displayed even if retry is also wrong.
 p.state.reviewResponse=[{...valid,suggestion:AIRO.replace('Astro','ASTRO')}];await p.selected();assert.match(p.nodes.auditStatus.textContent,/inconsistent review after retry/);assert(!p.nodes.results.children.some(node=>node.tag==='article'));
 const foundation=await p.ctx.loadFoundation();assert(foundation);
 const loaded=await require('node:vm').runInContext('FoundationLoader.load()',p.ctx);
 const test=(text,components,raw)=>p.ctx.validateReviewChecks(raw,{text,components},{domain:'buyer'},loaded.config);
 const keep={decision:'Keep',findings:['Sudah sesuai guideline'],ruleChecks:checks({})};
 assert.equal(test('Astro 😊',null,keep).decision,'Keep');
 assert.equal(test('Halo 😊\nPesananmu sudah sampai',[{type:'title',text:'Halo 😊'},{type:'body',text:'Pesananmu sudah sampai'}],keep).decision,'Keep');
 assert.throws(()=>test(AIRO,null,keep),/Emoji placement/);
 assert.throws(()=>test(AIRO,null,{...valid,ruleChecks:valid.ruleChecks.slice(1)}),/coverage/);
 assert.throws(()=>test('Astro 😊',null,{...valid,suggestion:'Astro',ruleChecks:checks({})}),/valid emoji was removed/);
 // Context-menu action uses the same prompt and result renderer, and no regex rules.
 p.state.reviewResponse=[valid];await p.events.message.emit({type:'AUDIT_SELECTED_COPY',text:AIRO,source:{tabId:p.state.tab.id,url:p.state.tab.url},requestedAt:Date.now()+100});
 assert(p.text().includes('Emoji placement'));assert(p.text().includes(proposed));assert(!p.text().includes('ASTRO'));
 const menuPrompt=p.state.requests.at(-1).payload.systemInstruction.parts[0].text;assert.equal(menuPrompt,prompt);
 const before=p.state.requests.length;await p.events.message.emit({type:'COPY_CHECK_RESULT',result:{original:'Old cached result'},requestedAt:Date.now()+100,source:{tabId:p.state.tab.id,url:p.state.tab.url}});assert.equal(p.state.requests.length,before);
 console.log('AIRO regression: reproduced legacy bug separately; coverage, contradictory-brand rejection/retry, emoji boundary checks, retained claims/emoji, multiple findings and shared context-menu AI pipeline pass with fixture Gemini responses. No live AI call.');
})().catch(error=>{console.error(error);process.exitCode=1;});
