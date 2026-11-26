const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let installed,clicked,menu,message;let opened=false;
const chrome={runtime:{onInstalled:{addListener:fn=>installed=fn},sendMessage:async value=>{message=value;}},contextMenus:{removeAll:fn=>fn(),create:value=>{menu=value},onClicked:{addListener:fn=>clicked=fn}},sidePanel:{setPanelBehavior:()=>Promise.resolve(),open:()=>{opened=true;return Promise.resolve();}}};
const context={chrome,fetch:()=>{throw Error('Background must not load old rules or call AI separately.');}};
vm.createContext(context);vm.runInContext(fs.readFileSync('background.js','utf8'),context);
installed();assert.equal(menu.title,'Audit Selected Copy');
clicked({menuItemId:menu.id,selectionText:'Astro 😊'},{id:1,windowId:1,url:'https://example.test/'});assert(opened);
setImmediate(()=>{try{assert.equal(message.type,'AUDIT_SELECTED_COPY');assert.equal(message.text,'Astro 😊');assert.equal(message.source.tabId,1);assert(!message.result);assert.equal(context.checkCopy,undefined);console.log('Context menu delegates selection evidence to the shared AI audit; no legacy regex or separate provider call.');}catch(error){console.error(error);process.exitCode=1;}});
