'use strict';
const FoundationLoader = (() => {
  const DOMAINS = ['supplier', 'buyer', 'mitra'];
  async function read(path) {
    const response = await fetch(chrome.runtime.getURL(path), {cache:'no-store'});
    if (!response.ok) throw new Error('Could not load ' + path);
    return response.text();
  }
  async function gitBlobSha(text) {
    const bytes = new TextEncoder().encode(text);
    const header = new TextEncoder().encode('blob ' + bytes.length + '\0');
    const input = new Uint8Array(header.length + bytes.length);
    input.set(header); input.set(bytes, header.length);
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', input)), b => b.toString(16).padStart(2,'0')).join('');
  }
  async function load() {
    const source = JSON.parse(await read('foundation/sources.json'));
    if (source.repository !== 'hajeja/CopyWriting-Foundation' || !/^[a-f0-9]{40}$/.test(source.commit || '') || source.globalFrom !== 'supplier') throw new Error('Invalid Foundation source manifest.');
    const files = {};
    // All tribes must load. Never silently fall back to old configs or partial rules.
    await Promise.all(DOMAINS.map(async domain => {
      const entry = source.files?.[domain];
      if (!entry || !/^foundation\/[a-z0-9.-]+\.json$/.test(entry.path)) throw new Error('Missing ' + domain + ' Foundation source.');
      const raw = await read(entry.path);
      if (await gitBlobSha(raw) !== entry.blobSha) throw new Error(domain + ' Foundation differs from the verified repository snapshot. Re-sync the Foundation files.');
      const file = JSON.parse(raw);
      if (file.schemaVersion !== '1.0' || file.config?.version !== entry.version || !file.domains?.[domain]) throw new Error('Invalid ' + domain + ' Foundation version or domain.');
      const globalFile = source.files.supplier?.sourcePath?.split('/').pop();
      if (domain !== 'supplier' && file.sharedGlobalFoundation?.reference !== '../supplier/' + globalFile + '#global') throw new Error('Shared global reference does not match the synced Supplier baseline for ' + domain + '.');
      files[domain] = file;
    }));
    const config = validateConfig({
      schemaVersion:'1.0', config:files.supplier.config, global:files.supplier.global,
      domains:Object.fromEntries(DOMAINS.map(domain => [domain, files[domain].domains[domain]])),
      domainConfigs:Object.fromEntries(DOMAINS.map(domain => [domain, files[domain].config])),
      sourceCommit:source.commit
    });
    return {config, source, summary:DOMAINS.map(domain => `${domain}: ${files[domain].config.version} (${activeGuidelines(config, domain).length} enabled)`).join('\n')};
  }
  return {load};
})();
