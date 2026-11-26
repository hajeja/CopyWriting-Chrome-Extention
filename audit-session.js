'use strict';
// Temporary state only. No storage access and no audit result persistence.
const AuditSession = (() => {
  let revision=0, source=null, project=null, mode=null, controller=new AbortController(), changedAt=Date.now();
  const listeners=new Set();
  function invalidate() {
    controller.abort();controller=new AbortController();revision++;changedAt=Date.now();
    listeners.forEach(listener => listener());
  }
  function setProject(value) {
    if(JSON.stringify(project)===JSON.stringify(value))return;
    project=value ? {...value} : null;mode=null;invalidate();
  }
  function setSource(value, force=false) {
    if(!force && source?.tabId===value?.tabId && source?.url===value?.url)return;
    const initial=!source && value && !force;
    source=value ? {...value} : null;
    if(!initial)invalidate();
  }
  function begin(value) {mode=value;invalidate();return capture();}
  function capture() {return {revision,signal:controller.signal,source:source?{...source}:null,project:project?{...project}:null,mode};}
  function current(scope) {return !!scope && scope.revision===revision && !scope.signal.aborted;}
  function assert(scope) {if(!current(scope))throw new DOMException('Audit cancelled because the workspace changed.','AbortError');}
  return {setProject,setSource,begin,capture,current,assert,invalidate,changedAt:()=>changedAt,
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}};
})();
