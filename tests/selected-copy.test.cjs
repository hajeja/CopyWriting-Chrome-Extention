const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('selected-copy.js','utf8');
let text='Selected copy',collapsed=false,reads=0;
const element={closest:()=>null};
const ctx={location:{hostname:'example.test',pathname:'/page'},window:{getSelection:()=>{reads++;return {isCollapsed:collapsed,rangeCount:1,toString:()=>text,getRangeAt:()=>({commonAncestorContainer:element})};}},Node:{ELEMENT_NODE:1},crypto:{randomUUID:()=> 'token'}};
element.nodeType=1;vm.createContext(ctx);
function extract(){return vm.runInContext(source,ctx);}
assert.equal(extract().items[0].text,'Selected copy');assert.equal(ctx.window.__astroCopyAudit.elements[0],element);
text='Updated selection after opening';assert.equal(extract().items[0].text,text);
collapsed=true;assert.equal(extract().items.length,0);collapsed=false;text='   ';assert.equal(extract().items.length,0);
text='x'.repeat(12001);assert.equal(extract().supported,false);
// Cells, ranges with empty cells and no-cell states must all fail closed in Sheets.
ctx.location={hostname:'docs.google.com',pathname:'/spreadsheets/d/example/edit'};
for(const cellState of ['A1','A1:B5','no cell','range with empty cells']){
 const before=reads;assert.equal(extract().supported,false);assert.equal(reads,before);assert.match(extract().reason,/No content was sent/);
}
console.log('Live DOM selection, empty/changed/oversize selection, element references, and fail-closed Google Sheets detection verified. Sheets cell extraction remains unsupported.');
