const fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function event(){const listeners=[];return {addListener:fn=>listeners.push(fn),emit(...args){return Promise.all(listeners.map(fn=>fn(...args)));}};}
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.hidden=false;this.value='';this.disabled=false;this.handlers={};this.text='';this.raw='';}
  get textContent(){return this.text+this.children.map(child=>child.textContent || '').join('');}
  set textContent(value){this.text=String(value);this.raw='';this.children=[];}
  get innerHTML(){return this.raw || this.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  set innerHTML(value){this.raw=value;this.text='';this.children=[];}
  append(...values){this.children.push(...values);}
  replaceChildren(...values){this.text='';this.raw='';this.children=[...values];}
  addEventListener(type,fn){this.handlers[type]=fn;}
  closest(){return {open:false};}
  setAttribute(name,value){this[name]=value;}
  getAttribute(name){return this[name];}
  focus(){this.focused=true;}
  querySelectorAll(){return this.children.map(label=>label.children?.[0]).filter(box=>box?.checked);}
}
function createPanel(store={}){
  const ids=Array.from(fs.readFileSync('sidepanel.html','utf8').matchAll(/\bid="([^"]+)"/g),match=>match[1]);
  const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));
  for(const id of ['projectFields','auditWorkspace','preview'])nodes[id].hidden=true;
  const events={activated:event(),updated:event(),removed:event(),storage:event(),message:event()};
  const state={tab:{id:12,url:'https://supplier-portal-invoice.haibearstd.chatgpt.site/'},store:structuredClone(store),requests:[],writes:0,modelReads:0,injections:[],reviewGate:null,injectionGate:null,missingFoundation:false};
  const chrome={runtime:{getURL:x=>x,onMessage:events.message},
    tabs:{query:async()=>[{...state.tab}],onActivated:events.activated,onUpdated:events.updated,onRemoved:events.removed},
    storage:{local:{get:async()=>structuredClone(state.store),set:async data=>{state.writes++;Object.assign(state.store,structuredClone(data));}},onChanged:events.storage},
    scripting:{executeScript:async request=>{
      state.injections.push(request);
      if(state.injectionGate)return state.injectionGate.promise;
      if(request.func)return [{result:true}];
      if(request.files[0]==='page-audit.js')return [{result:{token:'banner-token',total:2,items:[{id:0,text:state.bannerText || 'Banner Alpha',kind:'banner'},{id:1,text:'Banner Beta',kind:'banner'}]}}];
      return [{result:{supported:true,token:'selection-token',items:[{id:0,text:state.selectionText || 'Selected Alpha',kind:'selected text'}]}}];
    }}};
  const ctx={chrome,console,URL,DOMException,AbortController,TextEncoder,crypto:webcrypto,setTimeout,clearTimeout,document:{getElementById:id=>nodes[id] || null,createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})},fetch:async(url,options)=>{
    if(url.startsWith('foundation/'))return {ok:!(state.missingFoundation && url.includes('buyer-guidelines')),text:async()=>fs.readFileSync(url,'utf8')};
    if(url.endsWith('/models')){state.modelReads++;state.modelOptions=options;if(state.modelGate)return state.modelGate.promise;if(state.modelFailure)return {ok:false,status:state.modelFailure};return {ok:true,json:async()=>({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]})};}
    const payload=JSON.parse(options.body);state.requests.push({payload,signal:options.signal});
    const prompt=payload.systemInstruction.parts[0].text;
    const start=prompt.lastIndexOf('FOUNDATION:');
    const foundation=JSON.parse(prompt.slice(start+prompt.slice(start).indexOf('\n')+1,prompt.indexOf('\nUse the Foundation',start)));
    const results=typeof state.reviewResponse==='function'?state.reviewResponse(payload):state.reviewResponse || JSON.parse(payload.contents[0].parts[0].text).elements.map(item=>({id:item.id,decision:'Keep',findings:['Sudah sesuai guideline'],ruleChecks:foundation.guidelines.map(rule=>({ruleId:rule.id,outcome:'met',finding:''}))}));
    const answer={ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({results})}]}}]})};
    if(state.reviewGate){state.reviewGate.answer=answer;return state.reviewGate.promise;}
    return answer;
  }};
  vm.createContext(ctx);
  for(const file of ['audit-session.js','review-foundation.js','foundation-loader.js','sidepanel.js','project-memory-model.js','project-memory.js','audit.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
  vm.runInContext('globalThis.memory=ProjectMemory;globalThis.session=AuditSession;',ctx);
  let selectionCount=0;
  const mode=value=>{const id=value==='page'?'modePage':'modeSelected';nodes.modePage.checked=value==='page';nodes.modeSelected.checked=value==='selected';return nodes[id].handlers.change();};
  return {ctx,nodes,events,state,mode,
    page:()=>{mode('page');return nodes.audit.handlers.click();},
    selected:()=>events.message.emit({type:'AUDIT_SELECTED_COPY',text:state.selectionText || 'Selected Alpha',source:{tabId:state.tab.id,url:state.tab.url},requestedAt:Date.now()+1000000+(++selectionCount),requestId:'test-selection-'+selectionCount}),
    click:id=>nodes[id].handlers.click(),change:(id,value)=>{nodes[id].value=value;return nodes[id].handlers.change();},
    ready:async()=>{await tick();await ctx.memory.refresh();await ctx.loadFoundation();await tick();},
    project:async(tribe='supplier',name='Supplier Portal',context='Confirmed shared context')=>{nodes.domain.value=tribe;nodes.domain.handlers.change();nodes.projectChoice.value='new';nodes.projectChoice.handlers.change();nodes.projectName.value=name;nodes.projectShared.value=context;await nodes.saveProject.handlers.click();},
    text:()=>nodes.results.children.filter(item=>!item.hidden).map(item=>item.textContent).join('\n')};
}
module.exports={createPanel,tick,deferred};
