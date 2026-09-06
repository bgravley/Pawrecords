#!/usr/bin/env python3
from pathlib import Path

paw = Path('src/PawRecord.jsx').read_text(encoding='utf-8')

checks = []
def check(condition, message):
    checks.append((bool(condition), message))

check('POST_SUCCESS_FEEDBACK_COOLDOWN_MS=90*24*60*60*1000' in paw,
      'automatic feedback prompt has a 90-day cooldown')
check('successMilestones<2' in paw,
      'automatic feedback prompt requires multiple meaningful product wins')
check('healthRecordCount>=2?1:0' in paw,
      'health milestone requires more than a single record')
check('state.dogs.length>0?1:0' in paw and 'upcomingTrips.length>0?1:0' in paw,
      'pet and travel value contribute to eligibility without requiring Premium')
check('e2e-primary@yourpetpass.com' in paw and 'e2e-secondary@yourpetpass.com' in paw,
      'synthetic production E2E users are excluded from the automatic prompt')
check('`ypp_feedback_prompt_v1_${userId}`' in paw,
      'prompt preference is scoped to the signed-in user')
check('JSON.stringify({status,at:Date.now()})' in paw,
      'local prompt persistence stores only generic status and timestamp')
check('petName' not in paw[paw.find('POST_SUCCESS_FEEDBACK_COOLDOWN_MS'):paw.find('const Home=', paw.find('POST_SUCCESS_FEEDBACK_COOLDOWN_MS'))+6000],
      'post-success prompt state does not persist pet-specific details')
check('How’s YourPetPass working for you?' in paw and 'Not now' in paw,
      'prompt is a dismissible in-product card')
check('setFeedbackModalInitialType("feedback")' in paw,
      'post-success prompt opens the existing feedback system on general feedback')
check('initialType={feedbackModalInitialType}' in paw and 'onSubmitted={()=>rememberFeedbackPrompt("submitted")}' in paw,
      'successful feedback permanently suppresses repeat automatic prompts')
check('onSubmitted?.(reportType);' in paw,
      'feedback modal reports successful submission to the caller')
check('setFeedbackModalInitialType("bug");setShowBugReport(true);' in paw,
      'existing header feedback launcher keeps its prior bug-report starting behavior')
check('App Store' not in paw[paw.find('POST_SUCCESS_FEEDBACK_COOLDOWN_MS'):paw.find('const Home=', paw.find('POST_SUCCESS_FEEDBACK_COOLDOWN_MS'))+10000],
      'web feedback prompt does not pretend to be an App Store review request')

failed = [m for ok, m in checks if not ok]
for ok, message in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + message)

if failed:
    raise SystemExit(f'{len(failed)} post-success feedback audit check(s) failed')
print(f'Post-success feedback audit passed: {len(checks)}/{len(checks)} checks')
