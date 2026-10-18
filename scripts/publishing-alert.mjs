import {readFileSync} from 'node:fs';
import {run,inspectDeployment} from './publishing-health.mjs';
const repo=process.env.GITHUB_REPOSITORY;
const token=process.env.GITHUB_TOKEN;
if(!repo||!token)throw new Error('GitHub Actions repository and token required');
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
const drill=process.env.ALERT_DRILL==='true';
const title=drill?'[Publishing alert test] Delivery and recovery drill':'[Publishing health] Action required';
const runUrl=`https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
async function api(path,method='GET',body){
 const r=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`GitHub ${method} ${path}: ${r.status}`);
 return r.status===204?null:r.json();
}
let failures=await run({base:'https://www.yourpetpass.com'});
if(event.deployment_status) failures.push(...inspectDeployment(event.deployment_status.state,event.deployment?.environment));
// Detect a successful Git commit that never becomes production. Allow builds 30 minutes.
try {
 const head=await api('/commits/main');
 const r=await fetch('https://www.yourpetpass.com/publishing-build.json',{signal:AbortSignal.timeout(25000),headers:{'Cache-Control':'no-cache'}});
 const build=await r.json();
 if(build.commit!==head.sha && Date.now()-Date.parse(head.commit.committer.date)>30*60*1000)failures.push(`Main commit ${head.sha} has not reached production (serving ${build.commit}). Inspect Vercel Git integration and deployment logs; merge age exceeds 30 minutes.`);
}catch(e){failures.push(`Deployment identity check failed: ${e.message}`);}
if(drill)failures.push('SIMULATED FAILURE: wrong production page. This is an alert-delivery test; no production content was changed.');
const issues=await api('/issues?state=open&per_page=100');
const existing=issues.find(i=>i.title===title&&!i.pull_request);
if(failures.length){
 const body=`Publishing checks require attention.\n\n${failures.map(f=>`- ${f}`).join('\n')}\n\nNext action: open the check run, compare the production commit and affected URLs, fix the failing branch, verify a preview, then verify production. Do not mark backlog work published from a commit alone.\n\n[Check run](${runUrl})\n\nOwner: @bgravley\n\n<!-- publishing-health -->`;
 if(!existing){
  const created=await api('/issues','POST',{title,body,assignees:['bgravley']});
  console.log(`Alert created: ${created.html_url}`);
 }else {
  const comments=await api(`/issues/${existing.number}/comments?per_page=100`);
  const last=comments.filter(c=>c.body.includes('<!-- publishing-health -->')).at(-1);
  const lastNotice=Date.parse(last?.created_at||existing.created_at);
  const age=Date.now()-Date.parse(existing.created_at);
  const changed=existing.body.split('\n\n[Check run]')[0]!==body.split('\n\n[Check run]')[0];
  if(changed||Date.now()-lastNotice>=24*60*60*1000){
   const escalation=age>=48*60*60*1000?'Unresolved for at least 48 hours: owner action required.':age>=24*60*60*1000?'Unresolved for at least 24 hours: investigate today.':'Failure details changed.';
   await api(`/issues/${existing.number}/comments`,'POST',{body:`${escalation}\n\n${body}`});
   await api(`/issues/${existing.number}`,'PATCH',{body});
  }
  console.log(`Open alert: ${existing.html_url}`);
 }
 process.exitCode=1;
}else if(existing){
 await api(`/issues/${existing.number}/comments`,'POST',{body:`Recovered: production page, routing, metadata, backlog and commit checks passed. [Verification](${runUrl}).\n\n<!-- publishing-health -->`});
 await api(`/issues/${existing.number}`,'PATCH',{state:'closed',state_reason:'completed'});
 console.log('Recovered; alert closed.');
}else console.log('Healthy; no alert.');
// Close only a previous explicit drill after a successful real production check.
if(!drill&&!failures.length){
 const testIssue=issues.find(i=>i.title==='[Publishing alert test] Delivery and recovery drill'&&!i.pull_request);
 if(testIssue){await api(`/issues/${testIssue.number}/comments`,'POST',{body:`Recovery drill passed: all real production checks are healthy. [Run](${runUrl}).`});await api(`/issues/${testIssue.number}`,'PATCH',{state:'closed',state_reason:'completed'});}
}
