import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const origin = 'https://www.yourpetpass.com';
export const pages = [
  ['/pet-health-records.html', 'Pet Health Records: What to Keep and How to Organize Them'],
  ['/blog/pet-medical-records-transfer-checklist.html', 'Pet Medical Records Transfer Checklist'],
  ['/blog/eu-pet-health-certificate-changes-october-2026.html', 'EU Pet Health Certificate Changes: October 2026 Rules Now in Effect'],
];
export function inspectPage(path, title, status, body) {
  const failures = [];
  if (status !== 200) failures.push(`${path}: HTTP ${status}, expected 200`);
  if (!body.includes(`<h1>${title}</h1>`)) failures.push(`${path}: expected heading missing (possible homepage fallback)`);
  if (!body.includes(`<link rel="canonical" href="${origin}${path}">`)) failures.push(`${path}: incorrect canonical`);
  if (!body.includes('href="/signup"')) failures.push(`${path}: signup CTA missing`);
  const schemas = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => {try{return JSON.parse(m[1]);}catch{return null;}});
  const article = schemas.find(s => s?.['@type'] === 'BlogPosting');
  if (!article || article.author?.['@type'] !== 'Organization' || !article.dateModified || article.mainEntityOfPage !== origin + path) failures.push(`${path}: incomplete article metadata or non-organizational author`);
  if (!schemas.some(s => s?.['@type'] === 'BreadcrumbList')) failures.push(`${path}: breadcrumbs missing`);
  return failures;
}
export function inspectBacklog(items, now = Date.now()) {
  return items.filter(i => i.status !== 'published' && i.dueAt && Date.parse(i.dueAt) < now).map(i => `Overdue publishing: ${i.title}; owner ${i.owner}; next action: ${i.nextAction}`);
}
export function inspectDeployment(state, target) {
  return target === 'Production' && ['failure','error'].includes(state) ? [`Production deployment ${state}: inspect the linked Vercel build logs and repair or roll back the failed release.`] : [];
}
export function digest(body) { return createHash('sha256').update(body).digest('hex'); }
export async function run({base, fetcher = fetch} = {}) {
  const failures = []; const hashes = {};
  async function get(path) {
    if (!base) return {status:existsSync(`public${path}`)?200:404, body:existsSync(`public${path}`)?readFileSync(`public${path}`,'utf8'):''};
    const response = await fetcher(new URL(path,base),{signal:AbortSignal.timeout(25000),redirect:'manual',headers:{'Cache-Control':'no-cache'}});
    return {status:response.status,body:await response.text()};
  }
  for (const [path,title] of pages) {
    try {
      const {status,body} = await get(path); failures.push(...inspectPage(path,title,status,body));
      hashes[path] = digest(readFileSync(`public${path}`));
      if (!base) for (const [,link] of body.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
        if (link === '/' || link === '/signup') continue;
        if (!existsSync(`public${link}`)) failures.push(`${path}: broken local link ${link}`);
      }
    } catch(e) {failures.push(`${path}: ${e.message}`);}
  }
  for (const path of ['/blog.html','/sitemap.xml']) {
    try {
      const {status,body}=await get(path);
      if(status!==200) failures.push(`${path}: HTTP ${status}`);
      for(const [article] of pages) if(!body.includes(article)) failures.push(`${path}: missing ${article}`);
    } catch(e){failures.push(`${path}: ${e.message}`);}
  }
  const backlog = JSON.parse(readFileSync('docs/publishing/backlog.json','utf8'));
  failures.push(...inspectBacklog(backlog));
  if(base) {
    for(const path of ['/publishing-health-nonexistent-page','/blog/publishing-health-nonexistent.html','/pet-travel-requirements/not-a-country']) {
      try {const r=await get(path);if(r.status!==404)failures.push(`${path}: HTTP ${r.status}, expected real 404`);}catch(e){failures.push(`${path}: ${e.message}`);}
    }
    try {
      const r=await get('/publishing-build.json');const build=JSON.parse(r.body);
      if(r.status!==200 || !/^[a-f0-9]{40}$/.test(build.commit||'')) failures.push('Production build identity missing');
      for(const [path,hash] of Object.entries(hashes)) if(build.pages?.[path]!==hash) failures.push(`${path}: expected content has not reached production; compare deployment commit ${build.commit} with main`);
    }catch(e){failures.push(`Build identity: ${e.message}`);}
  } else {
    const config=JSON.parse(readFileSync('vercel.json'));
    if(config.rewrites.some(r=>r.source.includes('?!api')))failures.push('Catch-all SPA fallback still configured');
  }
  return failures;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const failures=await run({base:process.env.PUBLISHING_BASE_URL});
  if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Publishing content, metadata, discovery and routing checks passed.');
}
