#!/usr/bin/env python3
from pathlib import Path

paw = Path('src/PawRecord.jsx').read_text(encoding='utf-8')

checks = []
def check(condition, message):
    checks.append((bool(condition), message))

home_start = paw.find('const Home=')
home_end = paw.find('export default function YourPetPass', home_start)
home = paw[home_start:home_end] if home_start >= 0 and home_end > home_start else ''
overview_start = paw.find('const OverviewTab=')
overview_end = paw.find('const DogDetail=', overview_start)
overview = paw[overview_start:overview_end] if overview_start >= 0 and overview_end > overview_start else ''
feedback_start = paw.find('const BugReportModal=')
feedback_end = paw.find('const AlertsModal=', feedback_start)
feedback = paw[feedback_start:feedback_end] if feedback_start >= 0 and feedback_end > feedback_start else ''
email_start = paw.find('const EmailRecordModal=')
email_end = paw.find('const ShareModal=', email_start)
email_modal = paw[email_start:email_end] if email_start >= 0 and email_end > email_start else ''

check('POST_SUCCESS_FEEDBACK_COOLDOWN_MS=90*24*60*60*1000' in paw,
      'automatic feedback prompt has a 90-day cooldown')
check('successMilestones<2' in home,
      'automatic feedback prompt requires multiple meaningful product wins inside Home')
check('healthRecordCount>=2?1:0' in home,
      'health milestone requires more than a single record')
check('state.dogs.length>0?1:0' in home and 'upcomingTrips.length>0?1:0' in home,
      'pet and travel value contribute to eligibility without requiring Premium')
check('successMilestones' not in overview and 'feedbackPromptStorageKey' not in overview,
      'feedback eligibility logic cannot leak into a pet detail tab')
check('e2e-primary@yourpetpass.com' in paw and 'e2e-secondary@yourpetpass.com' in paw,
      'synthetic production E2E users are excluded from the automatic prompt')
check('`ypp_feedback_prompt_v1_${userId}`' in home,
      'prompt preference is scoped to the signed-in user')
check('JSON.stringify({status,at:Date.now()})' in home,
      'local prompt persistence stores only generic status and timestamp')
check('petName' not in home[home.find('feedbackPromptStorageKey'):home.find('if(selDog)')],
      'post-success prompt state does not persist pet-specific details')
check('How’s YourPetPass working for you?' in home and 'Not now' in home,
      'prompt is a dismissible in-product card')
check('setFeedbackModalInitialType("feedback")' in home,
      'post-success prompt opens the existing feedback system on general feedback')
check('initialType={feedbackModalInitialType}' in home and 'onSubmitted={()=>rememberFeedbackPrompt("submitted")}' in home,
      'successful feedback permanently suppresses repeat automatic prompts')
check('onSubmitted?.(reportType);' in feedback,
      'feedback modal reports successful submission to the caller')
check('onSubmitted?.(reportType);' not in email_modal,
      'feedback callback cannot accidentally run after emailing health records')
check('setFeedbackModalInitialType("bug");setShowBugReport(true);' in home,
      'existing header feedback launcher keeps its prior bug-report starting behavior')
check('App Store' not in home,
      'web feedback prompt does not pretend to be an App Store review request')

failed = [m for ok, m in checks if not ok]
for ok, message in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + message)

if failed:
    raise SystemExit(f'{len(failed)} post-success feedback audit check(s) failed')
print(f'Post-success feedback audit passed: {len(checks)}/{len(checks)} checks')
