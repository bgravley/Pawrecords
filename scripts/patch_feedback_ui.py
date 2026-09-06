#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)

# Authenticated customer feedback modal and launcher.
paw_path = Path('src/PawRecord.jsx')
paw = paw_path.read_text(encoding='utf-8')
paw = replace_once(
    paw,
    'const BugReportModal=({userId,userEmail,onClose})=>{\n  const[description,setDescription]=useState("");',
    'const BugReportModal=({userId,userEmail,onClose})=>{\n  const[description,setDescription]=useState("");\n  const[reportType,setReportType]=useState("bug");',
    'feedback type state',
)
paw = replace_once(
    paw,
    'if(!description.trim())return setErr("Please describe the bug before submitting.");',
    'if(!description.trim())return setErr(reportType==="bug"?"Please describe the bug before submitting.":"Please add a little detail before submitting.");',
    'feedback validation message',
)
paw = replace_once(
    paw,
    'body:JSON.stringify({userId,userEmail,description:description.trim(),screenshotUrl})',
    'body:JSON.stringify({userId,userEmail,reportType,description:description.trim(),screenshotUrl})',
    'feedback request body',
)
paw = replace_once(
    paw,
    'return(<Modal title="🐛 Report a Bug" onClose={onClose}>',
    'return(<Modal title="💬 Share Feedback" onClose={onClose}>',
    'feedback modal title',
)
paw = replace_once(
    paw,
    '<div style={{fontFamily:"\'Lora\',serif",fontSize:18,marginBottom:8}}>Thanks for the report!</div>\n        <div style={{fontSize:14,color:"#385744",lineHeight:1.6,marginBottom:8}}>We\'ll take a look. If it\'s a real bug, we\'ll add a free month to your account as a thank-you.</div>',
    '<div style={{fontFamily:"\'Lora\',serif",fontSize:18,marginBottom:8}}>{reportType==="bug"?"Thanks for the report!":reportType==="feature"?"Thanks for the idea!":"Thanks for the feedback!"}</div>\n        <div style={{fontSize:14,color:"#385744",lineHeight:1.6,marginBottom:8}}>{reportType==="bug"?"We\'ll take a look. If it\'s a confirmed bug, we\'ll add a free month to an eligible active subscription as a thank-you.":"We\'ve saved this for review. Feedback like this helps us decide what to improve next."}</div>',
    'feedback success copy',
)
paw = replace_once(
    paw,
    '<div style={{fontSize:13,color:"#385744",lineHeight:1.6}}>\n          Found something broken? Tell us what happened and what you expected instead. Real bugs get a free month added to your account once we confirm it.\n        </div>\n        <Field label="What went wrong?">\n          <textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. When I tap Export on Biscuit\'s page, nothing happens..." style={{minHeight:120}}/>\n        </Field>',
    '<Field label="What would you like to share?">\n          <select value={reportType} onChange={e=>setReportType(e.target.value)}>\n            <option value="bug">Report a bug</option>\n            <option value="feature">Request a feature</option>\n            <option value="feedback">Share general feedback</option>\n          </select>\n        </Field>\n        <div style={{fontSize:13,color:"#385744",lineHeight:1.6}}>\n          {reportType==="bug"?"Found something broken? Tell us what happened and what you expected instead. Confirmed bugs may qualify for our bug-report thank-you.":reportType==="feature"?"Have an idea that would make YourPetPass more useful? Tell us what you would like to be able to do.":"Tell us what is working well, what feels confusing, or anything else you think we should know."}\n        </div>\n        <Field label={reportType==="bug"?"What went wrong?":reportType==="feature"?"What would you like us to add?":"Your feedback"}>\n          <textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder={reportType==="bug"?"e.g. When I tap Export on Biscuit\'s page, nothing happens...":reportType==="feature"?"e.g. I\'d love a single printable packet with my pet\'s travel documents...":"Tell us what you think..."} style={{minHeight:120}}/>\n        </Field>',
    'feedback type selector and prompts',
)
paw = paw.replace('alt="Bug screenshot"', 'alt="Feedback screenshot"')
paw = replace_once(
    paw,
    '<button onClick={()=>setShowBugReport(true)} title="Report a Bug"',
    '<button onClick={()=>setShowBugReport(true)} title="Share Feedback" aria-label="Share feedback"',
    'feedback launcher accessible name',
)
paw = paw.replace('>🐛</button>', '>💬</button>', 1)
paw_path.write_text(paw, encoding='utf-8')

