import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import { pages,digest } from './publishing-health.mjs';
const commit=process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
writeFileSync('dist/publishing-build.json',JSON.stringify({commit,pages:Object.fromEntries(pages.map(([path])=>[path,digest(readFileSync(`public${path}`))]))},null,2)+'\n');
