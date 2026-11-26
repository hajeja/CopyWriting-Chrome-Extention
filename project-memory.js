'use strict';
const ProjectMemory = (() => {
  const KEY = 'projectMemoryV2', LEGACY = 'projectMemoryV1';
  const el = id => document.getElementById(id), model = ProjectMemoryModel;
  const listeners = new Set();
  let projects = [], legacy = [], active = null, editingId = '', saving = false, ready = false, generation = 0, loadRequest = 0, formOpen = false;
  function emit() { listeners.forEach(listener => listener(snapshot())); }
  function snapshot() { return {project:active ? {...active} : null}; }
  async function read() {
    const saved = await chrome.storage.local.get([KEY, LEGACY]);
    if (saved[KEY] !== undefined && !Array.isArray(saved[KEY])) throw new Error('Saved project data could not be read.');
    return {projects:(saved[KEY] || []).map(model.project), legacy:Array.isArray(saved[LEGACY]) ? saved[LEGACY] : []};
  }
  function option(select, value, text) {
    const node = document.createElement('option'); node.value = value; node.textContent = text; select.append(node);
  }
  function render() {
    el('projectSetup').hidden = !!active;
    el('auditWorkspace').hidden = !active;
    el('projectFields').hidden = !!active || !el('domain').value || !formOpen;
    el('savedProjects').hidden = false;
    el('projectSummary').textContent = active ? `${active.tribe.charAt(0).toUpperCase()+active.tribe.slice(1)} · ${active.name}` : '';
    const select = el('projectChoice'); select.replaceChildren();
    select.disabled = !el('domain').value;
    option(select, '', el('domain').value ? 'Choose a project' : 'Select a tribe first');
    if(el('domain').value)option(select, 'new', 'Create New Project');
    projects.filter(project => project.tribe === el('domain').value).forEach(project => option(select, project.id, project.name));
    // Older projects had no tribe. Only assign one after an explicit choice + Save.
    legacy.filter(project => project && typeof project.id === 'string' && !projects.some(saved => saved.id === project.id))
      .forEach(project => option(select, 'legacy:' + project.id, `${project.name || 'Previous project'} (assign tribe on Save)`));
    select.value = editingId || (formOpen ? 'new' : '');
  }
  async function refresh() {
    const request=++loadRequest, revision=generation;
    const saved = await read();
    if(request!==loadRequest)return;
    if(revision!==generation)return refresh();
    projects = saved.projects; legacy = saved.legacy; ready = true;
    if (active) {
      const latest = projects.find(project => project.id === active.id);
      if (JSON.stringify(active) !== JSON.stringify(latest || null)) { active = latest || null; emit(); }
    }
    render();
  }
  function clearForm() { formOpen=false; editingId=''; el('projectName').value=''; el('projectShared').value=''; }
  function deactivate() { generation++; active=null; emit(); }
  function reset() {
    deactivate(); el('domain').value=''; clearForm(); el('editorStatus').textContent=''; render();
    PanelUI.selectTab('project');
  }
  function activate(project) {
    generation++; active={...project}; editingId=project.id; formOpen=false; el('domain').value=project.tribe;
    el('projectName').value=project.name; el('projectShared').value=project.context;
    el('editorStatus').textContent=''; render(); emit();
  }
  el('domain').addEventListener('change', () => {deactivate(); clearForm(); el('editorStatus').textContent=''; render();});
  el('projectChoice').addEventListener('change', () => {
    const id=el('projectChoice').value; deactivate(); clearForm(); editingId=id==='new' ? '' : id;
    formOpen=id==='new' || id.startsWith('legacy:');
    const saved=projects.find(project => project.id===id && project.tribe===el('domain').value);
    if(saved){activate(saved);return;}
    const old=id.startsWith('legacy:') && legacy.find(project => project.id===id.slice(7));
    if(old){el('projectName').value=old.name || '';el('projectShared').value=old.shared || old.context || '';}
    render();
  });
  el('saveProject').addEventListener('click', async () => {
    if(saving || !formOpen)return;
    const revision=generation, selectedId=editingId;
    const tribe=el('domain').value, name=el('projectName').value.trim(), context=el('projectShared').value.trim();
    if(!model.TRIBES.includes(tribe) || !name){el('editorStatus').textContent='Choose a tribe and enter a project name.';return;}
    saving=true;el('saveProject').disabled=true;
    try {
      if(!ready)throw new Error('Project is still loading. Try again.');
      const saved=await read();
      if(revision!==generation)return;
      const id=selectedId.startsWith('legacy:') ? selectedId.slice(7) : selectedId || crypto.randomUUID();
      const previous=saved.projects.find(project => project.id===id);
      if(previous && previous.tribe!==tribe)throw new Error('This project belongs to another tribe. Create a new project.');
      if(selectedId && !selectedId.startsWith('legacy:') && !previous)throw new Error('This project is no longer available.');
      const project=model.project({id,tribe,name,context});
      const next=saved.projects.filter(item => item.id!==id).concat(project);
      await chrome.storage.local.set({[KEY]:next});
      projects=next; legacy=saved.legacy;
      // A save that completes after Reset may persist the explicit save, but cannot reopen the workspace.
      if(revision===generation)activate(project);
    } catch(error){if(revision===generation)el('editorStatus').textContent='Could not save: '+error.message;}
    finally {saving=false;el('saveProject').disabled=false;}
  });
  el('resetWorkspace').addEventListener('click', reset);
  el('editProject').addEventListener('click', () => {
    const project=active;if(!project)return;
    deactivate();editingId=project.id;formOpen=true;el('domain').value=project.tribe;
    el('projectName').value=project.name;el('projectShared').value=project.context;render();
  });
  chrome.storage.onChanged.addListener((changes,area) => {
    if(area==='local' && (changes[KEY] || changes[LEGACY])) refresh().catch(() => {deactivate();render();el('editorStatus').textContent='Project could not be loaded.';});
  });
  refresh().catch(() => {el('editorStatus').textContent='Project could not be loaded. Saved data has not been changed.';});
  return {refresh, reset, snapshot, subscribe(listener){listeners.add(listener);listener(snapshot());return ()=>listeners.delete(listener);}};
})();
