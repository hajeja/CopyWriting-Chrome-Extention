'use strict';
const ProjectMemoryModel = (() => {
  const TRIBES = ['supplier', 'buyer', 'mitra'];
  function project(value) {
    if (!value || typeof value.id !== 'string' || !TRIBES.includes(value.tribe) || typeof value.name !== 'string' || typeof value.context !== 'string') throw new Error('Saved project data could not be read.');
    // This is the entire persistent project record. No URLs, keys or audit results.
    return {id:value.id, tribe:value.tribe, name:value.name, context:value.context};
  }
  return {TRIBES, project};
})();
