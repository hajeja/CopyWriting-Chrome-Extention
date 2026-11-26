// Run locally with authenticated GitHub CLI. No GitHub credential is bundled in Chrome.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
const repo = 'hajeja/CopyWriting-Foundation';
const root = new URL('../', import.meta.url);
function api(path) {
  return JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${path}`], {encoding:'utf8', maxBuffer:5*1024*1024}));
}
function file(path, commit) {
  const value = api(`contents/${path}?ref=${commit}`);
  const bytes = Buffer.from(value.content, 'base64');
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (sha !== value.sha) throw new Error(`Git blob verification failed: ${path}`);
  return {bytes, sha};
}
async function writeIfChanged(path, bytes) {
  const target = new URL(path,root);
  try { if ((await readFile(target)).equals(Buffer.from(bytes))) return; } catch(error) { if(error.code !== 'ENOENT') throw error; }
  await writeFile(target,bytes);
}
try {
  const head = api('commits/main');
  const readme = file('README.md',head.sha).bytes.toString('utf8');
  const paths = Object.fromEntries(Array.from(readme.matchAll(/^\|\s*(Supplier|Buyer|Mitra)\s*\|[^\n(]*\((domains\/[^)]+\.json)\)/gm), match=>[match[1].toLowerCase(),match[2]]));
  const domains = ['supplier','buyer','mitra'];
  const fetched = domains.map(domain=>{
    const sourcePath = paths[domain];
    if(!sourcePath || !new RegExp(`^domains/${domain}/[a-z0-9.-]+\\.json$`).test(sourcePath)) throw new Error(`README has no valid active ${domain} config.`);
    const value=file(sourcePath,head.sha), data=JSON.parse(value.bytes);
    if(data.schemaVersion !== '1.0' || !data.domains?.[domain] || !data.config?.version) throw new Error(`Invalid ${domain} schema.`);
    if(domain==='supplier' && !data.global) throw new Error('Shared global foundation is missing.');
    return {domain,sourcePath,path:'foundation/'+sourcePath.split('/').pop(),version:data.config.version,data,...value};
  });
  const globalFile = paths.supplier.split('/').pop();
  for (const value of fetched.filter(item => item.domain !== 'supplier')) {
    if (value.data.sharedGlobalFoundation?.reference !== `../supplier/${globalFile}#global`) throw new Error('Shared global reference mismatch.');
  }
  // Fetch and validate all three before updating any bundled guideline.
  const source={repository:repo,branch:'main',commit:head.sha,verifiedAt:new Date().toISOString(),globalFrom:'supplier',files:{}};
  for(const value of fetched) {
    await writeIfChanged(value.path,value.bytes);
    source.files[value.domain]={path:value.path,sourcePath:value.sourcePath,blobSha:value.sha,version:value.version};
  }
  await writeIfChanged('foundation/sources.json',JSON.stringify(source,null,2)+'\n');
  console.log(`Synced unmodified Foundation files from ${repo}@${head.sha}. Reload Chrome extension and run local tests.`);
} catch(error) {
  console.error('Foundation sync failed. No fallback to local or historical guideline versions. Check GitHub CLI authentication and repository access.');
  process.exitCode=1;
}
