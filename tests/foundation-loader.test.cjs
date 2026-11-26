const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
let missing='',corrupt='',reads=[];
const ctx={TextEncoder,crypto:webcrypto,chrome:{runtime:{getURL:path=>path}},fetch:async(path,options)=>{
  reads.push({path,options});
  return {ok:path!==missing,text:async()=>fs.readFileSync(path,'utf8')+(path===corrupt?' ': '')};
}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('review-foundation.js','utf8')+'\n'+fs.readFileSync('foundation-loader.js','utf8')+'\nglobalThis.loader=FoundationLoader',ctx);
(async()=>{
 const {config,source,summary}=await ctx.loader.load();
 assert.equal(source.commit,'618799d519dba93159c96307d03e4ebb39707bc1');
 assert.match(summary,/supplier: 0\.3\.1-pilot-draft \(4 enabled\)/);
 assert.match(summary,/buyer: 0\.2\.0-playbook-replacement \(25 enabled\)/);
 assert.match(summary,/mitra: 0\.1\.1-pilot-approved \(9 enabled\)/);
 assert(reads.every(read=>read.options.cache==='no-store'));
 for(const [domain,count] of Object.entries({supplier:4,buyer:25,mitra:9})){
   const view=ctx.foundationView(config,domain),prompt=ctx.buildSystemPrompt({domain},config);
   assert.equal(view.guidelines.length,count);assert(view.guidelines.every(rule=>rule.id.startsWith(domain+'-')));
   assert(view.principles.length && view.componentPatterns.length);
   if(domain!=='supplier'){
     assert(!prompt.includes('supplier-guideline-'));assert(!prompt.includes('mandatoryTerminology'));assert(!view.glossary.some(term=>term.term==='Supplier'));
     assert.equal(ctx.applyReviewGuardrails({decision:'Keep'}, {currentCopy:'Vendor'}, {domain},config).decision,'Keep');
     assert.equal(view.approvalScope,config.domainConfigs[domain].approvalScope || '');
   }
 }
 const shared=ctx.foundationView(config,'');assert.equal(shared.guidelines.length,0);assert.equal(shared.glossary.length,0);
 assert(!ctx.buildSystemPrompt({domain:''},config).includes('mandatoryTerminology'));
 assert.equal(ctx.foundationView(config,'mitra').glossaryCandidates.length,5);
 assert(ctx.foundationView(config,'mitra').glossaryCandidates.every(term=>term.authority.includes('unconfirmed')));
 missing=source.files.buyer.path;await assert.rejects(ctx.loader.load(),/Could not load/);missing='';
 corrupt=source.files.mitra.path;await assert.rejects(ctx.loader.load(),/differs from the verified/);corrupt='';
 assert.equal((await ctx.loader.load()).config.domainConfigs.buyer.version,'0.2.0-playbook-replacement');
 console.log('Verified Git blobs, all tribe versions/counts, no-cache reads, shared-only scope, domain isolation, uncertain references and missing/changed file failures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