# Admin queue: one place to review bugs, ideas, and feedback.
admin_path = Path('src/Admin.jsx')
admin = admin_path.read_text(encoding='utf-8')
admin = replace_once(
    admin,
    '{ id: "bugs", label: `Bug Reports (${bugReports.filter(b=>b.status===\'pending\').length})`, alert: bugReports.filter(b=>b.status===\'pending\').length > 0 },',
    '{ id: "bugs", label: `Feedback (${bugReports.filter(b=>b.status===\'pending\').length})`, alert: bugReports.filter(b=>b.status===\'pending\').length > 0 },',
    'admin feedback tab label',
)
admin = replace_once(admin, '<div style={{ fontWeight: 700, fontSize: 16 }}>Bug Reports</div>', '<div style={{ fontWeight: 700, fontSize: 16 }}>Feedback & Reports</div>', 'admin feedback heading')
admin = replace_once(admin, '>No bug reports yet</div>', '>No feedback or reports yet</div>', 'admin feedback empty state')
admin = replace_once(
    admin,
    '<div style={{ background: C.bg, borderRadius: 8, padding: 12, fontSize: 13, color: C.text, marginBottom: (report.status === \'pending\' || report.screenshot_url) ? 12 : (report.reward_type ? 8 : 0), whiteSpace: "pre-wrap" }}>',
    '<div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",color:(report.report_type||"bug")==="bug"?C.danger:(report.report_type||"bug")==="feature"?C.warn:C.accent,marginBottom:7}}>{(report.report_type||"bug")==="bug"?"Bug Report":(report.report_type||"bug")==="feature"?"Feature Request":"General Feedback"}</div>\n                  <div style={{ background: C.bg, borderRadius: 8, padding: 12, fontSize: 13, color: C.text, marginBottom: (report.status === \'pending\' || report.screenshot_url) ? 12 : (report.reward_type ? 8 : 0), whiteSpace: "pre-wrap" }}>',
    'admin feedback type badge',
)
admin = replace_once(admin, '✓ Approve & Reward', '{(report.report_type||"bug")==="bug"?"✓ Approve & Reward":"✓ Mark Reviewed"}', 'admin review action label')
admin = replace_once(admin, '✗ Reject', '{(report.report_type||"bug")==="bug"?"✗ Reject":"Archive"}', 'admin archive action label')
admin_path.write_text(admin, encoding='utf-8')

# Admin action: feature requests and general feedback must never enter the
# bug-reward Stripe path. Bugs retain the existing reward workflow.
api_path = Path('api/admin-data.js')
api = api_path.read_text(encoding='utf-8')
api = replace_once(
    api,
    "        let rewardType = 'no_reward';\n        let rewardMessage = '';",
    "        const reportType = report.report_type || 'bug';\n        let rewardType = reportType === 'bug' ? 'no_reward' : 'not_applicable';\n        let rewardMessage = reportType === 'feature'\n          ? \"Thanks for the idea — we've reviewed your feature request and added it to our product feedback queue.\"\n          : reportType === 'feedback'\n            ? \"Thanks for taking the time to share your feedback — we've reviewed it.\"\n            : '';",
    'admin report type reward defaults',
)
api = replace_once(
    api,
    "          if (profile?.subscription_tier === 'lifetime') {",
    "          if (reportType !== 'bug') {\n            // Feature requests and general feedback are valuable, but they are\n            // not bug-bounty submissions and must never modify billing.\n          } else if (profile?.subscription_tier === 'lifetime') {",
    'non-bug billing bypass',
)
api = replace_once(
    api,
    "                subject: '🐛 Your bug report was reviewed',\n                html: `<div style=\"font-family:sans-serif;max-width:500px;margin:0 auto;\"><div style=\"background:#1E5C52;padding:20px 24px;border-radius:12px 12px 0 0;\"><img src=\"https://yourpetpass.com/logo_horizontal_cream_transparent.png\" alt=\"YourPetPass\" width=\"160\" style=\"display:block;height:auto;\" /></div><div style=\"padding:20px;\"><h2>Thanks for reporting that!</h2><p>${rewardMessage}</p></div></div>`,",
    "                subject: reportType === 'bug' ? '🐛 Your bug report was reviewed' : 'Your YourPetPass feedback was reviewed',\n                html: `<div style=\"font-family:sans-serif;max-width:500px;margin:0 auto;\"><div style=\"background:#1E5C52;padding:20px 24px;border-radius:12px 12px 0 0;\"><img src=\"https://yourpetpass.com/logo_horizontal_cream_transparent.png\" alt=\"YourPetPass\" width=\"160\" style=\"display:block;height:auto;\" /></div><div style=\"padding:20px;\"><h2>${reportType === 'bug' ? 'Thanks for reporting that!' : 'Thanks for helping us improve YourPetPass.'}</h2><p>${rewardMessage}</p></div></div>`,",
    'admin feedback outcome email',
)
api_path.write_text(api, encoding='utf-8')

print('Patched customer feedback UI, admin queue, and non-bug review behavior.')
