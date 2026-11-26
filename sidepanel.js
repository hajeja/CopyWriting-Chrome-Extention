'use strict';
// Presentation-only state: changing sections never mutates project or audit state.
const PanelUI = (() => {
  const el=id=>document.getElementById(id);
  const tabs={project:el('projectTab'),settings:el('settingsTab')};
  function selectTab(name) {
    if(!tabs[name])return;
    for(const [key,tab] of Object.entries(tabs)){
      const selected=key===name;
      tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
      el(key==='project'?'projectPanel':'settingsPanel').hidden=!selected;
    }
  }
  for(const [name,tab] of Object.entries(tabs)){
    tab.addEventListener('click',()=>selectTab(name));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const target=event.key==='Home'?'project':event.key==='End'?'settings':name==='project'?'settings':'project';
      selectTab(target);tabs[target].focus();
    });
  }
  const plausible=()=>/^[A-Za-z0-9_-]{20,}$/.test(el('apiKey').value.trim());
  let revision=0, controller=null;
  function changedKey(){revision++;controller?.abort();controller=null;el('connectionStatus').textContent='';el('testConnection').disabled=!plausible();}
  function failure(error){
    const status=error.message?.match(/HTTP (\d{3})/)?.[1];
    if(status==='400' || status==='401')return 'Gemini rejected this API key. Check the key and try again.';
    if(status==='403')return 'This key or Google project is not authorized to access Gemini models.';
    if(status==='429')return 'Gemini rate limit or quota reached. Check your project quota and retry later.';
    if(status)return `Gemini returned HTTP ${status}. Try again later.`;
    if(error.message?.startsWith('No compatible Gemini models') || error.message?.startsWith('No compatible Gemini Flash model'))return 'The key has no compatible Gemini Flash model available for audits.';
    if(error.message?.includes('timed out'))return 'Gemini timed out. Check your connection and try again.';
    return 'Could not verify Gemini access. Check your connection and try again.';
  }
  el('apiKey').addEventListener('input',changedKey);
  el('testConnection').addEventListener('click',async()=>{
    if(!plausible() || controller)return;
    const request=++revision, key=el('apiKey').value.trim();
    controller=new AbortController();el('testConnection').disabled=true;
    el('connectionStatus').textContent='Testing…';
    try{
      // Reuse the audit provider's authenticated model-discovery GET, never generateContent.
      await getModel(key,controller.signal);
      if(request===revision)el('connectionStatus').textContent='Connection successful';
    }catch(error){if(request===revision)el('connectionStatus').textContent='Connection failed: '+failure(error);}
    finally{if(request===revision){controller=null;el('testConnection').disabled=!plausible();}}
  });
  selectTab('project');changedKey();
  return {selectTab};
})();
